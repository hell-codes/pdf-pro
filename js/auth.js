const PDFProAuth = (function () {
  const config = window.PDF_PRO_FIREBASE_CONFIG || {};
  const listeners = new Set();

  let auth = null;
  let db = null;
  let configured = false;
  let ready = false;
  let user = null;

  const FRIENDLY_ERRORS = {
    'auth/invalid-email': 'That email address does not look valid.',
    'auth/user-disabled': 'This account has been disabled. Please contact support.',
    'auth/user-not-found': 'No account was found with that email.',
    'auth/wrong-password': 'Incorrect email or password. Please try again.',
    'auth/invalid-credential': 'Incorrect email or password. Please try again.',
    'auth/email-already-in-use': 'An account already exists with that email. Try logging in instead.',
    'auth/weak-password': 'Please choose a password with at least 6 characters.',
    'auth/too-many-requests': 'Too many attempts. Please wait a moment and try again.',
    'auth/network-request-failed': 'Network error. Please check your connection and try again.',
  };

  function isPlaceholder(value) {
    return !value || String(value).startsWith('REPLACE');
  }

  function detectConfigured() {
    return (
      typeof firebase !== 'undefined' &&
      !isPlaceholder(config.apiKey) &&
      !isPlaceholder(config.projectId) &&
      !isPlaceholder(config.appId)
    );
  }

  function friendlyError(error) {
    const code = error && error.code ? error.code : '';
    return FRIENDLY_ERRORS[code] || (error && error.message) || 'Something went wrong. Please try again.';
  }

  function notify() {
    listeners.forEach((listener) => {
      try {
        listener(user);
      } catch (_) {}
    });
  }

  async function writeProfile(firebaseUser, extra) {
    if (!db || !firebaseUser) return;
    const ref = db.collection('users').doc(firebaseUser.uid);
    const payload = {
      email: firebaseUser.email || null,
      displayName: firebaseUser.displayName || (extra && extra.displayName) || null,
      lastLoginAt: firebase.firestore.FieldValue.serverTimestamp(),
    };
    if (extra && extra.isNew) {
      payload.createdAt = firebase.firestore.FieldValue.serverTimestamp();
    }
    try {
      await ref.set(payload, { merge: true });
    } catch (_) {}
  }

  function init() {
    configured = detectConfigured();
    if (!configured) {
      ready = true;
      notify();
      return;
    }

    try {
      firebase.initializeApp(config);
      auth = firebase.auth();
      db = firebase.firestore();
      auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL).catch(() => {});

      auth.onAuthStateChanged((firebaseUser) => {
        ready = true;
        if (firebaseUser) {
          user = {
            uid: firebaseUser.uid,
            email: firebaseUser.email,
            displayName: firebaseUser.displayName,
            emailVerified: firebaseUser.emailVerified,
            creationTime: firebaseUser.metadata.creationTime,
          };
        } else {
          user = null;
        }
        notify();
      });
    } catch (error) {
      configured = false;
      ready = true;
      notify();
    }
  }

  async function signUp(email, displayName, password) {
    if (!configured) throw new Error('Accounts are not available yet. Please try again later.');
    try {
      const credential = await auth.createUserWithEmailAndPassword(email, password);
      if (displayName) {
        await credential.user.updateProfile({ displayName });
      }
      await writeProfile(credential.user, { displayName, isNew: true });
      await credential.user.sendEmailVerification();
      return credential.user;
    } catch (error) {
      throw new Error(friendlyError(error));
    }
  }

  async function logIn(email, password) {
    if (!configured) throw new Error('Accounts are not available yet. Please try again later.');
    try {
      const credential = await auth.signInWithEmailAndPassword(email, password);
      await writeProfile(credential.user, { isNew: false });
      return credential.user;
    } catch (error) {
      throw new Error(friendlyError(error));
    }
  }

  async function logOut() {
    if (!configured) return;
    await auth.signOut();
  }

  async function resetPassword(email) {
    if (!configured) throw new Error('Accounts are not available yet. Please try again later.');
    try {
      await auth.sendPasswordResetEmail(email);
    } catch (error) {
      throw new Error(friendlyError(error));
    }
  }

  async function getIdToken() {
    if (!configured || !auth || !auth.currentUser) return null;
    try {
      return await auth.currentUser.getIdToken();
    } catch (_) {
      return null;
    }
  }

  async function sendVerificationEmail() {
    if (!configured || !auth || !auth.currentUser) throw new Error('You must be signed in to verify your email.');
    try {
      await auth.currentUser.sendEmailVerification();
    } catch (error) {
      throw new Error(friendlyError(error));
    }
  }

  async function reloadUser() {
    if (!configured || !auth || !auth.currentUser) return;
    await auth.currentUser.reload();
    user = {
      uid: auth.currentUser.uid,
      email: auth.currentUser.email,
      displayName: auth.currentUser.displayName,
      emailVerified: auth.currentUser.emailVerified,
      creationTime: auth.currentUser.metadata.creationTime,
    };
    notify();
  }

  function onChange(listener) {
    listeners.add(listener);
    if (ready) {
      try {
        listener(user);
      } catch (_) {}
    }
    return () => listeners.delete(listener);
  }

  function isLoggedIn() {
    return Boolean(user);
  }

  function currentUser() {
    return user;
  }

  function isConfigured() {
    return configured;
  }

  function isReady() {
    return ready;
  }

  init();

  return {
    signUp,
    logIn,
    logOut,
    resetPassword,
    getIdToken,
    sendVerificationEmail,
    reloadUser,
    onChange,
    isLoggedIn,
    currentUser,
    isConfigured,
    isReady,
  };
})();

window.PDFProAuth = PDFProAuth;
