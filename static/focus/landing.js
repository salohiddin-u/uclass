/* Progressive enhancement for the public page. No account data or network calls. */
(() => {
  'use strict';
  if (window.ihawkLanding) return;
  const root = document.documentElement;
  const reduce = matchMedia('(prefers-reduced-motion:reduce)');
  const themes = [...document.querySelectorAll('[data-lp-theme]')];
  const menu = document.querySelector('[data-lp-menu]');
  const compactHeader = matchMedia('(max-width:767px)');
  const visual = document.querySelector('[data-lp-visual]');
  const nodes = [...document.querySelectorAll('[data-lp-view]')];
  const title = document.getElementById('lp-visual-title');
  const copy = document.getElementById('lp-visual-copy');
  const descriptions = {
    courses: ['Every course, without the digging.', 'Learning materials and recorded results, connected to the course they belong to.'],
    grades: ['A clearer view of your progress.', 'See recorded course grades and assessments, with the details close at hand.'],
    attendance: ['Your sessions, clearly recorded.', 'Explore recorded attendance. Unrecorded sessions stay separate from absences.'],
    timetable: ['Your week, at a glance.', 'Move between your days and find the classes listed in your timetable.'],
    assignments: ['Know what’s on your plate.', 'Browse assignments and supplied due dates, with no guessed deadlines.']
  };

  function syncTheme() {
    const dark = root.dataset.theme === 'dark';
    const label = dark ? 'Switch to light mode' : 'Switch to dark mode';
    themes.forEach(theme => {
      theme.setAttribute('aria-label', label);
      theme.setAttribute('aria-pressed', String(dark));
      theme.title = label;
    });
  }
  if (window.ihawkFocusFoundation) {
    syncTheme();
    document.querySelectorAll('[data-lp-theme-row]').forEach(row => {row.hidden = false;});
    themes.forEach(theme => {
      theme.hidden = false;
      theme.addEventListener('click', () => {
        window.ihawkFocusFoundation.setTheme(root.dataset.theme === 'dark' ? 'light' : 'dark');
        syncTheme();
      });
    });
  }
  if (menu) {
    menu.querySelectorAll('nav a').forEach(link => link.addEventListener('click', () => {menu.open = false;}));
    document.addEventListener('click', event => {if(menu.open && !menu.contains(event.target))menu.open = false;});
    document.addEventListener('keydown', event => {
      if(event.key === 'Escape' && menu.open) {event.preventDefault();menu.open = false;menu.querySelector('summary').focus({preventScroll:true});}
    });
    compactHeader.addEventListener('change', () => {if(!compactHeader.matches)menu.open = false;});
  }
  new MutationObserver(syncTheme).observe(root, {attributes:true, attributeFilter:['data-theme']});
  window.addEventListener('storage', event => {
    if (event.key === 'ihawk:focus:theme' && ['dark','light'].includes(event.newValue)) {
      window.ihawkFocusFoundation?.setTheme(event.newValue);
      syncTheme();
    }
  });

  function select(name) {
    if (!descriptions[name] || !visual || !title || !copy) return;
    visual.dataset.lpVisual = name;
    nodes.forEach(node => {
      const selected = node.dataset.lpView === name;
      node.dataset.selected = String(selected);
      node.setAttribute('aria-pressed', String(selected));
    });
    [title.textContent, copy.textContent] = descriptions[name];
  }
  nodes.forEach(node => {
    node.setAttribute('role', 'button');
    node.setAttribute('aria-pressed', String(node.dataset.selected === 'true'));
    node.addEventListener('click', event => {
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button > 0) return;
      event.preventDefault();
      select(node.dataset.lpView);
    });
    node.addEventListener('keydown', event => {
      if (event.key === ' ') {event.preventDefault();node.click();}
    });
  });

  const pending = new Set();
  const highMotion = () => !reduce.matches && root.dataset.quality === 'high';
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => {
      let stagger = 0;
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        observer.unobserve(entry.target);
        pending.delete(entry.target);
        if (highMotion()) entry.target.animate([
          {opacity:0,transform:'translateY(8px)'}, {opacity:1,transform:'translateY(0)'}
        ], {duration:240, delay:Math.min(stagger++,3)*40, easing:'cubic-bezier(.22,1,.36,1)'});
      }
    }, {threshold:.12});
    document.querySelectorAll('[data-lp-reveal]').forEach(element => {
      if (element.getBoundingClientRect().top < innerHeight) return;
      pending.add(element);
      observer.observe(element);
    });
    window.addEventListener('pagehide', () => observer.disconnect());
    window.addEventListener('pageshow', event => {
      if (event.persisted) {
        pending.forEach(element => {if(element.isConnected)observer.observe(element);});
        document.querySelectorAll('[data-lp-reveal]').forEach(element => element.getAnimations().forEach(animation => animation.finish()));
      }
    });
  }
  document.querySelectorAll('.lp-faq-list details').forEach(details => {
    details.addEventListener('toggle', () => {
      if (!details.open || !highMotion()) return;
      details.querySelector('p')?.animate([{opacity:0,transform:'translateY(4px)'},{opacity:1,transform:'translateY(0)'}], {duration:120,easing:'ease-out'});
    });
  });
  window.ihawkLanding = {select};
})();
