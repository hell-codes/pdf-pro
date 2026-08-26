const { verifyIdToken, isConfigured } = require('../utils/firebaseAdmin');
const { AppError } = require('./errorHandler');

function extractToken(req) {
  const header = req.headers.authorization || '';
  if (header.startsWith('Bearer ')) {
    return header.slice(7).trim();
  }
  return null;
}

async function attachUser(req, res, next) {
  req.user = null;
  const token = extractToken(req);

  if (!token) {
    return next();
  }

  if (!isConfigured()) {
    return next();
  }

  try {
    const decoded = await verifyIdToken(token);
    req.user = {
      uid: decoded.uid,
      email: decoded.email || null,
      emailVerified: Boolean(decoded.email_verified),
    };
    return next();
  } catch (err) {
    return next(new AppError('INVALID_TOKEN', 'Your session has expired. Please sign in again.', 401));
  }
}

function requireAuth(req, res, next) {
  if (!req.user) {
    return next(new AppError('AUTH_REQUIRED', 'Please sign in to continue.', 401));
  }
  next();
}

module.exports = { attachUser, requireAuth, extractToken };
