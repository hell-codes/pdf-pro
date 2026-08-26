const { execFile } = require('child_process');
const fs = require('fs-extra');
const path = require('path');
const config = require('../config/config');
const { buildOutputPath, buildTempPath } = require('../utils/fileUtils');
const { Semaphore } = require('../utils/concurrency');
const { AppError } = require('../middleware/errorHandler');

const officeQueue = new Semaphore(config.processing.officeConcurrency);

function runSoffice(inputPath, targetFilter, outDir, profileDir) {
  return new Promise((resolve, reject) => {
    const args = [
      '--headless',
      '--norestore',
      '--nolockcheck',
      '--nodefault',
      '--nofirststartwizard',
      `-env:UserInstallation=file://${profileDir}`,
      '--convert-to',
      targetFilter,
      '--outdir',
      outDir,
      inputPath,
    ];
    execFile(
      'soffice',
      args,
      { timeout: config.processing.officeTimeoutMs, killSignal: 'SIGKILL', maxBuffer: 64 * 1024 * 1024 },
      (err, stdout, stderr) => {
        if (err) {
          if (err.killed) {
            return reject(new AppError('PROCESSING_TIMEOUT', 'The document conversion took too long.', 504));
          }
          if (err.code === 'ENOENT') {
            return reject(new AppError('TOOL_UNAVAILABLE', 'Document conversion is temporarily unavailable.', 503));
          }
          return reject(err);
        }
        resolve({ stdout, stderr });
      }
    );
  });
}

async function convertDocument(filePath, targetFilter, outExt) {
  return officeQueue.run(async () => {
    const workDir = buildTempPath('office-work');
    const profileDir = buildTempPath('office-profile');
    await fs.ensureDir(workDir);
    await fs.ensureDir(profileDir);

    try {
      await runSoffice(filePath, targetFilter, workDir, profileDir);
      const produced = (await fs.readdir(workDir)).find((name) =>
        name.toLowerCase().endsWith(`.${outExt}`)
      );
      if (!produced) {
        throw new AppError(
          'PROCESSING_FAILED',
          'The document could not be converted. It may be corrupted or in an unsupported format.',
          422
        );
      }
      const outPath = buildOutputPath(`document.${outExt}`);
      await fs.move(path.join(workDir, produced), outPath, { overwrite: true });
      return outPath;
    } finally {
      await fs.remove(workDir).catch(() => {});
      await fs.remove(profileDir).catch(() => {});
    }
  });
}

async function wordToPdf(filePath) {
  return convertDocument(filePath, 'pdf', 'pdf');
}

async function pdfToWord(filePath) {
  return convertDocument(filePath, 'docx:MS Word 2007 XML', 'docx');
}

module.exports = { wordToPdf, pdfToWord };
