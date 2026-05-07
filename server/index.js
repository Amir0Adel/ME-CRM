require('dotenv').config();

const express = require('express');
const emailService = require('./email-service');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { createDB } = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

// ── Database (SQLite via lowdb-compatible adapter) ────────────────────────────
const dataDir = path.join(__dirname, '../data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const db = createDB(path.join(dataDir, 'data.db'));
console.log('💾 DB: SQLite (data.db) via lowdb-compatible adapter');

db.defaults({
  users: [], reports: [], notifications: [], templates: [], teams: [],
  _nextId: { users: 1, reports: 1, notifications: 1, templates: 1, teams: 1 }
}).write();

// ضمان وجود teams و _nextId.teams لو الـ DB قديم
if (!db.has('teams').value()) db.set('teams', []).write();
if (db.get('_nextId.teams').value() === undefined) db.set('_nextId.teams', 1).write();

function nextId(table) {
  const id = db.get(`_nextId.${table}`).value();
  db.set(`_nextId.${table}`, id + 1).write();
  return id;
}

// Seed admin
if (!db.get('users').find({ role: 'admin' }).value()) {
  db.get('users').push({
    id: nextId('users'), name: 'المدير', email: 'admin@reports.com',
    password: bcrypt.hashSync('admin123', 10), role: 'admin',
    report_template: null, created_at: new Date().toISOString()
  }).write();
  console.log('✅ Admin: admin@reports.com / admin123');
}

// Seed employees
const empList = [
  { name: 'فاطمة', email: 'fatima@reports.com', template: 'report-ceo-weekly.html' },
  { name: 'فريق النمو', email: 'growth@reports.com', template: 'report-growth.html' },
  { name: 'فريق المبيعات', email: 'sales@reports.com', template: 'report-sales.html' },
  { name: 'فريق المالية', email: 'finance@reports.com', template: 'report-finance.html' },
  { name: 'فريق HR', email: 'hr@reports.com', template: 'report-hr.html' },
  { name: 'فريق SEO', email: 'seo@reports.com', template: 'report-seo.html' },
  { name: 'فريق الويب', email: 'web@reports.com', template: 'report-web.html' },
  { name: 'فريق الأكاديمية', email: 'academy@reports.com', template: 'report-academy.html' },
  { name: 'فريق Account', email: 'account@reports.com', template: 'report-account.html' },
  { name: 'Pod 1', email: 'pod1@reports.com', template: 'report-pod1.html' },
  { name: 'Pod 2', email: 'pod2@reports.com', template: 'report-pod2.html' },
  { name: 'أحمد عبدالرؤوف', email: 'ahmed@reports.com', template: 'تقرير_النمو_والا_يرادات___ا_حمد_عبدالرو_وف.html' },
  { name: 'نرمين', email: 'narmin@reports.com', template: 'تقرير_نرمين_الا_سبوعي___Planning___Quality_Governance.html' },
];
const defPass = bcrypt.hashSync('pass123', 10);
for (const e of empList) {
  if (!db.get('users').find({ email: e.email }).value()) {
    db.get('users').push({
      id: nextId('users'), name: e.name, email: e.email,
      password: defPass, role: 'employee', report_template: e.template,
      created_at: new Date().toISOString()
    }).write();
  }
}

// Seed existing template files as reports in DB
const TEMPLATE_REPORTS = [];

for (const t of TEMPLATE_REPORTS) {
  const user = db.get('users').find({ email: t.emp }).value();
  if (!user) continue;
  const alreadySeeded = db.get('reports').find({ filename: t.file, seeded: true }).value();
  if (!alreadySeeded) {
    db.get('reports').push({
      id: nextId('reports'),
      user_id: user.id,
      title: t.title,
      filename: t.file,
      week: 'الأسبوع الحالي',
      submitted_at: new Date().toISOString(),
      status: 'submitted',
      seeded: true
    }).write();
  }
}

// Marker version — لو اتغير، يعمل force reseed للقوالب + مسح كل التقارير
const TEMPLATES_VERSION = 'v4-2026-05-07-mahmoud-only';

const TEMPLATE_SEEDS = [
  // ============ 📈 تقرير النمو والأداء التسويقي — محمود القوصي ============
  {
    name: "📈 تقرير النمو والأداء التسويقي — محمود القوصي",
    description: "محمود القوصي — Growth / Planning / Strategy / Performance Lead",
    visual_theme: "analytics",
    icon: "📈",
    sections: [
      { type: "scorecard", title: "📊 Scorecard الأسبوع", subtitle: "تقييم الالتزام والمخرجات", has_note: false, note_label: "", items: [{ label: "التقرير مكتمل ومرسل؟", mode: "yesno", value: "" }, { label: "تم تحقيق المخرجات؟", mode: "yesno", value: "" }, { label: "حالة الفريق", mode: "traffic", value: "" }] },
      { type: "metrics", title: "📈 أداء الحملات", subtitle: "نتائج هذا الأسبوع", has_note: false, note_label: "", items: [{ label: "CPL متوسط", value: "", unit: "ر.س" }, { label: "CPC متوسط", value: "", unit: "ر.س" }, { label: "CTR", value: "", unit: "%" }, { label: "إجمالي الليدز", value: "", unit: "" }, { label: "جودة الليدز (1-10)", value: "", unit: "" }, { label: "الإنفاق الإعلاني", value: "", unit: "ر.س" }] },
      { type: "text", title: "💬 الرسائل والمحتوى", subtitle: "تقييم أداء الرسائل هذا الأسبوع", has_note: false, note_label: "", blocks: [{ heading: "أفضل رسالة / إعلان هذا الأسبوع", placeholder: "اكتب الرسالة الأفضل أداءً وسبب نجاحها..." }, { heading: "أضعف رسالة / إعلان هذا الأسبوع", placeholder: "اكتب الرسالة الأضعف أداءً وسبب ضعفها..." }, { heading: "ملاحظات على المحتوى والفانل", placeholder: "هل يوجد ضعف في الفانل؟ أين يتسرب الليد؟" }] },
      { type: "text", title: "🧪 الاختبارات والتحسينات", subtitle: "هذا الأسبوع والأسبوع القادم", has_note: false, note_label: "", blocks: [{ heading: "الاختبارات التي تمت هذا الأسبوع", placeholder: "ما الذي اختبرناه؟ وما النتيجة؟" }, { heading: "الاختبارات المخطط لها الأسبوع القادم", placeholder: "ما الذي سنختبره الأسبوع القادم؟" }, { heading: "توصيات التحسين", placeholder: "اكتب توصياتك لتحسين الأداء..." }] },
      { type: "scorecard", title: "🎯 متابعة أحمد عبدالفتاح", subtitle: "تقييم أداء Media Buyer هذا الأسبوع", has_note: true, note_label: "ملاحظات على أداء أحمد عبدالفتاح", items: [{ label: "الالتزام بالخطة؟", mode: "yesno", value: "" }, { label: "جودة التنفيذ؟", mode: "traffic", value: "" }, { label: "رفع التقرير في موعده؟", mode: "yesno", value: "" }] },
      { type: "checklist", title: "🔑 قرارات مطلوبة", subtitle: "ما تحتاجه من الإدارة هذا الأسبوع", has_note: false, note_label: "", placeholder: "اكتب القرار المطلوب...", status_options: ["عاجل", "هذا الأسبوع", "الأسبوع القادم"], items: [{ text: "", status: "" }] },
    ]
  },
  // ============ 🏫 تقرير تشغيل الأكاديمية — شيري ============
  {
    name: "🏫 تقرير تشغيل الأكاديمية — شيري",
    description: "شيري — Academy Operation & Customer Service",
    visual_theme: "standard",
    icon: "🏫",
    sections: [
      { type: "scorecard", title: "📊 Scorecard الأسبوع", subtitle: "تقييم الالتزام والمخرجات", has_note: false, note_label: "", items: [{ label: "التقرير مكتمل ومرسل؟", mode: "yesno", value: "" }, { label: "تم تحقيق المخرجات؟", mode: "yesno", value: "" }, { label: "حالة الأكاديمية", mode: "traffic", value: "" }] },
      { type: "checklist", title: "📚 حالة الدورات النشطة", subtitle: "كل دورة هذا الأسبوع", has_note: false, note_label: "", placeholder: "اسم الدورة", status_options: ["🟢 منتظمة", "🟡 تحتاج متابعة", "🔴 مشكلة"], items: [{ text: "", status: "" }] },
      { type: "metrics", title: "😊 رضا المتدربين والشكاوى", subtitle: "", has_note: true, note_label: "أبرز الشكاوى والمشاكل", items: [{ label: "تقييم الرضا (1-10)", value: "", unit: "" }, { label: "عدد الشكاوى", value: "", unit: "" }, { label: "شكاوى تم حلها", value: "", unit: "" }] },
      { type: "status", title: "👨‍🏫 متابعة المدربين", subtitle: "", has_note: true, note_label: "ملاحظات على المدربين", options: [{ value: "green", label: "🟢 ملتزمون" }, { value: "yellow", label: "🟡 متوسط" }, { value: "red", label: "🔴 مشكلة" }], value: "", note: "" },
      { type: "text", title: "💡 فرص النمو والتحسين", subtitle: "", has_note: false, note_label: "", blocks: [{ heading: "فرص Referral أو Upsell لاحظتِها", placeholder: "اكتب المتدربين أو الفرص المحتملة..." }, { heading: "أي مشكلة تشغيلية تؤثر على السمعة", placeholder: "اكتب أي مشكلة تؤثر على تجربة المتدرب..." }] },
      { type: "checklist", title: "🔑 قرارات مطلوبة", subtitle: "", has_note: false, note_label: "", placeholder: "اكتب القرار المطلوب...", status_options: ["عاجل", "هذا الأسبوع", "الأسبوع القادم"], items: [{ text: "", status: "" }] },
    ]
  },
  // ============ 🤝 تقرير Account Management — سماح ============
  {
    name: "🤝 تقرير Account Management — سماح",
    description: "سماح — Account Manager",
    visual_theme: "standard",
    icon: "🤝",
    sections: [
      { type: "scorecard", title: "📊 Scorecard الأسبوع", subtitle: "تقييم الالتزام والمخرجات", has_note: false, note_label: "", items: [{ label: "التقرير مكتمل ومرسل؟", mode: "yesno", value: "" }, { label: "تم تحقيق المخرجات؟", mode: "yesno", value: "" }, { label: "حالة الفريق", mode: "traffic", value: "" }] },
      { type: "metrics", title: "👥 صحة العملاء", subtitle: "Client Health هذا الأسبوع", has_note: true, note_label: "قرارات تحتاج تدخل إداري", items: [{ label: "عملاء راضون", value: "", unit: "" }, { label: "عملاء معرضون للخطر", value: "", unit: "" }, { label: "شكاوى مفتوحة", value: "", unit: "" }, { label: "اعتمادات متأخرة", value: "", unit: "" }, { label: "فرص Upsell", value: "", unit: "" }, { label: "فرص Renewal قريبة", value: "", unit: "" }] },
      { type: "checklist", title: "🔑 قرارات مطلوبة", subtitle: "", has_note: false, note_label: "", placeholder: "اكتب القرار المطلوب...", status_options: ["عاجل", "هذا الأسبوع", "الأسبوع القادم"], items: [{ text: "", status: "" }] },
    ]
  },
  // ============ 📋 Weekly CEO Control Report — فاطمة ============
  {
    name: "📋 Weekly CEO Control Report — فاطمة",
    description: "فاطمة — Admin Assistant / CEO Control Support",
    visual_theme: "executive",
    icon: "📋",
    sections: [
      { type: "metrics", title: "⚡ لمحة سريعة", subtitle: "أبرز أرقام الأسبوع دفعة واحدة", has_note: false, note_label: "", items: [{ label: "الإيراد المحصل", value: "", unit: "" }, { label: "التارجت الشهري", value: "", unit: "" }, { label: "إجمالي الليدز", value: "", unit: "" }, { label: "مشاريع حمراء", value: "", unit: "" }, { label: "عملاء معرضون للخطر", value: "", unit: "" }, { label: "قرارات مطلوبة", value: "", unit: "" }] },
      { type: "metrics", title: "💰 ملخص الإيرادات والنمو", subtitle: "من أحمد عبدالرؤوف", has_note: false, note_label: "", items: [{ label: "الإيراد المحقق", value: "", unit: "ر.س" }, { label: "الإيراد المتوقع", value: "", unit: "ر.س" }, { label: "الفجوة من التارجت", value: "", unit: "ر.س" }, { label: "Pipeline Value", value: "", unit: "ر.س" }] },
      { type: "text", title: "💰 تفاصيل الإيرادات", subtitle: "", has_note: false, note_label: "", blocks: [{ heading: "خطة سد الفجوة", placeholder: "اكتب خطة الأسبوع لسد الفجوة..." }, { heading: "أبرز فرص الإغلاق هذا الأسبوع", placeholder: "اكتب أهم الفرص القريبة من الإغلاق..." }] },
      { type: "scorecard", title: "🎯 ملخص التنفيذ والجودة", subtitle: "حالة فرق التنفيذ", has_note: true, note_label: "أبرز التأخيرات أو المشاريع الحمراء", items: [{ label: "🟦 Social Pod 1", mode: "traffic", value: "" }, { label: "🟩 Social Pod 2", mode: "traffic", value: "" }, { label: "🔍 SEO Team", mode: "traffic", value: "" }, { label: "💻 Web Team", mode: "traffic", value: "" }, { label: "🤝 Account Mgmt", mode: "traffic", value: "" }, { label: "🏫 الأكاديمية", mode: "traffic", value: "" }] },
      { type: "metrics", title: "👥 ملخص العملاء", subtitle: "من سماح — Account Management", has_note: false, note_label: "", items: [{ label: "عملاء راضون", value: "", unit: "" }, { label: "عملاء في خطر", value: "", unit: "" }, { label: "شكاوى مفتوحة", value: "", unit: "" }] },
      { type: "text", title: "👥 تفاصيل العملاء", subtitle: "", has_note: false, note_label: "", blocks: [{ heading: "العملاء المعرضون للخطر وأسبابها", placeholder: "اكتب تفاصيل العملاء في خطر..." }, { heading: "فرص التجديد أو Upsell القريبة", placeholder: "اكتب الفرص المتاحة..." }] },
      { type: "metrics", title: "📈 ملخص التسويق والأداء", subtitle: "من محمود القوصي", has_note: false, note_label: "", items: [{ label: "CPL متوسط", value: "", unit: "" }, { label: "جودة الليدز (1-10)", value: "", unit: "" }, { label: "الإنفاق الإعلاني", value: "", unit: "ر.س" }] },
      { type: "text", title: "📈 تفاصيل التسويق", subtitle: "", has_note: false, note_label: "", blocks: [{ heading: "أفضل رسالة / حملة هذا الأسبوع", placeholder: "اكتب الأفضل أداءً..." }, { heading: "أضعف رسالة / حملة", placeholder: "اكتب الأضعف أداءً وسبب الضعف..." }] },
      { type: "metrics", title: "💵 ملخص المالية", subtitle: "من محمد عبد الله ويوسف", has_note: true, note_label: "مخاطر مالية تحتاج قرار", items: [{ label: "الإيراد المحصل", value: "", unit: "ر.س" }, { label: "فواتير متأخرة", value: "", unit: "ر.س" }, { label: "المتوقع تحصيله", value: "", unit: "ر.س" }] },
      { type: "metrics", title: "👤 ملخص HR", subtitle: "من محسن", has_note: true, note_label: "مشاكل أفراد تحتاج قرار", items: [{ label: "أيام غياب", value: "", unit: "" }, { label: "حالات تأخير", value: "", unit: "" }, { label: "موظفون تحت الملاحظة", value: "", unit: "" }] },
      { type: "checklist", title: "🔑 القرارات المطلوبة من إبراهيم", subtitle: "بحد أقصى 3–5 قرارات هذا الأسبوع", has_note: false, note_label: "", placeholder: "اكتب القرار المطلوب...", status_options: ["عاجل", "هذا الأسبوع"], items: [{ text: "", status: "" }] },
      { type: "checklist", title: "🔄 متابعة قرارات الأسبوع السابق", subtitle: "هل تم تنفيذ ما تم الاتفاق عليه؟", has_note: false, note_label: "", placeholder: "القرار من الأسبوع السابق", status_options: ["✅ تم التنفيذ", "🟡 جاري", "❌ لم ينفّذ"], items: [{ text: "", status: "" }] },
      { type: "text", title: "🚨 المخاطر والتنبيهات", subtitle: "ما يجب أن يعرفه إبراهيم هذا الأسبوع", has_note: false, note_label: "", blocks: [{ heading: "أبرز المخاطر والتنبيهات", placeholder: "اكتب أبرز المخاطر التي تحتاج انتباه إبراهيم هذا الأسبوع..." }, { heading: "ملاحظات فاطمة", placeholder: "أي ملاحظات إضافية لإبراهيم..." }] },
    ]
  },
  // ============ 💰 تقرير Finance & Accounting — محمد عبد الله · يوسف ============
  {
    name: "💰 تقرير Finance & Accounting — محمد عبد الله · يوسف",
    description: "محمد عبد الله · يوسف",
    visual_theme: "executive",
    icon: "💰",
    sections: [
      { type: "scorecard", title: "📊 Scorecard الأسبوع", subtitle: "تقييم الالتزام والمخرجات", has_note: false, note_label: "", items: [{ label: "التقرير مكتمل ومرسل؟", mode: "yesno", value: "" }, { label: "تم تحقيق المخرجات؟", mode: "yesno", value: "" }, { label: "حالة الفريق", mode: "traffic", value: "" }] },
      { type: "metrics", title: "💵 الصورة المالية الأسبوعية", subtitle: "", has_note: false, note_label: "", items: [{ label: "الإيراد المحصل", value: "", unit: "ر.س" }, { label: "الفواتير المستحقة", value: "", unit: "ر.س" }, { label: "الفواتير المتأخرة", value: "", unit: "ر.س" }, { label: "المتوقع تحصيله", value: "", unit: "ر.س" }, { label: "Collection Rate", value: "", unit: "%" }, { label: "الالتزامات المستحقة", value: "", unit: "ر.س" }] },
      { type: "checklist", title: "⚠️ العملاء المتأخرون في السداد", subtitle: "", has_note: true, note_label: "ملاحظات التدفق النقدي (Cash Flow)", placeholder: "اسم العميل", status_options: ["🟡 متابعة", "🔴 تصعيد"], items: [{ text: "", status: "" }] },
      { type: "checklist", title: "🔑 قرارات مطلوبة", subtitle: "", has_note: false, note_label: "", placeholder: "اكتب القرار المطلوب...", status_options: ["عاجل", "هذا الأسبوع", "الأسبوع القادم"], items: [{ text: "", status: "" }] },
    ]
  },
  // ============ 👤 تقرير HR — محسن ============
  {
    name: "👤 تقرير HR — محسن",
    description: "محسن — Human Resources",
    visual_theme: "standard",
    icon: "👤",
    sections: [
      { type: "scorecard", title: "📊 Scorecard الأسبوع", subtitle: "تقييم الالتزام والمخرجات", has_note: false, note_label: "", items: [{ label: "التقرير مكتمل ومرسل؟", mode: "yesno", value: "" }, { label: "تم تحقيق المخرجات؟", mode: "yesno", value: "" }, { label: "حالة الفريق", mode: "traffic", value: "" }] },
      { type: "metrics", title: "📋 الحضور والانصراف", subtitle: "", has_note: false, note_label: "", items: [{ label: "أيام الغياب الكلية", value: "", unit: "" }, { label: "حالات تأخير", value: "", unit: "" }, { label: "موظفون تحت الملاحظة", value: "", unit: "" }, { label: "احتياجات التوظيف", value: "", unit: "" }] },
      { type: "checklist", title: "📋 الموظفون تحت الملاحظة هذا الأسبوع", subtitle: "", has_note: false, note_label: "", placeholder: "اسم الموظف — سبب الملاحظة", status_options: ["🟡 تحذير", "🔴 إنذار رسمي"], items: [{ text: "", status: "" }] },
      { type: "text", title: "📋 ملاحظات وتوصيات HR", subtitle: "", has_note: false, note_label: "", blocks: [{ heading: "المشاكل الإدارية أو السلوكية", placeholder: "اكتب أي مشاكل سلوكية أو إدارية هذا الأسبوع..." }, { heading: "توصيات HR", placeholder: "اكتب توصياتك لهذا الأسبوع..." }, { heading: "احتياجات التوظيف والوصف الوظيفي المطلوب", placeholder: "اكتب تفاصيل احتياجات التوظيف..." }] },
      { type: "checklist", title: "🔑 قرارات مطلوبة", subtitle: "", has_note: false, note_label: "", placeholder: "اكتب القرار المطلوب...", status_options: ["عاجل", "هذا الأسبوع", "الأسبوع القادم"], items: [{ text: "", status: "" }] },
    ]
  },
  // ============ 🟦 تقرير Social Pod 1 ============
  {
    name: "🟦 تقرير Social Pod 1",
    description: "بسنت · سمر · محمد إبراهيم · أحمد صبحي",
    visual_theme: "standard",
    icon: "🟦",
    sections: [
      { type: "scorecard", title: "📊 Scorecard الأسبوع", subtitle: "تقييم الالتزام والمخرجات", has_note: false, note_label: "", items: [{ label: "التقرير مكتمل ومرسل؟", mode: "yesno", value: "" }, { label: "تم تحقيق المخرجات؟", mode: "yesno", value: "" }, { label: "حالة الفريق", mode: "traffic", value: "" }] },
      { type: "checklist", title: "📁 حالة المشاريع", subtitle: "كل مشروع هذا الأسبوع", has_note: false, note_label: "", placeholder: "اسم المشروع / العميل — ما تم تسليمه", status_options: ["🟢 في الموعد", "🟡 متأخر قليلاً", "🔴 متأخر / مشكلة"], items: [{ text: "", status: "" }, { text: "", status: "" }] },
      { type: "metrics", title: "⚠️ المهام المتأخرة والمشاكل", subtitle: "", has_note: false, note_label: "", items: [{ label: "مهام اكتملت", value: "", unit: "" }, { label: "مهام متأخرة", value: "", unit: "" }, { label: "مشاريع معرضة للخطر", value: "", unit: "" }] },
      { type: "text", title: "⚠️ تفاصيل التأخير والجودة", subtitle: "", has_note: false, note_label: "", blocks: [{ heading: "أسباب التأخير", placeholder: "اكتب أسباب التأخير إن وجدت..." }, { heading: "ملاحظات جودة التنفيذ (عينة)", placeholder: "اكتب عينة من ملاحظات الجودة هذا الأسبوع..." }, { heading: "مشاكل العملاء", placeholder: "هل يوجد عملاء غير راضين أو شكاوى؟" }] },
      { type: "checklist", title: "🔑 قرارات مطلوبة", subtitle: "", has_note: false, note_label: "", placeholder: "اكتب القرار المطلوب...", status_options: ["عاجل", "هذا الأسبوع", "الأسبوع القادم"], items: [{ text: "", status: "" }] },
    ]
  },
  // ============ 🟩 تقرير Social Pod 2 ============
  {
    name: "🟩 تقرير Social Pod 2",
    description: "أميرة · إسراء · ندى · أحمد عاطف",
    visual_theme: "standard",
    icon: "🟩",
    sections: [
      { type: "scorecard", title: "📊 Scorecard الأسبوع", subtitle: "تقييم الالتزام والمخرجات", has_note: false, note_label: "", items: [{ label: "التقرير مكتمل ومرسل؟", mode: "yesno", value: "" }, { label: "تم تحقيق المخرجات؟", mode: "yesno", value: "" }, { label: "حالة الفريق", mode: "traffic", value: "" }] },
      { type: "checklist", title: "📁 حالة المشاريع", subtitle: "كل مشروع هذا الأسبوع", has_note: false, note_label: "", placeholder: "اسم المشروع / العميل — ما تم تسليمه", status_options: ["🟢 في الموعد", "🟡 متأخر قليلاً", "🔴 متأخر / مشكلة"], items: [{ text: "", status: "" }, { text: "", status: "" }] },
      { type: "metrics", title: "⚠️ المهام المتأخرة والمشاكل", subtitle: "", has_note: false, note_label: "", items: [{ label: "مهام اكتملت", value: "", unit: "" }, { label: "مهام متأخرة", value: "", unit: "" }, { label: "مشاريع معرضة للخطر", value: "", unit: "" }] },
      { type: "text", title: "⚠️ تفاصيل التأخير والجودة", subtitle: "", has_note: false, note_label: "", blocks: [{ heading: "أسباب التأخير", placeholder: "اكتب أسباب التأخير إن وجدت..." }, { heading: "ملاحظات جودة التنفيذ (عينة)", placeholder: "اكتب عينة من ملاحظات الجودة هذا الأسبوع..." }, { heading: "مشاكل العملاء", placeholder: "هل يوجد عملاء غير راضين أو شكاوى؟" }] },
      { type: "checklist", title: "🔑 قرارات مطلوبة", subtitle: "", has_note: false, note_label: "", placeholder: "اكتب القرار المطلوب...", status_options: ["عاجل", "هذا الأسبوع", "الأسبوع القادم"], items: [{ text: "", status: "" }] },
    ]
  },
  // ============ 🔍 تقرير SEO Team ============
  {
    name: "🔍 تقرير SEO Team",
    description: "شيماء · نور · عبد الرحمن",
    visual_theme: "analytics",
    icon: "🔍",
    sections: [
      { type: "scorecard", title: "📊 Scorecard الأسبوع", subtitle: "تقييم الالتزام والمخرجات", has_note: false, note_label: "", items: [{ label: "التقرير مكتمل ومرسل؟", mode: "yesno", value: "" }, { label: "تم تحقيق المخرجات؟", mode: "yesno", value: "" }, { label: "حالة الفريق", mode: "traffic", value: "" }] },
      { type: "metrics", title: "📈 أداء الكلمات المفتاحية", subtitle: "", has_note: false, note_label: "", items: [{ label: "كلمات تحسّنت", value: "", unit: "" }, { label: "كلمات تراجعت", value: "", unit: "" }, { label: "Organic Traffic", value: "", unit: "" }, { label: "صفحات مُفهرسة", value: "", unit: "" }, { label: "مقالات/صفحات نُفّذت", value: "", unit: "" }, { label: "مشاكل تقنية مفتوحة", value: "", unit: "" }] },
      { type: "text", title: "📈 تحليل التحسينات والفرص", subtitle: "", has_note: false, note_label: "", blocks: [{ heading: "أبرز التحسينات هذا الأسبوع", placeholder: "اكتب ما تم تحسينه..." }, { heading: "المشاكل التقنية المفتوحة", placeholder: "اكتب المشاكل التقنية التي تحتاج معالجة..." }, { heading: "فرص النمو المقترحة", placeholder: "اكتب فرص المحتوى أو التحسين للأسبوع القادم..." }, { heading: "احتياجات من Web Team أو Content", placeholder: "ما تحتاجه من فرق أخرى..." }] },
      { type: "checklist", title: "🔑 قرارات مطلوبة", subtitle: "", has_note: false, note_label: "", placeholder: "اكتب القرار المطلوب...", status_options: ["عاجل", "هذا الأسبوع", "الأسبوع القادم"], items: [{ text: "", status: "" }] },
    ]
  },
  // ============ 💻 تقرير Web Team ============
  {
    name: "💻 تقرير Web Team",
    description: "أمير · أحمد نصار",
    visual_theme: "standard",
    icon: "💻",
    sections: [
      { type: "scorecard", title: "📊 Scorecard الأسبوع", subtitle: "تقييم الالتزام والمخرجات", has_note: false, note_label: "", items: [{ label: "التقرير مكتمل ومرسل؟", mode: "yesno", value: "" }, { label: "تم تحقيق المخرجات؟", mode: "yesno", value: "" }, { label: "حالة الفريق", mode: "traffic", value: "" }] },
      { type: "checklist", title: "🌐 حالة مشاريع الويب", subtitle: "", has_note: false, note_label: "", placeholder: "اسم المشروع / العميل — نسبة الإنجاز", status_options: ["🟢 في الموعد", "🟡 تحتاج متابعة", "🔴 متأخر / مشكلة"], items: [{ text: "", status: "" }] },
      { type: "metrics", title: "⚙️ المشاكل التقنية والدعم", subtitle: "", has_note: false, note_label: "", items: [{ label: "مشاكل تم حلها", value: "", unit: "" }, { label: "مشاكل مفتوحة", value: "", unit: "" }, { label: "مواقع تحتاج تدخل", value: "", unit: "" }] },
      { type: "text", title: "⚙️ تفاصيل الدعم والتتبع", subtitle: "", has_note: false, note_label: "", blocks: [{ heading: "تفاصيل المشاكل المفتوحة", placeholder: "اكتب تفاصيل المشاكل التقنية المفتوحة..." }, { heading: "مدى جاهزية التتبع والتحويل للمواقع", placeholder: "هل التتبع مُركّب وشغال على كل المواقع؟" }] },
      { type: "checklist", title: "🔑 قرارات مطلوبة", subtitle: "", has_note: false, note_label: "", placeholder: "اكتب القرار المطلوب...", status_options: ["عاجل", "هذا الأسبوع", "الأسبوع القادم"], items: [{ text: "", status: "" }] },
    ]
  },
  // ============ 📊 تقرير النمو والإيرادات — أحمد عبدالرؤوف ============
  {
    name: "📊 تقرير النمو والإيرادات — أحمد عبدالرؤوف",
    description: "أحمد عبدالرؤوف — Growth & Revenue Director",
    visual_theme: "executive",
    icon: "📊",
    sections: [
      { type: "text", title: "⚡ الملخص التنفيذي — 4 نقاط فقط", subtitle: "", has_note: false, note_label: "", blocks: [{ heading: "أهم إنجاز هذا الأسبوع", placeholder: "اكتب أهم إنجاز في الإيراد أو النمو..." }, { heading: "أكبر خطر أو فجوة", placeholder: "اكتب أكبر خطر على الإيراد هذا الأسبوع..." }, { heading: "خطة سد الفجوة", placeholder: "ماذا ستفعل لسد فجوة التارجت؟" }, { heading: "أهم قرار مطلوب من إبراهيم", placeholder: "القرار الواحد الأهم المطلوب من إبراهيم..." }] },
      { type: "metrics", title: "💰 مؤشرات الإيراد الأساسية", subtitle: "الأرقام الأهم لهذا الأسبوع", has_note: false, note_label: "", items: [{ label: "الإيراد المحقق", value: "", unit: "" }, { label: "التارجت الشهري", value: "", unit: "" }, { label: "الإيراد المتوقع", value: "", unit: "" }, { label: "الفجوة من التارجت", value: "", unit: "" }, { label: "Pipeline Value", value: "", unit: "" }, { label: "نسبة تحقيق التارجت", value: "", unit: "%" }] },
      { type: "metrics", title: "📞 ملخص المبيعات", subtitle: "من محمد عبدالقوي — Sales Manager", has_note: false, note_label: "", items: [{ label: "مبيعات B2C", value: "", unit: "ر.س" }, { label: "مبيعات B2B", value: "", unit: "ر.س" }, { label: "إجمالي التسجيلات", value: "", unit: "" }, { label: "Conversion Rate", value: "", unit: "%" }, { label: "عدد الليدز", value: "", unit: "" }, { label: "فرص إغلاق قريبة", value: "", unit: "" }] },
      { type: "text", title: "📞 ملخص المبيعات — ملاحظات", subtitle: "من محمد عبدالقوي — Sales Manager", has_note: false, note_label: "", blocks: [{ heading: "أهم مشكلة في المبيعات هذا الأسبوع", placeholder: "اكتب أبرز عائق أمام المبيعات..." }, { heading: "أسباب عدم الإغلاق", placeholder: "لماذا لم تُغلق بعض الفرص؟" }] },
      { type: "metrics", title: "🎯 جودة الليدز والحملات", subtitle: "من محمود القوصي — Growth & Performance", has_note: false, note_label: "", items: [{ label: "جودة الليدز (1-10)", value: "", unit: "" }, { label: "CPL متوسط", value: "", unit: "ر.س" }, { label: "الإنفاق الإعلاني", value: "", unit: "ر.س" }] },
      { type: "status", title: "🎯 هل الليدز مناسبة للتحويل؟", subtitle: "من محمود القوصي — Growth & Performance", has_note: false, note_label: "", options: [{ value: "green", label: "✅ نعم مناسبة" }, { value: "yellow", label: "🟡 جزئياً" }, { value: "red", label: "❌ تحتاج تحسين" }], value: "", note: "" },
      { type: "text", title: "🎯 ملاحظات جودة الليدز", subtitle: "من محمود القوصي — Growth & Performance", has_note: false, note_label: "", blocks: [{ heading: "ملاحظات على جودة الليدز", placeholder: "هل العملاء فاهمين العرض؟ هل عندهم قدرة شرائية؟ هل المصدر مؤثر؟" }, { heading: "توصيات لتحسين الاستهداف أو الرسالة", placeholder: "اكتب توصياتك لمحمود وأحمد عبدالفتاح..." }] },
      { type: "table", title: "🔥 فرص الإغلاق الأسبوع القادم", subtitle: "الفرص المتوقع إغلاقها خلال 7 أيام", has_note: false, note_label: "", headers: ["اسم العميل / الفرصة", "النوع", "القيمة", "احتمالية الإغلاق", "المطلوب لإغلاقها", "المسؤول"], rows: [["", "", "", "", "", ""]] },
      { type: "text", title: "💡 مقترحات النمو هذا الأسبوع", subtitle: "عروض / منتجات / شراكات / إيفنتات", has_note: false, note_label: "", blocks: [{ heading: "مقترحات عروض أو منتجات جديدة", placeholder: "اكتب أي فكرة لمنتج أو عرض يمكن أن يضيف إيراداً..." }, { heading: "فرص شراكات أو إيفنتات", placeholder: "اكتب أي فرصة شراكة أو إيفنت تستحق المتابعة..." }, { heading: "متابعة التحصيل المرتبط بالإيراد", placeholder: "هل يوجد إيراد مسجل لم يُحصَّل بعد؟ ما المطلوب؟" }] },
      { type: "text", title: "🚨 مخاطر تحتاج انتباه إبراهيم", subtitle: "Red Flags هذا الأسبوع", has_note: false, note_label: "", blocks: [{ heading: "الخطر", placeholder: "اكتب الخطر..." }, { heading: "السبب", placeholder: "لماذا حدث هذا؟" }, { heading: "الأثر المتوقع", placeholder: "ماذا سيحدث لو لم نتدخل؟" }, { heading: "الإجراء المقترح", placeholder: "ما القرار المطلوب؟" }] },
      { type: "table", title: "🔑 ملخص القرارات المطلوبة", subtitle: "قرارات تحتاج موافقة أو توجيه من إبراهيم — بحد أقصى 5", has_note: false, note_label: "", headers: ["القرار المطلوب", "لماذا مطلوب الآن؟", "أثر التأخير", "المسؤول بعد القرار", "الموعد النهائي", "الأولوية", "الحالة"], rows: [["", "", "", "", "", "", ""]] },
      { type: "table", title: "🔄 متابعة قرارات الأسبوع السابق", subtitle: "هل تم تنفيذ ما اتُّفق عليه؟", has_note: false, note_label: "", headers: ["القرار السابق", "المسؤول", "ما تم", "ما لم يتم", "سبب التأخير", "الإجراء التالي", "الحالة"], rows: [["", "", "", "", "", "", ""]] },
    ]
  },
  // ============ 📞 تقرير خالد الأسبوعي — B2C Sales Team Leader ============
  {
    name: "📞 تقرير خالد الأسبوعي — B2C Sales Team Leader",
    description: "B2C Sales Team Leader — متابعة أداء فريق المبيعات",
    visual_theme: "executive",
    icon: "📞",
    sections: [
      { type: "table", title: "👥 أداء الفريق الفردي", subtitle: "", has_note: false, note_label: "", headers: ["الاسم", "ليدز مستلمة", "مكالمات", "متابعات", "تسجيلات", "% التحويل", "جودة المحادثات", "الالتزام بالسكريبت", "الحالة العامة"], rows: [["", "", "", "", "", "", "", "", ""]] },
      { type: "metrics", title: "📊 مؤشرات الفريق الكلية", subtitle: "", has_note: false, note_label: "", items: [{ label: "إجمالي الليدز المستلمة", value: "", unit: "" }, { label: "إجمالي المكالمات", value: "", unit: "" }, { label: "إجمالي المتابعات", value: "", unit: "" }, { label: "إجمالي التسجيلات", value: "", unit: "" }, { label: "% التحويل", value: "", unit: "" }, { label: "متوسط سرعة الرد", value: "", unit: "" }] },
      { type: "text", title: "❌ أسباب عدم الشراء", subtitle: "", has_note: false, note_label: "", blocks: [{ heading: "🔍 أكثر أسباب رفض الشراء هذا الأسبوع", placeholder: "مثال: السعر مرتفع، الوقت غير مناسب، يريد التفكير، لم يقتنع بالمحتوى…" }] },
      { type: "table", title: "💬 الاعتراضات الأكثر تكراراً", subtitle: "", has_note: false, note_label: "", headers: ["نص الاعتراض", "التكرار", "الرد المقترح"], rows: [["", "", ""]] },
      { type: "text", title: "🎯 جودة المحادثات والسكريبت", subtitle: "", has_note: false, note_label: "", blocks: [{ heading: "✅ أفضل محادثة هذا الأسبوع", placeholder: "من كان المندوب؟ ماذا فعل صح؟ ما النتيجة؟" }, { heading: "⚠️ أضعف محادثة أو موقف", placeholder: "ما المشكلة؟ كيف كان يجب أن يتصرف؟" }, { heading: "📋 مدى التزام الفريق بالسكريبت", placeholder: "هل الفريق ملتزم بالسكريبت؟ من يحتاج تدريب؟ ما النقاط الأكثر انحرافاً؟" }] },
      { type: "text", title: "🏆 تقييم الفريق", subtitle: "", has_note: false, note_label: "", blocks: [{ heading: "🥇 الأفضل أداءً هذا الأسبوع — السبب", placeholder: "لماذا تميّز؟" }, { heading: "🔴 يحتاج دعم وتطوير — خطة الدعم", placeholder: "ما الخطوات المقررة لتحسين أدائه؟" }] },
      { type: "metrics", title: "📅 خطة الأسبوع القادم — التارجت", subtitle: "🎯 التارجت المستهدف للأسبوع القادم", has_note: false, note_label: "", items: [{ label: "تسجيلات مستهدفة", value: "", unit: "" }, { label: "مكالمات مستهدفة", value: "", unit: "" }, { label: "% تحويل مستهدف", value: "", unit: "" }] },
      { type: "text", title: "📅 خطة الأسبوع القادم — خطوات التحسين", subtitle: "", has_note: false, note_label: "", blocks: [{ heading: "📋 خطوات التحسين المقررة", placeholder: "ما الذي ستغيّره أو تحسّنه الأسبوع القادم على مستوى الفريق أو السكريبت؟" }] },
      { type: "text", title: "📢 ملاحظات للإدارة", subtitle: "", has_note: false, note_label: "", blocks: [{ heading: "💬 قرارات أو دعم تحتاجه من محمد عبدالقوي", placeholder: "هل تحتاج سكريبت جديد؟ تدريب؟ تعديل على توزيع الليدز؟ أي قرار يحتاجه الفريق؟" }] },
    ]
  },
  // ============ 🔍 تقرير نرمين الأسبوعي — Planning & Quality Governance ============
  {
    name: "🔍 تقرير نرمين الأسبوعي — Planning & Quality Governance",
    description: "Planning & Quality Governance — مسار التنفيذ والجودة",
    visual_theme: "standard",
    icon: "🔍",
    sections: [
      { type: "metrics", title: "📊 مؤشرات الجودة والأداء", subtitle: "", has_note: false, note_label: "", items: [{ label: "% الالتزام بالخطة", value: "", unit: "" }, { label: "عدد المشاريع الحمراء", value: "", unit: "" }, { label: "جودة المخرجات", value: "", unit: "" }, { label: "سرعة رصد المشاكل", value: "", unit: "" }, { label: "رضا العملاء", value: "", unit: "" }, { label: "مهام مسلّمة في موعدها", value: "", unit: "" }] },
      { type: "table", title: "🗂️ حالة المشاريع", subtitle: "", has_note: false, note_label: "", headers: ["اسم المشروع / العميل", "الفريق المسؤول", "% الإنجاز", "الحالة", "الملاحظة"], rows: [["", "", "", "", ""]] },
      { type: "text", title: "🎯 التخطيط", subtitle: "", has_note: false, note_label: "", blocks: [{ heading: "📌 ما تم تخطيطه هذا الأسبوع", placeholder: "اكتبي الخطط والمبادرات التي وُضعت هذا الأسبوع…" }, { heading: "📅 خطة الأسبوع القادم", placeholder: "ما الخطط والمبادرات المقررة للأسبوع القادم؟" }, { heading: "🔄 تحديثات على معايير الجودة", placeholder: "هل تم تعديل أي معيار جودة؟ إضافة معيار جديد؟ تغيير في التوقعات؟" }] },
      { type: "text", title: "🔍 الجودة", subtitle: "", has_note: false, note_label: "", blocks: [{ heading: "✅ أفضل مخرجات الأسبوع جودةً", placeholder: "أكثر 2-3 مخرجات أعجبتك في الأسبوع هذا من ناحية الجودة…" }, { heading: "⚠️ مخرجات بحاجة لتحسين", placeholder: "مخرجات لم ترقَ للمستوى المطلوب وماذا تقترحين لتحسينها…" }, { heading: "🔁 أنماط متكررة في مشاكل الجودة", placeholder: "هل هناك مشكلة جودة تتكرر عبر فرق أو مشاريع متعددة؟" }] },
      { type: "table", title: "🚨 المخاطر", subtitle: "", has_note: false, note_label: "", headers: ["وصف الخطر", "الجهة المعنية", "مستوى الخطورة"], rows: [["", "", ""]] },
      { type: "text", title: "⚡ القرارات المطلوبة من الإدارة", subtitle: "", has_note: false, note_label: "", blocks: [{ heading: "📢 قرارات أو توجيهات تحتاجها من إبراهيم", placeholder: "ما القرارات أو التوجيهات التي تحتاجها من الإدارة هذا الأسبوع؟" }] },
      { type: "text", title: "💬 ملاحظات ختامية", subtitle: "", has_note: false, note_label: "", blocks: [{ heading: "🗒️ أي ملاحظات أو تعليقات إضافية", placeholder: "أي شيء آخر تودي إيصاله لإبراهيم أو للفريق هذا الأسبوع…" }] },
    ]
  },
  // ============ 📈 تقرير النمو والأداء التسويقي — أحمد عبدالفتاح ============
  {
    name: "📈 تقرير النمو والأداء التسويقي — أحمد عبدالفتاح",
    description: "أحمد عبدالفتاح — Media Buyer",
    visual_theme: "analytics",
    icon: "📈",
    sections: [
      { type: "scorecard", title: "📊 Scorecard الأسبوع", subtitle: "تقييم الالتزام والمخرجات", has_note: false, note_label: "", items: [{ label: "التقرير مكتمل ومرسل؟", mode: "yesno", value: "" }, { label: "تم تحقيق المخرجات؟", mode: "yesno", value: "" }, { label: "حالة الفريق", mode: "traffic", value: "" }] },
      { type: "metrics", title: "📈 أداء الحملات", subtitle: "نتائج هذا الأسبوع", has_note: false, note_label: "", items: [{ label: "CPL متوسط", value: "", unit: "ر.س" }, { label: "CPC متوسط", value: "", unit: "ر.س" }, { label: "CTR", value: "", unit: "%" }, { label: "إجمالي الليدز", value: "", unit: "" }, { label: "جودة الليدز (1-10)", value: "", unit: "" }, { label: "الإنفاق الإعلاني", value: "", unit: "ر.س" }] },
      { type: "text", title: "💬 الرسائل والمحتوى", subtitle: "تقييم أداء الرسائل هذا الأسبوع", has_note: false, note_label: "", blocks: [{ heading: "أفضل رسالة / إعلان هذا الأسبوع", placeholder: "اكتب الرسالة الأفضل أداءً وسبب نجاحها..." }, { heading: "أضعف رسالة / إعلان هذا الأسبوع", placeholder: "اكتب الرسالة الأضعف أداءً وسبب ضعفها..." }, { heading: "ملاحظات على المحتوى والفانل", placeholder: "هل يوجد ضعف في الفانل؟ أين يتسرب الليد؟" }] },
      { type: "text", title: "🧪 الاختبارات والتحسينات", subtitle: "هذا الأسبوع والأسبوع القادم", has_note: false, note_label: "", blocks: [{ heading: "الاختبارات التي تمت هذا الأسبوع", placeholder: "ما الذي اختبرناه؟ وما النتيجة؟" }, { heading: "الاختبارات المخطط لها الأسبوع القادم", placeholder: "ما الذي سنختبره الأسبوع القادم؟" }, { heading: "توصيات التحسين", placeholder: "اكتب توصياتك لتحسين الأداء..." }] },
      { type: "checklist", title: "🔑 قرارات مطلوبة", subtitle: "ما تحتاجه من الإدارة هذا الأسبوع", has_note: false, note_label: "", placeholder: "اكتب القرار المطلوب...", status_options: ["عاجل", "هذا الأسبوع", "الأسبوع القادم"], items: [{ text: "", status: "" }] },
    ]
  },
];

// ============ خريطة ربط الموظفين بالقوالب الجديدة ============
// المفتاح = الإيميل، القيمة = اسم القالب الذي يستخدمه هذا الموظف
const TEMPLATE_USER_MAP = {
  // Growth / Performance
  'mahmoudelkousy93@gmail.com':          '📈 تقرير النمو والأداء التسويقي — محمود القوصي',
  'growth@reports.com':                  '📈 تقرير النمو والأداء التسويقي — محمود القوصي',
  'ahmedmuhamedabdelfattah2@gmail.com':  '📈 تقرير النمو والأداء التسويقي — أحمد عبدالفتاح',
  // Revenue & Sales
  'Ahraoufa@gmail.com':                  '📊 تقرير النمو والإيرادات — أحمد عبدالرؤوف',
  'ahmed@reports.com':                   '📊 تقرير النمو والإيرادات — أحمد عبدالرؤوف',
  'khalidmajdi1998@gmail.com':           '📞 تقرير خالد الأسبوعي — B2C Sales Team Leader',
  'sales@reports.com':                   '📞 تقرير خالد الأسبوعي — B2C Sales Team Leader',
  // CEO control
  'foulamohamed111@gmail.com':           '📋 Weekly CEO Control Report — فاطمة',
  'fatima@reports.com':                  '📋 Weekly CEO Control Report — فاطمة',
  // Finance
  'mohamedaboatwa2014@gmail.com':        '💰 تقرير Finance & Accounting — محمد عبد الله · يوسف',
  'yousefgoh132@gmail.com':              '💰 تقرير Finance & Accounting — محمد عبد الله · يوسف',
  'finance@reports.com':                 '💰 تقرير Finance & Accounting — محمد عبد الله · يوسف',
  // HR
  'Mmagdy2828@gmail.com':                '👤 تقرير HR — محسن',
  'hr@reports.com':                      '👤 تقرير HR — محسن',
  // Account Management
  'Samahabouelmagd5@gmail.com':          '🤝 تقرير Account Management — سماح',
  'account@reports.com':                 '🤝 تقرير Account Management — سماح',
  // Academy
  'Shirehanelkady@gmail.com':            '🏫 تقرير تشغيل الأكاديمية — شيري',
  'academy@reports.com':                 '🏫 تقرير تشغيل الأكاديمية — شيري',
  // SEO Team
  'shaimaaeid4@gmail.com':               '🔍 تقرير SEO Team',
  'wwwnoorragb2019@gmail.com':           '🔍 تقرير SEO Team',
  'abdelrahmanhamdyseo@gmail.com':       '🔍 تقرير SEO Team',
  'seo@reports.com':                     '🔍 تقرير SEO Team',
  // Web Team
  'amir.adel.mohamed.eid@gmail.com':     '💻 تقرير Web Team',
  'Ahmed.neasser@gmail.com':             '💻 تقرير Web Team',
  'web@reports.com':                     '💻 تقرير Web Team',
  // Social Pod 1 (بسنت · محمد إبراهيم · أحمد صبحي)
  'Basantmohamed40@gmail.com':           '🟦 تقرير Social Pod 1',
  'mohamed.ibrahem.1610@gmail.com':      '🟦 تقرير Social Pod 1',
  'a.sobhy1997@gmail.com':               '🟦 تقرير Social Pod 1',
  'pod1@reports.com':                    '🟦 تقرير Social Pod 1',
  // Social Pod 2 (أميرة · إسراء · ندى · أحمد عاطف)
  'Amira.abdefattah1996@gmail.com':      '🟩 تقرير Social Pod 2',
  'esraahosafy@gmail.com':               '🟩 تقرير Social Pod 2',
  'nadak6094@gmail.com':                 '🟩 تقرير Social Pod 2',
  'Ahmed.atef.motian@gmail.com':         '🟩 تقرير Social Pod 2',
  'pod2@reports.com':                    '🟩 تقرير Social Pod 2',
  // Planning & Quality
  'narmin@reports.com':                  '🔍 تقرير نرمين الأسبوعي — Planning & Quality Governance',
};

// ── Migrations: ensure new fields exist on existing records ───────────────────
db.get('reports').each(r => {
  if (r.sections === undefined)        r.sections = [];
  if (r.edited_by_admin === undefined) r.edited_by_admin = false;
  if (r.versions === undefined)        r.versions = [];
  if (r.comments === undefined)        r.comments = [];
}).write();

db.get('templates').each(t => {
  if (t.visual_theme === undefined) t.visual_theme = 'standard';
}).write();

// Teams migration: لو في users لهم template_id ومفيش فرق، أنشئ فرق تلقائياً
const existingTeams = db.get('teams').value();
if (!existingTeams.length) {
  const usersByTemplate = {};
  db.get('users').filter({ role: 'employee' }).value().forEach(u => {
    if (!u.template_id) return;
    if (!usersByTemplate[u.template_id]) usersByTemplate[u.template_id] = [];
    usersByTemplate[u.template_id].push(u);
  });

  Object.entries(usersByTemplate).forEach(([tid, users]) => {
    const tmpl = db.get('templates').find({ id: parseInt(tid) }).value();
    if (!tmpl || users.length === 0) return;
    const cleanName = tmpl.name.replace(/^[^؀-ۿa-zA-Z]+/, '').trim() || tmpl.name;
    const team = {
      id: nextId('teams'),
      name: 'فريق ' + cleanName,
      description: tmpl.description || '',
      leader_id: users[0].id,
      member_ids: users.map(u => u.id),
      template_id: parseInt(tid),
      created_at: new Date().toISOString()
    };
    db.get('teams').push(team).write();
    // علّم القائد + اربط الأعضاء
    db.get('users').find({ id: team.leader_id }).assign({ is_team_leader: true, team_id: team.id }).write();
    users.forEach(u => db.get('users').find({ id: u.id }).assign({ team_id: team.id }).write());
    console.log(`👥 Auto-created team: ${team.name} (leader: ${users[0].name}, ${users.length} member${users.length>1?'s':''})`);
  });
}

// Force re-seed templates لما TEMPLATES_VERSION يتغير (يحذف القوالب والتقارير القديمة)
const storedTplVersion = db.get('_meta.templates_version').value();
if (storedTplVersion !== TEMPLATES_VERSION) {
  // فك ارتباط الموظفين بأي قالب قديم قبل المسح
  db.get('users').filter({ role: 'employee' }).each(u => { u.template_id = null; }).write();
  db.set('templates', []).write();
  db.set('_nextId.templates', 1).write();
  // مسح كل التقارير الموجودة وإعادة العداد للصفر
  db.set('reports', []).write();
  db.set('_nextId.reports', 1).write();
  db.set('_meta.templates_version', TEMPLATES_VERSION).write();
  console.log('🔄 Templates version changed → wiped old templates + reports, re-seeding fresh');
}

for (const tpl of TEMPLATE_SEEDS) {
  if (!db.get('templates').find({ name: tpl.name }).value()) {
    const id = nextId('templates');
    // فلترة أي sections فاضية/null دفاعياً
    const cleanSections = (tpl.sections || []).filter(s => s && typeof s === 'object' && s.type);
    db.get('templates').push({ id, ...tpl, sections: cleanSections, created_at: new Date().toISOString() }).write();
    console.log('✅ Template seeded:', tpl.name, '(' + cleanSections.length + ' sections)');
  }
}

// تنظيف أي null sections في القوالب الموجودة (حتى لو مش حصل re-seed)
db.get('templates').each(t => {
  const before = (t.sections || []).length;
  t.sections = (t.sections || []).filter(s => s && typeof s === 'object' && s.type);
  if (t.sections.length !== before) {
    console.log(`🧹 Cleaned ${before - t.sections.length} null section(s) from template: ${t.name}`);
  }
}).write();

// ربط كل موظف بالقالب الصح حسب TEMPLATE_USER_MAP
for (const [email, templateName] of Object.entries(TEMPLATE_USER_MAP)) {
  const user = db.get('users').find({ email }).value();
  const template = db.get('templates').find({ name: templateName }).value();
  if (user && template && user.template_id !== template.id) {
    db.get('users').find({ id: user.id }).assign({ template_id: template.id }).write();
    console.log(`🔗 Linked ${email} → ${templateName}`);
  }
}

// ── Middleware ────────────────────────────────────────────────────────────────
// Trust the reverse proxy (cPanel/Passenger/Nginx) — must be first for req.protocol + secure cookies
app.set('trust proxy', 1);

// Force HTTPS redirect
app.use((req, res, next) => {
  if (req.protocol !== 'https' && req.header('host')?.includes('marketingexperts.com.sa')) {
    return res.redirect(301, `https://${req.header('host')}${req.originalUrl}`);
  }
  next();
});

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.static(path.join(__dirname, '../public')));

