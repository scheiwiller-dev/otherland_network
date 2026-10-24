import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../nodeManager.js', () => ({
    getCardinalActor: vi.fn(),
}));

vi.mock('../user.js', () => ({
    getIdentity: vi.fn(),
}));

vi.mock('./adminPanel.js', () => ({
    refreshAdminAccess: vi.fn(async () => {}),
}));

import { getCardinalActor } from '../nodeManager.js';
import { getIdentity } from '../user.js';
import { refreshAdminAccess } from './adminPanel.js';
import { ADMIN_CLAIM_TEXT } from './adminClaim.js';
import {
    initAdminClaimDialog,
    openAdminClaimFromProfile,
    promptAdminClaim,
    refreshAdminClaimEntry,
} from './adminClaimDialog.js';

function element(id) {
    const listeners = {};
    const classes = new Set(id === 'admin-claim-modal' || id === 'claim-admin-row' || id === 'admin-claim-retry'
        ? ['hidden']
        : []);
    const node = {
        id,
        textContent: '',
        value: '',
        disabled: false,
        dataset: {},
        classList: {
            add(...names) { names.forEach((name) => classes.add(name)); },
            remove(...names) { names.forEach((name) => classes.delete(name)); },
            contains(name) { return classes.has(name); },
            toggle(name, force) {
                const on = force === undefined ? !classes.has(name) : Boolean(force);
                if (on) classes.add(name);
                else classes.delete(name);
                return on;
            },
        },
        addEventListener(type, fn) {
            (listeners[type] ||= []).push(fn);
        },
        focus: vi.fn(),
        click(event) {
            return Promise.all((listeners.click || []).map((fn) => fn({ type: 'click', target: node, ...event })));
        },
        keydown(event) {
            return Promise.all((listeners.keydown || []).map((fn) => fn(event)));
        },
    };
    return node;
}

function installDocument() {
    const ids = [
        'admin-claim-modal',
        'admin-claim-title',
        'admin-claim-message',
        'admin-claim-principal-label',
        'admin-claim-principal',
        'admin-claim-token',
        'admin-claim-feedback',
        'admin-claim-submit',
        'admin-claim-retry',
        'admin-claim-dismiss',
        'claim-admin-row',
        'claim-admin-status',
        'claim-admin-btn',
    ];
    const nodes = Object.fromEntries(ids.map((id) => [id, element(id)]));
    const listeners = {};
    globalThis.document = {
        getElementById(id) { return nodes[id] || null; },
        addEventListener(type, fn) { (listeners[type] ||= []).push(fn); },
        dispatch(type, event) {
            return Promise.all((listeners[type] || []).map((fn) => fn(event)));
        },
    };
    globalThis.window = { prompt: vi.fn(), alert: vi.fn() };
    return nodes;
}

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

