/** Copy and result handling for the one-time Cardinal admin claim. */

export const ADMIN_CLAIM_TEXT = {
    title: 'Claim Cardinal admin',
    offer: 'Cardinal has no admin yet. Paste the one-time setup token printed by `icp canister logs cardinal`. The first logged-in principal that submits it becomes admin.',
    success: 'This Internet Identity is now the Cardinal admin.',
    empty: 'Paste the setup token first.',
    unreachable: 'Cardinal is unreachable. Check that the local network is running, then try again.',
    rowOffer: 'No Cardinal admin yet',
    rowUnreachable: 'Cardinal unreachable',
};

const DEFAULT_STATUS_TIMEOUT_MS = 8000;

/**
 * Whether a logged-in user should see the claim entry.
 * Guests stay hidden. The entry is hidden once an admin exists.
 * `retry` means Cardinal did not answer, so the user can try the check again.
 */
export function adminClaimVisibility({ anonymous, reachable, configured }) {
    if (anonymous || (reachable && configured)) return 'hidden';
    if (reachable) return 'offer';
    return 'retry';
}

/**
 * Read `isAdminConfigured` without hanging login if Cardinal does not answer.
 * A timeout or throw is unreachable, not "an admin already exists".
 */
export function loadAdminClaimStatus(getActor, timeoutMs = DEFAULT_STATUS_TIMEOUT_MS) {
    return new Promise((resolve) => {
        let settled = false;
        const finish = (status) => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            resolve(status);
        };
        const timer = setTimeout(() => {
            finish({ reachable: false, configured: false, actor: null });
        }, timeoutMs);

        Promise.resolve()
            .then(getActor)
            .then(async (actor) => {
                const configured = await actor.isAdminConfigured();
                finish({ reachable: true, configured: Boolean(configured), actor });
            })
            .catch(() => {
                finish({ reachable: false, configured: false, actor: null });
            });
    });
}

function rejectedClaim(message) {
    let code = 'rejected';
    if (message === 'Invalid setup token') code = 'invalid';
    else if (message === 'Admin has already been claimed') code = 'already-claimed';
    else if (message.startsWith('Setup token is not ready')) code = 'not-ready';
    else if (message.startsWith('Log in with Internet Identity')) code = 'anonymous';
    return { ok: false, code, message };
}

/** Submit a setup token. Does not store or log the token. */
export async function submitAdminClaim(actor, token) {
    const trimmed = typeof token === 'string' ? token.trim() : '';
    if (!trimmed) {
        return { ok: false, code: 'empty', message: ADMIN_CLAIM_TEXT.empty };
    }
    if (!actor || typeof actor.claimAdmin !== 'function') {
        return { ok: false, code: 'unreachable', message: ADMIN_CLAIM_TEXT.unreachable };
    }

    let result;
    try {
        result = await actor.claimAdmin(trimmed);
    } catch {
        return { ok: false, code: 'unreachable', message: ADMIN_CLAIM_TEXT.unreachable };
    }

    if (result && typeof result === 'object' && 'ok' in result) {
        return { ok: true, code: 'claimed', message: ADMIN_CLAIM_TEXT.success };
    }
    if (result && typeof result === 'object' && 'err' in result) {
        return rejectedClaim(String(result.err));
    }
    return { ok: false, code: 'unreachable', message: ADMIN_CLAIM_TEXT.unreachable };
}
