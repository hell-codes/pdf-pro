const config = require('../config/config');
const { AppError } = require('../middleware/errorHandler');
const { removeFiles, deriveDownloadName, stripExtension } = require('../utils/fileUtils');
const { withTimeout } = require('../utils/concurrency');

const pdfService = require('../services/pdfService');
const imageService = require('../services/imageService');
const officeService = require('../services/officeService');
const secureService = require('../services/secureService');

function requireFiles(req, min = 1) {
  const files = req.files || [];
  if (files.length < min) {
    throw new AppError(
      'NO_FILE',
      min === 1 ? 'Please upload a file to continue.' : `Please upload at least ${min} files.`,
      400
    );
  }
  return files;
}

function inputPaths(files) {
  return files.map((f) => f.path);
}

function originalNameOf(files) {
  return files[0] && files[0].originalname ? files[0].originalname : 'document.pdf';
}

function sendResult(res, outPath, downloadName, cleanupPaths) {
  res.setHeader('X-Result-Filename', encodeURIComponent(downloadName));
  res.download(outPath, downloadName, async (err) => {
    if (err && !res.headersSent) {
      console.error('[download] failed to stream result:', err.message);
    }
    await removeFiles([outPath, ...cleanupPaths]);
  });
}

async function execute(res, next, { files, downloadName, task, timeoutMs }) {
  const cleanup = inputPaths(files);
  try {
    const outPath = await withTimeout(
      Promise.resolve().then(task),
      timeoutMs || config.processing.opTimeoutMs,
      'This file took too long to process and was stopped. Try a smaller or simpler file.'
    );
    sendResult(res, outPath, downloadName, cleanup);
  } catch (err) {
    await removeFiles(cleanup);
    next(err);
  }
}

exports.mergePdfs = async (req, res, next) => {
  const files = requireFiles(req, 2);
  const paths = inputPaths(files);
  const downloadName = deriveDownloadName(originalNameOf(files), { suffix: '_merged', ext: 'pdf' });
  await execute(res, next, {
    files,
    downloadName,
    task: () => pdfService.mergePdfs(paths),
  });
};

exports.splitPdf = async (req, res, next) => {
  const files = requireFiles(req, 1);
  const original = originalNameOf(files);
  await execute(res, next, {
    files,
    downloadName: deriveDownloadName(original, { suffix: '_split', ext: 'zip' }),
    task: () => pdfService.splitPdf(files[0].path, req.body.ranges, { baseName: stripExtension(original) }),
  });
};

exports.rotatePdf = async (req, res, next) => {
  const files = requireFiles(req, 1);
  await execute(res, next, {
    files,
    downloadName: deriveDownloadName(originalNameOf(files), { suffix: '_rotated', ext: 'pdf' }),
    task: () => pdfService.rotatePdf(files[0].path, req.body.rotation || 90, req.body.pages || 'all'),
  });
};

exports.deletePages = async (req, res, next) => {
  const files = requireFiles(req, 1);
  if (!req.body.pages) {
    await removeFiles(inputPaths(files));
    return next(new AppError('INVALID_INPUT', 'Specify which pages to delete (e.g. "2,4-6").', 400));
  }
  await execute(res, next, {
    files,
    downloadName: deriveDownloadName(originalNameOf(files), { suffix: '_pages-deleted', ext: 'pdf' }),
    task: () => pdfService.deletePages(files[0].path, req.body.pages),
  });
};

exports.rearrangePages = async (req, res, next) => {
  const files = requireFiles(req, 1);
  await execute(res, next, {
    files,
    downloadName: deriveDownloadName(originalNameOf(files), { suffix: '_rearranged', ext: 'pdf' }),
    task: async () => {
      let order = [];
      if (req.body.pageOrder) {
        try {
          order = JSON.parse(req.body.pageOrder);
        } catch (_) {
          throw new AppError('INVALID_INPUT', 'The page order provided was not valid.', 400);
        }
      } else {
        const totalPages = await pdfService.getPageCount(files[0].path);
        order = Array.from({ length: totalPages }, (_, i) => i + 1);
      }
      return pdfService.rearrangePages(files[0].path, order);
    },
  });
};

