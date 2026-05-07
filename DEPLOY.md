# دليل النشر على cPanel — Reports Dashboard

دليل عملى خطوة بخطوة لرفع المشروع على استضافة cPanel تدعم Node.js (Phusion Passenger).

---

## ⚡ ملخص سريع (30 ثانية)

| العنصر | الحالة |
|---|---|
| **Node.js** | نسخة 18 أو 20 (يدعمها أغلب hosts) |
| **قاعدة بيانات** | SQLite (better-sqlite3) — ملف `data/data.db` يتولّد لوحده |
| **Sessions** | SQLite ملف صغير يتولّد لوحده |
| **PDF Export (puppeteer)** | ❌ مش هيشتغل على shared hosting (سيبه optional) |
| **HTTPS** | فعّل Let's Encrypt من cPanel — مجانى |
| **Memory** | ≥ 256MB كافى لفريق صغير-متوسط |

---

## 📋 المتطلبات قبل البدء

1. **حساب cPanel** فيه:
   - **"Setup Node.js App"** أو **"Node.js Selector"** (موجودة فى أغلب الـ hosts: HostGator, Bluehost, Namecheap, GoDaddy, A2 Hosting...).
   - مساحة قرص ≥ 500MB.
   - Node.js نسخة 18 أو 20.
2. **Domain أو Subdomain** جاهز (مثلاً `reports.yourcompany.com`).
3. **Terminal Access** فى cPanel (مش إجبارى لكن بيسهّل).

---

## 🗄️ قبل ما نبدأ — افهم الـ "Database"

**مفيش MySQL ولا phpMyAdmin ولا أى database setup.** كل بياناتك فى ملف SQLite واحد:

```
data/data.db   ← كل الموظفين، التقارير، الفرق، القوالب (~250KB)
```

> 💡 **مهم:** المشروع كان بيستخدم `lowdb` (ملف JSON) فى الإصدارات السابقة. لو لسه عندك `data/db.json` على السيرفر، شوف قسم **"Migration من النسخة القديمة"** فى الأخر.

**عندك 3 سيناريوهات:**

### 🅰️ ابدأ نظيف (الأبسط)
متترفعش `data/` خالص. أول ما السيرفر يشتغل، هيتولّد ملف `data.db` جديد ببيانات افتراضية:
- Admin: `admin@reports.com` / `admin123`
- 13 موظف افتراضى: `[name]@reports.com` / `pass123`
- 13 فريق + 13 قالب جاهزين

**اختاره لو:** بدأت من الصفر ومش محتاج البيانات الحالية.

### 🅱️ ارفع بياناتك الحالية
ضمّن `data/data.db` فى الـ ZIP — هتلاقى كل موظفينك وتقاريرك زى ما هى محلياً.

**اختاره لو:** عندك بيانات حقيقية عايز تنقلها.

### 🅲️ ابدأ نظيف ثم استورد
ارفع بدون `data/`، اتأكد إن كل حاجة شغالة، ثم استبدل `data.db` يدوياً عبر File Manager.

**اختاره لو:** عايز تختبر على البرود الأول قبل ما تخسر بياناتك الأصلية.

---

## 🛠️ خطوات النشر

### 1) جهّز الملفات محلياً

من PowerShell على جهازك:

```powershell
cd c:/laragon/www/ME-dashboard

# (احتياطى) تأكد إن node_modules مش هيدخل فى الـ ZIP
# مش محتاج تحذفه فعلاً، بس هتستبعده وقت الضغط
```

#### ✅ ضمّن فى الـ ZIP:
| ملف/مجلد | الوصف |
|---|---|
| `app.js` | Entry point لـ Passenger |
| `server/` | كل كود السيرفر |
| `views/` | كل HTML pages |
| `public/` | CSS + JS + img + شعار |
| `package.json` | قائمة الـ dependencies |
| `package-lock.json` | لتثبيت نفس النسخ بالظبط |
| `.env.example` | قالب متغيرات البيئة (للمرجع فقط) |
| `data/data.db` | **فقط لو سيناريو B** — بياناتك |

