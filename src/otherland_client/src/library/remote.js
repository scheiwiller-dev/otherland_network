import { readBoundedBody } from './bytes.js';
import {
    LIBRARY_MAX_BYTES,
    LIBRARY_MESSAGES,
    classifyFetchFailure,
    httpStatusMessage,
    looksLikeGlb,
    messageForLoadFailure,
} from './model.js';

/**
 * Fetch a remote GLB for preview. CORS and network failures return a message
 * instead of throwing, so the saved URL entry can stay in the library.
 */
export async function fetchRemoteGlb(url, { fetchImpl = fetch, maxBytes = LIBRARY_MAX_BYTES } = {}) {
    let response;
    try {
        response = await fetchImpl(url, { mode: 'cors', credentials: 'omit' });
    } catch (error) {
        const reason = classifyFetchFailure(error);
        return { ok: false, reason, message: messageForLoadFailure(reason) };
    }

    if (!response || !response.ok) {
        const status = response ? response.status : 0;
        if (!status) {
            return { ok: false, reason: 'cors', message: LIBRARY_MESSAGES.cors };
        }
        return { ok: false, reason: 'http', message: httpStatusMessage(status) };
    }

    const body = await readBoundedBody(response, maxBytes);
    if (!body.ok) {
        return { ok: false, reason: body.reason, message: messageForLoadFailure(body.reason) };
    }
    if (!looksLikeGlb(body.bytes)) {
        return { ok: false, reason: 'parse', message: LIBRARY_MESSAGES.notGlbPayload };
    }
    return { ok: true, bytes: body.bytes };
}
