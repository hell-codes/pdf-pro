
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

    dropzone.addEventListener('list-changed', (e) => {
      cta.disabled = e.detail.count === 0;
    });
    cta.disabled = true;

    cta.addEventListener('click', async () => {
      const files = manager.getFiles();
      if (!files.length) {
        window.PDFProToast.warning('Add at least one file to continue.');
        return;
      }

      const options = collectOptions(tool);
      if (options === null) return; // validation failed inside collectOptions

      setLoading(cta, true);

      try {
        const ids = manager.getOrderedIds ? manager.getOrderedIds() : [];
        if (tool === 'merge' || tool === 'rearrange') options.order = ids;

        const { blob, filename } = await window.PDFProConverter.convert(
          tool,
          files,
          options,
          (percent) => {
            ids.forEach((id) => manager.setProgress(id, percent));
          }
        );

        ids.forEach((id) => manager.setStatus(id, 'success'));
        window.PDFProToast.success('Conversion complete!');
        showResult(resultPanel, blob, filename);
      } catch (err) {
        window.PDFProToast.error(err.message || 'Something went wrong. Please try again.');
      } finally {
        setLoading(cta, false);
      }
    });
  }

  function setLoading(btn, isLoading) {
    btn.disabled = isLoading;
    if (isLoading) {
      btn.dataset.label = btn.innerHTML;
      btn.innerHTML = '<span class="spinner"></span> Converting…';
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
    const downloadBtn = panel.querySelector('[data-action="download"]');
    if (downloadBtn) {
      downloadBtn.onclick = () => window.PDFProUtils.downloadBlob(blob, filename);
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

    if (tool === 'protect') {
      if (!options.password) {
        window.PDFProToast.error('Enter a password to protect the PDF.');
        return null;
      }
    }
    if (tool === 'unlock') {
      if (!options.password) {
        window.PDFProToast.error('Enter the current PDF password to unlock it.');
        return null;
      }
    }

    return options;
  }
})();
