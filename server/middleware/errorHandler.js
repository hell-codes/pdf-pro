const multer = require('multer');

class AppError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
  }
}

function notFoundHandler(req, res, next) {
  next(new AppError(`Route not found: ${req.method} ${req.originalUrl}`, 404));
}

function errorHandler(err, req, res, next) {
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal server error.';

  if (err instanceof multer.MulterError) {
    statusCode = 400;
    if (err.code === 'LIMIT_FILE_SIZE') message = 'File exceeds the maximum allowed size (50MB).';
    else if (err.code === 'LIMIT_FILE_COUNT') message = 'Too many files uploaded at once.';
    else message = `Upload error: ${err.message}`;
  }

  if (process.env.NODE_ENV !== 'production' && !err.isOperational) {
    console.error(err);
  }

  res.status(statusCode).json({
    success: false,
    message,
  });
}

module.exports = { AppError, notFoundHandler, errorHandler };
