import { describe, expect, it } from 'vitest';
import { nodeHeading, ownerLine } from './nodeListLabel.js';

const canisterId = 'aaaaa-aa';
const owner = '2vxsx-fae';

describe('node list labels', () => {
    it('uses the title when set and the canister id otherwise', () => {
        expect(nodeHeading({ title: ' North dock ', canisterId })).toBe('North dock');
        expect(nodeHeading({ title: '   ', canisterId })).toBe(canisterId);
        expect(nodeHeading({ title: '', canisterId })).toBe(canisterId);
    });

    it('shows a registered username and falls back to the owner principal', () => {
        expect(ownerLine({ owner, username: 'ada', isPublic: true })).toBe('ada (Public)');
        expect(ownerLine({ owner, username: owner, isPublic: false })).toBe(`${owner} (Private)`);
    });
});
