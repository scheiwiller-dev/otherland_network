import { getCardinalActor } from '../nodeManager.js';
import { getIdentity } from '../user.js';
import { refreshAdminAccess } from './adminPanel.js';
import {
    ADMIN_CLAIM_TEXT,
    adminClaimVisibility,
    loadAdminClaimStatus,
    submitAdminClaim,
} from './adminClaim.js';

let boundDocument = null;
let session = null;

function isAnonymous() {
    const identity = getIdentity();
    return !identity || identity.getPrincipal().isAnonymous();
}

function currentPrincipal() {
    const identity = getIdentity();
    if (!identity || identity.getPrincipal().isAnonymous()) return '';
    return identity.getPrincipal().toText();
}

function byId(id) {
    return document.getElementById(id);
}

function showElement(element, visible) {
    if (!element) return;
    element.classList.toggle('hidden', !visible);
}

function setFeedback(message, kind) {
    const feedback = byId('admin-claim-feedback');
    if (!feedback) return;
    feedback.textContent = message || '';
    if (kind) feedback.dataset.kind = kind;
    else delete feedback.dataset.kind;
}

function hideClaimRow() {
    const row = byId('claim-admin-row');
    if (row) row.classList.add('hidden');
}

function applyClaimRow(status) {
    const row = byId('claim-admin-row');
    const label = byId('claim-admin-status');
    if (!row) return;
    const visibility = adminClaimVisibility({
        anonymous: false,
        reachable: status.reachable,
        configured: status.configured,
    });
    if (visibility === 'hidden') {
        row.classList.add('hidden');
        return;
    }
    row.classList.remove('hidden');
    if (label) {
        label.textContent = visibility === 'retry'
            ? ADMIN_CLAIM_TEXT.rowUnreachable
            : ADMIN_CLAIM_TEXT.rowOffer;
    }
}

function setMode(mode) {
    if (session) session.mode = mode;
    const title = byId('admin-claim-title');
    const message = byId('admin-claim-message');
    const dismiss = byId('admin-claim-dismiss');
    if (title) {
        title.textContent = mode === 'success' ? 'Admin claimed' : ADMIN_CLAIM_TEXT.title;
    }
    showElement(byId('admin-claim-principal-label'), true);
    showElement(byId('admin-claim-principal'), true);

    if (mode === 'offer') {
        if (message) message.textContent = ADMIN_CLAIM_TEXT.offer;
        showElement(byId('admin-claim-token'), true);
        showElement(byId('admin-claim-submit'), true);
        showElement(byId('admin-claim-retry'), false);
        if (dismiss) dismiss.textContent = 'Not now';
        return;
    }
    if (mode === 'unreachable') {
        if (message) message.textContent = ADMIN_CLAIM_TEXT.unreachable;
        showElement(byId('admin-claim-token'), false);
        showElement(byId('admin-claim-submit'), false);
        showElement(byId('admin-claim-retry'), true);
        if (dismiss) dismiss.textContent = 'Not now';
        return;
    }
    if (mode === 'success') {
        if (message) message.textContent = ADMIN_CLAIM_TEXT.success;
        showElement(byId('admin-claim-token'), false);
        showElement(byId('admin-claim-submit'), false);
        showElement(byId('admin-claim-retry'), false);
        if (dismiss) dismiss.textContent = 'Continue';
        return;
    }
    showElement(byId('admin-claim-token'), false);
    showElement(byId('admin-claim-submit'), false);
    showElement(byId('admin-claim-retry'), false);
    if (dismiss) dismiss.textContent = 'Close';
}

function hideModal() {
    const modal = byId('admin-claim-modal');
    if (modal) modal.classList.add('hidden');
}

async function onDismiss() {
    if (!session) return;
    const succeeded = session.mode === 'success';
    const resolve = session.resolve;
    session = null;
    const tokenEl = byId('admin-claim-token');
    if (tokenEl) tokenEl.value = '';
    hideModal();
    try {
        await refreshAdminClaimEntry();
    } catch (error) {
        console.error('Could not refresh admin claim entry:', error);
    }
    resolve(succeeded);
}