// Favicon fallback: redirect /favicon.ico to /favicon.svg if .ico file is absent
app.get('/favicon.ico', (req, res) => {
  const icoPath = path.join(__dirname, '../public/favicon.ico');
  if (fs.existsSync(icoPath)) return res.sendFile(icoPath);
  res.redirect(302, '/favicon.svg');
});

// Persistent session store via SQLite (auto-creates data/sessions.sqlite)
let sessionStore;
try {
  const SQLiteStore = require('connect-sqlite3')(session);
  sessionStore = new SQLiteStore({ db: 'sessions.sqlite', dir: dataDir });
  console.log('🗂️  Session store: SQLite (persistent)');
} catch (e) {
  console.log('⚠️  connect-sqlite3 not available — falling back to in-memory sessions');
}

const isProd = process.env.NODE_ENV === 'production';
app.use(session({
  store: sessionStore,
  secret: process.env.SESSION_SECRET || 'reports-secret-key-2024',
  resave: false, saveUninitialized: false,
  cookie: {
    maxAge: 7 * 24 * 60 * 60 * 1000,
    httpOnly: true,
    sameSite: 'lax',
    secure: isProd && process.env.COOKIE_SECURE !== 'false'
  }
}));

const uploadStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '../public/reports/submitted');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => cb(null, `${Date.now()}_${file.originalname}`)
});
const upload = multer({ storage: uploadStorage });

