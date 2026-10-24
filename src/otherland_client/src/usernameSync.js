/** Text from a Motoko `#err`, or null when the call did not fail that way. */
export function usernameResultError(result) {
    if (result && typeof result === 'object' && 'err' in result) {
        return String(result.err);
    }
    return null;
}

/**
 * Save a username.
 * No actor yet: keep the name locally so it can be sent once a node id exists.
 * `#err`: leave the stored name unchanged and return the canister text.
 */
export async function applyUsername(newName, { actor, storage, user }) {
    if (!actor) {
        storage.setItem('username', newName);
        storage.removeItem('usernameSynced');
        user.setUserName(newName);
        return { ok: true };
    }

    const result = await actor.setUsername(newName);
    const message = usernameResultError(result);
    if (message != null) {
        return { ok: false, message };
    }

    storage.setItem('username', newName);
    storage.setItem('usernameSynced', newName);
    user.setUserName(newName);
    return { ok: true };
}

/**
 * Send the local username to the user node once.
 * Skips when that name was already saved, or when the node already has a username.
 */
export async function syncPendingUsername({ actor, storage, notify }) {
    if (!actor) return;
    const stored = storage.getItem('username');
    if (!stored || storage.getItem('usernameSynced') === stored) return;

    const existing = await actor.getUsername();
    const current = existing && existing.length ? existing[0] : null;
    if (current) {
        if (current === stored) storage.setItem('usernameSynced', stored);
        return;
    }

    const result = await actor.setUsername(stored);
    const message = usernameResultError(result);
    if (message != null) {
        if (notify) notify(message);
        return;
    }
    storage.setItem('usernameSynced', stored);
}
