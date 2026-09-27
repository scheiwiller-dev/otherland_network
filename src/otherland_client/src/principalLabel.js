/** Username as the main label, principal as the secondary line when a name exists. */
export function personLabel(principalText, nameOpt) {
    const name = nameOpt && nameOpt.length && nameOpt[0] ? String(nameOpt[0]) : '';
    if (!name || name === principalText) {
        return { primary: principalText, secondary: '' };
    }
    return { primary: name, secondary: principalText };
}

export async function lookupPersonLabel(actor, principal) {
    const principalText = principal.toText();
    try {
        const nameOpt = await actor.getUsername(principal);
        return personLabel(principalText, nameOpt);
    } catch (error) {
        console.error('Failed to look up username:', error);
        return personLabel(principalText, []);
    }
}

/** Fill an element with the name and, when present, the principal underneath. */
export function renderPerson(parent, label) {
    parent.textContent = '';
    const primary = document.createElement('div');
    primary.textContent = label.primary;
    if (!label.secondary) primary.className = 'principal-id';
    parent.appendChild(primary);
    if (label.secondary) {
        const secondary = document.createElement('div');
        secondary.className = 'principal-id';
        secondary.textContent = label.secondary;
        parent.appendChild(secondary);
    }
}
