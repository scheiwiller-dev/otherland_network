// Import necessary components
import { Principal } from '@icp-sdk/core/principal';
import { viewerState, sceneObjects, worldController, animationMixers, khetState } from './index.js';
import { khetController, clearAllKhets, getUserNodeActor, updateKhetTable, changekhetEditorDrawer } from './khet.js';
import { nodeSettings, requestNewCanister, refreshNodeList, getAccessibleCanisters, getCardinalActor } from './nodeManager.js';
import { initAuth, getIdentity, login, user, updateAccountSwitcher, updateProfileDisplay } from './user.js';
import { chat, initChat } from './chat.js';
import { online } from './peermesh.js'
import { avatarState, populateAvatarButtons } from './avatar.js'
import { animator, isTouchDevice } from './animation.js'
import { updateFriendsList, handleInvitation } from './friends.js'
import { loadLibraryObjects, deleteLibraryObject, generateObjectId, readFileAsDataURL } from './library.js'

// Declare Variables
const startScreen = document.getElementById('start-screen');
const mainMenu = document.getElementById('main-menu');
const accountSwitcher = document.getElementById('account-switcher');
const connectIIBtn = document.getElementById('connect-ii-btn');
const continueGuestBtn = document.getElementById('continue-guest-btn');
const tabs = document.querySelectorAll('.tab');
export let userIsInWorld = false;



// Listen for changes in the pointer lock state to manage game menu visibility
document.addEventListener('pointerlockchange', () => {
    if (!document.pointerLockElement) { leaveViewer() } else { enterViewer() }
});

// Enter 3D World
function enterViewer() {
    userIsInWorld = true;
    document.getElementById('guiLayer').style.display = 'block'; // Hide the GUI layer when pointer lock is acquired
    if (isTouchDevice) { document.getElementById('mobile-controls').style.display = 'block'; } // Show the GUI layer when pointer lock is released

    // Hide Jump / Sprint Button depending on Avatar availability
    if (isTouchDevice && avatarState.selectedAvatarId !== null) {
        document.getElementById('jump-btn').style.display = 'block';
        document.getElementById('sprint-btn').style.display = 'block';
        document.getElementById('interact-btn').style.display = 'block';
    } else {
        document.getElementById('jump-btn').style.display = 'none';
        document.getElementById('sprint-btn').style.display = 'none';
        document.getElementById('interact-btn').style.display = 'none';
    }
    animator.start();                // Start animation when pointer lock is acquired
}

// Leave 3D World
function leaveViewer() {
    userIsInWorld = false;
    const gameMenu = document.getElementById('game-menu');
    gameMenu.style.display = 'flex'; // Show the game menu when pointer lock is released
    keys.clear();                    // Clear any active key presses
    const closeBtn = document.getElementById('close-btn');
    closeBtn.disabled = true;        // Disable the close button temporarily
    document.getElementById('guiLayer').style.display = 'none'; // Show the GUI layer when pointer lock is released
    if (isTouchDevice) { document.getElementById('mobile-controls').style.display = 'none'; } // Show the GUI layer when pointer lock is released
    setTimeout(() => {
        closeBtn.disabled = false;   // Re-enable the close button after 1.25 seconds
    }, 1250);
}

// Set to track currently pressed keys
export const keys = new Set();

// Handle key presses, including the Escape key to show the game menu
document.addEventListener('keydown', event => {
    if (!event || !event.key || typeof event.key !== 'string') return;

    const key = event.key.toLowerCase();
    keys.add(key); // Add pressed key to the set

    //console.log(`Key Press detected, Key >${key}<`);

    // Handle ESC key seperatly
    if (key === 'escape') {
        escButtonPress();
    }
});

// Handle ESC Button press
export function escButtonPress() {
    const mainMenu = document.getElementById('main-menu');
    const gameMenu = document.getElementById('game-menu');
    const isMainMenuVisible = mainMenu.style.display === 'flex';
    const isGameMenuVisible = gameMenu.style.display === 'flex';

    if (!isMainMenuVisible) {
        if (!isGameMenuVisible) {
            gameMenu.style.display = 'flex'; // Show the game menu if it's not visible
            if (!isTouchDevice) {
                viewerState.controls.unlock();           // Unlock the pointer controls
            } else {   
                leaveViewer();               // Leave the viewer when pointer lock is released
            }
            keys.clear();                // Clear active keys
        }
    }
}

