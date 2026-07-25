const fs = require('fs-extra');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const config = require('../config/config');

async function ensureDirectories() {
  await Promise.all([
    fs.ensureDir(config.paths.uploads),
    fs.ensureDir(config.paths.converted),
    fs.ensureDir(config.paths.temp),
  ]);
}

function sanitizeFilename(name) {
  const base = path.basename(name);
  return base.replace(/[^a-zA-Z0-9.\-_ ]/g, '').replace(/\s+/g, '_').slice(0, 150) || 'file';
}

function buildOutputPath(desiredName) {
  const safe = sanitizeFilename(desiredName);
  const ext = path.extname(safe);
  const base = path.basename(safe, ext);
  const unique = `${base}-${uuidv4().slice(0, 8)}${ext}`;
  return path.join(config.paths.converted, unique);
}

function buildTempPath(desiredName) {
  const safe = sanitizeFilename(desiredName);
  const ext = path.extname(safe);
  const base = path.basename(safe, ext);
  const unique = `${base}-${uuidv4().slice(0, 8)}${ext}`;
  return path.join(config.paths.temp, unique);
}

async function removeFiles(paths = []) {
  await Promise.all(
    paths.filter(Boolean).map((p) => fs.remove(p).catch(() => {}))
  );
}

async function purgeOldFiles(dir, maxAgeMs) {
  const now = Date.now();
  const entries = await fs.readdir(dir).catch(() => []);
  await Promise.all(
    entries.map(async (name) => {
      const fullPath = path.join(dir, name);
      try {
        const stat = await fs.stat(fullPath);
        if (now - stat.mtimeMs > maxAgeMs) {
          await fs.remove(fullPath);
        }
      } catch (_) {
      }
    })
  );
}

module.exports = {
  ensureDirectories,
  sanitizeFilename,
  buildOutputPath,
  buildTempPath,
  removeFiles,
  purgeOldFiles,
};