const requireLogin = (req, res, next) => { if (!req.session.user) return res.redirect('/login'); next(); };
const requireAdmin = (req, res, next) => { if (!req.session.user || req.session.user.role !== 'admin') return res.redirect('/login'); next(); };

// ── Routes ────────────────────────────────────────────────────────────────────
app.get('/', (req, res) => res.redirect('/login'));

app.get('/login', (req, res) => {
  if (req.session.user) return res.redirect(req.session.user.role === 'admin' ? '/admin' : '/employee');
  res.sendFile(path.join(__dirname, '../views/login.html'));
});

app.post('/login', (req, res) => {
  const user = db.get('users').find({ email: req.body.email }).value();
  if (!user || !bcrypt.compareSync(req.body.password, user.password)) return res.redirect('/login?error=1');
  req.session.user = {
    id: user.id, name: user.name, email: user.email, role: user.role,
    template: user.report_template,
    is_team_leader: !!user.is_team_leader,
    team_id: user.team_id || null,
    can_compare_team: !!user.can_compare_team,
    can_edit_template: !!user.can_edit_template
  };
  // "تذكرني": إن لم يُحدّد، اجعل الجلسة جلسة-متصفح فقط (تنتهي بإغلاقه)
  if (!req.body.remember) {
    req.session.cookie.expires = false;
    req.session.cookie.maxAge = null;
  }
  res.redirect(user.role === 'admin' ? '/admin' : '/employee');
});