exports.addWatermark = async (req, res, next) => {
  const files = requireFiles(req, 1);
  await execute(res, next, {
    files,
    downloadName: deriveDownloadName(originalNameOf(files), { suffix: '_watermarked', ext: 'pdf' }),
    task: () =>
      pdfService.addWatermark(files[0].path, {
        text: req.body.text || 'CONFIDENTIAL',
        opacity: parseFloat(req.body.opacity) || 0.3,
        fontSize: parseInt(req.body.fontSize, 10) || 48,
        color: req.body.color || '#4F46E5',
        rotationDeg: parseInt(req.body.rotation, 10) || -45,
        position: req.body.position || 'center',
      }),
  });
};

exports.addPageNumbers = async (req, res, next) => {
  const files = requireFiles(req, 1);
  await execute(res, next, {
    files,
    downloadName: deriveDownloadName(originalNameOf(files), { suffix: '_numbered', ext: 'pdf' }),
    task: () =>
      pdfService.addPageNumbers(files[0].path, {
        position: req.body.position || 'bottom-center',
        startAt: parseInt(req.body.startAt, 10) || 1,
        fontSize: parseInt(req.body.fontSize, 10) || 11,
        format: req.body.format || '{n}',
      }),
  });
};

exports.extractImages = async (req, res, next) => {
  const files = requireFiles(req, 1);
  const original = originalNameOf(files);
  await execute(res, next, {
    files,
    downloadName: deriveDownloadName(original, { suffix: '_images', ext: 'zip' }),
    task: () => pdfService.extractImages(files[0].path, { baseName: stripExtension(original) }),
  });
};

exports.imagesToPdf = async (req, res, next) => {
  const files = requireFiles(req, 1);
  const paths = inputPaths(files);
  await execute(res, next, {
    files,
    downloadName: deriveDownloadName(originalNameOf(files), { suffix: '', ext: 'pdf' }),
    task: () =>
      imageService.imagesToPdf(paths, {
        pageSize: req.body.pageSize || 'auto',
        margin: parseInt(req.body.margin, 10) || 0,
      }),
  });
};

exports.pdfToJpg = async (req, res, next) => {
  const files = requireFiles(req, 1);
  const original = originalNameOf(files);
  await execute(res, next, {
    files,
    downloadName: deriveDownloadName(original, { suffix: '_jpg', ext: 'zip' }),
    task: () =>
      imageService.pdfToJpg(files[0].path, {
        quality: parseInt(req.body.quality, 10) || 90,
        dpi: parseInt(req.body.dpi, 10) || 150,
        baseName: stripExtension(original),
      }),
  });
};

exports.compressPdf = async (req, res, next) => {
  const files = requireFiles(req, 1);
  await execute(res, next, {
    files,
    downloadName: deriveDownloadName(originalNameOf(files), { suffix: '_compressed', ext: 'pdf' }),
    task: () => imageService.compressPdf(files[0].path, { quality: req.body.quality || 'medium' }),
  });
};

exports.wordToPdf = async (req, res, next) => {
  const files = requireFiles(req, 1);
  await execute(res, next, {
    files,
    downloadName: deriveDownloadName(originalNameOf(files), { suffix: '', ext: 'pdf' }),
    task: () => officeService.wordToPdf(files[0].path),
    timeoutMs: config.processing.officeTimeoutMs + 15000,
  });
};

exports.pdfToWord = async (req, res, next) => {
  const files = requireFiles(req, 1);
  await execute(res, next, {
    files,
    downloadName: deriveDownloadName(originalNameOf(files), { suffix: '', ext: 'docx' }),
    task: () => officeService.pdfToWord(files[0].path),
    timeoutMs: config.processing.officeTimeoutMs + 15000,
  });
};

exports.protectPdf = async (req, res, next) => {
  const files = requireFiles(req, 1);
  if (!req.body.password) {
    await removeFiles(inputPaths(files));
    return next(new AppError('INVALID_INPUT', 'A password is required to protect this PDF.', 400));
  }
  await execute(res, next, {
    files,
    downloadName: deriveDownloadName(originalNameOf(files), { suffix: '_protected', ext: 'pdf' }),
    task: () => secureService.protectPdf(files[0].path, req.body.password),
  });
};

exports.unlockPdf = async (req, res, next) => {
  const files = requireFiles(req, 1);
  if (!req.body.password) {
    await removeFiles(inputPaths(files));
    return next(new AppError('INVALID_INPUT', "Enter the PDF's current password to unlock it.", 400));
  }
  await execute(res, next, {
    files,
    downloadName: deriveDownloadName(originalNameOf(files), { suffix: '_unlocked', ext: 'pdf' }),
    task: () => secureService.unlockPdf(files[0].path, req.body.password),
  });
};
