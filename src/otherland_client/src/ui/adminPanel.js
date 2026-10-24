import { getCardinalActor } from '../nodeManager.js';
import { getIdentity } from '../user.js';

function formatCycles(value) {
    const cycles = BigInt(value);
    const trillion = 1_000_000_000_000n;
    const whole = cycles / trillion;
    const fraction = (cycles % trillion) / 1_000_000_000n;
    return `${whole.toString()}.${fraction.toString().padStart(3, '0')} T`;
}

/** Show the Admin sidebar entry only for the Cardinal admin. */
export async function refreshAdminAccess() {
    const button = document.getElementById('admin-btn');
    if (!button) return;

    const identity = getIdentity();
    if (!identity || identity.getPrincipal().isAnonymous()) {
        button.classList.add('hidden');
        return;
    }

    try {
        const actor = await getCardinalActor();
        const isAdmin = await actor.callerIsAdmin();
        button.classList.toggle('hidden', !isAdmin);
    } catch (error) {
        console.error('Failed to check admin access:', error);
        button.classList.add('hidden');
    }
}

/** Read Cardinal's cycle balance into the admin tab. */
export async function refreshCardinalCycles() {
    const balanceEl = document.getElementById('cardinal-cycles-balance');
    if (!balanceEl) return;

    try {
        const actor = await getCardinalActor();
        const balance = await actor.getCyclesBalance();
        balanceEl.textContent = balance && balance.length > 0
            ? formatCycles(balance[0])
            : 'Unavailable';
    } catch (error) {
        console.error('Failed to read Cardinal cycles:', error);
        balanceEl.textContent = 'Unavailable';
    }
}

export function initAdminPanel() {
    const refreshBtn = document.getElementById('refresh-cardinal-cycles-btn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', () => {
            refreshCardinalCycles();
        });
    }
}
