import { refreshNodeList } from '../nodeManager.js';
import { updateFriendsList } from '../friends.js';
import { updateProfileDisplay } from '../user.js';
import { loadLibraryObjects } from '../library.js';
import { refreshCardinalCycles } from './adminPanel.js';

const tabs = document.querySelectorAll('.tab');

/**
 * Show a main-menu tab and refresh tab-specific data.
 * Pass `{ refreshNetwork: false }` to show TreeHouse controls without contacting Cardinal.
 */
export function showTab(tabId, options = {}) {
    const refreshNetwork = options.refreshNetwork !== false;
    tabs.forEach(tab => {
        tab.style.display = tab.id === tabId ? 'block' : 'none';
    });
    switch (tabId) {
        case 'otherland-tab':
            if (refreshNetwork) {
                refreshNodeList();
                updateFriendsList();
            }
            break;
        case 'profile-tab':
            updateProfileDisplay();
            updateFriendsList();
            break;
        case 'library-tab':
            loadLibraryObjects();
            break;
        case 'admin-tab':
            refreshCardinalCycles();
            break;
    }
}

/** Wire sidebar buttons to tab switching. */
export function initTabs() {
    const menuButtons = document.querySelectorAll('#side-bar-buttons button');
    menuButtons.forEach(button => {
        button.addEventListener('click', () => {
            if (button.classList.contains('future-update') || button.disabled) return;
            const tabId = button.id.replace('-btn', '-tab');
            showTab(tabId);
        });
    });
}
