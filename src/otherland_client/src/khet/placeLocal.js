/**
 * TreeHouse placement. Bytes stay in KhetCache under a new khet id.
 * The Library catalogue is not written here and is not stored in KhetCache.
 */
export async function saveTreehouseKhet(khet, { saveToCache, nodeSettings, khetController }) {
    await saveToCache(khet.khetId, khet);
    const metadata = { ...khet };
    delete metadata.gltfData;
    nodeSettings.localKhets[khet.khetId] = metadata;
    nodeSettings.saveLocalKhets();
    khetController.khets[khet.khetId] = khet;
    return metadata;
}
