require('dotenv').config();
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');

function toBytes(mb) {
  return Math.round(mb * 1024 * 1024);
}

function parseOrigins(raw) {
  if (!raw || raw.trim() === '' || raw.trim() === '*') {
    return '*';
  }
  return raw
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

const GUEST_MAX_MB = parseFloat(process.env.GUEST_MAX_MB) || 10;
const AUTH_MAX_MB = parseFloat(process.env.AUTH_MAX_MB) || 100;

module.exports = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT, 10) || 5000,

  paths: {
    root: ROOT,
    public: ROOT,
    uploads: path.join(ROOT, 'uploads'),
    converted: path.join(ROOT, 'converted'),
    temp: path.join(ROOT, 'temp'),
  },

  limits: {
    guestMaxBytes: toBytes(GUEST_MAX_MB),
    authedMaxBytes: toBytes(AUTH_MAX_MB),
    guestMaxMb: GUEST_MAX_MB,
    authedMaxMb: AUTH_MAX_MB,
    maxFiles: parseInt(process.env.MAX_FILES, 10) || 20,
  },

  upload: {
    maxFileSizeBytes: toBytes(AUTH_MAX_MB),
    maxFiles: parseInt(process.env.MAX_FILES, 10) || 20,
  },

  processing: {
    opTimeoutMs: parseInt(process.env.OP_TIMEOUT_MS, 10) || 120000,
    officeTimeoutMs: parseInt(process.env.OFFICE_TIMEOUT_MS, 10) || 90000,
    maxConcurrentHeavy: parseInt(process.env.MAX_CONCURRENT_HEAVY, 10) || 2,
    officeConcurrency: parseInt(process.env.OFFICE_CONCURRENCY, 10) || 1,
  },

  fileRetentionMs: 60 * 60 * 1000,

  rateLimit: {
    windowMs: 15 * 60 * 1000,
    max: parseInt(process.env.RATE_LIMIT_MAX, 10) || 200,
  },

  corsOrigins: parseOrigins(process.env.CORS_ORIGINS),

  firebase: {
    projectId: process.env.FIREBASE_PROJECT_ID || '',
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL || '',
    privateKey: (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
    serviceAccountJson: process.env.FIREBASE_SERVICE_ACCOUNT || '',
  },
};
