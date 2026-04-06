import nipplejs from 'nipplejs';
import { XRControllerModelFactory } from 'three/examples/jsm/webxr/XRControllerModelFactory.js';
import { XRHandModelFactory } from 'three/examples/jsm/webxr/XRHandModelFactory.js';

import { keys, escButtonPress } from './menu.js';
import { viewerState } from './index.js';
import { avatarState } from './avatar.js';

// Constants for movement and jumping
const BASE_SPEED = 4.0;
const AIR_ACCELERATION = 15.0; // m/s², controls how quickly the avatar adjusts direction in air
const JUMP_FORCE = 7.0;

// Variables for camera rotation and movement
let yaw = 0;
let pitch = 0;
const maxPitch = (85 * Math.PI) / 180; // Limit pitch to ±85 degrees
const minPitch = (-85 * Math.PI) / 180;

let moveDirection = { x: 0, y: 0 }; // Joystick
let isSprinting = false;

// Touch control setup for mobile devices
export function setupTouchControls() {

    // Create virtual joystick
    const joystickZone = document.getElementById('joystick-zone');
    const joystick = nipplejs.create({
        zone: joystickZone,
        mode: 'dynamic',
        position: {
            left: '50%',
            top: '50%'
        },
        color: 'blue'
    });

    joystick.on('move', (evt, data) => {
        moveDirection.x = data.vector.x;
        moveDirection.y = -data.vector.y;
    });

    joystick.on('end', () => {
        moveDirection.x = 0;
        moveDirection.y = 0;
    });

    // Touch-based camera rotation
    let cameraTouchId = null;
    let lastTouchX = 0;
    let lastTouchY = 0;

    document.addEventListener('touchstart', (event) => {
        for (let touch of event.changedTouches) {

            // Use touches outside the joystick zone for camera rotation
            if (!joystickZone.contains(touch.target)) {
                cameraTouchId = touch.identifier;
                lastTouchX = touch.clientX;
                lastTouchY = touch.clientY;
                break; // Handle only one touch for camera
            }
        }
    });

    document.addEventListener('touchmove', (event) => {
        for (let touch of event.changedTouches) {
            if (touch.identifier === cameraTouchId) {
                const deltaX = touch.clientX - lastTouchX;
                const deltaY = touch.clientY - lastTouchY;
                lastTouchX = touch.clientX;
                lastTouchY = touch.clientY;
                yaw -= deltaX * 0.005;
                pitch -= deltaY * 0.005;
                pitch = Math.max(minPitch, Math.min(maxPitch, pitch));

                // Apply rotation to camera
                const euler = new THREE.Euler(pitch, yaw, 0, 'YXZ');
                viewerState.camera.quaternion.setFromEuler(euler);
            }
        }
    });

    document.addEventListener('touchend', (event) => {
        for (let touch of event.changedTouches) {
            if (touch.identifier === cameraTouchId) {
                cameraTouchId = null;
            }
        }
    });

    // Jump button handler                                                       Combine with other jump logic, not 2 different
    const jumpBtn = document.getElementById('jump-btn');
    jumpBtn.addEventListener('touchstart', () => {
        if (avatarState.selectedAvatarId !== null) {
            if (avatarState.avatarBody.canJump && avatarState.avatarBody.isGrounded) {
                const currentVel = avatarState.avatarBody.linvel();
                avatarState.avatarBody.setLinvel({
                    x: currentVel.x,
                    y: JUMP_FORCE,
                    z: currentVel.z
                }, true);
                avatarState.avatarBody.canJump = false;
            }
        }
    });

    // Sprint button handler                                                    Combine with other jump logic, not 2 different
    const sprintBtn = document.getElementById('sprint-btn');
    sprintBtn.addEventListener('touchstart', () => {
        isSprinting = true;
    });

    // Interaction button handler    
    const interactBtn = document.getElementById('interact-btn');
    interactBtn.addEventListener('touchstart', () => {
        keys.add('f');
    });
    interactBtn.addEventListener('touchend', () => {
        keys.delete('f');
    });

    // ESC button handler                                                       Combine with other jump logic, not 2 different
    const escBtn = document.getElementById('esc-btn');
    escBtn.addEventListener('touchstart', () => {
        escButtonPress();
    });
}

