const { execFile } = require('child_process');
const fs = require('fs-extra');
const path = require('path');
const sharp = require('sharp');
const archiver = require('archiver');
const { PDFDocument } = require('pdf-lib');
const config = require('../config/config');
const { buildOutputPath, buildTempPath, sanitizeFilename } = require('../utils/fileUtils');
const { Semaphore } = require('../utils/concurrency');
const { AppError } = require('../middleware/errorHandler');

const heavyQueue = new Semaphore(config.processing.maxConcurrentHeavy);

const GS_SETTINGS = {
  low: '/printer',
  medium: '/ebook',
  high: '/screen',
};

function runGhostscript(inputPath, outputPath, level) {
  return new Promise((resolve, reject) => {
    const args = [
      '-sDEVICE=pdfwrite',
      '-dCompatibilityLevel=1.5',
      `-dPDFSETTINGS=${GS_SETTINGS[level] || GS_SETTINGS.medium}`,
      '-dNOPAUSE',
      '-dQUIET',
      '-dBATCH',
      '-dDetectDuplicateImages=true',
      '-dCompressFonts=true',
      `-sOutputFile=${outputPath}`,
      inputPath,
    ];
    execFile(
      'gs',
      args,
      { timeout: config.processing.opTimeoutMs, killSignal: 'SIGKILL', maxBuffer: 16 * 1024 * 1024 },
      (err) => {
        if (err) return reject(err);
        resolve(outputPath);
      }
    );
  });
}

async function compressWithPdfLib(filePath, level) {
  const bytes = await fs.readFile(filePath);
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true, updateMetadata: false });
  const objectsPerTick = level === 'high' ? 20 : level === 'low' ? 200 : 60;
  const outBytes = await doc.save({ useObjectStreams: true, addDefaultPage: false, objectsPerTick });
  const outPath = buildOutputPath('compressed.pdf');
  await fs.writeFile(outPath, outBytes);
  return outPath;
}

async function compressPdf(filePath, options = {}) {
  const level = ['low', 'medium', 'high'].includes(options.quality) ? options.quality : 'medium';

  return heavyQueue.run(async () => {
    const originalSize = (await fs.stat(filePath)).size;
    const gsOutPath = buildOutputPath('compressed.pdf');

    try {
      await runGhostscript(filePath, gsOutPath, level);
      const gsSize = (await fs.stat(gsOutPath)).size;

      if (gsSize > 0 && gsSize < originalSize) {
        return gsOutPath;
      }

      await fs.remove(gsOutPath).catch(() => {});
      const fallbackPath = await compressWithPdfLib(filePath, level);
      const fallbackSize = (await fs.stat(fallbackPath)).size;

      if (fallbackSize >= originalSize) {
        await fs.copy(filePath, fallbackPath, { overwrite: true });
      }
      return fallbackPath;
    } catch (err) {
      await fs.remove(gsOutPath).catch(() => {});
      return compressWithPdfLib(filePath, level);
    }
  });
}

function runPdftoppm(inputPath, outDir, prefix, dpi) {
  return new Promise((resolve, reject) => {
    const args = ['-jpeg', '-r', String(dpi), inputPath, path.join(outDir, prefix)];
    execFile(
      'pdftoppm',
      args,
      { timeout: config.processing.opTimeoutMs, killSignal: 'SIGKILL', maxBuffer: 16 * 1024 * 1024 },
      (err) => {
        if (err) {
          if (err.code === 'ENOENT') {
            return reject(new AppError('TOOL_UNAVAILABLE', 'PDF to image is temporarily unavailable.', 503));
          }
          if (err.killed) {
            return reject(new AppError('PROCESSING_TIMEOUT', 'Rendering the PDF took too long.', 504));
          }
          return reject(err);
        }
        resolve();
      }
    );
  });
}

async function pdfToJpg(filePath, options = {}) {
  const quality = parseInt(options.quality, 10) || 90;
  const dpi = Math.min(parseInt(options.dpi, 10) || 150, 300);
  const baseName = sanitizeFilename(options.baseName || 'page');

  return heavyQueue.run(async () => {
    const tempDir = buildTempPath('pdf-to-jpg');
    await fs.ensureDir(tempDir);

    try {
      await runPdftoppm(filePath, tempDir, 'page', dpi);

      const rendered = (await fs.readdir(tempDir))
        .filter((name) => /\.jpe?g$/i.test(name))
        .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

      if (!rendered.length) {
        throw new AppError('PROCESSING_FAILED', 'No pages could be converted to images.', 422);
      }

      const outPath = buildOutputPath('pdf-pages.zip');
      const output = fs.createWriteStream(outPath);
      const archive = archiver('zip', { zlib: { level: 6 } });

      await new Promise((resolve, reject) => {
        output.on('close', resolve);
        output.on('error', reject);
        archive.on('error', reject);
        archive.pipe(output);

        (async () => {
          for (let i = 0; i < rendered.length; i++) {
            const optimized = await sharp(path.join(tempDir, rendered[i]))
              .jpeg({ quality })
              .toBuffer();
            archive.append(optimized, { name: `${baseName}_page_${i + 1}.jpg` });
          }
          archive.finalize();
        })().catch(reject);
      });

      return outPath;
    } finally {
      await fs.remove(tempDir).catch(() => {});
    }
  });
}

async function imagesToPdf(filePaths, options = {}) {
  const { pageSize = 'auto', margin = 0 } = options;

  return heavyQueue.run(async () => {
    const doc = await PDFDocument.create();

    for (const filePath of filePaths) {
      const buffer = await sharp(filePath)
        .rotate()
        .resize({ width: 2000, height: 2000, fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 90 })
        .toBuffer();

      const image = await doc.embedJpg(buffer);
      const { width, height } = image;

      if (pageSize === 'a4') {
        const A4 = [595.28, 841.89];
        const scale = Math.min(A4[0] / width, A4[1] / height);
        const page = doc.addPage(A4);
        const drawW = width * scale - margin * 2;
        const drawH = height * scale - margin * 2;
        page.drawImage(image, {
          x: (A4[0] - drawW) / 2,
          y: (A4[1] - drawH) / 2,
          width: drawW,
          height: drawH,
        });
      } else {
        const page = doc.addPage([width, height]);
        page.drawImage(image, { x: 0, y: 0, width, height });
      }
    }

    const outPath = buildOutputPath('images-to-pdf.pdf');
    await fs.writeFile(outPath, await doc.save());
    return outPath;
  });
}

module.exports = { imagesToPdf, pdfToJpg, compressPdf };