#### ❌ استبعد من الـ ZIP:
| ملف/مجلد | السبب |
|---|---|
| `node_modules/` | هينزل على السيرفر بـ `npm install` (وزنه كبير) |
| `data/sessions.sqlite` | جلسات الدخول الحالية، يتولّد لوحده |
| `data/data.db` | **لو سيناريو A** — هيتولّد لوحده |
| `.env` | متغيرات سرّية، هتحطها على cPanel UI |
| `*.rar`, `*.zip` | ملفات الباك أب القدام |
| `doc/` | المستندات المرجعية، مش محتاجها على البرود |
| `.git/` | لو موجود |

#### الـ ZIP نفسه

استخدم الـ built-in Compression فى Windows أو 7-Zip:
- ابعت `Send to → Compressed (zipped) folder` على الملفات اللى ضمّنتها.
- اسم مقترح: `reports-dashboard-v1.zip`.

---

### 2) ارفع الـ ZIP على cPanel

1. سجّل دخول cPanel.
2. افتح **File Manager**.
3. روح للـ `home directory` (`/home/USERNAME/`):
   ```
   /home/USERNAME/reports-dashboard/
   ```
   ⚠️ **مش `public_html`** — Node.js apps بتتحط برّاه.
4. اعمل **+ Folder** → `reports-dashboard`.
5. ادخل المجلد، اضغط **Upload**، ارفع الـ ZIP.
6. كليك يمين على الـ ZIP → **Extract**.
7. احذف الـ ZIP بعد الفك.

---

### 3) أنشئ الـ Node.js App

1. ارجع cPanel home → افتح **Setup Node.js App**.
2. اضغط **Create Application**.
3. املأ الحقول:

| الحقل | القيمة |
|---|---|
| **Node.js version** | `18.x` أو `20.x` (الأحدث الموجود) |
| **Application mode** | `Production` |
| **Application root** | `reports-dashboard` |
| **Application URL** | الدومين/سب-دومين بتاعك |
| **Application startup file** | `app.js` |

4. اضغط **Create**.

---

### 4) ضيف متغيرات البيئة (Environment Variables)

من نفس صفحة الـ Node.js App، Scroll تحت لـ **"Environment Variables"** → **"Add Variable"**:

| Name | Value | الأهمية |
|---|---|---|
| `NODE_ENV` | `production` | يفعّل وضع الإنتاج |
| `SESSION_SECRET` | string عشوائى 32+ حرف | **حرج جداً** — للأمان |
| `COOKIE_SECURE` | `true` (لو HTTPS) أو `false` (لو HTTP فقط) | عشان الـ login يشتغل |

**لتوليد SESSION_SECRET قوى:**

```bash
# على Linux/Mac terminal:
openssl rand -hex 32

# أو على Node (أى مكان):
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# أو على Windows PowerShell:
-join ((1..64) | ForEach-Object { '{0:x}' -f (Get-Random -Max 16) })
```

⚠️ **متشاركش الـ SESSION_SECRET** أبداً — لو ضاع، الـ sessions كلها هتتكسر. ولو سرقه حد، يقدر يدخل النظام.

---

### 5) ثبّت الـ Dependencies

من نفس صفحة الـ Node.js App اضغط **"Run NPM Install"**.

**أو** افتح **Terminal** فى cPanel:
```bash
cd ~/reports-dashboard
source /home/USERNAME/nodevenv/reports-dashboard/18/bin/activate
npm install --production --omit=optional
```

`--omit=optional` بتمنع تنزيل **puppeteer** (~300MB) اللى مش هيشتغل على shared hosting أصلاً.

⏳ ممكن ياخد 1-3 دقائق على حسب سرعة السيرفر.

#### ⚠️ مهم لـ better-sqlite3 على CentOS 7 / CloudLinux 7

السيرفرات اللى بـ GLIBC قديم (2.17) محتاجة نسخة معينة من `better-sqlite3`. لو ظهر error زى:
```
GLIBC_2.29 not found
```
شغّل الأمر ده **بعد npm install**:
```bash
npm install better-sqlite3@7.6.2 --save-exact
```

النسخة 7.6.2 هى آخر نسخة بتدعم GLIBC القديم. الـ API نفسه متطابق فى الكود، فمش هيحتاج أى تعديل.

---

### 6) شغّل التطبيق

1. ارجع لصفحة **Setup Node.js App**.
2. اضغط **Restart** (أو **Start** لو لسه).
3. افتح الـ URL فى تاب جديد — لازم تشوف صفحة الـ login.

