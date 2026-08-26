const multer = require('multer');
const config = require('../config/config');

class AppError extends Error {
  constructor(code, message, statusCode = 400) {
    super(message);
    this.code = code;
    this.statusCode = statusCode;
    this.isOperational = true;
  }
}

function notFoundHandler(req, res, next) {
  next(new AppError('NOT_FOUND', `Route not found: ${req.method} ${req.originalUrl}`, 404));
}

function mapMulterError(err) {
  if (err.code === 'LIMIT_FILE_SIZE') {
    return new AppError(
      'FILE_TOO_LARGE',
      `This file is larger than the ${config.limits.authedMaxMb}MB maximum for a single upload.`,
      413
    );
  }
  if (err.code === 'LIMIT_FILE_COUNT' || err.code === 'LIMIT_UNEXPECTED_FILE') {
    return new AppError('TOO_MANY_FILES', `You can upload up to ${config.limits.maxFiles} files at once.`, 400);
  }
  return new AppError('UPLOAD_FAILED', 'The upload could not be processed. Please try again.', 400);
}

function errorHandler(err, req, res, next) {
  let normalized = err;

  if (err instanceof multer.MulterError) {
    normalized = mapMulterError(err);
  } else if (err && err.code === 'PROCESSING_TIMEOUT') {
    normalized = new AppError(
      'PROCESSING_TIMEOUT',
      'The operation took too long. Please try again, ideally with a smaller file.',
      504
    );
  } else if (!(err instanceof AppError)) {
    normalized = new AppError('INTERNAL', 'Something went wrong on our end. Please try again.', 500);
  }

  if (!normalized.isOperational || normalized.statusCode >= 500) {
    console.error('[error]', req.method, req.originalUrl, '-', err && err.stack ? err.stack : err);
  }

  res.status(normalized.statusCode || 500).json({
    success: false,
    message: normalized.message,
    error: {
      code: normalized.code || 'INTERNAL',
      message: normalized.message,
    },
  });
}

module.exports = { AppError, notFoundHandler, errorHandler };
