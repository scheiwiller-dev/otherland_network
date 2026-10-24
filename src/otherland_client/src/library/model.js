/** Pure library rules: names, URLs, GLB checks, and user-facing load messages. */

export const LIBRARY_MAX_BYTES = 100 * 1024 * 1024;
export const LIBRARY_NAME_MAX = 80;
export const LEGACY_STORAGE_KEY = 'libraryObjects';

export const LIBRARY_MESSAGES = {
    notGlb: 'Library uploads accept GLB files (.glb).',
    tooLarge: 'File exceeds the 100MB size limit.',
    cors: 'Could not load this URL. The host is blocking cross-origin requests (CORS), or the address cannot be reached from this page. The link stays in your library.',
    notGlbPayload: 'This did not load as a GLB file. The entry stays in your library, but there is no preview.',
    invalidUrl: 'That is not a valid URL.',
    badProtocol: 'Use an http or https URL.',
    emptyUrl: 'Paste a URL to a GLB file.',
    emptyName: 'Enter a name.',
    previewIdle: 'Select a resource to preview it.',
    previewReady: 'Drag to look around.',
    previewLoading: 'Loading preview…',
    storageFull: 'This browser could not store the file because local storage is full.',
    storageFailed: 'Could not save this resource in local library storage.',
    previewUnavailable: '3D preview is not available in this browser.',
};

export function sanitizeName(name) {
    if (typeof name !== 'string') return '';
    return name.replace(/\s+/g, ' ').trim().slice(0, LIBRARY_NAME_MAX);
}

export function isGlbFileName(name) {
    return typeof name === 'string' && name.trim().toLowerCase().endsWith('.glb');
}

export function looksLikeGlb(bytes) {
    if (!bytes || bytes.byteLength < 12) return false;
    const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    return view[0] === 0x67 && view[1] === 0x6c && view[2] === 0x54 && view[3] === 0x46;
}

export function validateUploadFile({ name, size }) {
    if (!isGlbFileName(name)) {
        return { ok: false, message: LIBRARY_MESSAGES.notGlb };
    }
    if (typeof size === 'number' && size > LIBRARY_MAX_BYTES) {
        return { ok: false, message: LIBRARY_MESSAGES.tooLarge };
    }
    return { ok: true };
}

export function validateRemoteUrl(raw) {
    const text = typeof raw === 'string' ? raw.trim() : '';
    if (!text) return { ok: false, message: LIBRARY_MESSAGES.emptyUrl };
    let url;
    try {
        url = new URL(text);
    } catch {
        return { ok: false, message: LIBRARY_MESSAGES.invalidUrl };
    }
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
        return { ok: false, message: LIBRARY_MESSAGES.badProtocol };
    }
    return { ok: true, href: url.href };
}

export function nameFromUrl(url) {
    try {
        const base = new URL(url).pathname.split('/').filter(Boolean).pop();
        if (!base) return 'remote-model';
        return decodeURIComponent(base).slice(0, LIBRARY_NAME_MAX);
    } catch {
        return 'remote-model';
    }
}

export function formatByteSize(bytes) {
    if (typeof bytes !== 'number' || !Number.isFinite(bytes) || bytes < 0) return '—';
    if (bytes < 1024) return `${Math.round(bytes)} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function sourceLabel(entry) {
    return entry && entry.source === 'url' ? 'URL' : 'File';
}

export function entrySourceLine(entry) {
    if (!entry) return '';
    if (entry.source === 'url') return entry.url || '';
    return entry.filename || 'Local file';
}

export function buildFileEntry({ id, filename, name, byteSize, now }) {
    const fileName = typeof filename === 'string' && filename ? filename : 'model.glb';
    return {
        id,
        name: sanitizeName(name) || fileName.slice(0, LIBRARY_NAME_MAX),
        source: 'file',
        filename: fileName,
        url: null,
        mime: 'model/gltf-binary',
        byteSize: typeof byteSize === 'number' ? byteSize : null,
        createdAt: now,
        updatedAt: now,
    };
}

export function buildUrlEntry({ id, url, name, byteSize, now }) {
    return {
        id,
        name: sanitizeName(name) || nameFromUrl(url),
        source: 'url',
        filename: null,
        url,
        mime: 'model/gltf-binary',
        byteSize: typeof byteSize === 'number' ? byteSize : null,
        createdAt: now,
        updatedAt: now,
    };
}

export function renameEntry(entry, name, now) {
    const clean = sanitizeName(name);
    if (!clean) return { ok: false, message: LIBRARY_MESSAGES.emptyName };
    return { ok: true, entry: { ...entry, name: clean, updatedAt: now } };
}

export function createLibraryId(now = Date.now(), rand = Math.random()) {
    const stamp = Math.max(0, Math.floor(now)).toString(36);
    const suffix = Math.floor(Math.abs(rand) * 1e9).toString(36);
    return `lib_${stamp}_${suffix}`;
}

export function sortLibraryEntries(entries) {
    return [...entries].sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
}

export function decodeDataUrl(dataUrl) {
    if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:')) return null;
    const comma = dataUrl.indexOf(',');
    if (comma < 0) return null;
    const meta = dataUrl.slice(5, comma);
    const payload = dataUrl.slice(comma + 1);
    try {
        const binary = /;base64/i.test(meta) ? atob(payload.replace(/\s/g, '')) : decodeURIComponent(payload);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i) & 0xff;
        return bytes;
    } catch {
        return null;
    }
}

export function legacyRecordToParts(obj, now) {
    if (!obj || typeof obj !== 'object') return null;
    if (typeof obj.id !== 'string' || !obj.id) return null;
    const filename = typeof obj.filename === 'string' && obj.filename ? obj.filename : 'object.glb';
    const createdAt = typeof obj.uploadedAt === 'string' && obj.uploadedAt ? obj.uploadedAt : now;
    const bytes = typeof obj.data === 'string' ? decodeDataUrl(obj.data) : null;
    return {
        entry: buildFileEntry({
            id: obj.id,
            filename,
            name: typeof obj.description === 'string' ? obj.description : filename,
            byteSize: bytes ? bytes.byteLength : null,
            now: createdAt,
        }),
        bytes,
    };
}

export function legacyObjectsToRecords(objects, now = new Date().toISOString()) {
    if (!Array.isArray(objects)) return [];
    const records = [];
    for (const obj of objects) {
        const record = legacyRecordToParts(obj, now);
        if (record) records.push(record);
    }
    return records;
}

export function classifyFetchFailure(error) {
    const name = String(error && error.name || '');
    const message = String(error && error.message || error || '');
    if (
        name === 'TypeError'
        || name === 'NetworkError'
        || /failed to fetch|networkerror|load failed|cors|cross-origin|network request failed/i.test(message)
    ) {
        return 'cors';
    }
    return 'unknown';
}

export function httpStatusMessage(status) {
    return `The server returned ${status} for this URL. The link stays in your library, but there is nothing to preview.`;
}

export function messageForLoadFailure(reason) {
    if (reason === 'cors') return LIBRARY_MESSAGES.cors;
    if (reason === 'size') return LIBRARY_MESSAGES.tooLarge;
    if (reason === 'parse') return LIBRARY_MESSAGES.notGlbPayload;
    return 'Could not load this resource.';
}

export function storageFailureMessage(error) {
    if (error && error.name === 'QuotaExceededError') return LIBRARY_MESSAGES.storageFull;
    return LIBRARY_MESSAGES.storageFailed;
}