// ── Self-service profile update ───────────────────────────────────────────────
app.put('/api/me/profile', requireLogin, (req, res) => {
  const { name, email, current_password, new_password } = req.body || {};
  const userId = req.session.user.id;
  const user = db.get('users').find({ id: userId }).value();
  if (!user) return res.status(404).json({ error: 'المستخدم غير موجود' });

  const update = {};
  if (typeof name === 'string' && name.trim()) update.name = name.trim();
  if (typeof email === 'string' && email.trim()) {
    const newEmail = email.trim().toLowerCase();
    if (newEmail !== (user.email || '').toLowerCase()) {
      const exists = db.get('users').find(u => u.id !== userId && (u.email || '').toLowerCase() === newEmail).value();
      if (exists) return res.status(400).json({ error: 'الإيميل مستخدم بالفعل' });
      update.email = newEmail;
    }
  }
  if (new_password) {
    if (!current_password || !bcrypt.compareSync(current_password, user.password)) {
      return res.status(400).json({ error: 'كلمة المرور الحالية غير صحيحة' });
    }
    if (String(new_password).length < 6) {
      return res.status(400).json({ error: 'كلمة المرور الجديدة قصيرة جدًا (6 حروف على الأقل)' });
    }
    update.password = bcrypt.hashSync(new_password, 10);
  }

  if (!Object.keys(update).length) return res.json({ success: true, unchanged: true });
  db.get('users').find({ id: userId }).assign(update).write();

  if (update.name)  req.session.user.name  = update.name;
  if (update.email) req.session.user.email = update.email;
  res.json({ success: true });
});

app.get('/logout', (req, res) => req.session.destroy(() => res.redirect('/login')));
app.get('/api/session', (req, res) => res.json(req.session.user || null));

// ── Admin ─────────────────────────────────────────────────────────────────────
app.get('/admin', requireAdmin, (req, res) => res.sendFile(path.join(__dirname, '../views/admin.html')));
app.get('/admin/template-editor', requireAdmin, (req, res) => res.sendFile(path.join(__dirname, '../views/admin-template-editor.html')));

app.get('/api/admin/stats', requireAdmin, (req, res) => {
  const oneWeekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
  res.json({
    totalUsers: db.get('users').filter({ role: 'employee' }).size().value(),
    totalReports: db.get('reports').size().value(),
    thisWeek: db.get('reports').filter(r => r.submitted_at > oneWeekAgo).size().value(),
    unread: db.get('notifications').filter({ read: false }).size().value()
  });
});

app.get('/api/admin/users', requireAdmin, (req, res) => {
  res.json(db.get('users').filter({ role: 'employee' }).map(u => ({
    id: u.id, name: u.name, email: u.email, role: u.role,
    report_template: u.report_template, created_at: u.created_at,
    template_id: u.template_id || null,
    can_edit_template: !!u.can_edit_template,
    can_compare_team: !!u.can_compare_team,
    is_team_leader: !!u.is_team_leader
  })).value());
});

app.post('/api/admin/users', requireAdmin, (req, res) => {
  const { name, email, password, report_template } = req.body;
  if (!name || !email || !password) return res.status(400).json({ error: 'بيانات ناقصة' });
  if (db.get('users').find({ email }).value()) return res.status(400).json({ error: 'الإيميل موجود بالفعل' });
  const id = nextId('users');
  db.get('users').push({ id, name, email, password: bcrypt.hashSync(password, 10), role: 'employee', report_template: report_template || null, template_id: null, can_edit_template: false, can_compare_team: false, created_at: new Date().toISOString() }).write();
  res.json({ success: true, id });
});

app.put('/api/admin/users/:id', requireAdmin, (req, res) => {
  const { name, email, password, report_template, template_id, can_edit_template, can_compare_team } = req.body;
  const id = parseInt(req.params.id);
  const update = {
    name, email,
    report_template: report_template || null,
    template_id: template_id ? parseInt(template_id) : null,
    can_edit_template: !!can_edit_template,
    can_compare_team: !!can_compare_team
  };
  if (password) update.password = bcrypt.hashSync(password, 10);
  db.get('users').find({ id }).assign(update).write();
  res.json({ success: true });
});

app.delete('/api/admin/users/:id', requireAdmin, (req, res) => {
  db.get('users').remove({ id: parseInt(req.params.id), role: 'employee' }).write();
  res.json({ success: true });
});

// Helper: compute completion % by comparing report sections to the base template
function computeCompletionPct(report, template) {
  // Multi-project mode: average completion across all projects
  if (Array.isArray(report.projects) && report.projects.length) {
    const tmplSections = template && Array.isArray(template.sections) ? template.sections.filter(s => s && s.type) : [];
    const projectPcts = report.projects.map(p => {
      const projSections = (p.sections || []).filter(s => s && s.type);
      if (!projSections.length) return 0;
      if (tmplSections.length) {
        let filled = 0;
        tmplSections.forEach((ts, idx) => {
          const rs = projSections.find(s => s.title === ts.title) || projSections[idx];
          if (rs && sectionHasContent(rs)) filled++;
        });
        return Math.round((filled / tmplSections.length) * 100);
      }
      const filled = projSections.filter(s => sectionHasContent(s)).length;
      return Math.round((filled / projSections.length) * 100);
    });
    if (!projectPcts.length) return 0;
    return Math.round(projectPcts.reduce((a, b) => a + b, 0) / projectPcts.length);
  }
  const reportSections = (report.sections || []).filter(s => s && s.type);
  const tmplSections = template && Array.isArray(template.sections) ? template.sections.filter(s => s && s.type) : [];

  // Path A: structured sections exist on the report — measure granularly
  if (reportSections.length) {
    if (tmplSections.length) {
      let filled = 0;
      tmplSections.forEach((ts, idx) => {
        const rs = reportSections.find(s => s.title === ts.title) || reportSections[idx];
        if (rs && sectionHasContent(rs)) filled++;
      });
      return Math.round((filled / tmplSections.length) * 100);
    }
    const filled = reportSections.filter(s => sectionHasContent(s)).length;
    return Math.round((filled / reportSections.length) * 100);
  }

  // Path B: legacy fallback — no structured sections, but we have rendered HTML content.
  // Count <section> tags in the saved HTML (or stored content) and compare to template.
  let html = report.content || '';
  if (!html && report.filename) {
    try {
      const fp = path.join(__dirname, '../public/reports/submitted', report.filename);
      if (fs.existsSync(fp)) html = fs.readFileSync(fp, 'utf8');
    } catch (_) {}
  }
  if (html) {
    const renderedSectionCount = (html.match(/<section\b/gi) || []).length;
    if (tmplSections.length && renderedSectionCount) {
      return Math.min(100, Math.round((renderedSectionCount / tmplSections.length) * 100));
    }
    // No template, but content exists and is non-trivial → assume submitted = 100%
    if (html.length > 800) return 100;
  }
  return 0;
}

function sectionHasContent(s) {
  if (!s || !s.type) return false;
  switch (s.type) {
    case 'text':
      if (Array.isArray(s.blocks) && s.blocks.length) {
        return s.blocks.some(b => ((b && (b.heading || b.text)) || '').toString().trim());
      }
      return !!(s.content && String(s.content).trim());
    case 'list':      return Array.isArray(s.items) && s.items.some(i => (i && (i.text || i.content || '').toString().trim()));
    case 'metrics':   return Array.isArray(s.items) && s.items.some(i => i && i.value !== undefined && i.value !== null && String(i.value).trim() !== '');
    case 'scorecard': return Array.isArray(s.items) && s.items.some(i => i && (i.answer || i.value));
    case 'checklist': return Array.isArray(s.items) && s.items.some(i => i && i.checked);
    case 'table':     return Array.isArray(s.rows) && s.rows.some(row => Array.isArray(row) ? row.some(c => (c||'').toString().trim()) : Object.values(row||{}).some(c => (c||'').toString().trim()));
    case 'status':    return !!(s.value || s.status);
    default:          return !!(s.content || (Array.isArray(s.items) && s.items.length));
  }
}

app.get('/api/admin/reports', requireAdmin, (req, res) => {
  const allUsers = db.get('users').value();
  const allTeams = db.get('teams').value() || [];
  const allTemplates = db.get('templates').value() || [];

  const reports = db.get('reports')
    .filter(r => r.status === 'submitted' && !r.seeded)
    .value()
    .map(r => {
      const u = allUsers.find(x => x.id === r.user_id);
      let team_name = null, leader_name = null;
      if (u && u.team_id) {
        const team = allTeams.find(t => t.id === u.team_id);
        if (team) {
          team_name = team.name;
          if (team.leader_id) {
            const leader = allUsers.find(x => x.id === team.leader_id);
            if (leader) leader_name = leader.name;
          }
        }
      }
      const tmpl = u && u.template_id ? allTemplates.find(t => t.id === u.template_id) : null;
      const completion_pct = computeCompletionPct(r, tmpl);
      const commentsArr = Array.isArray(r.comments) ? r.comments : [];
      // Count unread admin replies = comments from employees that admin hasn't seen
      const unreadEmpComments = commentsArr.filter(c => c.by_role === 'employee' && !c.seen_by_admin).length;
      return {
        ...r,
        user_name: u?.name || '—',
        user_email: u?.email || '—',
        team_name,
        leader_name,
        completion_pct,
        is_team_report: !!r.is_team_report,
        child_count: Array.isArray(r.child_reports) ? r.child_reports.length : 0,
        is_multi_project: Array.isArray(r.projects) && r.projects.length > 0,
        project_count: Array.isArray(r.projects) ? r.projects.length : 0,
        comments_count: commentsArr.length,
        unread_emp_comments: unreadEmpComments
      };
    })
    .sort((a, b) => b.submitted_at.localeCompare(a.submitted_at));
  res.json(reports);
});

app.delete('/api/admin/reports/:id', requireAdmin, (req, res) => {
  const id = parseInt(req.params.id);
  const rpt = db.get('reports').find({ id }).value();
  if (rpt) {
    const fp = path.join(__dirname, '../public/reports/submitted', rpt.filename);
    if (fs.existsSync(fp)) fs.unlinkSync(fp);
    db.get('reports').remove({ id }).write();
  }
  res.json({ success: true });
});

// ── Admin Report Editing (Dev 1) ──────────────────────────────────────────────
app.get('/admin/report/:id/edit', requireAdmin, (req, res) => {
  res.sendFile(path.join(__dirname, '../views/admin-report-edit.html'));
});

app.get('/api/admin/reports/:id', requireAdmin, (req, res) => {
  const id = parseInt(req.params.id);
  const report = db.get('reports').find({ id }).value();
  if (!report) return res.status(404).json({ error: 'التقرير مش موجود' });

  const user = db.get('users').find({ id: report.user_id }).value();
  const template = user?.template_id ? db.get('templates').find({ id: user.template_id }).value() : null;

  // إذا كانت sections فاضية حاول استخراجها من ملف HTML
  let sections = report.sections || [];
  if ((!sections || !sections.length) && report.filename) {
    try {
      const fp = path.join(__dirname, '../public/reports/submitted', report.filename);
      if (fs.existsSync(fp)) {
        const html = fs.readFileSync(fp, 'utf8');
        const m = html.match(/<script type="application\/json" id="__rpt__">([\s\S]*?)<\/script>/);
        if (m) sections = JSON.parse(m[1]);
      }
    } catch (e) { /* ignore */ }
  }

  res.json({
    report: { ...report, sections },
    user_name: user?.name || '—',
    user_email: user?.email || '—',
    template
  });
});

app.put('/api/admin/reports/:id', requireAdmin, (req, res) => {
  const id = parseInt(req.params.id);
  const { title, week, sections, content, projects } = req.body;

  const report = db.get('reports').find({ id }).value();
  if (!report) return res.status(404).json({ error: 'التقرير مش موجود' });

  // احفظ النسخة القديمة في versions (max 5)
  const oldVersion = {
    sections: report.sections || [],
    projects: report.projects || [],
    title: report.title,
    week: report.week,
    saved_at: new Date().toISOString(),
    edited_by: req.session.user.name
  };
  const versions = report.versions || [];
  versions.unshift(oldVersion);
  if (versions.length > 5) versions.pop();

  const update = {
    title: title || report.title,
    week:  week  || report.week,
    sections: sections || report.sections,
    edited_by_admin: true,
    last_edited_at: new Date().toISOString(),
    versions
  };
  if (Array.isArray(projects)) update.projects = projects;

  if (content) {
    const dir = path.join(__dirname, '../public/reports/submitted');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, report.filename), content, 'utf8');
  }

  db.get('reports').find({ id }).assign(update).write();
  res.json({ success: true });
});

// ── Versioning (Dev 2) ────────────────────────────────────────────────────────
app.get('/api/admin/reports/:id/versions', requireAdmin, (req, res) => {
  const id = parseInt(req.params.id);
  const report = db.get('reports').find({ id }).value();
  if (!report) return res.status(404).json({ error: 'مش موجود' });
  res.json(report.versions || []);
});

app.post('/api/admin/reports/:id/restore/:versionIdx', requireAdmin, (req, res) => {
  const id = parseInt(req.params.id);
  const versionIdx = parseInt(req.params.versionIdx);
  const report = db.get('reports').find({ id }).value();
  if (!report) return res.status(404).json({ error: 'مش موجود' });

  const version = (report.versions || [])[versionIdx];
  if (!version) return res.status(404).json({ error: 'النسخة مش موجودة' });

  // احفظ الحالية في versions قبل الاستعادة
  const versions = report.versions || [];
  const current = {
    sections: report.sections || [],
    title: report.title,
    week: report.week,
    saved_at: new Date().toISOString(),
    edited_by: req.session.user.name + ' (قبل الاستعادة)'
  };
  versions.unshift(current);
  if (versions.length > 5) versions.pop();

  db.get('reports').find({ id }).assign({
    title: version.title,
    week: version.week,
    sections: version.sections,
    last_edited_at: new Date().toISOString(),
    versions
  }).write();

  res.json({ success: true });
});

// ── Inline Comments (Dev 3) ───────────────────────────────────────────────────
// Unified comment endpoint — both admin and employee (the report owner) can post
app.post('/api/reports/:id/comment', requireLogin, (req, res) => {
  const id = parseInt(req.params.id);
  const { section_idx, text, parent_id } = req.body;
  if (!text || !text.trim()) return res.status(400).json({ error: 'النص فاضي' });

  const report = db.get('reports').find({ id }).value();
  if (!report) return res.status(404).json({ error: 'مش موجود' });

  // Authorization: admin can comment on any; employee only on their own
  if (req.session.user.role !== 'admin' && report.user_id !== req.session.user.id) {
    return res.status(403).json({ error: 'غير مسموح' });
  }

  const comments = report.comments || [];
  let normalizedIdx = null;
  if (section_idx != null && section_idx !== '') {
    if (typeof section_idx === 'number') normalizedIdx = section_idx;
    else if (typeof section_idx === 'string' && /^\d+$/.test(section_idx)) normalizedIdx = parseInt(section_idx);
    else normalizedIdx = section_idx;
  }
  const comment = {
    id: Date.now(),
    section_idx: normalizedIdx,
    text: text.trim(),
    by: req.session.user.name,
    by_role: req.session.user.role,
    parent_id: parent_id ? parseInt(parent_id) : null,
    created_at: new Date().toISOString(),
    seen: false
  };
  comments.push(comment);
  db.get('reports').find({ id }).assign({ comments }).write();

  // Notify the relevant party
  if (req.session.user.role === 'admin') {
    addNotif(report.user_id, `الأدمن أضاف تعليق على تقرير: ${report.title}`);
    (async () => {
      const user = db.get('users').find({ id: report.user_id }).value();
      if (user && emailService) {
        const emailTemplate = emailService.adminCommentTemplate(req.session.user.name, text.trim());
        await emailService.sendEmail(user.email, emailTemplate.subject, emailTemplate.html);
      }
    })().catch(err => console.error('Email error:', err));
  } else {
    // Employee replied — notify all admins
    db.get('users').filter({ role: 'admin' }).value().forEach(admin => {
      addNotif(admin.id, `${req.session.user.name} رد على تعليق فى تقريره: ${report.title}`);
    });
  }

  res.json({ success: true, comment });
});

