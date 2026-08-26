const config = require('../config/config');
const { AppError } = require('./errorHandler');
const { removeFiles } = require('../utils/fileUtils');
const usageService = require('../services/usageService');

function guardRequestSize(req, res, next) {
  const declared = parseInt(req.headers['content-length'], 10);
  if (!Number.isNaN(declared)) {
    const hardCap = config.limits.authedMaxBytes + 2 * 1024 * 1024;
    if (declared > hardCap) {
      return next(
        new AppError(
          'FILE_TOO_LARGE',
          `This upload exceeds the ${config.limits.authedMaxMb}MB maximum.`,
          413
        )
      );
    }
  }
  next();
}

async function cleanupUploads(req) {
  const paths = (req.files || []).map((file) => file.path);
  await removeFiles(paths);
}

async function enforceUploadLimits(req, res, next) {
  const files = req.files || [];
  if (files.length === 0) {
    return next();
  }

  const totalBytes = files.reduce((sum, file) => sum + (file.size || 0), 0);
  req.uploadBytes = totalBytes;

  if (totalBytes > config.limits.authedMaxBytes) {
    await cleanupUploads(req);
    return next(
      new AppError(
        'FILE_TOO_LARGE',
        `The combined size of these files exceeds the ${config.limits.authedMaxMb}MB maximum.`,
        413
      )
    );
  }

  if (!req.user && totalBytes > config.limits.guestMaxBytes) {
    await cleanupUploads(req);
    return next(
      new AppError(
        'AUTH_REQUIRED',
        `Files larger than ${config.limits.guestMaxMb} MB require a free PDF-Pro account. Please log in or create an account to continue.`,
        401
      )
    );
  }

  try {
    const allowance = await usageService.checkAllowance(req.user, totalBytes);
    if (!allowance.allowed) {
      await cleanupUploads(req);
      return next(
        new AppError('LIMIT_REACHED', allowance.reason || 'You have reached your usage limit.', 429)
      );
    }
  } catch (err) {
    return next(err);
  }

  next();
}

module.exports = { guardRequestSize, enforceUploadLimits };
