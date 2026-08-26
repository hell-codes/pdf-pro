const { execFile } = require('child_process');
const fs = require('fs-extra');
const config = require('../config/config');
const { buildOutputPath } = require('../utils/fileUtils');
const { AppError } = require('../middleware/errorHandler');

function runQpdf(args) {
  return new Promise((resolve, reject) => {
    execFile(
      'qpdf',
      args,
      { timeout: config.processing.opTimeoutMs, killSignal: 'SIGKILL', maxBuffer: 16 * 1024 * 1024 },
      (err, stdout, stderr) => {
        if (err) {
          err.stderr = stderr ? stderr.toString() : '';
          return reject(err);
        }
        resolve(stdout);
      }
    );
  });
}

async function protectPdf(filePath, password) {
  if (!password || password.length < 4) {
    throw new AppError('PASSWORD_TOO_SHORT', 'Password must be at least 4 characters.', 400);
  }
  const outPath = buildOutputPath('protected.pdf');
  try {
    await runQpdf(['--encrypt', password, password, '256', '--', filePath, outPath]);
  } catch (err) {
    await fs.remove(outPath).catch(() => {});
    if (err.code === 'ENOENT') {
      throw new AppError('TOOL_UNAVAILABLE', 'PDF protection is temporarily unavailable.', 503);
    }
    throw new AppError('PROCESSING_FAILED', 'This PDF could not be protected. Please try again.', 422);
  }
  return outPath;
}

async function unlockPdf(filePath, password) {
  const outPath = buildOutputPath('unlocked.pdf');
  try {
    await runQpdf([`--password=${password || ''}`, '--decrypt', filePath, outPath]);
  } catch (err) {
    await fs.remove(outPath).catch(() => {});
    if (err.code === 'ENOENT') {
      throw new AppError('TOOL_UNAVAILABLE', 'PDF unlocking is temporarily unavailable.', 503);
    }
    throw new AppError(
      'WRONG_PASSWORD',
      'This PDF could not be unlocked. The password may be incorrect.',
      422
    );
  }
  return outPath;
}

module.exports = { protectPdf, unlockPdf };