// Legacy admin-only endpoint — still works, points to the new logic
app.post('/api/admin/reports/:id/comment', requireAdmin, (req, res) => {
  const id = parseInt(req.params.id);
  const { section_idx, text, parent_id } = req.body;
  if (!text || !text.trim()) return res.status(400).json({ error: 'النص فاضي' });

  const report = db.get('reports').find({ id }).value();
  if (!report) return res.status(404).json({ error: 'مش موجود' });

  const comments = report.comments || [];
  let normalizedIdx = null;
  if (section_idx != null && section_idx !== '') {
    if (typeof section_idx === 'number') normalizedIdx = section_idx;
    else if (typeof section_idx === 'string' && /^\d+$/.test(section_idx)) normalizedIdx = parseInt(section_idx);
    else normalizedIdx = section_idx;
  }
  const comment = {
    id: Date.now(),
    section_idx: normalizedIdx,
    text: text.trim(),
    by: req.session.user.name,
    by_role: 'admin',
    parent_id: parent_id ? parseInt(parent_id) : null,
    created_at: new Date().toISOString(),
    seen: false
  };
  comments.push(comment);
  db.get('reports').find({ id }).assign({ comments }).write();

  addNotif(report.user_id, `الأدمن أضاف تعليق على تقرير: ${report.title}`);

  (async () => {
    const user = db.get('users').find({ id: report.user_id }).value();
    if (user && emailService) {
      const emailTemplate = emailService.adminCommentTemplate(req.session.user.name, text.trim());
      await emailService.sendEmail(user.email, emailTemplate.subject, emailTemplate.html);
    }
  })().catch(err => console.error('Email error:', err));

  res.json({ success: true, comment });
});

app.delete('/api/admin/reports/:id/comment/:commentId', requireAdmin, (req, res) => {
  const id = parseInt(req.params.id);
  const commentId = parseInt(req.params.commentId);
  const report = db.get('reports').find({ id }).value();
  if (!report) return res.status(404).json({ error: 'مش موجود' });
  const comments = (report.comments || []).filter(c => c.id !== commentId);
  db.get('reports').find({ id }).assign({ comments }).write();
  res.json({ success: true });
});

app.get('/api/employee/reports/:id/comments', requireLogin, (req, res) => {
  const id = parseInt(req.params.id);
  const report = db.get('reports').find({ id, user_id: req.session.user.id }).value();
  if (!report) return res.status(404).json({ error: 'مش موجود' });
  res.json(report.comments || []);
});

app.post('/api/employee/reports/:id/comments/seen', requireLogin, (req, res) => {
  const id = parseInt(req.params.id);
  const report = db.get('reports').find({ id, user_id: req.session.user.id }).value();
  if (!report) return res.status(404).json({ error: 'مش موجود' });
  const comments = (report.comments || []).map(c => ({ ...c, seen: true }));
  db.get('reports').find({ id }).assign({ comments }).write();
  res.json({ success: true });
});

// ── Template CRUD ─────────────────────────────────────────────────────────────
app.get('/api/admin/templates', requireAdmin, (req, res) => {
  const templates = db.get('templates').value();
  const withStats = templates.map(t => {
    const assigned = db.get('users').filter({ template_id: t.id }).size().value();
    return { ...t, assigned_count: assigned };
  });
  res.json(withStats);
});

app.post('/api/admin/templates', requireAdmin, (req, res) => {
  const { name, description, sections, visual_theme, instructions } = req.body;
  if (!name || !sections || !sections.length) return res.status(400).json({ error: 'اسم القالب والأقسام مطلوبة' });
  const id = nextId('templates');
  db.get('templates').push({
    id, name,
    description: description || '',
    instructions: instructions || '',
    visual_theme: visual_theme || 'standard',
    sections,
    created_at: new Date().toISOString()
  }).write();
  res.json({ success: true, id });
});

app.get('/api/admin/templates/:id', requireAdmin, (req, res) => {
  const t = db.get('templates').find({ id: parseInt(req.params.id) }).value();
  if (!t) return res.status(404).json({ error: 'القالب مش موجود' });
  res.json(t);
});

app.put('/api/admin/templates/:id', requireAdmin, (req, res) => {
  const id = parseInt(req.params.id);
  const { name, description, sections, visual_theme, instructions, multi_project } = req.body;
  if (!name || !sections) return res.status(400).json({ error: 'بيانات ناقصة' });
  const update = {
    name,
    description: description || '',
    sections,
    updated_at: new Date().toISOString()
  };
  if (visual_theme) update.visual_theme = visual_theme;
  if (instructions !== undefined) update.instructions = instructions;
  if (multi_project !== undefined) update.multi_project = !!multi_project;
  db.get('templates').find({ id }).assign(update).write();
  res.json({ success: true });
});

app.delete('/api/admin/templates/:id', requireAdmin, (req, res) => {
  const id = parseInt(req.params.id);
  // فك ارتباط الموظفين بالقالب
  db.get('users').filter({ template_id: id }).each(u => { u.template_id = null; }).write();
  db.get('templates').remove({ id }).write();
  res.json({ success: true });
});

// ── Templates Marketplace (Add 7) ─────────────────────────────────────────────
const MARKETPLACE_TEMPLATES = [
  {
    id: 'mkt-digital',
    icon: '📈',
    category: 'تسويق رقمي',
    name: 'تقرير التسويق الرقمي الأسبوعي',
    description: 'مناسب لـ Performance Marketing, Social Media, Content',
    sections: [
      { type: 'scorecard', title: 'Scorecard الأسبوع', items: [
        { label: 'تم تحقيق هدف Leads؟', mode: 'yesno', value: '' },
        { label: 'الإنفاق ضمن الميزانية؟', mode: 'yesno', value: '' },
        { label: 'حالة الحملات', mode: 'traffic', value: '' }
      ]},
      { type: 'metrics', title: 'KPIs الحملات', items: [
        { label: 'Leads جديدة', value: '', unit: '' },
        { label: 'CPL', value: '', unit: 'جنيه' },
        { label: 'CTR', value: '', unit: '%' },
        { label: 'ROAS', value: '', unit: 'x' },
      ]},
      { type: 'text', title: 'أبرز الحملات الناجحة', content: '' },
      { type: 'text', title: 'الحملات اللي محتاجة تحسين', content: '' },
      { type: 'list', title: 'اختبارات الأسبوع القادم', items: [''] },
    ]
  },
  {
    id: 'mkt-sales-b2b',
    icon: '🤝',
    category: 'مبيعات B2B',
    name: 'تقرير مبيعات B2B',
    description: 'للفرق اللي تركز على عملاء الأعمال',
    sections: [
      { type: 'scorecard', title: 'Scorecard', items: [
        { label: 'تم تحقيق التارجت؟', mode: 'yesno', value: '' },
        { label: 'تم اتباع الـ pipeline؟', mode: 'yesno', value: '' },
        { label: 'حالة العملاء', mode: 'traffic', value: '' }
      ]},
      { type: 'metrics', title: 'أرقام الأسبوع', items: [
        { label: 'اجتماعات تمت', value: '', unit: '' },
        { label: 'عروض مقدمة', value: '', unit: '' },
        { label: 'صفقات مغلقة', value: '', unit: '' },
        { label: 'إيرادات', value: '', unit: 'جنيه' }
      ]},
      { type: 'checklist', title: 'العملاء النشطون', status_options: ['🟢 إغلاق قريب', '🟡 متابعة', '🔴 خطر فقد'], items: [{ text: '', status: '' }] },
      { type: 'text', title: 'أبرز الاعتراضات والتحديات', content: '' },
      { type: 'checklist', title: 'قرارات مطلوبة', status_options: ['عاجل', 'هذا الأسبوع', 'الأسبوع القادم'], items: [{ text: '', status: '' }] }
    ]
  },
  {
    id: 'mkt-cs',
    icon: '🎧',
    category: 'خدمة عملاء',
    name: 'تقرير خدمة العملاء',
    description: 'للفرق اللي تتعامل مع تذاكر ودعم',
    sections: [
      { type: 'scorecard', title: 'Scorecard', items: [
        { label: 'تم حل التذاكر في الوقت؟', mode: 'yesno', value: '' },
        { label: 'رضا العملاء عالي؟', mode: 'yesno', value: '' },
        { label: 'حالة الفريق', mode: 'traffic', value: '' }
      ]},
      { type: 'metrics', title: 'مؤشرات الدعم', items: [
        { label: 'تذاكر واردة', value: '', unit: '' },
        { label: 'تم حلها', value: '', unit: '' },
        { label: 'متوسط زمن الرد', value: '', unit: 'ساعة' },
        { label: 'تقييم الرضا (CSAT)', value: '', unit: '%' }
      ]},
      { type: 'list', title: 'أبرز الشكاوى المتكررة', items: [''] },
      { type: 'text', title: 'تحسينات مقترحة', content: '' }
    ]
  },
  {
    id: 'mkt-hr',
    icon: '👤',
    category: 'موارد بشرية',
    name: 'تقرير HR الأسبوعي',
    description: 'لفرق الموارد البشرية والتوظيف',
    sections: [
      { type: 'scorecard', title: 'Scorecard', items: [
        { label: 'الحضور ضمن المعدل؟', mode: 'yesno', value: '' },
        { label: 'لا توجد مشاكل سلوكية؟', mode: 'yesno', value: '' },
        { label: 'حالة الفريق العامة', mode: 'traffic', value: '' }
      ]},
      { type: 'metrics', title: 'الحضور والانصراف', items: [
        { label: 'إجمالي الموظفين', value: '', unit: '' },
        { label: 'الغيابات', value: '', unit: '' },
        { label: 'التأخيرات', value: '', unit: '' },
        { label: 'إجازات', value: '', unit: '' }
      ]},
      { type: 'list', title: 'الموظفون تحت الملاحظة', items: [''] },
      { type: 'text', title: 'احتياجات التوظيف', content: '' },
      { type: 'text', title: 'مبادرات تطوير الفريق', content: '' }
    ]
  },
  {
    id: 'mkt-finance',
    icon: '💰',
    category: 'مالية',
    name: 'تقرير المالية والمحاسبة',
    description: 'للفرق المالية وإدارة التحصيل',
    sections: [
      { type: 'scorecard', title: 'Scorecard', items: [
        { label: 'التحصيل ضمن الهدف؟', mode: 'yesno', value: '' },
        { label: 'لا توجد مخاطر cash flow؟', mode: 'yesno', value: '' },
        { label: 'حالة المالية', mode: 'traffic', value: '' }
      ]},
      { type: 'metrics', title: 'الصورة المالية', items: [
        { label: 'الإيرادات المحصّلة', value: '', unit: 'جنيه' },
        { label: 'المصروفات', value: '', unit: 'جنيه' },
        { label: 'صافي الربح', value: '', unit: 'جنيه' },
        { label: 'المتأخرات', value: '', unit: 'جنيه' },
        { label: 'نسبة التحصيل', value: '', unit: '%' }
      ]},
      { type: 'checklist', title: 'العملاء المتأخرون', status_options: ['🟡 1-30 يوم', '🟠 31-60 يوم', '🔴 +60 يوم'], items: [{ text: '', status: '' }] },
      { type: 'text', title: 'ملاحظات Cash Flow', content: '' }
    ]
  },
  {
    id: 'mkt-product',
    icon: '🚀',
    category: 'تطوير منتج',
    name: 'تقرير تطوير المنتج',
    description: 'لفرق Engineering و Product Management',
    sections: [
      { type: 'scorecard', title: 'Scorecard Sprint', items: [
        { label: 'تم إكمال user stories المخططة؟', mode: 'yesno', value: '' },
        { label: 'لا توجد bugs critical مفتوحة؟', mode: 'yesno', value: '' },
        { label: 'حالة الفريق', mode: 'traffic', value: '' }
      ]},
      { type: 'metrics', title: 'Sprint Metrics', items: [
        { label: 'Stories مكتملة', value: '', unit: '' },
        { label: 'Stories متأخرة', value: '', unit: '' },
        { label: 'Bugs مفتوحة', value: '', unit: '' },
        { label: 'Velocity', value: '', unit: 'pts' }
      ]},
      { type: 'checklist', title: 'الـ Features قيد التطوير', status_options: ['🟢 جاهز', '🟡 قيد المراجعة', '🔴 مُعطّل'], items: [{ text: '', status: '' }] },
      { type: 'text', title: 'تحديات تقنية', content: '' },
      { type: 'text', title: 'خطة Sprint القادم', content: '' }
    ]
  },
];

app.get('/admin/templates/marketplace', requireAdmin, (req, res) => {
  res.sendFile(path.join(__dirname, '../views/admin-marketplace.html'));
});

app.get('/api/admin/marketplace', requireAdmin, (req, res) => {
  res.json({ templates: MARKETPLACE_TEMPLATES });
});

app.post('/api/admin/marketplace/install/:id', requireAdmin, (req, res) => {
  const tpl = MARKETPLACE_TEMPLATES.find(t => t.id === req.params.id);
  if (!tpl) return res.status(404).json({ error: 'القالب مش موجود' });
  const id = nextId('templates');
  db.get('templates').push({
    id,
    name: tpl.icon + ' ' + tpl.name,
    description: tpl.description,
    visual_theme: 'standard',
    sections: JSON.parse(JSON.stringify(tpl.sections)),
    created_at: new Date().toISOString(),
    from_marketplace: tpl.id
  }).write();
  res.json({ success: true, id });
});

// ── Visual Theme (Dev 4) ──────────────────────────────────────────────────────
app.put('/api/admin/templates/:id/theme', requireAdmin, (req, res) => {
  const id = parseInt(req.params.id);
  const { visual_theme } = req.body;
  const allowed = ['standard', 'executive', 'analytics', 'compact', 'colorful'];
  if (!allowed.includes(visual_theme)) return res.status(400).json({ error: 'ثيم غير صالح' });
  db.get('templates').find({ id }).assign({ visual_theme }).write();
  res.json({ success: true });
});

// ── PDF Export (Dev 5) ────────────────────────────────────────────────────────
let puppeteer = null;
try { puppeteer = require('puppeteer'); } catch (e) { console.log('⚠️  puppeteer غير مثبت — PDF endpoint هيرجع رسالة'); }

