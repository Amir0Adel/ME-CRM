const nodemailer = require('nodemailer');

let transporter = null;

function initializeTransporter() {
  if (transporter) return transporter;

  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT) || 587;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    console.warn('⚠️  Email: SMTP credentials not configured — emails disabled');
    return null;
  }

  transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
    tls: { rejectUnauthorized: process.env.NODE_ENV === 'production' }
  });

  transporter.verify((err, success) => {
    if (err) {
      console.error('❌ Email: SMTP connection failed:', err.message);
      transporter = null;
    } else {
      console.log('✅ Email: SMTP connected');
    }
  });

  return transporter;
}

async function sendEmail(to, subject, html, text = '') {
  const t = initializeTransporter();
  if (!t) {
    console.warn(`⚠️  Email skipped (not configured): ${to}`);
    return { success: false, reason: 'SMTP not configured' };
  }

  try {
    const info = await t.sendMail({
      from: `${process.env.SMTP_FROM_NAME} <${process.env.SMTP_FROM}>`,
      to,
      subject,
      html,
      text: text || subject
    });
    console.log(`📧 Email sent: ${to} (${subject})`);
    return { success: true, messageId: info.messageId };
  } catch (err) {
    console.error(`❌ Email failed: ${to}`, err.message);
    return { success: false, error: err.message };
  }
}

// ── Email Templates ──────────────────────────────────────────────────────────

function reportSubmittedTemplate(userName, reportWeek) {
  return {
    subject: `✅ تم استقبال تقريرك — ${reportWeek}`,
    html: `
      <div dir="rtl" style="font-family:Cairo,sans-serif;max-width:600px;margin:0 auto;padding:20px;background:#f4f6fa;border-radius:12px">
        <h2 style="color:#1d2f5f;margin-bottom:16px">مرحباً ${userName} 👋</h2>
        <p style="color:#4b5563;font-size:15px;line-height:1.6">تم استقبال تقريرك بنجاح للأسبوع <strong>${reportWeek}</strong></p>
        <p style="color:#4b5563;font-size:15px;line-height:1.6">شكراً لك على الالتزام والمتابعة المستمرة. سيتم مراجعة تقريرك قريباً.</p>
        <div style="background:#fff;padding:16px;border-radius:8px;margin:20px 0;border-right:4px solid #ff6b2b">
          <p style="color:#9ca3af;font-size:13px;margin:0">لا تحتاج للرد على هذا الإيميل — إذا كان لديك أي استفسار، استخدم لوحة التحكم.</p>
        </div>
        <p style="color:#9ca3af;font-size:12px;margin-top:20px">خبراء التسويق © 2026</p>
      </div>
    `
  };
}

function reportCommentedTemplate(reporterName, commenterName, comment) {
  return {
    subject: `💬 تعليق جديد على تقريرك من ${commenterName}`,
    html: `
      <div dir="rtl" style="font-family:Cairo,sans-serif;max-width:600px;margin:0 auto;padding:20px;background:#f4f6fa;border-radius:12px">
        <h2 style="color:#1d2f5f;margin-bottom:16px">تعليق جديد 💬</h2>
        <p style="color:#4b5563;font-size:15px;line-height:1.6">أضاف <strong>${commenterName}</strong> تعليقاً على تقريرك:</p>
        <div style="background:#fff;padding:14px;border-radius:8px;margin:16px 0;border-right:4px solid #ff6b2b">
          <p style="color:#4b5563;font-size:14px;margin:0;line-height:1.6">"${comment}"</p>
        </div>
        <p style="color:#4b5563;font-size:14px">
          <a href="https://crm.marketingexperts.com.sa/employee" style="color:#1d2f5f;text-decoration:none;font-weight:700">اذهب للوحة التحكم لعرض التفاصيل →</a>
        </p>
        <p style="color:#9ca3af;font-size:12px;margin-top:20px">خبراء التسويق © 2026</p>
      </div>
    `
  };
}

function newReportSubmittedToAdminTemplate(employeeName, reportWeek) {
  return {
    subject: `📊 تقرير جديد من ${employeeName} — ${reportWeek}`,
    html: `
      <div dir="rtl" style="font-family:Cairo,sans-serif;max-width:600px;margin:0 auto;padding:20px;background:#f4f6fa;border-radius:12px">
        <h2 style="color:#1d2f5f;margin-bottom:16px">تقرير جديد بانتظار المراجعة 📊</h2>
        <p style="color:#4b5563;font-size:15px;line-height:1.6">قدّم <strong>${employeeName}</strong> تقريره للأسبوع <strong>${reportWeek}</strong></p>
        <p style="color:#4b5563;font-size:15px;line-height:1.6">يمكنك الآن مراجعة التقرير وإضافة تعليقاتك أو الموافقة عليه.</p>
        <p style="color:#4b5563;font-size:14px;margin-top:16px">
          <a href="https://crm.marketingexperts.com.sa/admin" style="background:#1d2f5f;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:700;display:inline-block">اذهب للوحة التحكم</a>
        </p>
        <p style="color:#9ca3af;font-size:12px;margin-top:20px">خبراء التسويق © 2026</p>
      </div>
    `
  };
}

function adminCommentTemplate(adminName, comment) {
  return {
    subject: `📝 تعليق من المدير: ${adminName}`,
    html: `
      <div dir="rtl" style="font-family:Cairo,sans-serif;max-width:600px;margin:0 auto;padding:20px;background:#f4f6fa;border-radius:12px">
        <h2 style="color:#1d2f5f;margin-bottom:16px">تعليق من المدير 📝</h2>
        <p style="color:#4b5563;font-size:15px;line-height:1.6">أضاف <strong>${adminName}</strong> تعليقاً على تقريرك:</p>
        <div style="background:#fff;padding:14px;border-radius:8px;margin:16px 0;border-right:4px solid #ff6b2b">
          <p style="color:#4b5563;font-size:14px;margin:0;line-height:1.6">"${comment}"</p>
        </div>
        <p style="color:#4b5563;font-size:14px">
          <a href="https://crm.marketingexperts.com.sa/employee" style="color:#1d2f5f;text-decoration:none;font-weight:700">عرض التقرير الكامل →</a>
        </p>
        <p style="color:#9ca3af;font-size:12px;margin-top:20px">خبراء التسويق © 2026</p>
      </div>
    `
  };
}

module.exports = {
  sendEmail,
  reportSubmittedTemplate,
  reportCommentedTemplate,
  newReportSubmittedToAdminTemplate,
  adminCommentTemplate
};