async function onSubmit() {
    if (!session || session.mode !== 'offer' || session.busy) return;
    const tokenEl = byId('admin-claim-token');
    session.busy = true;
    const submit = byId('admin-claim-submit');
    if (submit) submit.disabled = true;
    try {
        let actor = session.actor;
        if (!actor) {
            try {
                actor = await getCardinalActor();
                if (session) session.actor = actor;
            } catch {
                actor = null;
            }
        }
        const outcome = await submitAdminClaim(actor, tokenEl ? tokenEl.value : '');
        if (!session) return;
        if (outcome.ok) {
            if (tokenEl) tokenEl.value = '';
            setFeedback('', null);
            hideClaimRow();
            setMode('success');
            try {
                await refreshAdminAccess();
            } catch (error) {
                console.error('Could not refresh admin access:', error);
            }
            return;
        }
        if (outcome.code === 'unreachable') {
            setFeedback('', null);
            setMode('unreachable');
            return;
        }
        if (outcome.code === 'already-claimed') {
            const message = byId('admin-claim-message');
            if (message) message.textContent = outcome.message;
            setFeedback('', null);
            hideClaimRow();
            setMode('info');
            return;
        }
        setFeedback(outcome.message, 'err');
    } finally {
        if (session) session.busy = false;
        if (submit) submit.disabled = false;
    }
}

async function onRetry() {
    if (!session || session.busy) return;
    session.busy = true;
    try {
        const status = await loadAdminClaimStatus(() => getCardinalActor());
        if (!session) return;
        applyClaimRow(status);
        if (status.reachable && status.configured) {
            const message = byId('admin-claim-message');
            if (message) message.textContent = 'Admin has already been claimed';
            setFeedback('', null);
            setMode('info');
            return;
        }
        if (!status.reachable) {
            setFeedback('', null);
            setMode('unreachable');
            return;
        }
        session.actor = status.actor;
        setFeedback('', null);
        setMode('offer');
        const tokenEl = byId('admin-claim-token');
        if (tokenEl && typeof tokenEl.focus === 'function') tokenEl.focus();
    } finally {
        if (session) session.busy = false;
    }
}

function onKeyDown(event) {
    const modal = byId('admin-claim-modal');
    if (!modal || modal.classList.contains('hidden')) return;
    if (event.key === 'Escape') {
        event.preventDefault();
        onDismiss();
    }
}

function ensureBound() {
    if (!document || boundDocument === document) return;
    boundDocument = document;
    session = null;

    const submit = byId('admin-claim-submit');
    if (submit) submit.addEventListener('click', () => onSubmit());
    const dismiss = byId('admin-claim-dismiss');
    if (dismiss) dismiss.addEventListener('click', () => onDismiss());
    const retry = byId('admin-claim-retry');
    if (retry) retry.addEventListener('click', () => onRetry());
    const token = byId('admin-claim-token');
    if (token) {
        token.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') {
                event.preventDefault();
                onSubmit();
            }
        });
    }
    const modal = byId('admin-claim-modal');
    if (modal) {
        modal.addEventListener('click', (event) => {
            if (event.target === modal) onDismiss();
        });
    }
    const claimBtn = byId('claim-admin-btn');
    if (claimBtn) {
        claimBtn.addEventListener('click', () => openAdminClaimFromProfile());
    }
    document.addEventListener('keydown', onKeyDown);
}

/** Bind dialog buttons. Safe to call more than once. */
export function initAdminClaimDialog() {
    ensureBound();
}

/**
 * Show the claim dialog and resolve true only after a successful claim.
 * Does not use `window.prompt` or `window.alert`.
 */
export function promptAdminClaim({ principal, status } = {}) {
    ensureBound();
    const modal = byId('admin-claim-modal');
    if (!modal) {
        console.error('Admin claim dialog is missing from the page');
        return Promise.resolve(false);
    }
    if (session) return session.promise;

    let resolve;
    const promise = new Promise((done) => { resolve = done; });
    session = {
        resolve,
        promise,
        actor: status && status.actor ? status.actor : null,
        mode: 'offer',
        busy: false,
    };
    const principalEl = byId('admin-claim-principal');
    if (principalEl) principalEl.textContent = principal || currentPrincipal();
    const tokenEl = byId('admin-claim-token');
    if (tokenEl) tokenEl.value = '';
    setFeedback('', null);
    if (status && status.reachable === false) setMode('unreachable');
    else setMode('offer');
    modal.classList.remove('hidden');
    if (session.mode === 'offer' && tokenEl && typeof tokenEl.focus === 'function') tokenEl.focus();
    return promise;
}

/** Profile → Identity entry. No-op for guests, and hidden once an admin exists. */
export async function openAdminClaimFromProfile() {
    if (isAnonymous()) return false;
    const status = await loadAdminClaimStatus(() => getCardinalActor());
    applyClaimRow(status);
    if (status.reachable && status.configured) return false;
    return promptAdminClaim({ principal: currentPrincipal(), status });
}

/** Show or hide the Profile claim row from a fresh Cardinal check. */
export async function refreshAdminClaimEntry() {
    const row = byId('claim-admin-row');
    if (!row) return;
    if (isAnonymous()) {
        row.classList.add('hidden');
        return;
    }
    const status = await loadAdminClaimStatus(() => getCardinalActor());
    applyClaimRow(status);
}
