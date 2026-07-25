require('dotenv').config();
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');

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

  upload: {
    maxFileSizeBytes: 50 * 1024 * 1024, 
    maxFiles: 20,
  },

  fileRetentionMs: 60 * 60 * 1000, 

  rateLimit: {
    windowMs: 15 * 60 * 1000,
    max: 200, 
  },

  corsOrigins: (process.env.CORS_ORIGINS || '*').split(','),
};
