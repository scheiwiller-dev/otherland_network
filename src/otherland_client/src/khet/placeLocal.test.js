import { describe, expect, it, vi } from 'vitest';
import { saveTreehouseKhet } from './placeLocal.js';

describe('saveTreehouseKhet', () => {
    it('caches the mesh and stores metadata without the bytes', async () => {
        const gltfData = new Uint8Array([9, 9]);
        const khet = { khetId: 'k1', khetType: 'SceneObject', gltfData, position: [0, 0, 0] };
        const saveToCache = vi.fn(async () => {});
        const nodeSettings = { localKhets: {}, saveLocalKhets: vi.fn() };
        const khetController = { khets: {} };

        const metadata = await saveTreehouseKhet(khet, { saveToCache, nodeSettings, khetController });

        expect(saveToCache).toHaveBeenCalledWith('k1', khet);
        expect(metadata.gltfData).toBeUndefined();
        expect(nodeSettings.localKhets.k1).toBe(metadata);
        expect(nodeSettings.localKhets.k1.khetType).toBe('SceneObject');
        expect(nodeSettings.saveLocalKhets).toHaveBeenCalledTimes(1);
        expect(khetController.khets.k1).toBe(khet);
    });
});
