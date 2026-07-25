const { execFile } = require('child_process');
const fs = require('fs-extra');
const { buildOutputPath } = require('../utils/fileUtils');

function runQpdf(args) {
  return new Promise((resolve, reject) => {
    execFile('qpdf', args, (err, stdout, stderr) => {
      if (err) {
        reject(new Error(stderr?.toString().trim() || err.message));
      } else {
        resolve(stdout);
      }
    });
  });
}

async function protectPdf(filePath, password) {
  if (!password || password.length < 4) {
    throw new Error('Password must be at least 4 characters.');
  }
  const outPath = buildOutputPath('protected.pdf');
  try {
    await runQpdf([
      '--encrypt', password, password, '256',
      '--',
      filePath,
      outPath,
    ]);
  } catch (err) {
    await fs.remove(outPath).catch(() => {});
    throw new Error(
      `Could not protect this PDF: ${err.message}. Ensure "qpdf" is installed on the server.`
    );
  }
  return outPath;
}

async function unlockPdf(filePath, password) {
  const outPath = buildOutputPath('unlocked.pdf');
  try {
    await runQpdf([
      `--password=${password}`,
      '--decrypt',
      filePath,
      outPath,
    ]);
  } catch (err) {
    await fs.remove(outPath).catch(() => {});
    throw new Error(
      'Could not unlock this PDF — the password may be incorrect, or "qpdf" is not installed on the server.'
    );
  }
  return outPath;
}

module.exports = { protectPdf, unlockPdf };
