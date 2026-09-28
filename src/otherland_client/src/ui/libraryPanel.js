/**
 * Library tab: local catalogue, GLB upload, URL source, and preview.
 * Guest and TreeHouse use this without Cardinal or a user node.
 */
import { fetchRemoteGlb } from '../library/remote.js';
import {
    deleteLibraryEntry,
    getLibraryBytes,
    getLibraryEntry,
    listLibraryEntries,
    migrateLegacyLibrary,
    saveLibraryEntry,
} from '../library/store.js';
import {
    LIBRARY_MESSAGES,
    buildFileEntry,
    buildUrlEntry,
    createLibraryId,
    entrySourceLine,
    formatByteSize,
    looksLikeGlb,
    renameEntry,
    sourceLabel,
    storageFailureMessage,
    validateRemoteUrl,
    validateUploadFile,
} from '../library/model.js';

let preview = null;
let previewPromise = null;
let active = false;
let wired = false;
let selectedId = null;
let shownId = null;
let shownOk = false;
let previewToken = 0;
let ready = Promise.resolve();

function nowIso() {
    return new Date().toISOString();
}

function setMessage(id, text, kind) {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = text || '';
    el.classList.toggle('is-error', kind === 'error');
    el.classList.toggle('is-ok', kind === 'ok');
}

function ensurePreview() {
    if (!previewPromise) {
        previewPromise = (async () => {
            const canvas = document.getElementById('library-preview-canvas');
            if (!canvas) throw new Error('Preview canvas is missing.');
            const { createLibraryPreview } = await import('../library/preview.js');
            preview = createLibraryPreview(canvas);
            return preview;
        })();
        previewPromise.catch(() => {
            previewPromise = null;
        });
    }
    return previewPromise;
}

function showDetail(entry) {
    const actions = document.getElementById('library-detail-actions');
    const name = document.getElementById('library-rename-input');
    const source = document.getElementById('library-detail-source');
    if (actions) actions.classList.remove('hidden');
    if (name && document.activeElement !== name) name.value = entry.name;
    if (source) source.textContent = entrySourceLine(entry);
    setMessage('library-detail-message', '', '');
}

function hideDetail() {
    const actions = document.getElementById('library-detail-actions');
    if (actions) actions.classList.add('hidden');
    const source = document.getElementById('library-detail-source');
    if (source) source.textContent = '';
    setMessage('library-detail-message', '', '');
}

function markSelectedRow() {
    const rows = document.querySelectorAll('#library-object-tbody tr');
    rows.forEach((row) => {
        row.classList.toggle('is-selected', row.dataset.id === selectedId);
    });
}

async function renderList() {
    const entries = await listLibraryEntries();
    const empty = document.getElementById('library-empty');
    const list = document.getElementById('library-object-list');
    const tbody = document.getElementById('library-object-tbody');
    if (!tbody) return entries;

    if (empty) empty.classList.toggle('hidden', entries.length > 0);
    if (list) list.classList.toggle('hidden', entries.length === 0);
    tbody.replaceChildren();

    for (const entry of entries) {
        const row = document.createElement('tr');
        row.dataset.id = entry.id;
        row.tabIndex = 0;
        if (entry.id === selectedId) row.classList.add('is-selected');

        const nameCell = document.createElement('td');
        nameCell.textContent = entry.name;
        const sourceCell = document.createElement('td');
        sourceCell.textContent = sourceLabel(entry);
        const sizeCell = document.createElement('td');
        sizeCell.textContent = formatByteSize(entry.byteSize);

        row.append(nameCell, sourceCell, sizeCell);
        const open = () => { selectEntry(entry.id); };
        row.addEventListener('click', open);
        row.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                open();
            }
        });
        tbody.append(row);
    }

    if (selectedId && !entries.some((entry) => entry.id === selectedId)) {
        selectedId = null;
        shownId = null;
        shownOk = false;
        preview?.clear();
        hideDetail();
        setMessage('library-preview-message', LIBRARY_MESSAGES.previewIdle, '');
    }
    return entries;
}

async function rememberSize(id, byteSize) {
    const current = await getLibraryEntry(id);
    if (!current || current.byteSize === byteSize) return;
    await saveLibraryEntry({ ...current, byteSize });
}

