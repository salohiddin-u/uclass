/* Campus UI interactions only.
 * Course names, scores, attendance, files and sections live in the HTML.
 * This file does not fetch or render application data.
 */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const all = selector => [...document.querySelectorAll(selector)];
  const read = (key, fallback) => {
    try { return JSON.parse(localStorage.getItem('campus-static-' + key)) ?? fallback; }
    catch { return fallback; }
  };
  const write = (key, value) => {
    try { localStorage.setItem('campus-static-' + key, JSON.stringify(value)); }
    catch { /* The interface remains usable if browser storage is disabled. */ }
  };
  let saved = read('saved', []);
  let completed = read('completed', []);
  let toastTimer;

  function toast(message) {
    $('toast').textContent = message;
    $('toast').classList.remove('hidden');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => $('toast').classList.add('hidden'), 2500);
  }

  function theme(dark) {
    document.documentElement.classList.toggle('dark', dark);
    $('theme').textContent = dark ? '☀' : '☾';
    $('theme').setAttribute('aria-label', dark ? 'Use light mode' : 'Use dark mode');
    $('theme').setAttribute('aria-pressed', String(dark));
    write('dark', dark);
  }
  theme(read('dark', false));
  $('theme').addEventListener('click', () => theme(!document.documentElement.classList.contains('dark')));

  function menu(open, returnFocus = true) {
    $('sidebar').inert = !open && innerWidth < 1024;
    $('sidebar').classList.toggle('-translate-x-full', !open);
    $('overlay').classList.toggle('hidden', !open);
    $('openMenu').setAttribute('aria-expanded', String(open));
    if (open) $('closeMenu').focus();
    else if (returnFocus) $('openMenu').focus();
  }
  function resize() {
    if (innerWidth >= 1024) menu(false, false);
    $('sidebar').inert = innerWidth < 1024 && $('overlay').classList.contains('hidden');
  }
  $('openMenu').addEventListener('click', () => menu(true));
  $('closeMenu').addEventListener('click', () => menu(false));
  $('overlay').addEventListener('click', () => menu(false));
  window.addEventListener('resize', resize);
  resize();

  function syncSaved() {
    all('[data-bookmark]').forEach(button => {
      const marked = saved.includes(button.dataset.bookmark);
      button.setAttribute('aria-pressed', String(marked));
      button.classList.toggle('text-amber-500', marked);
      button.classList.toggle('text-slate-400', !marked);
      button.setAttribute('aria-label', button.getAttribute('aria-label').replace(/^(Save|Unsave)/, marked ? 'Unsave' : 'Save'));
    });
  }

  function filterCourses() {
    if (!$('courseResults')) return;
    const query = $('courseSearch').value.trim().toLowerCase();
    const filter = $('courseFilter').value;
    const cards = all('.course-card');
    cards.forEach(card => {
      const matchesText = card.textContent.toLowerCase().includes(query);
      const matchesFilter = filter === 'all'
        || filter === 'saved' && saved.includes(card.dataset.courseId)
        || filter === 'attention' && (Number(card.dataset.grade) < 75 || Number(card.dataset.attendance) < 75);
      card.hidden = !(matchesText && matchesFilter);
    });
    const sort = $('courseSort').value;
    cards.sort((a, b) => sort === 'grade'
      ? Number(b.dataset.grade) - Number(a.dataset.grade)
      : sort === 'attendance'
      ? Number(a.dataset.attendance) - Number(b.dataset.attendance)
      : a.querySelector('h3').textContent.trim().localeCompare(b.querySelector('h3').textContent.trim()));
    cards.forEach(card => $('courseResults').append(card));
    const count = cards.filter(card => !card.hidden).length;
    $('courseResultCount').textContent = `${count} courses found`;
    $('courseEmpty').hidden = count !== 0;
  }

  function layout(mode) {
    if (!$('courseResults')) return;
    $('courseResults').classList.toggle('course-list', mode === 'list');
    all('[data-layout]').forEach(button => {
      const active = button.dataset.layout === mode;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    });
    write('layout', mode);
  }

  function filterResults() {
    if (!$('resultSearch')) return;
    const query = $('resultSearch').value.trim().toLowerCase();
    const rows = all('[data-result-row]');
    rows.forEach(row => {
      row.hidden = !row.textContent.toLowerCase().includes(query)
        || $('resultFilter').value === 'attention' && Number(row.dataset.score) >= 75;
    });
    $('resultsEmpty').hidden = rows.some(row => !row.hidden);
  }

  function tab(id, updateHash = false) {
    const panel = $(id);
    if (!panel || !panel.hasAttribute('data-tab-panel')) return;
    all('[data-tab-panel]').forEach(item => { item.hidden = item.id !== id; });
    all('[data-tab-target]').forEach(button => {
      const active = button.dataset.tabTarget === id;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    });
    // Fragment links also work when opening a course from the gradebook.
    if (updateHash) history.replaceState(null, '', '#' + id);
  }
  window.addEventListener('hashchange', () => tab(location.hash.slice(1)));

  function syncCompletion() {
    const checkboxes = all('[data-complete]');
    checkboxes.forEach(box => { box.checked = completed.includes(box.dataset.complete); });
    if ($('completionCount')) {
      $('completionCount').textContent = `${checkboxes.filter(box => box.checked).length} / ${checkboxes.length}`;
    }
  }

  function exportTable(button) {
    const table = $(button.dataset.exportTable);
    const rows = [...table.querySelectorAll('tr')].filter(row => !row.hidden);
    const cell = text => {
      let value = text.replace(/\s+/g, ' ').trim();
      if (/^[=+\-@\t\r]/.test(value)) value = "'" + value;
      return '"' + value.replace(/"/g, '""') + '"';
    };
    const csv = rows.map(row => [...row.querySelectorAll('th,td')].map(c => cell(c.textContent)).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = button.dataset.exportName || 'export.csv';
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast('CSV exported');
  }

  document.addEventListener('click', event => {
    const button = event.target.closest('button');
    if (!button) return;
    const data = button.dataset;
    if (data.bookmark) {
      saved = saved.includes(data.bookmark) ? saved.filter(id => id !== data.bookmark) : [...saved, data.bookmark];
      write('saved', saved);
      syncSaved();
      filterCourses();
      toast(saved.includes(data.bookmark) ? 'Course saved' : 'Course removed from saved');
    }
    if (data.layout) layout(data.layout);
    if (data.tabTarget) tab(data.tabTarget, true);
    if (data.openDialog) $(data.openDialog)?.showModal();
    if ('closeDialog' in data) button.closest('dialog')?.close();
    if (data.exportTable) exportTable(button);
    if ('focus' in data) {
      const active = document.body.classList.toggle('focus-mode');
      all('[data-focus]').forEach(item => {
        item.textContent = active ? 'Exit focus mode' : 'Focus mode';
        item.setAttribute('aria-pressed', String(active));
      });
    }
  });

  document.addEventListener('input', event => {
    if (event.target.id === 'courseSearch') filterCourses();
    if (event.target.id === 'resultSearch') filterResults();
  });
  document.addEventListener('change', event => {
    if (['courseFilter', 'courseSort'].includes(event.target.id)) filterCourses();
    if (event.target.id === 'resultFilter') filterResults();
    if (event.target.dataset.complete) {
      const key = event.target.dataset.complete;
      completed = event.target.checked ? [...new Set([...completed, key])] : completed.filter(id => id !== key);
      write('completed', completed);
      syncCompletion();
      toast(event.target.checked ? 'Section marked complete' : 'Section marked incomplete');
    }
  });

  all('dialog').forEach(dialog => dialog.addEventListener('click', event => {
    if (event.target !== dialog) return;
    const r = dialog.getBoundingClientRect();
    if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) dialog.close();
  }));
  document.addEventListener('keydown', event => {
    const menuOpen = !$('overlay').classList.contains('hidden');
    if (event.key === 'Escape' && menuOpen) menu(false);
    if (event.key === 'Tab' && menuOpen) {
      const items = [...$('sidebar').querySelectorAll('a,button')].filter(item => item.getClientRects().length);
      const first = items[0], last = items.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
    if (event.key === '/' && !['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName) && !document.querySelector('dialog[open]')) {
      const input = $('courseSearch') || $('resultSearch');
      if (input) { event.preventDefault(); input.focus(); }
    }
  });
  syncSaved();
  syncCompletion();
  layout(read('layout', 'grid'));
  filterCourses();
  filterResults();
  tab(location.hash.slice(1) || 'sections');
})();
