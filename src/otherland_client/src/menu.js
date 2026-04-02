// Import necessary components
import { Principal } from '@icp-sdk/core/principal';
import { viewerState, sceneObjects, worldController, animationMixers, khetState } from './index.js';
import { khetController, clearAllKhets, getUserNodeActor } from './khet.js';
import { nodeSettings, requestNewCanister, refreshNodeList, getAccessibleCanisters, getCardinalActor } from './nodeManager.js';
import { initAuth, getIdentity, login, user } from './user.js';
import { chat } from './chat.js';
import { online } from './peermesh.js'
import { avatarState } from './avatar.js'
import { animator, isTouchDevice } from './animation.js'

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

// Handle Invitation Acceptance on Page Load
export async function handleInvitation() {
    const urlParams = new URLSearchParams(window.location.search);
    const inviteToken = urlParams.get('invite');
    if (inviteToken) {
        const confirmAccept = confirm('Accept friend request?');
        if (confirmAccept) {
            const actor = await getCardinalActor();
            const result = await actor.acceptFriendInvitation(inviteToken);
            if ('ok' in result) {
                alert('Friend request accepted');
                window.history.replaceState({}, document.title, window.location.pathname);
                await updateFriendsList(); // Refresh list after accepting invitation
            } else {
                alert('Error accepting invitation: ' + result.err);
            }
        }
    }
}

// Function to update and display the user profile
function updateProfileDisplay() {
    const usernameDisplay = document.getElementById('username-display');
    const principalDisplay = document.getElementById('principal-display');

    usernameDisplay.textContent = user.getUserName() || 'Not set';
    principalDisplay.textContent = user.getUserPrincipal() || 'Not logged in';
}

// Function to update and display the friends list and pending requests
export async function updateFriendsList() {
    const actor = await getCardinalActor();
    if (!actor) {
        console.error("Not connected to Cardinal canister");
        return;
    }
    const friends = await actor.getFriends();
    const pendingRequests = await actor.getPendingFriendRequests();

    // Update pending requests
    const pendingRequestsDiv = document.getElementById('pending-requests');
    pendingRequestsDiv.innerHTML = '';
    if (pendingRequests.length > 0) {
        const pendingTitle = document.createElement('h3');
        pendingTitle.textContent = 'Pending Friend Requests';
        pendingRequestsDiv.appendChild(pendingTitle);

        const pendingTable = document.createElement('table');
        pendingTable.className = 'friends-table';
        const pendingHeaderRow = document.createElement('tr');

        const pendingHeaderFrom = document.createElement('th');
        pendingHeaderFrom.textContent = 'From';

        const pendingHeaderActions = document.createElement('th');
        pendingHeaderActions.textContent = 'Actions';

        pendingHeaderRow.appendChild(pendingHeaderFrom);
        pendingHeaderRow.appendChild(pendingHeaderActions);
        pendingTable.appendChild(pendingHeaderRow);

        pendingRequests.forEach(request => {
            const row = document.createElement('tr');

            const cellFrom = document.createElement('td');
            cellFrom.textContent = request.from.toText();

            const cellActions = document.createElement('td');

            const acceptBtn = document.createElement('button');
            acceptBtn.textContent = 'Accept';
            acceptBtn.style.margin = '5px';
            acceptBtn.addEventListener('click', async () => {
                const result = await actor.acceptFriendRequest(request.from);
                if ('ok' in result) {
                    alert('Friend request accepted!');
                    await updateFriendsList();
                } else {
                    alert('Error: ' + result.err);
                }
            });

            const declineBtn = document.createElement('button');
            declineBtn.textContent = 'Decline';
            declineBtn.style.margin = '5px';
            declineBtn.addEventListener('click', async () => {
                const result = await actor.declineFriendRequest(request.from);
                if ('ok' in result) {
                    await updateFriendsList();
                } else {
                    alert('Error: ' + result.err);
                }
            });

            cellActions.appendChild(acceptBtn);
            cellActions.appendChild(declineBtn);
            row.appendChild(cellFrom);
            row.appendChild(cellActions);
            pendingTable.appendChild(row);
        });
        pendingRequestsDiv.appendChild(pendingTable);
    }

    const friendsList = document.getElementById('friends-list');
    friendsList.innerHTML = ''; // Clear existing content

    // Create table for friends list
    const table = document.createElement('table');
    table.className = 'friends-table';
    const headerRow = document.createElement('tr');

    const headerPrincipal = document.createElement('th');
    headerPrincipal.textContent = 'Friend Principal';

    const headerActions = document.createElement('th');
    headerActions.textContent = 'Actions';
    
    headerRow.appendChild(headerPrincipal);
    headerRow.appendChild(headerActions);
    table.appendChild(headerRow);

    friends.forEach(principal => {
        const row = document.createElement('tr');
        
        const cellPrincipal = document.createElement('td');
        cellPrincipal.textContent = principal.toText(); // Assuming principal has a toText() method

        const cellActions = document.createElement('td');
        
        const removeBtn = document.createElement('button');
        removeBtn.textContent = 'Remove';
        removeBtn.style.margin = '5px';
        removeBtn.addEventListener('click', async () => {
            await actor.removeFriend(principal);
            await updateFriendsList(); // Refresh the list after removal
        });
        
        cellActions.appendChild(removeBtn);
        row.appendChild(cellPrincipal);
        row.appendChild(cellActions);
        table.appendChild(row);
    });
    friendsList.appendChild(table);

    const friendsDropdown = document.getElementById('friends-dropdown');
    friendsDropdown.innerHTML = '<option value="">Select a friend</option>';
    friends.forEach(principal => {
        const option = document.createElement('option');
        option.value = principal.toText();
        option.textContent = principal.toText();
        friendsDropdown.appendChild(option);
    });
}

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
    // Define the parameters for loadScene and loadAvatarObject
    const params = { sceneObjects, animationMixers, khetState };

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

