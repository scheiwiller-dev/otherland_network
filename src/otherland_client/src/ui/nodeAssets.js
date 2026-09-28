import { Principal } from '@icp-sdk/core/principal';
import {
    khetController,
    clearAllKhets,
    updateKhetTable,
    changekhetEditorDrawer,
    saveToCache,
    currentEditingKhetId,
    editFormSnapshot,
    clearCurrentEditingKhetId,
} from '../khet.js';
import { nodeSettings, getCardinalActor, getUserNodeActor, refreshNodeList } from '../nodeManager.js';
import { user } from '../user.js';
import { showTab } from './tabs.js';
import { refreshLibraryPlace } from './libraryPlace.js';
import { lookupPersonLabel, renderPerson } from '../principalLabel.js';

async function updateNodeSettings() {
    const nodeSettingsBtn = document.getElementById('node-settings-btn');
    if (nodeSettingsBtn) {
        nodeSettingsBtn.click();
    }
}

/** Text from a Motoko `#err`, or null when the call did not fail that way. */
function canisterErrorText(result) {
    if (result && typeof result === 'object' && 'err' in result) {
        return String(result.err);
    }
    return null;
}

/**
 * Run an allow-list or visibility update.
 * `#err` uses the same alert as friend requests. The allow-list reloads only after success.
 */
async function commitNodeAccessChange(action) {
    try {
        const result = await action();
        const message = canisterErrorText(result);
        if (message != null) {
            alert('Error: ' + message);
            return false;
        }
        updateNodeSettings();
        return true;
    } catch (error) {
        const message = error && error.message ? error.message : String(error);
        alert('Error: ' + message);
        return false;
    }
}

/** Metadata record for updateKhetMetadata, with the form pose applied. */
function khetMetadataForSave(khet, position, scale) {
    return {
        khetId: khet.khetId,
        khetType: khet.khetType,
        gltfDataSize: khet.gltfDataSize ?? 0,
        gltfDataRef: khet.gltfDataRef ?? [],
        position,
        originalSize: khet.originalSize ?? [0, 0, 0],
        scale,
        textures: khet.textures ?? [],
        animations: khet.animations ?? [],
        code: khet.code ?? [],
        hash: khet.hash ?? '',
    };
}

function readPoseFromForm() {
    return {
        position: [
            parseFloat(document.getElementById('pos-x').value) || 0,
            parseFloat(document.getElementById('pos-y').value) || 0,
            parseFloat(document.getElementById('pos-z').value) || 0,
        ],
        scale: [
            parseFloat(document.getElementById('scale-x').value) || 1,
            parseFloat(document.getElementById('scale-y').value) || 1,
            parseFloat(document.getElementById('scale-z').value) || 1,
        ],
    };
}

function writePoseToForm(position, scale) {
    document.getElementById('pos-x').value = position[0];
    document.getElementById('pos-y').value = position[1];
    document.getElementById('pos-z').value = position[2];
    document.getElementById('scale-x').value = scale[0];
    document.getElementById('scale-y').value = scale[1];
    document.getElementById('scale-z').value = scale[2];
}

