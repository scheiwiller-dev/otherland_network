/** Byte helpers that do not touch IndexedDB or Three.js. */

export function toArrayBuffer(bytes) {
    if (bytes instanceof ArrayBuffer) return bytes;
    const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    return view.buffer.slice(view.byteOffset, view.byteOffset + view.byteLength);
}

/**
 * Read a fetch body, stopping once `maxBytes` is exceeded.
 * `response.headers.get('content-length')` is honored when present.
 */
export async function readBoundedBody(response, maxBytes) {
    const header = response.headers && response.headers.get ? response.headers.get('content-length') : null;
    const declared = header == null || header === '' ? NaN : Number(header);
    if (Number.isFinite(declared) && declared > maxBytes) {
        return { ok: false, reason: 'size' };
    }

    if (!response.body || typeof response.body.getReader !== 'function') {
        const buffer = await response.arrayBuffer();
        if (buffer.byteLength > maxBytes) return { ok: false, reason: 'size' };
        return { ok: true, bytes: new Uint8Array(buffer) };
    }

    const reader = response.body.getReader();
    const chunks = [];
    let total = 0;
    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (!value) continue;
        const chunk = value instanceof Uint8Array ? value : new Uint8Array(value);
        total += chunk.byteLength;
        if (total > maxBytes) {
            if (typeof reader.cancel === 'function') await reader.cancel();
            return { ok: false, reason: 'size' };
        }
        chunks.push(chunk);
    }

    const bytes = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
        bytes.set(chunk, offset);
        offset += chunk.byteLength;
    }
    return { ok: true, bytes };
}
