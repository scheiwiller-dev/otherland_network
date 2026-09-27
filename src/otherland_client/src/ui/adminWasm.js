import { getCardinalActor } from '../nodeManager.js';
import { getIdentity } from '../user.js';

/** Ask the logged-in principal to claim admin while Cardinal is still unclaimed. */
export async function claimAdminIfNeeded() {
    const identity = getIdentity();
    if (!identity || identity.getPrincipal().isAnonymous()) return false;

    const actor = await getCardinalActor();
    if (await actor.isAdminConfigured()) return true;

    const principal = identity.getPrincipal().toText();
    const token = window.prompt(
        'Cardinal has no admin yet.\n\nYour principal:\n' + principal +
        '\n\nPaste the one-time setup token printed by:\nicp canister logs cardinal'
    );
    if (!token || !token.trim()) return false;

    const result = await actor.claimAdmin(token.trim());
    if (result && 'err' in result) {
        window.alert(result.err);
        return false;
    }
    window.alert('This Internet Identity is now the Cardinal admin.');
    const { refreshAdminAccess } = await import('./adminPanel.js');
    await refreshAdminAccess();
    return true;
}

/**
 * WASM upload for admins. Password gate removed — canister enforces admin access.
 * Ignores #wasm-pw if present in the DOM.
 */
function setWasmStatus(message) {
    const status = document.getElementById('wasm-admin-status');
    if (status) status.textContent = message;
}

export function initAdminWasm() {
    const upgradeBtn = document.getElementById('upgrade-node-btn');
    if (upgradeBtn) {
        upgradeBtn.addEventListener('click', async () => {
            try {
                const actor = await getCardinalActor();
                const result = await actor.upgradeCanister();
                if (result && 'err' in result) {
                    setWasmStatus(result.err);
                    return;
                }
                setWasmStatus('Node upgraded.');
            } catch (error) {
                console.error('Node upgrade failed:', error);
                setWasmStatus('Node upgrade failed.');
            }
        });
    }

    const wasmFile = document.getElementById('wasm-file-input');
    if (!wasmFile) return;

    wasmFile.addEventListener('change', async () => {
        const file = wasmFile.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async () => {
            const wasmArrayBuffer = reader.result;
            const wasmBlob = new Uint8Array(wasmArrayBuffer);

            try {
                const claimed = await claimAdminIfNeeded();
                if (!claimed) return;
                const actor = await getCardinalActor();
                const result = await actor.uploadWasmModule(wasmBlob);
                if (result && 'err' in result) {
                    setWasmStatus(result.err);
                    return;
                }
                setWasmStatus('WASM module uploaded. Upgrade the node to install it.');
            } catch (error) {
                console.error('Error uploading WASM module:', error);
                setWasmStatus('WASM upload failed.');
            }
        };
        reader.readAsArrayBuffer(file);
    });
}
