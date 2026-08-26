const multer = require('multer');
const path = require('path');
const config = require('../config/config');
const { sanitizeFilename } = require('../utils/fileUtils');
const { AppError } = require('./errorHandler');

const ALLOWED_MIME = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/jpeg',
  'image/png',
  'image/webp',
]);

const ALLOWED_EXT = new Set(['pdf', 'doc', 'docx', 'jpg', 'jpeg', 'png', 'webp']);

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, config.paths.uploads),
  filename: (req, file, cb) => {
    const safe = sanitizeFilename(file.originalname);
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}-${safe}`;
    cb(null, unique);
  },
});

function fileFilter(req, file, cb) {
  const ext = path.extname(file.originalname).slice(1).toLowerCase();
  const mimeOk = ALLOWED_MIME.has(file.mimetype);
  const extOk = ALLOWED_EXT.has(ext);

  if (!mimeOk && !extOk) {
    return cb(new AppError('UNSUPPORTED_TYPE', `Unsupported file type: ${file.originalname}`, 415));
  }
  cb(null, true);
}

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: config.upload.maxFileSizeBytes,
    files: config.upload.maxFiles,
  },
});

module.exports = upload;