app.get('/api/admin/reports/:id/pdf', requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id);
  const report = db.get('reports').find({ id }).value();
  if (!report) return res.status(404).json({ error: 'مش موجود' });

  if (!puppeteer) {
    return res.status(503).send('puppeteer غير مثبت — شغل: npm install puppeteer');
  }

  const url = `${req.protocol}://${req.get('host')}/reports/view/${encodeURIComponent(report.filename)}`;
  let browser = null;
  try {
    browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'], headless: 'new' });
    const page = await browser.newPage();
    // مرر cookies session للسماح بالـ requireLogin
    const cookies = req.headers.cookie || '';
    if (cookies) {
      const parts = cookies.split(';').map(c => c.trim().split('='));
      const cookieList = parts.map(([name, ...rest]) => ({ name, value: rest.join('='), domain: req.hostname, path: '/' }));
      await page.setCookie(...cookieList);
    }
    await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 });
    const pdfBuf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '20mm', bottom: '20mm', left: '15mm', right: '15mm' }
    });
    await browser.close();
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="report-${id}.pdf"`);
    res.send(pdfBuf);
  } catch (e) {
    if (browser) try { await browser.close(); } catch (_) {}
    console.error('PDF error:', e);
    res.status(500).send('فشل توليد PDF: ' + e.message);
  }
});

// ── Statistics Dashboard (Dev 6) ──────────────────────────────────────────────
app.get('/admin/stats', requireAdmin, (req, res) => {
  res.sendFile(path.join(__dirname, '../views/admin-stats.html'));
});

app.get('/admin/org', requireLogin, (req, res) => {
  res.sendFile(path.join(__dirname, '../views/admin-org.html'));
});
// Friendly alias for employees
app.get('/org', requireLogin, (req, res) => {
  res.sendFile(path.join(__dirname, '../views/admin-org.html'));
});

app.get('/api/admin/stats/overview', requireAdmin, (req, res) => {
  const allReports = db.get('reports').filter(r => !r.seeded && r.status === 'submitted').value();
  const users = db.get('users').filter({ role: 'employee' }).value();

  const byWeek = {};
  allReports.forEach(r => { byWeek[r.week || '—'] = (byWeek[r.week || '—'] || 0) + 1; });

  const byUser = {};
  allReports.forEach(r => {
    const u = users.find(u => u.id === r.user_id);
    if (u) byUser[u.name] = (byUser[u.name] || 0) + 1;
  });

  const oneWeekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
  const thisWeekReports = allReports.filter(r => r.submitted_at > oneWeekAgo);
  const expected = users.length;
  const submissionRate = expected > 0 ? Math.round((thisWeekReports.length / expected) * 100) : 0;

  const submittedUserIds = new Set(thisWeekReports.map(r => r.user_id));
  const lateUsers = users.filter(u => !submittedUserIds.has(u.id))
    .map(u => ({ id: u.id, name: u.name, email: u.email }));

  // Metrics averages — composite key section::label to avoid collisions
  const allMetrics = {};
  allReports.forEach(r => {
    (r.sections || []).filter(s => s && s.type).forEach(s => {
      if (s.type === 'metrics' && Array.isArray(s.items)) {
        s.items.forEach(item => {
          if (item.label && item.value !== undefined && item.value !== '' && !isNaN(parseFloat(item.value))) {
            const key = `${s.title || 'Metrics'}::${item.label}`;
            if (!allMetrics[key]) allMetrics[key] = { values: [], section: s.title || 'Metrics', label: item.label, unit: item.unit || '' };
            allMetrics[key].values.push(parseFloat(item.value));
          }
        });
      }
    });
  });

  const metricsAverages = {};
  Object.keys(allMetrics).forEach(key => {
    const { values, section, label, unit } = allMetrics[key];
    const sum = values.reduce((a, b) => a + b, 0);
    metricsAverages[key] = {
      label,
      section,
      unit,
      avg: +(sum / values.length).toFixed(2),
      count: values.length,
      min: Math.min(...values),
      max: Math.max(...values),
      total: +sum.toFixed(2)
    };
  });

  res.json({
    totalReports: allReports.length,
    totalUsers: users.length,
    thisWeekCount: thisWeekReports.length,
    submissionRate,
    lateUsers,
    byWeek,
    byUser,
    metricsAverages
  });
});

// ── Heatmap ───────────────────────────────────────────────────────────────────
app.get('/api/admin/heatmap', requireAdmin, (req, res) => {
  try {
    const employees = db.get('users').filter({ role: 'employee' }).value();
    const reports = db.get('reports').filter(r => r.status === 'submitted' && !r.seeded).value();
    const dbTeams = db.get('teams').value() || [];

    const teamGroups = {};

    if (dbTeams.length) {
      // Use actual teams from DB
      dbTeams.forEach(team => {
        const members = employees.filter(u => u.team_id === team.id);
        if (members.length) teamGroups[team.name] = members;
      });
      // Include employees not assigned to any team
      const groupedIds = new Set(Object.values(teamGroups).flat().map(u => u.id));
      const ungrouped = employees.filter(u => !groupedIds.has(u.id));
      if (ungrouped.length) teamGroups['بدون فريق'] = ungrouped;
    } else {
      // Fallback: group by template_id then report_template
      const templates = db.get('templates').value() || [];
      employees.forEach(u => {
        let teamName = 'بدون فريق';
        if (u.template_id) {
          const t = templates.find(t => t.id === u.template_id);
          if (t) teamName = t.name;
        } else if (u.report_template) {
          teamName = u.report_template.replace('.html', '').replace(/^report-/, '');
        }
        if (!teamGroups[teamName]) teamGroups[teamName] = [];
        teamGroups[teamName].push(u);
      });
    }

    const now = new Date();
    const year = now.getFullYear();
    const start = new Date(year, 0, 1);
    const currentWeekNum = Math.ceil(((now - start) / 86400000 + start.getDay() + 1) / 7);

    const weeks = [];
    for (let i = 11; i >= 0; i--) {
      const wn = currentWeekNum - i;
      if (wn < 1) continue;
      weeks.push({ num: wn, label: `أسبوع ${wn}`, week_string: `الأسبوع ${wn} - ${year}` });
    }

    const grid = Object.entries(teamGroups).map(([teamName, users]) => {
      const cells = weeks.map(w => {
        const submittedCount = users.filter(u =>
          reports.some(r => r.user_id === u.id && r.week === w.week_string)
        ).length;
        const rate = users.length ? Math.round((submittedCount / users.length) * 100) : 0;
        return { week: w.num, rate, submitted: submittedCount, total: users.length };
      });
      return { team: teamName, cells };
    });

    res.json({ weeks, grid });
  } catch (e) {
    console.error('heatmap error:', e);
    res.json({ weeks: [], grid: [] });
  }
});

// ── AI Alerts (Add 6) ─────────────────────────────────────────────────────────
app.get('/api/admin/alerts', requireAdmin, (req, res) => {
  const alerts = [];
  const employees = db.get('users').filter({ role: 'employee' }).value();
  const reports = db.get('reports').filter(r => r.status === 'submitted' && !r.seeded).value();

  const now = new Date();
  const fourWeeksAgo = new Date(now.getTime() - 28 * 86400000).toISOString();
  const oneWeekAgo   = new Date(now.getTime() -  7 * 86400000).toISOString();
  const twoWeeksAgo  = new Date(now.getTime() - 14 * 86400000).toISOString();

  // 1. موظفون لم يرفعوا أي تقرير في آخر أسبوعين
  const lastTwoWeeks = reports.filter(r => r.submitted_at > twoWeeksAgo);
  const submittedRecently = new Set(lastTwoWeeks.map(r => r.user_id));
  const inactive = employees.filter(u => !submittedRecently.has(u.id));
  if (inactive.length > 0) {
    alerts.push({
      severity: 'danger',
      icon: '⚠️',
      title: `${inactive.length} موظف لم يسلم تقرير منذ أسبوعين`,
      desc: inactive.slice(0, 5).map(u => u.name).join('، ') + (inactive.length > 5 ? '، وآخرون' : '')
    });
  }

  // 2. انخفاض في إجمالي عدد التقارير الأسبوع الماضي
  const lastWeekCount = reports.filter(r => r.submitted_at > oneWeekAgo).length;
  const prev3WeeksAvg = reports.filter(r => r.submitted_at > fourWeeksAgo && r.submitted_at <= oneWeekAgo).length / 3;
  if (prev3WeeksAvg > 0 && lastWeekCount < prev3WeeksAvg * 0.6) {
    alerts.push({
      severity: 'warning',
      icon: '📉',
      title: 'انخفاض حاد في عدد التقارير هذا الأسبوع',
      desc: `هذا الأسبوع ${lastWeekCount} تقرير، بينما المتوسط ${prev3WeeksAvg.toFixed(1)} تقارير`
    });
  }

  // 3. تقارير معدّلة بشكل متكرر من الأدمن (مؤشر جودة)
  const heavilyEdited = reports.filter(r => (r.versions || []).length >= 3);
  if (heavilyEdited.length > 0) {
    alerts.push({
      severity: 'warning',
      icon: '✏️',
      title: `${heavilyEdited.length} تقرير عُدّل أكثر من 3 مرات`,
      desc: 'قد يحتاج هؤلاء الموظفون توجيهاً إضافياً عن صيغة التقارير'
    });
  }

  // 4. Pattern: التأخير المتكرر للموظف
  const lateMap = {};
  employees.forEach(u => {
    const userReps = reports.filter(r => r.user_id === u.id).length;
    if (userReps >= 4) {
      const expected = 4; // آخر 4 أسابيع
      const recent = reports.filter(r => r.user_id === u.id && r.submitted_at > fourWeeksAgo).length;
      if (recent < expected * 0.5) lateMap[u.name] = recent;
    }
  });
  if (Object.keys(lateMap).length > 0) {
    alerts.push({
      severity: 'info',
      icon: '🔍',
      title: 'Pattern: تأخير متكرر',
      desc: Object.entries(lateMap).slice(0, 3).map(([n, c]) => `${n} (${c}/4)`).join('، ')
    });
  }

  // 5. تعليقات لم تُقرأ بعد
  let unseenComments = 0;
  reports.forEach(r => (r.comments || []).forEach(c => { if (!c.seen) unseenComments++; }));
  if (unseenComments > 0) {
    alerts.push({
      severity: 'info',
      icon: '💬',
      title: `${unseenComments} تعليق لم يُقرأ بعد من الموظفين`,
      desc: 'الموظفون لم يفتحوا تعليقاتك على تقاريرهم'
    });
  }

  if (alerts.length === 0) {
    alerts.push({
      severity: 'info',
      icon: '✅',
      title: 'كل شيء على ما يرام',
      desc: 'لا يوجد تنبيهات تتطلب انتباهك حالياً'
    });
  }

  res.json({ alerts });
});

// ── Team Comparison (Add 8) ───────────────────────────────────────────────────
app.get('/api/admin/teams/compare', requireAdmin, (req, res) => {
  const teamIds = (req.query.teams || '').split(',').filter(Boolean).map(Number);
  if (teamIds.length < 2) return res.status(400).json({ error: 'حدد فريقين على الأقل' });

  const fromDate = req.query.from || null;
  const toDate   = req.query.to   || null;
  const week     = req.query.week || null;

  const allTeams = db.get('teams').value().filter(t => teamIds.includes(t.id));
  const useTemplateMode = !allTeams.length;
  const templates = useTemplateMode
    ? db.get('templates').value().filter(t => teamIds.includes(t.id))
    : [];

  const sources = useTemplateMode
    ? templates.map(t => ({
        id: t.id,
        name: t.name,
        member_ids: db.get('users').filter({ role: 'employee', template_id: t.id }).value().map(u => u.id)
      }))
    : allTeams.map(t => ({ id: t.id, name: t.name, member_ids: t.member_ids || [] }));

  const reports = db.get('reports').filter(r => r.status === 'submitted' && !r.seeded).value();

  const result = sources.map(team => {
    let teamReports = reports.filter(r => team.member_ids.includes(r.user_id));
    if (fromDate) teamReports = teamReports.filter(r => r.submitted_at >= fromDate);
    if (toDate)   teamReports = teamReports.filter(r => r.submitted_at <= toDate);
    if (week)     teamReports = teamReports.filter(r => r.week === week);

    let yesCount = 0, totalQ = 0, greenCount = 0, totalT = 0;
    const allMetrics = {};

    teamReports.forEach(r => {
      (r.sections || []).forEach(s => {
        if (s.type === 'scorecard') {
          (s.items || []).forEach(it => {
            if (it.mode === 'yesno' && it.value) { totalQ++; if (it.value === 'yes') yesCount++; }
            if (it.mode === 'traffic' && it.value) { totalT++; if (it.value === 'green') greenCount++; }
          });
        }
        if (s.type === 'metrics') {
          (s.items || []).forEach(it => {
            if (it.label && it.value && !isNaN(parseFloat(it.value))) {
              const key = `${s.title || 'بدون قسم'}::${it.label}`;
              if (!allMetrics[key]) allMetrics[key] = [];
              allMetrics[key].push(parseFloat(it.value));
            }
          });
        }
      });
    });

    const avgMetrics = {};
    Object.entries(allMetrics).forEach(([key, values]) => {
      const [section, label] = key.split('::');
      const avg = values.reduce((a, b) => a + b, 0) / values.length;
      avgMetrics[label] = { value: parseFloat(avg.toFixed(2)), section, count: values.length };
    });

    const submittedUsersInPeriod = new Set(teamReports.map(r => r.user_id));
    const submissionRate = team.member_ids.length
      ? Math.round((submittedUsersInPeriod.size / team.member_ids.length) * 100)
      : 0;

    return {
      id: team.id,
      name: team.name,
      total_members: team.member_ids.length,
      total_reports: teamReports.length,
      submission_rate: submissionRate,
      scorecard_yes_rate: totalQ ? Math.round((yesCount / totalQ) * 100) : 0,
      traffic_green_rate: totalT ? Math.round((greenCount / totalT) * 100) : 0,
      total_comments: teamReports.reduce((s, r) => s + (r.comments || []).length, 0),
      avg_comments: teamReports.length
        ? parseFloat((teamReports.reduce((s, r) => s + (r.comments || []).length, 0) / teamReports.length).toFixed(1))
        : 0,
      avg_metrics: avgMetrics
    };
  });

  res.json({ teams: result, filters: { from: fromDate, to: toDate, week } });
});

app.get('/api/admin/stats/compare', requireAdmin, (req, res) => {
  const { week1, week2, team_id } = req.query;
  if (!week1 || !week2) return res.status(400).json({ error: 'حدد week1 و week2' });

  let baseFilter = (r) => r.status === 'submitted' && !r.seeded && r.week;

  if (team_id) {
    const team = db.get('teams').find({ id: parseInt(team_id) }).value();
    if (team) {
      const memberIds = new Set(team.member_ids || []);
      const original = baseFilter;
      baseFilter = (r) => original(r) && memberIds.has(r.user_id);
    }
  }

  const reports1 = db.get('reports').filter(r => baseFilter(r) && r.week === week1).value();
  const reports2 = db.get('reports').filter(r => baseFilter(r) && r.week === week2).value();

  // استخراج آمن مع section title لتجنب collision
  const extractMetrics = (reports) => {
    const aggregated = {};
    reports.forEach(r => {
      (r.sections || []).forEach(s => {
        if (s.type === 'metrics' && Array.isArray(s.items)) {
          s.items.forEach(item => {
            if (!item.label || !item.value) return;
            const num = parseFloat(item.value);
            if (isNaN(num)) return;
            const key = `${s.title || 'بدون قسم'}::${item.label}`;
            if (!aggregated[key]) aggregated[key] = { sum: 0, count: 0, unit: item.unit || '' };
            aggregated[key].sum += num;
            aggregated[key].count += 1;
          });
        }
      });
    });
    const final = {};
    Object.entries(aggregated).forEach(([key, data]) => {
      final[key] = {
        sum: parseFloat(data.sum.toFixed(2)),
        avg: parseFloat((data.sum / data.count).toFixed(2)),
        count: data.count,
        unit: data.unit
      };
    });
    return final;
  };

  const m1 = extractMetrics(reports1);
  const m2 = extractMetrics(reports2);

  const allKeys = new Set([...Object.keys(m1), ...Object.keys(m2)]);
  const comparison = {};
  allKeys.forEach(k => {
    const [sectionTitle, metricLabel] = k.split('::');
    const v1 = m1[k] || { sum: 0, avg: 0, count: 0, unit: '' };
    const v2 = m2[k] || { sum: 0, avg: 0, count: 0, unit: '' };
    const sumDiff = v2.sum - v1.sum;
    const avgDiff = v2.avg - v1.avg;
    const sumChange = v1.sum ? Math.round((sumDiff / v1.sum) * 100) : (v2.sum ? 100 : 0);
    const avgChange = v1.avg ? Math.round((avgDiff / v1.avg) * 100) : (v2.avg ? 100 : 0);

    comparison[k] = {
      section: sectionTitle,
      label: metricLabel,
      unit: v1.unit || v2.unit,
      week1: { sum: v1.sum, avg: v1.avg, count: v1.count },
      week2: { sum: v2.sum, avg: v2.avg, count: v2.count },
      diff: parseFloat(avgDiff.toFixed(2)),
      change: avgChange,
      sum_diff: parseFloat(sumDiff.toFixed(2)),
      sum_change: sumChange
    };
  });

  res.json({
    week1, week2,
    reports1_count: reports1.length,
    reports2_count: reports2.length,
    comparison,
    team_id: team_id ? parseInt(team_id) : null
  });
});

// ── Teams CRUD (Add 1) ───────────────────────────────────────────────────────
app.get('/api/admin/teams', requireAdmin, (req, res) => {
  const teams = db.get('teams').value().map(t => {
    const leader = db.get('users').find({ id: t.leader_id }).value();
    const members = db.get('users').filter(u => (t.member_ids || []).includes(u.id)).value();
    const template = t.template_id ? db.get('templates').find({ id: t.template_id }).value() : null;
    return {
      ...t,
      leader_name: leader?.name || '—',
      leader_email: leader?.email || '',
      members: members.map(m => ({ id: m.id, name: m.name, email: m.email })),
      template_name: template?.name || '—'
    };
  });
  res.json(teams);
});

app.get('/api/admin/teams/:id', requireAdmin, (req, res) => {
  const id = parseInt(req.params.id);
  const team = db.get('teams').find({ id }).value();
  if (!team) return res.status(404).json({ error: 'الفريق مش موجود' });
  const leader = db.get('users').find({ id: team.leader_id }).value();
  const members = db.get('users').filter(u => (team.member_ids || []).includes(u.id)).value();
  const template = team.template_id ? db.get('templates').find({ id: team.template_id }).value() : null;
  res.json({ ...team, leader, members, template });
});

app.post('/api/admin/teams', requireAdmin, (req, res) => {
  const { name, description, leader_id, member_ids, template_id } = req.body;
  if (!name || !leader_id) return res.status(400).json({ error: 'الاسم و القائد مطلوبين' });

  // اضمن إن leader في الـ members
  let mids = (member_ids || []).map(Number);
  const lid = parseInt(leader_id);
  if (!mids.includes(lid)) mids.push(lid);

  const team = {
    id: nextId('teams'),
    name,
    description: description || '',
    leader_id: lid,
    member_ids: mids,
    template_id: template_id ? parseInt(template_id) : null,
    created_at: new Date().toISOString()
  };
  db.get('teams').push(team).write();

  // شيل team_id من أي مستخدمين كانوا في فرق أخرى مع هذه الـ ids ثم اضبط
  db.get('users').find({ id: team.leader_id }).assign({ is_team_leader: true, team_id: team.id }).write();
  team.member_ids.forEach(mid => {
    db.get('users').find({ id: mid }).assign({ team_id: team.id }).write();
  });

  res.json({ success: true, team });
});

app.put('/api/admin/teams/:id', requireAdmin, (req, res) => {
  const id = parseInt(req.params.id);
  const team = db.get('teams').find({ id }).value();
  if (!team) return res.status(404).json({ error: 'مش موجود' });

  const { name, description, leader_id, member_ids, template_id } = req.body;

  // قبل ما نعمل update، شيل team_id من الأعضاء القدام و is_team_leader من القائد القديم
  (team.member_ids || []).forEach(mid => {
    db.get('users').find({ id: mid }).assign({ team_id: null }).write();
  });
  if (team.leader_id) {
    db.get('users').find({ id: team.leader_id }).assign({ is_team_leader: false }).write();
  }

  let mids = member_ids ? member_ids.map(Number) : team.member_ids;
  const lid = leader_id ? parseInt(leader_id) : team.leader_id;
  if (lid && !mids.includes(lid)) mids.push(lid);

  const updated = {
    name: name || team.name,
    description: description !== undefined ? description : team.description,
    leader_id: lid,
    member_ids: mids,
    template_id: template_id !== undefined ? (template_id ? parseInt(template_id) : null) : team.template_id
  };
  db.get('teams').find({ id }).assign(updated).write();

  if (updated.leader_id) db.get('users').find({ id: updated.leader_id }).assign({ is_team_leader: true, team_id: id }).write();
  updated.member_ids.forEach(mid => {
    db.get('users').find({ id: mid }).assign({ team_id: id }).write();
  });

  res.json({ success: true });
});

app.delete('/api/admin/teams/:id', requireAdmin, (req, res) => {
  const id = parseInt(req.params.id);
  const team = db.get('teams').find({ id }).value();
  if (team) {
    if (team.leader_id) db.get('users').find({ id: team.leader_id }).assign({ is_team_leader: false, team_id: null }).write();
    (team.member_ids || []).forEach(mid => db.get('users').find({ id: mid }).assign({ team_id: null }).write());
    db.get('teams').remove({ id }).write();
  }
  res.json({ success: true });
});

// ── Team Leader APIs (Add 2) ─────────────────────────────────────────────────
app.get('/api/leader/team-reports', requireLogin, (req, res) => {
  const userId = req.session.user.id;
  const team = db.get('teams').find({ leader_id: userId }).value();
  if (!team) return res.status(403).json({ error: 'مش قائد فريق' });

  const memberIds = team.member_ids || [];
  const memberReports = db.get('reports')
    .filter(r => memberIds.includes(r.user_id) && r.status === 'submitted' && !r.seeded)
    .value()
    .map(r => {
      const u = db.get('users').find({ id: r.user_id }).value();
      return {
        id: r.id, title: r.title, week: r.week, filename: r.filename,
        submitted_at: r.submitted_at, user_id: r.user_id,
        user_name: u?.name, user_email: u?.email,
        comments_count: (r.comments || []).length
      };
    })
    .sort((a, b) => (b.submitted_at || '').localeCompare(a.submitted_at || ''));

  const members = db.get('users').filter(u => memberIds.includes(u.id)).value()
    .map(u => ({ id: u.id, name: u.name, email: u.email }));

  res.json({
    team: { ...team, members },
    reports: memberReports
  });
});

app.post('/api/leader/submit-merged/:id', requireLogin, (req, res) => {
  const id = parseInt(req.params.id);
  const userId = req.session.user.id;
  const { include_member_ids, title, week, content, sections } = req.body;

  const team = db.get('teams').find({ leader_id: userId }).value();
  if (!team) return res.status(403).json({ error: 'مش قائد فريق' });

  const report = db.get('reports').find({ id, user_id: userId }).value();
  if (!report) return res.status(404).json({ error: 'التقرير مش موجود' });

  // Snapshot الـ child reports وقت الإرسال
  const childIds = (include_member_ids || team.member_ids || []).filter(mid => mid !== userId);
  const childReports = [];
  childIds.forEach(mid => {
    const memberReport = db.get('reports')
      .filter(r => r.user_id === mid && r.status === 'submitted' && !r.seeded)
      .value()
      .sort((a, b) => (b.submitted_at || '').localeCompare(a.submitted_at || ''))[0];

    if (memberReport) {
      childReports.push({
        report_id: memberReport.id,
        user_id: mid,
        user_name: db.get('users').find({ id: mid }).value()?.name || '—',
        title: memberReport.title,
        week: memberReport.week,
        submitted_at: memberReport.submitted_at,
        sections_snapshot: JSON.parse(JSON.stringify(memberReport.sections || []))
      });
    }
  });

  // كتابة المحتوى لو متاح
  if (content) {
    const dir = path.join(__dirname, '../public/reports/submitted');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, report.filename), content, 'utf8');
  }

  const mergedUpdate = {
    status: 'submitted',
    submitted_at: new Date().toISOString(),
    title: title || report.title,
    week: week || report.week,
    is_team_report: true,
    team_id: team.id,
    child_reports: childReports
  };
  if (Array.isArray(sections)) mergedUpdate.sections = sections;
  db.get('reports').find({ id }).assign(mergedUpdate).write();

  addNotif(userId, `${req.session.user.name} (قائد ${team.name}) أرسل تقرير مدمج: ${title || report.title}`);

  res.json({ success: true, child_count: childReports.length });
});

// ── Leader Comparison APIs (scoped to leader's team) ──────────────────────────
function requireLeaderWithCompare(req, res, next) {
  if (!req.session.user) return res.status(401).json({ error: 'غير مسجل دخول' });
  const user = db.get('users').find({ id: req.session.user.id }).value();
  if (!user) return res.status(401).json({ error: 'مستخدم غير موجود' });
  if (!user.is_team_leader) return res.status(403).json({ error: 'مش قائد فريق' });
  if (!user.can_compare_team) return res.status(403).json({ error: 'لا تملك صلاحية المقارنة' });
  const team = db.get('teams').find({ leader_id: user.id }).value();
  if (!team) return res.status(403).json({ error: 'لا يوجد فريق مرتبط' });
  req.leaderTeam = team;
  req.leaderUser = user;
  next();
}

// أسابيع متاحة لفريق القائد
app.get('/api/leader/available-weeks', requireLeaderWithCompare, (req, res) => {
  const memberIds = req.leaderTeam.member_ids || [];
  const weeks = new Set();
  db.get('reports')
    .filter(r => memberIds.includes(r.user_id) && r.status === 'submitted' && !r.seeded)
    .value()
    .forEach(r => r.week && weeks.add(r.week));
  res.json({ weeks: Array.from(weeks).sort().reverse() });
});

// مقارنة أعضاء الفريق فى أسبوع/مدى تواريخ معين (بالـ metrics)
app.get('/api/leader/compare/members', requireLeaderWithCompare, (req, res) => {
  const { week, from, to } = req.query;
  const memberIds = req.leaderTeam.member_ids || [];
  const allUsers = db.get('users').value();

  let filtered = db.get('reports')
    .filter(r => memberIds.includes(r.user_id) && r.status === 'submitted' && !r.seeded)
    .value();

  if (week)  filtered = filtered.filter(r => r.week === week);
  if (from)  filtered = filtered.filter(r => r.submitted_at >= from);
  if (to)    filtered = filtered.filter(r => r.submitted_at <= to);

  // اجمع حسب الموظف
  const byMember = {};
  memberIds.forEach(mid => {
    const u = allUsers.find(x => x.id === mid);
    byMember[mid] = {
      user_id: mid,
      name: u?.name || '—',
      email: u?.email || '—',
      reports_count: 0,
      metrics: {},      // key = section::label → { values: [], unit }
      scorecard_yes: 0,
      scorecard_total: 0,
      traffic_green: 0,
      traffic_total: 0,
      checklist_done: 0,
      checklist_total: 0
    };
  });

  filtered.forEach(r => {
    const m = byMember[r.user_id];
    if (!m) return;
    m.reports_count++;
    (r.sections || []).filter(s => s && s.type).forEach(s => {
      if (s.type === 'metrics' && Array.isArray(s.items)) {
        s.items.forEach(item => {
          if (item.label && item.value !== undefined && item.value !== '' && !isNaN(parseFloat(item.value))) {
            const key = `${s.title || 'Metrics'}::${item.label}`;
            if (!m.metrics[key]) m.metrics[key] = { values: [], unit: item.unit || '', section: s.title || 'Metrics', label: item.label };
            m.metrics[key].values.push(parseFloat(item.value));
          }
        });
      } else if (s.type === 'scorecard' && Array.isArray(s.items)) {
        s.items.forEach(item => {
          m.scorecard_total++;
          if (item.answer === 'yes' || item.value === 'yes' || item.checked === true) m.scorecard_yes++;
        });
      } else if (s.type === 'status') {
        m.traffic_total++;
        if (s.value === 'green' || s.status === 'green') m.traffic_green++;
      } else if (s.type === 'checklist' && Array.isArray(s.items)) {
        s.items.forEach(item => {
          m.checklist_total++;
          if (item.checked) m.checklist_done++;
        });
      }
    });
  });

  // حوّل الـ metrics لأرقام
  const members = Object.values(byMember).map(m => {
    const avgMetrics = {};
    Object.entries(m.metrics).forEach(([k, v]) => {
      const sum = v.values.reduce((a, b) => a + b, 0);
      avgMetrics[k] = {
        section: v.section, label: v.label, unit: v.unit,
        avg: +(sum / v.values.length).toFixed(2),
        sum: +sum.toFixed(2),
        count: v.values.length
      };
    });
    return {
      user_id: m.user_id,
      name: m.name,
      email: m.email,
      reports_count: m.reports_count,
      scorecard_rate: m.scorecard_total ? Math.round((m.scorecard_yes / m.scorecard_total) * 100) : 0,
      traffic_green_rate: m.traffic_total ? Math.round((m.traffic_green / m.traffic_total) * 100) : 0,
      checklist_rate: m.checklist_total ? Math.round((m.checklist_done / m.checklist_total) * 100) : 0,
      metrics: avgMetrics
    };
  });

  res.json({
    team: { id: req.leaderTeam.id, name: req.leaderTeam.name },
    filters: { week: week || null, from: from || null, to: to || null },
    members
  });
});

// مقارنة بين أسبوعين لنفس الفريق (aggregate)
app.get('/api/leader/compare/weeks', requireLeaderWithCompare, (req, res) => {
  const { week1, week2 } = req.query;
  if (!week1 || !week2) return res.status(400).json({ error: 'اختر أسبوعين' });
  const memberIds = req.leaderTeam.member_ids || [];

  const all = db.get('reports')
    .filter(r => memberIds.includes(r.user_id) && r.status === 'submitted' && !r.seeded)
    .value();
  const w1 = all.filter(r => r.week === week1);
  const w2 = all.filter(r => r.week === week2);

  function collect(reports) {
    const metrics = {}; // key → values[]
    reports.forEach(r => {
      (r.sections || []).filter(s => s && s.type === 'metrics' && Array.isArray(s.items)).forEach(s => {
        s.items.forEach(item => {
          if (item.label && item.value !== undefined && item.value !== '' && !isNaN(parseFloat(item.value))) {
            const key = `${s.title || 'Metrics'}::${item.label}`;
            if (!metrics[key]) metrics[key] = { values: [], section: s.title || 'Metrics', label: item.label, unit: item.unit || '' };
            metrics[key].values.push(parseFloat(item.value));
          }
        });
      });
    });
    return metrics;
  }

  const m1 = collect(w1);
  const m2 = collect(w2);
  const allKeys = new Set([...Object.keys(m1), ...Object.keys(m2)]);

  const comparison = {};
  allKeys.forEach(key => {
    const a = m1[key], b = m2[key];
    const v1 = a ? +(a.values.reduce((x, y) => x + y, 0) / a.values.length).toFixed(2) : 0;
    const v2 = b ? +(b.values.reduce((x, y) => x + y, 0) / b.values.length).toFixed(2) : 0;
    const diff = +(v2 - v1).toFixed(2);
    const change = v1 !== 0 ? +(((v2 - v1) / v1) * 100).toFixed(1) : 0;
    const ref = a || b;
    comparison[key] = {
      section: ref.section, label: ref.label, unit: ref.unit,
      week1: { avg: v1, count: a ? a.values.length : 0 },
      week2: { avg: v2, count: b ? b.values.length : 0 },
      diff, change
    };
  });

  res.json({
    team: { id: req.leaderTeam.id, name: req.leaderTeam.name },
    week1, week2,
    reports1_count: w1.length,
    reports2_count: w2.length,
    comparison
  });
});

// أسابيع متاحة للفلترة
app.get('/api/admin/available-weeks', requireAdmin, (req, res) => {
  const weeks = new Set();
  db.get('reports').filter(r => r.status === 'submitted' && !r.seeded).value()
    .forEach(r => r.week && weeks.add(r.week));
  res.json({ weeks: Array.from(weeks).sort().reverse() });
});

// ── Admin Dashboard APIs (Imp 3, 7) ───────────────────────────────────────────
app.get('/api/admin/activities', requireAdmin, (req, res) => {
  const reports = db.get('reports').filter(r => !r.seeded).value()
    .sort((a, b) => (b.submitted_at || '').localeCompare(a.submitted_at || ''))
    .slice(0, 12);

  const palette = ['#FFE4D6', '#dcfce7', '#fef3c7', '#fee2e2', '#e0e7ff', '#fce7f3', '#cffafe'];
  const colorMap = {};
  let cIdx = 0;

  const activities = reports.map(r => {
    const u = db.get('users').find({ id: r.user_id }).value();
    if (!colorMap[u?.id]) colorMap[u?.id] = palette[cIdx++ % palette.length];
    const teamRaw = u?.report_template?.replace('.html','').replace('report-','') || '';
    return {
      report_id: r.id,
      user_id: u?.id,
      user_name: u?.name || '—',
      team: teamRaw,
      initial: (u?.name || '؟').charAt(0),
      color: colorMap[u?.id] || '#FFE4D6',
      message: r.status === 'submitted'
        ? (r.edited_by_admin ? `عُدّل التقرير: ${r.title}` : `أرسل تقرير: ${r.title}`)
        : `حفظ مسودة: ${r.title}`,
      timestamp: r.last_edited_at || r.submitted_at,
      statusColor: r.status === 'submitted' ? '#16a34a' : '#d97706'
    };
  });

  res.json(activities);
});

app.get('/api/admin/team-progress', requireAdmin, (req, res) => {
  const oneWeekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
  const employees = db.get('users').filter({ role: 'employee' }).value();
  const dbTeams = db.get('teams').value() || [];

  const recent = db.get('reports')
    .filter(r => r.submitted_at > oneWeekAgo && r.status === 'submitted' && !r.seeded)
    .value();
  const submittedIds = new Set(recent.map(r => r.user_id));

  let teams = [];

  if (dbTeams.length) {
    // Use actual teams from DB — counted by team membership
    teams = dbTeams.map(team => {
      const members = employees.filter(u => u.team_id === team.id);
      const submitted = members.filter(u => submittedIds.has(u.id)).length;
      const rate = members.length ? Math.round((submitted / members.length) * 100) : 0;
      const leader = team.leader_id ? employees.find(u => u.id === team.leader_id) : null;
      return {
        id: team.id,
        name: team.name,
        leader_name: leader?.name || null,
        total: members.length,
        submitted,
        rate
      };
    }).filter(t => t.total > 0);

    // Ungrouped employees as a synthetic row
    const groupedIds = new Set();
    dbTeams.forEach(team => employees.filter(u => u.team_id === team.id).forEach(u => groupedIds.add(u.id)));
    const ungrouped = employees.filter(u => !groupedIds.has(u.id));
    if (ungrouped.length) {
      const submitted = ungrouped.filter(u => submittedIds.has(u.id)).length;
      teams.push({
        id: null,
        name: 'بدون فريق',
        leader_name: null,
        total: ungrouped.length,
        submitted,
        rate: Math.round((submitted / ungrouped.length) * 100)
      });
    }
  } else {
    // Fallback: group by template_id
    const templates = db.get('templates').value() || [];
    const teamGroups = {};
    employees.forEach(u => {
      let teamName = 'بدون فريق';
      if (u.template_id) {
        const t = templates.find(t => t.id === u.template_id);
        if (t) teamName = t.name;
      } else if (u.report_template) {
        teamName = u.report_template.replace('.html','').replace(/^report-/, '');
      }
      if (!teamGroups[teamName]) teamGroups[teamName] = [];
      teamGroups[teamName].push(u);
    });
    teams = Object.entries(teamGroups).map(([name, users]) => {
      const submitted = users.filter(u => submittedIds.has(u.id)).length;
      const rate = users.length ? Math.round((submitted / users.length) * 100) : 0;
      return { id: null, name, leader_name: null, total: users.length, submitted, rate };
    });
  }

  teams.sort((a, b) => a.rate - b.rate);
  res.json({ teams });
});

// ── Helpers for report comparison ─────────────────────────────────────────────
function extractMetricsFromReport(report) {
  const m = {};
  const collectFromSections = (secs) => {
    (secs || []).forEach(s => {
      if (s && s.type === 'metrics' && Array.isArray(s.items)) {
        s.items.forEach(it => {
          if (it.value && !isNaN(parseFloat(it.value)) && it.label) {
            const key = `${s.title || 'Metrics'}::${it.label}`;
            m[key] = (m[key] || 0) + parseFloat(it.value);
          }
        });
      }
    });
  };
  // Both top-level sections AND project sections (sum across projects)
  collectFromSections(report.sections);
  if (Array.isArray(report.projects)) {
    report.projects.forEach(p => collectFromSections(p.sections));
  }
  return m;
}

function buildComparison(report, prevReport) {
  if (!prevReport) return {};
  const cur = extractMetricsFromReport(report);
  const prv = extractMetricsFromReport(prevReport);
  const comparison = {};
  Object.keys(cur).forEach(k => {
    const c = cur[k];
    const p = prv[k] || 0;
    const label = k.includes('::') ? k.split('::')[1] : k;
    comparison[label] = {
      current: c, previous: p, diff: +(c - p).toFixed(2),
      trend: c > p ? 'up' : c < p ? 'down' : 'same',
      change: p ? Math.round(((c - p) / p) * 100) : 0
    };
  });
  return comparison;
}

function getUserPreviousReports(userId, currentReportId, limit = 6) {
  return db.get('reports')
    .filter(r => r.user_id === userId && r.status === 'submitted' && !r.seeded && r.id !== currentReportId)
    .value()
    .sort((a, b) => (b.submitted_at || '').localeCompare(a.submitted_at || ''))
    .slice(0, limit)
    .map(r => ({
      id: r.id,
      title: r.title,
      week: r.week,
      submitted_at: r.submitted_at,
      edited_by_admin: !!r.edited_by_admin,
      comments_count: (r.comments || []).length
    }));
}

// ── Report View Full Data (Imp 4) ─────────────────────────────────────────────
app.get('/admin/report/:id', requireAdmin, (req, res) => {
  res.sendFile(path.join(__dirname, '../views/report-view.html'));
});

// Employee-facing report viewer (read-only). Same UI, ownership-checked.
app.get('/employee/report/:id', requireLogin, (req, res) => {
  const id = parseInt(req.params.id);
  const report = db.get('reports').find({ id }).value();
  if (!report) return res.status(404).send('التقرير مش موجود');
  // Employees can only view their own reports; admins can view any
  if (req.session.user.role !== 'admin' && report.user_id !== req.session.user.id) {
    return res.status(403).send('مش مسموحلك تشوف هذا التقرير');
  }
  res.sendFile(path.join(__dirname, '../views/report-view.html'));
});

// Employee-accessible full data endpoint — same payload but ownership-checked
app.get('/api/employee/reports/:id/full', requireLogin, (req, res) => {
  const id = parseInt(req.params.id);
  const report = db.get('reports').find({ id }).value();
  if (!report) return res.status(404).json({ error: 'مش موجود' });
  if (req.session.user.role !== 'admin' && report.user_id !== req.session.user.id) {
    return res.status(403).json({ error: 'غير مسموح' });
  }
  // Mark all admin comments as seen by the employee
  if (Array.isArray(report.comments)) {
    let updated = false;
    report.comments.forEach(c => { if (!c.seen) { c.seen = true; updated = true; } });
    if (updated) db.get('reports').find({ id }).assign({ comments: report.comments }).write();
  }
  // Reuse the same logic as admin /full endpoint
  const user = db.get('users').find({ id: report.user_id }).value();
  const template = user?.template_id ? db.get('templates').find({ id: user.template_id }).value() : null;
  let sections = report.sections || [];
  if ((!sections || !sections.length) && report.filename) {
    try {
      const fp = path.join(__dirname, '../public/reports/submitted', report.filename);
      if (fs.existsSync(fp)) {
        const html = fs.readFileSync(fp, 'utf8');
        const m = html.match(/<script type="application\/json" id="__rpt__">([\s\S]*?)<\/script>/);
        if (m) sections = JSON.parse(m[1]);
      }
    } catch (e) {}
  }
  // Find previous report for this user (for comparison and links)
  const prevReports = db.get('reports')
    .filter(r => r.user_id === report.user_id && r.status === 'submitted' && !r.seeded && r.id !== id)
    .value()
    .sort((a, b) => (b.submitted_at || '').localeCompare(a.submitted_at || ''));
  const prev = prevReports[0];
  const comparison = buildComparison({ ...report, sections }, prev || null);

  res.json({
    report: { ...report, sections },
    user: user ? { id: user.id, name: user.name, email: user.email } : null,
    template: template ? { id: template.id, name: template.name, visual_theme: template.visual_theme } : null,
    comparison,
    previousReportId: prev?.id || null,
    previousReportTitle: prev?.title || null,
    previousReportWeek: prev?.week || null,
    previousReports: getUserPreviousReports(report.user_id, id, 6),
    versionsCount: (report.versions || []).length,
    commentsCount: (report.comments || []).length,
    is_team_report: !!report.is_team_report,
    child_reports: [],
    viewer_role: req.session.user.role
  });
});

app.get('/api/admin/reports/:id/full', requireAdmin, (req, res) => {
  const id = parseInt(req.params.id);
  const report = db.get('reports').find({ id }).value();
  if (!report) return res.status(404).json({ error: 'مش موجود' });

  const user = db.get('users').find({ id: report.user_id }).value();
  const template = user?.template_id ? db.get('templates').find({ id: user.template_id }).value() : null;

  // جلب sections من الـ DB أو من ملف HTML المرفوع
  let sections = report.sections || [];
  if ((!sections || !sections.length) && report.filename) {
    try {
      const fp = path.join(__dirname, '../public/reports/submitted', report.filename);
      if (fs.existsSync(fp)) {
        const html = fs.readFileSync(fp, 'utf8');
        const m = html.match(/<script type="application\/json" id="__rpt__">([\s\S]*?)<\/script>/);
        if (m) sections = JSON.parse(m[1]);
      }
    } catch (e) { /* ignore */ }
  }

  // المقارنة مع التقرير السابق — uses unified helpers (handles multi-project too)
  const prevReports = db.get('reports')
    .filter(r => r.user_id === user?.id && r.status === 'submitted' && !r.seeded && r.id !== id)
    .value()
    .sort((a, b) => (b.submitted_at || '').localeCompare(a.submitted_at || ''));
  const prev = prevReports[0];
  const comparison = buildComparison({ ...report, sections }, prev || null);

  res.json({
    report: { ...report, sections },
    user: user ? { id: user.id, name: user.name, email: user.email } : null,
    template: template ? { id: template.id, name: template.name, visual_theme: template.visual_theme } : null,
    comparison,
    previousReportId: prev?.id || null,
    previousReportTitle: prev?.title || null,
    previousReportWeek: prev?.week || null,
    previousReports: user ? getUserPreviousReports(user.id, id, 6) : [],
    versionsCount: (report.versions || []).length,
    commentsCount: (report.comments || []).length,
    is_team_report: !!report.is_team_report,
    child_reports: report.is_team_report
      ? (report.child_reports || []).map(c => {
          // Resolve full sections من الـ DB حالياً (لو متاح)، بـ fallback لـ snapshot
          const live = db.get('reports').find({ id: c.report_id }).value();
          return {
            ...c,
            full_sections: live?.sections || c.sections_snapshot || []
          };
        })
      : [],
    viewer_role: 'admin'
  });
});

// ── Global Search (Imp 8) ─────────────────────────────────────────────────────
app.get('/api/admin/search', requireAdmin, (req, res) => {
  const q = (req.query.q || '').toLowerCase().trim();
  if (q.length < 2) return res.json({ users: [], reports: [], comments: [] });

  const users = db.get('users').filter({ role: 'employee' }).value()
    .filter(u =>
      (u.name || '').toLowerCase().includes(q) ||
      (u.email || '').toLowerCase().includes(q)
    )
    .map(u => ({ id: u.id, name: u.name, email: u.email, template_id: u.template_id || null }))
    .slice(0, 6);

  const reports = db.get('reports')
    .filter(r => !r.seeded && (
      (r.title || '').toLowerCase().includes(q) ||
      (r.week  || '').toLowerCase().includes(q) ||
      JSON.stringify(r.sections || []).toLowerCase().includes(q)
    ))
    .value()
    .map(r => {
      const u = db.get('users').find({ id: r.user_id }).value();
      return {
        id: r.id, title: r.title, week: r.week,
        user_name: u?.name || '—',
        edited_by_admin: !!r.edited_by_admin
      };
    })
    .slice(0, 6);

  const comments = [];
  db.get('reports').value().forEach(r => {
    (r.comments || []).forEach(c => {
      if ((c.text || '').toLowerCase().includes(q)) {
        comments.push({
          id: c.id,
          text: c.text,
          by: c.by,
          report_id: r.id,
          report_title: r.title,
          created_at: c.created_at
        });
      }
    });
  });

  res.json({
    users,
    reports,
    comments: comments.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || '')).slice(0, 6)
  });
});

app.get('/api/admin/notifications', requireAdmin, (req, res) => {
  const notifs = db.get('notifications').value()
    .map(n => { const u = db.get('users').find({ id: n.user_id }).value(); return { ...n, user_name: u?.name || '—' }; })
    .sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 30);
  res.json(notifs);
});

app.post('/api/admin/notifications/read', requireAdmin, (req, res) => {
  db.get('notifications').each(n => { n.read = true; }).write();
  res.json({ success: true });
});

app.get('/api/admin/report-link/:userId', requireAdmin, (req, res) => {
  const user = db.get('users').find({ id: parseInt(req.params.userId) }).value();
  if (!user) return res.status(404).json({ error: 'مش لاقي المستخدم' });
  res.json({ link: `${req.protocol}://${req.get('host')}/employee`, user: user.name, email: user.email });
});

