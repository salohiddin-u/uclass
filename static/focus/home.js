/* Phase D / Home. Presentation only: no sample records, storage, fetches or backend dependency. */
(() => {
  'use strict';
  if (window.ihawkHome) return;
  const zone = 'Asia/Tashkent';
  const reduced = matchMedia('(prefers-reduced-motion:reduce)');
  let data = null, state = 'ready', version = 0, loader = null, loadVersion = 0;
  const $ = (selector, parent = document) => parent.querySelector(selector);
  const $$ = (selector, parent = document) => [...parent.querySelectorAll(selector)];
  const numeric = value => {
    if (value === null || value === undefined || typeof value === 'boolean' || String(value).trim() === '') return null;
    const result = Number(value);
    return Number.isFinite(result) ? result : null;
  };
  const boundedPercent = value => {const number=numeric(value);return number!==null&&number>=0&&number<=100?number:null;};
  const clean = value => value === null || value === undefined ? '' : String(value).trim();
  const format = value => Number.isInteger(value) ? String(value) : value.toFixed(1);
  const now = () => new Date();
  const dateKey = value => new Intl.DateTimeFormat('en-CA', {timeZone: zone, year:'numeric', month:'2-digit', day:'2-digit'}).format(value);
  const clock = value => new Intl.DateTimeFormat('en-GB', {timeZone: zone, hour:'2-digit', minute:'2-digit'}).format(value);
  const dateLabel = value => new Intl.DateTimeFormat('en-GB', {timeZone: zone, weekday:'short', day:'numeric', month:'short'}).format(value);
  function instant(value) {
    // ISO instants must include an offset; a timezone-less due date is not guessed.
    if (typeof value !== 'string' || !/(?:Z|[+-]\d{2}:?\d{2})$/i.test(value)) return null;
    const parsed = new Date(value);
    return Number.isFinite(parsed.getTime()) ? parsed : null;
  }
  function node(tag, className = '', text = '') {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (text !== '') el.textContent = String(text);
    return el;
  }
  function icon(name, className = '') {
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    for (const [key, value] of Object.entries({class:`focus-icon ${className}`.trim(), 'aria-hidden':'true', focusable:'false', viewBox:'0 0 24 24', fill:'none', stroke:'currentColor', 'stroke-width':'1.75', 'stroke-linecap':'round', 'stroke-linejoin':'round'})) svg.setAttribute(key, value);
    const use = document.createElementNS(ns, 'use');
    use.setAttribute('href', '#fi-' + name); svg.append(use); return svg;
  }
  function link(text, href, className = '') {
    const el = node('a', className, text); el.href = safeHref(href); return el;
  }
  function safeHref(value, fallback = 'courses.html') {
    value=window.ihawkRoutes?.resolve(value)||value;fallback=window.ihawkRoutes?.resolve(fallback)||fallback;
    if (!value) return fallback;
    try {
      const url = new URL(value, location.href);
      if (location.protocol === 'file:') return url.protocol === 'file:' && !url.search.includes('javascript:') ? url.href : fallback;
      return ['http:', 'https:'].includes(url.protocol) && url.origin === location.origin ? url.href : fallback;
    } catch { return fallback; }
  }
  function courseHref(course) {
    const fallback = course.id !== undefined ? 'course-detail.html?id=' + encodeURIComponent(course.id) : 'course-detail.html';
    return safeHref(course.href, fallback);
  }
  function percentage(value, maximum) {
    const score = numeric(value), max = numeric(maximum);
    return score !== null && max !== null && max > 0 ? Math.min(100, Math.max(0, score / max * 100)) : null;
  }
  function title(course) {
    const text = clean(course.name || course.title);
    if (text) return text;
    console.warn('[ihawk Home] Missing course title', {courseId: course.id ?? null});
    return 'Untitled course';
  }
  function normalize(input) {
    const source = input && typeof input === 'object' ? input : {};
    const courses = (Array.isArray(source.courses) ? source.courses : []).filter(c => c && typeof c === 'object').map(c => ({...c, displayTitle:title(c), percent:percentage(c.grade, c.grade_max), attendanceValue:boundedPercent(c.attendance)}));
    const assignments = (Array.isArray(source.assignments) ? source.assignments : []).filter(a => a && typeof a === 'object').map(a => ({...a, date:instant(a.due_at), status:clean(a.status_label || a.status).toLowerCase()}));
    const lessons = (Array.isArray(source.lessons) ? source.lessons : []).filter(l => l && typeof l === 'object').map(l => ({...l, start:instant(l.starts_at), end:instant(l.ends_at)})).filter(l => l.start && l.end && l.end > l.start).sort((a,b) => a.start - b.start);
    const summary = source.summary && typeof source.summary === 'object' ? source.summary : {};
    const graded = courses.filter(c => c.percent !== null);
    let average = boundedPercent(summary.grade);
    if (average === null && graded.length && graded.every(c => numeric(c.credits) > 0)) average = graded.reduce((sum,c) => sum + c.percent * numeric(c.credits), 0) / graded.reduce((sum,c) => sum + numeric(c.credits), 0);
    let attendance = boundedPercent(summary.attendance);
    const sessions = Array.isArray(source.sessions) ? source.sessions : [];
    if (attendance === null && sessions.length && sessions.every(s => s && numeric(s.points) !== null && numeric(s.maximum) > 0)) attendance = percentage(sessions.reduce((sum,s) => sum + numeric(s.points),0), sessions.reduce((sum,s) => sum + numeric(s.maximum),0));
    const pending = a => ['upcoming','pending','overdue','not submitted'].includes(a.status);
    const time = now();
    const dueSoon = assignments.filter(a => pending(a) && a.date && a.date - time <= 7*86400000).sort((a,b) => a.date-b.date);
    let upcoming = numeric(summary.upcoming_assignments);
    if(upcoming!==null&&(!Number.isInteger(upcoming)||upcoming<0))upcoming=null;
    if (upcoming === null && assignments.some(a => a.date && a.status)) upcoming = assignments.filter(a => pending(a) && a.date >= time).length;
    const finalProjectsWithoutDates = assignments.some(a => !a.date && (a.type === 'final_project' || /final project/i.test(a.title || '')));
    const supplied = courses.length || assignments.length || lessons.length || sessions.length || average!==null || attendance!==null || upcoming>0;
    return {courses, assignments, lessons, average, attendance, upcoming, dueSoon, gradedCount:graded.length, finalProjectsWithoutDates, hasRecords:!!supplied, student:source.student || {}};
  }
  function greeting(student={}) {
    const el=$('#home-greeting');if(!el)return;
    const name=clean(student.first_name).split(/\s+/)[0];
    el.textContent=(name?name+' · ':'')+dateLabel(now());
  }


  function stat(label,value,unit,note,href) {
    if(value===null)return null;
    const card=link('',href,'home-stat');card.setAttribute('aria-label',label+': '+format(value)+(unit||''));
    card.append(node('span','home-stat-label',label));
    const reading=node('span','home-stat-reading'),number=node('span','home-stat-number'),count=node('span');
    count.dataset.countup=format(value);count.append(node('span','sr-only',format(value)));
    const visual=node('span','',format(value));visual.dataset.countVisual='';visual.setAttribute('aria-hidden','true');count.append(visual);number.append(count);
    if(unit)number.append(node('small','',unit));reading.append(number);card.append(reading);
    if(note)card.append(node('span','home-stat-note',note));return card;
  }
  function courseRow(course) {
    const row=link('',courseHref(course),'home-course course-data-row'),copy=node('span','home-course-copy');
    copy.append(node('strong','',course.displayTitle));
    const meta=[];if(clean(course.instructor))meta.push(clean(course.instructor));if(numeric(course.credits)!==null)meta.push(format(numeric(course.credits))+' credits');if(clean(course.semester))meta.push('Semester '+clean(course.semester));
    if(meta.length)copy.append(node('span','home-course-meta',meta.join(' · ')));
    const attendance=node('span','course-attendance'+(course.attendanceValue!==null&&course.attendanceValue<75?' is-risk':''),course.attendanceValue===null?'—':format(course.attendanceValue)+'%');
    attendance.setAttribute('aria-label','Attendance: '+(course.attendanceValue===null?'not available':format(course.attendanceValue)+' percent')+(course.attendanceValue!==null&&course.attendanceValue<75?', at risk':''));
    if(course.attendanceValue!==null&&course.attendanceValue<75){attendance.prepend(icon('warning'));attendance.title='Attendance below 75%'}
    const value=numeric(course.grade),maximum=numeric(course.grade_max),grade=node('span','course-grade',value===null?'—':format(value));
    if(value!==null&&maximum!==null)grade.append(node('small','',' / '+format(maximum)));
    grade.setAttribute('aria-label',value===null?'Grade not available':'Grade: '+format(value)+(maximum!==null?' out of '+format(maximum):''));
    row.append(copy,attendance,grade);return row;
  }
  function sectionLink(text,href){return link(text,href,'home-section-link');}
  function emptyLine(text){return node('p','home-inline-empty',text);}
  function classMeta(lesson) {const parts=[];if(clean(lesson.room))parts.push(clean(lesson.room));if(clean(lesson.instructor))parts.push(clean(lesson.instructor));return parts.join(' · ');}
  function lessonHref(lesson) {return safeHref(lesson.href,lesson.course_id!==undefined?'course-detail.html?id='+encodeURIComponent(lesson.course_id):'timetable.html');}
  function renderNext(model,root) {
    const time=now(),next=model.lessons.find(l=>l.start>=time),today=model.lessons.filter(l=>dateKey(l.start)===dateKey(time));
    const nextRoot=$('[data-next-class]',root);
    if(next){const block=node('div','home-next-class'),timing=node('div','home-next-date');timing.append(node('strong','',clock(next.start)),node('span','',dateKey(next.start)===dateKey(time)?'Today':dateLabel(next.start)));block.append(timing,link(clean(next.course_name)||'Untitled course',lessonHref(next),'home-class-name'));const meta=classMeta(next);if(meta)block.append(node('span','home-class-meta',meta));nextRoot.append(block)}else nextRoot.append(emptyLine('No upcoming class.'));
    nextRoot.append(sectionLink('Timetable','timetable.html'));
    const todayRoot=$('[data-today-classes]',root);todayRoot.hidden=!today.length;
    if(today.length){todayRoot.append(node('h4','','Today’s classes'));const list=node('ul','home-today-list');for(const lesson of today.slice(0,3)){const item=node('li'),copy=node('div','home-today-copy');copy.append(link(clean(lesson.course_name)||'Untitled course',lessonHref(lesson)));if(clean(lesson.room))copy.append(node('small','',clean(lesson.room)));item.append(node('time','home-today-time',clock(lesson.start)),copy);item.querySelector('time').dateTime=lesson.starts_at;list.append(item)}todayRoot.append(list)}
    const dueRoot=$('[data-due-soon]',root);
    if(model.dueSoon.length){const list=node('ul','home-due-list');for(const assignment of model.dueSoon.slice(0,3)){const item=node('li');item.append(link(clean(assignment.title)||'Untitled assignment',safeHref(assignment.href,'assignments.html')));const meta=node('span','home-due-meta');const overdue=assignment.date<time,date=node('time','home-due-date'+(overdue?' is-risk':''),(overdue?'Overdue · ':'')+(dateKey(assignment.date)===dateKey(time)?'Today, '+clock(assignment.date):dateLabel(assignment.date)));date.dateTime=assignment.due_at;meta.append(date);if(clean(assignment.course_name))meta.append(node('span','',clean(assignment.course_name)));item.append(meta);list.append(item)}dueRoot.append(list)}else dueRoot.append(emptyLine(model.assignments.some(a=>!a.date)?'No dated deadlines this week.':'Nothing due this week.'));
    dueRoot.append(sectionLink('Assignments','assignments.html'));
  }
  function attention(model,root) {
    const box=$('.home-attention',root),list=$('.home-attention-links',box),risk=model.courses.filter(c=>c.attendanceValue!==null&&c.attendanceValue<75).sort((a,b)=>a.attendanceValue-b.attendanceValue);
    if(risk.length){const items=node('ul','home-risk-list');for(const course of risk.slice(0,3)){const item=node('li'),a=link(course.displayTitle,courseHref(course));item.append(a,node('span','is-risk',format(course.attendanceValue)+'% attendance'));items.append(item)}list.append(items)}else list.append(emptyLine(model.courses.some(c=>c.attendanceValue!==null)?'No risks in recorded attendance.':'No attendance recorded.'));
    list.append(sectionLink('Attendance','attendance.html'));
  }
  function pageState(kind) {
    const card=node('section','ui-card home-page-state'+(kind==='error'?' home-error':''));
    const mark=node('span','home-state-icon');mark.setAttribute('aria-hidden','true');mark.append(icon(kind==='error'?'warning':'book'));card.append(mark);
    const heading=node('h2','',kind==='error'?'Could not load Home.':'No records yet.');heading.id='home-state-title';card.setAttribute('aria-labelledby',heading.id);card.append(heading);

    if(kind==='error'){const retry=node('button','ui-button ui-button--primary','Try again');retry.type='button';retry.dataset.homeRetry='';card.append(retry)}else{const a=link('View courses','courses.html','ui-button ui-button--primary');a.append(icon('arrow'));card.append(a)}
    return card;
  }
  function skeleton() {
    const fragment=$('#home-layout-template').content.cloneNode(true),overview=$('.home-overview',fragment);
    overview.setAttribute('aria-label','Loading academic overview');
    for(let i=0;i<4;i++){const card=node('div','home-stat');card.setAttribute('aria-hidden','true');card.append(node('span','home-stat-label'),node('span','home-stat-reading'),node('span','home-stat-note'));overview.append(card)}
    const list=$('.home-course-list',fragment);
    for(let i=0;i<4;i++){const row=node('div','home-course');row.setAttribute('aria-hidden','true');const copy=node('div','home-course-copy');copy.append(node('span','skeleton-line'),node('span','skeleton-line skeleton-line--short'));row.append(node('span','skeleton-line'),copy,node('span','skeleton-line'));list.append(row)}
    for(const part of $$('.home-next-part',fragment)){const shimmer=node('div','ui-skeleton');shimmer.setAttribute('aria-hidden','true');shimmer.append(node('span','skeleton-line skeleton-line--short'),node('span','skeleton-line skeleton-line--large'),node('span','skeleton-line'));part.append(shimmer)}
    for(const button of $$('[data-home-part]',fragment))button.disabled=true;
    $('[data-all-courses]',fragment).hidden=true;
    const message=node('span','sr-only','Loading your workspace.');message.setAttribute('role','status');fragment.append(message);return fragment;
  }
  function render(force=false) {
    const root=$('#home-workspace');if(!root)return;
    const model=normalize(data);root.removeAttribute('data-home-pending');greeting(model.student);
    if(!force&&root.dataset.version===String(version)){return}
    const previousState=root.dataset.state;window.ihawkFocusUI?.cleanup?.(root);root.replaceChildren();root.dataset.version=String(version);root.classList.toggle('home-loading',state==='loading');root.setAttribute('aria-busy',String(state==='loading'));
    if(state==='loading'){root.dataset.state='loading';root.append(skeleton())}
    else if(state==='error'){root.dataset.state='error';root.append(pageState('error'))}
    else if(!model.hasRecords){root.dataset.state='empty';root.append(pageState('empty'))}
    else {
      root.dataset.state='ready';const fragment=$('#home-layout-template').content.cloneNode(true);root.append(fragment);
      const overview=$('.home-overview',root);
      overview.append(...[stat('Current average',model.average,'%',model.average===null?'No current grade available':model.gradedCount?`Across ${model.gradedCount} graded ${model.gradedCount===1?'course':'courses'}`:'Current course average','grades.html',true),stat('Overall attendance',model.attendance,'%',model.attendance===null?'No attendance recorded':'Recorded sessions only','attendance.html',true),stat('Active courses',model.courses.length,'','Enrolled courses','courses.html'),stat('Upcoming assignments',model.upcoming,'',model.finalProjectsWithoutDates?'Final projects · due dates not supplied':model.upcoming===null?'Due dates not supplied':'With due dates','assignments.html')].filter(Boolean));
      const list=$('.home-course-list',root);if(model.courses.length){for(const course of model.courses.slice(0,8))list.append(courseRow(course))}else{const empty=node('div','home-empty-courses');empty.append(node('span','','No courses listed.'),sectionLink('View courses','courses.html'));list.append(empty)}
      $('[data-all-courses]',root).firstChild.textContent=`View all ${model.courses.length} `;
      attention(model,root);renderNext(model,root);
    }
    window.ihawkFocusUI?.init(root);
    if(previousState==='loading'&&root.dataset.state==='ready')root.animate([{opacity:0},{opacity:1}],{duration:reduced.matches?120:200,easing:'ease-out'});
    document.dispatchEvent(new CustomEvent('ihawk:home-rendered',{detail:{state:root.dataset.state}}));
  }
  function setData(value){loadVersion++;data=value;state='ready';version++;render();document.dispatchEvent(new CustomEvent('ihawk:home-data-changed',{detail:value}));}
  function setLoading(){state='loading';version++;render();}
  function setError(){loadVersion++;state='error';version++;render();const announcement=$('#home-announcement');if(announcement)announcement.textContent='Could not load your workspace. Try again.';}
  async function load(provider){if(typeof provider!=='function')throw new TypeError('ihawkHome.load expects a function returning your data.');loader=provider;const request=++loadVersion;setLoading();try{const value=await provider();if(request===loadVersion)setData(value)}catch{if(request===loadVersion)setError()}}
  document.addEventListener('click',event=>{const button=event.target.closest('button');if(!button)return;if(button.hasAttribute('data-home-retry')){if(loader)load(loader);else document.dispatchEvent(new CustomEvent('ihawk:home-retry'))}});
  document.addEventListener('ihawk:home-data',event=>setData(event.detail));
  document.addEventListener('htmx:afterSwap',event=>{if(event.detail.target?.id==='content'||event.detail.elt?.id==='content')render()});
  document.addEventListener('htmx:historyRestore',()=>render());
  window.ihawkHome={getData:()=>data,setData,setLoading,setError,load,render};
  if(window.ihawkHomeData)setData(window.ihawkHomeData);else {window.ihawkRoutes?.hydrate();if(data===null)render()}
})();