✅ **علامات النجاح:**
- صفحة login بتفتح بشعار "Marketing Experts".
- متفيش Internal Server Error 500.
- تقدر تسجّل دخول.

---

### 7) أول دخول + تأمين الحساب

أول مرة تفتح الموقع:

| الدور | Email | Password |
|---|---|---|
| Admin | `admin@reports.com` | `admin123` |
| Employees | `[name]@reports.com` | `pass123` |

**أول 5 حاجات تعملها فوراً:**

1. ✅ سجّل دخول كـ admin.
2. ✅ روح **الموظفون** → عدّل حسابك → **غيّر الباسوورد**.
3. ✅ احذف الموظفين الافتراضيين اللى مش هتستخدمهم.
4. ✅ ضيف موظفينك الحقيقيين (أو غيّر بيانات وكلمات السر القدام).
5. ✅ راجع **القوالب** → **الفرق** → عدّل حسب احتياجك.

---

## 🔐 SSL / HTTPS (مهم جداً)

### تفعيل Let's Encrypt مجاناً:

1. cPanel home → **SSL/TLS Status**.
2. اختار الدومين بتاعك.
3. اضغط **Run AutoSSL**.
4. انتظر دقيقة-دقيقتين.

بعد التفعيل:
- الموقع هيفتح بـ `https://`
- تأكد إن `COOKIE_SECURE=true` فى الـ env vars.
- اعمل **Restart** للـ Node app.

⚠️ **لو الموقع HTTP فقط** (مش مستحسن)، خلّى `COOKIE_SECURE=false` وإلا الـ login مش هيشتغل.

---

## 💾 النسخ الاحتياطى (Backup)

### إيه اللى يحتاج backup؟
- **`data/data.db`** ← كل بياناتك (موظفين، تقارير، فرق، قوالب).
- **`public/reports/submitted/`** ← ملفات HTML للتقارير المرفوعة.

### إيه اللى متحتاجش backup؟
- ❌ `data/sessions.sqlite` — جلسات دخول مؤقتة، تتولّد لوحدها.
- ❌ `node_modules/` — هتنزّل من `npm install`.

### Backup يدوى أسبوعى:

```bash
# من cPanel terminal:
cd ~/reports-dashboard
tar -czf ~/backup-$(date +%Y%m%d).tar.gz data/data.db public/reports/submitted/

# تنزيل الباك أب من File Manager → home → اسحب الملف لجهازك
```

### Backup أوتوماتيكى (Cron Job):

من cPanel → **Cron Jobs** → ضيف:

| Schedule | Command |
|---|---|
| `0 3 * * 0` (كل أحد 3 صباحاً) | `cd ~/reports-dashboard && tar -czf ~/backups/backup-$(date +\%Y\%m\%d).tar.gz data/data.db public/reports/submitted/` |

(اعمل مجلد `~/backups/` الأول)

### استرجاع backup:

```bash
cd ~/reports-dashboard
tar -xzf ~/backup-2026-05-06.tar.gz
# اعمل Restart للـ Node app من cPanel
```

---

## 🔄 إزاى أعمل Update لتحديث جديد؟

1. ارفع الملفات الجديدة (File Manager Upload أو git pull).
2. **متستبدلش** `data/data.db` ← ده بياناتك الحقيقية!
3. لو فى dependencies جديدة فى `package.json`:
   ```bash
   cd ~/reports-dashboard
   source /home/USERNAME/nodevenv/reports-dashboard/18/bin/activate
   npm install --production --omit=optional
   ```
4. اضغط **Restart** فى Node.js App.

---

## ❓ الأسئلة الشائعة

### "هل أحتاج MySQL أو phpMyAdmin؟"
**لا.** المشروع بيستخدم **SQLite** (better-sqlite3) اللى بيخزن البيانات فى ملف واحد (`data/data.db`). شغال على cPanel من غير أى إعداد database.

### "إزاى أنقل البيانات من جهازى للسيرفر؟"
ببساطة **ارفع `data/data.db`** عبر File Manager، أو ضمّنه فى الـ ZIP الأصلى. مفيش `mysqldump` ولا `import wizard`.

⚠️ **ملاحظة:** SQLite ملف binary، فلازم تنقله بـ **binary mode** (وضع UPLOAD العادى فى File Manager بيعمل ده تلقائياً). لو نقلته بـ FTP، تأكد إن الوضع `binary` مش `ascii`.