// ── Employee ──────────────────────────────────────────────────────────────────
app.get('/employee', requireLogin, (req, res) => res.sendFile(path.join(__dirname, '../views/employee.html')));
app.get('/employee/new', requireLogin, (req, res) => res.sendFile(path.join(__dirname, '../views/employee-new.html')));

app.get('/api/employee/me', requireLogin, (req, res) => {
  const user = db.get('users').find({ id: req.session.user.id }).value();
  const allReports = db.get('reports').filter({ user_id: user.id }).value()
    .sort((a, b) => (b.updated_at || b.submitted_at).localeCompare(a.updated_at || a.submitted_at));

  const drafts    = allReports.filter(r => r.status === 'draft');
  const submitted = allReports.filter(r => r.status === 'submitted')
    .map(r => ({
      ...r,
      edited_by_admin: !!r.edited_by_admin,
      comments: r.comments || []
    }));

  res.json({
    user: {
      id: user.id, name: user.name, email: user.email,
      report_template: user.report_template,
      template_id: user.template_id || null,
      can_edit_template: !!user.can_edit_template
    },
    reports: submitted,
    drafts
  });
});

// ── Employee Dashboard APIs (Imp 1, 5, 9) ─────────────────────────────────────
app.get('/api/employee/streak', requireLogin, (req, res) => {
  const userId = req.session.user.id;
  const reports = db.get('reports')
    .filter(r => r.user_id === userId && r.status === 'submitted' && !r.seeded)
    .value();

  const submittedWeeks = new Set(reports.map(r => r.week));
  const now = new Date();
  const year = now.getFullYear();
  const start = new Date(year, 0, 1);
  const currentWeekNum = Math.ceil(((now - start) / 86400000 + start.getDay() + 1) / 7);

  let streak = 0;
  for (let i = 0; i < 52; i++) {
    const wn = currentWeekNum - i;
    if (wn < 1) break;
    const label = `الأسبوع ${wn} - ${year}`;
    if (submittedWeeks.has(label)) streak++;
    else if (i > 0) break; // الأسبوع الحالي ممكن لسه ما اتعملش
  }

  // مجموع كل التقارير وهل الأسبوع الحالي اتسلم
  const currentWeekLabel = `الأسبوع ${currentWeekNum} - ${year}`;
  const submittedThisWeek = submittedWeeks.has(currentWeekLabel);

  // معدل التسليم لكل الأسابيع منذ أول تقرير
  const firstReport = reports.sort((a, b) => a.submitted_at.localeCompare(b.submitted_at))[0];
  let submissionRate = 100;
  if (firstReport) {
    const firstDate = new Date(firstReport.submitted_at);
    const weeksSinceFirst = Math.max(1, Math.ceil((now - firstDate) / (7 * 86400000)));
    submissionRate = Math.min(100, Math.round((reports.length / weeksSinceFirst) * 100));
  }

  res.json({
    streak,
    total: reports.length,
    submittedThisWeek,
    currentWeek: currentWeekLabel,
    submissionRate
  });
});

