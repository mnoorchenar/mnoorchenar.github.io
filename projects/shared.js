/* ═══════════════════════════════════════════════════════════════
   shared.js  —  place in /projects/
   Handles: nav & footer injection, theme, fade-up, copyright modal,
            active link, per-page footer note, project nav strip.
   Each project page just needs:
     <script src="/projects/shared.js" defer></script>
   Optionally on <body>:
     data-footer-note="Surgical Endoscopy · DOI 10.1007/..."
     data-project-index="0"   ← 0-based, omit on the index overview page
═══════════════════════════════════════════════════════════════ */

(function () {

  /* ─────────────────────────────────────────
     0.  PROJECT REGISTRY
     Keep this list in order — it drives the
     ← / → nav strip on every project page.
  ───────────────────────────────────────────*/
  const PROJECTS = [
    { title: 'Surgical Duration Predictor',          url: '/projects/Projects-Files/001-surgical-duration.html' },
    { title: 'Clinical Text Encoder Benchmark',      url: '/projects/Projects-Files/002-nlp-benchmark.html' },
    { title: 'Energy Anomaly Explainer',             url: '/projects/Projects-Files/003-energy-anomaly-xai.html' },
    { title: 'Sarcopenia Genetics Explorer',         url: '/projects/Projects-Files/004-sarcopenia-genetics.html' },
    { title: 'ASCVD Metabolomics Risk Explorer',     url: '/projects/Projects-Files/005-ascvd-metabolomics.html' },
    { title: 'CABG Gamification Patient Engagement', url: '/projects/Projects-Files/006-cabg-gamification.html' },
  ];


  /* ─────────────────────────────────────────
     1.  THEME — apply saved value IMMEDIATELY
         (before first paint, before fragments load)
  ───────────────────────────────────────────*/
  const html  = document.documentElement;
  const saved = localStorage.getItem('mn-theme') || 'dark';
  html.setAttribute('data-theme', saved);


  /* ─────────────────────────────────────────
     2.  FETCH HELPER
  ───────────────────────────────────────────*/
  function fetchFragment(url) {
    return fetch(url).then(r => {
      if (!r.ok) throw new Error(`Failed to load ${url}: ${r.status}`);
      return r.text();
    });
  }


  /* ─────────────────────────────────────────
     3.  BUILD PROJECT NAV STRIP HTML
         Called once per page after we know
         which project index we're on.
  ───────────────────────────────────────────*/
  function buildNavStrip(currentIndex) {
    // currentIndex === null  →  we're on the overview/index page
    const isOverview = currentIndex === null;
    const total      = PROJECTS.length;

    let prevHref, prevName, prevDisabled;
    let nextHref, nextName, nextDisabled;
    let counter;

    if (isOverview) {
      prevHref     = '#';
      prevName     = '—';
      prevDisabled = 'pns-disabled';
      nextHref     = PROJECTS[0].url;
      nextName     = PROJECTS[0].title;
      nextDisabled = '';
      counter      = `Overview · ${total} Projects`;
    } else {
      const hasPrev = currentIndex > 0;
      const hasNext = currentIndex < total - 1;

      prevHref     = hasPrev ? PROJECTS[currentIndex - 1].url : '/projects/index.html';
      prevName     = hasPrev ? PROJECTS[currentIndex - 1].title : 'Projects Overview';
      prevDisabled = '';

      nextHref     = hasNext ? PROJECTS[currentIndex + 1].url : '#';
      nextName     = hasNext ? PROJECTS[currentIndex + 1].title : '—';
      nextDisabled = hasNext ? '' : 'pns-disabled';

      counter = `${currentIndex + 1} of ${total}`;
    }

    return `
<div class="proj-nav-strip">
  <a href="${prevHref}" class="pns-arrow pns-prev ${prevDisabled}">
    <i class="fas fa-chevron-left"></i>
    <div class="pns-label">
      <span class="pns-hint">Previous</span>
      <span class="pns-name">${prevName}</span>
    </div>
  </a>
  <div class="pns-center">
    <a href="/projects/index.html" class="pns-all">
      <i class="fas fa-th-large"></i> All Projects
    </a>
    <span class="pns-counter">${counter}</span>
  </div>
  <a href="${nextHref}" class="pns-arrow pns-next ${nextDisabled}">
    <div class="pns-label">
      <span class="pns-hint">Next</span>
      <span class="pns-name">${nextName}</span>
    </div>
    <i class="fas fa-chevron-right"></i>
  </a>
</div>`;
  }


  /* ─────────────────────────────────────────
     4.  INIT THEME TOGGLE
         Must run AFTER the <nav> is in the DOM.
  ───────────────────────────────────────────*/
  function initThemeToggle() {
    const btn = document.getElementById('themeToggle');
    const lbl = document.getElementById('toggleLabel');

    // Sync label to current theme
    if (lbl) lbl.textContent = saved === 'dark' ? 'Light' : 'Dark';

    if (btn) {
      btn.addEventListener('click', () => {
        const next = html.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
        html.setAttribute('data-theme', next);
        localStorage.setItem('mn-theme', next);
        if (lbl) lbl.textContent = next === 'dark' ? 'Light' : 'Dark';
        // Let the page rebuild theme-dependent charts if it has any
        if (typeof rebuildCharts === 'function') rebuildCharts();
        // Reinit particles on main portfolio page if present
        if (typeof initPts === 'function') initPts();
      });
    }
  }


  /* ─────────────────────────────────────────
     5.  MARK ACTIVE NAV LINK
  ───────────────────────────────────────────*/
  function markActiveLink() {
    const path = window.location.pathname;
    document.querySelectorAll('.sh-nav-links a').forEach(a => {
      a.classList.remove('active');
      const href = a.getAttribute('href');
      // Match /projects/ and all sub-pages
      if (href && path.startsWith(href) && href !== '/') {
        a.classList.add('active');
      }
    });
  }


  /* ─────────────────────────────────────────
     6.  COPYRIGHT MODAL
         Wires up the button injected by footer.html
  ───────────────────────────────────────────*/
  function initCopyrightModal() {
    const overlay  = document.getElementById('copyrightModal');
    const openBtn  = document.getElementById('openCopyrightModal');
    const closeBtn = document.getElementById('closeCopyrightModal');

    if (!overlay || !openBtn) return;

    openBtn.addEventListener('click',  () => overlay.classList.add('active'));
    if (closeBtn) {
      closeBtn.addEventListener('click', () => overlay.classList.remove('active'));
    }
    overlay.addEventListener('click', e => {
      if (e.target === overlay) overlay.classList.remove('active');
    });
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') overlay.classList.remove('active');
    });
  }


  /* ─────────────────────────────────────────
     7.  FADE-UP ON SCROLL
  ───────────────────────────────────────────*/
  function initFadeUp() {
    const io = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const delay = +(entry.target.dataset.delay || 0);
          setTimeout(() => entry.target.classList.add('visible'), delay);
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.08, rootMargin: '0px 0px -20px 0px' });

    document.querySelectorAll('.fade-up').forEach(el => io.observe(el));
  }


  /* ─────────────────────────────────────────
     8.  FOOTER NOTE  (per-page DOI / journal)
         Add  data-footer-note="..."  to <body>
  ───────────────────────────────────────────*/
  function applyFooterNote() {
    const note = document.body.dataset.footerNote;
    if (!note) return;
    const el = document.getElementById('footerCopy');
    if (el) el.textContent += ' · ' + note;
  }


  /* ─────────────────────────────────────────
     9.  MAIN BOOT  — load fragments then init
  ───────────────────────────────────────────*/
  document.addEventListener('DOMContentLoaded', async () => {

    const base         = '/projects';
    const projectIndex = document.body.dataset.projectIndex !== undefined
                           ? parseInt(document.body.dataset.projectIndex, 10)
                           : null;

    try {
      // ── fetch nav & footer in parallel ──
      const [navHTML, footerHTML] = await Promise.all([
        fetchFragment(`${base}/nav.html`),
        fetchFragment(`${base}/footer.html`),
      ]);

      // ── inject nav ──
      document.body.insertAdjacentHTML('afterbegin', navHTML);

      // ── inject project nav strip (below main nav) ──
      const navEl = document.body.querySelector('.sh-nav');
      if (navEl) {
        navEl.insertAdjacentHTML('afterend', buildNavStrip(projectIndex));
      }

      // ── inject footer ──
      document.body.insertAdjacentHTML('beforeend', footerHTML);

      // ── now that DOM is ready, init everything ──
      initThemeToggle();
      markActiveLink();
      initCopyrightModal();
      applyFooterNote();
      initFadeUp();

    } catch (err) {
      // Fallback: fragments missing (e.g. opened as file://)
      // Still init what we can from static HTML in the page
      console.warn('[shared.js] Could not load nav/footer fragments:', err.message);
      initThemeToggle();
      initCopyrightModal();
      initFadeUp();
    }

  });

})();