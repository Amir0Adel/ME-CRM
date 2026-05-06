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
