import { getCardinalActor } from '../nodeManager.js';
import { getIdentity } from '../user.js';
import { CARDINAL_CALL_TIMEOUT_MS, CARDINAL_UNREACHABLE } from '../network.js';
import { reportCardinalUnavailable } from '../networkStatus.js';
import { loadAdminClaimStatus } from './adminClaim.js';
import { initAdminClaimDialog, promptAdminClaim, refreshAdminClaimEntry } from './adminClaimDialog.js';

/**
 * Ask the logged-in principal to claim admin while Cardinal is still unclaimed.
 * The Internet Identity window leaves this tab in the background, and Chrome
 * drops `window.prompt` there without showing it, so the claim uses an in-app dialog.
 * A timeout is unreachable, not "an admin already exists".
 */
export async function claimAdminIfNeeded() {
    const identity = getIdentity();
    if (!identity || identity.getPrincipal().isAnonymous()) return false;

    const status = await loadAdminClaimStatus(
        () => getCardinalActor(),
        CARDINAL_CALL_TIMEOUT_MS,
    );
    if (!status.reachable) {
        reportCardinalUnavailable(new Error(CARDINAL_UNREACHABLE));
    }
    if (status.reachable && status.configured) {
        await refreshAdminClaimEntry();
        return true;
    }

    return promptAdminClaim({
        principal: identity.getPrincipal().toText(),
        status,
    });
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
    initAdminClaimDialog();

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
                if (!claimed) {
                    setWasmStatus('Admin claim was not completed.');
                    return;
                }
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
