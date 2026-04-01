import { AuthClient } from "@icp-sdk/auth/client";
import { AnonymousIdentity } from "@icp-sdk/core/agent";
import { getUserNodeActor } from './khet.js';
import { handleInvitation, updateFriendsList } from './menu.js';
import { CANISTER_IDS } from './canisterIds.js';

// Authentication client instance and identity
let authClient;
let identity;

// Promise to track authentication readiness
export let authReady = null;

// Existing user object
export const user = {
    userPrincipal: "",
    userName: "",

    setUserPrincipal(newPrincipal) {
        this.userPrincipal = newPrincipal;
    },
    getUserPrincipal() {
        return this.userPrincipal;
    },

    setUserName(newName) {
        this.userName = newName;
    },
    getUserName() {
        return this.userName;
    }
};

// Initialize the authentication client
export async function initAuth() {
    try {
        authClient = await AuthClient.create();
        if (await authClient.isAuthenticated()) {
            identity = await authClient.getIdentity();
            user.setUserPrincipal(identity.getPrincipal().toText());
        } else {
            identity = new AnonymousIdentity();
            user.setUserPrincipal(""); // No principal for anonymous users
        }
    } catch (error) {
        console.error("Error initializing auth client:", error);
        identity = new AnonymousIdentity();
        user.setUserPrincipal("");
    }
    return identity;
}

// Start authentication immediately and store the promise
authReady = initAuth();

// Get the current identity
export function getIdentity() {
    if (!identity) {
        console.warn("Identity accessed before initAuth completed");
    }
    return identity;
}

// Trigger Internet Identity login
export async function login() {
    try {
        const isLocal = (process.env.DFX_NETWORK === 'local' || !process.env.DFX_NETWORK);
        const iiProvider = isLocal
            ? `http://${CANISTER_IDS.INTERNET_IDENTITY}.localhost:4943`
            : 'https://identity.ic0.app';

        await authClient.login({
            identityProvider: iiProvider,
            onSuccess: async () => {
                identity = await authClient.getIdentity();
                user.setUserPrincipal(identity.getPrincipal().toText());
                console.log("Logged in with principal:", user.getUserPrincipal());

                try {
                    const { getAccessibleCanisters, nodeSettings } = await import('./nodeManager.js');
                    await getAccessibleCanisters();                    // populates userOwnedNodes
                    if (nodeSettings.userOwnedNodes?.length > 0) {
                        nodeSettings.nodeId = nodeSettings.userOwnedNodes[0];
                        nodeSettings.nodeType = 0;
                        nodeSettings.displayNodeConfig?.();
                        console.log("Node initialized after II login");
                    }
                } catch (e) {
                    console.warn("Could not auto-select node after login", e);
                }

                const usernameReady = await setupUsername();

                if (usernameReady) {
                    await updateFriendsList();
                    handleInvitation();
                    
                    document.getElementById('start-screen').style.display = 'none';
                    document.getElementById('main-menu').style.display = 'block';
                    
                    // Use the unified function from menu.js (it will be available after DOMContentLoaded)
                    if (typeof showLoggedInUI === 'function') {
                        showLoggedInUI();
                    } else {
                        document.getElementById('start-screen').style.display = 'none';
                        document.getElementById('main-menu').style.display = 'block';
                        document.getElementById('info-box').style.display = 'block';
                    }
                }
                // else: username screen is shown - it will handle continuation after save
            },
            onError: (error) => {
                console.error("Login failed:", error);
            }
        });
    } catch (error) {
        console.error("Error during login:", error);
    }
}

// Logout and revert to anonymous identity
export async function logout() {
    try {
        await authClient.logout();
        identity = new AnonymousIdentity();
        user.setUserPrincipal("");
        console.log("Logged out, reverted to anonymous identity");
    } catch (error) {
        console.error("Error during logout:", error);
    }
}

// Setup username
async function setupUsername() {
    try {
        const actor = await getUserNodeActor();  // may return null for users without a node yet

        let hasUsername = false;
        let currentUsername = null;

        if (actor) {
            try {
                const result = await actor.getUsername();
                currentUsername = result && result[0] ? result[0] : null;
                hasUsername = !!currentUsername;
            } catch (e) {
                console.warn('Could not read username from actor (new user without node?):', e);
            }
        }

        if (hasUsername) {
            // Username already set → store and continue normally
            localStorage.setItem('username', currentUsername);
            user.setUserName(currentUsername);
            console.log('Username loaded:', currentUsername);
            return true;  // username ready
        } else {
            // No username yet → show the dedicated screen
            console.log('No username found - showing username setup screen');
            document.getElementById('start-screen').style.display = 'none';
            document.getElementById('username-screen').style.display = 'flex';  // use flex for centering
            return false; // username screen shown
        }
    } catch (error) {
        console.error('Error during username setup:', error);
        return false;
    }
}

// Force logout and clear session - used when user aborts username setup
export async function abortUsernameSetup() {
    try {
        if (authClient) {
            await authClient.logout();
        }
        identity = new AnonymousIdentity();
        user.setUserPrincipal("");
        user.setUserName("");
        localStorage.removeItem('username');
        console.log("Username setup aborted - session cleared, returning to start screen");
        
        // Force UI back to start screen
        document.getElementById('username-screen').style.display = 'none';
        document.getElementById('main-menu').style.display = 'none';
        document.getElementById('start-screen').style.display = 'flex';
    } catch (error) {
        console.error("Error during abort:", error);
    }
}