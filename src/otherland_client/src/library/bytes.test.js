import { describe, expect, it } from 'vitest';
import { readBoundedBody, toArrayBuffer } from './bytes.js';

describe('library byte reads', () => {
    it('copies a view into its own ArrayBuffer', () => {
        const host = new Uint8Array([1, 2, 3, 4, 5]);
        const view = host.subarray(1, 4);
        const buffer = toArrayBuffer(view);
        expect(new Uint8Array(buffer)).toEqual(new Uint8Array([2, 3, 4]));
        expect(buffer.byteLength).toBe(3);
    });

    it('stops when content-length is over the cap', async () => {
        const response = {
            headers: { get: (name) => (name === 'content-length' ? '50' : null) },
            arrayBuffer: async () => { throw new Error('should not read'); },
        };
        await expect(readBoundedBody(response, 10)).resolves.toEqual({ ok: false, reason: 'size' });
    });

    it('concatenates streamed chunks and cancels when they pass the cap', async () => {
        const reader = {
            cancelled: false,
            chunks: [new Uint8Array([1, 2]), new Uint8Array([3])],
            async read() {
                const next = this.chunks.shift();
                if (!next) return { done: true, value: undefined };
                return { done: false, value: next };
            },
            async cancel() {
                this.cancelled = true;
            },
        };
        const ok = await readBoundedBody({
            headers: { get: () => null },
            body: { getReader: () => reader },
        }, 8);
        expect(Array.from(ok.bytes)).toEqual([1, 2, 3]);

        const over = {
            cancelled: false,
            async read() {
                return { done: false, value: new Uint8Array(6) };
            },
            async cancel() {
                this.cancelled = true;
            },
        };
        const limited = await readBoundedBody({
            headers: { get: () => null },
            body: { getReader: () => over },
        }, 4);
        expect(limited).toEqual({ ok: false, reason: 'size' });
        expect(over.cancelled).toBe(true);
    });

    it('reads an arrayBuffer body when the stream API is missing', async () => {
        const response = {
            headers: { get: () => null },
            arrayBuffer: async () => new Uint8Array([9, 8]).buffer,
        };
        const result = await readBoundedBody(response, 10);
        expect(Array.from(result.bytes)).toEqual([9, 8]);
    });
});
