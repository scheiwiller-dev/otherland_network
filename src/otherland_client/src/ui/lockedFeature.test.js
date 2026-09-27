import { describe, expect, it } from 'vitest';
import { lockedFeatureCopy } from './lockedFeature.js';

describe('locked feature copy', () => {
    it('names the sign-in requirement for each locked control', () => {
        for (const id of ['wallet-btn', 'settings-btn', 'node-config-btn']) {
            const copy = lockedFeatureCopy(id);
            expect(copy.title.length).toBeGreaterThan(0);
            expect(copy.message).toMatch(/Internet Identity/);
        }
        expect(lockedFeatureCopy('wallet-btn').message).toMatch(/payment/);
        expect(lockedFeatureCopy('node-config-btn').title).toMatch(/TreeHouse/);
        expect(lockedFeatureCopy('settings-btn').message).not.toBe(lockedFeatureCopy('wallet-btn').message);
    });
});
