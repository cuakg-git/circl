/* ============================================================
   CIRCL — main.js
   Shared JavaScript: reveal, parallax, sticky cards, nav,
   task checks, FAQ accordion
============================================================ */

/* ---- Reveal (IntersectionObserver) ---- */
function initReveal() {
  const els = document.querySelectorAll('.reveal');
  if (!els.length) return;
  const obs = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.classList.add('visible');
        obs.unobserve(e.target);
      }
    });
  }, { threshold: 0.08 });
  els.forEach(el => obs.observe(el));
}

/* ---- Parallax ([data-parallax] attribute) ---- */
let _rafPending = false;
let _lastSY = 0;

function initParallax() {
  const hasPx = document.querySelector('[data-parallax]') || document.getElementById('hero-illustration');
  if (!hasPx) return;

  window.addEventListener('scroll', () => {
    _lastSY = window.scrollY;
    if (!_rafPending) {
      _rafPending = true;
      requestAnimationFrame(_tickParallax);
    }
  }, { passive: true });

  _tickParallax();
}

function _tickParallax() {
  _rafPending = false;
  const sy = _lastSY;

  /* Generic parallax elements */
  document.querySelectorAll('[data-parallax]').forEach(el => {
    const speed = parseFloat(el.dataset.parallax) || 0.3;
    const rect  = el.getBoundingClientRect();
    const mid   = rect.top + rect.height / 2;
    const off   = (mid - window.innerHeight / 2) * speed;
    el.style.transform = `translateY(${off}px)`;
  });

  /* Hero illustration: scale + opacity fade */
  const heroIll  = document.getElementById('hero-illustration');
  const heroSect = document.getElementById('hero');
  if (heroIll && heroSect) {
    const h    = heroSect.offsetHeight;
    const prog = Math.max(0, Math.min(1, sy / (h * 0.65)));
    heroIll.style.transform = `scale(${1 - prog * 0.08})`;
    heroIll.style.opacity   = String(1 - prog);
  }
}

/* ---- Sticky cards (landing how-it-works) ---- */
function initStickyCards() {
  const outer = document.getElementById('how-outer');
  if (!outer) return;

  let raf = null;

  function tick() {
    const sy  = window.scrollY;
    const vh  = window.innerHeight;
    const top = outer.getBoundingClientRect().top + sy;
    const h   = outer.offsetHeight;
    const rng = h - vh;        // 300vh scroll range
    const into = sy - top;
    const seg = rng / 3;

    // Cards 2, 3, 4 each triggered at their segment threshold
    [2, 3, 4].forEach((n, i) => {
      const card = document.getElementById(`how-card-${n}`);
      if (!card) return;
      const thresh = seg * (i + 1);
      const raw = (into - thresh) / (seg * 0.35);
      const t   = Math.max(0, Math.min(1, raw));
      card.style.transform = `translateY(${(1 - t) * 100}%)`;
    });
  }

  window.addEventListener('scroll', () => {
    if (!raf) raf = requestAnimationFrame(() => { tick(); raf = null; });
  }, { passive: true });

  tick();
}

/* ---- Active nav link ---- */
function initNav() {
  const currentPath = window.location.pathname;
  document.querySelectorAll('.sidebar-link, .bottom-nav-item').forEach(link => {
    const href = link.getAttribute('href') || '';
    if (!href || href === '#') return;
    const linkPath = new URL(href, window.location.href).pathname;
    if (linkPath === currentPath) link.classList.add('active');
  });
}

/* ---- Task checkboxes ---- */
function initTasks() {
  document.querySelectorAll('.task-item').forEach(item => {
    item.addEventListener('click', () => {
      const check = item.querySelector('.task-check');
      const text  = item.querySelector('.task-text');
      if (check) check.classList.toggle('done');
      if (text)  text.classList.toggle('done');
    });
  });
}

/* ---- FAQ accordion ---- */
function initFaq() {
  document.querySelectorAll('details').forEach(d => {
    const summary = d.querySelector('summary');
    const body    = d.querySelector('.faq-body');
    if (!summary || !body) return;
    summary.addEventListener('click', e => {
      e.preventDefault();
      if (d.open) {
        body.style.maxHeight = '0';
        setTimeout(() => d.removeAttribute('open'), 420);
      } else {
        d.setAttribute('open', '');
        body.style.maxHeight = body.scrollHeight + 'px';
      }
    });
  });
}

/* ---- Chat auto-scroll ---- */
function initChat() {
  const thread = document.querySelector('.chat-thread');
  if (thread) thread.scrollTop = thread.scrollHeight;

  const textarea = document.querySelector('.chat-input');
  const sendBtn  = document.querySelector('.chat-send-btn');
  if (!textarea || !sendBtn) return;

  function sendMessage() {
    const val = textarea.value.trim();
    if (!val) return;
    const msg = document.createElement('div');
    msg.className = 'msg msg-user';
    msg.innerHTML = `
      <div class="msg-label">Vos</div>
      <div class="msg-bubble">${val.replace(/</g,'&lt;')}</div>
      <div class="msg-time">${_timeNow()}</div>`;
    thread.appendChild(msg);
    textarea.value = '';
    textarea.style.height = 'auto';
    thread.scrollTop = thread.scrollHeight;
  }

  sendBtn.addEventListener('click', sendMessage);
  textarea.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  });
  textarea.addEventListener('input', () => {
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
  });
}

function _timeNow() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}

/* ---- Node pulse delay (landing hero) ---- */
function initHeroNodes() {
  setTimeout(() => {
    document.querySelectorAll('.net-node').forEach(n => n.classList.add('pulse'));
  }, 1700);
}

/* ---- Bootstrap ---- */
document.addEventListener('DOMContentLoaded', () => {
  initReveal();
  initParallax();
  initStickyCards();
  initNav();
  initTasks();
  initFaq();
  initChat();
  initHeroNodes();
});
