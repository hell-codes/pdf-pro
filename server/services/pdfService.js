const fs = require('fs-extra');
const path = require('path');
const archiver = require('archiver');
const { PDFDocument, rgb, degrees, StandardFonts } = require('pdf-lib');
const { buildOutputPath, sanitizeFilename } = require('../utils/fileUtils');
const { AppError } = require('../middleware/errorHandler');

async function loadPdf(filePath) {
  const bytes = await fs.readFile(filePath);
  try {
    return await PDFDocument.load(bytes, { ignoreEncryption: true });
  } catch (err) {
    throw new AppError(
      'FILE_CORRUPT',
      `"${path.basename(filePath)}" appears to be corrupted or is not a valid PDF.`,
      422
    );
  }
}

async function getPageCount(filePath) {
  const doc = await loadPdf(filePath);
  return doc.getPageCount();
}

function parsePageRanges(rangeStr, totalPages) {
  if (!rangeStr || rangeStr.trim().toLowerCase() === 'all') {
    return Array.from({ length: totalPages }, (_, i) => i);
  }
  const pages = new Set();
  rangeStr.split(',').forEach((part) => {
    const trimmed = part.trim();
    if (!trimmed) return;
    if (trimmed.includes('-')) {
      const [startStr, endStr] = trimmed.split('-').map((s) => s.trim());
      const start = parseInt(startStr, 10);
      const end = parseInt(endStr, 10);
      if (Number.isNaN(start) || Number.isNaN(end)) return;
      for (let p = start; p <= end; p++) {
        if (p >= 1 && p <= totalPages) pages.add(p - 1);
      }
    } else {
      const p = parseInt(trimmed, 10);
      if (!Number.isNaN(p) && p >= 1 && p <= totalPages) pages.add(p - 1);
    }
  });
  return Array.from(pages).sort((a, b) => a - b);
}

async function mergePdfs(filePaths) {
  const merged = await PDFDocument.create();
  for (const filePath of filePaths) {
    const src = await loadPdf(filePath);
    const pages = await merged.copyPages(src, src.getPageIndices());
    pages.forEach((page) => merged.addPage(page));
  }
  const outPath = buildOutputPath('merged.pdf');
  await fs.writeFile(outPath, await merged.save());
  return outPath;
}

async function splitPdf(filePath, rangeStr, options = {}) {
  const baseName = sanitizeFilename(options.baseName || 'part');
  const src = await loadPdf(filePath);
  const totalPages = src.getPageCount();

  const groups =
    rangeStr && rangeStr.trim() && rangeStr.trim().toLowerCase() !== 'all'
      ? rangeStr.split(',').map((g) => g.trim()).filter(Boolean)
      : Array.from({ length: totalPages }, (_, i) => String(i + 1));

  const outPath = buildOutputPath('split.zip');
  const output = fs.createWriteStream(outPath);
  const archive = archiver('zip', { zlib: { level: 9 } });

  await new Promise((resolve, reject) => {
    output.on('close', resolve);
    output.on('error', reject);
    archive.on('error', reject);
    archive.pipe(output);

    (async () => {
      for (let i = 0; i < groups.length; i++) {
        const pageIndices = parsePageRanges(groups[i], totalPages);
        if (!pageIndices.length) continue;
        const doc = await PDFDocument.create();
        const pages = await doc.copyPages(src, pageIndices);
        pages.forEach((p) => doc.addPage(p));
        const bytes = await doc.save();
        archive.append(Buffer.from(bytes), { name: `${baseName}_part_${i + 1}.pdf` });
      }
      archive.finalize();
    })().catch(reject);
  });

  return outPath;
}

async function rotatePdf(filePath, angle, pageRange) {
  const doc = await loadPdf(filePath);
  const totalPages = doc.getPageCount();
  const targetPages = new Set(parsePageRanges(pageRange, totalPages));
  const normalizedAngle = (((parseInt(angle, 10) || 0) % 360) + 360) % 360;

  doc.getPages().forEach((page, idx) => {
    if (targetPages.has(idx)) {
      const current = page.getRotation().angle;
      page.setRotation(degrees((current + normalizedAngle) % 360));
    }
  });

  const outPath = buildOutputPath('rotated.pdf');
  await fs.writeFile(outPath, await doc.save());
  return outPath;
}

async function deletePages(filePath, pageRange) {
  const src = await loadPdf(filePath);
  const totalPages = src.getPageCount();
  const toDelete = new Set(parsePageRanges(pageRange, totalPages));

  if (toDelete.size >= totalPages) {
    throw new AppError(
      'INVALID_INPUT',
      'Cannot delete every page — the PDF must have at least one page remaining.',
      400
    );
  }

  const keepIndices = Array.from({ length: totalPages }, (_, i) => i).filter((i) => !toDelete.has(i));
  const doc = await PDFDocument.create();
  const pages = await doc.copyPages(src, keepIndices);
  pages.forEach((p) => doc.addPage(p));

  const outPath = buildOutputPath('pages-deleted.pdf');
  await fs.writeFile(outPath, await doc.save());
  return outPath;
}