/** Edit node/treehouse assets, khet editor save/discard, and node settings. */
export function initNodeAssets() {
    const editNodeBtn = document.getElementById('edit-node-btn');
    if (editNodeBtn) {
        editNodeBtn.addEventListener('click', async () => {
            if (nodeSettings.nodeType == 2) {
                await updateKhetTable();
                document.getElementById('assets-title').innerHTML = 'My Node > Assets';
                showTab('assets-tab');
                await refreshLibraryPlace();
            }
        });
    }

    const clearBtn = document.getElementById('clear-khets-btn');
    if (clearBtn) {
        clearBtn.addEventListener('click', async () => {
            if (nodeSettings.nodeType == 0) {
                await khetController.clearKhet();
                console.log('Khets cleared from treehouse');
            } else if (nodeSettings.nodeType == 2) {
                await clearAllKhets();
                console.log('Khets cleared from node');
            }
            await updateKhetTable();
        });
    }

    const editTreeHouseBtn = document.getElementById('edit-treehouse-btn');
    if (editTreeHouseBtn) {
        editTreeHouseBtn.addEventListener('click', async () => {
            if (nodeSettings.nodeType !== 0) {
                await nodeSettings.changeNode({ type: 0, id: 'TreeHouse' });
            }

            if (nodeSettings.nodeType == 0) {
                await updateKhetTable();
                document.getElementById('assets-title').innerHTML = 'My TreeHouse > Assets';
                showTab('assets-tab');
                await refreshLibraryPlace();
            }
        });
    }

    const discardEditButton = document.getElementById('discard-edit-btn');
    if (discardEditButton) {
        discardEditButton.addEventListener('click', async () => {
            const position = editFormSnapshot?.position ?? [0, 0, 0];
            const scale = editFormSnapshot?.scale ?? [1, 1, 1];
            writePoseToForm(position, scale);

            changekhetEditorDrawer('close');
            document.getElementById('edit-group').style.display = 'none';
            document.getElementById('upload-group').style.display = 'block';

            clearCurrentEditingKhetId();
            await updateKhetTable();
        });
    }

    const saveEditButton = document.getElementById('save-edit-btn');
    if (saveEditButton) {
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

            const pose = readPoseFromForm();

            if (nodeSettings.nodeType == 2) {
                const actor = await getUserNodeActor();
                if (!actor) {
                    alert('Error: Not connected to a node');
                    return;
                }
                const result = await actor.updateKhetMetadata(
                    khet.khetId,
                    khetMetadataForSave(khet, pose.position, pose.scale),
                );
                if (result && typeof result === 'object' && 'err' in result) {
                    alert('Error: ' + result.err);
                    return;
                }
            }

            khet.position = pose.position;
            khet.scale = pose.scale;

            if (nodeSettings.nodeType == 0) {
                const khetMetadata = { ...khet };
                delete khetMetadata.gltfData;
                nodeSettings.localKhets[khet.khetId] = khetMetadata;
                nodeSettings.saveLocalKhets();

                await saveToCache(khet.khetId, khet);
            }

            khetController.khets[khet.khetId] = khet;

            changekhetEditorDrawer('close');
            document.getElementById('edit-group').style.display = 'none';
            document.getElementById('upload-group').style.display = 'block';
            await updateKhetTable();
            clearCurrentEditingKhetId();
        });
    }

    const nodeSettingsBtn = document.getElementById('node-settings-btn');
    if (nodeSettingsBtn) {
        nodeSettingsBtn.addEventListener('click', async () => {
            if (nodeSettings.nodeType == 2) {
                showTab('node-settings-tab');
                const actor = await getCardinalActor();
                const titleInput = document.getElementById('node-title-input');
                const titleError = document.getElementById('node-title-error');
                if (titleError) titleError.textContent = '';
                if (titleInput && actor.getNodeTitle) {
                    const current = await actor.getNodeTitle();
                    titleInput.value = Array.isArray(current) && current.length ? String(current[0]) : '';
                }
                const visibility = await actor.getNodeVisibility();
                const isPublic = visibility.length > 0 ? visibility[0] : false;
                document.getElementById('public-toggle').checked = isPublic;
                const allowedUsers = await actor.getAllowedUsers();
                const allowedList = document.getElementById('allowed-users-list');
                allowedList.innerHTML = '';
                for (const principal of allowedUsers) {
                    if (principal.toText() === user.getUserPrincipal()) continue;
                    const li = document.createElement('li');
                    renderPerson(li, await lookupPersonLabel(actor, principal));
                    const removeBtn = document.createElement('button');
                    removeBtn.textContent = 'Remove';
                    removeBtn.addEventListener('click', async () => {
                        await commitNodeAccessChange(() => actor.removeAllowed(principal));
                    });
                    li.appendChild(removeBtn);
                    allowedList.appendChild(li);
                }
                const friends = await actor.getFriends();
                const friendsDropdown = document.getElementById('friends-dropdown');
                friendsDropdown.innerHTML = '<option value="">Select a friend</option>';
                for (const friend of friends) {
                    const label = await lookupPersonLabel(actor, friend);
                    const option = document.createElement('option');
                    option.value = friend.toText();
                    option.textContent = label.primary;
                    friendsDropdown.appendChild(option);
                }
            }
        });
    }

    const saveTitleBtn = document.getElementById('save-node-title-btn');
    if (saveTitleBtn) {
        saveTitleBtn.addEventListener('click', async () => {
            const input = document.getElementById('node-title-input');
            const error = document.getElementById('node-title-error');
            if (!input || nodeSettings.nodeType != 2) return;
            if (error) error.textContent = '';
            const title = input.value.trim();
            try {
                const actor = await getCardinalActor();
                const message = canisterErrorText(await actor.setNodeTitle(title));
                if (message) {
                    if (error) error.textContent = message;
                    return;
                }
                await refreshNodeList();
            } catch (err) {
                if (error) error.textContent = err && err.message ? err.message : String(err);
            }
        });
    }

    const publicToggle = document.getElementById('public-toggle');
    if (publicToggle) {
        // Skip the change event fired while restoring the checkbox after a failed update.
        let applyingVisibility = false;
        publicToggle.addEventListener('change', async (e) => {
            if (applyingVisibility) return;
            const previous = !e.target.checked;
            const actor = await getCardinalActor();
            const ok = await commitNodeAccessChange(() => actor.setNodeVisibility(e.target.checked));
            if (!ok) {
                applyingVisibility = true;
                e.target.checked = previous;
                applyingVisibility = false;
            }
        });
    }

    const addFriendAccessBtn = document.getElementById('add-friend-access-btn');
    if (addFriendAccessBtn) {
        addFriendAccessBtn.addEventListener('click', async () => {
            const friendPrincipalText = document.getElementById('friends-dropdown').value;
            if (!friendPrincipalText) return;
            if (!nodeSettings.nodeId) {
                alert('Error: Not connected to a node');
                return;
            }
            const actor = await getCardinalActor();
            await commitNodeAccessChange(() => {
                const nodeId = Principal.fromText(nodeSettings.nodeId);
                const friendPrincipal = Principal.fromText(friendPrincipalText);
                return actor.addAllowedUser(nodeId, friendPrincipal);
            });
        });
    }
}
