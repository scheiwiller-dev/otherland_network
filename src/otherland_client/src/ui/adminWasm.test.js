import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../nodeManager.js', () => ({
    getCardinalActor: vi.fn(),
}));

vi.mock('../user.js', () => ({
    getIdentity: vi.fn(),
}));

vi.mock('../networkStatus.js', () => ({
    reportCardinalUnavailable: vi.fn(),
}));

vi.mock('./adminClaimDialog.js', () => ({
    initAdminClaimDialog: vi.fn(),
    promptAdminClaim: vi.fn(),
    refreshAdminClaimEntry: vi.fn(async () => {}),
}));

import { getCardinalActor } from '../nodeManager.js';
import { getIdentity } from '../user.js';
import { reportCardinalUnavailable } from '../networkStatus.js';
import { promptAdminClaim } from './adminClaimDialog.js';
import { claimAdminIfNeeded } from './adminWasm.js';

function identity(text, anonymous = false) {
    return {
        getPrincipal() {
            return {
                isAnonymous: () => anonymous,
                toText: () => text,
            };
        },
    };
}

describe('claimAdminIfNeeded', () => {
    beforeEach(() => {
        getCardinalActor.mockReset();
        getIdentity.mockReset();
        promptAdminClaim.mockReset();
        reportCardinalUnavailable.mockReset();
        globalThis.window = { prompt: vi.fn(), alert: vi.fn() };
    });

    it('does not prompt a guest or call Cardinal', async () => {
        getIdentity.mockReturnValue(identity('2vxsx-fae', true));
        await expect(claimAdminIfNeeded()).resolves.toBe(false);
        expect(getCardinalActor).not.toHaveBeenCalled();
        expect(promptAdminClaim).not.toHaveBeenCalled();
        expect(window.prompt).not.toHaveBeenCalled();
    });

    it('skips the dialog when an admin already exists', async () => {
        getIdentity.mockReturnValue(identity('pid-from-ii'));
        getCardinalActor.mockResolvedValue({ isAdminConfigured: async () => true });
        await expect(claimAdminIfNeeded()).resolves.toBe(true);
        expect(promptAdminClaim).not.toHaveBeenCalled();
        expect(window.prompt).not.toHaveBeenCalled();
    });

    it('opens the in-app dialog when Cardinal has no admin', async () => {
        getIdentity.mockReturnValue(identity('pid-from-ii'));
        const actor = { isAdminConfigured: async () => false };
        getCardinalActor.mockResolvedValue(actor);
        promptAdminClaim.mockResolvedValue(true);
        await expect(claimAdminIfNeeded()).resolves.toBe(true);
        expect(promptAdminClaim).toHaveBeenCalledWith({
            principal: 'pid-from-ii',
            status: expect.objectContaining({ reachable: true, configured: false, actor }),
        });
        expect(window.prompt).not.toHaveBeenCalled();
    });

    it('opens the unreachable dialog when the admin check fails', async () => {
        getIdentity.mockReturnValue(identity('pid-from-ii'));
        getCardinalActor.mockRejectedValue(new Error('network down'));
        promptAdminClaim.mockResolvedValue(false);
        await expect(claimAdminIfNeeded()).resolves.toBe(false);
        expect(promptAdminClaim).toHaveBeenCalledWith({
            principal: 'pid-from-ii',
            status: { reachable: false, configured: false, actor: null },
        });
        expect(reportCardinalUnavailable).toHaveBeenCalled();
        expect(window.prompt).not.toHaveBeenCalled();
        expect(window.alert).not.toHaveBeenCalled();
    });
});
