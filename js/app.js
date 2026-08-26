(function () {
  document.addEventListener('DOMContentLoaded', () => {
    initToolFilters();
    initKeyboardShortcuts();
    const tool = document.body.dataset.tool;
    if (tool) initWorkspace(tool);
  });

  function initToolFilters() {
    const filterBar = document.querySelector('.tool-filters');
    const grid = document.querySelector('.tools-grid');
    if (!filterBar || !grid) return;

    filterBar.addEventListener('click', (e) => {
      const btn = e.target.closest('.tool-filter-btn');
      if (!btn) return;
      filterBar.querySelectorAll('.tool-filter-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');

      const category = btn.dataset.filter;
      grid.querySelectorAll('.tool-card').forEach((card) => {
        const match = category === 'all' || card.dataset.category === category;
        card.style.display = match ? '' : 'none';
      });
    });
  }

  function initKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        const target = document.querySelector('#tools, .tools-grid');
        if (target) {
          e.preventDefault();
          target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }
      if (e.key === 'Escape') {
        document.querySelectorAll('.modal-backdrop.open').forEach((m) => m.classList.remove('open'));
      }
    });
  }

  const TOOL_CONFIG = {
    'pdf-to-word': { kind: 'pdf', multiple: false },
    'word-to-pdf': { kind: 'word', multiple: false },
    'pdf-to-jpg': { kind: 'pdf', multiple: false },
    'jpg-to-pdf': { kind: 'jpg', multiple: true },
    'png-to-pdf': { kind: 'png', multiple: true },
    'merge': { kind: 'pdf', multiple: true },
    'split': { kind: 'pdf', multiple: false },
    'compress': { kind: 'pdf', multiple: false },
    'rotate': { kind: 'pdf', multiple: false },
    'delete-pages': { kind: 'pdf', multiple: false },
    'rearrange': { kind: 'pdf', multiple: false },
    'extract-images': { kind: 'pdf', multiple: false },
    'watermark': { kind: 'pdf', multiple: false },
    'page-numbers': { kind: 'pdf', multiple: false },
    'protect': { kind: 'pdf', multiple: false },
    'unlock': { kind: 'pdf', multiple: false },
  };

  const STATE_LABELS = {
    uploading: 'Uploading…',
    uploaded: 'Uploaded',
    processing: 'Processing…',
    waking: 'Waking up the server — this can take up to a minute on the first request.',
    almost: 'Almost done…',
    completed: 'Completed',
    failed: 'Something went wrong',
  };

  function createStatusUI(anchor) {
    const el = document.createElement('div');
    el.className = 'process-status';
    el.hidden = true;
    el.innerHTML = `
      <div class="process-status-row">
        <span class="process-status-spinner spinner" hidden></span>
        <span class="process-status-icon" hidden></span>
        <span class="process-status-label"></span>
      </div>
      <div class="process-status-track"><div class="process-status-bar"></div></div>
      <button type="button" class="btn btn-secondary btn-sm process-retry" hidden>Try again</button>
    `;
    anchor.insertAdjacentElement('afterend', el);

    const spinner = el.querySelector('.process-status-spinner');
    const icon = el.querySelector('.process-status-icon');
    const label = el.querySelector('.process-status-label');
    const track = el.querySelector('.process-status-track');
    const bar = el.querySelector('.process-status-bar');
    const retry = el.querySelector('.process-retry');

    let almostTimer = null;

    function clearAlmostTimer() {
      if (almostTimer) {
        clearTimeout(almostTimer);
        almostTimer = null;
      }
    }

    function set(state, detail) {
      el.hidden = false;
      el.dataset.state = state;
      retry.hidden = true;
      icon.hidden = true;
      spinner.hidden = false;
      track.hidden = false;

      if (state === 'failed') {
        clearAlmostTimer();
        spinner.hidden = true;
        icon.hidden = false;
        icon.innerHTML =
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M18 6L6 18M6 6l12 12"/></svg>';
        label.textContent = detail || STATE_LABELS.failed;
        track.hidden = true;
        retry.hidden = false;
        return;
      }

      if (state === 'completed') {
        clearAlmostTimer();
        spinner.hidden = true;
        icon.hidden = false;
        icon.innerHTML =
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M20 6L9 17l-5-5"/></svg>';
        label.textContent = STATE_LABELS.completed;
        bar.style.width = '100%';
        setTimeout(() => {
          bar.style.width = '0%';
        }, 400);
        return;
      }

      label.textContent = STATE_LABELS[state] || '';

      if (state === 'processing') {
        clearAlmostTimer();
        almostTimer = setTimeout(() => set('almost'), 9000);
      }
    }

    function setProgress(percent) {
      bar.style.width = `${percent}%`;
    }

    function hide() {
      clearAlmostTimer();
      el.hidden = true;
    }

    return { set, setProgress, hide, onRetry: (cb) => retry.addEventListener('click', cb) };
  }

  function initWorkspace(tool) {
    const config = TOOL_CONFIG[tool];
    if (!config) return;

    const dropzone = window.PDFProUtils.qs('.dropzone');
    const listEl = window.PDFProUtils.qs('.file-list');
    const cta = window.PDFProUtils.qs('[data-action="convert"]');
    const resultPanel = window.PDFProUtils.qs('.result-panel');
    if (!dropzone || !listEl || !cta) return;

    const manager = new window.UploadManager({
      dropzone,
      listEl,
      kind: config.kind,
      multiple: config.multiple,
    });

    if (tool === 'rearrange') {
      window.initReorderList(listEl);
    }

    const status = createStatusUI(cta);

    dropzone.addEventListener('list-changed', (e) => {
      cta.disabled = e.detail.count === 0;
      if (e.detail.count === 0) status.hide();
    });
    cta.disabled = true;

    async function runConversion() {
      const files = manager.getFiles();
      if (!files.length) {
        window.PDFProToast.warning('Add at least one file to continue.');
        return;
      }

      const options = collectOptions(tool);
      if (options === null) return;

      const gate = window.PDFProValidation.evaluateGate(files);
      if (gate.exceedsAuthMax) {
        window.PDFProToast.error(
          `The combined size exceeds the ${window.PDFProValidation.AUTH_MAX_MB}MB maximum. Please use smaller files.`
        );
        return;
      }

      if (gate.requiresLogin) {
        if (window.PDFProAuth && window.PDFProAuth.isConfigured()) {
          const ok = await window.PDFProAuthUI.requireLogin(
            `Files larger than ${window.PDFProValidation.GUEST_MAX_MB} MB require a free PDF-Pro account. Log in or create one to continue — your file stays ready.`
          );
          if (!ok) {
            window.PDFProToast.info(
              `No problem — files under ${window.PDFProValidation.GUEST_MAX_MB} MB work without an account.`
            );
            return;
          }
        } else {
          window.PDFProToast.error(
            `Files larger than ${window.PDFProValidation.GUEST_MAX_MB} MB require an account, which is not enabled on this deployment yet.`
          );
          return;
        }
      }

      const ids = manager.getOrderedIds ? manager.getOrderedIds() : [];
      if (tool === 'merge' || tool === 'rearrange') options.order = ids;

      setLoading(cta, true);
      if (resultPanel) resultPanel.hidden = true;
      status.set('uploading');

      try {
        const { blob, filename } = await window.PDFProConverter.convert(tool, files, options, {
          onProgress: (percent) => {
            status.setProgress(percent);
            ids.forEach((id) => manager.setProgress(id, percent));
          },
          onStatus: (state) => status.set(state),
        });

        ids.forEach((id) => manager.setStatus(id, 'success'));
        status.set('completed');
        window.PDFProToast.success('Done! Your file is ready.');
        showResult(resultPanel, blob, filename);
      } catch (err) {
        ids.forEach((id) => manager.setStatus(id, 'error'));
        const message = err && err.message ? err.message : 'Something went wrong. Please try again.';
        status.set('failed', message);
        window.PDFProToast.error(message);
      } finally {
        setLoading(cta, false);
      }
    }

    cta.addEventListener('click', runConversion);
    status.onRetry(runConversion);
  }

  function setLoading(btn, isLoading) {
    btn.disabled = isLoading;
    if (isLoading) {
      if (!btn.dataset.label) btn.dataset.label = btn.innerHTML;
      btn.innerHTML = '<span class="spinner"></span> Working…';
    } else if (btn.dataset.label) {
      btn.innerHTML = btn.dataset.label;
    }
  }

  function showResult(panel, blob, filename) {
    if (!panel) {
      window.PDFProUtils.downloadBlob(blob, filename);
      return;
    }
    panel.hidden = false;
    panel.scrollIntoView({ behavior: 'smooth', block: 'center' });

    const nameEl = panel.querySelector('[data-result-filename]');
    if (nameEl) {
      nameEl.textContent = filename;
      const fileWrap = nameEl.closest('.result-file');
      if (fileWrap) fileWrap.hidden = false;
    }

    const downloadBtn = panel.querySelector('[data-action="download"]');
    if (downloadBtn) {
      downloadBtn.onclick = () => window.PDFProUtils.downloadBlob(blob, filename);
    } else {
      window.PDFProUtils.downloadBlob(blob, filename);
    }
  }

  function collectOptions(tool) {
    const panel = window.PDFProUtils.qs('.options-panel');
    const options = {};
    if (!panel) return options;

    panel.querySelectorAll('[data-option]').forEach((field) => {
      const key = field.dataset.option;
      if (field.type === 'checkbox') options[key] = field.checked;
      else options[key] = field.value;
    });

    if (tool === 'protect' && !options.password) {
      window.PDFProToast.error('Enter a password to protect the PDF.');
      return null;
    }
    if (tool === 'unlock' && !options.password) {
      window.PDFProToast.error('Enter the current PDF password to unlock it.');
      return null;
    }

    return options;
  }
})();
