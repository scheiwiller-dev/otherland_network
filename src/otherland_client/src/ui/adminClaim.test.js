import { afterEach, describe, expect, it, vi } from 'vitest';
import {
    ADMIN_CLAIM_TEXT,
    adminClaimVisibility,
    loadAdminClaimStatus,
    submitAdminClaim,
} from './adminClaim.js';

describe('admin claim visibility', () => {
    it('stays hidden for guests and after an admin exists', () => {
        expect(adminClaimVisibility({
            anonymous: true,
            reachable: true,
            configured: false,
        })).toBe('hidden');
        expect(adminClaimVisibility({
            anonymous: false,
            reachable: true,
            configured: true,
        })).toBe('hidden');
    });

    it('offers a claim only when Cardinal reports no admin', () => {
        expect(adminClaimVisibility({
            anonymous: false,
            reachable: true,
            configured: false,
        })).toBe('offer');
    });

    it('keeps a retry when Cardinal cannot be reached', () => {
        expect(adminClaimVisibility({
            anonymous: false,
            reachable: false,
            configured: false,
        })).toBe('retry');
    });
});

describe('loadAdminClaimStatus', () => {
    afterEach(() => {
        vi.useRealTimers();
    });

    it('reports the actor when Cardinal answers', async () => {
        const actor = { isAdminConfigured: async () => false };
        await expect(loadAdminClaimStatus(async () => actor)).resolves.toEqual({
            reachable: true,
            configured: false,
            actor,
        });
    });

    it('treats a throw as unreachable rather than configured', async () => {
        await expect(loadAdminClaimStatus(() => Promise.reject(new Error('down')))).resolves.toEqual({
            reachable: false,
            configured: false,
            actor: null,
        });
    });

    it('does not treat a timeout as an existing admin', async () => {
        vi.useFakeTimers();
        const pending = loadAdminClaimStatus(() => new Promise(() => {}), 8000);
        await vi.advanceTimersByTimeAsync(8000);
        await expect(pending).resolves.toEqual({
            reachable: false,
            configured: false,
            actor: null,
        });
    });
});

describe('submitAdminClaim', () => {
    it('does not call the canister for an empty token', async () => {
        const actor = { claimAdmin: vi.fn() };
        const outcome = await submitAdminClaim(actor, '   ');
        expect(outcome).toEqual({ ok: false, code: 'empty', message: ADMIN_CLAIM_TEXT.empty });
        expect(actor.claimAdmin).not.toHaveBeenCalled();
    });

    it('trims the token and maps canister results', async () => {
        const actor = { claimAdmin: vi.fn(async () => ({ ok: null })) };
        const outcome = await submitAdminClaim(actor, '  abc123  ');
        expect(actor.claimAdmin).toHaveBeenCalledWith('abc123');
        expect(outcome).toEqual({ ok: true, code: 'claimed', message: ADMIN_CLAIM_TEXT.success });
    });

    it('keeps the canister wording for a wrong or used token', async () => {
        const invalid = { claimAdmin: async () => ({ err: 'Invalid setup token' }) };
        const claimed = { claimAdmin: async () => ({ err: 'Admin has already been claimed' }) };
        const notReady = {
            claimAdmin: async () => ({
                err: 'Setup token is not ready yet. Read `icp canister logs cardinal` and try again.',
            }),
        };

        await expect(submitAdminClaim(invalid, 'nope')).resolves.toMatchObject({
            ok: false,
            code: 'invalid',
            message: 'Invalid setup token',
        });
        await expect(submitAdminClaim(claimed, 'nope')).resolves.toMatchObject({
            ok: false,
            code: 'already-claimed',
            message: 'Admin has already been claimed',
        });
        await expect(submitAdminClaim(notReady, 'nope')).resolves.toMatchObject({
            ok: false,
            code: 'not-ready',
        });
    });

    it('reports Cardinal unreachable when the call throws', async () => {
        const actor = { claimAdmin: async () => { throw new Error('offline'); } };
        await expect(submitAdminClaim(actor, 'token')).resolves.toEqual({
            ok: false,
            code: 'unreachable',
            message: ADMIN_CLAIM_TEXT.unreachable,
        });
        await expect(submitAdminClaim(null, 'token')).resolves.toMatchObject({ code: 'unreachable' });
    });
});
