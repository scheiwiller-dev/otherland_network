// Friends management functions
import { Principal } from '@icp-sdk/core/principal';
import { getCardinalActor } from './nodeManager.js';
import { CARDINAL_CALL_TIMEOUT_MS, CARDINAL_UNREACHABLE, withTimeout } from './network.js';
import { reportCardinalUnavailable } from './networkStatus.js';
import { lookupPersonLabel, renderPerson } from './principalLabel.js';

// Function to update and display the friends list and pending requests
export async function updateFriendsList() {
    try {
        await loadFriendsList();
    } catch (error) {
        reportCardinalUnavailable(error);
    }
}

async function loadFriendsList() {
    const actor = await getCardinalActor();
    if (!actor) {
        console.error("Not connected to Cardinal canister");
        return;
    }
    const friends = await withTimeout(actor.getFriends(), CARDINAL_CALL_TIMEOUT_MS, CARDINAL_UNREACHABLE);
    const pendingRequests = await withTimeout(
        actor.getPendingFriendRequests(),
        CARDINAL_CALL_TIMEOUT_MS,
        CARDINAL_UNREACHABLE,
    );

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

        for (const request of pendingRequests) {
            const row = document.createElement('tr');

            const cellFrom = document.createElement('td');
            renderPerson(cellFrom, await lookupPersonLabel(actor, request.from));

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
        }
        pendingRequestsDiv.appendChild(pendingTable);
    }

    const outgoingDiv = document.getElementById('outgoing-invites');
    if (outgoingDiv) {
        outgoingDiv.innerHTML = '';
        const outgoing = await withTimeout(
            actor.getPendingInvitations(),
            CARDINAL_CALL_TIMEOUT_MS,
            CARDINAL_UNREACHABLE,
        );
        if (outgoing.length > 0) {
            const outgoingTitle = document.createElement('h3');
            outgoingTitle.textContent = 'Invite Links';
            outgoingDiv.appendChild(outgoingTitle);
            outgoing.forEach((entry) => {
                const token = entry[0];
                const row = document.createElement('div');
                const text = document.createElement('span');
                text.className = 'principal-id';
                text.textContent = `/?invite=${token}`;
                const cancelBtn = document.createElement('button');
                cancelBtn.textContent = 'Cancel';
                cancelBtn.style.margin = '5px';
                cancelBtn.addEventListener('click', async () => {
                    const result = await actor.cancelInvitation(token);
                    if (result && typeof result === 'object' && 'err' in result) {
                        alert('Error: ' + result.err);
                        return;
                    }
                    await updateFriendsList();
                });
                row.appendChild(text);
                row.appendChild(cancelBtn);
                outgoingDiv.appendChild(row);
            });
        }
    }

    const friendsList = document.getElementById('friends-list');
    friendsList.innerHTML = ''; // Clear existing content

    // Create table for friends list
    const table = document.createElement('table');
    table.className = 'friends-table';
    const headerRow = document.createElement('tr');

    const headerPrincipal = document.createElement('th');
    headerPrincipal.textContent = 'Friend';

    const headerActions = document.createElement('th');
    headerActions.textContent = 'Actions';
    
    headerRow.appendChild(headerPrincipal);
    headerRow.appendChild(headerActions);
    table.appendChild(headerRow);

    for (const principal of friends) {
        const label = await lookupPersonLabel(actor, principal);
        const row = document.createElement('tr');
        
        const cellPrincipal = document.createElement('td');
        renderPerson(cellPrincipal, label);

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
    }
    friendsList.appendChild(table);

    const friendsDropdown = document.getElementById('friends-dropdown');
    if (friendsDropdown) {
        friendsDropdown.innerHTML = '<option value="">Select a friend</option>';
        for (const principal of friends) {
            const label = await lookupPersonLabel(actor, principal);
            const option = document.createElement('option');
            option.value = principal.toText();
            option.textContent = label.primary;
            friendsDropdown.appendChild(option);
        }
    }
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