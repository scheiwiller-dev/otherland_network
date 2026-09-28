/**
 * Anonymous first load opens the local TreeHouse.
 * An invite link (?peerId=) stays on the menu so the guest can join that house.
 */
export function shouldAutoEnterTreehouse(identity, search = '') {
    const anonymous = !identity
        || typeof identity.getPrincipal !== 'function'
        || identity.getPrincipal().isAnonymous();
    if (!anonymous) return false;
    return !new URLSearchParams(search).get('peerId');
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
