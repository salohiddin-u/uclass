/* Frontend-only connection preview. No authentication, API, credential storage,
 * consent recording or analytics. Credential values stay in their input elements.
 * The only persistent value this file writes is a boolean color-theme preference.
 */
(() => {
  'use strict';
  const byId = id => document.getElementById(id);
  const form = byId('connection-form');
  const username = byId('moodle-username');
  const password = byId('moodle-password');
  const passwordToggle = byId('password-toggle');
  const credentialConsent = byId('credential-consent');
  const policyConsent = byId('policy-consent');
  const rememberMe = byId('remember-me');
  const connect = byId('connect-account');
  const status = byId('form-status');
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  let busy = false;
  let previewTimer;
  let themeBusy = false;

  function applyTheme(dark, persist = false) {
    document.documentElement.classList.toggle('dark', dark);
    const label = dark ? 'Switch to light mode' : 'Switch to dark mode';
    byId('auth-theme').setAttribute('aria-label', label);
    byId('auth-theme').setAttribute('title', label);
    byId('auth-theme').setAttribute('aria-pressed', String(dark));
    if (persist) {
      try { localStorage.setItem('campus-static-dark', JSON.stringify(dark)); }
      catch { /* Theme switching still works when storage is unavailable. */ }
    }
  }
  let initialDark = matchMedia('(prefers-color-scheme: dark)').matches;
  try {
    const preference = JSON.parse(localStorage.getItem('campus-static-dark'));
    if (typeof preference === 'boolean') initialDark = preference;
  } catch { /* Use the system color preference. */ }
  applyTheme(initialDark);

  byId('auth-theme').addEventListener('click', async () => {
    if (themeBusy) return;
    const root = document.documentElement;
    const dark = !root.classList.contains('dark');
    if (motion.matches) { applyTheme(dark, true); return; }
    themeBusy = true;
    const button = byId('auth-theme');
    button.classList.add('is-switching');
    let transition;
    try {
      if (typeof document.startViewTransition !== 'function') {
        root.classList.add('theme-fading');
        applyTheme(dark, true);
        await new Promise(resolve => setTimeout(resolve, 380));
      } else {
        const bounds = button.getBoundingClientRect();
        const x = bounds.left + bounds.width / 2;
        const y = bounds.top + bounds.height / 2;
        const radius = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
        root.classList.add('theme-revealing');
        transition = document.startViewTransition(() => applyTheme(dark, true));
        const finished = transition.finished.catch(() => {});
        await transition.ready;
        await root.animate({clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`]}, {
          duration: 580, easing: 'cubic-bezier(.2,.8,.2,1)', pseudoElement: '::view-transition-new(root)'
        }).finished;
        await finished;
      }
    } catch {
      transition?.skipTransition();
      applyTheme(dark, true);
    } finally {
      root.classList.remove('theme-revealing', 'theme-fading');
      button.classList.remove('is-switching');
      themeBusy = false;
    }
  });

  function showPassword(visible) {
    password.type = visible ? 'text' : 'password';
    passwordToggle.setAttribute('aria-pressed', String(visible));
    passwordToggle.setAttribute('aria-label', visible ? 'Hide password' : 'Show password');
    byId('eye-open').hidden = visible;
    byId('eye-closed').hidden = !visible;
  }
  passwordToggle.addEventListener('click', () => showPassword(password.type === 'password'));

  const validation = [
    {input: username, error: byId('username-error'), valid: () => username.value.trim().length > 0, message: 'Enter your Moodle username or Student ID.'},
    {input: password, error: byId('password-error'), valid: () => password.value.length > 0, message: 'Enter a sample password to preview this form.'},
    {input: credentialConsent, error: byId('credential-consent-error'), valid: () => credentialConsent.checked, message: 'Select this checkbox to preview your credential-storage consent choice.'},
    {input: policyConsent, error: byId('policy-consent-error'), valid: () => policyConsent.checked, message: 'Select this checkbox to preview your policy agreement choice.'}
  ];
  function validate(field) {
    const valid = field.valid();
    field.input.setAttribute('aria-invalid', String(!valid));
    field.error.textContent = valid ? '' : field.message;
    field.error.hidden = valid;
    return valid;
  }
  validation.slice(0, 2).forEach(field => {
    field.input.addEventListener('blur', () => { if (!busy) validate(field); });
    field.input.addEventListener('input', () => {
      if (field.input.getAttribute('aria-invalid') === 'true') validate(field);
      if (!busy) status.hidden = true;
    });
  });

  function syncConsent() {
    const ready = credentialConsent.checked && policyConsent.checked;
    connect.disabled = busy || !ready;
    byId('consent-hint').textContent = ready
      ? 'Both choices selected. This preview does not record consent.'
      : 'Select both required checkboxes to enable the preview.';
  }
  [credentialConsent, policyConsent].forEach(input => input.addEventListener('change', () => {
    const field = validation.find(item => item.input === input);
    if (input.getAttribute('aria-invalid') === 'true') validate(field);
    syncConsent();
  }));

  // Clearly unavailable placeholders: no navigation and no incidental checkbox toggle.
  document.querySelectorAll('.auth-policy-link').forEach(link => {
    link.addEventListener('click', event => { event.preventDefault(); event.stopPropagation(); });
    link.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') event.preventDefault(); });
  });

  function setBusy(value) {
    busy = value;
    form.setAttribute('aria-busy', String(value));
    connect.setAttribute('aria-busy', String(value));
    username.readOnly = value;
    password.readOnly = value;
    [passwordToggle, credentialConsent, policyConsent, rememberMe].forEach(input => { input.disabled = value; });
    byId('submit-label').textContent = value ? 'Previewing loading state…' : 'Connect Account';
    byId('submit-spinner').hidden = !value;
    byId('submit-arrow').hidden = value;
    syncConsent();
  }

  form.addEventListener('submit', event => {
    // Always prevent the default, even for invalid or programmatic submissions.
    event.preventDefault();
    if (busy) return;
    const invalid = validation.filter(field => !validate(field));
    if (invalid.length) {
      status.textContent = 'Review the highlighted fields and the two required choices.';
      status.hidden = false;
      invalid[0].input.focus();
      syncConsent();
      return;
    }
    // No credential serialization, request, authentication or simulated success.
    showPassword(false);
    setBusy(true);
    status.textContent = 'Playing a local loading animation only. No account connection is being attempted.';
    status.hidden = false;
    previewTimer = setTimeout(() => {
      password.value = '';
      setBusy(false);
      status.textContent = 'Preview complete. No account was connected, and nothing was sent or saved. The password field has been cleared. Backend implementation is required to connect an account.';
    }, 1200);
  });

  function resetPreview() {
    clearTimeout(previewTimer);
    form.reset();
    username.value = '';
    password.value = '';
    credentialConsent.checked = false;
    policyConsent.checked = false;
    rememberMe.checked = false;
    showPassword(false);
    validation.forEach(field => {
      field.input.removeAttribute('aria-invalid');
      field.error.textContent = '';
      field.error.hidden = true;
    });
    setBusy(false);
    status.textContent = '';
    status.hidden = true;
  }
  // Never retain field values or consent choices across reload/back-forward restoration.
  window.addEventListener('pageshow', resetPreview);
  window.addEventListener('pagehide', () => {
    clearTimeout(previewTimer);
    password.value = '';
    username.value = '';
    showPassword(false);
  });
  resetPreview();
})();
