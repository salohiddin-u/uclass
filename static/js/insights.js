/* Chart interactions only. Course and session records are prewritten in HTML.
 * No requests or application-data arrays. Projections read the displayed scenario.
 */
window.uclassInitInsights=() => {
  'use strict';window.uclassInitInsightsController?.abort();const lifecycle=new AbortController();window.uclassInitInsightsController=lifecycle;
  if (window.lucide) lucide.createIcons({attrs:{'aria-hidden':'true','stroke-width':1.7}});
  const order = document.getElementById('grade-chart-order');
  if (order) {
    const columns = document.getElementById('grade-columns');
    [...columns.children].forEach((column,index) => { column.dataset.originalOrder = index; });
    order.addEventListener('change', () => {
      const sorted = [...columns.children].sort((a,b) => order.value === 'highest'
        ? Number(b.dataset.grade) - Number(a.dataset.grade)
        : order.value === 'lowest' ? Number(a.dataset.grade) - Number(b.dataset.grade)
        : Number(a.dataset.originalOrder) - Number(b.dataset.originalOrder));
      sorted.forEach(column => columns.append(column));
    }, {signal: lifecycle.signal});
  }
  const cells = [...document.querySelectorAll('[data-session-status]')];
  document.querySelectorAll('[data-session-filter]').forEach(button => button.addEventListener('click', () => {
    const status = button.dataset.sessionFilter;
    document.querySelectorAll('[data-session-filter]').forEach(item => item.setAttribute('aria-pressed',String(item === button)));
    cells.forEach(cell => cell.classList.toggle('is-muted',status !== 'all' && cell.dataset.sessionStatus !== status));
    const count = cells.filter(cell => status === 'all' || cell.dataset.sessionStatus === status).length;
    document.getElementById('session-filter-status').textContent = status === 'all'
      ? `Showing all ${count} recorded sessions.`
      : `Highlighting ${count} ${status === 'absent' ? 'absences' : 'late arrivals'}; other sessions remain visible.`;
  }, {signal: lifecycle.signal}));
  cells.forEach(cell => cell.addEventListener('click', () => {
    cells.forEach(item => item.setAttribute('aria-pressed',String(item === cell)));
    document.getElementById('session-detail-course').textContent = cell.dataset.sessionCourse;
    document.getElementById('session-detail-date').textContent = cell.dataset.sessionDate;
    document.getElementById('session-detail-time').textContent = cell.dataset.sessionTime;
    const status = cell.dataset.sessionStatus;
    const badge = document.getElementById('session-detail-status');
    badge.textContent = status[0].toUpperCase() + status.slice(1);
    badge.className = 'session-detail-status session-' + status;
    document.getElementById('session-detail-link').href = cell.dataset.sessionHref;
  }, {signal: lifecycle.signal}));
};window.uclassInitInsights();
