import { personLabel } from './principalLabel.js';

/** Title when the owner has set one, otherwise the canister id. */
export function nodeHeading(node) {
    const title = node && typeof node.title === 'string' ? node.title.trim() : '';
    if (title) return title;
    return node && node.canisterId ? node.canisterId : '';
}

/** Owner username when one is registered, otherwise the owner principal. */
export function ownerLine(node) {
    const owner = node && node.owner ? node.owner : '';
    const username = node && node.username && node.username !== owner ? node.username : '';
    const label = personLabel(owner, username ? [username] : []);
    const visibility = node && node.isPublic ? 'Public' : 'Private';
    return `${label.primary} (${visibility})`;
}
