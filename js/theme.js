/* =========================================================
   ZEROCLUB — THEME BOOTSTRAP
   Self-hosted synchronous theme init to eliminate FOUC,
   fully compliant with CSP script-src 'self'.
   ========================================================= */
(() => {
  'use strict';
  try {
    const saved = localStorage.getItem('zeroclub-theme');
    const systemPrefersLight = window.matchMedia('(prefers-color-scheme: light)').matches;
    const theme = saved ? saved : (systemPrefersLight ? 'light' : 'dark');
    document.documentElement.setAttribute('data-theme', theme);
  } catch (e) {
    // localStorage may be disabled in private browsing
  }
})();
