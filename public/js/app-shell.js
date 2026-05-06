/* ──────────────────────────────────────────────────────────────────────────
   App Shell — Dark Mode toggle + Browser Notifications
   يُحمّل في كل صفحة. التطبيق التلقائي يحدث قبل الـ render.
   ────────────────────────────────────────────────────────────────────────── */

(function () {
  // Apply saved theme على html ASAP لتجنب FOUC
  const savedTheme = localStorage.getItem('me_theme') || 'light';
  document.documentElement.setAttribute('data-theme', savedTheme);
})();

window.toggleTheme = function () {
  const cur = document.documentElement.getAttribute('data-theme') || 'light';
  const next = cur === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('me_theme', next);
  document.querySelectorAll('.theme-toggle').forEach(b => b.textContent = next === 'dark' ? '☀️' : '🌙');
};

window.injectThemeToggle = function (containerSelector, prepend = false) {
  const container = document.querySelector(containerSelector);
  if (!container || container.querySelector('.theme-toggle')) return;
  const cur = document.documentElement.getAttribute('data-theme') || 'light';
  const btn = document.createElement('button');
  btn.className = 'theme-toggle';
  btn.title = 'تبديل الوضع الليلي';
  btn.textContent = cur === 'dark' ? '☀️' : '🌙';
  btn.onclick = window.toggleTheme;
  if (prepend) container.insertBefore(btn, container.firstChild);
  else container.appendChild(btn);
};

// ── Browser Notifications ─────────────────────────────────────────────────────
window.NotifManager = {
  supported() { return 'Notification' in window; },
  permission() { return this.supported() ? Notification.permission : 'unsupported'; },
  async request() {
    if (!this.supported()) return 'unsupported';
    const r = await Notification.requestPermission();
    localStorage.setItem('me_notif_asked', '1');
    return r;
  },
  fire(title, body, opts = {}) {
    if (!this.supported() || Notification.permission !== 'granted') return;
    return new Notification(title, { body, icon: '/favicon.ico', dir: 'rtl', lang: 'ar', ...opts });
  },
  // اختبار إن المستخدم لازم يتذكّر — يُستخدم في employee.html
  shouldShowReminderBanner() {
    if (!this.supported()) return false;
    if (Notification.permission === 'granted') return false;
    if (Notification.permission === 'denied') return false;
    if (localStorage.getItem('me_notif_asked')) return false;
    return true;
  }
};

// ══════════════════════════════════════════════════════════════════════════════
// IMP 6: Rich Toast Notifications
// ══════════════════════════════════════════════════════════════════════════════
window.Toast = {
  show(message, type = 'info', duration = 3500) {
    let container = document.getElementById('toastContainer');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toastContainer';
      container.className = 'toast-container';
      document.body.appendChild(container);
    }
    const icons = { success: 'check-circle', error: 'x-circle', warning: 'alert-triangle', info: 'info' };
    const fallback = { success: '✓', error: '✕', warning: '!', info: 'i' };
    const useLucide = !!window.lucide;
    const iconHtml = useLucide
      ? `<i data-lucide="${icons[type]}"></i>`
      : `<span style="font-weight:900">${fallback[type]}</span>`;

    const toast = document.createElement('div');
    toast.className = `toast-rich ${type}`;
    toast.innerHTML = `
      <div class="toast-icon">${iconHtml}</div>
      <div class="toast-message">${message}</div>
      <button class="toast-close" aria-label="إغلاق">${useLucide ? '<i data-lucide="x"></i>' : '✕'}</button>`;
    toast.querySelector('.toast-close').onclick = () => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    };
    container.appendChild(toast);
    if (window.lucide) lucide.createIcons();

    requestAnimationFrame(() => toast.classList.add('show'));
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    }, duration);
    return toast;
  },
  success(msg, dur) { return this.show(msg, 'success', dur); },
  error(msg, dur)   { return this.show(msg, 'error', dur); },
  warning(msg, dur) { return this.show(msg, 'warning', dur); },
  info(msg, dur)    { return this.show(msg, 'info', dur); }
};