async function showPreview(entry) {
    const token = ++previewToken;
    shownId = entry.id;
    shownOk = false;
    try {
        (await ensurePreview()).clear();
    } catch (error) {
        setMessage('library-preview-message', error.message || LIBRARY_MESSAGES.previewUnavailable, 'error');
        return { ok: false, message: LIBRARY_MESSAGES.previewUnavailable };
    }
    setMessage('library-preview-message', LIBRARY_MESSAGES.previewLoading, 'ok');

    try {
        let bytes = null;
        if (entry.source === 'url') {
            const result = await fetchRemoteGlb(entry.url);
            if (token !== previewToken) return { ok: false, stale: true };
            if (!result.ok) {
                setMessage('library-preview-message', result.message, 'error');
                return { ok: false, message: result.message };
            }
            bytes = result.bytes;
            await rememberSize(entry.id, bytes.byteLength);
        } else {
            bytes = await getLibraryBytes(entry.id);
            if (token !== previewToken) return { ok: false, stale: true };
            if (!bytes || !looksLikeGlb(bytes)) {
                setMessage('library-preview-message', LIBRARY_MESSAGES.notGlbPayload, 'error');
                return { ok: false, message: LIBRARY_MESSAGES.notGlbPayload };
            }
        }

        await (await ensurePreview()).showBytes(bytes);
        if (token !== previewToken) return { ok: false, stale: true };
        shownOk = true;
        setMessage('library-preview-message', LIBRARY_MESSAGES.previewReady, 'ok');
        await renderList();
        return { ok: true };
    } catch (error) {
        if (token !== previewToken) return { ok: false, stale: true };
        preview?.clear();
        const message = LIBRARY_MESSAGES.notGlbPayload;
        console.error('Library preview failed:', error);
        setMessage('library-preview-message', message, 'error');
        return { ok: false, message };
    }
}

async function selectEntry(id) {
    if (id === selectedId && shownId === id && shownOk) {
        markSelectedRow();
        return { ok: true };
    }
    const entry = await getLibraryEntry(id);
    if (!entry) return { ok: false };
    selectedId = id;
    markSelectedRow();
    showDetail(entry);
    return showPreview(entry);
}

