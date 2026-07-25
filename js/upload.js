
class UploadManager {
  constructor(opts) {
    this.dropzone = opts.dropzone;
    this.listEl = opts.listEl;
    this.kind = opts.kind || 'pdf';
    this.multiple = opts.multiple !== false;
    this.files = new Map(); // id -> { file, id, progress, status }

    initDragDrop(this.dropzone);
    this.dropzone.addEventListener('files-selected', (e) => this.addFiles(e.detail.files));
  }

  async addFiles(fileList) {
    const { validFiles, errors } = window.PDFProValidation.validateFileList(
      fileList,
      this.kind,
      this.files.size
    );

    errors.forEach((err) => window.PDFProToast.error(err));

    if (!this.multiple && validFiles.length > 0) {
      this.files.clear();
      this.listEl.innerHTML = '';
    }

    for (const file of validFiles) {
      const id = window.PDFProUtils.uid('file');
      const entry = { file, id, progress: 0, status: 'idle' };
      this.files.set(id, entry);
      await this.renderFileItem(entry);
    }

    if (validFiles.length) {
      window.PDFProToast.success(
        validFiles.length === 1 ? `${validFiles[0].name} added.` : `${validFiles.length} files added.`
      );
      this.dropzone.dispatchEvent(new CustomEvent('list-changed', { detail: { count: this.files.size } }));
    }
  }

  async renderFileItem(entry) {
    const { file, id } = entry;
    const row = document.createElement('div');
    row.className = 'file-item';
    row.dataset.fileId = id;
    row.setAttribute('draggable', 'true');

    const isImage = file.type.startsWith('image/');
    let thumbContent = this.iconForFile(file);

    row.innerHTML = `
      <span class="drag-handle" title="Drag to reorder">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 6h.01M8 12h.01M8 18h.01M16 6h.01M16 12h.01M16 18h.01"/></svg>
      </span>
      <div class="file-thumb">${thumbContent}</div>
      <div class="file-meta">
        <div class="file-name">${this.escape(file.name)}</div>
        <div class="file-size">${window.PDFProUtils.formatBytes(file.size)}</div>
        <div class="file-progress-track" hidden>
          <div class="file-progress-bar"></div>
        </div>
      </div>
      <div class="file-actions">
        <span class="file-status-icon" hidden></span>
        <button type="button" class="file-action-btn danger" title="Remove file" aria-label="Remove file">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
        </button>
      </div>
    `;

    row.querySelector('.file-action-btn.danger').addEventListener('click', () => this.removeFile(id));

    this.listEl.appendChild(row);

    if (isImage) {
      try {
        const dataUrl = await window.PDFProUtils.readAsDataURL(file);
        const thumb = row.querySelector('.file-thumb');
        thumb.innerHTML = `<img src="${dataUrl}" alt="${this.escape(file.name)} preview">`;
      } catch (_) {
      }
    }
  }

  iconForFile(file) {
    const ext = window.PDFProUtils.getExt(file.name);
    const icons = {
      pdf: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6"/></svg>',
      doc: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6"/></svg>',
      docx: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6"/></svg>',
    };
    return icons[ext] || icons.pdf;
  }

  removeFile(id) {
    this.files.delete(id);
    const row = this.listEl.querySelector(`[data-file-id="${id}"]`);
    if (row) {
      row.style.transition = 'opacity 200ms ease, transform 200ms ease';
      row.style.opacity = '0';
      row.style.transform = 'translateX(12px)';
      setTimeout(() => row.remove(), 200);
    }
    this.dropzone.dispatchEvent(new CustomEvent('list-changed', { detail: { count: this.files.size } }));
  }

  setProgress(id, percent) {
    const row = this.listEl.querySelector(`[data-file-id="${id}"]`);
    if (!row) return;
    const track = row.querySelector('.file-progress-track');
    const bar = row.querySelector('.file-progress-bar');
    track.hidden = false;
    bar.style.width = `${percent}%`;
  }

  setStatus(id, status) {
    const row = this.listEl.querySelector(`[data-file-id="${id}"]`);
    if (!row) return;
    const icon = row.querySelector('.file-status-icon');
    icon.hidden = false;
    icon.classList.remove('success', 'error');
    if (status === 'success') {
      icon.classList.add('success');
      icon.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M20 6L9 17l-5-5"/></svg>';
    } else if (status === 'error') {
      icon.classList.add('error');
      icon.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M18 6L6 18M6 6l12 12"/></svg>';
    }
  }

  getFiles() {
    return Array.from(this.files.values()).map((e) => e.file);
  }

  getOrderedIds() {
    return Array.from(this.listEl.children).map((el) => el.dataset.fileId);
  }

  clear() {
    this.files.clear();
    this.listEl.innerHTML = '';
  }

  escape(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
}

window.UploadManager = UploadManager;
