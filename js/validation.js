const PDFProValidation = (function () {
  const GUEST_MAX_MB = window.PDF_PRO_GUEST_MAX_MB || 10;
  const AUTH_MAX_MB = window.PDF_PRO_AUTH_MAX_MB || 100;
  const GUEST_MAX_BYTES = GUEST_MAX_MB * 1024 * 1024;
  const AUTH_MAX_BYTES = AUTH_MAX_MB * 1024 * 1024;
  const MAX_FILES = 20;

  const MIME_MAP = {
    pdf: ['application/pdf'],
    word: [
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ],
    jpg: ['image/jpeg'],
    png: ['image/png'],
    image: ['image/jpeg', 'image/png', 'image/webp'],
  };

  const EXT_MAP = {
    pdf: ['pdf'],
    word: ['doc', 'docx'],
    jpg: ['jpg', 'jpeg'],
    png: ['png'],
    image: ['jpg', 'jpeg', 'png', 'webp'],
  };

  function isLoggedIn() {
    return Boolean(window.PDFProAuth && window.PDFProAuth.isLoggedIn && window.PDFProAuth.isLoggedIn());
  }

  function validateFile(file, kind = 'pdf') {
    if (!file) return { valid: false, error: 'No file provided.' };

    if (file.size === 0) {
      return { valid: false, error: `${file.name} is empty.` };
    }

    if (file.size > AUTH_MAX_BYTES) {
      return {
        valid: false,
        error: `${file.name} exceeds the ${AUTH_MAX_MB}MB maximum (${window.PDFProUtils.formatBytes(file.size)}).`,
      };
    }

    const ext = window.PDFProUtils.getExt(file.name);
    const allowedExts = EXT_MAP[kind] || EXT_MAP.pdf;
    const allowedMimes = MIME_MAP[kind] || MIME_MAP.pdf;

    const extOk = allowedExts.includes(ext);
    const mimeOk = !file.type || allowedMimes.includes(file.type);

    if (!extOk && !mimeOk) {
      return {
        valid: false,
        error: `${file.name} is not a supported file type (expected .${allowedExts.join(', .')}).`,
      };
    }

    return { valid: true };
  }

  function validateFileList(files, kind = 'pdf', existingCount = 0) {
    const list = Array.from(files);
    const errors = [];
    const validFiles = [];

    if (list.length + existingCount > MAX_FILES) {
      errors.push(`You can upload up to ${MAX_FILES} files at once.`);
    }

    list.forEach((file) => {
      const result = validateFile(file, kind);
      if (result.valid) validFiles.push(file);
      else errors.push(result.error);
    });

    return { validFiles, errors };
  }

  function evaluateGate(files) {
    const totalBytes = Array.from(files).reduce((sum, file) => sum + (file.size || 0), 0);
    const loggedIn = isLoggedIn();

    return {
      totalBytes,
      loggedIn,
      exceedsAuthMax: totalBytes > AUTH_MAX_BYTES,
      requiresLogin: !loggedIn && totalBytes > GUEST_MAX_BYTES,
    };
  }

  return {
    validateFile,
    validateFileList,
    evaluateGate,
    GUEST_MAX_MB,
    AUTH_MAX_MB,
    GUEST_MAX_BYTES,
    AUTH_MAX_BYTES,
    MAX_FILES,
  };
})();

window.PDFProValidation = PDFProValidation;
