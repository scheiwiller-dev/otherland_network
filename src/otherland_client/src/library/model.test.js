import { describe, expect, it } from 'vitest';
import {
    LIBRARY_MAX_BYTES,
    LIBRARY_MESSAGES,
    buildFileEntry,
    buildUrlEntry,
    classifyFetchFailure,
    createLibraryId,
    decodeDataUrl,
    entrySourceLine,
    formatByteSize,
    httpStatusMessage,
    isGlbFileName,
    legacyObjectsToRecords,
    looksLikeGlb,
    messageForLoadFailure,
    nameFromUrl,
    renameEntry,
    sanitizeName,
    sortLibraryEntries,
    sourceLabel,
    storageFailureMessage,
    validateRemoteUrl,
    validateUploadFile,
} from './model.js';

const GLB_MAGIC = new Uint8Array([0x67, 0x6c, 0x54, 0x46, 2, 0, 0, 0, 12, 0, 0, 0]);

describe('library names and files', () => {
    it('accepts a GLB under the size cap and rejects other formats', () => {
        expect(validateUploadFile({ name: 'Box.GLB', size: LIBRARY_MAX_BYTES })).toEqual({ ok: true });
        expect(validateUploadFile({ name: 'mesh.gltf', size: 10 }).message).toBe(LIBRARY_MESSAGES.notGlb);
        expect(validateUploadFile({ name: 'mesh.obj', size: 10 }).ok).toBe(false);
        expect(validateUploadFile({ name: 'big.glb', size: LIBRARY_MAX_BYTES + 1 }).message).toBe(LIBRARY_MESSAGES.tooLarge);
        expect(isGlbFileName(' folder/Avatar.glb ')).toBe(true);
    });

    it('recognizes the glTF binary magic', () => {
        expect(looksLikeGlb(GLB_MAGIC)).toBe(true);
        expect(looksLikeGlb(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]))).toBe(false);
        expect(looksLikeGlb(new Uint8Array(4))).toBe(false);
    });

    it('builds a file entry and renames it', () => {
        const entry = buildFileEntry({
            id: 'lib_1',
            filename: 'Box.glb',
            name: '  Lobby   chair  ',
            byteSize: 2048,
            now: '2026-09-27T00:00:00.000Z',
        });
        expect(entry).toMatchObject({
            name: 'Lobby chair',
            source: 'file',
            filename: 'Box.glb',
            url: null,
            byteSize: 2048,
        });
        expect(sanitizeName('   ')).toBe('');
        expect(renameEntry(entry, '   ', '2026-09-27T01:00:00.000Z').ok).toBe(false);
        const renamed = renameEntry(entry, 'Chair', '2026-09-27T01:00:00.000Z');
        expect(renamed.entry.name).toBe('Chair');
        expect(renamed.entry.createdAt).toBe(entry.createdAt);
        expect(sourceLabel(entry)).toBe('File');
        expect(entrySourceLine(entry)).toBe('Box.glb');
    });

    it('formats sizes and sorts newest first', () => {
        expect(formatByteSize(null)).toBe('—');
        expect(formatByteSize(512)).toBe('512 B');
        expect(formatByteSize(1536)).toBe('1.5 KB');
        expect(formatByteSize(5 * 1024 * 1024)).toBe('5.0 MB');
        const sorted = sortLibraryEntries([
            { id: 'a', createdAt: '2026-01-01T00:00:00.000Z' },
            { id: 'b', createdAt: '2026-06-01T00:00:00.000Z' },
        ]);
        expect(sorted.map((entry) => entry.id)).toEqual(['b', 'a']);
    });

    it('creates a stable id shape from injected clock and random', () => {
        expect(createLibraryId(36, 0)).toBe('lib_10_0');
        expect(createLibraryId(36, 0.5)).toMatch(/^lib_10_[0-9a-z]+$/);
        expect(createLibraryId(36, 0.5)).not.toBe(createLibraryId(36, 0));
    });
});

describe('library URLs', () => {
    it('keeps http(s) links and rejects other protocols', () => {
        expect(validateRemoteUrl('  https://cdn.example.com/models/Box.glb?v=1 ').href)
            .toBe('https://cdn.example.com/models/Box.glb?v=1');
        expect(validateRemoteUrl('javascript:alert(1)').message).toBe(LIBRARY_MESSAGES.badProtocol);
        expect(validateRemoteUrl('not a url').message).toBe(LIBRARY_MESSAGES.invalidUrl);
        expect(validateRemoteUrl('   ').message).toBe(LIBRARY_MESSAGES.emptyUrl);
    });

    it('names a URL entry from the path when no name is given', () => {
        const entry = buildUrlEntry({
            id: 'lib_2',
            url: 'https://cdn.example.com/models/My%20Box.glb',
            name: '',
            now: '2026-09-27T00:00:00.000Z',
        });
        expect(nameFromUrl(entry.url)).toBe('My Box.glb');
        expect(entry.name).toBe('My Box.glb');
        expect(entry.source).toBe('url');
        expect(entry.byteSize).toBeNull();
        expect(sourceLabel(entry)).toBe('URL');
        expect(entrySourceLine(entry)).toBe(entry.url);
        expect(nameFromUrl('https://cdn.example.com/')).toBe('remote-model');
    });

    it('describes CORS and HTTP failures in the app', () => {
        expect(classifyFetchFailure(new TypeError('Failed to fetch'))).toBe('cors');
        expect(classifyFetchFailure({ name: 'NetworkError', message: 'Load failed' })).toBe('cors');
        expect(messageForLoadFailure('cors')).toMatch(/CORS/);
        expect(httpStatusMessage(404)).toMatch(/404/);
        expect(httpStatusMessage(404)).toMatch(/library/);
    });
});

describe('legacy localStorage records', () => {
    it('decodes a data URL into bytes and drops invalid rows', () => {
        const payload = btoa('glTF');
        const bytes = decodeDataUrl(`data:model/gltf-binary;base64,${payload}`);
        expect(Array.from(bytes)).toEqual(Array.from(new TextEncoder().encode('glTF')));
        expect(decodeDataUrl('data:text/plain,hello')).toEqual(new Uint8Array([104, 101, 108, 108, 111]));
        expect(decodeDataUrl('https://example.com/a.glb')).toBeNull();
        expect(decodeDataUrl('data:bad;base64,%%%')).toBeNull();

        const records = legacyObjectsToRecords([
            {
                id: 'khet_old',
                filename: 'Chair.glb',
                description: 'Chair',
                data: `data:application/octet-stream;base64,${payload}`,
                uploadedAt: '2026-01-02T00:00:00.000Z',
            },
            { filename: 'missing-id.glb' },
            null,
        ], '2026-09-27T00:00:00.000Z');
        expect(records).toHaveLength(1);
        expect(records[0].entry).toMatchObject({
            id: 'khet_old',
            name: 'Chair',
            source: 'file',
            byteSize: 4,
            createdAt: '2026-01-02T00:00:00.000Z',
        });
        expect(Array.from(records[0].bytes)).toEqual(Array.from(bytes));
    });
});

describe('storage failures', () => {
    it('names a full browser quota separately from other save errors', () => {
        expect(storageFailureMessage({ name: 'QuotaExceededError' })).toBe(LIBRARY_MESSAGES.storageFull);
        expect(storageFailureMessage(new Error('boom'))).toBe(LIBRARY_MESSAGES.storageFailed);
    });
});
