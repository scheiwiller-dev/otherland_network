// Friends management functions
import { Principal } from '@icp-sdk/core/principal';
import { getCardinalActor } from './nodeManager.js';
import { user } from './user.js';

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