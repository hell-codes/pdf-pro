const PDFProConverter = (function () {
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

  const REQUEST_TIMEOUT_MS = 240000;

  function buildError(message, code, status) {
    const error = new Error(message);
    error.code = code || 'ERROR';
    if (status) error.status = status;
    return error;
  }

  function getApiBase() {
    let base = (window.PDF_PRO_API_BASE || '').trim();
    while (base.endsWith('/')) {
      base = base.slice(0, -1);
    }
    if (base.endsWith('/api/pdf')) {
      base = base.slice(0, -8);
    } else if (base.endsWith('/api')) {
      base = base.slice(0, -4);
    }
    if (base.startsWith('http://') && (base.includes('.onrender.com') || base.includes('.render.com'))) {
      base = 'https://' + base.slice(7);
    }
    return (base || '') + '/api/pdf';
  }

  function resolveUrl(toolOrEndpoint) {
    const endpoint = ENDPOINTS[toolOrEndpoint] || (toolOrEndpoint.startsWith('/') ? toolOrEndpoint : '/' + toolOrEndpoint);
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint : '/' + endpoint;
    return getApiBase() + cleanEndpoint;
  }

  function parseFilename(xhr) {
    const disposition = xhr.getResponseHeader('Content-Disposition') || '';

    const encoded = /filename\*=UTF-8''([^;]+)/i.exec(disposition);
    if (encoded && encoded[1]) {
      try {
        return decodeURIComponent(encoded[1]);
      } catch (_) {}
    }

    const quoted = /filename="?([^";]+)"?/i.exec(disposition);
    if (quoted && quoted[1]) {
      return quoted[1];
    }

    const headerName = xhr.getResponseHeader('X-Result-Filename');
    if (headerName) {
      try {
        return decodeURIComponent(headerName);
      } catch (_) {
        return headerName;
      }
    }

    return `download-${Date.now()}`;
  }

  function readErrorFromBlob(blob, status) {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const parsed = JSON.parse(reader.result);
          const code = parsed.error && parsed.error.code ? parsed.error.code : 'ERROR';
          const message =
            (parsed.error && parsed.error.message) || parsed.message || `Request failed (status ${status}).`;
          resolve(buildError(message, code, status));
        } catch (_) {
          resolve(buildError(`Request failed (status ${status}).`, 'ERROR', status));
        }
      };
      reader.onerror = () => resolve(buildError(`Request failed (status ${status}).`, 'ERROR', status));
      if (blob instanceof Blob) reader.readAsText(blob);
      else resolve(buildError(`Request failed (status ${status}).`, 'ERROR', status));
    });
  }

  async function sendOnce(endpoint, files, options, token, handlers) {
    const { onProgress = () => {}, onStatus = () => {} } = handlers;

    return new Promise((resolve, reject) => {
      const formData = new FormData();
      files.forEach((file) => formData.append('files', file));
      Object.entries(options).forEach(([key, value]) => {
        if (value === undefined || value === null) return;
        formData.append(key, typeof value === 'object' ? JSON.stringify(value) : value);
      });

      const url = resolveUrl(endpoint);
      const xhr = new XMLHttpRequest();
      xhr.open('POST', url);
      xhr.responseType = 'blob';
      xhr.timeout = REQUEST_TIMEOUT_MS;

      if (token) {
        xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      }

      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const percent = Math.round((e.loaded / e.total) * 100);
          onProgress(percent);
          if (percent >= 100) onStatus('processing');
        }
      });

      xhr.addEventListener('load', async () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve({ blob: xhr.response, filename: parseFilename(xhr) });
        } else {
          const error = await readErrorFromBlob(xhr.response, xhr.status);
          reject(error);
        }
      });

      xhr.addEventListener('error', () => reject(buildError('NETWORK', 'NETWORK', 0)));
      xhr.addEventListener('timeout', () =>
        reject(buildError('The request timed out. Please try again with a smaller file.', 'TIMEOUT', 0))
      );
      xhr.addEventListener('abort', () => reject(buildError('Upload cancelled.', 'ABORTED', 0)));

      xhr.send(formData);
      convert.lastXhr = xhr;
    });
  }

  function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function isColdStart(error) {
    return error.code === 'NETWORK' || error.status === 502 || error.status === 503 || error.status === 504;
  }

  async function convert(tool, files, options = {}, handlers = {}) {
    const endpoint = ENDPOINTS[tool];
    if (!endpoint) throw buildError(`Unknown tool: ${tool}`, 'UNKNOWN_TOOL');

    const { onStatus = () => {} } = handlers;
    let token = null;
    if (window.PDFProAuth && window.PDFProAuth.getIdToken) {
      token = await window.PDFProAuth.getIdToken();
    }

    onStatus('uploading');

    const maxAttempts = 3;
    let lastError = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await sendOnce(endpoint, files, options, token, handlers);
      } catch (error) {
        lastError = error;
        if (isColdStart(error) && attempt < maxAttempts) {
          onStatus('waking');
          await delay(attempt * 3000);
          continue;
        }
        break;
      }
    }

    if (lastError && lastError.code === 'NETWORK') {
      throw buildError(
        'Could not reach the server. It may be starting up — please try again in a moment.',
        'NETWORK'
      );
    }
    throw lastError;
  }

  function cancel() {
    if (convert.lastXhr) convert.lastXhr.abort();
  }

  return { convert, cancel, ENDPOINTS, getApiBase, resolveUrl };
})();

window.PDFProConverter = PDFProConverter;