// Handle key releases to remove keys from the set
document.addEventListener('keyup', event => {
    if (!event || !event.key || typeof event.key !== 'string') return;
    keys.delete(event.key.toLowerCase());
});

// Deactivate Context Menu
document.addEventListener('contextmenu', function(e){
    e.preventDefault();
}, false);

// Add Friend Button
const invitationLinkBtn = document.getElementById("invitationLinkBtn");
invitationLinkBtn.addEventListener('click', () => {
    document.getElementById('add-friend-row').classList.remove('hidden');
    invitationLinkBtn.classList.add('hidden');
});

// Send Friend Request Button
const sendFriendRequestBtn = document.getElementById("send-friend-request-btn");
sendFriendRequestBtn.addEventListener('click', async () => {
    const identifier = document.getElementById('friend-identifier-input').value.trim();
    if (!identifier) return;

    const actor = await getCardinalActor();
    const result = await actor.sendFriendRequest(identifier);
    if ('ok' in result) {
        alert('Friend request sent!');
        document.getElementById('friend-identifier-input').value = '';
        document.getElementById('add-friend-row').classList.add('hidden');
        invitationLinkBtn.classList.remove('hidden');
    } else {
        alert('Error: ' + result.err);
    }
});

// Cancel Add Friend Button
const cancelAddFriendBtn = document.getElementById("cancel-add-friend-btn");
cancelAddFriendBtn.addEventListener('click', () => {
    document.getElementById('friend-identifier-input').value = '';
    document.getElementById('add-friend-row').classList.add('hidden');
    invitationLinkBtn.classList.remove('hidden');
});

// Edit Username Button
const editUsernameBtn = document.getElementById("edit-username-btn");
editUsernameBtn.addEventListener('click', () => {
    document.getElementById('edit-username-row').classList.remove('hidden');
    document.getElementById('edit-username-input').value = user.getUserName() || '';
    document.getElementById('edit-username-input').focus();
});

// Save Edit Username Button
const saveEditUsernameBtn = document.getElementById("save-edit-username-btn");
saveEditUsernameBtn.addEventListener('click', async () => {
    const newUsername = document.getElementById('edit-username-input').value.trim();
    const errorEl = document.getElementById('edit-username-error');

    if (!newUsername || newUsername.length < 3) {
        errorEl.textContent = 'Username must be at least 3 characters';
        errorEl.classList.remove('hidden');
        return;
    }

    try {
        const actor = await getUserNodeActor();
        if (actor) {
            await actor.setUsername(newUsername);
        }

        localStorage.setItem('username', newUsername);
        user.setUserName(newUsername);

        console.log('Username updated successfully:', newUsername);

        document.getElementById('edit-username-row').classList.add('hidden');
        updateProfileDisplay();
        updateAccountSwitcher(false); // Update the info box with new username

    } catch (err) {
        console.error('Failed to update username:', err);
        errorEl.textContent = 'Failed to update username. Please try again.';
        errorEl.classList.remove('hidden');
    }
});

// Cancel Edit Username Button
const cancelEditUsernameBtn = document.getElementById("cancel-edit-username-btn");
cancelEditUsernameBtn.addEventListener('click', () => {
    document.getElementById('edit-username-row').classList.add('hidden');
    document.getElementById('edit-username-error').classList.add('hidden');
});

// Copy Username Button
const copyUsernameBtn = document.getElementById("copy-username-btn");
copyUsernameBtn.addEventListener('click', async () => {
    const username = document.getElementById('username-display').textContent;
    if (username && username !== 'Not set') {
        try {
            await navigator.clipboard.writeText(username);
            // Visual feedback
            const originalText = copyUsernameBtn.textContent;
            copyUsernameBtn.textContent = '✓';
            copyUsernameBtn.style.color = '#35bd00';
            setTimeout(() => {
                copyUsernameBtn.textContent = originalText;
                copyUsernameBtn.style.color = '';
            }, 1000);
        } catch (err) {
            console.error('Failed to copy username:', err);
            alert('Failed to copy username to clipboard');
        }
    }
});