// ══════════════════════════════════════════════════════════════════════════════
// IMP 12: Loading Buttons
// ══════════════════════════════════════════════════════════════════════════════
window.btnLoading = function (btn) {
  if (!btn) return;
  btn.dataset.originalText = btn.dataset.originalText || btn.textContent;
  btn.classList.add('loading');
  btn.disabled = true;
};
window.btnSuccess = function (btn, duration = 1500) {
  if (!btn) return;
  btn.classList.remove('loading');
  btn.classList.add('success-state');
  setTimeout(() => {
    btn.classList.remove('success-state');
    btn.disabled = false;
    if (btn.dataset.originalText) btn.textContent = btn.dataset.originalText;
  }, duration);
};
window.btnReset = function (btn) {
  if (!btn) return;
  btn.classList.remove('loading', 'success-state');
  btn.disabled = false;
  if (btn.dataset.originalText) btn.textContent = btn.dataset.originalText;
};

// ══════════════════════════════════════════════════════════════════════════════
// IMP 2: Skeleton Loading
// ══════════════════════════════════════════════════════════════════════════════
window.showSkeleton = function (containerOrId, type = 'card', count = 3) {
  const el = typeof containerOrId === 'string' ? document.getElementById(containerOrId) : containerOrId;
  if (!el) return;
  const html = Array(count).fill(0).map(() => {
    if (type === 'card') return `
      <div class="sk-card">
        <div class="skeleton sk-line short"></div>
        <div class="skeleton sk-line medium"></div>
        <div class="skeleton sk-line"></div>
      </div>`;
    if (type === 'row') return `
      <div class="sk-row">
        <div class="skeleton sk-circle"></div>
        <div class="sk-content">
          <div class="skeleton sk-line short"></div>
          <div class="skeleton sk-line medium"></div>
        </div>
      </div>`;
    if (type === 'kpi') return `
      <div class="sk-card" style="text-align:center">
        <div class="skeleton sk-circle" style="margin:0 auto 10px"></div>
        <div class="skeleton sk-line tall short" style="margin:0 auto 6px"></div>
        <div class="skeleton sk-line short" style="margin:0 auto"></div>
      </div>`;
    return `<div class="skeleton sk-line tall"></div>`;
  }).join('');
  el.innerHTML = type === 'kpi' ? `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:14px">${html}</div>` : html;
};

// ══════════════════════════════════════════════════════════════════════════════
// IMP 8: Number Animation
// ══════════════════════════════════════════════════════════════════════════════
window.animateNumber = function (element, target, duration = 900) {
  if (!element) return;
  if (typeof target !== 'number') target = parseFloat(target) || 0;
  const text = element.textContent || '';
  const start = parseFloat(text.replace(/[^\d.-]/g, '')) || 0;
  const isPercent = text.includes('%') || element.dataset.suffix === '%';
  const suffix = element.dataset.suffix || (isPercent ? '%' : '');
  const startTime = performance.now();
  function update(now) {
    const elapsed = now - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    const current = start + (target - start) * eased;
    const display = Number.isInteger(target) ? Math.round(current) : current.toFixed(1);
    element.textContent = display + suffix;
    if (progress < 1) requestAnimationFrame(update);
  }
  requestAnimationFrame(update);
};

// ══════════════════════════════════════════════════════════════════════════════
// IMP 4: Ripple Effect
// ══════════════════════════════════════════════════════════════════════════════
document.addEventListener('click', e => {
  const btn = e.target.closest('.btn-primary, .btn-orange, .hero-cta, .wiz-next, .tpl-install, .empty-action, .btn-modal-save');
  if (!btn || btn.disabled || btn.classList.contains('loading')) return;
  const rect = btn.getBoundingClientRect();
  const ripple = document.createElement('span');
  ripple.className = 'ripple-effect';
  const size = Math.max(rect.width, rect.height);
  ripple.style.width = ripple.style.height = size + 'px';
  ripple.style.left = (e.clientX - rect.left - size / 2) + 'px';
  ripple.style.top  = (e.clientY - rect.top  - size / 2) + 'px';
  btn.appendChild(ripple);
  setTimeout(() => ripple.remove(), 600);
});

