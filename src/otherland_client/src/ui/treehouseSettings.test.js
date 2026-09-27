import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./tabs.js', () => ({ showTab: vi.fn() }));

import { showTab } from './tabs.js';
import { initTreehouseSettings, openTreehouseSettings, TREEHOUSE_SETTINGS_TAB_ID } from './treehouseSettings.js';

describe('treehouse settings', () => {
    beforeEach(() => {
        showTab.mockClear();
    });

    it('opens the treehouse settings tab', () => {
        openTreehouseSettings();
        expect(showTab).toHaveBeenCalledWith(TREEHOUSE_SETTINGS_TAB_ID);
    });

    it('opens from the settings button', () => {
        const listeners = [];
        globalThis.document = {
            getElementById(id) {
                if (id !== 'node-config-btn') return null;
                return {
                    addEventListener(type, fn) {
                        if (type === 'click') listeners.push(fn);
                    },
                };
            },
        };

        initTreehouseSettings();
        listeners[0]();

        expect(showTab).toHaveBeenCalledWith('node-config-tab');
    });
});
