# دليل النشر على cPanel — Reports Dashboard

دليل عملي لرفع المشروع على استضافة cPanel تدعم Node.js (Phusion Passenger).

---

## ⚡ ملخص سريع

- **Node.js**: نسخة 18 أو 20 (يدعمها أغلب hosts).
- **قاعدة البيانات**: lowdb (ملف JSON) — **مش محتاج MySQL/MariaDB**. الملف بيتولّد تلقائياً.
- **Sessions**: SQLite ملف صغير — مش محتاج إعداد DB.
- **Puppeteer (PDF export)**: ❌ **مش هيشتغل على shared hosting** — سيبه optional أو احذفه.
- **HTTPS**: cPanel بيوفّر SSL مجاني (Let's Encrypt) — فعّله من Control Panel.

---

## 📋 المتطلبات قبل الرفع

1. حساب cPanel فيه:
   - **"Setup Node.js App"** أو **"Node.js Selector"** (موجودة فى أغلب الـ hosts المصرية: HostGator, Bluehost, Namecheap, GoDaddy).
   - مساحة قرص ≥ 500MB.
   - Node.js 18 أو 20.
2. Domain أو Subdomain جاهز (مثلاً `reports.yourcompany.com`).
3. Terminal Access (إن أمكن) — مش إجباري بس بيسهّل.

---

## 🛠️ الخطوات

### 1) جهّز الملفات محلياً

```bash
# تأكد من أحدث نسخة
cd c:/laragon/www/ME-dashboard

# احذف node_modules قبل الضغط (هتنزل تانى على السيرفر)
rm -rf node_modules

# اضغط المشروع (zip أحسن من rar للسيرفر)
# على Windows استخدم 7-zip أو الـ built-in
```

**لازم تتأكد إن الملفات دى موجودة فى الـ ZIP:**
- `app.js` (entry point)
- `server/index.js`
- `package.json`
- `package-lock.json`
- `views/`
- `public/`
- `data/db.json` (لو عايز تنقل البيانات الحالية) — أو سيبه يتولّد تلقائياً
- `.env.example` (للمرجع)

**استبعد:**
- `node_modules/`
- `.env` (لو موجود محلياً)
- `*.rar`, `*.zip` القدام
- `doc/` (اختياري)

---

### 2) ارفع الـ ZIP على cPanel

1. ادخل **File Manager** فى cPanel.
2. روح للمجلد المناسب — عادةً يكون فى مكان زى:
   ```
   /home/USERNAME/reports-dashboard/
   ```
   **(مش `public_html` لأن Node.js apps مش بتتحط هناك)**
3. اعمل Upload للـ ZIP.
4. كليك يمين على الـ ZIP → **Extract**.

---

### 3) أنشئ الـ Node.js App

1. ادخل **Setup Node.js App** من cPanel home.
2. اضغط **Create Application**.
3. املأ الحقول:

| الحقل | القيمة |
|---|---|
| **Node.js version** | `18.x` أو `20.x` |
| **Application mode** | `Production` |
| **Application root** | `reports-dashboard` (المسار اللى عملت extract فيه) |
| **Application URL** | الدومين أو السب-دومين |
| **Application startup file** | `app.js` |

4. اضغط **Create**.

---

### 4) ضيف متغيرات البيئة (Environment Variables)

فى نفس صفحة الـ Node.js App، اضغط **"Add Variable"** وضيف:

| Name | Value |
|---|---|
| `NODE_ENV` | `production` |
| `SESSION_SECRET` | string عشوائى طويل (32+ حرف) |
| `COOKIE_SECURE` | `true` |

**لتوليد SESSION_SECRET قوى:**
```bash
# على أى Linux/Mac terminal:
openssl rand -hex 32
# أو على Node:
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

### 5) ثبّت الـ Dependencies

من نفس صفحة الـ Node.js App اضغط **"Run NPM Install"**.

**أو** افتح **Terminal** فى cPanel وروح للمجلد:
```bash
cd ~/reports-dashboard
source /home/USERNAME/nodevenv/reports-dashboard/18/bin/activate
npm install --production --omit=optional
```

`--omit=optional` بتمنع تنزيل **puppeteer** اللى وزنه ~300MB ومش هيشتغل على الـ shared hosting أصلاً.

---

### 6) شغّل التطبيق

1. ارجع لصفحة **Setup Node.js App**.
2. اضغط **Restart** (أو **Start** لو لسه ما اشتغلش).
3. افتح الـ URL — لازم تشوف صفحة الـ login.

---

### 7) أول دخول + تأمين الحساب

أول مرة تفتح الموقع، الحسابات الافتراضية:
- **Admin**: `admin@reports.com` / `admin123`
- **Employees**: `[name]@reports.com` / `pass123`

**أول حاجة تعملها:**
1. سجّل دخول كـ admin.
2. غيّر كلمة المرور من **الموظفون → تعديل** على حساب admin نفسه.
3. غيّر كلمات السرّ لكل الموظفين.

---

## 🔐 SSL / HTTPS

من cPanel → **SSL/TLS Status** → فعّل **Let's Encrypt** على الدومين. مجاني وتلقائى.

بعدها التطبيق هيفعّل cookies آمنة لأنك حطيت `COOKIE_SECURE=true` و`NODE_ENV=production`.

---

## 💾 النسخ الاحتياطى (Backup)

كل بياناتك فى ملفين:
- `data/db.json` — كل الموظفين، التقارير، الفرق، القوالب.
- `data/sessions.sqlite` — جلسات الدخول الحالية (مش مهم لو ضاع).

ملفات التقارير الـ HTML المرفوعة فى:
- `public/reports/submitted/`

**Backup script بسيط:**
```bash
# على cPanel terminal:
cd ~/reports-dashboard
tar -czf ~/backup-$(date +%Y%m%d).tar.gz data/db.json public/reports/submitted/
```

تقدر تأتمت ده عبر **Cron Jobs** فى cPanel — مرة كل أسبوع.

---

## ❓ الأسئلة الشائعة

### "هل أحتاج MySQL أو قاعدة بيانات منفصلة؟"
**لا.** المشروع بيستخدم **lowdb** اللى بيخزن البيانات فى ملف JSON واحد (`data/db.json`). شغال مع cPanel من غير أى إعداد.

### "هل هينفع PDF Export؟"
**على shared hosting: لا.** Puppeteer محتاج Chromium browser ومكتبات نظام مش متاحة على shared hosting. الـ endpoint موجود لكن هيرد بـ 503.

**حلول بديلة:**
- استخدم **Print → Save as PDF** من المتصفح.
- لو محتاج automation، استخدم خدمة sas زى [PDFShift](https://pdfshift.io) أو [APITemplate.io] — تحتاج تعديل الـ endpoint.

### "هل في حد أقصى لعدد الموظفين/التقارير؟"
lowdb مناسب لـ:
- ✅ ≤ 100 موظف
- ✅ ≤ 5,000 تقرير
- ✅ زيارات قليلة (< 50 concurrent users)

لو هتزيد عن كده، فكّر فى نقل البيانات لـ MySQL (cPanel بيدعمه مجاناً).

### "السيرفر بيقع كل فترة؟"
- لو الذاكرة قليلة، cPanel بيوقف الـ process. زود الـ memory limit من إعدادات الـ Node.js App.
- شغّل **Restart** لو حصل.

### "Sessions بتمسح كل ما أعمل Restart؟"
**لا** لأن المشروع بيستخدم **SQLite session store** — Sessions بتفضل محفوظة فى `data/sessions.sqlite`.

### "إزاى أعمل Deploy لتحديث جديد؟"
1. ارفع الملفات الجديدة (استبدل عبر File Manager أو git pull).
2. **متستبدلش** `data/db.json` — ده بياناتك الفعلية.
3. لو فى dependencies جديدة، شغّل `npm install` مرة تانية.
4. اضغط **Restart** فى Node.js App.

---

## 🚨 تحذيرات أمنية

1. **متشاركش الـ SESSION_SECRET** أبداً.
2. غيّر كلمات السرّ الافتراضية فوراً.
3. فعّل HTTPS (Let's Encrypt).
4. خلّى الـ Application Root **خارج** `public_html` — حصرياً.
5. اعمل backup أسبوعى لـ `data/db.json`.

---

## 📞 لو حصلت مشكلة

تحقق من **Application Logs** فى cPanel → Setup Node.js App → اضغط على الأبليكيشن → **stderr.log** و **stdout.log**.

أكتر مشاكل شائعة:
- **"Cannot find module"** → شغّل `npm install` تانى.
- **"Permission denied"** → تأكد إن `data/` و `public/reports/` permissions = `755`.
- **502 Bad Gateway** → التطبيق ما اشتغلش، تفقد الـ logs.
- **يفتح login بس مش بيدخل** → تفقد إن `COOKIE_SECURE=true` لو HTTPS، أو `false` لو HTTP فقط.
