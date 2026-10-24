/**
 * Local library catalogue.
 *
 * Bytes live in a separate IndexedDB (`OtherlandLibrary`) so this does not
 * bump the KhetCache version used by node asset cache and chunked upload.
 * Metadata is enough to list entries. File bytes are a second store.
 * URL entries keep the link only and are fetched again for preview.
 */
import { toArrayBuffer } from './bytes.js';
import {
    LEGACY_STORAGE_KEY,
    legacyObjectsToRecords,
    sortLibraryEntries,
} from './model.js';

const DB_NAME = 'OtherlandLibrary';
const DB_VERSION = 1;
const ENTRIES = 'entries';
const BLOBS = 'blobs';

function openDb() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains(ENTRIES)) {
                db.createObjectStore(ENTRIES, { keyPath: 'id' });
            }
            if (!db.objectStoreNames.contains(BLOBS)) {
                db.createObjectStore(BLOBS, { keyPath: 'id' });
            }
        };
    });
}

function settle(db, transaction, resolve, reject, readResult) {
    let settled = false;
    const end = (fn, value) => {
        if (settled) return;
        settled = true;
        db.close();
        fn(value);
    };
    transaction.oncomplete = () => end(resolve, readResult ? readResult() : undefined);
    transaction.onerror = () => end(reject, transaction.error);
    transaction.onabort = () => end(reject, transaction.error || new Error('Library storage was aborted'));
}

async function getRow(storeName, id) {
    const db = await openDb();
    return new Promise((resolve, reject) => {
        let result = null;
        const transaction = db.transaction([storeName], 'readonly');
        const request = transaction.objectStore(storeName).get(id);
        request.onsuccess = () => {
            result = request.result || null;
        };
        settle(db, transaction, resolve, reject, () => result);
    });
}

export async function listLibraryEntries() {
    const db = await openDb();
    const rows = await new Promise((resolve, reject) => {
        let result = [];
        const transaction = db.transaction([ENTRIES], 'readonly');
        const request = transaction.objectStore(ENTRIES).getAll();
        request.onsuccess = () => {
            result = request.result || [];
        };
        settle(db, transaction, resolve, reject, () => result);
    });
    return sortLibraryEntries(rows);
}

export async function getLibraryEntry(id) {
    return getRow(ENTRIES, id);
}

export async function getLibraryBytes(id) {
    const row = await getRow(BLOBS, id);
    if (!row || row.data == null) return null;
    const data = row.data;
    if (data instanceof Uint8Array) return new Uint8Array(data);
    if (data instanceof ArrayBuffer) return new Uint8Array(data);
    if (ArrayBuffer.isView(data)) {
        return new Uint8Array(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength));
    }
    return null;
}

export async function saveLibraryEntry(entry, bytes) {
    const db = await openDb();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([ENTRIES, BLOBS], 'readwrite');
        transaction.objectStore(ENTRIES).put(entry);
        if (bytes) {
            transaction.objectStore(BLOBS).put({ id: entry.id, data: toArrayBuffer(bytes) });
        }
        settle(db, transaction, resolve, reject);
    });
}

export async function deleteLibraryEntry(id) {
    const db = await openDb();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([ENTRIES, BLOBS], 'readwrite');
        transaction.objectStore(ENTRIES).delete(id);
        transaction.objectStore(BLOBS).delete(id);
        settle(db, transaction, resolve, reject);
    });
}

/** One-way copy from the old localStorage data-URL catalogue. */
export async function migrateLegacyLibrary(storage) {
    if (!storage || typeof storage.getItem !== 'function') return;
    const raw = storage.getItem(LEGACY_STORAGE_KEY);
    if (!raw) return;
    let parsed;
    try {
        parsed = JSON.parse(raw);
    } catch {
        storage.removeItem(LEGACY_STORAGE_KEY);
        return;
    }
    const records = legacyObjectsToRecords(parsed);
    for (const record of records) {
        const existing = await getLibraryEntry(record.entry.id);
        if (!existing) await saveLibraryEntry(record.entry, record.bytes || undefined);
    }
    storage.removeItem(LEGACY_STORAGE_KEY);
}
