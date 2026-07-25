const path = require('path');
const fs = require('fs-extra');
const { AppError } = require('../middleware/errorHandler');
const { removeFiles } = require('../utils/fileUtils');

const pdfService = require('../services/pdfService');
const imageService = require('../services/imageService');
const officeService = require('../services/officeService');
const secureService = require('../services/secureService');

async function sendResult(res, outPath, downloadName, cleanupPaths = []) {
  res.download(outPath, downloadName, async (err) => {
    if (err) console.error('[download] error streaming file:', err.message);
    await removeFiles([outPath, ...cleanupPaths]);
  });
}

function requireFiles(req, min = 1) {
  const files = req.files || [];
  if (files.length < min) {
    throw new AppError(
      min === 1 ? 'Please upload a file to continue.' : `Please upload at least ${min} files.`,
      400
    );
  }
  return files;
}


exports.mergePdfs = async (req, res, next) => {
  const files = requireFiles(req, 2);
  try {
    let paths = files.map((f) => f.path);
    if (req.body.order) {
      try {
        const order = JSON.parse(req.body.order);
        if (Array.isArray(order) && order.length === files.length) {
        }
      } catch (_) {  }
    }
    const outPath = await pdfService.mergePdfs(paths);
    await sendResult(res, outPath, 'merged.pdf', paths);
  } catch (err) {
    await removeFiles(files.map((f) => f.path));
    next(err);
  }
};

exports.splitPdf = async (req, res, next) => {
  const files = requireFiles(req, 1);
  const filePath = files[0].path;
  try {
    const outPath = await pdfService.splitPdf(filePath, req.body.ranges);
    await sendResult(res, outPath, 'split-pages.zip', [filePath]);
  } catch (err) {
    await removeFiles([filePath]);
    next(err);
  }
};

exports.rotatePdf = async (req, res, next) => {
  const files = requireFiles(req, 1);
  const filePath = files[0].path;
  try {
    const outPath = await pdfService.rotatePdf(filePath, req.body.rotation || 90, req.body.pages || 'all');
    await sendResult(res, outPath, 'rotated.pdf', [filePath]);
  } catch (err) {
    await removeFiles([filePath]);
    next(err);
  }
};

exports.deletePages = async (req, res, next) => {
  const files = requireFiles(req, 1);
  const filePath = files[0].path;
  try {
    if (!req.body.pages) throw new AppError('Specify which pages to delete (e.g. "2,4-6").', 400);
    const outPath = await pdfService.deletePages(filePath, req.body.pages);
    await sendResult(res, outPath, 'pages-deleted.pdf', [filePath]);
  } catch (err) {
    await removeFiles([filePath]);
    next(err);
  }
};

