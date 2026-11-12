/* FOCUS / Phase B. Exactly one shell lifecycle; htmx owns content swaps only. */
(()=>{'use strict';if(window.ihawkFocusShell)return;if(location.protocol==='file:')document.querySelectorAll('[hx-boost]').forEach(el=>el.setAttribute('hx-boost','false'));window.ihawkFocusShell=true;console.debug('[focus-shell] init');try{if(localStorage.getItem('ihawk:focus:shell-revision')!=='course-context-v1'){localStorage.removeItem('htmx-history-cache');localStorage.removeItem('ihawk:focus:density');localStorage.removeItem('ihawk:focus:effects');Object.keys(localStorage).filter(key=>key.startsWith('ihawk:focus:recent:')).forEach(key=>localStorage.removeItem(key));localStorage.setItem('ihawk:focus:shell-revision','course-context-v1')}}catch{}const root=document.documentElement,$=id=>document.getElementById(id),all=(s,r=document)=>[...r.querySelectorAll(s)],reduce=matchMedia('(prefers-reduced-motion:reduce)'),phone=matchMedia('(max-width:599px)'),tablet=matchMedia('(min-width:600px) and (max-width:1023px)'),sidebar=$('app-sidebar'),dock=$('mobile-dock'),more=$('more-sheet'),scrim=$('sheet-scrim');const write=(key,value)=>{try{localStorage.setItem('ihawk:focus:'+key,value)}catch{}};let lenses=[],lastPath=location.pathname,toastTimer,overlayOpener,moreTimer,moreResolve,queuedOverlay=null,drag=null,routeExit;
const canMotion=()=>!reduce.matches&&root.dataset.quality!=='low';
function toast(message){const region=$('toast-region');clearTimeout(toastTimer);region.replaceChildren();const el=document.createElement('div');el.className='shell-toast';el.setAttribute('role','status');el.textContent=message;region.append(el);toastTimer=setTimeout(()=>region.replaceChildren(),3500)}
function settings(){all('[data-theme-toggle]').forEach(b=>{const label=root.dataset.theme==='dark'?'Switch to light mode':'Switch to dark mode';b.setAttribute('aria-label',label);b.title=label;b.setAttribute('aria-pressed',String(root.dataset.theme==='dark'))});all('.sidebar-collapse').forEach(b=>{const expanded=tablet.matches?root.classList.contains('tablet-sidebar-open'):root.dataset.sidebar!=='collapsed';b.setAttribute('aria-expanded',String(expanded));b.setAttribute('aria-label',expanded?'Collapse sidebar':'Expand sidebar');b.title=expanded?'Collapse sidebar':'Expand sidebar'})}
function theme(){window.ihawkFocusFoundation.setTheme(root.dataset.theme==='dark'?'light':'dark');settings()}
function activeLink(path){const links=all('#navigation>.nav-stack>.nav-list.real>a');return links.find(a=>new URL(a.href).pathname===path)||(window.ihawkRoutes?.matchesCourse(path)?links.find(a=>a.dataset.pageKey==='courses'):null)||links.find(a=>a.dataset.pageKey==='courses'&&path.startsWith(new URL(a.href).pathname))||(path.includes('/dashboard')?links.find(a=>a.dataset.pageKey==='home'):null)}
function selectRoute(path,instant=false){const current=activeLink(path),key=current?.dataset.pageKey;all('#navigation>.nav-stack>.nav-list.real>a').forEach(a=>{const yes=a===current;a.classList.toggle('active',yes);if(yes)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current')});all('#mobile-dock>.nav-stack>.nav-list.real>*').forEach(a=>{const yes=a.matches('a')?a.dataset.pageKey===key:!key||key==='assignments';a.classList.toggle('active',yes);if(yes)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current')});const profile=window.ihawkRoutes?.page('profile'),deletion=window.ihawkRoutes?.page('deleteData');const profileCurrent=profile&&new URL(profile,location.href).pathname===path,inside=profileCurrent||(deletion&&new URL(deletion,location.href).pathname===path);all('[data-profile-link]').forEach(link=>{link.classList.toggle('active',!!inside);if(profileCurrent)link.setAttribute('aria-current','page');else link.removeAttribute('aria-current')});lenses.forEach(l=>l.sync(instant));lastPath=path}
function lens(stack){
 const horizontal=stack.dataset.navStack==='horizontal',real=stack.querySelector('.nav-list.real');
 stack.dataset.orientation=horizontal?'horizontal':'vertical';stack.dataset.liquid='spring-v3';
 const layers=document.createElement('div');layers.className='nav-lens';layers.dataset.axis=horizontal?'horizontal':'vertical';layers.setAttribute('aria-hidden','true');layers.inert=true;
 layers.innerHTML='<div class="lens-fill"></div><div class="lens-clip"><div class="lens-scale"></div></div><div class="lens-rim"></div>';
 const mirror=real.cloneNode(true);mirror.classList.replace('real','clone');mirror.setAttribute('aria-hidden','true');mirror.inert=true;
 all('[id]',mirror).forEach(el=>el.removeAttribute('id'));
 all('a,button,[tabindex]',mirror).forEach(el=>{el.tabIndex=-1;el.removeAttribute('aria-controls');el.removeAttribute('aria-current')});
 layers.querySelector('.lens-scale').append(mirror);stack.append(layers);
 const keys=['--l','--t','--r','--b'],position={},velocity={},target={},reaction={x:0,y:0,vx:0,vy:0,tx:0,ty:0};
 let initialized=false,frame=0,last=0,started=0,leading='',lagUntil=0,resizeFrame,stackWidth=0,stackHeight=0;
 const axis=horizontal?['--l','--r']:['--t','--b'];
 // Page/graph FPS downgrades must not turn off this small navigation spring.
 // Keep explicit system accessibility/data preferences and manual Off effective.
 const transparency=matchMedia('(prefers-reduced-transparency:reduce)'),dataPreference=matchMedia('(prefers-reduced-data:reduce)'),forcedColors=matchMedia('(forced-colors:active)');
 const flat=()=>root.dataset.effects==='off'||transparency.matches||dataPreference.matches||forcedColors.matches||navigator.connection?.saveData;
 const canMotion=()=>!reduce.matches&&!flat();
 function mode(){stack.dataset.lensMode=flat()?'low':'high'}
 function copyClasses(){[...real.children].forEach((item,i)=>{const copy=mirror.children[i];if(!copy)return;copy.className=item.className;if(item.hasAttribute('aria-current'))copy.setAttribute('aria-current',item.getAttribute('aria-current'));else copy.removeAttribute('aria-current')})}
 function paint(){
  const span=horizontal?stackWidth:stackHeight,wanted=span-target[axis[0]]-target[axis[1]],length=span-position[axis[0]]-position[axis[1]];
  const stretch=Math.min(.8,Math.abs(length-wanted)/Math.max(48,wanted)),waist=Math.min(3.2,stretch*5);
  const edges={...position};
  edges['--l']+=reaction.x+(horizontal?0:waist);edges['--r']-=reaction.x-(horizontal?0:waist);
  edges['--t']+=reaction.y+(horizontal?waist:0);edges['--b']-=reaction.y-(horizontal?waist:0);
  for(const key of keys){const limit=(key==='--l'||key==='--r')?stackWidth:stackHeight;const value=Math.max(0,Math.min(limit,edges[key]));layers.style.setProperty(key,value+'px');real.style.setProperty(key,value+'px')}
  const bend=Math.min(.035,(Math.abs(reaction.x)+Math.abs(reaction.y))*.008),pressed=stack.dataset.pressed==='true'?.02:0;
  layers.style.setProperty('--glass-sx',String(1.05+(horizontal?stretch*.14:stretch*.035)+bend-pressed));
  layers.style.setProperty('--glass-sy',String(1.05+(horizontal?stretch*.035:stretch*.14)+bend-pressed));
  layers.style.setProperty('--glass-energy',String(stretch));
 }
 function stop(){cancelAnimationFrame(frame);frame=0;last=0;delete layers.dataset.flow}
 function snap(){stop();for(const key of keys){position[key]=target[key];velocity[key]=0}reaction.x=reaction.y=reaction.vx=reaction.vy=reaction.tx=reaction.ty=0;paint()}
 function tick(time){
  frame=0;if(!canMotion()||document.hidden){snap();return}
  const dt=Math.min(.032,Math.max(.001,(time-(last||time-16.67))/1000));last=time;let moving=false;
  for(const key of keys){
   if(axis.includes(key)&&key!==leading&&time<lagUntil){moving=true;continue}
   const main=axis.includes(key),stiffness=main?(key===leading?340:210):300,damping=main?(key===leading?25:23):28;
   velocity[key]+=(stiffness*(target[key]-position[key])-damping*velocity[key])*dt;position[key]+=velocity[key]*dt;
   if(Math.abs(target[key]-position[key])>.035||Math.abs(velocity[key])>.25)moving=true;
  }
  for(const [p,v,t]of[['x','vx','tx'],['y','vy','ty']]){reaction[v]+=(280*(reaction[t]-reaction[p])-24*reaction[v])*dt;reaction[p]+=reaction[v]*dt;if(Math.abs(reaction[t]-reaction[p])>.015||Math.abs(reaction[v])>.08)moving=true}
  paint();
  if(moving&&time-started<1600)frame=requestAnimationFrame(tick);
  else{for(const key of keys){position[key]=target[key];velocity[key]=0}reaction.x=reaction.tx;reaction.y=reaction.ty;reaction.vx=reaction.vy=0;paint();last=0;delete layers.dataset.flow}
 }
 function wake(){if(!canMotion()){snap();return}started=performance.now();if(!frame){last=0;frame=requestAnimationFrame(tick)}}
 function sync(instant=false){
  mode();copyClasses();if(!stack.getClientRects().length)return;
  const selected=real.querySelector('.active');stack.dataset.hasActive=String(!!selected);
  if(!selected){stop();real.style.maskImage='none';return}real.style.removeProperty('mask-image');
  const box=selected.getBoundingClientRect(),base=stack.getBoundingClientRect(),w=Math.round(stack.clientWidth),h=Math.round(stack.clientHeight);if(!w||!h)return;
  const sx=base.width/w||1,sy=base.height/h||1,left=horizontal?Math.max(0,Math.round((box.left-base.left)/sx)):0,top=horizontal?0:Math.max(0,Math.round((box.top-base.top)/sy)),right=horizontal?Math.max(0,w-left-Math.round(box.width/sx)):0,bottom=horizontal?0:Math.max(0,h-top-Math.round(box.height/sy)),next={'--l':left,'--t':top,'--r':right,'--b':bottom};
  const resized=w!==stackWidth||h!==stackHeight,changed=!initialized||keys.some(key=>target[key]!==next[key]),previous=target[axis[0]];
  stackWidth=w;stackHeight=h;stack.style.setProperty('--stack-w',w+'px');stack.style.setProperty('--stack-h',h+'px');
  Object.assign(target,next);
  if(!initialized||resized||!canMotion()){initialized=true;snap();return}
  // Repeated htmx/focus/quality notifications must not finish a moving lens.
  if(!changed){if(instant&&!frame)paint();return}
  if(instant){snap();return}
  const forward=next[axis[0]]>previous;leading=axis[forward?1:0];layers.dataset.dir=forward?'forward':'back';layers.dataset.flow='true';layers.style.setProperty('--spotlight','0');reaction.tx=reaction.ty=0;lagUntil=performance.now()+32;wake();
 }
 new ResizeObserver(()=>{cancelAnimationFrame(resizeFrame);resizeFrame=requestAnimationFrame(()=>sync(true))}).observe(real);
 new MutationObserver(()=>sync()).observe(real,{subtree:true,attributes:true,attributeFilter:['class','aria-current']});
 function releasePointer(){layers.style.setProperty('--spotlight','0');all('.shell-nav',real).forEach(item=>item.style.setProperty('--hover-opacity','0'));if(!initialized)return;reaction.tx=reaction.ty=0;wake()}
 if(matchMedia('(hover:hover) and (pointer:fine)').matches){
  real.addEventListener('pointermove',e=>{
   const item=e.target.closest('.shell-nav');if(item){const b=item.getBoundingClientRect();item.style.setProperty('--hover-x',(e.clientX-b.left)+'px');item.style.setProperty('--hover-y',(e.clientY-b.top)+'px');item.style.setProperty('--hover-opacity','1')}
   const selected=real.querySelector('.active'),inside=item===selected&&!!selected;
   layers.style.setProperty('--spotlight',inside?'1':'0');
   if(inside){const b=selected.getBoundingClientRect();layers.style.setProperty('--mx',(e.clientX-b.left)+'px');layers.style.setProperty('--my',(e.clientY-b.top)+'px');reaction.tx=canMotion()?((e.clientX-b.left)/b.width-.5)*5:0;reaction.ty=canMotion()?((e.clientY-b.top)/b.height-.5)*3:0}
   else reaction.tx=reaction.ty=0;
   wake();
  });
  real.addEventListener('pointerout',e=>{const item=e.target.closest('.shell-nav');if(item&&!item.contains(e.relatedTarget))item.style.setProperty('--hover-opacity','0')});
  stack.addEventListener('pointerleave',releasePointer);window.addEventListener('blur',releasePointer);
 }
 stack.addEventListener('pointerdown',e=>{
  if(e.button!==0)return;stack.dataset.pressed='true';
  const item=e.target.closest('.nav-list.real a');if(item&&!e.metaKey&&!e.ctrlKey&&!e.shiftKey&&!e.altKey)selectRoute(new URL(item.href).pathname);if(initialized)wake();
 });
 for(const type of['pointerup','pointercancel','pointerleave'])stack.addEventListener(type,()=>{stack.dataset.pressed='false';if(initialized)wake()});
 document.addEventListener('visibilitychange',()=>{if(document.hidden&&initialized)snap()});
 for(const preference of[transparency,dataPreference,forcedColors])preference.addEventListener('change',()=>sync(true));
 sync(true);return{sync,stack,real,mirror,layers};
}
all('[data-nav-stack]').forEach(stack=>lenses.push(lens(stack)));selectRoute(location.pathname,true);
function collapse(){if(tablet.matches)root.classList.toggle('tablet-sidebar-open');else{root.dataset.sidebar=root.dataset.sidebar==='collapsed'?'expanded':'collapsed';write('sidebar',root.dataset.sidebar)}settings();requestAnimationFrame(()=>lenses.forEach(l=>l.sync(true)))}
all('.sidebar-collapse').forEach(b=>b.addEventListener('click',collapse));sidebar.querySelector('.shell-mark')?.addEventListener('click',e=>{if(tablet.matches){e.preventDefault();collapse()}});let resizeTimer;window.addEventListener('resize',()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(()=>{if(!phone.matches&&more.dataset.state==='open')closeMore(false);if(!tablet.matches)root.classList.remove('tablet-sidebar-open');settings();lenses.forEach(l=>l.sync(true))},80)});
function setLocked(locked){document.body.style.overflow=locked?'hidden':'';for(const id of['content','workspace-footer','app-sidebar','mobile-dock'])$(id)?.toggleAttribute('inert',locked)}
function finishMore(){if(more.dataset.state!=='closing')return;clearTimeout(moreTimer);more.style.removeProperty('transform');more.dataset.state='closed';more.setAttribute('aria-hidden','true');scrim.dataset.state='closed';setLocked(false);selectRoute(location.pathname);const next=queuedOverlay;queuedOverlay=null;if(next)next();else if(moreResolve?.restore&&overlayOpener?.isConnected)overlayOpener.focus({preventScroll:true});moreResolve=null}
function openMore(opener){if(!phone.matches)return;if(more.dataset.state==='open')return;clearTimeout(moreTimer);queuedOverlay=null;overlayOpener=opener||document.activeElement;more.inert=false;more.setAttribute('aria-hidden','false');more.dataset.state='open';scrim.dataset.state='open';all('[data-open-more]').forEach(b=>b.setAttribute('aria-expanded','true'));setLocked(true);all('#mobile-dock .nav-list.real>*').forEach(el=>el.classList.toggle('active',el.hasAttribute('data-open-more')));lenses.filter(l=>l.stack.dataset.navStack==='horizontal').forEach(l=>l.sync());requestAnimationFrame(()=>more.querySelector('[data-close-more]').focus({preventScroll:true}))}
function closeMore(restore=true,then=null){if(more.dataset.state==='closing'){if(then)queuedOverlay=then;if(moreResolve)moreResolve.restore=restore;return}if(more.dataset.state==='closed'){if(then)then();return}moreResolve={restore};queuedOverlay=then;more.inert=true;more.style.removeProperty('transform');more.dataset.dragging='false';more.dataset.state='closing';scrim.dataset.state='closing';all('[data-open-more]').forEach(b=>b.setAttribute('aria-expanded','false'));clearTimeout(moreTimer);moreTimer=setTimeout(finishMore,reduce.matches?150:360)}
more.addEventListener('transitionend',e=>{if(e.target===more&&['transform','opacity'].includes(e.propertyName))finishMore()});all('[data-open-more]').forEach(b=>b.addEventListener('click',()=>openMore(b)));all('[data-close-more]').forEach(b=>b.addEventListener('click',()=>closeMore()));scrim.addEventListener('click',()=>{if(more.dataset.state==='open')closeMore()});more.addEventListener('click',e=>{if(e.target.closest('a[href]'))closeMore(false)});
const grab=more.querySelector('[data-sheet-drag]');grab.addEventListener('pointerdown',e=>{if(more.dataset.state!=='open'||e.button!==0)return;drag={id:e.pointerId,y:e.clientY,at:performance.now(),dy:0};grab.setPointerCapture(e.pointerId);more.dataset.dragging='true'});grab.addEventListener('pointermove',e=>{if(!drag||e.pointerId!==drag.id)return;drag.dy=Math.max(0,e.clientY-drag.y);more.style.transform=`translateY(${drag.dy}px)`});function endDrag(e){if(!drag||e.pointerId!==drag.id)return;const dismiss=drag.dy>75||drag.dy/(performance.now()-drag.at)>.65;drag=null;more.dataset.dragging='false';if(dismiss)closeMore();else more.style.removeProperty('transform')}grab.addEventListener('pointerup',endDrag);grab.addEventListener('pointercancel',()=>{drag=null;more.dataset.dragging='false';more.style.removeProperty('transform')});
function trap(e,region){if(e.key!=='Tab')return;const nodes=all('a[href],button,select,input,[tabindex]',region).filter(el=>el.offsetParent!==null&&!el.disabled&&el.tabIndex>=0);if(!nodes.length)return;const first=nodes[0],last=nodes.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus()}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus()}}
all('[data-theme-toggle]').forEach(button=>button.addEventListener('click',theme));
document.addEventListener('keydown',event=>{
  if(more.dataset.state==='open'){
    if(event.key==='Escape'){event.preventDefault();closeMore();return;}
    trap(event,more);
  }
  if(event.target.closest('#navigation .nav-list.real')&&['ArrowDown','ArrowUp'].includes(event.key)){
    event.preventDefault();const links=all('#navigation .nav-list.real a'),index=links.indexOf(document.activeElement);
    links[(index+(event.key==='ArrowDown'?1:-1)+links.length)%links.length]?.focus();
  }
});
document.addEventListener('submit',event=>{
  if(!event.target.matches('form[data-account-action]')||event.defaultPrevented)return;
  try{localStorage.removeItem('htmx-history-cache')}catch{}
});
function setLinkBoost(a){if(location.protocol==='file:')return;if(a.hasAttribute('hx-get')||a.hasAttribute('hx-post'))return;let u;try{u=new URL(a.href)}catch{return}if(u.origin!==location.origin||a.hasAttribute('download')||a.target&&a.target!=='_self'||a.getAttribute('hx-boost')==='false'||a.hasAttribute('data-native'))return;if(u.pathname===location.pathname&&u.search===location.search&&u.hash)return;a.setAttribute('hx-boost','true');a.setAttribute('hx-target','#content');a.setAttribute('hx-select','#content');a.setAttribute('hx-swap','outerHTML swap:120ms settle:0ms');if(!a.hasAttribute('hx-push-url')&&!a.hasAttribute('hx-replace-url'))a.setAttribute('hx-push-url','true')}
function enhance(){all('a[href]',$('content')).forEach(setLinkBoost);all('.shell-about,[data-profile-link]').forEach(setLinkBoost);htmx.process($('content'));htmx.process(sidebar);htmx.process(more)}
function focusHeading(){const heading=$('content').querySelector('h1');if(heading){heading.tabIndex=-1;heading.focus({preventScroll:true})}}
function announce(){selectRoute(location.pathname);settings();enhance();const h1=$('content').querySelector('h1');if(more.dataset.state!=='closed'){setLocked(true);closeMore(false,focusHeading)}else focusHeading();let anchor;try{anchor=$(decodeURIComponent(location.hash.slice(1)))}catch{}if(anchor&&$('content').contains(anchor))anchor.scrollIntoView({behavior:'instant',block:'start'});else scrollTo({top:0,left:0,behavior:'instant'});$('route-announcement').textContent='Navigated to '+(h1?.textContent||document.title);if(canMotion())$('page')?.animate([{opacity:0,transform:'translateY(8px)'},{opacity:1,transform:'translateY(0)'}],{duration:320,easing:'cubic-bezier(.22,1,.36,1)'});else $('page')?.animate([{opacity:0},{opacity:1}],{duration:reduce.matches?120:100});}
document.addEventListener('htmx:beforeRequest',e=>{if(e.detail.target?.id!=='content')return;const link=e.detail.elt.closest('a[href]');if(link)selectRoute(new URL(link.href).pathname);routeExit=$('page')?.animate(canMotion()?[{opacity:1,transform:'translateY(0)'},{opacity:0,transform:'translateY(6px)'}]:[{opacity:1},{opacity:0}],{duration:120,fill:'forwards',easing:'ease-in'});all('dialog[open]').forEach(d=>d.close());if(more.dataset.state==='open')closeMore(false)});
document.addEventListener('htmx:beforeSwap',e=>{if(e.detail.target?.id!=='content'||!e.detail.serverResponse)return;if(e.detail.xhr.status>=400){e.detail.shouldSwap=true;e.detail.isError=false;routeExit?.cancel()}const doc=new DOMParser().parseFromString(e.detail.serverResponse,'text/html'),main=doc.getElementById('content');const user=doc.body.dataset.userId||main?.dataset.userId||e.detail.xhr.getResponseHeader('X-Partial-User');if(!main||user!==document.body.dataset.userId){e.detail.shouldSwap=false;location.assign(e.detail.xhr.responseURL||location.href)}});
document.addEventListener('htmx:afterSwap',e=>{if(e.detail.target?.id==='content'||e.detail.elt?.id==='content'){root.classList.remove('tablet-sidebar-open');announce()}});document.addEventListener('htmx:historyRestore',()=>{const main=$('content');if(main?.dataset.userId!==document.body.dataset.userId){try{localStorage.removeItem('htmx-history-cache')}catch{}main?.replaceChildren();location.replace(location.href)}},{capture:true});document.addEventListener('htmx:historyRestore',()=>{enhance();selectRoute(location.pathname,true);focusHeading();$('route-announcement').textContent='Returned to '+($('content').querySelector('h1')?.textContent||'workspace')});document.addEventListener('htmx:responseError',()=>{routeExit?.cancel();selectRoute(location.pathname);toast('Could not load this page. Try the link again.')});document.addEventListener('htmx:sendError',()=>{routeExit?.cancel();selectRoute(location.pathname);toast('Connection interrupted. Try the link again.')});
new MutationObserver(()=>{settings();lenses.forEach(l=>l.sync(true))}).observe(root,{attributes:true,attributeFilter:['data-quality','data-theme']});reduce.addEventListener('change',()=>lenses.forEach(l=>l.sync(true)));document.fonts?.ready.then(()=>lenses.forEach(l=>l.sync(true)));selectRoute(location.pathname,true);settings();enhance();requestAnimationFrame(()=>requestAnimationFrame(()=>{lenses.forEach(l=>l.sync(true));root.classList.remove('focus-shell-boot')}));window.ihawkFocusShellAPI={cancelTransition(){routeExit?.cancel()},enhanceLinks(region){all('a[href]',region).forEach(setLinkBoost);htmx.process(region)},toast,openMore,closeMore,selectRoute,lenses};})();
