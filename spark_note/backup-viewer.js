(() => {
  'use strict';

  const fileInput = document.querySelector('#backup-file');
  const fileStatus = document.querySelector('#file-status');
  const content = document.querySelector('#viewer-content');
  const backupName = document.querySelector('#backup-name');
  const backupMeta = document.querySelector('#backup-meta');
  const backupCount = document.querySelector('#backup-count');
  const exportPdf = document.querySelector('#export-pdf');
  const quickExportPdf = document.querySelector('#export-pdf-quick');
  const printNoteTimes = document.querySelector('#print-note-times');
  const printSelection = document.querySelector('#print-selection');
  const boxFilter = document.querySelector('#box-filter');
  const searchInput = document.querySelector('#note-search');
  const resultCount = document.querySelector('#result-count');
  const noteList = document.querySelector('#note-list');
  const emptyResults = document.querySelector('#empty-results');
  const dateFormatter = new Intl.DateTimeFormat('zh-TW', { dateStyle: 'medium', timeStyle: 'short' });
  let backup = null;
  let overflowEntries = [];

  function formatDate(value) {
    const date = new Date(value);
    return Number.isFinite(value) && Number.isFinite(date.getTime())
      ? dateFormatter.format(date)
      : '時間不詳';
  }

  function parseBackup(raw) {
    const data = JSON.parse(raw);
    if (!data || data.kind !== 'spark-note-backup' || data.version !== 1 ||
        !Array.isArray(data.notes) || !Array.isArray(data.boxes) ||
        !data.notes.every((note) => note && typeof note === 'object' && typeof note.text === 'string') ||
        !data.boxes.every((box) => box && typeof box === 'object' && typeof box.id === 'string' && typeof box.name === 'string')) {
      throw new Error('這不是有效的 Spark Note 第 1 版備份檔。');
    }
    return data;
  }

  function makeMeta(text, className) {
    const span = document.createElement('span');
    span.textContent = text;
    if (className) span.className = className;
    return span;
  }

  function updateOverflowButtons() {
    for (const entry of overflowEntries) {
      entry.text.classList.add('is-collapsed');
      const overflows = entry.text.scrollHeight > entry.text.clientHeight + 1;
      if (!overflows) entry.expanded = false;
      entry.text.classList.toggle('is-collapsed', overflows && !entry.expanded);
      entry.button.hidden = !overflows;
      entry.button.textContent = entry.expanded ? '收起' : '展開全文';
      entry.button.setAttribute('aria-expanded', String(entry.expanded));
    }
  }

  function renderNotes() {
    if (!backup) return;
    const status = document.querySelector('input[name="note-status"]:checked').value;
    const boxId = boxFilter.value;
    const query = searchInput.value.trim().toLocaleLowerCase();
    const boxNames = new Map(backup.boxes.map((box) => [box.id, box.name]));
    const filtered = backup.notes.filter((note) => {
      const isTrashed = Boolean(note.deletedAt);
      if (status === 'trash' ? !isTrashed : isTrashed) return false;
      if (status === 'favorite' && note.isFavorite !== true) return false;
      if (boxId === 'unboxed' ? Boolean(note.boxId) : boxId !== 'all' && note.boxId !== boxId) return false;
      return !query || note.text.toLocaleLowerCase().includes(query);
    }).sort((a, b) => {
      const dateA = status === 'trash' ? a.deletedAt : a.updatedAt;
      const dateB = status === 'trash' ? b.deletedAt : b.updatedAt;
      return (Number.isFinite(dateB) ? dateB : 0) - (Number.isFinite(dateA) ? dateA : 0);
    });

    const fragment = document.createDocumentFragment();
    overflowEntries = [];
    for (const [index, note] of filtered.entries()) {
      const article = document.createElement('article');
      article.className = 'viewer-note';
      const text = document.createElement('p');
      text.className = 'viewer-note-text';
      text.id = `viewer-note-text-${index}`;
      text.textContent = note.text;
      text.classList.add('is-collapsed');
      article.append(text);

      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'viewer-note-toggle';
      button.textContent = '展開全文';
      button.hidden = true;
      button.setAttribute('aria-controls', text.id);
      button.setAttribute('aria-expanded', 'false');
      const entry = { text, button, expanded: false };
      button.addEventListener('click', () => {
        entry.expanded = !entry.expanded;
        entry.text.classList.toggle('is-collapsed', !entry.expanded);
        entry.button.textContent = entry.expanded ? '收起' : '展開全文';
        entry.button.setAttribute('aria-expanded', String(entry.expanded));
      });
      article.append(button);
      overflowEntries.push(entry);

      const meta = document.createElement('p');
      meta.className = 'viewer-note-meta';
      meta.append(makeMeta(boxNames.get(note.boxId) || (note.boxId ? '分類箱不詳' : '未分類'), 'viewer-note-category'));
      meta.append(makeMeta(`建立於 ${formatDate(note.createdAt)}`, 'viewer-note-time'));
      if (note.deletedAt) {
        meta.append(makeMeta(`已刪除 ${formatDate(note.deletedAt)}`, 'viewer-note-flag trash'));
      } else {
        meta.append(makeMeta(`更新於 ${formatDate(note.updatedAt)}`, 'viewer-note-time'));
      }
      if (note.isFavorite === true) meta.append(makeMeta('收藏', 'viewer-note-flag'));
      article.append(meta);
      fragment.append(article);
    }
    noteList.replaceChildren(fragment);
    updateOverflowButtons();
    resultCount.textContent = `顯示 ${filtered.length} 則筆記`;
    const statusLabel = { all: '全部', favorite: '收藏', trash: '垃圾桶' }[status];
    const boxLabel = boxId === 'all' ? '所有分類箱' : boxId === 'unboxed' ? '未分類' : boxNames.get(boxId) || '分類箱不詳';
    const searchLabel = searchInput.value.trim() ? ` · 搜尋「${searchInput.value.trim()}」` : '';
    printSelection.textContent = `篩選：${statusLabel} · ${boxLabel}${searchLabel} · ${filtered.length} 則筆記`;
    if (exportPdf) exportPdf.disabled = filtered.length === 0;
    if (quickExportPdf) quickExportPdf.disabled = filtered.length === 0;
    emptyResults.hidden = filtered.length !== 0;
  }

  function showBackup(data, fileName) {
    backup = data;
    backupName.textContent = fileName;
    backupMeta.textContent = `匯出時間：${formatDate(data.exportedAt)}`;
    const activeCount = data.notes.filter((note) => !note.deletedAt).length;
    backupCount.textContent = `${activeCount} 則筆記 · ${data.notes.length - activeCount} 則垃圾桶筆記 · ${data.boxes.length} 個分類箱`;
    boxFilter.replaceChildren(new Option('所有分類箱', 'all'), new Option('未分類', 'unboxed'));
    for (const box of data.boxes) boxFilter.add(new Option(box.name, box.id));
    document.querySelector('input[name="note-status"][value="all"]').checked = true;
    boxFilter.value = 'all';
    searchInput.value = '';
    fileStatus.textContent = '';
    content.hidden = false;
    renderNotes();
  }

  fileInput.addEventListener('change', async () => {
    const file = fileInput.files[0];
    if (!file) return;
    backup = null;
    overflowEntries = [];
    content.hidden = true;
    noteList.replaceChildren();
    backupName.textContent = '';
    backupMeta.textContent = '';
    backupCount.textContent = '';
    resultCount.textContent = '';
    printSelection.textContent = '';
    if (exportPdf) exportPdf.disabled = true;
    if (quickExportPdf) quickExportPdf.disabled = true;
    boxFilter.replaceChildren(new Option('所有分類箱', 'all'));
    fileStatus.textContent = '';
    try {
      showBackup(parseBackup(await file.text()), file.name);
    } catch (error) {
      fileStatus.textContent = error instanceof SyntaxError
        ? '無法讀取 JSON 檔案，請確認檔案內容是否完整。'
        : error.message === '這不是有效的 Spark Note 第 1 版備份檔。'
          ? error.message
          : '無法讀取備份檔，請重新選取檔案。';
    }
    fileInput.value = '';
  });

  document.querySelectorAll('input[name="note-status"]').forEach((input) => input.addEventListener('change', renderNotes));
  boxFilter.addEventListener('change', renderNotes);
  searchInput.addEventListener('input', renderNotes);
  printNoteTimes?.addEventListener('change', () => {
    content.classList.toggle('hide-print-times', !printNoteTimes.checked);
  });
  function exportCurrentNotes() {
    if (backup && (exportPdf ? !exportPdf.disabled : quickExportPdf && !quickExportPdf.disabled)) window.print();
  }
  exportPdf?.addEventListener('click', exportCurrentNotes);
  quickExportPdf?.addEventListener('click', exportCurrentNotes);
  window.addEventListener('resize', updateOverflowButtons);
})();
