import { describe, expect, it, vi } from 'vitest';
import { applyUsername, syncPendingUsername, usernameResultError } from './usernameSync.js';

function memoryStorage(initial = {}) {
    const data = { ...initial };
    return {
        getItem(key) {
            return Object.prototype.hasOwnProperty.call(data, key) ? data[key] : null;
        },
        setItem(key, value) {
            data[key] = String(value);
        },
        removeItem(key) {
            delete data[key];
        },
    };
}

describe('username sync', () => {
    it('reads Motoko #err text', () => {
        expect(usernameResultError({ err: 'Username already taken' })).toBe('Username already taken');
        expect(usernameResultError({ ok: null })).toBeNull();
    });

    it('keeps the previous name when setUsername returns #err', async () => {
        const storage = memoryStorage({ username: 'oldname', usernameSynced: 'oldname' });
        const user = { name: 'oldname', setUserName(name) { this.name = name; } };
        const actor = { setUsername: vi.fn(async () => ({ err: 'Username already taken' })) };

        const outcome = await applyUsername('taken', { actor, storage, user });

        expect(outcome).toEqual({ ok: false, message: 'Username already taken' });
        expect(storage.getItem('username')).toBe('oldname');
        expect(user.name).toBe('oldname');
        expect(actor.setUsername).toHaveBeenCalledWith('taken');
    });

    it('stores a name locally when no node actor exists yet', async () => {
        const storage = memoryStorage();
        const user = { name: '', setUserName(name) { this.name = name; } };

        const outcome = await applyUsername('ada', { actor: null, storage, user });

        expect(outcome.ok).toBe(true);
        expect(storage.getItem('username')).toBe('ada');
        expect(storage.getItem('usernameSynced')).toBeNull();
        expect(user.name).toBe('ada');
    });

    it('writes the stored name once when the node has no username yet', async () => {
        const storage = memoryStorage({ username: 'ada' });
        const actor = {
            getUsername: vi.fn(async () => []),
            setUsername: vi.fn(async () => ({ ok: null })),
        };
        const notify = vi.fn();

        await syncPendingUsername({ actor, storage, notify });
        await syncPendingUsername({ actor, storage, notify });

        expect(actor.setUsername).toHaveBeenCalledTimes(1);
        expect(actor.setUsername).toHaveBeenCalledWith('ada');
        expect(storage.getItem('usernameSynced')).toBe('ada');
        expect(notify).not.toHaveBeenCalled();
    });

    it('reports #err from the one-time save and does not mark the name synced', async () => {
        const storage = memoryStorage({ username: 'ada' });
        const actor = {
            getUsername: vi.fn(async () => []),
            setUsername: vi.fn(async () => ({ err: 'Username already taken' })),
        };
        const notify = vi.fn();

        await syncPendingUsername({ actor, storage, notify });

        expect(notify).toHaveBeenCalledWith('Username already taken');
        expect(storage.getItem('usernameSynced')).toBeNull();
        expect(storage.getItem('username')).toBe('ada');
    });

    it('does not call setUsername again when the node already has that name', async () => {
        const storage = memoryStorage({ username: 'ada' });
        const actor = {
            getUsername: vi.fn(async () => ['ada']),
            setUsername: vi.fn(),
        };

        await syncPendingUsername({ actor, storage, notify: vi.fn() });

        expect(actor.setUsername).not.toHaveBeenCalled();
        expect(storage.getItem('usernameSynced')).toBe('ada');
    });
});
