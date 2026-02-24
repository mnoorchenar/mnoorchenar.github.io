/* ═══════════════════════════════════════════
   shared.js  —  drop this ONE file into /projects/
   Every project page links to it. No more copy-paste.
═══════════════════════════════════════════ */

(function () {

  /* ── THEME TOGGLE ── */
  const html       = document.documentElement;
  const toggleBtn  = document.getElementById('themeToggle');
  const toggleLbl  = document.getElementById('toggleLabel');

  // Apply saved preference immediately (before paint)
  const saved = localStorage.getItem('mn-theme') || 'dark';
  html.setAttribute('data-theme', saved);
  if (toggleLbl) toggleLbl.textContent = saved === 'dark' ? 'Light' : 'Dark';

  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      const next = html.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      html.setAttribute('data-theme', next);
      localStorage.setItem('mn-theme', next);
      if (toggleLbl) toggleLbl.textContent = next === 'dark' ? 'Light' : 'Dark';
      // If the page has a particle canvas (main index), reinit particles
      if (typeof initPts === 'function') initPts();
    });
  }

  /* ── FADE-UP ON SCROLL ── */
  document.addEventListener('DOMContentLoaded', () => {
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
  });

})();
