import { describe, expect, it } from 'vitest';
import { placementActionLabel, placementTarget, placementUnavailableMessage } from './placement.js';

describe('library placement target', () => {
    it('places into TreeHouse or an editable node', () => {
        expect(placementTarget(0)).toBe('treehouse');
        expect(placementTarget(2)).toBe('node');
        expect(placementTarget(1)).toBeNull();
        expect(placementTarget(3)).toBeNull();
        expect(placementActionLabel(0)).toBe('Place in TreeHouse');
        expect(placementActionLabel(2)).toBe('Place in this node');
        expect(placementUnavailableMessage(0)).toBe('');
        expect(placementUnavailableMessage(1)).toMatch(/TreeHouse/);
    });
});
