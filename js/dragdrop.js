
function initDragDrop(dropzoneEl) {
  if (!dropzoneEl) return;

  const input = dropzoneEl.querySelector('input[type="file"]');
  let dragCounter = 0;

  function emitFiles(fileList) {
    if (!fileList || fileList.length === 0) return;
    dropzoneEl.dispatchEvent(new CustomEvent('files-selected', { detail: { files: fileList } }));
  }

  dropzoneEl.addEventListener('click', (e) => {
    if (e.target !== input) input?.click();
  });

  dropzoneEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      input?.click();
    }
  });

  input?.addEventListener('change', (e) => {
    emitFiles(e.target.files);
    e.target.value = '';
  });

  ['dragenter', 'dragover', 'dragleave', 'drop'].forEach((evt) => {
    dropzoneEl.addEventListener(evt, (e) => {
      e.preventDefault();
      e.stopPropagation();
    });
  });

  dropzoneEl.addEventListener('dragenter', () => {
    dragCounter++;
    dropzoneEl.classList.add('drag-active');
  });

  dropzoneEl.addEventListener('dragleave', () => {
    dragCounter--;
    if (dragCounter <= 0) {
      dragCounter = 0;
      dropzoneEl.classList.remove('drag-active');
    }
  });

  dropzoneEl.addEventListener('drop', (e) => {
    dragCounter = 0;
    dropzoneEl.classList.remove('drag-active');
    const files = e.dataTransfer?.files;
    emitFiles(files);
  });

  ['dragover', 'drop'].forEach((evt) => {
    window.addEventListener(evt, (e) => {
      if (!dropzoneEl.contains(e.target)) e.preventDefault();
    });
  });
}

function initReorderList(listEl, onReorder) {
  if (!listEl) return;
  let draggedEl = null;

  listEl.addEventListener('dragstart', (e) => {
    const item = e.target.closest('.file-item');
    if (!item) return;
    draggedEl = item;
    item.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
  });

  listEl.addEventListener('dragend', () => {
    draggedEl?.classList.remove('dragging');
    draggedEl = null;
    if (typeof onReorder === 'function') {
      const order = Array.from(listEl.children).map((el) => el.dataset.fileId);
      onReorder(order);
    }
  });

  listEl.addEventListener('dragover', (e) => {
    e.preventDefault();
    const afterEl = getDragAfterElement(listEl, e.clientY);
    if (!draggedEl) return;
    if (afterEl == null) listEl.appendChild(draggedEl);
    else listEl.insertBefore(draggedEl, afterEl);
  });

  function getDragAfterElement(container, y) {
    const items = Array.from(container.querySelectorAll('.file-item:not(.dragging)'));
    return items.reduce(
      (closest, child) => {
        const box = child.getBoundingClientRect();
        const offset = y - box.top - box.height / 2;
        if (offset < 0 && offset > closest.offset) {
          return { offset, element: child };
        }
        return closest;
      },
      { offset: Number.NEGATIVE_INFINITY, element: null }
    ).element;
  }
}

window.initDragDrop = initDragDrop;
window.initReorderList = initReorderList;
