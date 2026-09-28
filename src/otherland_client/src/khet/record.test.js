import { describe, expect, it } from 'vitest';
import { assembleKhet } from './record.js';

describe('assembleKhet', () => {
    it('builds a placeable record from bytes and pose', () => {
        const gltfData = new Uint8Array([1, 2, 3, 4]);
        const khet = assembleKhet({
            khetId: 'khet-1',
            khetType: 'SceneObject',
            gltfData,
            hash: 'abc',
            position: [0, 0.5, -4],
            scale: [1, 1, 1],
            originalSize: [1, 1, 1],
            animations: [['idle']],
            code: '',
        });
        expect(khet).toMatchObject({
            khetId: 'khet-1',
            khetType: 'SceneObject',
            gltfDataSize: 4,
            gltfDataRef: [],
            position: [0, 0.5, -4],
            hash: 'abc',
            code: [],
            supportedInteractions: ['editProperty'],
        });
        expect(khet.gltfData).toBe(gltfData);
    });
});
