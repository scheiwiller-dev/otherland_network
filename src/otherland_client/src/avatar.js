import { khetController } from './khet.js';
import { worldController } from './index.js';
import { sceneObjects, animationMixers, khetState } from './index.js';

// Avatar State
export const avatarState = {
    avatarBody: null,
    avatarMesh: null,
    selectedAvatarId: null,
    hasObjectPickedUp: false,
    collidingWithGround: new Set(), // remove?

    // Properties
    isGrounded: false,
    wasGrounded: false,
    lastGroundedY: 0,
    canJump: true,
    lastLandingTime: 0, // Initialize landing time


    setAvatarBody (newBody) {
        this.avatarBody = newBody;
        return;
    },
    setAvatarMesh (newMesh) {
        this.avatarMesh = newMesh;
        return;
    },
    getAvatarMesh () {
        return this.avatarMesh;
    },
    setSelectedAvatarId (newId) {
        this.selectedAvatarId = newId;
        return;
    },
    getSelectedAvatarId () {
        return this.selectedAvatarId;
    }
};

// Populate avatar selection buttons
export function populateAvatarButtons() {
    const avatars = khetController.getAvatars();
    const avatarButtonsContainer = document.getElementById("avatar-container");
    avatarButtonsContainer.innerHTML = ""; // Clear existing buttons
    avatars.forEach((avatar, index) => {
        const button = document.createElement('button');
        button.textContent = `Avatar ${avatar.khetId}`;
        button.setAttribute('data-avatar', avatar.khetId);
        button.addEventListener('click', async () => {
            console.log(`Selected Avatar ${avatar.khetId}`);

            // Load Avatar
            await worldController.setAvatar(avatar.khetId, { sceneObjects, animationMixers, khetState }); // Start animation for 1 frame?
            console.log(`Avatar loaded sucessfully`);
        });
        avatarButtonsContainer.appendChild(button);
    });
}