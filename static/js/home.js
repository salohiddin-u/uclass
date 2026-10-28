/* Presentation interactions only. All academic examples are written in home.html.
 * No requests, account connections, analytics, or personal-data storage.
 */
(() => {
  'use strict';
  const root = document.documentElement;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const theme = document.getElementById('home-theme');
  if (window.lucide) lucide.createIcons({attrs: {'aria-hidden': 'true', 'stroke-width': 1.7}});
  function applyTheme(dark, persist = false) {
    root.classList.toggle('dark', dark);
    theme.setAttribute('aria-pressed', String(dark));
    theme.setAttribute('aria-label', dark ? 'Switch to light mode' : 'Switch to dark mode');
    theme.title = theme.getAttribute('aria-label');
    if (persist) { try { localStorage.setItem('campus-static-dark', JSON.stringify(dark)); } catch {} }
  }
  let dark = true;
  try { const stored = JSON.parse(localStorage.getItem('campus-static-dark')); if (typeof stored === 'boolean') dark = stored; } catch {}
  applyTheme(dark);
  theme.addEventListener('click', () => window.uclassThemeTransition(theme, () => applyTheme(!root.classList.contains('dark'), true)));

  const header = document.getElementById('site-header');
  let frame;
  function updateHeader() { header.classList.toggle('scrolled', scrollY > 12); frame = null; }
  addEventListener('scroll', () => { if (!frame) frame = requestAnimationFrame(updateHeader); }, {passive: true});
  updateHeader();

  const menuButton = document.getElementById('menu-toggle'), menu = document.getElementById('mobile-menu');
  let menuAnimation;
  function setMenu(open, restoreFocus = false) {
    menuAnimation?.cancel();
    menuButton.setAttribute('aria-expanded', String(open));
    menuButton.setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation');
    if (open) {
      menu.hidden = false; menu.inert = false;
      if (!reduced.matches) menuAnimation = menu.animate([{opacity: 0, transform: 'translateY(-10px)'}, {opacity: 1, transform: 'translateY(0)'}], {duration: 220, easing: 'ease-out'});
    } else {
      menu.inert = true;
      if (!menu.hidden && !reduced.matches) {
        menuAnimation = menu.animate([{opacity: 1}, {opacity: 0, transform: 'translateY(-8px)'}], {duration: 160});
        menuAnimation.onfinish = () => { menu.hidden = true; };
      } else menu.hidden = true;
      if (restoreFocus) menuButton.focus();
    }
  }
  menuButton.addEventListener('click', () => setMenu(menuButton.getAttribute('aria-expanded') !== 'true'));
  menu.addEventListener('click', event => { if (event.target.closest('a')) setMenu(false); });
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && menuButton.getAttribute('aria-expanded') === 'true') setMenu(false, true); });
  document.addEventListener('click', event => { if (!header.contains(event.target) && menuButton.getAttribute('aria-expanded') === 'true') setMenu(false); });
  header.addEventListener('focusout', () => { setTimeout(() => { if (!header.contains(document.activeElement)) setMenu(false); }, 0); });
  matchMedia('(min-width: 761px)').addEventListener('change', event => { if (event.matches) setMenu(false); });

  document.querySelectorAll('a[href^="#"]').forEach(anchor => anchor.addEventListener('click', event => {
    const target = document.getElementById(anchor.hash.slice(1));
    if (!target) return;
    event.preventDefault();
    target.scrollIntoView({behavior: reduced.matches ? 'instant' : 'smooth', block: 'start'});
    if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
    target.focus({preventScroll: true});
    history.replaceState(null, '', anchor.hash);
  }));

  // Progressive enhancement: native details remain usable without JavaScript.
  document.querySelectorAll('.lp-disclosure').forEach(details => {
    const summary = details.querySelector('summary');
    let animation, expanded = details.open;
    summary.addEventListener('click', event => {
      if (reduced.matches) return;
      event.preventDefault();
      const start = details.getBoundingClientRect().height;
      animation?.cancel();
      expanded = !expanded;
      const closedHeight = summary.getBoundingClientRect().height + 2;
      details.open = true;
      const end = expanded ? details.scrollHeight + 2 : closedHeight;
      animation = details.animate({height: [start + 'px', end + 'px']}, {duration: 240, easing: 'cubic-bezier(.2,.8,.2,1)'});
      details.style.overflow = 'hidden';
      animation.onfinish = () => { details.open = expanded; details.style.overflow = ''; animation = null; };
    });
    details.addEventListener('toggle', () => { if (!animation) expanded = details.open; });
  });

  const tabs = [...document.querySelectorAll('.lp-preview-tabs [role="tab"]')];
  function activate(tab, focus = false) {
    tabs.forEach(item => {
      const selected = item === tab;
      item.setAttribute('aria-selected', String(selected)); item.tabIndex = selected ? 0 : -1;
      document.getElementById(item.getAttribute('aria-controls')).hidden = !selected;
    });
    if (focus) tab.focus();
  }
  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => activate(tab));
    tab.addEventListener('keydown', event => {
      let target;
      if (event.key === 'ArrowRight') target = tabs[(index + 1) % tabs.length];
      if (event.key === 'ArrowLeft') target = tabs[(index - 1 + tabs.length) % tabs.length];
      if (event.key === 'Home') target = tabs[0];
      if (event.key === 'End') target = tabs[tabs.length - 1];
      if (target) { event.preventDefault(); activate(target, true); }
    });
  });

  function count(element) {
    if (reduced.matches) return;
    const finalText = element.textContent, end = Number(element.dataset.count), decimals = Number(element.dataset.decimals || 0), start = performance.now();
    function tick(now) {
      if (reduced.matches) { element.textContent = finalText; return; }
      const progress = Math.min(1, (now - start) / 900);
      element.textContent = (end * (1 - Math.pow(1 - progress, 3))).toFixed(decimals);
      if (progress < 1) requestAnimationFrame(tick); else element.textContent = finalText;
    }
    requestAnimationFrame(tick);
  }
  if ('IntersectionObserver' in window) {
    if (!reduced.matches) document.body.classList.add('lp-motion');
    const observer = new IntersectionObserver(entries => entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('is-visible'); observer.unobserve(entry.target);
      if (entry.target.matches('[data-count]')) count(entry.target);
    }), {threshold: .12});
    document.querySelectorAll('.lp-reveal, [data-count]').forEach(element => observer.observe(element));
  }
  reduced.addEventListener('change', event => { if (event.matches) document.body.classList.remove('lp-motion'); });
  document.getElementById('copyright-year').textContent = String(new Date().getFullYear());
})();