exports.rearrangePages = async (req, res, next) => {
  const files = requireFiles(req, 1);
  const filePath = files[0].path;
  try {
    let order = [];
    if (req.body.pageOrder) {
      order = JSON.parse(req.body.pageOrder);
    } else {
      const totalPages = await pdfService.getPageCount(filePath);
      order = Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    const outPath = await pdfService.rearrangePages(filePath, order);
    await sendResult(res, outPath, 'rearranged.pdf', [filePath]);
  } catch (err) {
    await removeFiles([filePath]);
    next(err);
  }
};

exports.addWatermark = async (req, res, next) => {
  const files = requireFiles(req, 1);
  const filePath = files[0].path;
  try {
    const outPath = await pdfService.addWatermark(filePath, {
      text: req.body.text || 'CONFIDENTIAL',
      opacity: parseFloat(req.body.opacity) || 0.3,
      fontSize: parseInt(req.body.fontSize, 10) || 48,
      color: req.body.color || '#4F46E5',
      rotationDeg: parseInt(req.body.rotation, 10) || -45,
      position: req.body.position || 'center',
    });
    await sendResult(res, outPath, 'watermarked.pdf', [filePath]);
  } catch (err) {
    await removeFiles([filePath]);
    next(err);
  }
};

exports.addPageNumbers = async (req, res, next) => {
  const files = requireFiles(req, 1);
  const filePath = files[0].path;
  try {
    const outPath = await pdfService.addPageNumbers(filePath, {
      position: req.body.position || 'bottom-center',
      startAt: parseInt(req.body.startAt, 10) || 1,
      fontSize: parseInt(req.body.fontSize, 10) || 11,
      format: req.body.format || '{n}',
    });
    await sendResult(res, outPath, 'numbered.pdf', [filePath]);
  } catch (err) {
    await removeFiles([filePath]);
    next(err);
  }
};

exports.extractImages = async (req, res, next) => {
  const files = requireFiles(req, 1);
  const filePath = files[0].path;
  try {
    const outPath = await pdfService.extractImages(filePath);
    await sendResult(res, outPath, 'extracted-images.zip', [filePath]);
  } catch (err) {
    await removeFiles([filePath]);
    next(err);
  }
};

exports.imagesToPdf = async (req, res, next) => {
  const files = requireFiles(req, 1);
  try {
    const paths = files.map((f) => f.path);
    const outPath = await imageService.imagesToPdf(paths, {
      pageSize: req.body.pageSize || 'auto',
      margin: parseInt(req.body.margin, 10) || 0,
    });
    await sendResult(res, outPath, 'images-to-pdf.pdf', paths);
  } catch (err) {
    await removeFiles(files.map((f) => f.path));
    next(err);
  }
};

exports.pdfToJpg = async (req, res, next) => {
  const files = requireFiles(req, 1);
  const filePath = files[0].path;
  try {
    const outPath = await imageService.pdfToJpg(filePath, {
      quality: req.body.quality || 90,
      dpi: req.body.dpi || 150,
    });
    await sendResult(res, outPath, 'pdf-pages.zip', [filePath]);
  } catch (err) {
    await removeFiles([filePath]);
    next(err);
  }
};

exports.compressPdf = async (req, res, next) => {
  const files = requireFiles(req, 1);
  const filePath = files[0].path;
  try {
    const outPath = await imageService.compressPdf(filePath, { quality: req.body.quality || 'medium' });
    await sendResult(res, outPath, 'compressed.pdf', [filePath]);
  } catch (err) {
    await removeFiles([filePath]);
    next(err);
  }
};

exports.wordToPdf = async (req, res, next) => {
  const files = requireFiles(req, 1);
  const filePath = files[0].path;
  try {
    const outPath = await officeService.wordToPdf(filePath);
    await sendResult(res, outPath, 'converted.pdf', [filePath]);
  } catch (err) {
    await removeFiles([filePath]);
    next(err);
  }
};

exports.pdfToWord = async (req, res, next) => {
  const files = requireFiles(req, 1);
  const filePath = files[0].path;
  try {
    const outPath = await officeService.pdfToWord(filePath);
    await sendResult(res, outPath, 'converted.docx', [filePath]);
  } catch (err) {
    await removeFiles([filePath]);
    next(err);
  }
};

exports.protectPdf = async (req, res, next) => {
  const files = requireFiles(req, 1);
  const filePath = files[0].path;
  try {
    if (!req.body.password) throw new AppError('A password is required to protect this PDF.', 400);
    const outPath = await secureService.protectPdf(filePath, req.body.password);
    await sendResult(res, outPath, 'protected.pdf', [filePath]);
  } catch (err) {
    await removeFiles([filePath]);
    next(err);
  }
};

exports.unlockPdf = async (req, res, next) => {
  const files = requireFiles(req, 1);
  const filePath = files[0].path;
  try {
    if (!req.body.password) throw new AppError('Enter the PDF\'s current password to unlock it.', 400);
    const outPath = await secureService.unlockPdf(filePath, req.body.password);
    await sendResult(res, outPath, 'unlocked.pdf', [filePath]);
  } catch (err) {
    await removeFiles([filePath]);
    next(err);
  }
};
