/** Mutable khet editor selection state (shared by khet table + asset UI). */
export let currentEditingKhetId = null;
export let editFormSnapshot = null;

export function setCurrentEditingKhetId(id, snapshot = null) {
    currentEditingKhetId = id;
    editFormSnapshot = snapshot;
}

export function clearCurrentEditingKhetId() {
    currentEditingKhetId = null;
    editFormSnapshot = null;
}
