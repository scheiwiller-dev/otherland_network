import { LIBRARY_MESSAGES, looksLikeGlb } from './model.js';

/**
 * Turn a catalogue entry into GLB bytes for the existing place pipeline.
 * A failed URL fetch returns a message and does not remove the entry.
 */
export async function resolveLibraryGlb(entry, { getBytes, fetchGlb }) {
    if (!entry) {
        return { ok: false, message: 'Choose a Library resource to place.' };
    }
    if (entry.source === 'url') {
        const result = await fetchGlb(entry.url);
        if (!result || !result.ok) {
            return {
                ok: false,
                message: result && result.message ? result.message : LIBRARY_MESSAGES.cors,
            };
        }
        return { ok: true, bytes: result.bytes };
    }
    const bytes = await getBytes(entry.id);
    if (!bytes || !looksLikeGlb(bytes)) {
        return { ok: false, message: LIBRARY_MESSAGES.notGlbPayload };
    }
    return { ok: true, bytes };
}
