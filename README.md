# 📋 لوحة تحكم التقارير الأسبوعية

## متطلبات التشغيل
- Node.js v18 أو أحدث
- npm

---

## تشغيل المشروع محلياً

```bash
# 1. ادخل على مجلد المشروع
cd reports-dashboard

# 2. تثبيت المكتبات
npm install

# 3. تشغيل السيرفر
npm start
```

ثم افتح المتصفح على: **http://localhost:3000**

---

## بيانات الدخول الافتراضية

### المدير
- **إيميل:** admin@reports.com
- **كلمة المرور:** admin123

### الموظفين (كلهم)
- **كلمة المرور:** pass123
- فاطمة: fatima@reports.com
- فريق المبيعات: sales@reports.com
- فريق النمو: growth@reports.com
- فريق المالية: finance@reports.com
- فريق HR: hr@reports.com
- فريق SEO: seo@reports.com
- فريق الويب: web@reports.com
- فريق الأكاديمية: academy@reports.com
- فريق Account: account@reports.com
- Pod 1: pod1@reports.com
- Pod 2: pod2@reports.com
- أحمد عبدالرؤوف: ahmed@reports.com
- نرمين: narmin@reports.com

---

## هيكل المشروع

```
reports-dashboard/
├── server/
│   └── index.js          # السيرفر الرئيسي
├── views/
│   ├── login.html         # صفحة تسجيل الدخول
│   ├── admin.html         # لوحة تحكم المدير
│   └── employee.html      # صفحة الموظف
├── public/
│   └── reports/           # ملفات HTML للتقارير
│       └── submitted/     # التقارير المرفوعة (تتعمل تلقائياً)
├── data/                  # قاعدة البيانات SQLite (تتعمل تلقائياً)
├── package.json
└── README.md
```

---

## المميزات

### المدير يقدر:
- ✅ يشوف كل التقارير المستلمة
- ✅ يضيف / يعدل / يحذف موظفين
- ✅ ينسخ رابط تسجيل الدخول لكل موظف
- ✅ يشوف إشعارات التقارير الجديدة
- ✅ يعاين قوالب التقارير

### الموظف يقدر:
- ✅ يفتح قالب تقريره
- ✅ يرفع ملف HTML بعد ما يكمله
- ✅ يحفظ التقرير مباشرة عن طريق paste HTML
- ✅ يشوف تاريخ تقاريره السابقة

---

## الرفع على الاستضافة

### على Render.com (مجاناً)
1. ارفع المشروع على GitHub
2. اعمل Web Service على render.com
3. Start Command: `npm start`
4. Environment: `NODE_ENV=production`

### على Railway.app
1. ارفع على GitHub
2. اعمل مشروع جديد من GitHub
3. هو هيشتغل تلقائياً

---