// Update Khet Table
export async function updateKhetTable() {

    // Select the table
    const table = document.querySelector('#khet-table');
            
    // Clear existing data rows (keep the header row)
    const rows = table.querySelectorAll('tr');
    for (let i = 1; i < rows.length; i++) {
        rows[i].remove();
    }

    // Load Khets from the backend
    await khetController.loadAllKhets();

    // Populate the table with Khet data
    const khets = Object.values(khetController.khets);
    if (khets.length > 0) {
        document.getElementById("khet-table").style.display = "block";
        document.getElementById("clear-khets-btn").style.display = "block";
        for (const khet of khets) {
            const tr = document.createElement('tr');
            
            // KhetID column
            const tdId = document.createElement('td');
            tdId.textContent = khet.khetId;
            tr.appendChild(tdId);
            
            // KhetType column
            const tdType = document.createElement('td');
            tdType.textContent = khet.khetType;
            tr.appendChild(tdType);
            
            // Position column
            const tdPosition = document.createElement('td');
            tdPosition.textContent = `[${khet.position.join(', ')}]`;
            tr.appendChild(tdPosition);
            
            // Scale column
            const tdScale = document.createElement('td');
            tdScale.textContent = `[${khet.scale.join(', ')}]`;
            tr.appendChild(tdScale);
            
            // Code column
            const tdCode = document.createElement('td');
            tdCode.textContent = khet.code ? khet.code.join(', ') : '';
            tr.appendChild(tdCode);
            
            // Edit column
            const tdEdit = document.createElement('td');
            const editKhetButton = document.createElement('button');
            editKhetButton.textContent = "Edit";
            editKhetButton.addEventListener('click', async () => {

                // Switch to Edit Display
                changekhetEditorDrawer('open');
                document.getElementById("edit-group").style.display = 'block';
                document.getElementById("upload-group").style.display = 'none';

                // Display Type and ID
                document.getElementById("edit-khet-type").innerHTML = khet.khetType;
                document.getElementById("edit-khet-id").innerHTML = khet.khetId;

                // Display position and scale to  fields
                document.getElementById('pos-x').value = khet.position[0];
                document.getElementById('pos-y').value = khet.position[1];
                document.getElementById('pos-z').value = khet.position[2];
                document.getElementById('scale-x').value = khet.scale[0];
                document.getElementById('scale-y').value = khet.scale[1];
                document.getElementById('scale-z').value = khet.scale[2];
            });
            
            tdEdit.appendChild(editKhetButton);
            tr.appendChild(tdEdit);
            
            // Delete column
            const tdDelete = document.createElement('td');
            const deleteKhetButton = document.createElement('button');
            deleteKhetButton.textContent = "Delete";
            deleteKhetButton.addEventListener('click', async () => {

                // Delete Khet from Khetcontroller, keep asset in cache
                await khetController.removeEntry(khet.khetId);
                console.log('Khet deleted'); // Log confirmation
                await updateKhetTable();
            });
            tdDelete.appendChild(deleteKhetButton);
            tr.appendChild(tdDelete);
            
            // Append the row to the table
            table.appendChild(tr);
        }
    } else {
        document.getElementById("khet-table").style.display = "none";
        document.getElementById("clear-khets-btn").style.display = "none";
    }
    return;
}

