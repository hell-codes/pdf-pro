(function () {
  const prefix = window.location.pathname.includes('/tools/') ? '../' : '';
  const authPage = document.body.dataset.authPage;
  const suppressAuthNav = authPage === 'login' || authPage === 'signup';
  let pendingResolve = null;
  let modalEl = null;

  function initials(user) {
    const source = (user && (user.displayName || user.email)) || '?';
    return source.trim().charAt(0).toUpperCase();
  }

  function displayNameOf(user) {
    if (!user) return '';
    return user.displayName || (user.email ? user.email.split('@')[0] : 'Account');
  }

  function renderNav(user) {
    if (!window.PDFProAuth || !window.PDFProAuth.isConfigured()) return;
    if (suppressAuthNav) return;

    document.querySelectorAll('.nav-actions').forEach((actions) => {
      const existing = actions.querySelector('.auth-slot');
      if (existing) existing.remove();

      const slot = document.createElement('div');
      slot.className = 'auth-slot';

      if (user) {
        slot.innerHTML = `
          <div class="account-menu">
            <button class="account-trigger" aria-haspopup="true" aria-expanded="false" aria-label="Account menu">
              <span class="account-avatar">${initials(user)}</span>
            </button>
            <div class="account-dropdown glass-strong">
              <div class="account-dropdown-head">
                <span class="account-dropdown-name">${escapeHtml(displayNameOf(user))}</span>
                <span class="account-dropdown-email">${escapeHtml(user.email || '')}</span>
              </div>
              <a class="account-dropdown-item" href="${prefix}account.html">My account</a>
              <button class="account-dropdown-item danger" data-auth-logout>Log out</button>
            </div>
          </div>
        `;
      } else {
        slot.innerHTML = `<a class="btn btn-secondary btn-sm" href="${prefix}login.html">Log in</a>`;
      }

      const themeToggle = actions.querySelector('.theme-toggle');
      if (themeToggle) actions.insertBefore(slot, themeToggle.nextSibling);
      else actions.insertBefore(slot, actions.firstChild);
    });

    renderMobile(user);
  }

  function renderMobile(user) {
    document.querySelectorAll('.mobile-menu').forEach((menu) => {
      menu.querySelectorAll('[data-auth-mobile]').forEach((el) => el.remove());

      if (user) {
        const account = document.createElement('a');
        account.href = `${prefix}account.html`;
        account.textContent = 'My account';
        account.setAttribute('data-auth-mobile', '');

        const logout = document.createElement('a');
        logout.href = '#';
        logout.textContent = 'Log out';
        logout.setAttribute('data-auth-mobile', '');
        logout.addEventListener('click', (e) => {
          e.preventDefault();
          window.PDFProAuth.logOut();
        });

        menu.appendChild(account);
        menu.appendChild(logout);
      } else {
        const login = document.createElement('a');
        login.href = `${prefix}login.html`;
        login.textContent = 'Log in';
        login.setAttribute('data-auth-mobile', '');

        const signup = document.createElement('a');
        signup.href = `${prefix}signup.html`;
        signup.textContent = 'Create account';
        signup.setAttribute('data-auth-mobile', '');

        menu.appendChild(login);
        menu.appendChild(signup);
      }
    });
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str == null ? '' : str;
    return div.innerHTML;
  }

  function buildModal() {
    if (modalEl) return modalEl;

    modalEl = document.createElement('div');
    modalEl.className = 'modal-backdrop auth-modal-backdrop';
    modalEl.innerHTML = `
      <div class="auth-modal glass-strong" role="dialog" aria-modal="true" aria-labelledby="authModalTitle">
        <button class="auth-modal-close" aria-label="Close">&times;</button>
        <div class="auth-modal-brand">
          <span class="brand-mark">
            <svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6"/><path d="M9 15l2 2 4-4"/></svg>
          </span>
        </div>
        <h2 class="auth-modal-title" id="authModalTitle">Welcome back</h2>
        <p class="auth-modal-subtitle" data-auth-message>Log in to continue.</p>

        <div class="auth-tabs" role="tablist">
          <button class="auth-tab active" data-auth-tab="login" role="tab">Log in</button>
          <button class="auth-tab" data-auth-tab="signup" role="tab">Sign up</button>
        </div>

        <form class="auth-form" data-auth-form novalidate>
          <div class="auth-field" data-field="name" hidden>
            <label for="authName">Name</label>
            <input id="authName" type="text" autocomplete="name" placeholder="Your name">
          </div>
          <div class="auth-field">
            <label for="authEmail">Email</label>
            <input id="authEmail" type="email" autocomplete="email" placeholder="you@example.com" required>
          </div>
          <div class="auth-field">
            <label for="authPassword">Password</label>
            <input id="authPassword" type="password" autocomplete="current-password" placeholder="••••••••" required>
          </div>
          <div class="auth-field" data-field="confirm" hidden>
            <label for="authConfirm">Confirm password</label>
            <input id="authConfirm" type="password" autocomplete="new-password" placeholder="••••••••">
          </div>

          <button type="button" class="auth-forgot" data-auth-forgot hidden>Forgot password?</button>

          <div class="auth-error" data-auth-error hidden></div>

          <button type="submit" class="btn btn-primary auth-submit">Log in</button>
        </form>
      </div>
    `;
    document.body.appendChild(modalEl);
    wireModal();
    return modalEl;
  }

  let currentMode = 'login';

  function setMode(mode) {
    currentMode = mode;
    const isSignup = mode === 'signup';
    const modal = modalEl;

    modal.querySelectorAll('[data-auth-tab]').forEach((tab) => {
      tab.classList.toggle('active', tab.dataset.authTab === mode);
    });
    modal.querySelector('[data-field="name"]').hidden = !isSignup;
    modal.querySelector('[data-field="confirm"]').hidden = !isSignup;
    modal.querySelector('[data-auth-forgot]').hidden = isSignup;
    modal.querySelector('.auth-submit').textContent = isSignup ? 'Create account' : 'Log in';
    modal.querySelector('.auth-modal-title').textContent = isSignup ? 'Create your account' : 'Welcome back';

    const passwordInput = modal.querySelector('#authPassword');
    passwordInput.setAttribute('autocomplete', isSignup ? 'new-password' : 'current-password');
    clearError();
  }

  function clearError() {
    const box = modalEl.querySelector('[data-auth-error]');
    box.hidden = true;
    box.textContent = '';
  }

  function showError(message) {
    const box = modalEl.querySelector('[data-auth-error]');
    box.textContent = message;
    box.hidden = false;
  }

  function setSubmitting(isSubmitting) {
    const btn = modalEl.querySelector('.auth-submit');
    btn.disabled = isSubmitting;
    if (isSubmitting) {
      btn.dataset.label = btn.textContent;
      btn.innerHTML = '<span class="spinner"></span> Please wait…';
    } else if (btn.dataset.label) {
      btn.textContent = btn.dataset.label;
    }
  }

  function wireModal() {
    const modal = modalEl;

    modal.querySelector('.auth-modal-close').addEventListener('click', () => closeAuthModal(false));
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeAuthModal(false);
    });

    modal.querySelectorAll('[data-auth-tab]').forEach((tab) => {
      tab.addEventListener('click', () => setMode(tab.dataset.authTab));
    });

    modal.querySelector('[data-auth-forgot]').addEventListener('click', async () => {
      const email = modal.querySelector('#authEmail').value.trim();
      if (!email) {
        showError('Enter your email above, then tap "Forgot password" again.');
        return;
      }
      try {
        await window.PDFProAuth.resetPassword(email);
        clearError();
        window.PDFProToast.success('Password reset email sent. Check your inbox.');
      } catch (error) {
        showError(error.message);
      }
    });

    modal.querySelector('[data-auth-form]').addEventListener('submit', async (e) => {
      e.preventDefault();
      clearError();

      const name = modal.querySelector('#authName').value.trim();
      const email = modal.querySelector('#authEmail').value.trim();
      const password = modal.querySelector('#authPassword').value;
      const confirm = modal.querySelector('#authConfirm').value;

      if (!email || !password) {
        showError('Please enter your email and password.');
        return;
      }

      if (currentMode === 'signup') {
        if (!name) {
          showError('Please enter your name.');
          return;
        }
        if (password.length < 6) {
          showError('Please choose a password with at least 6 characters.');
          return;
        }
        if (password !== confirm) {
          showError('Those passwords do not match.');
          return;
        }
      }

      setSubmitting(true);
      try {
        if (currentMode === 'signup') {
          await window.PDFProAuth.signUp(email, name, password);
          window.PDFProToast.success('Account created. You are now signed in.');
        } else {
          await window.PDFProAuth.logIn(email, password);
          window.PDFProToast.success('Signed in successfully.');
        }
        closeAuthModal(true);
      } catch (error) {
        showError(error.message);
      } finally {
        setSubmitting(false);
      }
    });
  }

  function openAuthModal(opts = {}) {
    const { mode = 'login', message } = opts;

    if (!window.PDFProAuth || !window.PDFProAuth.isConfigured()) {
      window.PDFProToast.info('Accounts are not enabled yet on this deployment.');
      return Promise.resolve(false);
    }

    buildModal();
    setMode(mode);
    modalEl.querySelector('[data-auth-message]').textContent =
      message || (mode === 'signup' ? 'Create a free account to continue.' : 'Log in to continue.');

    modalEl.querySelector('[data-auth-form]').reset();
    setMode(mode);
    modalEl.classList.add('open');
    document.body.style.overflow = 'hidden';
    setTimeout(() => modalEl.querySelector('#authEmail').focus(), 60);

    return new Promise((resolve) => {
      pendingResolve = resolve;
    });
  }

  function closeAuthModal(success) {
    if (!modalEl) return;
    modalEl.classList.remove('open');
    document.body.style.overflow = '';
    if (pendingResolve) {
      pendingResolve(Boolean(success));
      pendingResolve = null;
    }
  }

  function requireLogin(message) {
    if (window.PDFProAuth && window.PDFProAuth.isLoggedIn()) {
      return Promise.resolve(true);
    }
    return openAuthModal({ mode: 'signup', message });
  }

  document.addEventListener('click', (e) => {
    const openTrigger = e.target.closest('[data-auth-open]');
    if (openTrigger) {
      e.preventDefault();
      openAuthModal({ mode: openTrigger.dataset.authOpen });
      return;
    }

    const logoutTrigger = e.target.closest('[data-auth-logout]');
    if (logoutTrigger) {
      e.preventDefault();
      window.PDFProAuth.logOut();
      return;
    }

    const accountTrigger = e.target.closest('.account-trigger');
    if (accountTrigger) {
      const menu = accountTrigger.closest('.account-menu');
      const isOpen = menu.classList.toggle('open');
      accountTrigger.setAttribute('aria-expanded', String(isOpen));
      return;
    }

    document.querySelectorAll('.account-menu.open').forEach((menu) => {
      if (!menu.contains(e.target)) menu.classList.remove('open');
    });
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modalEl && modalEl.classList.contains('open')) {
      closeAuthModal(false);
    }
  });

  function ensureNavExtras() {
    document.querySelectorAll('.nav-links').forEach((links) => {
      if (links.querySelector('a[href$="pricing.html"]')) return;
      const link = document.createElement('a');
      link.href = `${prefix}pricing.html`;
      link.className = 'nav-link';
      link.textContent = 'Pricing';
      links.appendChild(link);
    });

    document.querySelectorAll('.mobile-menu').forEach((menu) => {
      if (menu.querySelector('a[href$="pricing.html"]')) return;
      const link = document.createElement('a');
      link.href = `${prefix}pricing.html`;
      link.textContent = 'Pricing';
      const firstAuthItem = menu.querySelector('[data-auth-mobile]');
      if (firstAuthItem) menu.insertBefore(link, firstAuthItem);
      else menu.appendChild(link);
    });
  }

  function boot() {
    ensureNavExtras();
    if (window.PDFProAuth) {
      window.PDFProAuth.onChange(renderNav);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  window.PDFProAuthUI = { openAuthModal, closeAuthModal, requireLogin };
})();
