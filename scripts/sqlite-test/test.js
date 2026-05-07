// اختبار بسيط: هل better-sqlite3 شغّال على السيرفر؟
const Database = require('better-sqlite3');
const path = require('path');

console.log('========================================');
console.log('🔍 اختبار better-sqlite3 على cPanel');
console.log('========================================\n');

try {
  // 1) فتح/إنشاء قاعدة بيانات تجريبية
  const dbPath = path.join(__dirname, 'test.db');
  const db = new Database(dbPath);
  console.log('✅ خطوة 1: فتح قاعدة البيانات');

  // 2) إنشاء جدول
  db.exec(`
    CREATE TABLE IF NOT EXISTS test_users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);
  console.log('✅ خطوة 2: إنشاء جدول');

  // 3) إدخال بيانات
  const insert = db.prepare('INSERT OR IGNORE INTO test_users (name, email) VALUES (?, ?)');
  insert.run('أحمد', 'ahmed@test.com');
  insert.run('فاطمة', 'fatima@test.com');
  insert.run('محمد', 'mohamed@test.com');
  console.log('✅ خطوة 3: إدخال بيانات');

  // 4) قراءة بيانات
  const users = db.prepare('SELECT * FROM test_users').all();
  console.log('✅ خطوة 4: قراءة بيانات (' + users.length + ' مستخدم)');

  // 5) اختبار الأداء
  const start = Date.now();
  for (let i = 0; i < 1000; i++) {
    db.prepare('SELECT * FROM test_users WHERE id = ?').get(1);
  }
  const elapsed = Date.now() - start;
  console.log('✅ خطوة 5: 1000 query في ' + elapsed + 'ms');

  db.close();

  console.log('\n========================================');
  console.log('🎉 النتيجة: كل شيء شغّال 100%');
  console.log('========================================');
  console.log('Node version       :', process.version);
  console.log('better-sqlite3 ver :', require('better-sqlite3/package.json').version);
  console.log('Platform           :', process.platform, process.arch);
  console.log('========================================');
  console.log('\n👉 الخلاصة: تقدر تستخدم better-sqlite3 للمشروع بأمان.');
} catch (err) {
  console.error('\n========================================');
  console.error('❌ النتيجة: حصل خطأ');
  console.error('========================================');
  console.error('الخطأ:', err.message);
  console.error('\nبَعت رسالة الخطأ دى كاملة عشان نعرف نحلها.');
  console.error('========================================');
  process.exit(1);
}
