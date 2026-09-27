import { showTab } from './tabs.js';

export const TREEHOUSE_SETTINGS_TAB_ID = 'node-config-tab';

/** Open settings for the user's own TreeHouse. */
export function openTreehouseSettings() {
    showTab(TREEHOUSE_SETTINGS_TAB_ID);
}

export function initTreehouseSettings() {
    const button = document.getElementById('node-config-btn');
    if (!button) return;
    button.addEventListener('click', () => {
        openTreehouseSettings();
    });
}