### "هل هينفع PDF Export؟"
**على shared hosting: لا.** Puppeteer محتاج Chromium browser ومكتبات نظام (libnss3, libxss...) مش متاحة على shared hosting. الـ endpoint موجود لكن هيرجع 503.

**حلول بديلة:**
- استخدم **Print → Save as PDF** من المتصفح.
- لو محتاج automation، استخدم خدمة SaaS زى [PDFShift](https://pdfshift.io) أو [APITemplate.io] — تحتاج تعديل الـ endpoint.
- لو عندك VPS بدل shared hosting، puppeteer هيشتغل عادى.

### "هل فى حد أقصى لعدد الموظفين/التقارير؟"
SQLite مناسب لـ:
- ✅ ≤ 10,000 موظف (حتى أكتر)
- ✅ ≤ 100,000 تقرير
- ✅ Concurrent reads بدون مشاكل، Concurrent writes آمنة (single-writer)

عملياً، المشروع ده هيشتغل على SQLite لسنين من غير مشكلة. لو وصلت لمرحلة multi-server أو SaaS متعدد الشركات، وقتها تفكر فى Postgres/MySQL — لكن ده بعيد جداً للمشروع الحالى.

### "السيرفر بيقع كل فترة؟"
- لو الذاكرة قليلة، cPanel بيوقف الـ process. زود **Memory Limit** من إعدادات الـ Node.js App.
- شغّل **Restart** لو حصل.
- راجع **stderr.log** عشان تشوف السبب.

### "Sessions بتمسح كل ما أعمل Restart؟"
**لا** لأن المشروع بيستخدم **SQLite session store** — الـ sessions بتفضل محفوظة فى `data/sessions.sqlite`. الموظفين هيفضلوا مسجّلين دخول حتى بعد restart السيرفر.

### "نسيت الـ admin password؟"
SQLite ملف binary مش JSON، فمش هتقدر تعدله بـ File Manager مباشرة. الحل عبر Terminal:

```bash
cd ~/reports-dashboard
source /home/USERNAME/nodevenv/reports-dashboard/18/bin/activate
node -e "
const { createDB } = require('./server/db');
const bcrypt = require('bcryptjs');
const db = createDB('./data/data.db');
db.get('users').find({ role: 'admin' }).assign({
  password: bcrypt.hashSync('admin123', 10)
}).write();
console.log('Admin password reset to: admin123');
db._close();
"
```

ثم اعمل **Restart** للـ Node app، وادخل بـ `admin@reports.com / admin123` وغيّرها فوراً.

### "أنا فى cPanel hosting لكن مفيش 'Setup Node.js App'؟"
- اطلب الدعم الفنى يفعّل لك **CloudLinux Node.js Selector**.
- لو مش متاح، الـ host بتاعك مش بيدعم Node.js — هتحتاج تنقل لـ host تانى أو VPS.

---

## 🚨 تحذيرات أمنية

1. ✅ **متشاركش الـ SESSION_SECRET** أبداً.
2. ✅ غيّر كلمات السرّ الافتراضية فوراً.
3. ✅ فعّل HTTPS (Let's Encrypt).
4. ✅ خلّى الـ Application Root **خارج** `public_html`.
5. ✅ اعمل backup أسبوعى لـ `data/data.db`.
6. ✅ خلّى `NODE_ENV=production`.
7. ❌ متفتحش `data/data.db` للعامة — ده فيه password hashes.

---

## 📞 لو حصلت مشكلة

تحقق من **Application Logs** فى cPanel:
- Setup Node.js App → اضغط على الأبليكيشن.
- شوف **stderr.log** و **stdout.log**.

### أكتر مشاكل شائعة:

| المشكلة | الحل |
|---|---|
| **"Cannot find module 'X'"** | شغّل `npm install --production` تانى |
| **"Permission denied" عند كتابة `db.json`** | تأكد إن `data/` permissions = `755` (chmod -R 755 data/) |
| **502 Bad Gateway** | التطبيق ما اشتغلش — تفقد stderr.log |
| **يفتح login بس مش بيدخل** | تفقد `COOKIE_SECURE` (true لـ HTTPS، false لـ HTTP) |
| **"Cannot find module 'puppeteer'"** | عادى — هو optional. لو ظهر فى الـ logs ده مش error blocker |
| **الموقع بطئ جداً** | زود memory limit من Node.js App settings → اعمل Restart |
| **الـ logo مش ظاهر** | تأكد إن `public/img/logo.jpg` مرفوع |
| **بيانات الموظفين ضاعت** | استرجع آخر backup من `~/backups/` |

### Logs مفيدة:

```bash
# آخر 50 سطر من الأخطاء
tail -50 ~/reports-dashboard/stderr.log

# Live monitoring
tail -f ~/reports-dashboard/stderr.log
```

---

## 📁 هيكل المشروع على السيرفر

بعد ما تنشر بنجاح، هيكون عندك:

```
/home/USERNAME/reports-dashboard/
├── app.js                  ← Entry point
├── package.json
├── package-lock.json
├── server/
│   └── index.js            ← Server logic
├── views/                  ← HTML pages
├── public/
│   ├── css/
│   ├── js/
│   ├── img/logo.jpg        ← الشعار
│   └── reports/submitted/  ← التقارير المرفوعة (يتولّد لوحده)
├── scripts/
│   └── migrate-from-lowdb.js ← Migration tool (lowdb → SQLite)
├── data/
│   ├── data.db             ← قاعدة البيانات SQLite (يتولّد لوحده)
│   ├── data.db-wal         ← WAL log (مؤقت)
│   ├── data.db-shm         ← Shared memory (مؤقت)
│   └── sessions.sqlite     ← الجلسات (يتولّد لوحده)
├── node_modules/           ← (يتولّد بـ npm install)
├── stderr.log              ← Errors
├── stdout.log              ← Console output
└── .env                    ← Environment vars (cPanel UI managed)
```

---

## 🔄 Migration من النسخة القديمة (lowdb → SQLite)

لو السيرفر بتاعك شغّال بنسخة قديمة فيها `data/db.json` (lowdb)، الترقية بسيطة:

### 1) ارفع الكود الجديد عبر git pull أو File Manager

### 2) ثبّت الـ dependencies الجديدة
```bash
cd ~/reports-dashboard
source /home/USERNAME/nodevenv/reports-dashboard/18/bin/activate
npm install --production --omit=optional

# لو على CentOS 7 / GLIBC قديم:
npm install better-sqlite3@7.6.2 --save-exact
```

### 3) شغّل migration script
```bash
node scripts/migrate-from-lowdb.js
```

هيقرأ `data/db.json` ويولّد `data/data.db` نظيف. السكريبت بيعمل verify تلقائى للتأكد إن كل البيانات اتنقلت صح.

النتيجة المتوقعة:
```
✅ users: 43 record migrated
✅ reports: 22 record migrated
✅ templates: 15 record migrated
✅ teams: 8 record migrated
✅ notifications: 23 record migrated
─── Verification ───
✅ users: source=43, target=43
...
✅ Migration ناجح
```

### 4) اعمل Restart للـ Node app

### 5) ⚠️ **متحذفش `data/db.json`** فوراً
خلّيه كـ backup لمدة أسبوع على الأقل. لو حصلت أى مشكلة، تقدر تشغّل migration تانى.

### 6) لو كل حاجة شغالة بعد أسبوع
احذف `data/db.json` (أو احتفظ بيه مضغوط):
```bash
gzip data/db.json   # يبقى data/db.json.gz كنسخة احتياطية مضغوطة
```

---

## ✅ Checklist نهائى قبل الـ Production

- [ ] `package.json` فيه `engines: node >=18`
- [ ] `app.js` موجود فى الـ root
- [ ] `node_modules/` مستبعد من الـ ZIP
- [ ] `SESSION_SECRET` مولّد random + محطوط فى env vars
- [ ] `NODE_ENV=production`
- [ ] HTTPS مفعّل (Let's Encrypt)
- [ ] `COOKIE_SECURE=true` (لو HTTPS)
- [ ] غيّرت كلمة سر الـ admin
- [ ] حذفت/عدّلت الموظفين الافتراضيين
- [ ] اختبرت login من admin + employee
- [ ] اختبرت رفع تقرير
- [ ] إعداد cron job للـ backup الأسبوعى
- [ ] حفظت أول backup للـ `data/data.db` على جهازك

---

**ربنا يوفّقك! 🚀**