// Copy Principal Button
const copyPrincipalBtn = document.getElementById("copy-principal-btn");
copyPrincipalBtn.addEventListener('click', async () => {
    const principal = document.getElementById('principal-display').textContent;
    if (principal && principal !== 'Not logged in') {
        try {
            await navigator.clipboard.writeText(principal);
            // Visual feedback
            const originalText = copyPrincipalBtn.textContent;
            copyPrincipalBtn.textContent = '✓';
            copyPrincipalBtn.style.color = '#35bd00';
            setTimeout(() => {
                copyPrincipalBtn.textContent = originalText;
                copyPrincipalBtn.style.color = '';
            }, 1000);
        } catch (err) {
            console.error('Failed to copy principal:', err);
            alert('Failed to copy principal to clipboard');
        }
    }
});

// Generate Invitation Link Button
const generateInviteBtn = document.getElementById('generateInviteBtn');
generateInviteBtn.addEventListener('click', async () => {
    const actor = await getCardinalActor();
    const token = await actor.generateFriendInvitation();
    const invitationLink = `${window.location.origin}/?invite=${token}`;
    document.getElementById('invitation-link').innerText = invitationLink;
});





// Add Friend to Allowed Users
document.getElementById('add-friend-access-btn').addEventListener('click', async () => {
    const friendPrincipalText = document.getElementById('friends-dropdown').value;
    if (friendPrincipalText) {
        const actor = await getCardinalActor();
        const friendPrincipal = Principal.fromText(friendPrincipalText);
        const result = await actor.addAllowedUser(Principal.fromText(nodeSettings.nodeId), friendPrincipal);
        if ('ok' in result) {
            console.log('Friend added to allowed users');
            updateNodeSettings();
        } else {
            alert('Error adding friend to allowed users: ' + result.err);
        }
    }
});

// Function to enter the 3d World
async function enterWorld() {
    // Stop animator to prevent physics stepping during scene loading
    animator.stop();

    // Define the parameters for loadScene and loadAvatarObject
    const params = { scene: viewerState.scene, world: viewerState.world, sceneObjects, animationMixers, khetState };

    // Load Scene with params and nodeSettings
    await worldController.loadScene(params, nodeSettings);

    document.getElementById('main-menu').style.display = 'none';
    const isTouchDevice = 'ontouchstart' in window;
    if (!isTouchDevice) {
        viewerState.controls.lock();      // Lock the pointer for game control
    } else {   
        enterViewer();        // Enter the viewer when pointer lock is acquired
    }
    viewerState.canvas.focus();           // Focus on the canvas for 
}



