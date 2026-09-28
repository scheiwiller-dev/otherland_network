import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../nodeManager.js', () => ({ refreshNodeList: vi.fn() }));
vi.mock('../friends.js', () => ({ updateFriendsList: vi.fn() }));
vi.mock('../user.js', () => ({ updateProfileDisplay: vi.fn() }));
vi.mock('../library.js', () => ({ loadLibraryObjects: vi.fn() }));
vi.mock('./adminPanel.js', () => ({ refreshCardinalCycles: vi.fn() }));

vi.hoisted(() => {
    globalThis.document = {
        querySelectorAll() {
            return [];
        },
    };
});

import { showTab } from './tabs.js';
import { refreshNodeList } from '../nodeManager.js';
import { updateFriendsList } from '../friends.js';

describe('showTab network refresh', () => {
    beforeEach(() => {
        refreshNodeList.mockClear();
        updateFriendsList.mockClear();
    });

    it('loads nodes when the network tab is opened', () => {
        showTab('otherland-tab');
        expect(refreshNodeList).toHaveBeenCalledOnce();
        expect(updateFriendsList).toHaveBeenCalledOnce();
    });

    it('can show the TreeHouse menu without contacting Cardinal', () => {
        showTab('otherland-tab', { refreshNetwork: false });
        expect(refreshNodeList).not.toHaveBeenCalled();
        expect(updateFriendsList).not.toHaveBeenCalled();
    });
});
