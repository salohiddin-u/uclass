/* Progressive enhancement for a server-rendered Django sign-in form. */
(() => {
  'use strict';
  const byId = id => document.getElementById(id);
  const form = byId('connection-form');
  if (!form) return;
  const username = byId('moodle-username'), password = byId('moodle-password');
  const toggle = byId('password-toggle'), submit = byId('connect-account');
  const consents = [...form.querySelectorAll('.auth-consents input[required]')];
  let busy = false;
  const setTheme = dark => {
    document.documentElement.classList.toggle('dark', dark);
    const control = byId('auth-theme'), label = dark ? 'Switch to light mode' : 'Switch to dark mode';
    control.setAttribute('aria-label', label); control.title = label; control.setAttribute('aria-pressed', String(dark));
  };
  try { setTheme(JSON.parse(localStorage.getItem('campus-static-dark')) === true); } catch { setTheme(false); }
  byId('auth-theme').addEventListener('click', () => window.uclassThemeTransition(byId('auth-theme'), () => {
    const dark = !document.documentElement.classList.contains('dark');setTheme(dark);
    try { localStorage.setItem('campus-static-dark', JSON.stringify(dark)); } catch {}
  }));
  const showPassword = visible => {
    password.type = visible ? 'text' : 'password';
    toggle.setAttribute('aria-pressed', String(visible));toggle.setAttribute('aria-label', visible ? 'Hide password' : 'Show password');
    byId('eye-open').hidden = visible;byId('eye-closed').hidden = !visible;
  };
  toggle.addEventListener('click', () => showPassword(password.type === 'password'));
  const syncConsent = () => {
    const ready = consents.every(input => input.checked);
    submit.disabled = busy || !ready;
    byId('consent-hint').textContent = ready ? 'Ready to sign in.' : 'Confirm the required consent choices to continue.';
  };
  consents.forEach(input => input.addEventListener('change', syncConsent));
  [username, password, ...consents].forEach(input => input.addEventListener('input', () => {
    const errorId = input.id.replace('moodle-', '') + '-error';
    const error = byId(errorId);if (error) error.hidden = true;input.removeAttribute('aria-invalid');
  }));
  form.addEventListener('submit', event => {
    if (busy) { event.preventDefault(); return; }
    if (!username.value.trim()) { event.preventDefault();username.setCustomValidity('Enter your Moodle username or Student ID.');username.reportValidity();return; }
    if (!form.reportValidity()) { event.preventDefault(); return; }
    showPassword(false);busy = true;submit.disabled = true;
    form.setAttribute('aria-busy', 'true');submit.setAttribute('aria-busy', 'true');
    byId('submit-label').textContent = 'Signing in…';byId('submit-spinner').hidden = false;byId('submit-arrow').hidden = true;
    // Allow the native POST. Keep named fields enabled so Django receives every choice.
  });
  username.addEventListener('input', () => username.setCustomValidity(''));
  window.addEventListener('pageshow', event => {
    busy = false;form.removeAttribute('aria-busy');submit.removeAttribute('aria-busy');
    byId('submit-label').textContent = 'Sign in';byId('submit-spinner').hidden = true;byId('submit-arrow').hidden = false;
    if (event.persisted) { password.value = '';consents.forEach(input => input.checked = false); }
    showPassword(false);syncConsent();
  });
  syncConsent();
})();
