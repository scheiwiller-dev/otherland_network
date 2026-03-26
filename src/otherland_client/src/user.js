import { AuthClient } from "@dfinity/auth-client";
import { AnonymousIdentity } from "@dfinity/agent";
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
                        nodeSettings.nodeId = nodeSettings.userOwnedNodes[0];   // your own canister
                        nodeSettings.nodeType = 0;                              // or whatever your default is
                        nodeSettings.displayNodeConfig?.();                     // optional
                        console.log("Node initialized after II login");
                    }
                } catch (e) {
                    console.warn("Could not auto-select node after login", e);
                }

                await setupUsername();
                await updateFriendsList();
                handleInvitation();
                //location.reload();
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

async function setupUsername() {
    const actor = await getUserNodeActor();
    const currentUsername = await actor.getUsername();
    if (!currentUsername[0]) {
        const username = prompt('Please enter your username:');
        if (username) {
            await actor.setUsername(username);
            localStorage.setItem('username', username);
        }
    } else {
        localStorage.setItem('username', currentUsername[0]);
    }
}