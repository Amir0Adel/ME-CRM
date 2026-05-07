#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
//  Adapter Test Suite
//
//  بيتأكد إن كل أنماط lowdb v1 المستخدمة فى server/index.js
//  بتشتغل صح على الـ SQLite adapter.
//
//  بيشتغل على نسخة test مؤقتة (data/test.db) — لا تؤثر على البيانات الحقيقية.
// ─────────────────────────────────────────────────────────────────────────────

const path = require('path');
const fs = require('fs');
const { createDB } = require('../server/db');

const TEST_DB = path.join(__dirname, '..', 'data', 'test.db');

// نظف أى نسخة قديمة
if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);
const walFile = TEST_DB + '-wal';
const shmFile = TEST_DB + '-shm';
if (fs.existsSync(walFile)) fs.unlinkSync(walFile);
if (fs.existsSync(shmFile)) fs.unlinkSync(shmFile);

const db = createDB(TEST_DB);

// ── Test runner ──────────────────────────────────────────────────────────────
let passed = 0, failed = 0;
const failures = [];

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ✅ ${name}`);
  } catch (e) {
    failed++;
    failures.push({ name, error: e.message });
    console.log(`  ❌ ${name} — ${e.message}`);
  }
}

function eq(actual, expected, msg) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${msg || 'eq'}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function truthy(v, msg) {
  if (!v) throw new Error(msg || 'expected truthy');
}

// ─────────────────────────────────────────────────────────────────────────────
console.log('\n═══ Adapter Test Suite ═══\n');

// ── 1. defaults ──────────────────────────────────────────────────────────────
console.log('▸ defaults:');

test('defaults() initializes empty collections + _nextId', () => {
  db.defaults({
    users: [], reports: [], notifications: [], templates: [], teams: [],
    _nextId: { users: 1, reports: 1, notifications: 1, templates: 1, teams: 1 }
  }).write();

  eq(db.get('users').value(), []);
  eq(db.get('_nextId.users').value(), 1);
});

test('has() returns true for existing collection', () => {
  truthy(db.get('teams').value() !== undefined);
});

// ── 2. push + find ───────────────────────────────────────────────────────────
console.log('\n▸ push + find:');

test('push() adds record', () => {
  db.get('users').push({ id: 1, name: 'أحمد', email: 'a@a.com', role: 'admin' }).write();
  const user = db.get('users').find({ id: 1 }).value();
  truthy(user, 'should find pushed user');
  eq(user.name, 'أحمد');
});

test('push() multiple records', () => {
  db.get('users').push({ id: 2, name: 'فاطمة', email: 'f@f.com', role: 'employee' }).write();
  db.get('users').push({ id: 3, name: 'محمد', email: 'm@m.com', role: 'employee' }).write();
  const all = db.get('users').value();
  eq(all.length, 3);
});

test('find() with object predicate', () => {
  const u = db.get('users').find({ email: 'f@f.com' }).value();
  eq(u.name, 'فاطمة');
});

test('find() with function predicate', () => {
  const u = db.get('users').find(u => u.email === 'm@m.com').value();
  eq(u.name, 'محمد');
});

test('find() returns undefined when not found', () => {
  const u = db.get('users').find({ email: 'noone@nowhere.com' }).value();
  eq(u, undefined);
});

// ── 3. filter + map + size ───────────────────────────────────────────────────
console.log('\n▸ filter + map + size:');

test('filter() returns matching records', () => {
  const employees = db.get('users').filter({ role: 'employee' }).value();
  eq(employees.length, 2);
});

test('filter() chain to .size()', () => {
  const n = db.get('users').filter({ role: 'employee' }).size().value();
  eq(n, 2);
});

test('filter() chain to .map()', () => {
  const names = db.get('users').filter({ role: 'employee' }).map(u => u.name).value();
  eq(names.sort(), ['فاطمة', 'محمد']);
});

test('size() on full collection', () => {
  eq(db.get('users').size().value(), 3);
});

// ── 4. assign (update) ───────────────────────────────────────────────────────
console.log('\n▸ assign (update):');

test('find().assign() updates record', () => {
  db.get('users').find({ id: 2 }).assign({ name: 'فاطمة المعدلة' }).write();
  const u = db.get('users').find({ id: 2 }).value();
  eq(u.name, 'فاطمة المعدلة');
  eq(u.email, 'f@f.com', 'other fields unchanged');
});

test('assign() merges new fields', () => {
  db.get('users').find({ id: 2 }).assign({ team_id: 5, can_edit_template: true }).write();
  const u = db.get('users').find({ id: 2 }).value();
  eq(u.team_id, 5);
  eq(u.can_edit_template, true);
  eq(u.name, 'فاطمة المعدلة', 'previous updates preserved');
});

test('assign() on non-existent record is no-op', () => {
  db.get('users').find({ id: 999 }).assign({ name: 'should not exist' }).write();
  const u = db.get('users').find({ id: 999 }).value();
  eq(u, undefined);
});

// ── 5. remove ────────────────────────────────────────────────────────────────
console.log('\n▸ remove:');

test('remove() deletes matching record', () => {
  db.get('users').push({ id: 99, name: 'ToDelete', email: 'x@x.com', role: 'employee' }).write();
  eq(db.get('users').size().value(), 4);
  db.get('users').remove({ id: 99 }).write();
  eq(db.get('users').size().value(), 3);
  eq(db.get('users').find({ id: 99 }).value(), undefined);
});

test('remove() with multi-key predicate', () => {
  db.get('users').push({ id: 100, name: 'temp', email: 't@t.com', role: 'employee' }).write();
  db.get('users').remove({ id: 100, role: 'employee' }).write();
  eq(db.get('users').find({ id: 100 }).value(), undefined);
});

// ── 6. each (iteration with mutation) ────────────────────────────────────────
console.log('\n▸ each (mutation):');

test('each() applies function to all records', () => {
  db.get('users').each(u => {
    if (!u.created_at) u.created_at = '2026-01-01T00:00:00Z';
  }).write();

  const all = db.get('users').value();
  truthy(all.every(u => u.created_at), 'all users should have created_at');
});

test('filter().each() applies only to matching', () => {
  db.get('users').filter({ role: 'employee' }).each(u => { u.template_id = null; }).write();
  const employees = db.get('users').filter({ role: 'employee' }).value();
  truthy(employees.every(u => u.template_id === null), 'all employees should have null template_id');

  const admin = db.get('users').find({ role: 'admin' }).value();
  truthy(admin.template_id === undefined, 'admin should not have template_id');
});

// ── 7. _nextId pattern (simulating nextId helper) ────────────────────────────
console.log('\n▸ _nextId pattern:');

test('_nextId.users initial value', () => {
  eq(db.get('_nextId.users').value(), 1);
});

test('Set + increment _nextId.users', () => {
  const cur = db.get('_nextId.users').value();
  db.set('_nextId.users', cur + 1).write();
  eq(db.get('_nextId.users').value(), 2);
});

test('Multiple sequential nextId', () => {
  // simulate nextId() helper from server/index.js
  function nextId(table) {
    const id = db.get(`_nextId.${table}`).value();
    db.set(`_nextId.${table}`, id + 1).write();
    return id;
  }
  const a = nextId('reports');
  const b = nextId('reports');
  const c = nextId('reports');
  eq(a, 1);
  eq(b, 2);
  eq(c, 3);
});

// ── 8. _meta pattern ─────────────────────────────────────────────────────────
console.log('\n▸ _meta pattern:');

test('Set _meta.templates_version', () => {
  db.set('_meta.templates_version', 'v3-2026-05-02-fix1').write();
  eq(db.get('_meta.templates_version').value(), 'v3-2026-05-02-fix1');
});

test('Get _meta.templates_version returns undefined when not set', () => {
  eq(db.get('_meta.nonexistent').value(), undefined);
});

// ── 9. Set entire collection ─────────────────────────────────────────────────
console.log('\n▸ Set entire collection:');

test('set("templates", []) clears collection', () => {
  db.get('templates').push({ id: 1, name: 'Test Template' }).write();
  db.get('templates').push({ id: 2, name: 'Test Template 2' }).write();
  eq(db.get('templates').size().value(), 2);

  db.set('templates', []).write();
  eq(db.get('templates').size().value(), 0);
});

test('set("templates", [...]) replaces all', () => {
  db.set('templates', [
    { id: 1, name: 'Replaced 1' },
    { id: 2, name: 'Replaced 2' }
  ]).write();
  eq(db.get('templates').size().value(), 2);
  eq(db.get('templates').find({ id: 1 }).value().name, 'Replaced 1');
});

// ── 10. Complex chain (mimics real usage) ────────────────────────────────────
console.log('\n▸ Complex chains (mimics real server/index.js):');

test('db.get("reports").filter(predicate).value().sort(...)', () => {
  // mimic: app.get('/api/admin/reports') pattern
  db.get('reports').push({ id: 1, user_id: 1, status: 'submitted', submitted_at: '2026-05-01T10:00:00Z' }).write();
  db.get('reports').push({ id: 2, user_id: 2, status: 'submitted', submitted_at: '2026-05-03T10:00:00Z' }).write();
  db.get('reports').push({ id: 3, user_id: 1, status: 'draft', submitted_at: '2026-05-02T10:00:00Z' }).write();

  const submitted = db.get('reports').filter({ status: 'submitted' }).value()
    .sort((a, b) => b.submitted_at.localeCompare(a.submitted_at));

  eq(submitted.length, 2);
  eq(submitted[0].id, 2, 'newest first');
  eq(submitted[1].id, 1);
});

test('Nested mutation: assign array property', () => {
  // mimic: comment append pattern
  const reportId = 1;
  const report = db.get('reports').find({ id: reportId }).value();
  const comments = report.comments || [];
  comments.push({ id: 100, text: 'Test comment', by: 'admin' });
  db.get('reports').find({ id: reportId }).assign({ comments }).write();

  const updated = db.get('reports').find({ id: reportId }).value();
  eq(updated.comments.length, 1);
  eq(updated.comments[0].text, 'Test comment');
});

test('filter with array predicate (function)', () => {
  // mimic: oneWeekAgo filter
  const cutoff = '2026-05-02T00:00:00Z';
  const recent = db.get('reports').filter(r => r.submitted_at > cutoff).value();
  eq(recent.length, 2);
});

// ── 11. Persistence (close + reopen) ─────────────────────────────────────────
console.log('\n▸ Persistence:');

test('Data persists across re-open', () => {
  db._close();

  const db2 = createDB(TEST_DB);
  const users = db2.get('users').value();
  truthy(users.length >= 3, 'users should persist');
  eq(db2.get('_nextId.reports').value(), 4, '_nextId should persist');
  eq(db2.get('_meta.templates_version').value(), 'v3-2026-05-02-fix1');
  db2._close();
});

// ─────────────────────────────────────────────────────────────────────────────
//  Cleanup + Summary
// ─────────────────────────────────────────────────────────────────────────────
if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);
const w = TEST_DB + '-wal'; if (fs.existsSync(w)) fs.unlinkSync(w);
const s = TEST_DB + '-shm'; if (fs.existsSync(s)) fs.unlinkSync(s);

console.log('\n═══════════════════════════════════════════════');
console.log(`  Results: ✅ ${passed} passed, ❌ ${failed} failed`);
console.log('═══════════════════════════════════════════════\n');

if (failed > 0) {
  console.log('❌ Failures:');
  failures.forEach(f => console.log(`  • ${f.name}\n    ${f.error}`));
  process.exit(1);
}

process.exit(0);
