import { describe, expect, it } from 'vitest';
import {
    shouldAutoEnterTreehouse,
    shouldPresentSignInScreen,
    shouldShowWalkPrompt,
    showSignInScreen,
} from './guestEntry.js';

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

    it('keeps the sign-in screen off the guest first load', () => {
        expect(shouldPresentSignInScreen(identity({ anonymous: true }), '')).toBe(false);
        expect(shouldPresentSignInScreen(null, '')).toBe(false);
        expect(shouldPresentSignInScreen(identity({ anonymous: false }), '')).toBe(false);
    });

    it('shows the sign-in screen for an invite link', () => {
        expect(shouldPresentSignInScreen(identity({ anonymous: true }), '?peerId=abc')).toBe(true);
    });

    it('restores the login buttons when the sign-in screen is shown', () => {
        const lead = { textContent: 'Opening your TreeHouse…' };
        const login = { style: { display: 'none' } };
        const guest = { style: { display: 'none' } };
        const start = {
            classList: { remove: (name) => { start.hidden = name !== 'hidden'; } },
            style: { display: 'none' },
            querySelector: () => lead,
            hidden: true,
        };
        globalThis.document = {
            getElementById(id) {
                if (id === 'start-screen') return start;
                if (id === 'connect-ii-btn') return login;
                if (id === 'continue-guest-btn') return guest;
                return null;
            },
        };

        showSignInScreen();

        expect(start.style.display).toBe('flex');
        expect(start.hidden).toBe(false);
        expect(login.style.display).toBe('');
        expect(guest.style.display).toBe('');
        expect(lead.textContent).toMatch(/Internet Computer/);
    });

    it('shows the click-to-look hint on desktop', () => {
        expect(shouldShowWalkPrompt({})).toBe(true);
        expect(shouldShowWalkPrompt({ ontouchstart: true })).toBe(false);
    });
});
