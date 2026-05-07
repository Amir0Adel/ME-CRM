# 🧪 اختبار better-sqlite3 على cPanel — خطوات بسيطة

> **الهدف:** نتأكد قبل أى refactor إن better-sqlite3 شغّال على السيرفر بتاعك. الاختبار بياخد 10-15 دقيقة.

---

## 📦 المحتويات

المجلد ده فيه ملفين بس:
- `test.js` — كود الاختبار
- `package.json` — تعريف الـ dependency

---

## 🚀 الخطوات (بالترتيب)

### الخطوة 1️⃣: ضغط المجلد ZIP

على جهازك:

1. روح للمسار: `c:\laragon\www\ME-dashboard\scripts\`
2. كليك يمين على مجلد `sqlite-test`
3. اختار **"Send to" → "Compressed (zipped) folder"**
4. هيتعمل ملف اسمه `sqlite-test.zip`

---

### الخطوة 2️⃣: ارفع الـ ZIP على cPanel

1. سجّل دخول على cPanel
2. افتح **File Manager**
3. روح لمجلد الـ home (المجلد الرئيسى) — مش `public_html`
4. اضغط **Upload** أعلى الصفحة
5. اختار `sqlite-test.zip` من جهازك
6. لما يخلص upload، ارجع للـ File Manager
7. كليك يمين على `sqlite-test.zip` → **Extract**
8. هيظهر مجلد جديد اسمه `sqlite-test`

---

### الخطوة 3️⃣: أنشئ Node.js App للاختبار

1. ارجع لصفحة cPanel الرئيسية
2. ابحث عن **"Setup Node.js App"** واضغط عليها
3. اضغط زرار **"Create Application"**
4. املأ الحقول كده:

| الحقل | القيمة |
|---|---|
| **Node.js version** | `18.20.8` (نفس اللى عندك) |
| **Application mode** | `Production` |
| **Application root** | `sqlite-test` |
| **Application URL** | سيبه افتراضى أو اختار أى subdomain |
| **Application startup file** | `test.js` |

5. اضغط **Create**

---

### الخطوة 4️⃣: ثبّت الـ dependency

فى نفس الصفحة (Setup Node.js App):

1. هتلاقى تطبيقك الجديد فى القائمة
2. اضغط على **أيقونة القلم (Edit)** أو افتح التطبيق
3. هتلاقى زرار **"Run NPM Install"** — اضغطه
4. استنى دقيقة-دقيقتين لحد ما يخلص

**علامة النجاح:** هتشوف رسالة فى الأخر زى:
```
added 1 package, audited X packages in Ys
```

**لو فيه error:** انسخ الرسالة كاملة وابعتهالى.

---

### الخطوة 5️⃣: شغّل الاختبار

عندك **طريقتين** — اختار اللى أسهل ليك:

#### الطريقة A: عبر Terminal (أسرع)

1. افتح **Terminal** فى cPanel
2. اكتب الأوامر دى واحدة واحدة:

```bash
cd ~/sqlite-test
node test.js
```

#### الطريقة B: عبر المتصفح

1. ارجع لصفحة Setup Node.js App
2. اضغط **Restart** على التطبيق
3. شوف الـ logs (stderr.log أو stdout.log) من File Manager فى مجلد `~/logs/` أو `~/sqlite-test/`

---

### الخطوة 6️⃣: شوف النتيجة

#### ✅ لو شفت النتيجة دى = نجح:

```
========================================
🔍 اختبار better-sqlite3 على cPanel
========================================

✅ خطوة 1: فتح قاعدة البيانات
✅ خطوة 2: إنشاء جدول
✅ خطوة 3: إدخال بيانات
✅ خطوة 4: قراءة بيانات (3 مستخدم)
✅ خطوة 5: 1000 query في XXms

========================================
🎉 النتيجة: كل شيء شغّال 100%
========================================
Node version       : v18.20.8
better-sqlite3 ver : 11.5.0
Platform           : linux x64
========================================

👉 الخلاصة: تقدر تستخدم better-sqlite3 للمشروع بأمان.
```

**يعنى إيه؟** ✅ كل حاجة تمام، نقدر نبدأ الـ migration.

---

#### ❌ لو شفت Error = ابعتلى الرسالة

انسخ الـ error كاملة وابعتها لى. أمثلة شائعة:

- `gyp ERR!` → الـ compile فشل
- `Cannot find module 'bindings'` → الـ install ناقص
- `Permission denied` → قيود من الـ host

**كل خطأ ليه حل.** متقلقش.

---

## 🧹 بعد الاختبار

لما تخلص:
1. ارجع لـ Setup Node.js App
2. احذف تطبيق `sqlite-test` (مش محتاجينه بعد كده)
3. احذف مجلد `sqlite-test` من File Manager

---

## 📞 لو حصلت مشكلة فى أى خطوة

ابعتلى:
1. رقم الخطوة اللى وقفت عندها
2. الرسالة أو الـ error بالظبط (screenshot أحسن)
3. هقولك تعمل إيه بالظبط
