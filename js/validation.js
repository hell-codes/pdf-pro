
const PDFProValidation = (function () {
  const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB per file
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

  function validateFile(file, kind = 'pdf') {
    if (!file) return { valid: false, error: 'No file provided.' };

    if (file.size === 0) {
      return { valid: false, error: `${file.name} is empty.` };
    }

    if (file.size > MAX_FILE_SIZE) {
      return {
        valid: false,
        error: `${file.name} exceeds the 50MB limit (${window.PDFProUtils.formatBytes(file.size)}).`,
      };
    }

    const ext = window.PDFProUtils.getExt(file.name);
    const allowedExts = EXT_MAP[kind] || EXT_MAP.pdf;
    const allowedMimes = MIME_MAP[kind] || MIME_MAP.pdf;

    const extOk = allowedExts.includes(ext);
    const mimeOk = !file.type || allowedMimes.includes(file.type); // some OSes omit mime for certain types

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

  return { validateFile, validateFileList, MAX_FILE_SIZE, MAX_FILES };
})();

window.PDFProValidation = PDFProValidation;
