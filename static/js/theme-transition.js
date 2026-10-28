/* Restore the saved theme before revealing the page; animate explicit switches only. */
(() => {
  'use strict';
  const root = document.documentElement;
  // This shared script is already loaded by every page. No template changes needed.
  let savedDark = true;
  try { const stored = localStorage.getItem('campus-static-dark'); if (stored !== null) savedDark = JSON.parse(stored) === true; } catch {}
  root.classList.toggle('dark', savedDark);
  // Commit the initial palette with transitions suppressed by the CSS guard.
  void root.offsetWidth;
  root.setAttribute('data-theme-ready', '');
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  let busy = false;
  window.uclassThemeTransition = async (control, update) => {
    if (busy) return;
    if (motion.matches) { update(); return; }
    busy = true;
    let applied = false;
    const apply = () => { if (!applied) { update(); applied = true; } };
    control.classList.add('is-switching');
    try {
      if (typeof document.startViewTransition === 'function') {
        const rect = control.getBoundingClientRect();
        const x = rect.left + rect.width / 2, y = rect.top + rect.height / 2;
        const radius = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
        root.classList.add('theme-revealing');
        const transition = document.startViewTransition(apply);
        // A hidden tab can skip its transition; always settle without a rejected promise.
        transition.finished.catch(() => {});
        try {
          await transition.ready;
          await root.animate({clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`]},
            {duration: 560, easing: 'cubic-bezier(.22,1,.36,1)', pseudoElement: '::view-transition-new(root)'}).finished;
          await transition.finished;
        } catch { transition.skipTransition(); apply(); }
      } else {
        root.classList.add('theme-fading');
        // Commit the transition styles before exchanging the colors.
        void root.offsetWidth;
        apply();
        await new Promise(resolve => setTimeout(resolve, 400));
      }
    } finally {
      root.classList.remove('theme-revealing', 'theme-fading');
      control.classList.remove('is-switching');
      busy = false;
    }
  };
})();
