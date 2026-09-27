/** Copy for controls that stay visible but are not available yet. */
export const LOCKED_FEATURES = {
    'wallet-btn': {
        title: 'Wallet',
        message: 'Wallet stays locked until you sign in with Internet Identity. A later update can also require a payment or cycles balance.',
    },
    'settings-btn': {
        title: 'Settings',
        message: 'Settings stays locked until you sign in with Internet Identity. More options can be added after that.',
    },
};

export function lockedFeatureCopy(id) {
    return LOCKED_FEATURES[id] || {
        title: 'Locked',
        message: 'This stays locked until you sign in with Internet Identity. Later updates can add more requirements.',
    };
}

export function openLockedFeature(id) {
    const copy = lockedFeatureCopy(id);
    const modal = document.getElementById('locked-feature-modal');
    const title = document.getElementById('locked-feature-title');
    const message = document.getElementById('locked-feature-message');
    if (!modal || !title || !message) return;
    title.textContent = copy.title;
    message.textContent = copy.message;
    modal.classList.remove('hidden');
}

export function closeLockedFeature() {
    const modal = document.getElementById('locked-feature-modal');
    if (modal) modal.classList.add('hidden');
}

/** Clicks on locked buttons explain the unlock condition. They do not open the empty tab. */
export function initLockedFeatures() {
    document.querySelectorAll('button.future-update').forEach((button) => {
        button.addEventListener('click', (event) => {
            event.preventDefault();
            openLockedFeature(button.id);
        });
    });
    const close = document.getElementById('locked-feature-close');
    if (close) close.addEventListener('click', closeLockedFeature);
    const modal = document.getElementById('locked-feature-modal');
    if (modal) {
        modal.addEventListener('click', (event) => {
            if (event.target === modal) closeLockedFeature();
        });
    }
}
