/**
 * Place a Library catalogue entry into TreeHouse or an editable node.
 * New files are written to the Library first, then handed to the existing
 * TreeHouse cache path or the chunked node upload.
 */
import { nodeSettings } from '../nodeManager.js';
import { saveTreehouseKhet } from '../khet/placeLocal.js';
import {
    LIBRARY_MESSAGES,
    buildFileEntry,
    createLibraryId,
    looksLikeGlb,
    sourceLabel,
    storageFailureMessage,
    validateUploadFile,
} from '../library/model.js';
import { placementActionLabel, placementTarget, placementUnavailableMessage } from '../library/placement.js';
import { resolveLibraryGlb } from '../library/resolve.js';
import { fetchRemoteGlb } from '../library/remote.js';
import {
    getLibraryBytes,
    getLibraryEntry,
    listLibraryEntries,
    saveLibraryEntry,
} from '../library/store.js';

function setPlaceMessage(text, kind) {
    const el = document.getElementById('library-place-message');
    if (!el) return;
    el.textContent = text || '';
    el.classList.toggle('is-error', kind === 'error');
    el.classList.toggle('is-ok', kind === 'ok');
}

function readPose() {
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

function readKhetType() {
    const select = document.getElementById('khet-type');
    return select && select.value ? select.value : 'SceneObject';
}

async function rememberUrlSize(entry, byteSize) {
    if (!entry || entry.source !== 'url' || entry.byteSize === byteSize) return;
    const current = await getLibraryEntry(entry.id);
    if (!current || current.byteSize === byteSize) return;
    await saveLibraryEntry({ ...current, byteSize });
}

async function placeBytes(bytes, entryName) {
    const target = placementTarget(nodeSettings.nodeType);
    const unavailable = placementUnavailableMessage(nodeSettings.nodeType);
    if (!target) {
        setPlaceMessage(unavailable, 'error');
        return false;
    }
    const { createKhetFromBytes } = await import('../khet/create.js');
    let khet;
    try {
        khet = await createKhetFromBytes(bytes, readKhetType(), readPose());
    } catch (error) {
        console.error('Library place parse failed:', error);
        setPlaceMessage(LIBRARY_MESSAGES.notGlbPayload, 'error');
        return false;
    }

    if (target === 'treehouse') {
        try {
            const { saveToCache, khetController, updateKhetTable } = await import('../khet.js');
            await saveTreehouseKhet(khet, { saveToCache, nodeSettings, khetController });
            await updateKhetTable();
            setPlaceMessage(`Placed ${entryName} in your TreeHouse.`, 'ok');
            return true;
        } catch (error) {
            console.error('Library TreeHouse place failed:', error);
            const detail = error && error.message ? error.message : 'Could not place this resource in your TreeHouse.';
            setPlaceMessage(detail, 'error');
            return false;
        }
    }

    try {
        const { uploadKhet } = await import('../khet/upload.js');
        await uploadKhet(khet);
        const { updateKhetTable } = await import('../khet.js');
        await updateKhetTable();
        setPlaceMessage(`Uploading ${entryName} to this node.`, 'ok');
        return true;
    } catch (error) {
        console.error('Library node place failed:', error);
        const detail = error && error.message ? error.message : 'Could not upload this resource to the node.';
        setPlaceMessage(detail, 'error');
        return false;
    }
}

async function placeEntry(entry) {
    const resolved = await resolveLibraryGlb(entry, {
        getBytes: getLibraryBytes,
        fetchGlb: fetchRemoteGlb,
    });
    if (!resolved.ok) {
        setPlaceMessage(resolved.message, 'error');
        return false;
    }
    try {
        await rememberUrlSize(entry, resolved.bytes.byteLength);
    } catch (error) {
        console.error('Library size update failed:', error);
    }
    return placeBytes(resolved.bytes, entry.name);
}

export async function refreshLibraryPlace() {
    const select = document.getElementById('library-place-select');
    const empty = document.getElementById('library-place-empty');
    const list = document.getElementById('library-place-list');
    const button = document.getElementById('library-place-btn');
    if (!select) return;

    const previous = select.value;
    let entries = [];
    try {
        entries = await listLibraryEntries();
    } catch (error) {
        console.error('Library place list failed:', error);
        setPlaceMessage(LIBRARY_MESSAGES.storageFailed, 'error');
        return;
    }

    select.replaceChildren();
    for (const entry of entries) {
        const option = document.createElement('option');
        option.value = entry.id;
        option.textContent = `${entry.name} (${sourceLabel(entry)})`;
        select.appendChild(option);
    }
    if (previous && entries.some((entry) => entry.id === previous)) {
        select.value = previous;
    }

    const hasEntries = entries.length > 0;
    if (empty) empty.classList.toggle('hidden', hasEntries);
    if (list) list.classList.toggle('hidden', !hasEntries);
    if (button) {
        button.textContent = placementActionLabel(nodeSettings.nodeType);
        button.disabled = !hasEntries || !placementTarget(nodeSettings.nodeType);
    }
}

async function onPlace() {
    const unavailable = placementUnavailableMessage(nodeSettings.nodeType);
    if (unavailable) {
        setPlaceMessage(unavailable, 'error');
        return;
    }
    const select = document.getElementById('library-place-select');
    const id = select && select.value;
    if (!id) {
        setPlaceMessage('Choose a Library resource to place.', 'error');
        return;
    }
    const entry = await getLibraryEntry(id);
    if (!entry) {
        setPlaceMessage('That Library resource is no longer saved on this device.', 'error');
        await refreshLibraryPlace();
        return;
    }
    await placeEntry(entry);
    await refreshLibraryPlace();
}

async function onAddAndPlace() {
    const input = document.getElementById('library-place-file');
    const nameInput = document.getElementById('library-place-name');
    const file = input && input.files && input.files[0];
    if (!file) {
        setPlaceMessage('Choose a GLB file to add to your Library.', 'error');
        return;
    }
    const check = validateUploadFile({ name: file.name, size: file.size });
    if (!check.ok) {
        setPlaceMessage(check.message, 'error');
        return;
    }
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (!looksLikeGlb(bytes)) {
        setPlaceMessage(LIBRARY_MESSAGES.notGlbPayload, 'error');
        return;
    }
    const entry = buildFileEntry({
        id: createLibraryId(),
        filename: file.name,
        name: nameInput ? nameInput.value : '',
        byteSize: bytes.byteLength,
        now: new Date().toISOString(),
    });
    try {
        await saveLibraryEntry(entry, bytes);
    } catch (error) {
        console.error('Library save before place failed:', error);
        setPlaceMessage(storageFailureMessage(error), 'error');
        return;
    }
    if (input) input.value = '';
    if (nameInput) nameInput.value = '';
    await refreshLibraryPlace();
    const select = document.getElementById('library-place-select');
    if (select) select.value = entry.id;
    const placed = await placeBytes(bytes, entry.name);
    if (!placed) {
        const existing = document.getElementById('library-place-message');
        const detail = existing && existing.textContent ? existing.textContent : 'It could not be placed.';
        setPlaceMessage(`Saved ${entry.name} in your Library. ${detail}`, 'error');
    }
}

export function initLibraryPlace() {
    const placeBtn = document.getElementById('library-place-btn');
    const addBtn = document.getElementById('library-place-add-btn');
    if (placeBtn && placeBtn.dataset.bound !== '1') {
        placeBtn.dataset.bound = '1';
        placeBtn.addEventListener('click', () => { onPlace(); });
    }
    if (addBtn && addBtn.dataset.bound !== '1') {
        addBtn.dataset.bound = '1';
        addBtn.addEventListener('click', () => { onAddAndPlace(); });
    }
}
