// ─────────────────────────────────────────────────────────────────────────────
//  SQLite-backed lowdb-compatible adapter
//
//  بديل lowdb v1 — يستخدم better-sqlite3 لتخزين كل entity فى جدول مستقل،
//  مع Schema بسيط (id INTEGER + data JSON). يحاكى الـ chain API بتاع lowdb
//  بحيث الكود الموجود فى server/index.js يشتغل من غير أى تعديل.
//
//  المزايا اللى بنكسبها:
//    • ACID atomic writes (مش بنعيد كتابة ملف JSON كامل كل مرة)
//    • WAL mode = القراءات لا تتعارض مع كتابة واحدة
//    • Transactional batch updates
//    • Crash-safe — لو السيرفر مات أثناء write، الـ DB ما بيتلفش
//
//  Note on SQLite version:
//    محلياً (Windows + Node 22): better-sqlite3@11.x (له prebuilds جاهزة)
//    على السيرفر (CentOS 7 + Node 18): better-sqlite3@7.6.2 (آخر نسخة تدعم GLIBC 2.17)
//    الـ API متطابق بين الاتنين.
// ─────────────────────────────────────────────────────────────────────────────

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// كل الـ collections اللى المشروع بيستخدمها
const COLLECTIONS = ['users', 'reports', 'notifications', 'templates', 'teams'];

// ── Helpers ──────────────────────────────────────────────────────────────────
function matchesPredicate(record, predicate) {
  if (typeof predicate === 'function') return predicate(record);
  if (predicate && typeof predicate === 'object') {
    return Object.keys(predicate).every(k => record[k] === predicate[k]);
  }
  return false;
}

function deepClone(obj) {
  if (obj === null || obj === undefined) return obj;
  return JSON.parse(JSON.stringify(obj));
}