describe('admin claim dialog', () => {
    let nodes;

    beforeEach(() => {
        nodes = installDocument();
        getCardinalActor.mockReset();
        getIdentity.mockReset();
        refreshAdminAccess.mockClear();
        getIdentity.mockReturnValue(identity('pid-from-ii'));
        initAdminClaimDialog();
    });

    it('shows the principal in the page and does not call window.prompt', async () => {
        const pending = promptAdminClaim({
            principal: 'pid-from-ii',
            status: { reachable: true, configured: false, actor: { claimAdmin: vi.fn() } },
        });
        expect(nodes['admin-claim-modal'].classList.contains('hidden')).toBe(false);
        expect(nodes['admin-claim-principal'].textContent).toBe('pid-from-ii');
        expect(nodes['admin-claim-message'].textContent).toBe(ADMIN_CLAIM_TEXT.offer);
        expect(window.prompt).not.toHaveBeenCalled();
        expect(window.alert).not.toHaveBeenCalled();
        await nodes['admin-claim-dismiss'].click();
        await expect(pending).resolves.toBe(false);
    });

    it('shows an empty-token error without calling Cardinal', async () => {
        const actor = { claimAdmin: vi.fn() };
        const pending = promptAdminClaim({
            principal: 'pid-from-ii',
            status: { reachable: true, configured: false, actor },
        });
        nodes['admin-claim-token'].value = '   ';
        await nodes['admin-claim-submit'].click();
        expect(actor.claimAdmin).not.toHaveBeenCalled();
        expect(nodes['admin-claim-feedback'].textContent).toBe(ADMIN_CLAIM_TEXT.empty);
        expect(nodes['admin-claim-feedback'].dataset.kind).toBe('err');
        await nodes['admin-claim-dismiss'].click();
        await pending;
    });

    it('claims with the trimmed token and reports success', async () => {
        const actor = { claimAdmin: vi.fn(async () => ({ ok: null })) };
        const pending = promptAdminClaim({
            principal: 'pid-from-ii',
            status: { reachable: true, configured: false, actor },
        });
        nodes['admin-claim-token'].value = '  setup-token  ';
        await nodes['admin-claim-submit'].click();
        expect(actor.claimAdmin).toHaveBeenCalledWith('setup-token');
        expect(nodes['admin-claim-message'].textContent).toBe(ADMIN_CLAIM_TEXT.success);
        expect(nodes['admin-claim-title'].textContent).toBe('Admin claimed');
        expect(refreshAdminAccess).toHaveBeenCalled();
        expect(nodes['claim-admin-row'].classList.contains('hidden')).toBe(true);
        await nodes['admin-claim-dismiss'].click();
        await expect(pending).resolves.toBe(true);
        expect(window.alert).not.toHaveBeenCalled();
    });

    it('shows a wrong token and an already-claimed result in the dialog', async () => {
        const actor = {
            claimAdmin: vi.fn()
                .mockResolvedValueOnce({ err: 'Invalid setup token' })
                .mockResolvedValueOnce({ err: 'Admin has already been claimed' }),
        };
        const pending = promptAdminClaim({
            principal: 'pid-from-ii',
            status: { reachable: true, configured: false, actor },
        });
        nodes['admin-claim-token'].value = 'wrong';
        await nodes['admin-claim-submit'].click();
        expect(nodes['admin-claim-feedback'].textContent).toBe('Invalid setup token');
        expect(nodes['admin-claim-modal'].classList.contains('hidden')).toBe(false);

        nodes['admin-claim-token'].value = 'late';
        await nodes['admin-claim-submit'].click();
        expect(nodes['admin-claim-message'].textContent).toBe('Admin has already been claimed');
        expect(nodes['admin-claim-token'].classList.contains('hidden')).toBe(true);
        expect(nodes['claim-admin-row'].classList.contains('hidden')).toBe(true);
        await nodes['admin-claim-dismiss'].click();
        await expect(pending).resolves.toBe(false);
    });

    it('explains when Cardinal is unreachable and can retry into the form', async () => {
        const actor = {
            isAdminConfigured: vi.fn(async () => false),
            claimAdmin: vi.fn(),
        };
        getCardinalActor.mockResolvedValue(actor);
        const pending = promptAdminClaim({
            principal: 'pid-from-ii',
            status: { reachable: false, configured: false, actor: null },
        });
        expect(nodes['admin-claim-message'].textContent).toBe(ADMIN_CLAIM_TEXT.unreachable);
        expect(nodes['admin-claim-submit'].classList.contains('hidden')).toBe(true);
        expect(nodes['admin-claim-retry'].classList.contains('hidden')).toBe(false);

        await nodes['admin-claim-retry'].click();
        expect(nodes['admin-claim-submit'].classList.contains('hidden')).toBe(false);
        expect(nodes['admin-claim-message'].textContent).toBe(ADMIN_CLAIM_TEXT.offer);
        await nodes['admin-claim-dismiss'].click();
        await pending;
    });

    it('keeps the profile entry hidden for guests and shows it only while no admin exists', async () => {
        getIdentity.mockReturnValue(identity('2vxsx-fae', true));
        await refreshAdminClaimEntry();
        expect(getCardinalActor).not.toHaveBeenCalled();
        expect(nodes['claim-admin-row'].classList.contains('hidden')).toBe(true);

        getIdentity.mockReturnValue(identity('pid-from-ii', false));
        getCardinalActor.mockResolvedValue({ isAdminConfigured: async () => false });
        await refreshAdminClaimEntry();
        expect(nodes['claim-admin-row'].classList.contains('hidden')).toBe(false);
        expect(nodes['claim-admin-status'].textContent).toBe(ADMIN_CLAIM_TEXT.rowOffer);

        getCardinalActor.mockResolvedValue({ isAdminConfigured: async () => true });
        await refreshAdminClaimEntry();
        expect(nodes['claim-admin-row'].classList.contains('hidden')).toBe(true);
    });

    it('opens the same dialog from the profile button', async () => {
        const actor = {
            isAdminConfigured: async () => false,
            claimAdmin: vi.fn(async () => ({ ok: null })),
        };
        getCardinalActor.mockResolvedValue(actor);
        const pending = nodes['claim-admin-btn'].click();
        await vi.waitFor(() => {
            expect(nodes['admin-claim-modal'].classList.contains('hidden')).toBe(false);
        });
        expect(nodes['admin-claim-principal'].textContent).toBe('pid-from-ii');
        expect(window.prompt).not.toHaveBeenCalled();
        nodes['admin-claim-token'].value = 'from-profile';
        await nodes['admin-claim-submit'].click();
        await nodes['admin-claim-dismiss'].click();
        await pending;
        expect(actor.claimAdmin).toHaveBeenCalledWith('from-profile');
    });

    it('does not open the dialog from profile once an admin exists', async () => {
        getCardinalActor.mockResolvedValue({ isAdminConfigured: async () => true });
        await expect(openAdminClaimFromProfile()).resolves.toBe(false);
        expect(nodes['admin-claim-modal'].classList.contains('hidden')).toBe(true);
        expect(nodes['claim-admin-row'].classList.contains('hidden')).toBe(true);
    });
});