// ══════════════════════════════════════════════════════════════════════════════
// IMP 1: Lucide Icons helper
// ══════════════════════════════════════════════════════════════════════════════
window.replaceEmojiIcons = function (root = document) {
  root.querySelectorAll('[data-icon]').forEach(el => {
    const name = el.getAttribute('data-icon');
    if (!el.querySelector('[data-lucide]')) el.innerHTML = `<i data-lucide="${name}"></i>`;
  });
  if (window.lucide) lucide.createIcons();
};
window.refreshIcons = function () {
  if (window.lucide) lucide.createIcons();
};
window.addEventListener('DOMContentLoaded', () => {
  // wait a tick for lucide global to load
  const tryReplace = () => {
    if (window.lucide) {
      window.replaceEmojiIcons();
    } else {
      setTimeout(tryReplace, 80);
    }
  };
  tryReplace();
});

// ══════════════════════════════════════════════════════════════════════════════
// IMP 7: Modal Enhancers — يحول الـ ✕ buttons القديمة لـ modal-close الحديث
// ══════════════════════════════════════════════════════════════════════════════
window.enhanceModalCloses = function () {
  document.querySelectorAll('.modal .modal-head .btn-ghost.btn-sm, .modal .modal-foot .btn-ghost').forEach(b => {
    if (b.textContent.trim() === '✕' || b.textContent.trim() === 'إغلاق') {
      b.classList.add('modal-close-modern');
    }
  });
};

// ══════════════════════════════════════════════════════════════════════════════
// IMP 9: Smart Form helpers (char counter, validation)
// ══════════════════════════════════════════════════════════════════════════════
window.bindCharCounter = function (inputEl, counterEl, max) {
  if (!inputEl || !counterEl) return;
  const update = () => {
    const len = inputEl.value.length;
    counterEl.textContent = `${len} / ${max}`;
    counterEl.classList.toggle('warn', len > max * 0.8 && len <= max);
    counterEl.classList.toggle('danger', len > max);
  };
  inputEl.setAttribute('maxlength', max);
  inputEl.addEventListener('input', update);
  update();
};

