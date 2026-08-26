(function () {
  const page = document.body.dataset.authPage;
  if (!page) return;

  function qs(sel) {
    return document.querySelector(sel);
  }

  function getNextTarget() {
    const params = new URLSearchParams(window.location.search);
    const next = params.get('next');
    if (next && /^[a-zA-Z0-9_\-./]+\.html$/.test(next)) return next;
    return 'account.html';
  }

  function showError(box, message) {
    if (!box) return;
    box.textContent = message;
    box.hidden = false;
  }

  function clearError(box) {
    if (!box) return;
    box.hidden = true;
    box.textContent = '';
  }

  function setSubmitting(btn, isSubmitting, workingLabel) {
    if (!btn) return;
    btn.disabled = isSubmitting;
    if (isSubmitting) {
      if (!btn.dataset.label) btn.dataset.label = btn.textContent;
      btn.innerHTML = `<span class="spinner"></span> ${workingLabel}`;
    } else if (btn.dataset.label) {
      btn.textContent = btn.dataset.label;
    }
  }

  function guardConfigured() {
    if (window.PDFProAuth && window.PDFProAuth.isConfigured()) return true;
    const notice = qs('[data-auth-notice]');
    if (notice) {
      notice.hidden = false;
      notice.textContent = 'Accounts are not enabled on this deployment yet. Add your Firebase config to enable sign in.';
    }
    return false;
  }

  function initLogin() {
    guardConfigured();
    const form = qs('#loginForm');
    const errorBox = qs('[data-auth-error]');
    const submit = form.querySelector('button[type="submit"]');

    window.PDFProAuth.onChange((user) => {
      if (user) window.location.href = getNextTarget();
    });

    const forgot = qs('[data-auth-forgot]');
    if (forgot) {
      forgot.addEventListener('click', async () => {
        const email = qs('#loginEmail').value.trim();
        if (!email) {
          showError(errorBox, 'Enter your email above, then tap "Forgot password" again.');
          return;
        }
        try {
          await window.PDFProAuth.resetPassword(email);
          clearError(errorBox);
          window.PDFProToast.success('Password reset email sent. Check your inbox.');
        } catch (error) {
          showError(errorBox, error.message);
        }
      });
    }

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      clearError(errorBox);
      const email = qs('#loginEmail').value.trim();
      const password = qs('#loginPassword').value;

      if (!email || !password) {
        showError(errorBox, 'Please enter your email and password.');
        return;
      }

      setSubmitting(submit, true, 'Signing in…');
      try {
        await window.PDFProAuth.logIn(email, password);
        window.location.href = getNextTarget();
      } catch (error) {
        showError(errorBox, error.message);
        setSubmitting(submit, false);
      }
    });
  }

  function initSignup() {
    guardConfigured();
    const form = qs('#signupForm');
    const errorBox = qs('[data-auth-error]');
    const submit = form.querySelector('button[type="submit"]');

    window.PDFProAuth.onChange((user) => {
      if (user) window.location.href = getNextTarget();
    });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      clearError(errorBox);
      const name = qs('#signupName').value.trim();
      const email = qs('#signupEmail').value.trim();
      const password = qs('#signupPassword').value;
      const confirm = qs('#signupConfirm').value;

      if (!name) return showError(errorBox, 'Please enter your name.');
      if (!email) return showError(errorBox, 'Please enter your email.');
      if (password.length < 6) return showError(errorBox, 'Please choose a password with at least 6 characters.');
      if (password !== confirm) return showError(errorBox, 'Those passwords do not match.');

      setSubmitting(submit, true, 'Creating account…');
      try {
        await window.PDFProAuth.signUp(email, name, password);
        window.location.href = getNextTarget();
      } catch (error) {
        showError(errorBox, error.message);
        setSubmitting(submit, false);
      }
    });
  }

  function formatDate(value) {
    try {
      const date = value && value.toDate ? value.toDate() : new Date(value);
      return date.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
    } catch (_) {
      return '—';
    }
  }

  async function loadCreatedAt(uid, target) {
    if (typeof firebase === 'undefined' || !firebase.apps.length) return;
    try {
      const doc = await firebase.firestore().collection('users').doc(uid).get();
      if (doc.exists && doc.data().createdAt) {
        target.textContent = formatDate(doc.data().createdAt);
      }
    } catch (_) {}
  }

  function initAccount() {
    const guard = qs('[data-account-guard]');
    const content = qs('[data-account-content]');

    if (!window.PDFProAuth || !window.PDFProAuth.isConfigured()) {
      if (guard) {
        guard.hidden = false;
        guard.innerHTML =
          '<p class="auth-guard-message">Accounts are not enabled on this deployment yet.</p>';
      }
      if (content) content.hidden = true;
      return;
    }

    window.PDFProAuth.onChange((user) => {
      if (!user) {
        if (content) content.hidden = true;
        if (guard) {
          guard.hidden = false;
          guard.innerHTML = `
            <p class="auth-guard-message">You need to be signed in to view your account.</p>
            <div style="text-align:center">
              <a class="btn btn-primary" href="login.html?next=account.html">Log in</a>
            </div>
          `;
        }
        return;
      }

      if (guard) guard.hidden = true;
      if (content) content.hidden = false;

      const avatar = qs('[data-account-initial]');
      if (avatar) avatar.textContent = (user.displayName || user.email || '?').trim().charAt(0).toUpperCase();

      const nameEl = qs('[data-account-displayname]');
      if (nameEl) nameEl.textContent = user.displayName || (user.email ? user.email.split('@')[0] : 'Your account');

      const emailHeader = qs('[data-account-email-header]');
      if (emailHeader) emailHeader.textContent = user.email || '';

      const emailValue = qs('[data-account-email]');
      if (emailValue) emailValue.textContent = user.email || '—';

      const verified = qs('[data-account-verified]');
      if (verified) verified.textContent = user.emailVerified ? 'Verified' : 'Not verified';

      const uidEl = qs('[data-account-uid]');
      if (uidEl) uidEl.textContent = user.uid;

      const created = qs('[data-account-created]');
      if (created) loadCreatedAt(user.uid, created);
    });

    const logout = qs('[data-account-logout]');
    if (logout) {
      logout.addEventListener('click', async () => {
        await window.PDFProAuth.logOut();
        window.location.href = 'index.html';
      });
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    if (page === 'login') initLogin();
    else if (page === 'signup') initSignup();
    else if (page === 'account') initAccount();
  });
})();
