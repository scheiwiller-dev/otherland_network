import { describe, expect, it } from 'vitest';
import { LOCKED_FEATURES, lockedFeatureCopy } from './lockedFeature.js';

describe('locked feature copy', () => {
    it('names the sign-in requirement for wallet and app settings', () => {
        for (const id of ['wallet-btn', 'settings-btn']) {
            const copy = lockedFeatureCopy(id);
            expect(copy.title.length).toBeGreaterThan(0);
            expect(copy.message).toMatch(/Internet Identity/);
        }
        expect(lockedFeatureCopy('wallet-btn').message).toMatch(/payment/);
        expect(lockedFeatureCopy('settings-btn').message).not.toBe(lockedFeatureCopy('wallet-btn').message);
        expect(LOCKED_FEATURES['node-config-btn']).toBeUndefined();
    });
});