// ══════════════════════════════════════════════════════════════════════════════
// Account Settings Modal — يفتح من زر الإعدادات في الـ topbar
// ══════════════════════════════════════════════════════════════════════════════
(function () {
  const STYLE_ID = 'acctSettingsStyles';
  const MODAL_ID = 'acctSettingsModal';

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const css = `
      #${MODAL_ID}{position:fixed;inset:0;background:rgba(15,23,42,.55);backdrop-filter:blur(8px);
        -webkit-backdrop-filter:blur(8px);display:none;align-items:center;justify-content:center;
        z-index:9999;padding:20px;font-family:'Cairo',sans-serif;direction:rtl}
      #${MODAL_ID}.open{display:flex}
      #${MODAL_ID} .as-card{background:#fff;width:100%;max-width:480px;border-radius:16px;
        box-shadow:0 20px 60px rgba(0,0,0,.25);overflow:hidden;border-top:4px solid #FF6B2B;
        max-height:90vh;display:flex;flex-direction:column}
      #${MODAL_ID} .as-head{padding:18px 22px;border-bottom:1px solid #E5E7EB;display:flex;
        align-items:center;justify-content:space-between}
      #${MODAL_ID} .as-head h3{font-size:17px;font-weight:800;color:#1D2F5F;margin:0}
      #${MODAL_ID} .as-x{width:32px;height:32px;border-radius:8px;background:#F4F6FA;border:1px solid #E5E7EB;
        cursor:pointer;font-size:16px;color:#4B5563;display:flex;align-items:center;justify-content:center}
      #${MODAL_ID} .as-x:hover{background:#fee2e2;border-color:#dc2626;color:#dc2626}
      #${MODAL_ID} .as-body{padding:20px 22px;overflow-y:auto}
      #${MODAL_ID} .as-section-label{font-size:12px;font-weight:800;color:#9CA3AF;
        text-transform:uppercase;letter-spacing:.5px;margin:14px 0 10px}
      #${MODAL_ID} .as-section-label:first-child{margin-top:0}
      #${MODAL_ID} .as-field{margin-bottom:14px}
      #${MODAL_ID} .as-field label{display:block;font-size:13px;font-weight:700;color:#1D2F5F;margin-bottom:6px}
      #${MODAL_ID} .as-field input{width:100%;padding:10px 13px;border:1.5px solid #E5E7EB;border-radius:10px;
        font-family:'Cairo',sans-serif;font-size:14px;color:#4B5563;background:#F4F6FA;outline:none;direction:ltr;text-align:right}
      #${MODAL_ID} .as-field input:focus{border-color:#1D2F5F;background:#fff}
      #${MODAL_ID} .as-hint{font-size:12px;color:#9CA3AF;margin-top:4px}
      #${MODAL_ID} .as-msg{padding:10px 14px;border-radius:8px;font-size:13px;font-weight:600;
        margin-bottom:14px;display:none}
      #${MODAL_ID} .as-msg.err{background:#fee2e2;color:#dc2626;border:1px solid #fca5a5;display:block}
      #${MODAL_ID} .as-msg.ok{background:#dcfce7;color:#15803d;border:1px solid #86efac;display:block}
      #${MODAL_ID} .as-foot{padding:14px 22px;border-top:1px solid #E5E7EB;display:flex;gap:10px;
        justify-content:flex-start;background:#F4F6FA}
      #${MODAL_ID} .as-btn{padding:10px 18px;border-radius:10px;font-family:'Cairo',sans-serif;
        font-size:14px;font-weight:700;cursor:pointer;border:none;transition:background .2s}
      #${MODAL_ID} .as-btn-save{background:#1D2F5F;color:#fff}
      #${MODAL_ID} .as-btn-save:hover{background:#263a75}
      #${MODAL_ID} .as-btn-save:disabled{opacity:.6;cursor:not-allowed}
      #${MODAL_ID} .as-btn-cancel{background:#fff;color:#4B5563;border:1px solid #E5E7EB}
      #${MODAL_ID} .as-btn-cancel:hover{background:#F4F6FA}
      html[data-theme="dark"] #${MODAL_ID} .as-card{background:#1f2937;color:#e5e7eb}
      html[data-theme="dark"] #${MODAL_ID} .as-head h3{color:#f9fafb}
      html[data-theme="dark"] #${MODAL_ID} .as-field label{color:#f9fafb}
      html[data-theme="dark"] #${MODAL_ID} .as-field input{background:#111827;border-color:#374151;color:#e5e7eb}
      html[data-theme="dark"] #${MODAL_ID} .as-foot{background:#111827;border-color:#374151}
      html[data-theme="dark"] #${MODAL_ID} .as-btn-cancel{background:#1f2937;color:#e5e7eb;border-color:#374151}
    `;
    const tag = document.createElement('style');
    tag.id = STYLE_ID;
    tag.textContent = css;
    document.head.appendChild(tag);
  }

  function buildModal() {
    if (document.getElementById(MODAL_ID)) return document.getElementById(MODAL_ID);
    const wrap = document.createElement('div');
    wrap.id = MODAL_ID;
    wrap.innerHTML = `
      <div class="as-card" role="dialog" aria-modal="true" aria-labelledby="asTitle">
        <div class="as-head">
          <h3 id="asTitle">إعدادات الحساب</h3>
          <button type="button" class="as-x" aria-label="إغلاق">✕</button>
        </div>
        <div class="as-body">
          <div class="as-msg" id="asMsg"></div>
          <div class="as-section-label">البيانات الأساسية</div>
          <div class="as-field">
            <label for="asName">الاسم</label>
            <input type="text" id="asName" autocomplete="name" />
          </div>
          <div class="as-field">
            <label for="asEmail">البريد الإلكتروني</label>
            <input type="email" id="asEmail" autocomplete="email" />
          </div>
          <div class="as-section-label">تغيير كلمة المرور (اختياري)</div>
          <div class="as-field">
            <label for="asCurPass">كلمة المرور الحالية</label>
            <input type="password" id="asCurPass" autocomplete="current-password" />
          </div>
          <div class="as-field">
            <label for="asNewPass">كلمة المرور الجديدة</label>
            <input type="password" id="asNewPass" autocomplete="new-password" />
            <div class="as-hint">اتركها فارغة لو مش عايز تغيّر كلمة المرور.</div>
          </div>
        </div>
        <div class="as-foot">
          <button type="button" class="as-btn as-btn-save" id="asSaveBtn">حفظ التعديلات</button>
          <button type="button" class="as-btn as-btn-cancel" id="asCancelBtn">إلغاء</button>
        </div>
      </div>`;
    document.body.appendChild(wrap);

    const close = () => wrap.classList.remove('open');
    wrap.querySelector('.as-x').onclick = close;
    wrap.querySelector('#asCancelBtn').onclick = close;
    wrap.addEventListener('click', e => { if (e.target === wrap) close(); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && wrap.classList.contains('open')) close(); });

    wrap.querySelector('#asSaveBtn').onclick = saveProfile;
    return wrap;
  }

  function setMsg(kind, text) {
    const m = document.getElementById('asMsg');
    if (!m) return;
    m.className = 'as-msg' + (kind ? ' ' + kind : '');
    m.textContent = text || '';
    if (!text) m.style.display = 'none';
  }

  async function saveProfile() {
    const btn = document.getElementById('asSaveBtn');
    const name    = document.getElementById('asName').value.trim();
    const email   = document.getElementById('asEmail').value.trim();
    const curPass = document.getElementById('asCurPass').value;
    const newPass = document.getElementById('asNewPass').value;

    if (!name)  return setMsg('err', 'الاسم مطلوب');
    if (!email) return setMsg('err', 'الإيميل مطلوب');
    if (newPass && !curPass) return setMsg('err', 'لازم تدخل كلمة المرور الحالية لتغييرها');
    if (newPass && newPass.length < 6) return setMsg('err', 'كلمة المرور الجديدة قصيرة جدًا (6 حروف على الأقل)');

    setMsg('', '');
    btn.disabled = true;
    const original = btn.textContent;
    btn.textContent = 'جاري الحفظ...';
    try {
      const r = await fetch('/api/me/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, current_password: curPass, new_password: newPass })
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok || data.error) {
        setMsg('err', data.error || 'حصلت مشكلة، حاول تاني');
      } else {
        setMsg('ok', 'تم الحفظ بنجاح ✓');
        document.getElementById('asCurPass').value = '';
        document.getElementById('asNewPass').value = '';
        if (window.Toast) Toast.success('تم تحديث بياناتك');
      }
    } catch (e) {
      setMsg('err', 'تعذّر الاتصال بالخادم');
    } finally {
      btn.disabled = false;
      btn.textContent = original;
    }
  }

  window.openAccountSettings = async function () {
    injectStyles();
    const wrap = buildModal();
    setMsg('', '');
    document.getElementById('asCurPass').value = '';
    document.getElementById('asNewPass').value = '';
    document.getElementById('asName').value = '';
    document.getElementById('asEmail').value = '';
    wrap.classList.add('open');
    try {
      const s = await fetch('/api/session').then(r => r.json());
      if (s) {
        document.getElementById('asName').value  = s.name  || '';
        document.getElementById('asEmail').value = s.email || '';
      }
    } catch (e) { /* ignore */ }
  };
})();

// ── Auto-fire deadline reminder (Friday) ──────────────────────────────────────
// لو فيه إذن notifications + اليوم الجمعة + ما رفعش تقرير، أظهر تذكير
window.checkDeadlineReminder = async function () {
  if (!NotifManager.supported() || Notification.permission !== 'granted') return;
  const today = new Date();
  if (today.getDay() !== 5) return; // 5 = الجمعة
  const lastFired = localStorage.getItem('me_friday_fired');
  const stamp = today.toDateString();
  if (lastFired === stamp) return;

  try {
    const data = await fetch('/api/employee/streak').then(r => r.json());
    if (data.submittedThisWeek) return;
    NotifManager.fire('⏰ تذكير: تقرير الأسبوع', 'النهاردة الجمعة آخر يوم لتسليم تقرير الأسبوع');
    localStorage.setItem('me_friday_fired', stamp);
  } catch (e) { /* ignore */ }
};
