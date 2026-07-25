(function () {
  let container;

  function ensureContainer() {
    if (container) return container;
    container = document.createElement('div');
    container.className = 'toast-container';
    container.setAttribute('aria-live', 'polite');
    Object.assign(container.style, {
      position: 'fixed',
      top: '96px',
      right: '20px',
      zIndex: 3000,
      display: 'flex',
      flexDirection: 'column',
      gap: '10px',
      maxWidth: 'min(360px, calc(100vw - 40px))',
    });
    document.body.appendChild(container);
    return container;
  }

  const ICONS = {
    success: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M20 6L9 17l-5-5"/></svg>',
    error: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M18 6L6 18M6 6l12 12"/></svg>',
    info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M12 16v-4M12 8h.01"/><circle cx="12" cy="12" r="10"/></svg>',
    warning: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M12 9v4M12 17h.01"/><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/></svg>',
  };

  const COLORS = {
    success: { bg: 'rgba(34,197,94,0.12)', fg: '#16A34A' },
    error: { bg: 'rgba(239,68,68,0.12)', fg: '#DC2626' },
    info: { bg: 'rgba(79,70,229,0.12)', fg: '#4F46E5' },
    warning: { bg: 'rgba(245,158,11,0.12)', fg: '#D97706' },
  };

  function show(message, type = 'info', duration = 3800) {
    const el = ensureContainer();
    const toast = document.createElement('div');
    toast.className = 'toast glass-strong toast-enter';
    toast.setAttribute('role', 'status');
    const c = COLORS[type] || COLORS.info;

    Object.assign(toast.style, {
      display: 'flex',
      alignItems: 'flex-start',
      gap: '10px',
      padding: '14px 16px',
      borderRadius: '14px',
      boxShadow: '0 12px 32px -8px rgba(15,23,42,0.25)',
    });

    toast.innerHTML = `
      <span style="flex-shrink:0;width:22px;height:22px;border-radius:50%;display:grid;place-items:center;background:${c.bg};color:${c.fg}">
        <span style="width:14px;height:14px;display:block">${ICONS[type] || ICONS.info}</span>
      </span>
      <span style="font-size:0.875rem;line-height:1.4;color:var(--text-primary);flex:1;">${message}</span>
      <button aria-label="Dismiss notification" style="flex-shrink:0;opacity:0.5;font-size:1.1rem;line-height:1;">&times;</button>
    `;

    el.appendChild(toast);

    function remove() {
      toast.classList.remove('toast-enter');
      toast.classList.add('toast-exit');
      setTimeout(() => toast.remove(), 220);
    }

    toast.querySelector('button').addEventListener('click', remove);
    const timer = setTimeout(remove, duration);
    toast.addEventListener('mouseenter', () => clearTimeout(timer));

    return toast;
  }

  window.PDFProToast = {
    show,
    success: (msg, d) => show(msg, 'success', d),
    error: (msg, d) => show(msg, 'error', d),
    info: (msg, d) => show(msg, 'info', d),
    warning: (msg, d) => show(msg, 'warning', d),
  };
})();