// Open / Close KhetEditor
function changekhetEditorDrawer(goal) {
    if (goal == "open") {
        document.getElementById("khet-editor").style.bottom = "240px";
        document.getElementById("draw-up-btn").style.display = "none";
        document.getElementById("draw-close-btn").style.display = "block";
    } else if (goal == "close") {
        document.getElementById("khet-editor").style.bottom = "-20px";
        document.getElementById("draw-up-btn").style.display = "block";
        document.getElementById("draw-close-btn").style.display = "none";
    }
    return;
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
    
    // Unified account switcher - handles Guest and II-logged-in states with action buttons
    function updateAccountSwitcher(isGuest = false) {
        document.getElementById("info-box").style.display = 'block';
        accountSwitcher.innerHTML = '';

        const container = document.createElement('div');
        container.style.textAlign = 'center';

        if (isGuest) {
            const status = document.createElement('button');
            status.textContent = 'Guest';
            status.style.cursor = 'default';
            container.appendChild(status);

            const loginBtn = document.createElement('button');
            loginBtn.textContent = 'Login with Internet Identity';
            loginBtn.style.marginTop = '8px';
            loginBtn.addEventListener('click', async () => {
                await login();   // triggers full II flow (will show username screen if needed)
            });
            container.appendChild(loginBtn);
        } else {
            // II Logged-in user
            const username = user.getUserName() && user.getUserName().trim() !== ''
                ? user.getUserName().trim()
                : 'Anonymous';

            const status = document.createElement('button');
            status.innerHTML = `<strong>${username}</strong>`;
            status.style.cursor = 'default';
            container.appendChild(status);

            const logoutBtn = document.createElement('button');
            logoutBtn.textContent = 'Logout';
            logoutBtn.style.marginTop = '8px';
            logoutBtn.addEventListener('click', async () => {
                const { logout } = await import('./user.js');
                await logout();
                // Return to clean start screen
                document.getElementById('main-menu').style.display = 'none';
                document.getElementById('info-box').style.display = 'none';
                document.getElementById('start-screen').style.display = 'flex';
            });
            container.appendChild(logoutBtn);
        }

        accountSwitcher.appendChild(container);
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

        // Switch Node Type
        if (nodeSettings.nodeType == 0 || nodeSettings.nodeType == 1) {
            enterWorld();
        }
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

    // **Avatar Selection Buttons**
    // Populate avatar selection buttons
    function populateAvatarButtons() {
        const avatars = khetController.getAvatars();
        const avatarButtonsContainer = document.getElementById("avatar-container");
        avatarButtonsContainer.innerHTML = ""; // Clear existing buttons
        avatars.forEach((avatar, index) => {
            const button = document.createElement('button');
            button.textContent = `Avatar ${avatar.khetId}`;
            button.setAttribute('data-avatar', avatar.khetId);
            button.addEventListener('click', async () => {
                console.log(`Selected Avatar ${avatar.khetId}`);

                // Load Avatar
                await worldController.setAvatar(avatar.khetId, { sceneObjects, animationMixers, khetState }); // Start animation for 1 frame?
                console.log(`Avatar loaded sucessfully`);
            });
            avatarButtonsContainer.appendChild(button);
        });
    }

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

    // Chat Initialization
    const chatMessages = document.getElementById('chat-messages');
    const chat = document.getElementById('chat-input');
    const sendChatBtn = document.getElementById('send-chat-btn');

    // Display incoming messages
    chat.onMessage((message) => {
        const msgDiv = document.createElement('div');
        msgDiv.textContent = `[${new Date(message.timestamp).toLocaleTimeString()}] ${message.sender}: ${message.text}`;
        chatMessages.appendChild(msgDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight; // Auto-scroll to latest message
    });

    // Send message on button click
    sendChatBtn.addEventListener('click', async () => {
        const text = chat.value.trim();
        if (text) {
            await chat.sendMessage(text);
            chat.value = ''; // Clear 
        }
    });

    // Send message on Enter key press
    chat.addEventListener('keypress', async (e) => {
        if (e.key === 'Enter') {
            const text = chat.value.trim();
            if (text) {
                await chat.sendMessage(text);
                chat.value = '';
            }
        }
    });

    // Fetch message history if in canister mode
    if (nodeSettings.nodeType === 2 || nodeSettings.nodeType === 3) {
        chat.getMessageHistory().then(history => {
            history.forEach(message => {
                const msgDiv = document.createElement('div');
                msgDiv.textContent = `[${new Date(message.timestamp).toLocaleTimeString()}] ${message.sender}: ${message.text}`;
                chatMessages.appendChild(msgDiv);
            });
            chatMessages.scrollTop = chatMessages.scrollHeight;
        });
    }

    // Library functionality
    const libraryUploadBtn = document.getElementById('library-upload-btn');
    const libraryUpload = document.getElementById('library-upload-input');
    const libraryDescription = document.getElementById('library-description-input');

    // Load library objects from localStorage and display in table
    function loadLibraryObjects() {
        const tbody = document.getElementById('library-object-tbody');
        tbody.innerHTML = ''; // Clear existing rows

        const stored = localStorage.getItem('libraryObjects');
        const libraryObjects = stored ? JSON.parse(stored) : [];

        if (libraryObjects.length === 0) {
            document.getElementById('library-object-list').style.display = 'none';
            return;
        } else {

            document.getElementById('library-object-list').style.display = 'block';
            libraryObjects.forEach(obj => {
                const row = document.createElement('tr');

                const idCell = document.createElement('td');
                idCell.textContent = obj.id;

                const descCell = document.createElement('td');
                descCell.textContent = obj.description || obj.filename;

                const actionsCell = document.createElement('td');
                const deleteBtn = document.createElement('button');
                deleteBtn.textContent = 'Delete';
                deleteBtn.className = 'delete-btn';
                deleteBtn.onclick = () => deleteLibraryObject(obj.id);
                actionsCell.appendChild(deleteBtn);

                row.appendChild(idCell);
                row.appendChild(descCell);
                row.appendChild(actionsCell);

                tbody.appendChild(row);
            });
        }
    }

    // Upload new object to library
    libraryUploadBtn.addEventListener('click', async () => {
        const files = libraryUpload.files;
        if (files.length === 0) {
            document.getElementById('library-upload-message').textContent = 'No File selected to upload';
            document.getElementById('library-upload-message').style.display = 'block';
            console.error('Error uploading file:', error);
        } else {

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
        }

        // Clear selection and description
        libraryUpload.value = '';
        libraryDescription.value = '';

        // Refresh display
        loadLibraryObjects();
    });

    // Delete object from library
    function deleteLibraryObject(objectId) {
        if (!confirm('Are you sure you want to delete this object from your library?')) {
            return;
        }

        const stored = localStorage.getItem('libraryObjects');
        const libraryObjects = stored ? JSON.parse(stored) : [];
        const filteredObjects = libraryObjects.filter(obj => obj.id !== objectId);

        localStorage.setItem('libraryObjects', JSON.stringify(filteredObjects));
        loadLibraryObjects();

        console.log(`Deleted object ${objectId} from library`);
    }

    // Generate unique object ID
    function generateObjectId() {
        return 'khet_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    // Read file as Data URL
    function readFileAsDataURL(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }
});