// ### Menu Navigation and UI Toggling
// Wait for the DOM to load before setting up event listeners
document.addEventListener('DOMContentLoaded', async () => {

    viewerState.init();

    // **Page Switching Function**
    // Helper function to switch between menu pages
    function showPage(page) {
        mainPage.classList.remove('active');
        settingsPage.classList.remove('active');
        avatarPage.classList.remove('active');
        page.classList.add('active'); // Activate the selected page
    }
    
    // Unified function to show logged-in state
    function showLoggedInUI() {
        document.getElementById('start-screen').style.display = 'none';
        document.getElementById('main-menu').style.display = 'block';
        updateAccountSwitcher(false); 
        showTab("otherland-tab")
    }

    // **Main Menu**
    const mainPage = document.getElementById('main-page');

    // **Otherland Tab**
    // Connect to Cardinal
    const refreshNodeListBtn = document.getElementById("refresh-node-list-btn");
    refreshNodeListBtn.addEventListener('click', async () => {
        refreshNodeList();
    });

    // Enter Node World
    const enterNodeBtn = document.getElementById("enter-node-btn");
    enterNodeBtn.addEventListener('click', async () => {

        if (nodeSettings.nodeType == 2 || nodeSettings.nodeType == 3) {
            enterWorld();
        }
    });

    // Create new user node
    const requestCanisterBtn = document.getElementById("request-new-canister");
    requestCanisterBtn.addEventListener('click', async () => {
        await requestNewCanister();
        nodeSettings.availableNodes = await getAccessibleCanisters();
        await refreshNodeList();
    });

    // Setup Username Page
    const usernameScreen = document.getElementById('username-screen');
    const username = document.getElementById('username-input');
    const cancelBtn = document.getElementById('cancel-username-btn');
    const saveBtn = document.getElementById('save-username-btn');
    const errorEl = document.getElementById('username-error');
    if (!saveBtn) return;
    saveBtn.addEventListener('click', async () => {
        const newUsername = username.value.trim();
        
        if (!newUsername || newUsername.length < 3) {
            errorEl.textContent = 'Username must be at least 3 characters';
            errorEl.style.display = 'block';
            return;
        }

        try {
            const actor = await getUserNodeActor();
            if (actor) {
                await actor.setUsername(newUsername);
            }
            
            localStorage.setItem('username', newUsername);
            user.setUserName(newUsername);
            
            console.log('Username set successfully:', newUsername);
            
            // Hide screen and show logged-in UI consistently
            usernameScreen.style.display = 'none';
            showLoggedInUI();
            
            await updateFriendsList();
            handleInvitation();
            
        } catch (err) {
            console.error('Failed to save username:', err);
            errorEl.textContent = 'Failed to save username. Please try again.';
            errorEl.style.display = 'block';
        }
    });
    if (cancelBtn) {
        cancelBtn.addEventListener('click', async () => {
            const { abortUsernameSetup } = await import('./user.js');
            await abortUsernameSetup();
        });
    }

    // Edit Node Button
    const editNodeBtn = document.getElementById('edit-node-btn');
    editNodeBtn.addEventListener('click', async () => {

        if (nodeSettings.nodeType == 2) {
            await updateKhetTable();

            document.getElementById("upload-btn").disabled = false;
            document.getElementById("cache-btn").disabled = true;
            document.getElementById("assets-title").innerHTML = "My Node > Assets";
            showTab("assets-tab")
        };
    });

    // Generate Invitation Button
    const invitationLinkBtn = document.getElementById("invitationLinkBtn");
    invitationLinkBtn.addEventListener('click', async () => {
        generateInvitation()
    })

    // **TreeHouse Tab**
    // Enter TreeHouse
    const enterTreehouseBtn = document.getElementById('enter-treehouse-btn');
    enterTreehouseBtn.addEventListener('click', async () => {

        // Switch Node Type to own TreeHouse if not already
        if (nodeSettings.nodeType !== 0) {
            await nodeSettings.changeNode({type: 0, id: "TreeHouse"});
        }
        enterWorld();
    });

    // Join QuickConnect Button
    const joinQuickConnectBtn = document.getElementById("join-quick-connect");
    joinQuickConnectBtn.addEventListener('click', async () => {
        
        // Switch Node Type
        await nodeSettings.changeNode({type: 1, id: "TreeHouse"})

        // Connect to Host
        online.openPeer();                                       // Evtl if not already exists from other source check
    })

    // Reset Peer Button
    const resetPeerBtn = document.getElementById("reset-p2p-btn");
    resetPeerBtn.addEventListener('click', async () => {
        nodeSettings.togglePeerNetworkAllowed();
    })

    // Toogle Peer Network Button
    const togglePeerButton = document.getElementById("toggle-p2p-btn");
    togglePeerButton.addEventListener('click', async () => {
        nodeSettings.togglePeerNetworkAllowed();
    })

    // Sharing Dialog
    const shareThButton = document.getElementById("share-th-link-btn");
    shareThButton.addEventListener('click', async () => {

        let thisurl = window.location.protocol + "//" + window.location.host;

        navigator.share({
            title: 'Otherland Invite',
            text: 'Come visit my TreeHouse!\u000d\u000d',
            url: (thisurl + '?canisterId=be2us-64aaa-aaaaa-qaabq-cai&peerId=' + online.ownID),
        });
    });

    // **Clear Khets Button**
    // Clear all Khets from the backend and storage canisters
    const clearBtn = document.getElementById('clear-khets-btn');
    clearBtn.addEventListener('click', async () => {
        
        if (nodeSettings.nodeType == 0) {
            await khetController.clearKhet();   // Call the function to clear Khets on treehouse
            console.log('Khets cleared from treehouse'); // Log confirmation
        } else if (nodeSettings.nodeType == 2) {
            await clearAllKhets();              // Call the function to clear Khets on backend
            console.log('Khets cleared from node'); // Log confirmation
        }
        await updateKhetTable();
    });

    // Edit TreeHouse Button
    const editTreeHouseBtn = document.getElementById('edit-treehouse-btn');
    editTreeHouseBtn.addEventListener('click', async () => {

        // Switch Node Type
        if (nodeSettings.nodeType !== 0) {
            await nodeSettings.changeNode({type: 0, id: "TreeHouse"})
        }
        
        if (nodeSettings.nodeType == 0) {
            await updateKhetTable();

            document.getElementById("upload-btn").disabled = true;
            document.getElementById("cache-btn").disabled = false;
            document.getElementById("assets-title").innerHTML = "My TreeHouse > Assets";
            showTab("assets-tab")
        };
    });

    // Discard Edit and Close
    const discardEditButton = document.getElementById("discard-edit-btn");
    discardEditButton.addEventListener('click', async () => {
        
        // Reset position and scale in  fields
        document.getElementById('pos-x').value = 0;
        document.getElementById('pos-y').value = 0;
        document.getElementById('pos-z').value = 0;
        document.getElementById('scale-x').value = 1;
        document.getElementById('scale-y').value = 1;
        document.getElementById('scale-z').value = 1;

        // Switch to Upload & Close
        changekhetEditorDrawer('close');
        document.getElementById("edit-group").style.display = "none";
        document.getElementById("upload-group").style.display = "block";

        await updateKhetTable();
    });

    // Save Edit and Close
    const saveEditButton = document.getElementById("save-edit-btn");
    saveEditButton.addEventListener('click', async () => {
        if (!currentEditingKhetId) {
            console.error('No Khet selected for editing');
            return;
        }
        const khet = khetController.getKhet(currentEditingKhetId);
        if (!khet) {
            console.error(`Khet ${currentEditingKhetId} not found`);
            return;
        }
    
        // Update position and scale from  fields
        khet.position = [
            parseFloat(document.getElementById('pos-x').value) || 0,
            parseFloat(document.getElementById('pos-y').value) || 0,
            parseFloat(document.getElementById('pos-z').value) || 0
        ];
        khet.scale = [
            parseFloat(document.getElementById('scale-x').value) || 1,
            parseFloat(document.getElementById('scale-y').value) || 1,
            parseFloat(document.getElementById('scale-z').value) || 1
        ];
    
        // Handle based on nodeType
        if (nodeSettings.nodeType == 0) {
            // Update metadata in nodeSettings.localKhets
            const khetMetadata = { ...khet };
            delete khetMetadata.gltfData; // Exclude gltfData
            nodeSettings.localKhets[khet.khetId] = khetMetadata;
            nodeSettings.saveLocalKhets();
    
            // Update full Khet in cache
            await saveToCache(khet.khetId, khet);
        } else if (nodeSettings.nodeType == 2) {
            // Existing logic for Own Node (unchanged)
        }
    
        // Update khetController.khets
        khetController.khets[khet.khetId] = khet;
    
        changekhetEditorDrawer('close');
        document.getElementById("edit-group").style.display = "none";
        document.getElementById("upload-group").style.display = "block";
        await updateKhetTable();
        currentEditingKhetId = null;
    });

    // Draw Up Button
    const drawUpButton = document.getElementById("draw-up-btn");
    drawUpButton.addEventListener('click', async () => {
        changekhetEditorDrawer('open');
    })

    // Draw Close Button
    const drawCloseButton = document.getElementById("draw-close-btn");
    drawCloseButton.addEventListener('click', async () => {
        changekhetEditorDrawer('close');
    })

    // Node Settings Button
    const nodeSettingsBtn = document.getElementById('node-settings-btn');
    nodeSettingsBtn.addEventListener('click', async () => {
        if (nodeSettings.nodeType == 2) {
            showTab("node-settings-tab");
            const actor = await getCardinalActor();
            const visibility = await actor.getNodeVisibility();
            const isPublic = visibility.length > 0 ? visibility[0] : false;
            document.getElementById('public-toggle').checked = isPublic;
            const allowedUsers = await actor.getAllowedUsers();
            const allowedList = document.getElementById('allowed-users-list');
            allowedList.innerHTML = '';
            allowedUsers.forEach(principal => {
                if (principal.toText() !== user.getUserPrincipal()) {
                    const li = document.createElement('li');
                    li.textContent = principal.toText();
                    const removeBtn = document.createElement('button');
                    removeBtn.textContent = 'Remove';
                    removeBtn.addEventListener('click', async () => {
                        await actor.removeAllowed(principal);
                        updateNodeSettings();
                    });
                    li.appendChild(removeBtn);
                    allowedList.appendChild(li);
                }
            });
            const friends = await actor.getFriends();
            const friendsDropdown = document.getElementById('friends-dropdown');
            friendsDropdown.innerHTML = '<option value="">Select a friend</option>';
            friends.forEach(friend => {
                const option = document.createElement('option');
                option.value = friend.toText();
                option.textContent = friend.toText();
                friendsDropdown.appendChild(option);
            });
        }
    });

    document.getElementById('public-toggle').addEventListener('change', async (e) => {
        const actor = await getCardinalActor();
        await actor.setNodeVisibility(e.target.checked);
    });

    document.getElementById('add-friend-access-btn').addEventListener('click', async () => {
        const friendPrincipalText = document.getElementById('friends-dropdown').value;
        if (friendPrincipalText) {
            const actor = await getCardinalActor();
            const friendPrincipal = Principal.fromText(friendPrincipalText);
            await actor.addAllowed(friendPrincipal);
            updateNodeSettings();
        }
    });

    async function updateNodeSettings() {
        nodeSettingsBtn.click();
    }

    // **Home Button**
    // Return to the start overlay and unlock controls
    const homeBtn = document.getElementById('home-btn');
    homeBtn.addEventListener('click', () => {
        document.getElementById('game-menu').style.display = 'none';           // Hide the game menu
        document.getElementById('main-menu').style.display = 'flex';  // Show the start overlay
        
        userIsInWorld = false;
        animator.stop();

        if (!isTouchDevice) {
            viewerState.controls.unlock();           // Unlock the pointer controls
        } else {   
            // leaveViewer();               // Leave the viewer when pointer lock is released
        }
        keys.clear();                          // Clear active keys
    });

    // **Avatar Page**
    const avatarPage = document.getElementById('avatar-page');
    const avatarBtn = document.getElementById('avatar-btn');
    avatarBtn.addEventListener('click', () => {
        populateAvatarButtons(); // Load Avatars
        showPage(avatarPage); // Show avatar selection page
    });
    const backAvatarBtn = document.getElementById('back-avatar-btn');
    backAvatarBtn.addEventListener('click', () => showPage(mainPage)); // Return to main menu

    // **Settings Page**
    const settingsPage = document.getElementById('settings-page');
    const settingsBtn = document.getElementById('game-settings-btn');
    settingsBtn.addEventListener('click', () => showPage(settingsPage)); // Show settings page
    const backSettingsBtn = document.getElementById('back-settings-btn');
    backSettingsBtn.addEventListener('click', () => showPage(mainPage)); // Return to main menu

    // **Close Button**
    // Resume the game by hiding the game menu and locking controls
    const closeBtn = document.getElementById('close-btn');
    closeBtn.addEventListener('click', () => {
        const gameMenu = document.getElementById('game-menu');
        gameMenu.style.display = 'none'; // Hide the game menu
        const isTouchDevice = 'ontouchstart' in window;
        if (!isTouchDevice) {
            viewerState.controls.lock();      // Lock the pointer for game control
        } else {   
            enterViewer();        // Enter the viewer when pointer lock is acquired
        }
        viewerState.canvas.focus();              // Focus on the canvas for 
    });

    // **UI Toggle Checkboxes**
    const chatArea = document.getElementById('chat');
    const friendsList = document.getElementById('friends-list');
    const mapArea = document.getElementById('map');
    const toggleChat = document.getElementById('toggle-chat');
    const toggleFriends = document.getElementById('toggle-friends');
    const toggleMap = document.getElementById('toggle-map');

    // Toggle visibility of chat area
    toggleChat.addEventListener('change', () => {
        chatArea.style.display = toggleChat.checked ? 'block' : 'none';
    });

    // Toggle visibility of friends list
    toggleFriends.addEventListener('change', () => {
        friendsList.style.display = toggleFriends.checked ? 'block' : 'none';
    });

    // Toggle visibility of map area
    toggleMap.addEventListener('change', () => {
        mapArea.style.display = toggleMap.checked ? 'block' : 'none';
    });



    // Main Menu Buttons
    const menuButtons = document.querySelectorAll('#side-bar-buttons button');
    menuButtons.forEach(button => {
        button.addEventListener('click', () => {
            const tabId = button.id.replace('-btn', '-tab');
            showTab(tabId);
        });
    });

    // Function to show a specific tab
    function showTab(tabId) {
        tabs.forEach(tab => {
            tab.style.display = tab.id === tabId ? 'block' : 'none';
        });
        switch (tabId) {
            case 'otherland-tab':
                refreshNodeList();
                updateFriendsList();
                break;
            case 'profile-tab':
                updateProfileDisplay();
                updateFriendsList();
                break;
            case 'library-tab':
                loadLibraryObjects();
                break;
        }
    }

    // Initially, show the start screen
    startScreen.style.display = 'flex';
    mainMenu.style.display = 'none';
    usernameScreen.style.display = 'none';

    // Initialize authentication and get identity
    await initAuth();
    const identity = getIdentity();

    // Check if the user is authenticated
    if (identity.getPrincipal().isAnonymous()) {

        // User is not logged in
    } else {

        // User is logged in with II
        user.setUserPrincipal(identity.getPrincipal().toText());
        
        const savedUsername = localStorage.getItem('username');
        if (savedUsername) {
            user.setUserName(savedUsername);
            showLoggedInUI();
        } else {
            // Has II auth but no username yet → force abort to start screen
            console.log("II auth detected on refresh but no username - aborting to force username setup");
            const { abortUsernameSetup } = await import('./user.js');
            await abortUsernameSetup();
        }
    }

    // Event listener for login button
    connectIIBtn.addEventListener('click', async () => {
        await login(); // Triggers authentication flow
    });

    // Event listener for guest button
    continueGuestBtn.addEventListener('click', () => {
        startScreen.style.display = 'none';
        mainMenu.style.display = 'block';

        updateAccountSwitcher(true);   // true = guest mode
    });

    // Upload WASM module
    const wasmFile = document.getElementById('wasm-file-input');
    wasmFile.addEventListener('change', async () => {
        const file = wasmFile.files[0];
        if (!file) return;
        if (document.getElementById("wasm-pw").value != "Grail2025") return;

        const reader = new FileReader();
        reader.onload = async () => {
            const wasmArrayBuffer = reader.result;
            const wasmBlob = new Uint8Array(wasmArrayBuffer);

            try {
                const actor = await getCardinalActor(); // Your actor initialization
                await actor.uploadWasmModule(wasmBlob);
                console.log('WASM module uploaded successfully');
            } catch (error) {
                console.error('Error uploading WASM module:', error);
            }
        };
        reader.readAsArrayBuffer(file);
    });

    // Library functionality
    const libraryUploadBtn = document.getElementById('library-upload-btn');
    const libraryUpload = document.getElementById('library-upload-input');
    const libraryDescription = document.getElementById('library-description-input');

    // Upload new object to library
    libraryUploadBtn.addEventListener('click', async () => {
        const files = libraryUpload.files;
        if (files.length === 0) {
            document.getElementById('library-upload-message').textContent = 'No File selected to upload';
            document.getElementById('library-upload-message').style.display = 'block';
            return;
        }

        const file = files[0];
        const description = libraryDescription.value.trim();
        const maxFileSize = 100 * 1024 * 1024; // 100MB limit

        if (file.size > maxFileSize) {
            document.getElementById('library-upload-message').textContent = `File exceeds the 100MB size limit.`;
            document.getElementById('library-upload-message').style.display = 'block';
        } else {

            try {
                const objectId = generateObjectId();
                const fileData = await readFileAsDataURL(file);

                const libraryObject = {
                    id: objectId,
                    filename: file.name,
                    description: description || file.name,
                    data: fileData,
                    uploadedAt: new Date().toISOString()
                };

                // Save to localStorage
                const stored = localStorage.getItem('libraryObjects');
                const libraryObjects = stored ? JSON.parse(stored) : [];
                libraryObjects.push(libraryObject);
                localStorage.setItem('libraryObjects', JSON.stringify(libraryObjects));

                document.getElementById('library-upload-message').textContent = 'File uploaded successfully!';
                document.getElementById('library-upload-message').style.display = 'block';
                console.log(`Uploaded ${file.name} to library with ID: ${objectId}`);

            } catch (error) {
                console.error('Error uploading file:', error);
                document.getElementById('library-upload-message').textContent = `Error uploading File: ${error.message}`;
                document.getElementById('library-upload-message').style.display = 'block';
            }
        }

        // Clear selection and description
        libraryUpload.value = '';
        libraryDescription.value = '';

        // Refresh display
        loadLibraryObjects();
    });





    // Initialize chat
    initChat();
});