async function addFile() {
    await ready;
    const input = document.getElementById('library-upload-input');
    const nameInput = document.getElementById('library-description-input');
    const file = input && input.files && input.files[0];
    if (!file) {
        setMessage('library-upload-message', 'Choose a GLB file to add.', 'error');
        return;
    }
    const check = validateUploadFile({ name: file.name, size: file.size });
    if (!check.ok) {
        setMessage('library-upload-message', check.message, 'error');
        return;
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    if (!looksLikeGlb(bytes)) {
        setMessage('library-upload-message', LIBRARY_MESSAGES.notGlbPayload, 'error');
        return;
    }
    const token = ++previewToken;

    const entry = buildFileEntry({
        id: createLibraryId(),
        filename: file.name,
        name: nameInput ? nameInput.value : '',
        byteSize: bytes.byteLength,
        now: nowIso(),
    });

    try {
        const view = await ensurePreview();
        if (token !== previewToken) return;
        view.clear();
        await view.showBytes(bytes);
        if (token !== previewToken) return;
    } catch (error) {
        preview?.clear();
        console.error('Library file preview failed:', error);
        setMessage('library-upload-message', LIBRARY_MESSAGES.notGlbPayload, 'error');
        setMessage('library-preview-message', LIBRARY_MESSAGES.notGlbPayload, 'error');
        return;
    }

    try {
        await saveLibraryEntry(entry, bytes);
    } catch (error) {
        preview?.clear();
        console.error('Library save failed:', error);
        setMessage('library-upload-message', storageFailureMessage(error), 'error');
        return;
    }

    if (input) input.value = '';
    if (nameInput) nameInput.value = '';
    selectedId = entry.id;
    shownId = entry.id;
    shownOk = true;
    await renderList();
    showDetail(entry);
    setMessage('library-preview-message', LIBRARY_MESSAGES.previewReady, 'ok');
    setMessage('library-upload-message', `Added ${entry.name}.`, 'ok');
}

async function addUrl() {
    await ready;
    const input = document.getElementById('library-url-input');
    const nameInput = document.getElementById('library-url-name-input');
    const check = validateRemoteUrl(input ? input.value : '');
    if (!check.ok) {
        setMessage('library-upload-message', check.message, 'error');
        return;
    }

    const entry = buildUrlEntry({
        id: createLibraryId(),
        url: check.href,
        name: nameInput ? nameInput.value : '',
        now: nowIso(),
    });

    try {
        await saveLibraryEntry(entry);
    } catch (error) {
        console.error('Library URL save failed:', error);
        setMessage('library-upload-message', storageFailureMessage(error), 'error');
        return;
    }

    if (input) input.value = '';
    if (nameInput) nameInput.value = '';
    selectedId = entry.id;
    await renderList();
    showDetail(entry);
    const result = await showPreview(entry);
    if (result && result.stale) return;
    if (result && result.ok) {
        setMessage('library-upload-message', 'Saved the URL.', 'ok');
    } else {
        setMessage('library-upload-message', `Saved the URL. ${result && result.message ? result.message : LIBRARY_MESSAGES.cors}`, 'error');
    }
}

async function renameSelected() {
    await ready;
    if (!selectedId) return;
    const nameInput = document.getElementById('library-rename-input');
    const current = await getLibraryEntry(selectedId);
    if (!current) return;
    const result = renameEntry(current, nameInput ? nameInput.value : '', nowIso());
    if (!result.ok) {
        setMessage('library-detail-message', result.message, 'error');
        return;
    }
    try {
        await saveLibraryEntry(result.entry);
    } catch (error) {
        setMessage('library-detail-message', storageFailureMessage(error), 'error');
        return;
    }
    await renderList();
    showDetail(result.entry);
    setMessage('library-detail-message', 'Name saved.', 'ok');
}

async function removeSelected() {
    await ready;
    if (!selectedId) return;
    if (!window.confirm('Remove this resource from your library?')) return;
    const id = selectedId;
    try {
        await deleteLibraryEntry(id);
    } catch (error) {
        console.error('Library delete failed:', error);
        setMessage('library-detail-message', storageFailureMessage(error), 'error');
        return;
    }
    if (selectedId === id) {
        selectedId = null;
        shownId = null;
        shownOk = false;
        previewToken += 1;
        preview?.clear();
        hideDetail();
        setMessage('library-preview-message', LIBRARY_MESSAGES.previewIdle, '');
    }
    setMessage('library-upload-message', 'Removed from your library.', 'ok');
    await renderList();
}

export function refreshLibrary() {
    return ready.then(() => renderList()).catch((error) => {
        console.error('Library refresh failed:', error);
        setMessage('library-upload-message', LIBRARY_MESSAGES.storageFailed, 'error');
    });
}

export function setLibraryActive(isActive) {
    active = isActive;
    if (!isActive) {
        preview?.stop();
        return;
    }
    ensurePreview().then((view) => {
        if (active) view.start();
    }).catch((error) => {
        console.error(error);
        setMessage('library-preview-message', error.message || LIBRARY_MESSAGES.previewUnavailable, 'error');
    });
    refreshLibrary();
}

export function initLibraryPanel() {
    if (wired) return;
    wired = true;
    ready = migrateLegacyLibrary(localStorage).catch((error) => {
        console.error('Library migration failed:', error);
    });

    const uploadBtn = document.getElementById('library-upload-btn');
    const urlBtn = document.getElementById('library-url-btn');
    const renameBtn = document.getElementById('library-rename-btn');
    const deleteBtn = document.getElementById('library-delete-btn');
    const renameInput = document.getElementById('library-rename-input');
    const urlInput = document.getElementById('library-url-input');

    if (uploadBtn) uploadBtn.addEventListener('click', () => { addFile(); });
    if (urlBtn) urlBtn.addEventListener('click', () => { addUrl(); });
    if (renameBtn) renameBtn.addEventListener('click', () => { renameSelected(); });
    if (deleteBtn) deleteBtn.addEventListener('click', () => { removeSelected(); });
    if (renameInput) {
        renameInput.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') {
                event.preventDefault();
                renameSelected();
            }
        });
    }
    if (urlInput) {
        urlInput.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') {
                event.preventDefault();
                addUrl();
            }
        });
    }
}
