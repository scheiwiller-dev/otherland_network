import { describe, expect, it } from 'vitest';
import { LIBRARY_MESSAGES } from './model.js';
import { fetchRemoteGlb } from './remote.js';

const GLB = new Uint8Array([0x67, 0x6c, 0x54, 0x46, 2, 0, 0, 0, 12, 0, 0, 0]);

function response({ ok = true, status = 200, bytes = GLB, contentLength = null } = {}) {
    return {
        ok,
        status,
        headers: { get: (name) => (name === 'content-length' ? contentLength : null) },
        arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    };
}

describe('fetchRemoteGlb', () => {
    it('requests the URL without credentials and returns GLB bytes', async () => {
        const calls = [];
        const result = await fetchRemoteGlb('https://cdn.example.com/Box.glb', {
            fetchImpl: async (url, options) => {
                calls.push({ url, options });
                return response();
            },
        });
        expect(calls[0]).toEqual({
            url: 'https://cdn.example.com/Box.glb',
            options: { mode: 'cors', credentials: 'omit' },
        });
        expect(result.ok).toBe(true);
        expect(Array.from(result.bytes.slice(0, 4))).toEqual([0x67, 0x6c, 0x54, 0x46]);
    });

    it('turns a browser fetch failure into a CORS message and still resolves', async () => {
        const result = await fetchRemoteGlb('https://blocked.example/model.glb', {
            fetchImpl: async () => {
                throw new TypeError('Failed to fetch');
            },
        });
        expect(result.ok).toBe(false);
        expect(result.reason).toBe('cors');
        expect(result.message).toBe(LIBRARY_MESSAGES.cors);
        expect(result.message).toMatch(/CORS/);
    });

    it('reports HTTP status, non-GLB bodies, and oversized files', async () => {
        const missing = await fetchRemoteGlb('https://cdn.example.com/missing.glb', {
            fetchImpl: async () => response({ ok: false, status: 404, bytes: new Uint8Array() }),
        });
        expect(missing.message).toMatch(/404/);

        const html = await fetchRemoteGlb('https://cdn.example.com/page', {
            fetchImpl: async () => response({ bytes: new TextEncoder().encode('<!doctype html>') }),
        });
        expect(html.reason).toBe('parse');
        expect(html.message).toBe(LIBRARY_MESSAGES.notGlbPayload);

        const huge = await fetchRemoteGlb('https://cdn.example.com/huge.glb', {
            fetchImpl: async () => response({ contentLength: '999999999' }),
            maxBytes: 100,
        });
        expect(huge.reason).toBe('size');
    });
});