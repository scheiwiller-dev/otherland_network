const SIGN_IN_LEAD = 'Building connected virtual realms on the Internet Computer to create a shared environment for humans and digital lifeforms.';

function isAnonymous(identity) {
    return !identity
        || typeof identity.getPrincipal !== 'function'
        || identity.getPrincipal().isAnonymous();
}

/**
 * Anonymous first load opens the local TreeHouse.
 * An invite link (?peerId=) stays on the menu so the guest can join that house.
 */
export function shouldAutoEnterTreehouse(identity, search = '') {
    if (!isAnonymous(identity)) return false;
    return !new URLSearchParams(search).get('peerId');
}

/**
 * The sign-in screen is hidden on first paint.
 * Show it for an invite link. A plain guest load enters TreeHouse instead.
 * Logout calls showSignInScreen directly.
 */
export function shouldPresentSignInScreen(identity, search = '') {
    if (shouldAutoEnterTreehouse(identity, search)) return false;
    return isAnonymous(identity);
}

/** Reveal the login buttons. Inline display wins over the first-paint hidden class. */
export function showSignInScreen() {
    const start = document.getElementById('start-screen');
    if (!start) return;
    start.classList.remove('hidden');
    start.style.display = 'flex';
    const lead = start.querySelector('h3');
    if (lead) lead.textContent = SIGN_IN_LEAD;
    for (const id of ['connect-ii-btn', 'continue-guest-btn']) {
        const button = document.getElementById(id);
        if (button) button.style.display = '';
    }
}

export function shouldShowWalkPrompt(win = globalThis.window) {
    return !win || !('ontouchstart' in win);
}

export function showWalkPrompt() {
    const prompt = document.getElementById('walk-prompt');
    if (prompt) prompt.classList.remove('hidden');
}

export function hideWalkPrompt() {
    const prompt = document.getElementById('walk-prompt');
    if (prompt) prompt.classList.add('hidden');
}

/** Click the hint or the world to request pointer lock. Menus do not steal the click. */
export function initWalkPrompt(lockPointer) {
    const request = async () => {
        hideWalkPrompt();
        try {
            await lockPointer();
        } catch (error) {
            console.warn('Pointer lock was not granted', error);
            showWalkPrompt();
        }
    };

    const prompt = document.getElementById('walk-prompt');
    if (prompt && prompt.dataset.bound !== 'true') {
        prompt.dataset.bound = 'true';
        prompt.addEventListener('click', request);
    }

    const canvas = document.getElementById('canvas');
    if (canvas && canvas.dataset.walkBound !== 'true') {
        canvas.dataset.walkBound = 'true';
        canvas.addEventListener('click', () => {
            if (document.pointerLockElement) return;
            const mainMenu = document.getElementById('main-menu');
            const gameMenu = document.getElementById('game-menu');
            if (mainMenu && mainMenu.style.display === 'flex') return;
            if (gameMenu && gameMenu.style.display === 'flex') return;
            request();
        });
    }
}

/** Replace the sign-in gate with a short opening line while the local world starts. */
export function markTreehouseOpening() {
    const start = document.getElementById('start-screen');
    if (!start) return;
    const lead = start.querySelector('h3');
    if (lead) lead.textContent = 'Opening your TreeHouse…';
    for (const id of ['connect-ii-btn', 'continue-guest-btn']) {
        const button = document.getElementById(id);
        if (button) button.style.display = 'none';
    }
}
