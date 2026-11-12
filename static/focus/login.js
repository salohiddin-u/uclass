/* Progressive enhancement only. Authentication stays a native Django POST. */
(() => {
  'use strict';
  const root=document.documentElement,form=document.getElementById('login-form'),password=document.getElementById('login-password'),toggle=document.querySelector('[data-password-toggle]'),themeButton=document.querySelector('[data-auth-theme]'),submit=document.querySelector('[data-login-submit]');
  function passwordVisibility(visible){
    password.type=visible?'text':'password';
    toggle.textContent=visible?'Hide':'Show';
    toggle.setAttribute('aria-label',visible?'Hide password':'Show password');
    toggle.setAttribute('aria-pressed',String(visible));
  }
  if(password&&toggle){
    toggle.hidden=false;password.parentElement.dataset.enhanced='true';
    toggle.addEventListener('click',()=>passwordVisibility(password.type==='password'));
  }
  function syncTheme(){
    const next=root.dataset.theme==='dark'?'light':'dark';
    themeButton?.setAttribute('aria-label','Switch to '+next+' theme');
    if(themeButton)themeButton.title='Switch to '+next+' theme';
  }
  if(themeButton){
    themeButton.hidden=false;syncTheme();
    themeButton.addEventListener('click',()=>{
      const theme=root.dataset.theme==='dark'?'light':'dark';
      root.dataset.theme=theme;root.style.colorScheme=theme;
      try{localStorage.setItem('ihawk:focus:theme',theme)}catch{}
      syncTheme();
    });
  }
  window.addEventListener('storage',event=>{
    if(event.key!=='ihawk:focus:theme'||!['dark','light'].includes(event.newValue))return;
    root.dataset.theme=event.newValue;root.style.colorScheme=event.newValue;syncTheme();
  });
  form?.addEventListener('submit',event=>{
    if(event.defaultPrevented||!form.checkValidity()||!submit)return;
    submit.disabled=true;submit.textContent='Signing in…';form.setAttribute('aria-busy','true');
  });
  window.addEventListener('pageshow',event=>{
    if(submit){submit.disabled=false;submit.textContent='Sign in'}
    form?.removeAttribute('aria-busy');
    if(event.persisted&&password&&toggle){password.value='';passwordVisibility(false)}
  });
  document.getElementById('login-errors')?.focus({preventScroll:true});
})();
