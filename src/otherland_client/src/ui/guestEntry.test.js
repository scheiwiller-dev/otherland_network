import { describe, expect, it } from 'vitest';
import { shouldAutoEnterTreehouse, shouldShowWalkPrompt } from './guestEntry.js';

function identity({ anonymous }) {
    return { getPrincipal: () => ({ isAnonymous: () => anonymous }) };
}

describe('guest TreeHouse entry', () => {
    it('opens TreeHouse for an anonymous load with no invite', () => {
        expect(shouldAutoEnterTreehouse(identity({ anonymous: true }), '')).toBe(true);
        expect(shouldAutoEnterTreehouse(null, '')).toBe(true);
    });

    it('keeps a signed-in session on the menu', () => {
        expect(shouldAutoEnterTreehouse(identity({ anonymous: false }), '')).toBe(false);
    });

    it('keeps a TreeHouse invite on the menu', () => {
        expect(shouldAutoEnterTreehouse(identity({ anonymous: true }), '?peerId=abc')).toBe(false);
    });

    it('shows the click-to-look hint on desktop', () => {
        expect(shouldShowWalkPrompt({})).toBe(true);
        expect(shouldShowWalkPrompt({ ontouchstart: true })).toBe(false);
    });
});
