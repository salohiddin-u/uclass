/* Timetable: progressive enhancement of the existing weekly Django context. */
(() => {
  'use strict';
  if (window.ihawkTimetable) return;
  const $=(s,r=document)=>r.querySelector(s),all=(s,r=document)=>[...r.querySelectorAll(s)];
  const zone='Asia/Tashkent',phone=matchMedia('(max-width:599px)'),fine=matchMedia('(hover:hover) and (pointer:fine)'),reduce=matchMedia('(prefers-reduced-motion:reduce)');
  const warned=new Set(),colors=new Map();
  const palette=[['var(--accent)','var(--accent-soft)'],['var(--cool)','var(--cool-soft)'],['var(--good)','var(--good-soft)'],['var(--info)','var(--info-soft)'],['var(--series-5)','rgba(199,169,245,.14)']];
  let ctx=null,clock=0,gesture=null,ignoreClickUntil=0,previewOwner=null;
  const clean=v=>v==null?'':String(v).trim();
  function node(tag,cls='',text=''){const e=document.createElement(tag);if(cls)e.className=cls;if(text!=='')e.textContent=String(text);return e;}
  function icon(name){const ns='http://www.w3.org/2000/svg',s=document.createElementNS(ns,'svg'),use=document.createElementNS(ns,'use');for(const[k,v]of Object.entries({class:'focus-icon','aria-hidden':'true',viewBox:'0 0 24 24',fill:'none',stroke:'currentColor','stroke-width':'1.75','stroke-linecap':'round','stroke-linejoin':'round'}))s.setAttribute(k,v);use.setAttribute('href','#fi-'+name);s.append(use);return s;}
  function warn(key,text,detail){if(warned.has(key))return;warned.add(key);console.warn('[ihawk Timetable] '+text,detail);}
  function validDate(s){return /^\d{4}-\d{2}-\d{2}$/.test(s)&&Number.isFinite(Date.parse(s+'T12:00:00Z'))&&new Date(s+'T12:00:00Z').toISOString().slice(0,10)===s;}
  function addDays(key,n){const d=new Date(key+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);}
  function label(key,options){if(!validDate(key))return'';return new Intl.DateTimeFormat('en-GB',{...options,timeZone:'UTC'}).format(new Date(key+'T12:00:00Z'));}
  const dayLabel=key=>label(key,{weekday:'long',day:'numeric',month:'short'});
  const timeLabel=m=>String(Math.floor(m/60)).padStart(2,'0')+':'+String(m%60).padStart(2,'0');
  function civil(value,defaultDay=''){
    const v=clean(value);if(!v)return null;
    const short=/^(\d{2}):(\d{2})(?::\d{2})?$/.exec(v);
    if(short&&+short[1]<24&&+short[2]<60&&validDate(defaultDay))return{date:defaultDay,minute:+short[1]*60+ +short[2],raw:v};
    if(validDate(v))return{date:v,minute:null,raw:v};
    const naive=/^(\d{4}-\d{2}-\d{2})[T ](\d{2}):(\d{2})(?::\d{2}(?:\.\d+)?)?$/.exec(v);
    if(naive&&validDate(naive[1])&&+naive[2]<24&&+naive[3]<60)return{date:naive[1],minute:+naive[2]*60+ +naive[3],raw:v};
    if(!/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:?\d{2})$/i.test(v)||!Number.isFinite(Date.parse(v)))return null;
    const p=Object.fromEntries(new Intl.DateTimeFormat('en-GB',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(v)).map(p=>[p.type,p.value]));
    return{date:`${p.year}-${p.month}-${p.day}`,minute:+p.hour*60+ +p.minute,raw:v};
  }
  function now(){return civil(new Date().toISOString());}
  function period(r,withDate=false){
    const stamp=t=>t&&t.minute!=null?(withDate?label(t.date,{day:'numeric',month:'short'})+' ':'')+timeLabel(t.minute):'';
    const start=stamp(r.start),end=stamp(r.end);
    if(start&&end)return start+' – '+end;
    if(start)return start;
    if(end)return'Until '+end;
    return r.timeLabel;
  }
  function renderTime(r){
    const root=$('.tt-lesson-time',r.el);root.replaceChildren();
    const hasStart=r.start?.minute!=null,hasEnd=r.end?.minute!=null,cross=!!(r.start&&r.end&&r.start.date!==r.end.date),dateMismatch=r.start?.date&&r.start.date!==r.day.date;
    if(cross||dateMismatch){root.append(node('span','',period(r,true)));}
    else if(hasStart){const t=node('time','',timeLabel(r.start.minute));t.dateTime=r.start.raw;root.append(t);if(hasEnd){root.append(node('span','tt-time-separator','–'));const t=node('time','',timeLabel(r.end.minute));t.dateTime=r.end.raw;root.append(t);}}
    else root.append(node('span','',period(r)));
    root.hidden=!root.textContent.trim();r.el.dataset.hasTime=String(!root.hidden);
  }
  function makeDay(date){const el=node('section','tt-day');el.dataset.ttDay='';el.dataset.date=date;const heading=node('header','tt-day-heading');heading.append(node('h2'));el.append(heading,node('div','tt-day-events'));const other=node('div','tt-day-other');other.hidden=true;el.append(other);ctx.grid.append(el);return{el,date,records:[],events:$('.tt-day-events',el),other,heading};}
  function readDays(){
    ctx.days=all('[data-tt-day]',ctx.root).map(el=>({el,date:clean(el.dataset.date),records:[],events:$('.tt-day-events',el),other:$('.tt-day-other',el),heading:$('.tt-day-heading',el)}));
    const first=validDate(ctx.root.dataset.weekStart)?ctx.root.dataset.weekStart:ctx.days.find(d=>validDate(d.date))?.date;
    ctx.validWeek=!!first&&ctx.days.every(d=>validDate(d.date)&&d.date>=first&&d.date<addDays(first,7))&&new Set(ctx.days.map(d=>d.date)).size===ctx.days.length;
    if(ctx.validWeek){for(let i=0;i<7;i++){const date=addDays(first,i);if(!ctx.days.some(d=>d.date===date))ctx.days.push(makeDay(date));}ctx.days.sort((a,b)=>a.date.localeCompare(b.date));for(const d of ctx.days)ctx.grid.append(d.el);}
    else warn('dates:'+ctx.path,'Incomplete or inconsistent week dates; showing an agenda instead of inferring calendar positions.',{});
    ctx.week.dataset.validWeek=String(ctx.validWeek);
    for(const [index,d]of ctx.days.entries()){d.el.id='tt-day-'+(validDate(d.date)?d.date:index);const h=$('h2',d.heading);h.replaceChildren();if(validDate(d.date))h.append(node('span','',label(d.date,{weekday:'short'})),node('strong','',label(d.date,{day:'numeric'})));else h.append(node('span','','Sessions'));}
  }
  function readRecords(){
    const source=[];for(const day of ctx.days)for(const el of all('[data-tt-lesson]',day.el))source.push({el,day});
    for(const [index,{el,day:originalDay}]of source.entries()){
      const d=el.dataset,title=clean(d.title)||'Untitled course',start=civil(d.start,originalDay.date),end=civil(d.end,start?.date||originalDay.date);
      if(!clean(d.title))warn('title:'+(d.courseId||index),'Missing course title',{courseId:d.courseId});
      const day=ctx.days.find(day=>day.date===start?.date)||originalDay;
      const r={el,index,day,title,start,end,room:clean(d.room),instructor:clean(d.instructor),timeLabel:clean(d.timeLabel),key:clean(d.courseId)||title};
      r.timed=ctx.validWeek&&!!(start&&end&&start.minute!=null&&end.minute!=null&&start.date===day.date&&end.date===day.date&&end.minute>start.minute);
      if((d.start||d.end)&&(!start||!end))warn('time:'+d.courseId+':'+d.start+':'+d.end,'Missing or unrecognized time; keeping the session in the agenda.',{courseId:d.courseId});
      if(!colors.has(r.key))colors.set(r.key,palette[colors.size%palette.length]);const [ink,soft]=colors.get(r.key);el.style.setProperty('--event-ink',ink);el.style.setProperty('--event-soft',soft);
      $('.tt-lesson-copy>strong',el).textContent=title;renderTime(r);
      const full=period(r,true);el.setAttribute('aria-label',[title,validDate(day.date)?dayLabel(day.date):'',full,r.room?'Room '+r.room:'',r.instructor].filter(Boolean).join(', '));
      day.records.push(r);ctx.records.push(r);
      (r.timed?day.events:day.other).append(el);
    }
    for(const day of ctx.days){day.records.sort((a,b)=>(a.start?.minute??Infinity)-(b.start?.minute??Infinity)||a.index-b.index);for(const r of day.records)(r.timed?day.events:day.other).append(r.el);day.other.hidden=!day.records.some(r=>!r.timed);$('h3',day.other)?.remove();if(!day.other.hidden&&day.records.some(r=>r.timed))day.other.prepend(node('h3','','Other sessions'));}
  }
  function layoutGrid(){
    const records=ctx.records.filter(r=>r.timed);ctx.gridMode=ctx.validWeek&&records.length>0;ctx.week.dataset.grid=String(ctx.gridMode);$('.tt-hours',ctx.root).hidden=!ctx.gridMode;
    if(!ctx.gridMode){for(const day of ctx.days)for(const r of day.records)day.other.append(r.el);return;}
    const scale=80/60;ctx.start=Math.floor(Math.min(...records.map(r=>r.start.minute))/60)*60;ctx.end=Math.min(1440,Math.ceil(Math.max(...records.map(r=>Math.max(r.end.minute,r.start.minute+44/scale)))/60)*60);if(ctx.end<=ctx.start)ctx.end=ctx.start+60;
    ctx.week.style.setProperty('--tt-hours',String((ctx.end-ctx.start)/60));const hours=$('.tt-hour-labels',ctx.root);hours.replaceChildren();for(let m=ctx.start;m<=ctx.end;m+=60){const span=node('span','',timeLabel(m));span.style.setProperty('--hour-index',String((m-ctx.start)/60));hours.append(span);}
    const widths=[];
    for(const day of ctx.days){const timed=day.records.filter(r=>r.timed).sort((a,b)=>a.start.minute-b.start.minute||a.end.minute-b.end.minute);let cluster=[],active=[],clusterMax=0,maxLanes=1;
      const finish=()=>{for(const r of cluster){r.el.style.setProperty('--event-lanes',String(clusterMax));r.el.style.setProperty('--event-lane',String(r.lane));}maxLanes=Math.max(maxLanes,clusterMax);cluster=[];clusterMax=0;};
      for(const r of timed){active=active.filter(a=>a.visualEnd>r.start.minute);if(!active.length&&cluster.length)finish();let lane=0;while(active.some(a=>a.lane===lane))lane++;r.lane=lane;r.visualEnd=Math.max(r.end.minute,r.start.minute+44/scale);active.push(r);cluster.push(r);clusterMax=Math.max(clusterMax,active.length,lane+1);const height=Math.max(44,(r.end.minute-r.start.minute)*scale-4);r.el.style.setProperty('--event-top',((r.start.minute-ctx.start)*scale+2)+'px');r.el.style.setProperty('--event-height',height+'px');r.el.dataset.compact=String(height<88);r.el.dataset.oneLine=String(height<74);r.el.dataset.tight=String(height<60);}
      if(cluster.length)finish();widths.push(`minmax(${Math.max(120,maxLanes*120)}px,1fr)`);
    }
    ctx.week.style.setProperty('--tt-columns',widths.join(' '));
    const line=node('div','tt-now');line.setAttribute('aria-hidden','true');line.hidden=true;line.append(node('span'));ctx.grid.append(line);ctx.nowLine=line;
  }
  function serverQuery(){const p=new URLSearchParams(location.search);p.delete('day');p.sort();return p.toString();}
  function selectedFromURL(){const date=new URLSearchParams(location.search).get('day');if(ctx.days.some(d=>d.date===date))return date;const current=now()?.date;return ctx.days.find(d=>d.date===current)?.date||ctx.days[0]?.date;}
  function dayStrip(){const strip=$('.tt-day-strip',ctx.root);strip.replaceChildren();if(!ctx.validWeek)return;for(const d of ctx.days){const b=node('button','tt-day-button');b.type='button';b.id='tt-tab-'+d.date;b.dataset.ttSelect=d.date;b.dataset.hasLessons=String(!!d.records.length);b.setAttribute('role','tab');b.setAttribute('aria-controls',d.el.id);b.setAttribute('aria-label',dayLabel(d.date)+', '+d.records.length+' '+(d.records.length===1?'class':'classes'));b.append(node('span','',label(d.date,{weekday:'short'})),node('strong','',label(d.date,{day:'numeric'})),node('span','tt-day-dot'));strip.append(b);}}
  function selectDay(date,push=false,animate=false,focus=false){
    if(!ctx?.validWeek)return;hidePreview();const selected=ctx.days.find(d=>d.date===date)||ctx.days[0];ctx.selected=selected.date;ctx.root.dataset.selectedDay=selected.date;
    const isPhone=phone.matches;
    for(const day of ctx.days){if(isPhone&&day===selected&&!day.records.length)day.el.setAttribute('aria-describedby','timetable-day-empty');else day.el.removeAttribute('aria-describedby');day.el.hidden=isPhone?day!==selected:!ctx.gridMode&&!day.records.length;if(isPhone){day.el.setAttribute('role','tabpanel');day.el.setAttribute('aria-labelledby','tt-tab-'+day.date);}else{day.el.removeAttribute('role');day.el.removeAttribute('aria-labelledby');}}
    for(const b of all('[data-tt-select]',ctx.root)){const active=b.dataset.ttSelect===selected.date;b.setAttribute('aria-selected',String(active));b.tabIndex=active?0:-1;if(active&&focus)b.focus({preventScroll:true});}
    $('.tt-day-strip',ctx.root).hidden=!isPhone;$('.tt-agenda-heading',ctx.root).hidden=!isPhone;
    $('[data-tt-day-title]',ctx.root).textContent=dayLabel(selected.date);$('[data-tt-day-count]',ctx.root).textContent=selected.records.length+' '+(selected.records.length===1?'class':'classes');$('[data-tt-day-empty]',ctx.root).hidden=!isPhone||!!selected.records.length;
    const scroll=$('.tt-scroll',ctx.root);if(isPhone){scroll.removeAttribute('tabindex');scroll.removeAttribute('role');scroll.removeAttribute('aria-label');}else{scroll.tabIndex=0;scroll.setAttribute('role','region');scroll.setAttribute('aria-label','Weekly schedule, scroll for more times or days');}
    $('#timetable-announcement',ctx.root).textContent=dayLabel(selected.date)+', '+selected.records.length+' '+(selected.records.length===1?'class':'classes')+'.';
    if(animate&&isPhone){selected.el.getAnimations().forEach(a=>a.cancel());selected.el.animate(reduce.matches?[{opacity:0},{opacity:1}]:[{opacity:0,transform:'translateY(6px)'},{opacity:1,transform:'translateY(0)'}],{duration:reduce.matches?100:200,easing:'cubic-bezier(.22,1,.36,1)'});}
    if(push){const url=new URL(location.href);url.searchParams.set('day',selected.date);if(url.href!==location.href)history.pushState({...history.state,htmx:true},'',url);}
  }
  function refreshClock(){if(!ctx?.root.isConnected||document.hidden)return;const current=now();if(!current)return;for(const day of ctx.days)day.el.dataset.today=String(day.date===current.date);all('[data-tt-select]',ctx.root).forEach(b=>{const today=b.dataset.ttSelect===current.date;b.dataset.today=String(today);if(today)b.setAttribute('aria-current','date');else b.removeAttribute('aria-current')});if(ctx.nowLine){const show=ctx.gridMode&&ctx.days.some(d=>d.date===current.date)&&current.minute>=ctx.start&&current.minute<=ctx.end;ctx.nowLine.hidden=!show;if(show){ctx.nowLine.style.setProperty('--now-top',((current.minute-ctx.start)*80/60)+'px');$('span',ctx.nowLine).textContent='Now · '+timeLabel(current.minute);}}}
  function hidePreview(){const preview=$('#timetable-preview');if(preview?.matches(':popover-open'))preview.hidePopover();previewOwner?.removeAttribute('aria-describedby');previewOwner=null;}
  function showPreview(el){if(!ctx?.root.isConnected)return;const r=ctx.records.find(r=>r.el===el),preview=$('#timetable-preview',ctx.root);if(!r||!preview||typeof preview.showPopover!=='function')return;preview.replaceChildren();preview.append(node('strong','',r.title));const meta=[validDate(r.day.date)?dayLabel(r.day.date):'',period(r,true)].filter(Boolean);if(meta.length)preview.append(node('p','',meta.join(' · ')));const dl=node('dl');for(const[label,value]of Object.entries({Room:r.room,Instructor:r.instructor})){if(!value)continue;const pair=node('div');pair.append(node('dt','',label),node('dd','',value));dl.append(pair);}if(dl.children.length)preview.append(dl);if(previewOwner&&previewOwner!==el)previewOwner.removeAttribute('aria-describedby');previewOwner=el;el.setAttribute('aria-describedby',preview.id);if(!preview.matches(':popover-open'))preview.showPopover();const rect=el.getBoundingClientRect(),base=document.documentElement.clientWidth,left=Math.max(16,Math.min(base-preview.offsetWidth-16,rect.left)),top=rect.top-preview.offsetHeight-10;preview.style.left=left+'px';preview.style.top=Math.max(16,top>=16?top:rect.bottom+10)+'px';}
  function emptyCard(){const card=node('section','ui-card ui-empty ui-empty--page tt-page-empty'),a=node('a','ui-button ui-button--primary','View courses');a.href=window.ihawkRoutes?.page('courses')||'courses.html';a.append(icon('arrow'));card.append(icon('calendar'),node('h2','','No classes listed this week.'),node('p','','Your timetable will appear here when it’s available.'),a);return card;}
  function state(name){if(!ctx?.root.isConnected)return;hidePreview();const empty=name==='ready'&&ctx.week&&!ctx.records.length,content=$('#timetable-content',ctx.root),output=$('#timetable-state',ctx.root);ctx.root.dataset.state=empty?'empty':name;ctx.root.setAttribute('aria-busy',String(name==='loading'));content.hidden=name!=='ready'||empty;output.hidden=name==='ready'&&!empty;output.replaceChildren();if(empty)output.append(emptyCard());else if(name==='loading'){const card=node('div','ui-card ui-skeleton tt-loading');card.setAttribute('role','status');card.append(node('span','sr-only','Loading timetable'));const header=node('div','tt-loading-header');for(let i=0;i<7;i++)header.append(node('span','skeleton-line'));const body=node('div','tt-loading-grid');for(let i=0;i<3;i++)body.append(node('span','skeleton-line'));card.append(header,body);output.append(card);}else if(name==='error'){const card=node('section','ui-card ui-empty ui-empty--page');card.setAttribute('role','alert');const b=node('button','ui-button ui-button--primary','Try again');b.type='button';b.dataset.ttRetry='';card.append(icon('warning'),node('h2','','Couldn’t load your timetable.'),node('p','','Please try again in a moment.'),b);output.append(card);}window.ihawkFocusShellAPI?.enhanceLinks(output);}
  function mount(){clearInterval(clock);hidePreview();gesture=null;ignoreClickUntil=0;const root=$('#timetable-workspace');ctx=root?{root,path:location.pathname,query:serverQuery(),week:$('[data-tt-week]',root),grid:$('.tt-grid',root),days:[],records:[],validWeek:false,selected:'',gridMode:false,nowLine:null}:null;if(!ctx)return;root.removeAttribute('data-page-pending');if(!ctx.week){state('ready');return;}
    // History snapshots keep the same records, so remove only generated clock/labels.
    $('.tt-now',ctx.root)?.remove();readDays();readRecords();const count=$('[data-tt-count]',ctx.root);count.textContent=ctx.records.length+' '+(ctx.records.length===1?'class':'classes');count.hidden=!ctx.records.length;if(!ctx.records.length){state('ready');return;}
    layoutGrid();ctx.week.dataset.enhanced='true';dayStrip();if(ctx.validWeek)selectDay(selectedFromURL());else{for(const d of ctx.days)d.el.hidden=!d.records.length;$('.tt-day-strip',ctx.root).hidden=true;$('.tt-agenda-heading',ctx.root).hidden=true;}
    refreshClock();clock=setInterval(refreshClock,60000);state('ready');window.ihawkFocusUI?.init(root);window.ihawkFocusShellAPI?.enhanceLinks(root);
  }
  document.addEventListener('click',e=>{if(!ctx?.root.isConnected)return;const button=e.target.closest('button');if(button?.hasAttribute('data-tt-select')){hidePreview();selectDay(button.dataset.ttSelect,true,true);}if(button?.hasAttribute('data-tt-retry')){state('loading');window.htmx?.ajax('GET',location.href,{target:'#content',select:'#content',swap:'outerHTML'});}});
  document.addEventListener('click',e=>{if(ctx?.root.isConnected&&ctx.root.contains(e.target)&&e.target.closest('[data-tt-lesson]')&&performance.now()<ignoreClickUntil){e.preventDefault();e.stopPropagation();}},{capture:true});
  document.addEventListener('keydown',e=>{if(e.key==='Escape')hidePreview();if(!ctx?.validWeek||!e.target.hasAttribute('data-tt-select')||!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();const i=ctx.days.findIndex(d=>d.date===e.target.dataset.ttSelect),index=e.key==='Home'?0:e.key==='End'?ctx.days.length-1:Math.max(0,Math.min(ctx.days.length-1,i+(e.key==='ArrowRight'?1:-1)));selectDay(ctx.days[index].date,true,true,true);});
  document.addEventListener('pointerover',e=>{if(!fine.matches)return;const el=e.target.closest('[data-tt-lesson]');if(el&&!el.contains(e.relatedTarget))showPreview(el);});
  document.addEventListener('pointerout',e=>{const el=e.target.closest('[data-tt-lesson]');if(el&&!el.contains(e.relatedTarget)&&el!==document.activeElement)hidePreview();});
  document.addEventListener('focusin',e=>{const el=e.target.closest('[data-tt-lesson]');if(el?.matches(':focus-visible'))showPreview(el);});document.addEventListener('focusout',e=>{if(e.target===previewOwner)hidePreview();});
  document.addEventListener('pointerdown',e=>{if(!phone.matches||!ctx?.validWeek||!e.target.closest('.tt-day')||e.pointerType==='mouse'||e.button!==0)return;gesture={id:e.pointerId,x:e.clientX,y:e.clientY};});
  document.addEventListener('pointerup',e=>{if(!gesture||gesture.id!==e.pointerId)return;const start=gesture;gesture=null;if(!ctx?.root.isConnected)return;const dx=e.clientX-start.x,dy=e.clientY-start.y;if(Math.abs(dx)<48||Math.abs(dx)<Math.abs(dy)*1.3)return;const i=ctx.days.findIndex(d=>d.date===ctx.selected),index=Math.max(0,Math.min(ctx.days.length-1,i+(dx<0?1:-1)));ignoreClickUntil=performance.now()+400;selectDay(ctx.days[index].date,true,true);});document.addEventListener('pointercancel',()=>gesture=null);
  document.addEventListener('scroll',hidePreview,{capture:true,passive:true});window.addEventListener('resize',hidePreview);window.addEventListener('blur',hidePreview);document.addEventListener('visibilitychange',refreshClock);
  phone.addEventListener('change',()=>{hidePreview();if(ctx?.validWeek&&ctx.records.length)selectDay(ctx.selected||selectedFromURL());});
  window.addEventListener('popstate',e=>{if(ctx?.root.isConnected&&ctx.path===location.pathname&&ctx.query===serverQuery()&&ctx.validWeek){e.stopImmediatePropagation();selectDay(selectedFromURL(),false,true);}},{capture:true});
  document.addEventListener('htmx:beforeHistorySave',hidePreview);document.addEventListener('htmx:beforeSwap',e=>{if(e.detail.target?.id==='content'){clearInterval(clock);hidePreview();gesture=null;}});document.addEventListener('htmx:afterSwap',e=>{if(e.detail.target?.id==='content'||e.detail.elt?.id==='content')mount();});document.addEventListener('htmx:historyRestore',mount);
  for(const name of['htmx:responseError','htmx:sendError'])document.addEventListener(name,e=>{if(ctx?.root.isConnected&&e.detail.target?.id==='content')state('error');});
  window.ihawkTimetable={mount,setLoading:()=>state('loading'),setError:()=>state('error'),setReady:()=>state('ready')};mount();
})();