async function rearrangePages(filePath, newOrder) {
  const src = await loadPdf(filePath);
  const totalPages = src.getPageCount();
  const order = Array.isArray(newOrder) ? newOrder.map((n) => parseInt(n, 10) - 1) : [];

  const validOrder = order.filter((i) => i >= 0 && i < totalPages);
  if (!validOrder.length) {
    throw new AppError('INVALID_INPUT', 'No valid page order was provided.', 400);
  }

  const doc = await PDFDocument.create();
  const pages = await doc.copyPages(src, validOrder);
  pages.forEach((p) => doc.addPage(p));

  const outPath = buildOutputPath('rearranged.pdf');
  await fs.writeFile(outPath, await doc.save());
  return outPath;
}

async function addWatermark(filePath, options = {}) {
  const {
    text = 'CONFIDENTIAL',
    opacity = 0.3,
    fontSize = 48,
    color = '#4F46E5',
    rotationDeg = -45,
    position = 'center',
  } = options;

  const doc = await loadPdf(filePath);
  const font = await doc.embedFont(StandardFonts.HelveticaBold);
  const { r, g, b } = hexToRgb(color);

  doc.getPages().forEach((page) => {
    const { width, height } = page.getSize();
    const textWidth = font.widthOfTextAtSize(text, fontSize);

    if (position === 'tiled') {
      const stepX = textWidth + 80;
      const stepY = fontSize * 4;
      for (let y = -height; y < height * 2; y += stepY) {
        for (let x = -width; x < width * 2; x += stepX) {
          page.drawText(text, {
            x,
            y,
            size: fontSize,
            font,
            color: rgb(r, g, b),
            opacity,
            rotate: degrees(rotationDeg),
          });
        }
      }
    } else {
      page.drawText(text, {
        x: width / 2 - textWidth / 2,
        y: height / 2,
        size: fontSize,
        font,
        color: rgb(r, g, b),
        opacity,
        rotate: degrees(rotationDeg),
      });
    }
  });

  const outPath = buildOutputPath('watermarked.pdf');
  await fs.writeFile(outPath, await doc.save());
  return outPath;
}

async function addPageNumbers(filePath, options = {}) {
  const { position = 'bottom-center', startAt = 1, fontSize = 11, format = '{n}' } = options;

  const doc = await loadPdf(filePath);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const pages = doc.getPages();
  const total = pages.length;

  pages.forEach((page, idx) => {
    const { width } = page.getSize();
    const num = idx + parseInt(startAt, 10);
    const label = format.replace('{n}', num).replace('{total}', total);
    const textWidth = font.widthOfTextAtSize(label, fontSize);

    let x = width / 2 - textWidth / 2;
    let y = 24;
    if (position === 'bottom-right') x = width - textWidth - 36;
    if (position === 'bottom-left') x = 36;
    if (position === 'top-center') y = page.getSize().height - 36;

    page.drawText(label, { x, y, size: fontSize, font, color: rgb(0.28, 0.33, 0.41) });
  });

  const outPath = buildOutputPath('numbered.pdf');
  await fs.writeFile(outPath, await doc.save());
  return outPath;
}

async function extractImages(filePath, options = {}) {
  const baseName = sanitizeFilename(options.baseName || 'image');
  const bytes = await fs.readFile(filePath);
  let doc;
  try {
    doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
  } catch (err) {
    throw new AppError('FILE_CORRUPT', 'This PDF appears to be corrupted or unsupported.', 422);
  }

  const outPath = buildOutputPath('extracted-images.zip');
  const output = fs.createWriteStream(outPath);
  const archive = archiver('zip', { zlib: { level: 9 } });

  let imageCount = 0;

  await new Promise((resolve, reject) => {
    output.on('close', resolve);
    output.on('error', reject);
    archive.on('error', reject);
    archive.pipe(output);

    const context = doc.context;
    const seen = new Set();

    for (const [ref, obj] of context.enumerateIndirectObjects()) {
      if (!obj || !obj.dict) continue;
      const key = ref.toString();
      if (seen.has(key)) continue;

      const isImage =
        obj.constructor?.name === 'PDFRawStream' &&
        obj.dict?.get &&
        obj.dict.lookup &&
        obj.dict.lookup(context.obj('Subtype'))?.toString() === '/Image';

      if (isImage) {
        seen.add(key);
        try {
          const filterObj = obj.dict.lookup(context.obj('Filter'));
          const filterName = filterObj ? filterObj.toString() : '';
          const ext = filterName.includes('DCTDecode')
            ? 'jpg'
            : filterName.includes('JPXDecode')
            ? 'jp2'
            : 'png';
          imageCount += 1;
          archive.append(Buffer.from(obj.contents), { name: `${baseName}_image_${imageCount}.${ext}` });
        } catch (_) {}
      }
    }

    archive.finalize();
  });

  if (imageCount === 0) {
    await fs.remove(outPath);
    throw new AppError('NO_IMAGES', 'No embedded images were found in this PDF.', 422);
  }

  return outPath;
}

function hexToRgb(hex) {
  const clean = String(hex).replace('#', '');
  const bigint = parseInt(clean, 16);
  return {
    r: ((bigint >> 16) & 255) / 255,
    g: ((bigint >> 8) & 255) / 255,
    b: (bigint & 255) / 255,
  };
}

module.exports = {
  loadPdf,
  getPageCount,
  parsePageRanges,
  mergePdfs,
  splitPdf,
  rotatePdf,
  deletePages,
  rearrangePages,
  addWatermark,
  addPageNumbers,
  extractImages,
};
