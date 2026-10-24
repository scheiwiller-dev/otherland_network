/** Calm copy for the Nodes tab when Cardinal cannot be reached. TreeHouse stays usable. */
export const CARDINAL_OFFLINE_STATUS =
    'Network features are offline. TreeHouse still works without Cardinal.';

export function setNetworkStatus(message) {
    const el = document.getElementById('network-status');
    if (el) el.textContent = message || '';
}

export function clearNetworkStatus() {
    setNetworkStatus('');
}

export function reportCardinalUnavailable(error) {
    console.warn(CARDINAL_OFFLINE_STATUS, error);
    setNetworkStatus(CARDINAL_OFFLINE_STATUS);
}
