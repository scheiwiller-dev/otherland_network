import { initAuth, getIdentity, login, user, updateAccountSwitcher } from '../user.js';
import { updateFriendsList, handleInvitation } from '../friends.js';
import { getUserNodeActor, nodeSettings, refreshNodeList } from '../nodeManager.js';
import { applyUsername } from '../usernameSync.js';
import { online } from '../peermesh.js';
import { viewerState } from '../index.js';
import { showTab } from './tabs.js';
import { refreshAdminAccess } from './adminPanel.js';
import { enterWorld } from './treehouseControls.js';
import {
    initWalkPrompt,
    markTreehouseOpening,
    shouldAutoEnterTreehouse,
    shouldShowWalkPrompt,
    showWalkPrompt,
} from './guestEntry.js';

const startScreen = document.getElementById('start-screen');
const mainMenu = document.getElementById('main-menu');
const connectIIBtn = document.getElementById('connect-ii-btn');
const continueGuestBtn = document.getElementById('continue-guest-btn');

/** Show main menu after a successful login / username setup. */
export function showLoggedInUI() {
    document.getElementById('start-screen').style.display = 'none';
    document.getElementById('main-menu').style.display = 'flex';
    updateAccountSwitcher(false);
    showTab('otherland-tab');
    updateFriendsList();
    refreshAdminAccess();
    online.openPeer();
}

function initUsernameSetup() {
    const usernameScreen = document.getElementById('username-screen');
    const username = document.getElementById('username-input');
    const cancelBtn = document.getElementById('cancel-username-btn');
    const saveBtn = document.getElementById('save-username-btn');
    const errorEl = document.getElementById('username-error');

    if (saveBtn) {
        saveBtn.addEventListener('click', async () => {
            const newUsername = username.value.trim();

            if (!newUsername || newUsername.length < 3) {
                errorEl.textContent = 'Username must be at least 3 characters';
                errorEl.style.display = 'block';
                return;
            }

            try {
                const actor = await getUserNodeActor();
                const outcome = await applyUsername(newUsername, {
                    actor,
                    storage: localStorage,
                    user,
                });
                if (!outcome.ok) {
                    errorEl.textContent = outcome.message;
                    errorEl.style.display = 'block';
                    return;
                }

                console.log('Username set successfully:', newUsername);

                usernameScreen.style.display = 'none';
                showLoggedInUI();

                await updateFriendsList();
                handleInvitation();
            } catch (err) {
                console.error('Failed to save username:', err);
                errorEl.textContent = err && err.message ? err.message : 'Failed to save username. Please try again.';
                errorEl.style.display = 'block';
            }
        });
    }

    if (cancelBtn) {
        cancelBtn.addEventListener('click', async () => {
            const { abortUsernameSetup } = await import('../user.js');
            await abortUsernameSetup();
        });
    }
}

/** Open the local TreeHouse without waiting on Cardinal or Internet Identity. */
async function openGuestTreehouse() {
    markTreehouseOpening();
    try {
        if (nodeSettings.nodeType !== 0 || nodeSettings.nodeId !== 'TreeHouse') {
            await nodeSettings.changeNode({ type: 0, id: 'TreeHouse' });
        }
    } catch (error) {
        console.warn('Continuing into TreeHouse without a node switch', error);
        nodeSettings.nodeType = 0;
        nodeSettings.nodeId = 'TreeHouse';
    }

    showTab('otherland-tab', { refreshNetwork: false });
    const ready = await enterWorld({ lockPointer: false });
    updateAccountSwitcher(true);

    if (!ready) {
        const lead = startScreen && startScreen.querySelector('h3');
        if (lead) lead.textContent = 'The 3D view could not start. Refresh to try TreeHouse again.';
        for (const id of ['connect-ii-btn', 'continue-guest-btn']) {
            const button = document.getElementById(id);
            if (button) button.style.display = '';
        }
        return;
    }

    if (startScreen) startScreen.style.display = 'none';
    if (mainMenu) mainMenu.style.display = 'none';
    if (shouldShowWalkPrompt()) showWalkPrompt();

    refreshNodeList();
    updateFriendsList();
}

function showGuestMenu() {
    if (startScreen) startScreen.style.display = 'none';
    if (mainMenu) mainMenu.style.display = 'flex';
    updateAccountSwitcher(true);
    showTab('otherland-tab', { refreshNetwork: false });
    refreshNodeList();
    updateFriendsList();
}

/** Auth start screen, II/guest continue, username setup, and session restore. */
export async function initAuthScreens() {
    initUsernameSetup();
    initWalkPrompt(async () => {
        const element = viewerState.controls && viewerState.controls.domElement;
        if (!element || typeof element.requestPointerLock !== 'function') {
            throw new Error('Pointer lock is unavailable');
        }
        await element.requestPointerLock();
    });

    await initAuth();
    const identity = getIdentity();

    if (shouldAutoEnterTreehouse(identity, window.location.search)) {
        await openGuestTreehouse();
    } else if (identity && !identity.getPrincipal().isAnonymous()) {
        user.setUserPrincipal(identity.getPrincipal().toText());

        const savedUsername = localStorage.getItem('username');
        if (savedUsername) {
            user.setUserName(savedUsername);
            showLoggedInUI();
        } else {
            console.log('II auth detected on refresh but no username - aborting to force username setup');
            const { abortUsernameSetup } = await import('../user.js');
            await abortUsernameSetup();
        }
    }

    if (connectIIBtn) {
        connectIIBtn.addEventListener('click', async () => {
            await login();
        });
    }

    if (continueGuestBtn) {
        continueGuestBtn.addEventListener('click', async () => {
            if (shouldAutoEnterTreehouse(getIdentity(), window.location.search)) {
                await openGuestTreehouse();
                return;
            }
            showGuestMenu();
        });
    }
}
