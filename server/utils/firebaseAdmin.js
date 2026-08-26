const config = require('../config/config');

let adminApp = null;
let initialized = false;
let admin = null;

function resolveCredential() {
  if (config.firebase.serviceAccountJson) {
    try {
      return JSON.parse(config.firebase.serviceAccountJson);
    } catch (err) {
      console.warn('[auth] FIREBASE_SERVICE_ACCOUNT is not valid JSON — ignoring.');
    }
  }
  if (config.firebase.projectId && config.firebase.clientEmail && config.firebase.privateKey) {
    return {
      projectId: config.firebase.projectId,
      clientEmail: config.firebase.clientEmail,
      privateKey: config.firebase.privateKey,
    };
  }
  return null;
}

function init() {
  if (initialized) return adminApp;
  initialized = true;

  const credential = resolveCredential();
  if (!credential) {
    console.warn(
      '[auth] Firebase Admin is not configured. Requests above the guest size limit will be rejected until credentials are set.'
    );
    return null;
  }

  try {
    admin = require('firebase-admin');
    adminApp = admin.initializeApp({
      credential: admin.credential.cert(credential),
    });
    console.log('[auth] Firebase Admin initialized for project:', credential.projectId || config.firebase.projectId);
  } catch (err) {
    console.error('[auth] Failed to initialize Firebase Admin:', err.message);
    adminApp = null;
  }
  return adminApp;
}

function isConfigured() {
  init();
  return Boolean(adminApp);
}

async function verifyIdToken(token) {
  init();
  if (!adminApp) {
    throw new Error('Firebase Admin is not configured on the server.');
  }
  return admin.auth().verifyIdToken(token);
}

module.exports = { init, isConfigured, verifyIdToken };
