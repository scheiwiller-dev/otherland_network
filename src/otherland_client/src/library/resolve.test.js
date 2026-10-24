import { describe, expect, it, vi } from 'vitest';
import { LIBRARY_MESSAGES } from './model.js';
import { resolveLibraryGlb } from './resolve.js';

const GLB = new Uint8Array([0x67, 0x6c, 0x54, 0x46, 2, 0, 0, 0, 12, 0, 0, 0]);

describe('resolveLibraryGlb', () => {
    it('returns stored file bytes', async () => {
        const fetchGlb = vi.fn();
        const result = await resolveLibraryGlb(
            { id: 'file-1', source: 'file' },
            { getBytes: async () => GLB, fetchGlb },
        );
        expect(result).toEqual({ ok: true, bytes: GLB });
        expect(fetchGlb).not.toHaveBeenCalled();
    });

    it('keeps a URL row when the host blocks the fetch', async () => {
        const result = await resolveLibraryGlb(
            { id: 'url-1', source: 'url', url: 'https://blocked.example/a.glb' },
            {
                getBytes: async () => { throw new Error('blob store should not be read'); },
                fetchGlb: async () => ({ ok: false, message: LIBRARY_MESSAGES.cors }),
            },
        );
        expect(result.ok).toBe(false);
        expect(result.message).toBe(LIBRARY_MESSAGES.cors);
        expect(result.message).toMatch(/CORS/);
    });

    it('returns URL bytes when the fetch succeeds', async () => {
        const result = await resolveLibraryGlb(
            { id: 'url-2', source: 'url', url: 'https://cdn.example/Box.glb' },
            {
                getBytes: async () => null,
                fetchGlb: async () => ({ ok: true, bytes: GLB }),
            },
        );
        expect(result).toEqual({ ok: true, bytes: GLB });
    });

    it('rejects a file entry that is not a GLB', async () => {
        const result = await resolveLibraryGlb(
            { id: 'file-2', source: 'file' },
            { getBytes: async () => new Uint8Array([1, 2, 3]), fetchGlb: async () => ({ ok: true, bytes: GLB }) },
        );
        expect(result.ok).toBe(false);
        expect(result.message).toBe(LIBRARY_MESSAGES.notGlbPayload);
    });
});