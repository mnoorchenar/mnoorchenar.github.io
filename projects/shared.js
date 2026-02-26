/* ═══════════════════════════════════════════════════════════════
   shared.js  —  place in /projects/
   Handles: nav & footer injection, theme, fade-up, copyright modal,
            active link, per-page footer note, project nav strip.

   Each project page just needs:
     <script src="/projects/shared.js" defer></script>

   ▶ THEME FLICKER: also add this ONE line to every page's <head>
     BEFORE any <link rel="stylesheet">:
       <script>document.documentElement.setAttribute('data-theme',
         localStorage.getItem('mn-theme') || 'dark')</script>

   Optionally on <body>:
     data-footer-note="Surgical Endoscopy · DOI 10.1007/..."
     data-project-index="0"   ← 0-based; omit on the index overview page

   ▶ PATH NOTE for project sub-pages inside /projects/Projects-Files/:
     Use  ../shared.css  and  ../shared.js  (one level up).
     The index overview page at /projects/index.html uses  shared.css / shared.js.
═══════════════════════════════════════════════════════════════ */

(function () {

  /* ── DOUBLE-INJECTION GUARD ──────────────────────────────────
     Prevents duplicate nav/strip/footer if shared.js is ever
     accidentally included twice on the same page.
  ─────────────────────────────────────────────────────────────*/
  if (window.__sharedJsLoaded) return;
  window.__sharedJsLoaded = true;


  /* ─────────────────────────────────────────
     0.  PROJECT AUTO-DISCOVERY
     Reads project cards directly from
     /projects/index.html so any new card
     added there is immediately reflected in
     every project page's nav strip — no
     manual list to maintain.
     Falls back to FALLBACK_PROJECTS if the
     fetch fails (e.g. file:// mode).
  ───────────────────────────────────────────*/

  // Fallback used when fetch is unavailable (local file:// open)
  const FALLBACK_PROJECTS = [
    { title: 'Surgical Duration Predictor',          url: '/projects/Projects-Files/001-surgical-duration.html' },
    { title: 'Clinical Text Encoder Benchmark',      url: '/projects/Projects-Files/002-nlp-benchmark.html' },
    { title: 'Energy Anomaly Explainer',             url: '/projects/Projects-Files/003-energy-anomaly-xai.html' },
    { title: 'Sarcopenia Genetics Explorer',         url: '/projects/Projects-Files/004-sarcopenia-genetics.html' },
    { title: 'ASCVD Metabolomics Risk Explorer',     url: '/projects/Projects-Files/005-ascvd-metabolomics.html' },
    { title: 'CABG Gamification Patient Engagement', url: '/projects/Projects-Files/006-cabg-gamification.html' },
    { title: 'Drug Target AI Discovery',             url: '/projects/Projects-Files/007-Protein-Sequencing-AI-Discovery.html' },
  ];

  async function loadProjects(base) {
    try {
      // On the index page itself, just read the current DOM
      const onIndex = /\/projects\/?(?:index\.html)?$/.test(window.location.pathname);
      let doc;
      if (onIndex) {
        doc = document;
      } else {
        const res = await fetch(`${base}/index.html`);
        if (!res.ok) throw new Error('index fetch failed');
        doc = new DOMParser().parseFromString(await res.text(), 'text/html');
      }
      const list = [];
      doc.querySelectorAll('.proj-card').forEach(card => {
        const title = card.querySelector('.proj-title')?.textContent?.trim();
        const href  = card.querySelector('a.proj-btn-details')?.getAttribute('href');
        if (title && href) {
          list.push({ title, url: href.startsWith('/') ? href : `${base}/${href}` });
        }
      });
      return list.length ? list : FALLBACK_PROJECTS;
    } catch {
      return FALLBACK_PROJECTS;
    }
  }


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
  function buildNavStrip(currentIndex, projects) {
    // currentIndex === null  →  we're on the overview/index page
    const isOverview = currentIndex === null;
    const total      = projects.length;

    let prevHref, prevName, prevDisabled;
    let nextHref, nextName, nextDisabled;
    let counter;

    if (isOverview) {
      prevHref     = '#';
      prevName     = '—';
      prevDisabled = 'pns-disabled';
      nextHref     = projects[0]?.url ?? '#';
      nextName     = projects[0]?.title ?? '—';
      nextDisabled = '';
      counter      = `Overview · ${total} Projects`;
    } else {
      const hasPrev = currentIndex > 0;
      const hasNext = currentIndex < total - 1;

      prevHref     = hasPrev ? projects[currentIndex - 1].url : '/projects/index.html';
      prevName     = hasPrev ? projects[currentIndex - 1].title : 'Projects Overview';
      prevDisabled = '';

      nextHref     = hasNext ? projects[currentIndex + 1].url : '#';
      nextName     = hasNext ? projects[currentIndex + 1].title : '—';
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
     8.  KEYBOARD ← / → NAVIGATION
         ArrowLeft = previous project
         ArrowRight = next project
         Skipped when focus is inside a form field.
  ───────────────────────────────────────────*/
  function initKeyboardNav(projectIndex, projects) {
    if (projectIndex === null) return;  // overview page — no nav
    document.addEventListener('keydown', e => {
      // Don't hijack when typing in inputs
      const tag = document.activeElement?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.altKey || e.ctrlKey || e.metaKey) return;

      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        const hasPrev = projectIndex > 0;
        window.location.href = hasPrev
          ? projects[projectIndex - 1].url
          : '/projects/index.html';
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        const hasNext = projectIndex < projects.length - 1;
        if (hasNext) window.location.href = projects[projectIndex + 1].url;
      }
    });
  }


  /* ─────────────────────────────────────────
     9.  FOOTER NOTE  (per-page DOI / journal)
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

    // ── load projects list + nav/footer fragments in parallel ──
    const [navHTML, footerHTML, projects] = await Promise.all([
      fetchFragment(`${base}/nav.html`).catch(() => ''),
      fetchFragment(`${base}/footer.html`).catch(() => ''),
      loadProjects(base),
    ]);

    try {
      // ── inject nav ──
      if (navHTML) document.body.insertAdjacentHTML('afterbegin', navHTML);

      // ── inject project nav strip (below main nav) — skip on overview page ──
      if (projectIndex !== null) {
        const navEl = document.body.querySelector('.sh-nav');
        if (navEl) {
          navEl.insertAdjacentHTML('afterend', buildNavStrip(projectIndex, projects));
        }
      }

      // ── inject footer ──
      if (footerHTML) document.body.insertAdjacentHTML('beforeend', footerHTML);

      // ── now that DOM is ready, init everything ──
      initThemeToggle();
      markActiveLink();
      initCopyrightModal();
      applyFooterNote();
      initFadeUp();
      initKeyboardNav(projectIndex, projects);

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