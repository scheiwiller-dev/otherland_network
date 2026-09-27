import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Principal } from '@icp-sdk/core/principal';

const nodeId = 'aaaaa-aa';
const userId = '2vxsx-fae';
const friendPrincipal = Principal.selfAuthenticating(new Uint8Array(32).fill(7));
const friendId = friendPrincipal.toText();

vi.mock('../khet.js', () => ({
    khetController: { khets: {}, clearKhet: vi.fn(), getKhet: vi.fn() },
    clearAllKhets: vi.fn(),
    updateKhetTable: vi.fn(),
    changekhetEditorDrawer: vi.fn(),
    saveToCache: vi.fn(),
    currentEditingKhetId: null,
    clearCurrentEditingKhetId: vi.fn(),
}));

vi.mock('../nodeManager.js', () => ({
    nodeSettings: { nodeId: 'aaaaa-aa', nodeType: 2 },
    getCardinalActor: vi.fn(),
}));

vi.mock('../user.js', () => ({
    user: { getUserPrincipal: () => '2vxsx-fae' },
}));

vi.mock('./tabs.js', () => ({ showTab: vi.fn() }));

import { initNodeAssets } from './nodeAssets.js';
import { getCardinalActor, nodeSettings } from '../nodeManager.js';

function createElement(tag) {
    const listeners = {};
    let checked = false;
    const element = {
        tag,
        id: '',
        disabled: false,
        textContent: '',
        value: '',
        style: { display: '' },
        children: [],
        _html: '',
        classList: { add() {}, remove() {} },
        addEventListener(type, fn) {
            (listeners[type] ||= []).push(fn);
        },
        appendChild(child) {
            this.children.push(child);
            return child;
        },
        click() {
            return Promise.all((listeners.click || []).map((fn) => fn({ type: 'click', target: element })));
        },
    };
    Object.defineProperty(element, 'innerHTML', {
        get() { return this._html; },
        set(value) {
            this._html = value;
            this.children = [];
        },
    });
    Object.defineProperty(element, 'checked', {
        get() { return checked; },
        set(value) {
            const next = Boolean(value);
            if (next === checked) return;
            checked = next;
            (listeners.change || []).forEach((fn) => fn({ type: 'change', target: element }));
        },
    });
    return element;
}

function installDom() {
    const elements = {};
    const ids = [
        'node-settings-btn',
        'public-toggle',
        'allowed-users-list',
        'friends-dropdown',
        'add-friend-access-btn',
    ];
    for (const id of ids) {
        const element = createElement(id === 'allowed-users-list' ? 'ul' : 'div');
        element.id = id;
        elements[id] = element;
    }
    globalThis.document = {
        getElementById(id) { return elements[id] || null; },
        createElement,
    };
    return elements;
}

async function flush() {
    for (let i = 0; i < 20; i++) await Promise.resolve();
}

