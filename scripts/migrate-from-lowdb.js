#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
//  Migration Script: lowdb (db.json) → SQLite (data.db)
//
//  الاستخدام:
//    node scripts/migrate-from-lowdb.js
//
//  - يقرأ data/db.json (لو موجود)
//  - ينشئ data/data.db
//  - ينقل كل users, reports, templates, teams, notifications + _nextId + _meta
//  - بيعمل verify بعد الانتهاء (counts + sample)
//  - مش بيعدل أو يحذف db.json — يفضل كـ backup
// ─────────────────────────────────────────────────────────────────────────────

const path = require('path');
const fs = require('fs');
const { createDB } = require('../server/db');

const DATA_DIR  = path.join(__dirname, '..', 'data');
const SOURCE    = path.join(DATA_DIR, 'db.json');
const TARGET    = path.join(DATA_DIR, 'data.db');

const COLLECTIONS = ['users', 'reports', 'notifications', 'templates', 'teams'];

function log(level, msg) {
  const prefix = { info: 'ℹ️ ', ok: '✅', warn: '⚠️ ', err: '❌' }[level] || '';
  console.log(`${prefix} ${msg}`);
}

function exitWith(code, msg) {
  log('err', msg);
  process.exit(code);
}

function main() {
  console.log('═══════════════════════════════════════════════');
  console.log('  Migration: lowdb (db.json) → SQLite (data.db)');
  console.log('═══════════════════════════════════════════════\n');

  // 1. تحقق من المصدر
  if (!fs.existsSync(SOURCE)) {
    log('warn', `db.json غير موجود فى: ${SOURCE}`);
    log('info', 'هيتم إنشاء data.db فاضى — السيرفر هيعمل seed تلقائياً');
    const db = createDB(TARGET);
    db._close();
    log('ok', 'data.db أنشئ بنجاح (فاضى)');
    return;
  }

  log('info', `Source: ${SOURCE}`);
  log('info', `Target: ${TARGET}`);

  // 2. لو data.db موجود بالفعل — نسأل
  if (fs.existsSync(TARGET)) {
    const stats = fs.statSync(TARGET);
    log('warn', `data.db موجود بالفعل (${(stats.size / 1024).toFixed(1)} KB)`);
    log('info', 'لو عايز تبدأ من جديد، احذف data.db أولاً');
    log('info', 'الـ migration هيكمل ويحاول merge / overwrite\n');
  }

  // 3. اقرأ db.json
  let source;
  try {
    source = JSON.parse(fs.readFileSync(SOURCE, 'utf8'));
  } catch (e) {
    return exitWith(1, `فشل قراءة db.json: ${e.message}`);
  }

  log('info', 'قراءة db.json بنجاح\n');

  // 4. افتح data.db
  const db = createDB(TARGET);

  // 5. هاجر كل collection
  let stats = { collections: 0, records: 0 };

  for (const name of COLLECTIONS) {
    const items = Array.isArray(source[name]) ? source[name] : [];
    if (!items.length) {
      log('info', `${name}: فاضى — تخطّى`);
      continue;
    }

    // مسح القديم لو موجود (safe re-run)
    db._raw.prepare(`DELETE FROM ${name}`).run();

    // إدخال atomic فى transaction
    const stmt = db._raw.prepare(`INSERT INTO ${name} (id, data) VALUES (?, ?)`);
    const insertMany = db._raw.transaction((records) => {
      for (const r of records) {
        if (r.id === undefined || r.id === null) {
          throw new Error(`record without id فى ${name}: ${JSON.stringify(r).slice(0, 100)}`);
        }
        stmt.run(r.id, JSON.stringify(r));
      }
    });

    try {
      insertMany(items);
      log('ok', `${name}: ${items.length} record migrated`);
      stats.collections++;
      stats.records += items.length;
    } catch (e) {
      return exitWith(1, `فشل migration لـ ${name}: ${e.message}`);
    }
  }

  // 6. هاجر _nextId
  if (source._nextId && typeof source._nextId === 'object') {
    const setKv = db._raw.prepare('INSERT INTO kv (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value');
    for (const [coll, nextId] of Object.entries(source._nextId)) {
      setKv.run(`_nextId.${coll}`, JSON.stringify(nextId));
    }
    log('ok', `_nextId migrated (${Object.keys(source._nextId).length} entries)`);
  }

  // 7. هاجر _meta و أى kv keys ثانية
  if (source._meta && typeof source._meta === 'object') {
    const setKv = db._raw.prepare('INSERT INTO kv (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value');
    for (const [k, v] of Object.entries(source._meta)) {
      setKv.run(`_meta.${k}`, JSON.stringify(v));
    }
    log('ok', `_meta migrated (${Object.keys(source._meta).length} keys)`);
  }

  // 8. Verify
  console.log('\n─── Verification ───────────────────────────');
  let verifyOk = true;
  for (const name of COLLECTIONS) {
    const sourceCount = Array.isArray(source[name]) ? source[name].length : 0;
    const targetCount = db._raw.prepare(`SELECT COUNT(*) AS n FROM ${name}`).get().n;
    const match = sourceCount === targetCount;
    if (!match) verifyOk = false;
    log(match ? 'ok' : 'err', `${name}: source=${sourceCount}, target=${targetCount} ${match ? '' : '← MISMATCH!'}`);
  }

  // sample one record from each
  console.log('\n─── Sample records ─────────────────────────');
  for (const name of COLLECTIONS) {
    const row = db._raw.prepare(`SELECT data FROM ${name} ORDER BY id ASC LIMIT 1`).get();
    if (row) {
      const obj = JSON.parse(row.data);
      const preview = JSON.stringify(obj).slice(0, 80);
      console.log(`  ${name}[0]: ${preview}${preview.length === 80 ? '...' : ''}`);
    }
  }

  db._close();

  // 9. خلاصة
  console.log('\n═══════════════════════════════════════════════');
  if (verifyOk) {
    log('ok', `Migration ناجح: ${stats.collections} collection, ${stats.records} record`);
    log('info', `data.db size: ${(fs.statSync(TARGET).size / 1024).toFixed(1)} KB`);
  } else {
    log('err', 'Migration فيه mismatch — راجع الأرقام فوق');
    process.exit(1);
  }
  console.log('═══════════════════════════════════════════════');
}

main();
