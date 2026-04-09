import * as THREE from 'three';
import { XRControllerModelFactory } from 'three/examples/jsm/webxr/XRControllerModelFactory.js';
import { XRHandModelFactory } from 'three/examples/jsm/webxr/XRHandModelFactory.js';
import { HTMLMesh } from 'three/examples/jsm/interactive/HTMLMesh.js';
import { InteractiveGroup } from 'three/examples/jsm/interactive/InteractiveGroup.js';
import RAPIER from '@dimforge/rapier3d-compat';

import { viewerState, sceneObjects } from './index.js';
import { avatarState } from './avatar.js';

// VR controller management
export const vrManager = {

    // VR Controller State
    controllers: [],          // Array of XR controllers
    controllerGrips: [],      // Controller grip models
    teleportRaycaster: new THREE.Raycaster(), // For teleportation
    teleportMarker: null,     // Visual marker for teleport destination
    isTeleporting: false,     // Flag to prevent multiple teleports
    pendingTeleportPosition: null, // Pending position for teleport
    teleportAimActive: false,     // Whether currently aiming/teleporting
    previousTriggerValues: [0, 0], // For detecting full press edge on analog trigger
    lastDebugTime: 0,             // Throttled debug for VR controller state

    // VR UI Panels
    uiPanels: [],             // Array of active UI panels
    interactiveGroup: null,   // InteractiveGroup for VR UI interaction

    // Initialize VR Controllers
    initVRControllers() {
        console.log('Initializing VR controllers...');

        // Reset VR teleport state
        this.pendingTeleportPosition = null;
        this.teleportAimActive = false;
        this.isTeleporting = false;
        this.previousTriggerValues = [0, 0];
        this.lastDebugTime = 0;

        // Setup VR camera attachment to playerRig (standard Three.js WebXR locomotion pattern)
        viewerState.renderer.xr.addEventListener('sessionstart', () => {
            const xrCamera = viewerState.renderer.xr.getCamera();
            
            // Clear previous parent if any
            if (xrCamera.parent) {
                xrCamera.parent.remove(xrCamera);
            }
            
            // Parent XR camera directly to playerRig (XR updates local transform for head tracking; rig moves base position)
            viewerState.playerRig.add(xrCamera);
            
            // Eye height offset (local to rig; adjust to match avatar height)
            xrCamera.position.y = 1.6;

            // Create InteractiveGroup for VR UI interaction
            this.interactiveGroup = new InteractiveGroup(viewerState.renderer, viewerState.scene);
            viewerState.scene.add(this.interactiveGroup);

            // Create VR UI panel for the main menu
            this.createUIPanel('main-menu', new THREE.Vector3(0, 1.5, -1), new THREE.Euler(-Math.PI / 6, 0, 0), 0.5);

            console.log('VR session started - XR camera attached to playerRig');

            // Unlock pointer controls when entering VR
            if (viewerState.controls && viewerState.controls.isLocked) {
                viewerState.controls.unlock();
            }
        });

        viewerState.renderer.xr.addEventListener('sessionend', () => {
            console.log('VR session ended');
            // Remove VR UI panels
            this.uiPanels.forEach(panel => {
                this.removeUIPanel(panel.id);
            });
            // Camera will be managed by Three.js on exit
        });

        // Create controller instances
        for (let i = 0; i < 2; i++) {
            const controller = viewerState.renderer.xr.getController(i);
            console.log(`Controller ${i} created:`, controller);

            // Add controller to playerRig so it moves with the player
            viewerState.playerRig.add(controller);

            // Create controller model
            const controllerModelFactory = new XRControllerModelFactory();
            const controllerGrip = viewerState.renderer.xr.getControllerGrip(i);
            controllerGrip.add(controllerModelFactory.createControllerModel(controllerGrip));
            viewerState.playerRig.add(controllerGrip);

            // Store references
            this.controllers.push(controller);
            this.controllerGrips.push(controllerGrip);

            // Add event listeners for buttons
            controller.addEventListener('selectstart', (event) => {
                console.log(`Controller ${i} select button pressed`);
                this.handleControllerSelectStart(i, event);
            });

            controller.addEventListener('selectend', (event) => {
                console.log(`Controller ${i} select button released`);
                this.handleControllerSelectEnd(i, event);
            });

            controller.addEventListener('squeezestart', (event) => {
                console.log(`Controller ${i} squeeze button pressed`);
                this.handleControllerSqueezeStart(i, event);
            });

            controller.addEventListener('squeezeend', (event) => {
                console.log(`Controller ${i} squeeze button released`);
                this.handleControllerSqueezeEnd(i, event);
            });

            // Add interactive group event listeners for UI interaction
            controller.addEventListener('selectstart', () => this.interactiveGroup?.handlePointerDown(controller));
            controller.addEventListener('selectend', () => this.interactiveGroup?.handlePointerUp(controller));

            // Add connected/disconnected listeners
            controller.addEventListener('connected', (event) => {
                console.log(`Controller ${i} connected:`, event.data);
                console.log(`Controller ${i} gamepad:`, event.data.gamepad);
                if (event.data.gamepad) {
                    console.log(`Controller ${i} has ${event.data.gamepad.buttons.length} buttons and ${event.data.gamepad.axes.length} axes`);
                }
                // Assign inputSource so polling and raycasting see it in update loop
                controller.inputSource = event.inputSource || event.data;
                // Hide default model to show only the Vive controller
                if (controller.model) {
                    controller.model.visible = false;
                    console.log(`Hidden default model for controller ${i}`);
                }
            });

            controller.addEventListener('disconnected', (event) => {
                console.log(`Controller ${i} disconnected`);
                controller.inputSource = null;
            });
        }

        // Create teleport marker
        this.createTeleportMarker();

        console.log('VR controllers initialized');
    },

    // Create visual marker for teleport destination
    createTeleportMarker() {
        console.log('Creating teleport marker...');

        // Create a ring geometry for the teleport marker
        const markerGeometry = new THREE.RingGeometry(0.1, 0.15, 16);
        const markerMaterial = new THREE.MeshBasicMaterial({
            color: 0x00ff00,
            transparent: true,
            opacity: 0.8,
            side: THREE.DoubleSide
        });

        this.teleportMarker = new THREE.Mesh(markerGeometry, markerMaterial);
        this.teleportMarker.rotation.x = -Math.PI / 2; // Lay flat on ground
        this.teleportMarker.visible = false; // Initially hidden
        viewerState.scene.add(this.teleportMarker);

        console.log('Teleport marker created');
    },

    // Create a VR UI panel from a DOM element
    createUIPanel(elementId, position = new THREE.Vector3(0, 1.5, -1), rotation = new THREE.Euler(-Math.PI / 6, 0, 0), scale = 0.5, attachToRig = true) {
        const uiElement = document.getElementById(elementId);
        if (!uiElement) {
            console.error(`Element with id '${elementId}' not found`);
            return null;
        }

        // Clone the element to avoid modifying the original
        const clonedElement = uiElement.cloneNode(true);
        clonedElement.style.position = 'absolute';
        clonedElement.style.left = '-9999px';
        clonedElement.style.top = '0';
        clonedElement.style.width = '800px';
        clonedElement.style.height = '600px';
        clonedElement.style.display = 'flex'; // Ensure it's visible
        document.body.appendChild(clonedElement);

        // Create HTMLMesh
        const htmlMesh = new HTMLMesh(clonedElement);
        htmlMesh.position.copy(position);
        htmlMesh.rotation.copy(rotation);
        htmlMesh.scale.setScalar(scale);

        // Attach to playerRig so it follows the avatar
        const parent = attachToRig ? viewerState.playerRig : viewerState.scene;
        parent.add(htmlMesh);

        // Add to interactive group for VR interaction
        if (this.interactiveGroup) {
            this.interactiveGroup.add(htmlMesh);
        }

        // Store reference
        const panel = {
            id: elementId,
            mesh: htmlMesh,
            element: clonedElement,
            position: position,
            rotation: rotation,
            scale: scale,
            attachToRig: attachToRig
        };
        this.uiPanels.push(panel);

        console.log(`VR UI panel created for '${elementId}'`);
        return panel;
    },

    // Remove a VR UI panel
    removeUIPanel(panelId) {
        const panelIndex = this.uiPanels.findIndex(p => p.id === panelId);
        if (panelIndex === -1) return;

        const panel = this.uiPanels[panelIndex];
        const parent = panel.attachToRig ? viewerState.playerRig : viewerState.scene;
        parent.remove(panel.mesh);
        if (this.interactiveGroup) {
            this.interactiveGroup.remove(panel.mesh);
        }
        document.body.removeChild(panel.element);
        this.uiPanels.splice(panelIndex, 1);

        console.log(`VR UI panel removed for '${panelId}'`);
    },

    // Handle controller select start (trigger button)
    handleControllerSelectStart(controllerIndex, event) {
        console.log(`Controller ${controllerIndex} select button pressed`);
        const controller = this.controllers[controllerIndex];
        if (!controller) return;

        this.teleportAimActive = true;
        this.isTeleporting = true;

        // Initial raycast to start preview
        this.teleportRaycaster.setFromXRController(controller);
        const intersects = this.teleportRaycaster.intersectObjects(sceneObjects, true);
        if (intersects.length > 0) {
            const intersection = intersects[0];
            this.teleportMarker.position.copy(intersection.point);
            this.teleportMarker.position.y += 0.02;
            this.teleportMarker.visible = true;
            this.pendingTeleportPosition = intersection.point.clone();
            console.log(`[Teleport] Initial preview at`, intersection.point);
        }
    },

    // Handle controller select end (trigger release)
    handleControllerSelectEnd(controllerIndex, event) {
        console.log(`Controller ${controllerIndex} select button released`);
        if (this.teleportAimActive && this.pendingTeleportPosition) {
            this.performTeleport();
        } else {
            this.teleportMarker.visible = false;
            this.teleportAimActive = false;
            this.isTeleporting = false;
        }
    },

    // Perform the actual teleport using the pending position
    performTeleport() {
        if (!this.pendingTeleportPosition) return;

        console.log('Executing teleport to:', this.pendingTeleportPosition);

        // Teleport player rig to new position
        if (viewerState.playerRig) {
            // Keep the Y position relative to avatar height
            const currentY = viewerState.playerRig.position.y;
            viewerState.playerRig.position.copy(this.pendingTeleportPosition);
            viewerState.playerRig.position.y = currentY;

            console.log('Player rig teleported to new position');

            // Also update avatar position if it exists
            if (avatarState.avatarBody) {
                const newPos = avatarState.avatarBody.translation();
                newPos.x = this.pendingTeleportPosition.x;
                newPos.z = this.pendingTeleportPosition.z;
                avatarState.avatarBody.setTranslation(newPos, true);
                avatarState.avatarBody.wakeUp();
                console.log('Avatar body position updated');
            }
        }

        // Hide marker and reset state
        this.teleportMarker.visible = false;
        this.isTeleporting = false;
        this.teleportAimActive = false;
        this.pendingTeleportPosition = null;

        console.log('Teleport completed');
    },

    // Handle controller squeeze start (grip button)
    handleControllerSqueezeStart(controllerIndex, event) {
        console.log(`Controller ${controllerIndex} squeeze start`);
        // Could be used for other interactions like grabbing objects
    },

    // Handle controller squeeze end (grip release)
    handleControllerSqueezeEnd(controllerIndex, event) {
        console.log(`Controller ${controllerIndex} squeeze end`);
        // Could be used for releasing grabbed objects
    },

    // Update VR controllers each frame
    updateVRControllers() {

        // Handle locomotion via thumbsticks
        this.handleVRThumbstickLocomotion();

        // Throttled debug to diagnose controller/gamepad/analog input (every 500ms)
        const now = Date.now();
        if (now - (this.lastDebugTime || 0) > 500) {
            console.log(`[VR-DEBUG] updateVRControllers - #controllers=${this.controllers.length}, presenting=${!!(viewerState.renderer.xr && viewerState.renderer.xr.isPresenting)}`);
            for (let j = 0; j < this.controllers.length; j++) {
                const c = this.controllers[j];
                const gp = c.inputSource?.gamepad;
                console.log(`[VR-DEBUG] C${j}: visible=${!!c.visible}, input=${!!c.inputSource}, gamepad=${!!gp}, buttons=${gp?.buttons?.length || 0}, trigger=${gp ? (gp.buttons[0]?.value||0).toFixed(2) : 'N/A'}`);
            }
            this.lastDebugTime = now;
        }

        // Update teleport preview if actively aiming (uses events for start/end, loop for live update)
        if (this.teleportAimActive && this.teleportMarker) {
            for (let i = 0; i < this.controllers.length; i++) {
                const controller = this.controllers[i];
                if (controller) {
                    this.teleportRaycaster.setFromXRController(controller);
                    const intersects = this.teleportRaycaster.intersectObjects(sceneObjects, true);

                    if (intersects.length > 0) {
                        const intersection = intersects[0];
                        this.teleportMarker.position.copy(intersection.point);
                        this.teleportMarker.position.y += 0.02;
                        this.pendingTeleportPosition = intersection.point.clone();
                        break; // Update from first valid controller
                    }
                }
            }
        }
    },

    // Handle VR thumbstick locomotion
    handleVRThumbstickLocomotion() {
        if (!avatarState.avatarBody || !avatarState.isGrounded || !viewerState.playerRig) {
            return;
        }

        // Use the first available controller's thumbstick for locomotion
        for (let i = 0; i < this.controllers.length; i++) {
            const controller = this.controllers[i];
            if (controller && controller.inputSource?.gamepad) {
                const gamepad = controller.inputSource.gamepad;
                if (gamepad.axes.length >= 2) {
                    const thumbstickX = gamepad.axes[0]; // Left/right
                    const thumbstickY = gamepad.axes[1]; // Forward/backward

                    // Apply deadzone
                    const deadzone = 0.1;
                    const magnitude = Math.sqrt(thumbstickX * thumbstickX + thumbstickY * thumbstickY);
                    if (magnitude < deadzone) {
                        continue; // Skip if thumbstick is in deadzone
                    }

                    console.log(`Controller ${i} thumbstick: x=${thumbstickX.toFixed(2)}, y=${thumbstickY.toFixed(2)}`);

                    // Get camera direction for movement relative to view
                    const camDirection = new THREE.Vector3();
                    viewerState.renderer.xr.getCamera().getWorldDirection(camDirection);
                    camDirection.y = 0;
                    camDirection.normalize();

                    // Calculate movement direction
                    const right = new THREE.Vector3().crossVectors(camDirection, new THREE.Vector3(0, 1, 0));
                    const movementDirection = new THREE.Vector3()
                        .addScaledVector(camDirection, -thumbstickY) // Forward/backward
                        .addScaledVector(right, thumbstickX); // Left/right

                    movementDirection.normalize();

                    // Apply movement
                    const speed = 2.0; // VR locomotion speed
                    const delta = 1/60; // Assume 60fps for now
                    const desiredMovement = movementDirection.clone().multiplyScalar(speed * delta);

                    // Use character controller for collision-aware movement
                    const collider = avatarState.avatarBody.collider(0);
                    viewerState.characterController.computeColliderMovement(
                        collider,
                        new RAPIER.Vector3(desiredMovement.x, 0, desiredMovement.z)
                    );

                    const correctedMovement = viewerState.characterController.computedMovement();
                    const newPosition = avatarState.avatarBody.translation();
                    newPosition.x += correctedMovement.x;
                    newPosition.z += correctedMovement.z;
                    avatarState.avatarBody.setTranslation(newPosition, true);
                    avatarState.avatarBody.wakeUp();

                    // Sync playerRig position with avatar body for proper mesh movement and first-person view
                    viewerState.playerRig.position.x = newPosition.x;
                    viewerState.playerRig.position.z = newPosition.z;

                    console.log(`VR locomotion applied: dx=${correctedMovement.x.toFixed(3)}, dz=${correctedMovement.z.toFixed(3)}`);
                    break; // Use only the first controller with input
                }
            }
        }
    }
};