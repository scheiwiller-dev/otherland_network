import { getCardinalActor, getUserNodeActor } from '../nodeManager.js';
import { user, updateAccountSwitcher, updateProfileDisplay } from '../user.js';
import { online } from '../peermesh.js';
import { applyUsername } from '../usernameSync.js';

async function copyWithFeedback(btn, text) {
    await navigator.clipboard.writeText(text);
    const originalText = btn.textContent;
    btn.textContent = '✓';
    btn.style.color = '#35bd00';
    setTimeout(() => {
        btn.textContent = originalText;
        btn.style.color = '';
    }, 1000);
}

/** Generate a friend invitation link and show it in #invitation-link. */
export async function generateFriendInviteLink() {
    const actor = await getCardinalActor();
    const token = await actor.generateFriendInvitation();
    const invitationLink = `${window.location.origin}/?invite=${token}`;
    document.getElementById('invitation-link').textContent = invitationLink;
    const copyBtn = document.getElementById('copy-invitation-btn');
    if (copyBtn) copyBtn.classList.remove('hidden');
}

/** Username edit, copy username/principal/peerid, friend invite/request UI. */
export function initProfile() {
    const invitationLinkBtn = document.getElementById('invitationLinkBtn');
    const addFriendBtn = document.getElementById('add-friend-btn');

    if (invitationLinkBtn) {
        invitationLinkBtn.addEventListener('click', () => generateFriendInviteLink());
    }
    const copyInvitationBtn = document.getElementById('copy-invitation-btn');
    if (copyInvitationBtn) {
        copyInvitationBtn.addEventListener('click', async () => {
            const link = document.getElementById('invitation-link').textContent;
            if (!link) return;
            try {
                await copyWithFeedback(copyInvitationBtn, link);
            } catch (err) {
                console.error('Failed to copy invite link:', err);
            }
        });
    }
    if (addFriendBtn) {
        addFriendBtn.addEventListener('click', () => {
            document.getElementById('add-friend-row').classList.remove('hidden');
            addFriendBtn.classList.add('hidden');
        });
    }

    const sendFriendRequestBtn = document.getElementById('send-friend-request-btn');
    if (sendFriendRequestBtn) {
        sendFriendRequestBtn.addEventListener('click', async () => {
            const identifier = document.getElementById('friend-identifier-input').value.trim();
            if (!identifier) return;

            const actor = await getCardinalActor();
            const result = await actor.sendFriendRequest(identifier);
            if ('ok' in result) {
                alert('Friend request sent!');
                document.getElementById('friend-identifier-input').value = '';
                document.getElementById('add-friend-row').classList.add('hidden');
                if (addFriendBtn) addFriendBtn.classList.remove('hidden');
            } else {
                alert('Error: ' + result.err);
            }
        });
    }

    const cancelAddFriendBtn = document.getElementById('cancel-add-friend-btn');
    if (cancelAddFriendBtn) {
        cancelAddFriendBtn.addEventListener('click', () => {
            document.getElementById('friend-identifier-input').value = '';
            document.getElementById('add-friend-row').classList.add('hidden');
            if (addFriendBtn) addFriendBtn.classList.remove('hidden');
        });
    }

    const editUsernameBtn = document.getElementById('edit-username-btn');
    if (editUsernameBtn) {
        editUsernameBtn.addEventListener('click', () => {
            document.getElementById('edit-username-row').classList.remove('hidden');
            document.getElementById('edit-username-input').value = user.getUserName() || '';
            document.getElementById('edit-username-input').focus();
        });
    }

    const saveEditUsernameBtn = document.getElementById('save-edit-username-btn');
    if (saveEditUsernameBtn) {
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
                const outcome = await applyUsername(newUsername, {
                    actor,
                    storage: localStorage,
                    user,
                });
                if (!outcome.ok) {
                    errorEl.textContent = outcome.message;
                    errorEl.classList.remove('hidden');
                    return;
                }

                console.log('Username updated successfully:', newUsername);

                document.getElementById('edit-username-row').classList.add('hidden');
                errorEl.classList.add('hidden');
                updateProfileDisplay();
                updateAccountSwitcher(false);
            } catch (err) {
                console.error('Failed to update username:', err);
                errorEl.textContent = err && err.message ? err.message : 'Failed to update username. Please try again.';
                errorEl.classList.remove('hidden');
            }
        });
    }

    const cancelEditUsernameBtn = document.getElementById('cancel-edit-username-btn');
    if (cancelEditUsernameBtn) {
        cancelEditUsernameBtn.addEventListener('click', () => {
            document.getElementById('edit-username-row').classList.add('hidden');
            document.getElementById('edit-username-error').classList.add('hidden');
        });
    }

    const copyUsernameBtn = document.getElementById('copy-username-btn');
    if (copyUsernameBtn) {
        copyUsernameBtn.addEventListener('click', async () => {
            const username = document.getElementById('username-display').textContent;
            if (username && username !== 'Not set') {
                try {
                    await copyWithFeedback(copyUsernameBtn, username);
                } catch (err) {
                    console.error('Failed to copy username:', err);
                }
            }
        });
    }

    const copyPrincipalBtn = document.getElementById('copy-principal-btn');
    if (copyPrincipalBtn) {
        copyPrincipalBtn.addEventListener('click', async () => {
            const principal = document.getElementById('principal-display').textContent;
            if (principal && principal !== 'Not logged in') {
                try {
                    await copyWithFeedback(copyPrincipalBtn, principal);
                } catch (err) {
                    console.error('Failed to copy principal:', err);
                }
            }
        });
    }

    const copyPeeridBtn = document.getElementById('copy-peerid-btn');
    if (copyPeeridBtn) {
        copyPeeridBtn.addEventListener('click', async () => {
            const peerId =
                online.ownID ||
                document.getElementById('peerid-display')?.textContent;
            if (!peerId || peerId.includes('Generating')) return;
            try {
                await copyWithFeedback(copyPeeridBtn, peerId);
            } catch (err) {
                console.error('Failed to copy peer ID:', err);
            }
        });
    }
}