describe('node settings access', () => {
    let elements;
    let actor;
    let isPublic;

    beforeEach(() => {
        elements = installDom();
        globalThis.alert = vi.fn();
        isPublic = false;
        nodeSettings.nodeId = nodeId;
        nodeSettings.nodeType = 2;
        actor = {
            addAllowed: vi.fn(async () => ({ ok: null })),
            addAllowedUser: vi.fn(async () => ({ ok: null })),
            removeAllowed: vi.fn(async () => ({ ok: null })),
            setNodeVisibility: vi.fn(async (next) => { isPublic = next; }),
            getNodeVisibility: vi.fn(async () => [isPublic]),
            getAllowedUsers: vi.fn(async () => [Principal.fromText(userId), friendPrincipal]),
            getFriends: vi.fn(async () => [friendPrincipal]),
        };
        getCardinalActor.mockReset();
        getCardinalActor.mockResolvedValue(actor);
        initNodeAssets();
    });

    async function openSettings() {
        await elements['node-settings-btn'].click();
    }

    function removeButton() {
        const row = elements['allowed-users-list'].children.find((li) => li.textContent === friendId);
        return row.children[0];
    }

    async function reloadsAfter(run) {
        const before = actor.getAllowedUsers.mock.calls.length;
        await run();
        await flush();
        return actor.getAllowedUsers.mock.calls.length - before;
    }

    it('adds the selected friend with addAllowedUser and reloads the list', async () => {
        await openSettings();
        elements['friends-dropdown'].value = friendId;

        const reloads = await reloadsAfter(() => elements['add-friend-access-btn'].click());

        expect(actor.addAllowed).not.toHaveBeenCalled();
        expect(actor.addAllowedUser).toHaveBeenCalledTimes(1);
        const [nodeArg, userArg] = actor.addAllowedUser.mock.calls[0];
        expect(nodeArg.toText()).toBe(nodeId);
        expect(userArg.toText()).toBe(friendId);
        expect(reloads).toBe(1);
        expect(globalThis.alert).not.toHaveBeenCalled();
    });

    it('shows addAllowedUser #err and does not reload', async () => {
        actor.addAllowedUser.mockResolvedValue({ err: 'Not the owner of this node' });
        await openSettings();
        elements['friends-dropdown'].value = friendId;

        const reloads = await reloadsAfter(() => elements['add-friend-access-btn'].click());

        expect(globalThis.alert).toHaveBeenCalledWith('Error: Not the owner of this node');
        expect(reloads).toBe(0);
    });

    it('shows an error when no node is connected', async () => {
        nodeSettings.nodeId = null;
        elements['friends-dropdown'].value = friendId;

        await elements['add-friend-access-btn'].click();

        expect(globalThis.alert).toHaveBeenCalledWith('Error: Not connected to a node');
        expect(actor.addAllowedUser).not.toHaveBeenCalled();
    });

    it('shows removeAllowed #err and does not reload', async () => {
        actor.removeAllowed.mockResolvedValue({ err: 'No canister found for this user.' });
        await openSettings();

        const reloads = await reloadsAfter(() => removeButton().click());

        expect(actor.removeAllowed).toHaveBeenCalledTimes(1);
        expect(actor.removeAllowed.mock.calls[0][0].toText()).toBe(friendId);
        expect(globalThis.alert).toHaveBeenCalledWith('Error: No canister found for this user.');
        expect(reloads).toBe(0);
    });

    it('reloads the allow-list after a successful remove', async () => {
        await openSettings();

        const reloads = await reloadsAfter(() => removeButton().click());

        expect(actor.removeAllowed).toHaveBeenCalledTimes(1);
        expect(reloads).toBe(1);
        expect(globalThis.alert).not.toHaveBeenCalled();
    });

    it('shows a public-toggle #err, restores the checkbox, and does not reload', async () => {
        actor.setNodeVisibility.mockResolvedValue({ err: 'No canister found for this user.' });
        await openSettings();

        const reloads = await reloadsAfter(() => {
            elements['public-toggle'].checked = true;
        });

        expect(actor.setNodeVisibility).toHaveBeenCalledTimes(1);
        expect(actor.setNodeVisibility).toHaveBeenCalledWith(true);
        expect(elements['public-toggle'].checked).toBe(false);
        expect(globalThis.alert).toHaveBeenCalledWith('Error: No canister found for this user.');
        expect(reloads).toBe(0);
    });

    it('updates visibility and reloads after a successful public toggle', async () => {
        await openSettings();

        const reloads = await reloadsAfter(() => {
            elements['public-toggle'].checked = true;
        });

        expect(actor.setNodeVisibility).toHaveBeenCalledWith(true);
        expect(elements['public-toggle'].checked).toBe(true);
        expect(reloads).toBe(1);
        expect(globalThis.alert).not.toHaveBeenCalled();
    });

    it('shows a thrown visibility error and restores the checkbox', async () => {
        actor.setNodeVisibility.mockRejectedValue(new Error('network down'));
        await openSettings();

        const reloads = await reloadsAfter(() => {
            elements['public-toggle'].checked = true;
        });

        expect(globalThis.alert).toHaveBeenCalledWith('Error: network down');
        expect(elements['public-toggle'].checked).toBe(false);
        expect(reloads).toBe(0);
    });
});