// ─────────────────────────────────────────────────────────────────────────────
//  Main lowdb-compatible API
// ─────────────────────────────────────────────────────────────────────────────
function createDB(dbFilePath) {
  // اضمن وجود المجلد
  const dir = path.dirname(dbFilePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const sqlite = new Database(dbFilePath);

  // WAL mode للأمان والأداء (concurrent reads)
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('synchronous = NORMAL');
  sqlite.pragma('foreign_keys = ON');

  // Schema: كل collection جدول، record per row
  for (const name of COLLECTIONS) {
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS ${name} (
        id INTEGER PRIMARY KEY,
        data TEXT NOT NULL
      )
    `);
  }

  // جدول للـ meta و الـ _nextId و أى key/value
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS kv (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `);

  // ── Prepared statements (cached للأداء) ────────────────────────────────────
  const stmts = {};
  for (const name of COLLECTIONS) {
    stmts[name] = {
      selectAll:  sqlite.prepare(`SELECT id, data FROM ${name} ORDER BY id ASC`),
      selectById: sqlite.prepare(`SELECT id, data FROM ${name} WHERE id = ?`),
      insert:     sqlite.prepare(`INSERT INTO ${name} (id, data) VALUES (?, ?)`),
      update:     sqlite.prepare(`UPDATE ${name} SET data = ? WHERE id = ?`),
      delete:     sqlite.prepare(`DELETE FROM ${name} WHERE id = ?`),
      count:      sqlite.prepare(`SELECT COUNT(*) AS n FROM ${name}`)
    };
  }
  const kvGet    = sqlite.prepare('SELECT value FROM kv WHERE key = ?');
  const kvSet    = sqlite.prepare('INSERT INTO kv (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value');
  const kvDelete = sqlite.prepare('DELETE FROM kv WHERE key = ?');

  // ── Collection helpers ──────────────────────────────────────────────────────
  function loadAll(name) {
    const rows = stmts[name].selectAll.all();
    return rows.map(r => JSON.parse(r.data));
  }

  function loadById(name, id) {
    const row = stmts[name].selectById.get(id);
    return row ? JSON.parse(row.data) : null;
  }

  function persistRecord(name, record) {
    if (record.id === undefined || record.id === null) {
      throw new Error(`[db] record without id cannot be persisted to ${name}`);
    }
    const json = JSON.stringify(record);
    const existing = stmts[name].selectById.get(record.id);
    if (existing) {
      stmts[name].update.run(json, record.id);
    } else {
      stmts[name].insert.run(record.id, json);
    }
  }

  function deleteRecord(name, id) {
    stmts[name].delete.run(id);
  }

  // ── Path-based getters/setters (نفس API بتاع lowdb لـ _nextId, _meta, إلخ) ──
  function pathGet(pathStr) {
    // أمثلة: '_nextId.users', '_meta.templates_version', 'users', 'teams'
    const parts = pathStr.split('.');
    const root = parts[0];

    if (COLLECTIONS.includes(root) && parts.length === 1) {
      // طلب على collection كاملة
      return new ChainCollection(root);
    }

    // kv-stored values
    const row = kvGet.get(pathStr);
    if (!row) return new ChainValue(undefined, pathStr);
    try {
      return new ChainValue(JSON.parse(row.value), pathStr);
    } catch (_) {
      return new ChainValue(row.value, pathStr);
    }
  }

  function pathSet(pathStr, value) {
    const parts = pathStr.split('.');
    const root = parts[0];

    if (COLLECTIONS.includes(root) && parts.length === 1) {
      // إعادة تعيين collection كاملة (مثل: db.set('templates', []).write())
      const tx = sqlite.transaction(() => {
        sqlite.prepare(`DELETE FROM ${root}`).run();
        if (Array.isArray(value)) {
          for (const item of value) persistRecord(root, item);
        }
      });
      return new SetResult(() => tx());
    }

    // kv path
    return new SetResult(() => {
      kvSet.run(pathStr, JSON.stringify(value));
    });
  }

  function pathHas(pathStr) {
    const parts = pathStr.split('.');
    const root = parts[0];
    if (COLLECTIONS.includes(root) && parts.length === 1) {
      // جدول الـ collection موجود دايماً
      return new ChainValue(true, pathStr);
    }
    const row = kvGet.get(pathStr);
    return new ChainValue(!!row, pathStr);
  }

  // ── ChainCollection: array-of-records operations ───────────────────────────
  class ChainCollection {
    constructor(name, items = null, modifier = null) {
      this.name = name;
      this._items = items;            // null = lazy load كل الـ collection
      this._modifier = modifier;      // function تُحدث الـ DB لما .write() يتنادى
    }

    _items_lazy() {
      if (this._items !== null) return this._items;
      return loadAll(this.name);
    }

    // ── Filter / Find / Map / Iterate ────────────────────────────────────────
    find(predicate) {
      const items = this._items_lazy();
      const found = items.find(r => matchesPredicate(r, predicate));
      return new ChainRecord(this.name, found || undefined, predicate);
    }

    filter(predicate) {
      const items = this._items_lazy();
      const filtered = items.filter(r => matchesPredicate(r, predicate));
      return new ChainCollection(this.name, filtered);
    }

    map(fn) {
      const items = this._items_lazy();
      return new ChainValue(items.map(fn), null);
    }

    each(fn) {
      // each يطبق fn على كل عنصر ويعتبره modified — يُكتب وقت .write()
      const items = this._items_lazy();
      const modified = items.map(r => {
        const clone = deepClone(r);
        fn(clone);
        return clone;
      });
      const writeFn = () => {
        const tx = sqlite.transaction(() => {
          for (const r of modified) persistRecord(this.name, r);
        });
        tx();
      };
      return new ChainCollection(this.name, modified, writeFn);
    }

    size() {
      const items = this._items_lazy();
      return new ChainValue(items.length, null);
    }

    // ── Mutators ─────────────────────────────────────────────────────────────
    push(record) {
      const items = this._items_lazy();
      items.push(record);
      const writeFn = () => persistRecord(this.name, record);
      return new ChainCollection(this.name, items, writeFn);
    }

    remove(predicate) {
      const items = this._items_lazy();
      const toDelete = items.filter(r => matchesPredicate(r, predicate));
      const remaining = items.filter(r => !matchesPredicate(r, predicate));
      const writeFn = () => {
        const tx = sqlite.transaction(() => {
          for (const r of toDelete) deleteRecord(this.name, r.id);
        });
        tx();
      };
      return new ChainCollection(this.name, remaining, writeFn);
    }

    // ── Terminal ─────────────────────────────────────────────────────────────
    value() {
      return this._items_lazy();
    }

    write() {
      if (this._modifier) this._modifier();
      return this._items_lazy();
    }
  }

  // ── ChainRecord: single record operations ──────────────────────────────────
  class ChainRecord {
    constructor(name, record, predicate) {
      this.name = name;
      this._record = record;          // قد يكون undefined لو ما اتلقاش
      this._predicate = predicate;
    }

    assign(update) {
      // assign بيُحدث record موجود فى الـ DB
      if (!this._record) {
        // مفيش record — assign على undefined لا تفعل شيء
        return new TerminalResult(undefined, () => {});
      }
      const updated = { ...this._record, ...update };
      const writeFn = () => persistRecord(this.name, updated);
      return new TerminalResult(updated, writeFn);
    }

    value() {
      return this._record !== undefined ? this._record : undefined;
    }

    write() {
      // write على chain فيها find لكن من غير assign — يكتب الـ record كما هو
      if (this._record) persistRecord(this.name, this._record);
      return this._record;
    }
  }

  // ── ChainValue: terminal-only chain (للـ kv values, sizes, etc) ────────────
  class ChainValue {
    constructor(val, pathStr) {
      this._val = val;
      this._path = pathStr;
    }
    value() { return this._val; }
    write() {
      // ChainValue write على kv path مش متوقع، لكن للأمان
      if (this._path) kvSet.run(this._path, JSON.stringify(this._val));
      return this._val;
    }
  }

  // ── SetResult: من db.set() — مش بيتنادى عليه value() عادةً، بس .write() ────
  class SetResult {
    constructor(writeFn) {
      this._write = writeFn;
    }
    value() { this._write(); return undefined; }
    write() { this._write(); return undefined; }
  }

  // ── TerminalResult: نتيجة assign().write() ─────────────────────────────────
  class TerminalResult {
    constructor(value, writeFn) {
      this._value = value;
      this._write = writeFn;
    }
    value() { return this._value; }
    write() { this._write(); return this._value; }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  //  Top-level db.X API (نفس lowdb)
  // ─────────────────────────────────────────────────────────────────────────────
  return {
    // ── lowdb defaults: لو الـ collection فاضى أو الـ kv path مش موجود ───────
    defaults(obj) {
      // فى lowdb v1: db.defaults({ users:[], _nextId:{users:1}, ... }).write()
      // المهم: لو الـ key مش موجود، اعمله بالقيمة المعطاة
      const tx = sqlite.transaction(() => {
        for (const [key, val] of Object.entries(obj)) {
          if (COLLECTIONS.includes(key)) {
            // لو الجدول فاضى وفى array مدخلة، احقن القيم
            const count = stmts[key].count.get().n;
            if (count === 0 && Array.isArray(val) && val.length > 0) {
              for (const item of val) persistRecord(key, item);
            }
          } else if (key === '_nextId' && typeof val === 'object') {
            // _nextId.users, _nextId.reports, etc
            for (const [coll, startId] of Object.entries(val)) {
              const fullKey = `_nextId.${coll}`;
              const existing = kvGet.get(fullKey);
              if (!existing) kvSet.run(fullKey, JSON.stringify(startId));
            }
          } else {
            const existing = kvGet.get(key);
            if (!existing) kvSet.run(key, JSON.stringify(val));
          }
        }
      });
      return new SetResult(() => tx());
    },

    get(pathStr)  { return pathGet(pathStr); },
    set(pathStr, value) { return pathSet(pathStr, value); },
    has(pathStr)  { return pathHas(pathStr); },

    // ── Helpers مخصصة (مش جزء من lowdb بس مفيدة) ────────────────────────────
    _raw: sqlite,            // وصول مباشر للـ SQLite لو احتجناه لاحقاً
    _path: dbFilePath,
    _close() { sqlite.close(); }
  };
}

module.exports = { createDB };
