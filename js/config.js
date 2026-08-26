(function () {
  const RENDER_BACKEND_URL = 'https://REPLACE-WITH-YOUR-RENDER-URL.onrender.com';

  const host = window.location.hostname;
  const isLocalhost = host === 'localhost' || host === '127.0.0.1' || host === '';

  window.PDF_PRO_API_BASE = isLocalhost ? '' : RENDER_BACKEND_URL;
})();
