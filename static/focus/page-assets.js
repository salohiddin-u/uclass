/* Load route assets once, before htmx starts a page request. No cached HTML or data. */
(() => {
  'use strict';
  if (window.ihawkPageAssets) return;
  const manifest = document.getElementById('page-assets');
  if (!manifest) return;
  const modules = {home:'ihawkHome',courses:'ihawkCourses','course-detail':'ihawkCourseDetail',attendance:'ihawkAttendance',grades:'ihawkGrades',timetable:'ihawkTimetable',assignments:'ihawkAssignments'};
  const pending = new Map();
  let intentTimer = 0, navigation = 0, replayingHistory = false;
  const constrained = () => navigator.connection?.saveData || /^(slow-)?2g$|^3g$/.test(navigator.connection?.effectiveType || '') || matchMedia('(prefers-reduced-data:reduce)').matches;
  function route(value) {
    try {
      const url = new URL(value, location.href);
      if (url.origin !== location.origin || !['http:','https:'].includes(url.protocol)) return null;
      for (const name of Object.keys(modules)) {
        if (name === 'course-detail') {if (window.ihawkRoutes?.matchesCourse(url.pathname)) return name;}
        else {const target = window.ihawkRoutes?.page(name);if (target && url.pathname === new URL(target, location.href).pathname) return name;}
      }
    } catch {}
    return null;
  }
  function asset(name) {return manifest.getAttribute('data-' + name);}
  function ready(name) {return !!window[modules[name]] && [...document.styleSheets].some(s => s.href === new URL(asset(name+'-style'),location.href).href);}
  function style(src) {
    const url = new URL(src, location.href).href;
    let link = [...document.querySelectorAll('link[rel=stylesheet]')].find(el => el.href === url);
    if (link?.sheet) return Promise.resolve();
    if (!link) {link = document.createElement('link');link.rel = 'stylesheet';link.href = url;link.dataset.pageStyle = nameFor(src);}
    return new Promise((resolve,reject) => {
      const ready = () => {cleanup();resolve();}, failed = () => {cleanup();link.remove();reject(new Error('Page stylesheet unavailable'));};
      const cleanup = () => {clearTimeout(timeout);link.removeEventListener('load',ready);link.removeEventListener('error',failed);};
      const timeout = setTimeout(failed,15000);
      link.addEventListener('load',ready);link.addEventListener('error',failed);
      if (!link.isConnected) document.head.append(link);
    });
  }
  function nameFor(src) {return src.split('/').pop().split('.')[0];}
  function script(name,src) {
    if (window[modules[name]]) return Promise.resolve();
    return new Promise((resolve,reject) => {
      const el = document.createElement('script');el.src = src;el.async = true;
      const cleanup = () => {clearTimeout(timeout);el.onload = el.onerror = null;};
      const timeout = setTimeout(() => {cleanup();el.remove();reject(new Error('Page script unavailable'));},15000);
      el.onload = () => {cleanup();resolve();};el.onerror = () => {cleanup();el.remove();reject(new Error('Page script unavailable'));};
      document.head.append(el);
    });
  }
  function load(name) {
    if (!name || !asset(name)) return Promise.resolve();
    if (!pending.has(name)) {
      const src = asset(name),task = style(asset(name+'-style')).then(() => script(name,src));
      pending.set(name,task);
      task.catch(() => pending.delete(name));
    }
    return pending.get(name);
  }
  function intent(event) {
    const link = event.target.closest?.('a[href]');
    if (!link || constrained() || link.hasAttribute('download') || link.target || link.hasAttribute('data-native') || link.getAttribute('hx-boost') === 'false') return;
    if (event.type === 'pointerover' && link.contains(event.relatedTarget)) return;
    const name = route(link.href);
    clearTimeout(intentTimer);
    if (!name) return;
    const warm = () => load(name).catch(() => {});
    if (event.type === 'pointerover') intentTimer = setTimeout(warm,80);else warm();
  }
  document.addEventListener('pointerover',intent,{passive:true});
  document.addEventListener('pointerout',event => {if(event.target.closest?.('a[href]')&&!event.target.closest('a[href]').contains(event.relatedTarget))clearTimeout(intentTimer);},{passive:true});
  document.addEventListener('focusin',intent);document.addEventListener('touchstart',intent,{passive:true});
  document.addEventListener('htmx:confirm',event => {
    const d = event.detail;
    if (d.target?.id !== 'content' || d.verb?.toLowerCase() !== 'get' || d.question) return;
    const version = ++navigation,name = route(d.path);
    if (!name) return;
    if (ready(name)) return;
    event.preventDefault();const source = document.getElementById('content');
    load(name).then(() => {if(version===navigation&&source===document.getElementById('content')&&d.elt?.isConnected)d.issueRequest();}).catch(() => {
      if(version===navigation&&source===document.getElementById('content'))window.ihawkSitePages?.showOffline({target:source,elt:d.elt,requestConfig:{verb:'get',path:d.path}});
    });
  });
  // htmx history misses and redirects can return a page other than the requested route.
  function mount() {
    const name = route(location.href),source = document.getElementById('content');
    if (!name || window[modules[name]] || source?.querySelector('[data-site-error]')) return;
    load(name).then(() => window.ihawkRoutes?.hydrate()).catch(() => {if(source===document.getElementById('content'))window.ihawkSitePages?.showOffline({target:source,requestConfig:{verb:'get',path:location.href}});});
  }
  window.addEventListener('popstate',event => {
    if (replayingHistory) return;
    const version = ++navigation,name = route(location.href);
    if (!name || ready(name)) return;
    event.stopImmediatePropagation();
    load(name).then(() => {
      if(version!==navigation)return;
      replayingHistory=true;
      try{window.dispatchEvent(new PopStateEvent('popstate',{state:event.state}));}finally{replayingHistory=false;}
    }).catch(() => {
      if(version===navigation)window.ihawkSitePages?.showOffline({target:document.getElementById('content'),skipSource:true,requestConfig:{verb:'get',path:location.href}});
    });
  },{capture:true});
  document.addEventListener('htmx:historyRestore',mount);document.addEventListener('htmx:afterSettle',mount);
  window.ihawkPageAssets = {load};
  mount();
})();
