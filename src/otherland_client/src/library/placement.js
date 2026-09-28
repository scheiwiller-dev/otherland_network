/** Which world a Library entry can be placed into. Node types match nodeSettings. */

export function placementTarget(nodeType) {
    if (nodeType === 0) return 'treehouse';
    if (nodeType === 2) return 'node';
    return null;
}

export function placementActionLabel(nodeType) {
    if (nodeType === 0) return 'Place in TreeHouse';
    if (nodeType === 2) return 'Place in this node';
    return 'Place';
}

export function placementUnavailableMessage(nodeType) {
    if (placementTarget(nodeType)) return '';
    return 'Open your TreeHouse or a node you can edit before placing a Library resource.';
}
