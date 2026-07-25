
const PDFProConverter = (function () {
  const API_BASE = (window.PDF_PRO_API_BASE || '') + '/api/pdf';

  const ENDPOINTS = {
    'pdf-to-word': '/pdf-to-word',
    'word-to-pdf': '/word-to-pdf',
    'pdf-to-jpg': '/pdf-to-jpg',
    'jpg-to-pdf': '/images-to-pdf',
    'png-to-pdf': '/images-to-pdf',
    'merge': '/merge',
    'split': '/split',
    'compress': '/compress',
    'rotate': '/rotate',
    'delete-pages': '/delete-pages',
    'rearrange': '/rearrange',
    'extract-images': '/extract-images',
    'watermark': '/watermark',
    'page-numbers': '/page-numbers',
    'protect': '/protect',
    'unlock': '/unlock',
  };

  function convert(tool, files, options = {}, onProgress = () => {}) {
    return new Promise((resolve, reject) => {
      const endpoint = ENDPOINTS[tool];
      if (!endpoint) return reject(new Error(`Unknown tool: ${tool}`));

      const formData = new FormData();
      files.forEach((file) => formData.append('files', file));
      Object.entries(options).forEach(([key, value]) => {
        formData.append(key, typeof value === 'object' ? JSON.stringify(value) : value);
      });

      const xhr = new XMLHttpRequest();
      xhr.open('POST', API_BASE + endpoint);
      xhr.responseType = 'blob';

      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const percent = Math.round((e.loaded / e.total) * 100);
          onProgress(percent);
        }
      });

      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          const disposition = xhr.getResponseHeader('Content-Disposition') || '';
          const match = /filename="?([^"]+)"?/.exec(disposition);
          const filename = match ? match[1] : `converted-${Date.now()}`;
          resolve({ blob: xhr.response, filename });
        } else {
          // Try to parse an error message out of the blob
          const reader = new FileReader();
          reader.onload = () => {
            try {
              const parsed = JSON.parse(reader.result);
              reject(new Error(parsed.message || 'Conversion failed.'));
            } catch (_) {
              reject(new Error(`Conversion failed (status ${xhr.status}).`));
            }
          };
          reader.onerror = () => reject(new Error(`Conversion failed (status ${xhr.status}).`));
          if (xhr.response instanceof Blob) reader.readAsText(xhr.response);
          else reject(new Error(`Conversion failed (status ${xhr.status}).`));
        }
      });

      xhr.addEventListener('error', () => reject(new Error('Network error. Please check your connection.')));
      xhr.addEventListener('abort', () => reject(new Error('Upload cancelled.')));

      xhr.send(formData);
      convert.lastXhr = xhr;
    });
  }

  function cancel() {
    if (convert.lastXhr) convert.lastXhr.abort();
  }

  return { convert, cancel, ENDPOINTS };
})();

window.PDFProConverter = PDFProConverter;