// Own Interaction with World
export function applyPlayerMovement(camDirection, delta) {

    const isVR = !!(viewerState.renderer && viewerState.renderer.xr && viewerState.renderer.xr.isPresenting);
    const currentCamera = isVR ? viewerState.renderer.xr.getCamera() : viewerState.camera;

    if (viewerState.controls.isLocked || isTouchDevice || isVR) {
        if (avatarState.avatarMesh && avatarState.avatarBody) {
            
            const collider = avatarState.avatarBody.collider(0);

            // Ground detection using character controller
            const smallDownwardMovement = new RAPIER.Vector3(0, -0.01, 0);
            viewerState.characterController.computeColliderMovement(collider, smallDownwardMovement);
            let isGrounded = false;
            for (let i = 0; i < viewerState.characterController.numComputedCollisions(); i++) {
                const collision = viewerState.characterController.computedCollision(i);
                if (collision) { // Normal mostly upward indicates ground
                    isGrounded = true;
                    break;
                }
            }
            avatarState.isGrounded = isGrounded;

            // Movement logic
            const camDirection = new THREE.Vector3();
            currentCamera.getWorldDirection(camDirection);
            camDirection.y = 0;
            camDirection.normalize();

            // Calculate local direction
            let localDirection = new THREE.Vector3();
            if (isTouchDevice) {
                localDirection.set(moveDirection.x, 0, moveDirection.y);
            } else {
                if (keys.has('w')) localDirection.z -= 1;
                if (keys.has('s')) localDirection.z += 1;
                if (keys.has('a')) localDirection.x -= 1;
                if (keys.has('d')) localDirection.x += 1;
            }

            // Get player movement direction relative to camera
            getPlayerMovement(camDirection);

            // Calculate input magnitude
            let inputMagnitude;
            if (isTouchDevice) {
                inputMagnitude = localDirection.length();
            } else {
                inputMagnitude = localDirection.length() > 0 ? 1 : 0;
            }

            // Normalize localDirection if magnitude > 0
            if (inputMagnitude > 0) {
                localDirection.normalize();
            }

            // Transform to world space (use XR camera in VR)
            const euler = new THREE.Euler().setFromQuaternion(currentCamera.quaternion, 'YXZ');
            const yawQuaternion = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), euler.y);
            const movementDirection = localDirection.applyQuaternion(yawQuaternion);

            const speedMultiplier = getSpeedMultiplier();

            // Avatar  Movement
            if (avatarState.isGrounded) {

                // Grounded movement: use character controller for proper wall sliding
                const walkSpeed = BASE_SPEED * speedMultiplier;
                const targetSpeed = walkSpeed * (isTouchDevice ? inputMagnitude : 1);
                const desiredMovement = movementDirection.clone().multiplyScalar(targetSpeed * delta);

                // Use character controller to compute movement with collision handling
                const collider = avatarState.avatarBody.collider(0);
                viewerState.characterController.computeColliderMovement(
                    collider,
                    new RAPIER.Vector3(desiredMovement.x, 0, desiredMovement.z)
                );

                // Apply the computed movement
                const correctedMovement = viewerState.characterController.computedMovement();
                const newPosition = avatarState.avatarBody.translation();
                newPosition.x += correctedMovement.x;
                newPosition.z += correctedMovement.z;
                avatarState.avatarBody.setTranslation(newPosition, true);
                avatarState.avatarBody.wakeUp();

            } else { // In-Air Movement
                if (inputMagnitude > 0) {
                    const accelerationMagnitude = AIR_ACCELERATION * (isTouchDevice ? inputMagnitude : 1);
                    const acceleration = movementDirection.clone().multiplyScalar(accelerationMagnitude);
                    const deltaV = acceleration.multiplyScalar(delta);
                    
                    const currentVel = avatarState.avatarBody.linvel();
                    const currentVelVec3 = new THREE.Vector3(currentVel.x, currentVel.y, currentVel.z);
                    
                    let newVelVec3 = currentVelVec3.add(deltaV);
                    
                    // Calculate and clamp horizontal speed
                    const horizontalVel = new THREE.Vector3(newVelVec3.x, 0, newVelVec3.z);
                    const horizontalSpeed = horizontalVel.length();
                    
                    if (horizontalSpeed > ( speedMultiplier == 1 ? BASE_SPEED : BASE_SPEED * 2)) {
                        newVelVec3 = currentVelVec3.sub(deltaV);
                    }
                    
                    avatarState.avatarBody.setLinvel(new RAPIER.Vector3(newVelVec3.x, newVelVec3.y, newVelVec3.z), true);
                }
            }

            // Jumping logic
            if ((keys.has(' ') || (isTouchDevice && /* check your jump button state */ false)) && avatarState.canJump && avatarState.isGrounded) {
                const currentVel = avatarState.avatarBody.linvel();
                avatarState.avatarBody.setLinvel({
                    x: currentVel.x,
                    y: JUMP_FORCE,
                    z: currentVel.z
                }, true); // Apply upward velocity for the jump
                avatarState.canJump = false; // Immediately prevent jumping again until landed
                avatarState.isGrounded = false; // Assume we are leaving the ground
                avatarState.wasGrounded = true; // Mark that we *were* grounded to prevent immediate re-jump
            }

            // --- Reset canJump when landing ---
            // If we are now grounded, but previously were not
            if (avatarState.isGrounded && !avatarState.wasGrounded) {
                avatarState.lastLandingTime = performance.now();
                avatarState.canJump = true; // Allow jumping again
            }
            // Update wasGrounded for the next frame's check
            avatarState.wasGrounded = avatarState.isGrounded;

            // --- Coyote time / Jump buffer (Optional but good) ---
            // Reset canJump if airborne for too long after leaving ground
            // (Prevents jumping if falling off a ledge without pressing space)
            if (avatarState.lastLandingTime) {
                const timeSinceLanding = (performance.now() - avatarState.lastLandingTime) / 1000;
                // If airborne for more than 0.2 seconds (adjust as needed)
                if (timeSinceLanding >= 0.2 && !avatarState.isGrounded) {
                    avatarState.canJump = false;
                }
            }

            // Update camera to follow avatar (skip in VR as XR controls camera)
            if (!isVR) {
                viewerState.cameraController.update();
            }

            // Sync mesh/rig with body and keep upright
            const pos = avatarState.avatarBody.translation();
            if (viewerState.playerRig) {
                // Move the rig (parents avatar mesh) to body position; keep mesh local at origin
                viewerState.playerRig.position.set(pos.x, pos.y, pos.z);
                if (avatarState.avatarMesh.parent === viewerState.playerRig) {
                    avatarState.avatarMesh.position.set(0, 0, 0);
                }
            } else {
                avatarState.avatarMesh.position.set(pos.x, pos.y, pos.z);
            }

            // Update VR controllers and teleportation
            if (isVR) {
                viewerState.updateVRControllers();
            }

            // Rotate the avatar's quaternion to match the camera direction
            const targetQuaternion = new THREE.Quaternion().setFromUnitVectors(
                new THREE.Vector3(0, 0, 1),
                camDirection
            );
            avatarState.avatarMesh.quaternion.slerp(targetQuaternion, 0.1);

            // Keep physics body upright (important!)
            const currentRotation = avatarState.avatarBody.rotation();
            avatarState.avatarBody.setRotation({
                x: 0,
                y: currentRotation.y,
                z: 0,
                w: currentRotation.w
            }, true);

            // Update mini-map camera and player indicator
            if (avatarState.avatarMesh) {
                const playerPos = viewerState.playerRig ? viewerState.playerRig.position : avatarState.avatarMesh.position;
                if (avatarState.isGrounded) {
                    avatarState.lastGroundedY = playerPos.y;
                }
                const playerBaseY = avatarState.lastGroundedY; // Avatar's base height

                // Position mini-map camera 2.5 units above avatar's base
                viewerState.miniMapCamera.position.set(playerPos.x, playerBaseY + 2.5, playerPos.z);
                viewerState.miniMapCamera.lookAt(playerPos.x, playerBaseY, playerPos.z);

                // Update player indicator position
                viewerState.playerIndicator.position.copy(playerPos);
                viewerState.playerIndicator.position.y += 0.1; // Slight offset to avoid clipping
            }
            
            // Interaction logic
            let closestPoint = null;
            let minDistance = Infinity;
            document.getElementById("interactionHint").style.display = "none";

            sceneObjects.forEach(obj => {
                if (obj.userData && obj.userData.interactionPoints) { // Updated condition
                    obj.userData.interactionPoints.forEach(point => {
                        const pointWorldPosition = new THREE.Vector3(
                            point.position[0], point.position[1], point.position[2]
                        ).applyMatrix4(obj.matrixWorld);

                        const avatarPos = viewerState.playerRig ? viewerState.playerRig.position : avatarState.avatarMesh.position;
                        const distance = avatarPos.distanceTo(pointWorldPosition);
                        if (distance < 1.0 && distance < minDistance) {
                            if (point.action == "pickupObject" && avatarState.hasObjectPickedUp) {
                                console.log("Can't pick up more than 1 Objects");
                            } else {
                                document.getElementById("interactionHint").style.display = "block";
                                document.getElementById("interactionHint").innerHTML = point.action;
                                minDistance = distance;
                                closestPoint = {
                                    point,
                                    object: obj
                                };
                            }
                        }
                    });
                }
            });

            // Handle interaction trigger
            if (keys.has('f')) {
                if (avatarState.hasObjectPickedUp) {
                    preApprovedFunctions.placeObject();
                } else {
                    if (closestPoint) {
                        triggerInteraction(closestPoint.point, closestPoint.object);
                    }
                }
                keys.delete('f'); // Prevent repeated triggers
            }

            // Update picked-up object position to follow avatar
            if (avatarState.hasObjectPickedUp && preApprovedFunctions.pickedUpObject) {

                const object = preApprovedFunctions.pickedUpObject;
                const avatarPos = viewerState.playerRig ? viewerState.playerRig.position : avatarState.avatarMesh.position;
                const offset = new THREE.Vector3(0, 1, 1);
                offset.applyQuaternion(avatarState.avatarMesh.quaternion);
                object.position.copy(avatarPos).add(offset);
                object.quaternion.copy(avatarState.avatarMesh.quaternion);
            }

            const currentTime = performance.now();

            // Send avatar position to other players
            if (online.connectedPeers.size > 0 && currentTime - online.lastSendTime > 50) {
                const position = viewerState.playerRig ? viewerState.playerRig.position : avatarState.avatarMesh.position;
                const quaternion = avatarState.avatarMesh.quaternion;

                online.send("position", {
                    position: {
                        x: position.x,
                        y: position.y,
                        z: position.z
                    },
                    quaternion: {
                        x: quaternion.x,
                        y: quaternion.y,
                        z: quaternion.z,
                        w: quaternion.w
                    }
                });
                online.lastSendTime = currentTime;
            }
        } else {

            // Move Spectator Camera
            const moveSpeed = 0.1;
            if (isTouchDevice) {

                // Touch-based camera movement
                const movementDirection = new THREE.Vector3(moveDirection.x, 0, moveDirection.y).applyQuaternion(viewerState.camera.quaternion);
                viewerState.camera.position.add(movementDirection.multiplyScalar(moveSpeed));
            } else {
                if (keys.has('w')) viewerState.controls.moveForward(moveSpeed);
                if (keys.has('s')) viewerState.controls.moveForward(-moveSpeed);
                if (keys.has('a')) viewerState.controls.moveRight(-moveSpeed);
                if (keys.has('d')) viewerState.controls.moveRight(moveSpeed);
                if (keys.has(' ')) viewerState.camera.position.y += moveSpeed;
                if (keys.has('control')) viewerState.camera.position.y -= moveSpeed;
            }
        }
    }
}

// Speed multiplier function
function getSpeedMultiplier() {
    if (isTouchDevice) {
        return isSprinting ? 2 : 1;
    } else {
        return keys.has('shift') ? 2 : 1;
    }
}

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
            
            console.log('VR session started - XR camera attached to playerRig');
            
            // Unlock pointer controls when entering VR
            if (viewerState.controls && viewerState.controls.isLocked) {
                viewerState.controls.unlock();
            }
        });

        viewerState.renderer.xr.addEventListener('sessionend', () => {
            console.log('VR session ended');
            // Camera will be managed by Three.js on exit
        });

        // Create controller instances
        for (let i = 0; i < 2; i++) {
            const controller = viewerState.renderer.xr.getController(i);
            console.log(`Controller ${i} created:`, controller);

            // Add controller to scene
            viewerState.scene.add(controller);

            // Create controller model
            const controllerModelFactory = new XRControllerModelFactory();
            const controllerGrip = viewerState.renderer.xr.getControllerGrip(i);
            controllerGrip.add(controllerModelFactory.createControllerModel(controllerGrip));
            viewerState.scene.add(controllerGrip);

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
}