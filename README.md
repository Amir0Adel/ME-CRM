# 📋 ME-CRM — لوحة تحكم التقارير الأسبوعية

نظام إدارة وتسليم تقارير أسبوعية للفِرق، مبنى على Node.js + Express + SQLite.

---

## 🚀 تشغيل سريع محلياً

```bash
git clone https://github.com/Amir0Adel/ME-CRM.git
cd ME-CRM
npm install
cp .env.example .env       # عدّل القيم بعد الـ copy
npm start
```

افتح المتصفح على: **http://localhost:3000**

> أول دخول، الحساب الافتراضى للـ admin محدد فى `server/index.js` — **غيّره فوراً بعد أول تسجيل دخول.**

---

## ⚙️ المتطلبات

- **Node.js** 18 أو 20
- **npm** 9+
- نظام تشغيل: Windows / Linux / macOS

---

## 📁 هيكل المشروع

```
ME-CRM/
├── app.js                 # Entry point (Passenger / cPanel)
├── server/
│   └── index.js           # Express server + كل الـ routes
├── views/                 # صفحات HTML (admin / employee / login)
├── public/
│   ├── css/               # Stylesheets
│   ├── js/                # Client-side JS
│   └── reports/           # قوالب التقارير + المرفوع (submitted/)
├── data/                  # SQLite databases (gitignored)
├── scripts/                # Migration & test scripts
├── doc/                   # نسخ مرجعية من التقارير
├── .env.example           # نموذج متغيرات البيئة
└── DEPLOY.md              # دليل الرفع على cPanel
```

---

## 🔐 متغيرات البيئة

انسخ `.env.example` لـ `.env` وعبّى القيم:

| المتغير | الوصف | القيمة الافتراضية |
|---|---|---|
| `NODE_ENV` | بيئة التشغيل | `development` محلياً، `production` على السيرفر |
| `PORT` | بورت الـ HTTP | `3000` |
| `SESSION_SECRET` | مفتاح تشفير الـ sessions — **لازم يتغير** | — |
| `COOKIE_SECURE` | كوكيز HTTPS-only | `true` على production |

**لتوليد `SESSION_SECRET` قوى:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## ✨ المميزات

### المدير (Admin)
- إدارة الموظفين والفِرق (إضافة / تعديل / حذف)
- استعراض كل التقارير المستلمة + تصفيتها
- نسخ روابط دخول مباشرة لكل موظف
- تعديل قوالب التقارير من المتصفح
- إحصائيات + إشعارات تقارير جديدة

### الموظف
- فتح قالب التقرير الخاص بفريقه
- رفع HTML أو لصقه مباشرة
- استعراض تاريخ تقاريره السابقة

---

## 🛠️ Scripts

```bash
npm start              # تشغيل الإنتاج
npm run dev            # تشغيل مع nodemon (auto-reload)
npm run migrate        # تحويل db.json (lowdb) إلى data.db (SQLite)
npm run test:adapter   # اختبار شامل للـ DB adapter
```

---

## 📦 الـ Dependencies الرئيسية

- **express** — web framework
- **express-session** + **connect-sqlite3** — جلسات مخزنة فى SQLite
- **better-sqlite3** — قاعدة بيانات SQLite (synchronous, fast)
- **bcryptjs** — تشفير كلمات السر
- **multer** — رفع الملفات
- **puppeteer** *(optional)* — تصدير PDF (مش بيشتغل على shared hosting)

---

## 🌐 النشر (Deployment)

دليل الرفع الكامل على cPanel موجود فى **[DEPLOY.md](DEPLOY.md)**.

البدائل السريعة:
- **Render.com** — Build: `npm install` / Start: `npm start`
- **Railway.app** — auto-detect

---

## 💾 النسخ الاحتياطى

كل البيانات فى:
- `data/data.db` — الموظفين، التقارير، القوالب، الفرق (SQLite)
- `public/reports/submitted/` — ملفات التقارير المرفوعة

اعمل backup أسبوعى عبر cron أو يدوياً. شوف [DEPLOY.md](DEPLOY.md) لتفاصيل الـ backup script.

---

## 🔒 الأمان

- متشاركش `.env` أو `SESSION_SECRET` فى أى مكان عام.
- غيّر الحسابات الافتراضية بعد أول تسجيل دخول.
- فعّل HTTPS على الإنتاج.
- البيانات الحساسة (`db.json`, `sessions.sqlite`, `submitted/`) مستثناة من git.

---

## 📝 License

Private — جميع الحقوق محفوظة.
