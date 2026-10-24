/** Assemble a khet record from already-resolved GLB bytes and pose. */

export function assembleKhet({
    khetId,
    khetType,
    gltfData,
    hash,
    position,
    scale,
    originalSize,
    animations = [],
    textures = [],
    code = null,
}) {
    return {
        khetId,
        khetType,
        gltfData,
        gltfDataRef: [],
        gltfDataSize: gltfData.byteLength,
        position,
        originalSize,
        scale,
        textures,
        animations,
        code: code ? [code] : [],
        supportedInteractions: ['editProperty'],
        interactionPoints: [],
        hash,
    };
}