app.get('/api/employee/week-history', requireLogin, (req, res) => {
  const userId = req.session.user.id;
  const reports = db.get('reports')
    .filter(r => r.user_id === userId && r.status === 'submitted' && !r.seeded)
    .value();

  // Group reports by week — could be multiple reports per week
  const submittedMap = new Map();
  reports.forEach(r => {
    if (!submittedMap.has(r.week)) submittedMap.set(r.week, []);
    submittedMap.get(r.week).push(r);
  });

  const now = new Date();
  const year = now.getFullYear();
  const start = new Date(year, 0, 1);
  const currentWeekNum = Math.ceil(((now - start) / 86400000 + start.getDay() + 1) / 7);

  // Determine the display range — include all weeks the user submitted for
  let minWn = currentWeekNum - 7;
  let maxWn = currentWeekNum + 1;
  // Extract week numbers from existing reports' week strings
  reports.forEach(r => {
    const m = (r.week || '').match(/الأسبوع\s+(\d+)\s*-\s*(\d+)/);
    if (m && parseInt(m[2]) === year) {
      const wn = parseInt(m[1]);
      if (wn < minWn) minWn = wn;
      if (wn > maxWn) maxWn = wn;
    }
  });
  if (minWn < 1) minWn = 1;

  const weeks = [];
  for (let wn = minWn; wn <= maxWn; wn++) {
    const label = `الأسبوع ${wn} - ${year}`;
    const list = submittedMap.get(label) || [];
    const found = list[0] || null;
    let status;
    if (list.length > 0) status = 'done';
    else if (wn === currentWeekNum) status = 'current';
    else if (wn > currentWeekNum) status = 'pending';
    else status = 'late';

    weeks.push({
      label: `أسبوع ${wn}`,
      week_string: label,
      status,
      report_id: found?.id || null,
      filename: found?.filename || null,
      reports_count: list.length
    });
  }
  res.json({ weeks });
});

app.get('/api/employee/latest-feedback', requireLogin, (req, res) => {
  const userId = req.session.user.id;
  const reports = db.get('reports').filter({ user_id: userId }).value();

  let latestComment = null;
  let report = null;

  reports.forEach(r => {
    (r.comments || []).forEach(c => {
      if (!c.seen && (!latestComment || c.created_at > latestComment.created_at)) {
        latestComment = c;
        report = r;
      }
    });
  });

  if (!latestComment) return res.json({ feedback: null });

  res.json({
    feedback: {
      ...latestComment,
      report_id: report.id,
      report_title: report.title
    }
  });
});

app.get('/api/employee/template', requireLogin, (req, res) => {
  const user = db.get('users').find({ id: req.session.user.id }).value();
  if (!user.template_id) return res.json({ template: null, can_edit: !!user.can_edit_template });
  const template = db.get('templates').find({ id: user.template_id }).value();
  res.json({ template: template || null, can_edit: !!user.can_edit_template });
});

app.post('/api/employee/draft', requireLogin, (req, res) => {
  const { title, week, content, draft_id, sections, projects } = req.body;
  const userId = req.session.user.id;

  if (!content) return res.status(400).json({ error: 'المحتوى فاضي' });

  if (draft_id) {
    const existing = db.get('reports').find({ id: parseInt(draft_id), user_id: userId, status: 'draft' }).value();
    if (existing) {
      const dir = path.join(__dirname, '../public/reports/submitted');
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, existing.filename), content, 'utf8');
      const update = {
        title: title || existing.title,
        content,
        week: week || existing.week,
        updated_at: new Date().toISOString()
      };
      if (Array.isArray(sections)) update.sections = sections;
      if (Array.isArray(projects)) update.projects = projects;
      db.get('reports').find({ id: parseInt(draft_id) }).assign(update).write();
      return res.json({ success: true, draft_id: existing.id, message: 'تم الحفظ' });
    }
  }

  const dir = path.join(__dirname, '../public/reports/submitted');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const filename = `draft_${Date.now()}_${userId}.html`;
  fs.writeFileSync(path.join(dir, filename), content, 'utf8');

  const id = nextId('reports');
  db.get('reports').push({
    id,
    user_id: userId,
    title: title || 'مسودة تقرير',
    filename,
    content,
    sections: Array.isArray(sections) ? sections : [],
    projects: Array.isArray(projects) ? projects : [],
    week: week || getCurrentWeek(),
    submitted_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    status: 'draft'
  }).write();

  res.json({ success: true, draft_id: id, message: 'تم الحفظ' });
});

app.post('/api/employee/send/:id', requireLogin, (req, res) => {
  const id = parseInt(req.params.id);
  const userId = req.session.user.id;

  const report = db.get('reports').find({ id, user_id: userId }).value();
  if (!report) return res.status(404).json({ error: 'التقرير مش موجود' });

  if (req.body.content) {
    const dir = path.join(__dirname, '../public/reports/submitted');
    fs.writeFileSync(path.join(dir, report.filename), req.body.content, 'utf8');
  }

  const update = {
    status: 'submitted',
    submitted_at: new Date().toISOString(),
    title: req.body.title || report.title,
    week: req.body.week || report.week
  };
  if (Array.isArray(req.body.sections)) update.sections = req.body.sections;
  if (Array.isArray(req.body.projects)) update.projects = req.body.projects;
  db.get('reports').find({ id }).assign(update).write();

  addNotif(userId, `${req.session.user.name} أرسل تقرير جديد: ${req.body.title || report.title}`);

  res.json({ success: true, message: 'تم إرسال التقرير للمدير' });
});

const pdfStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '../public/reports/submitted');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => cb(null, `pdf_${Date.now()}_${file.originalname}`)
});
const uploadPdf = multer({
  storage: pdfStorage,
  fileFilter: (req, file, cb) => {
    const ok = file.mimetype === 'application/pdf' || file.originalname.endsWith('.pdf');
    cb(null, ok);
  }
});

app.post('/api/employee/attach-pdf', requireLogin, uploadPdf.single('pdf'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'ملف PDF مطلوب' });
  const { report_id } = req.body;

  if (report_id) {
    db.get('reports').find({ id: parseInt(report_id), user_id: req.session.user.id })
      .assign({ pdf_filename: req.file.filename }).write();
  }

  res.json({ success: true, filename: req.file.filename });
});

app.get('/reports/pdf/:filename', requireLogin, (req, res) => {
  const fp = path.join(__dirname, '../public/reports/submitted', req.params.filename);
  fs.existsSync(fp) ? res.sendFile(fp) : res.status(404).send('الملف مش موجود');
});

app.post('/api/employee/submit', requireLogin, upload.single('report'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'لازم ترفع ملف HTML' });
  const { title, week } = req.body;
  const userId = req.session.user.id;
  const user = db.get('users').find({ id: userId }).value();
  const reportWeek = week || getCurrentWeek();

  db.get('reports').push({
    id: nextId('reports'), user_id: userId,
    title: title || req.file.originalname,
    filename: req.file.filename,
    week: reportWeek,
    submitted_at: new Date().toISOString(), status: 'submitted'
  }).write();

  addNotif(userId, `${req.session.user.name} رفع تقرير جديد: ${title || req.file.originalname}`);

  // إرسال إيميلات
  (async () => {
    // للموظف: تأكيد الاستقبال
    const userTemplate = emailService.reportSubmittedTemplate(user.name, reportWeek);
    await emailService.sendEmail(user.email, userTemplate.subject, userTemplate.html);

    // للمدير: إخطار بتقرير جديد
    const admin = db.get('users').find({ role: 'admin' }).value();
    if (admin) {
      const adminTemplate = emailService.newReportSubmittedToAdminTemplate(user.name, reportWeek);
      await emailService.sendEmail(admin.email, adminTemplate.subject, adminTemplate.html);
    }
  })().catch(err => console.error('Email error:', err));

  res.json({ success: true });
});

app.post('/api/employee/save-report', requireLogin, (req, res) => {
  const { title, week, content } = req.body;
  if (!content) return res.status(400).json({ error: 'محتوى فاضي' });
  const userId = req.session.user.id;
  const dir = path.join(__dirname, '../public/reports/submitted');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const filename = `${Date.now()}_${userId}_report.html`;
  fs.writeFileSync(path.join(dir, filename), content, 'utf8');
  db.get('reports').push({
    id: nextId('reports'), user_id: userId,
    title: title || 'تقرير أسبوعي', filename,
    week: week || getCurrentWeek(),
    submitted_at: new Date().toISOString(), status: 'submitted'
  }).write();
  addNotif(userId, `${req.session.user.name} حفظ تقرير: ${title || 'تقرير أسبوعي'}`);
  res.json({ success: true });
});

app.get('/reports/view/:filename', requireLogin, (req, res) => {
  const filename = req.params.filename;

  const submittedPath = path.join(__dirname, '../public/reports/submitted', filename);
  if (fs.existsSync(submittedPath)) return res.sendFile(submittedPath);

  const templatePath = path.join(__dirname, '../public/reports', filename);
  if (fs.existsSync(templatePath)) return res.sendFile(templatePath);

  res.status(404).send('<h2 style="font-family:Cairo,sans-serif;text-align:center;padding:40px;color:#dc2626">التقرير مش موجود</h2>');
});

// ── Helpers ───────────────────────────────────────────────────────────────────
function addNotif(userId, message) {
  db.get('notifications').push({ id: nextId('notifications'), user_id: userId, message, read: false, created_at: new Date().toISOString() }).write();
}

function getCurrentWeek() {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 1);
  const week = Math.ceil(((now - start) / 86400000 + start.getDay() + 1) / 7);
  return `الأسبوع ${week} - ${now.getFullYear()}`;
}

app.listen(PORT, () => {
  console.log(`\n🚀 http://localhost:${PORT}`);
  console.log(`👤 admin@reports.com / admin123`);
  console.log(`👥 [name]@reports.com / pass123\n`);
});
