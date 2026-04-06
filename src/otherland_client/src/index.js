// Initially hide all menu screens
document.getElementById('main-menu').style.display = 'none';
document.getElementById('username-screen').style.display = 'none';

// Import External Dependencies
import * as THREE from 'three';
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js';
import { WebGPURenderer } from 'three/webgpu';
import { XRControllerModelFactory } from 'three/examples/jsm/webxr/XRControllerModelFactory.js';
import { XRHandModelFactory } from 'three/examples/jsm/webxr/XRHandModelFactory.js';
import RAPIER, { init } from '@dimforge/rapier3d-compat';

// Import Internal Modules
import { khetController, loadKhet } from './khet.js';
import { avatarState } from './avatar.js';
import { online } from './peermesh.js';
import { nodeSettings } from './nodeManager.js';
import { logout } from './user.js';

// Define pitch constraints to prevent camera flipping
const maxPitch = (85 * Math.PI) / 180; // Max upward angle (85 degrees)
const minPitch = (-85 * Math.PI) / 180; // Max downward angle (-85 degrees)
let pitch = 0; // Current vertical angle
let yaw = 0; // Current horizontal angle

// Define Viewer State and init
export const viewerState = {
    canvas: document.getElementById('canvas'),
    renderer: null,
    scene: null,
    world: null,
    camera: null,
    controls: null,
    eventQueue:null,
    cameraController: null,
    characterController: null,
    miniMapCamera: null,      // Add mini-map camera
    miniMapRenderer: null,    // Add mini-map renderer
    playerIndicator: null,    // Add player indicator
    playerRig: null,          // Player rig (dolly) for avatar + VR locomotion (camera parented here in VR)

    // VR Controller State
    controllers: [],          // Array of XR controllers
    controllerGrips: [],      // Controller grip models
    teleportRaycaster: new THREE.Raycaster(), // For teleportation
    teleportMarker: null,     // Visual marker for teleport destination
    isTeleporting: false,     // Flag to prevent multiple teleports

    // Initialize Physics World
    async init () {

        // Initialize Rapier physics world
        await RAPIER.init({});
        const gravity = new RAPIER.Vector3(0.0, -9.82, 0.0);
        this.world = new RAPIER.World(gravity);

        // Create renderer (WebGL only for VR compatibility testing)
        function createRenderer(canvas) {
            console.log('Using WebGLRenderer (WebGPU disabled for VR testing)');
            return new THREE.WebGLRenderer({ canvas, antialias: true });
        }

        // Initialize the WebGL renderer (WebGL required for VR compatibility)
        this.renderer = createRenderer(canvas);
        if (this.renderer.init) await this.renderer.init();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;

        // Configure XR for VR support
        this.renderer.xr.enabled = true;
        this.renderer.xr.setReferenceSpaceType('local-floor');

        // Create scene and camera
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x87ceeb);

        // Initialize VR Controllers (after scene is created)
        this.initVRControllers();

        // Player rig (dolly) that represents the avatar's world position (feet/base). Camera will be parented to it in VR for locomotion.
        this.playerRig = new THREE.Group();
        this.playerRig.name = 'playerRig';
        this.scene.add(this.playerRig);

        // Setup VR camera attachment to playerRig (standard Three.js WebXR locomotion pattern)
        this.renderer.xr.addEventListener('sessionstart', () => {
            const xrCamera = this.renderer.xr.getCamera();
            
            // Clear previous parent if any
            if (xrCamera.parent) {
                xrCamera.parent.remove(xrCamera);
            }
            
            // Parent XR camera directly to playerRig (XR updates local transform for head tracking; rig moves base position)
            this.playerRig.add(xrCamera);
            
            // Eye height offset (local to rig; adjust to match avatar height)
            xrCamera.position.y = 1.6;
            
            console.log('VR session started - XR camera attached to playerRig');
            
            // Unlock pointer controls when entering VR
            if (this.controls && this.controls.isLocked) {
                this.controls.unlock();
            }
        });

        this.renderer.xr.addEventListener('sessionend', () => {
            console.log('VR session ended');
            // Camera will be managed by Three.js on exit
        });

        // Set up a perspective camera with a 75-degree FOV
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.camera.position.set(0, 1, -2.5); // Position camera slightly above and back from origin

        // Setup Event Queue for Collisions
        this.eventQueue = new RAPIER.EventQueue(true);

        // Setup character controller
        this.characterController = this.world.createCharacterController(0.01); // Small offset from ground
        this.characterController.setMaxSlopeClimbAngle(45 * Math.PI / 180); // Don’t allow climbing slopes larger than 45 degrees.
        this.characterController.setMinSlopeSlideAngle(30 * Math.PI / 180); // Automatically slide down on slopes smaller than 30 degrees.
        this.characterController.enableAutostep(0.5, 0.2, true);

        // Initialize pointer lock controls for first-person navigation
        this.controls = await new PointerLockControls(this.camera, this.renderer.domElement);

        // Update camera rotation based on mouse movement when controls are locked
        this.controls.domElement.ownerDocument.onmousemove = function(event) {
            if (!viewerState.controls.isLocked) return; // Only proceed if controls are locked
            const movementX = event.movementX || event.mozMovementX || event.webkitMovementX || 0; // Horizontal mouse delta
            const movementY = event.movementY || event.mozMovementY || event.webkitMovementY || 0; // Vertical mouse delta
            yaw -= movementX * 0.002; // Adjust yaw (horizontal rotation)
            pitch -= movementY * 0.002; // Adjust pitch (vertical rotation)
            pitch = Math.max(minPitch, Math.min(maxPitch, pitch)); // Clamp pitch to avoid flipping
            const euler = new THREE.Euler(pitch, yaw, 0, 'YXZ'); // Create Euler angle in YXZ order
            viewerState.camera.quaternion.setFromEuler(euler); // Apply rotation to camera
        };

        // Add ambient light to illuminate the entire scene
        const ambientLight = new THREE.AmbientLight(0xffffff, 1.0);
        this.scene.add(ambientLight);

        // Add directional light for shadows and depth
        const directionalLight = new THREE.DirectionalLight(0xffffff, 1.0);
        directionalLight.position.set(1, 1, 1); // Position light above and to the side
        this.scene.add(directionalLight);

        // Instantiate the camera controller with no initial target
        this.cameraController = new CameraController(this.camera, null);

        // Update camera and renderer when the window is resized
        window.addEventListener('resize', () => {
            viewerState.camera.aspect = window.innerWidth / window.innerHeight; // Update aspect ratio
            viewerState.camera.updateProjectionMatrix(); // Recalculate projection
            viewerState.renderer.setSize(window.innerWidth, window.innerHeight); // Resize renderer
        });

        // Mini-Map Setup
        const miniMapCanvas = document.getElementById('mini-map-canvas');
        this.miniMapRenderer = new THREE.WebGLRenderer({ canvas: miniMapCanvas, antialias: true });
        this.miniMapRenderer.setSize(250, 250); // Match CSS size

        const zoom = 25; // Half-width of the view area (50x50 units total)
        this.miniMapCamera = new THREE.OrthographicCamera(-zoom, zoom, zoom, -zoom, 0.1, 200);
        this.miniMapCamera.position.set(0, 2.5, 0); // Initial position above origin
        this.miniMapCamera.lookAt(0, 0, 0);

        // Player Indicator
        const indicatorGeometry = new THREE.SphereGeometry(0.5, 8, 8);
        const indicatorMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });
        this.playerIndicator = new THREE.Mesh(indicatorGeometry, indicatorMaterial);
        this.playerIndicator.layers.set(1); // Assign to layer 1
        this.scene.add(this.playerIndicator);

        // Configure camera layers
        this.camera.layers.set(0); // Main camera sees only layer 0
        this.miniMapCamera.layers.enable(0); // Mini-map sees layer 0 (scene)
        this.miniMapCamera.layers.enable(1); // Mini-map also sees layer 1 (indicator)
        
        // Online: Detect Quick Connect
        const onlineParams = new Proxy(new URLSearchParams(window.location.search), {
            get: (searchParams, prop) => searchParams.get(prop),});
        if (onlineParams.standalone) { 
            document.getElementById("body").requestFullscreen();
        };
        console.log("Detecting quick connect ...");
        if (onlineParams.peerId) {
            online.remoteID = onlineParams.peerId;
            console.log('Found, Remote ID:', online.remoteID);
            online.quickConnect = true;
            document.getElementById("quick-connect-invitation").style.display = "block";
        };
        },

        // Initialize VR Controllers
        initVRControllers() {
            console.log('Initializing VR controllers...');

            // Create controller instances
            for (let i = 0; i < 2; i++) {
                const controller = this.renderer.xr.getController(i);
                console.log(`Controller ${i} created:`, controller);

                // Add controller to scene
                this.scene.add(controller);

                // Create controller model
                const controllerModelFactory = new XRControllerModelFactory();
                const controllerGrip = this.renderer.xr.getControllerGrip(i);
                controllerGrip.add(controllerModelFactory.createControllerModel(controllerGrip));
                this.scene.add(controllerGrip);

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
                    // Hide default model to show only the Vive controller
                    if (controller.model) {
                        controller.model.visible = false;
                        console.log(`Hidden default model for controller ${i}`);
                    }
                });

                controller.addEventListener('disconnected', (event) => {
                    console.log(`Controller ${i} disconnected`);
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
            this.scene.add(this.teleportMarker);

            console.log('Teleport marker created');
        },

        // Handle controller select start (trigger button)
        handleControllerSelectStart(controllerIndex, event) {
            console.log(`Controller ${controllerIndex} select start - initiating teleport raycast`);

            if (this.isTeleporting) {
                console.log('Teleport already in progress, ignoring');
                return;
            }

            const controller = this.controllers[controllerIndex];
            if (!controller) {
                console.warn(`Controller ${controllerIndex} not found`);
                return;
            }

            // Set up raycaster from controller
            this.teleportRaycaster.setFromXRController(controller);

            // Raycast down to find teleport destination
            const intersects = this.teleportRaycaster.intersectObjects(sceneObjects, true);

            if (intersects.length > 0) {
                const intersection = intersects[0];
                console.log(`Teleport target found at:`, intersection.point);

                // Position marker at intersection point
                this.teleportMarker.position.copy(intersection.point);
                this.teleportMarker.position.y += 0.01; // Slightly above surface
                this.teleportMarker.visible = true;

                // Store teleport destination
                this.pendingTeleportPosition = intersection.point.clone();
                this.isTeleporting = true;

                console.log('Teleport marker positioned and visible');
            } else {
                console.log('No valid teleport target found');
            }
        },

        // Handle controller select end (trigger release)
        handleControllerSelectEnd(controllerIndex, event) {
            console.log(`Controller ${controllerIndex} select end`);

            if (this.isTeleporting && this.pendingTeleportPosition) {
                console.log('Executing teleport to:', this.pendingTeleportPosition);

                // Teleport player rig to new position
                if (this.playerRig) {
                    // Keep the Y position relative to avatar height
                    const currentY = this.playerRig.position.y;
                    this.playerRig.position.copy(this.pendingTeleportPosition);
                    this.playerRig.position.y = currentY;

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

                // Hide marker
                this.teleportMarker.visible = false;
                this.isTeleporting = false;
                this.pendingTeleportPosition = null;

                console.log('Teleport completed');
            }
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

            // Update teleport raycasting for active controllers
            for (let i = 0; i < this.controllers.length; i++) {
                const controller = this.controllers[i];
                if (controller && controller.visible) {
                    // Check if trigger is being held for teleport preview
                    const gamepad = controller.inputSource?.gamepad;
                    if (gamepad && gamepad.buttons.length > 0) {
                        const triggerPressed = gamepad.buttons[0]?.pressed; // Primary trigger

                        if (triggerPressed && !this.isTeleporting) {
                            // Update teleport raycast continuously while trigger is held
                            this.teleportRaycaster.setFromXRController(controller);
                            const intersects = this.teleportRaycaster.intersectObjects(sceneObjects, true);

                            if (intersects.length > 0) {
                                const intersection = intersects[0];
                                this.teleportMarker.position.copy(intersection.point);
                                this.teleportMarker.position.y += 0.01;
                                this.teleportMarker.visible = true;
                                this.pendingTeleportPosition = intersection.point.clone();
                            } else {
                                this.teleportMarker.visible = false;
                                this.pendingTeleportPosition = null;
                            }
                        } else if (!triggerPressed && this.teleportMarker.visible && !this.isTeleporting) {
                            // Hide marker when trigger released without teleporting
                            this.teleportMarker.visible = false;
                            this.pendingTeleportPosition = null;
                        }
                    }
                }
            }
        },

        // Handle VR thumbstick locomotion
        handleVRThumbstickLocomotion() {
            if (!avatarState.avatarBody || !avatarState.isGrounded || !this.playerRig) {
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
                        this.renderer.xr.getCamera().getWorldDirection(camDirection);
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
                        this.characterController.computeColliderMovement(
                            collider,
                            new RAPIER.Vector3(desiredMovement.x, 0, desiredMovement.z)
                        );

                        const correctedMovement = this.characterController.computedMovement();
                        const newPosition = avatarState.avatarBody.translation();
                        newPosition.x += correctedMovement.x;
                        newPosition.z += correctedMovement.z;
                        avatarState.avatarBody.setTranslation(newPosition, true);
                        avatarState.avatarBody.wakeUp();

                        // Sync playerRig position with avatar body for proper mesh movement and first-person view
                        this.playerRig.position.x = newPosition.x;
                        this.playerRig.position.z = newPosition.z;

                        console.log(`VR locomotion applied: dx=${correctedMovement.x.toFixed(3)}, dz=${correctedMovement.z.toFixed(3)}`);
                        break; // Use only the first controller with input
                    }
                }
            }
        }
};

// Class to manage camera positioning relative to a target (e.g., avatar)
export class CameraController {
    constructor(camera, targetMesh) {
        this.camera = camera; // Reference to the scene camera
        this.target = targetMesh; // Mesh to follow (e.g., avatar)
        this.maxDistance = 2.5; // Maximum distance from target
        this.minDistance = 0.1; // Minimum distance from target
        this.zoomSpeed = 0.1; // Speed of zoom adjustment
        this.scrollFactor = 1.0; // Zoom multiplier
        this.raycaster = new THREE.Raycaster(); // For collision detection
        document.addEventListener('wheel', this.handleScroll.bind(this)); // Listen for scroll events
    }

    // Handle zooming with the mouse wheel
    handleScroll(event) {
        if (!this.target || !viewerState.controls.isLocked) return; // Only zoom if target exists and controls are locked
        const zoomDelta = event.deltaY > 0 ? -this.zoomSpeed : this.zoomSpeed; // Zoom in or out
        this.scrollFactor = (this.scrollFactor || 1.0) + zoomDelta; // Adjust scroll factor
        this.scrollFactor = Math.max(0.5, Math.min(1.5, this.scrollFactor)); // Clamp zoom range
    }

    // Update camera position to follow the target
    update() {
        if (!this.target) return;
    
        // Get the avatar's bounding box and center
        const box = new THREE.Box3().setFromObject(this.target);
        const center = box.getCenter(new THREE.Vector3());
        this.minDistance = box.max.y - box.min.y;
    
        // Camera direction and pitch angle
        const camDirection = new THREE.Vector3();
        this.camera.getWorldDirection(camDirection);
        camDirection.normalize();
        const pitch = Math.asin(Math.max(-1, Math.min(1, camDirection.y)));
        const factor = Math.abs(pitch) / (Math.PI / 2);
        camDirection.y = 0;
        camDirection.normalize();
    
        // Adjusted offsets depending on camera pitch angle
        const aheadOffset = new THREE.Vector3(0, 1, 2.5); // Behind center at same height
        const downOffset = new THREE.Vector3(0, 3, 0);   // Above center when looking down
        const upOffset = new THREE.Vector3(0, -1, 1);  // Below and closer when looking up
        let cameraOffset = (pitch < 0) ? aheadOffset.clone().lerp(downOffset, factor) : aheadOffset.clone().lerp(upOffset, factor);
    
        const horizontalOffset = camDirection.clone().multiplyScalar(-cameraOffset.z);
        const finalOffset = new THREE.Vector3(horizontalOffset.x, cameraOffset.y, horizontalOffset.z);
        const idealPos = center.clone().add(finalOffset); // Use center instead of this.target.position

        // Apply scroll factor while respecting minimal Distance
        const directionToFinal = idealPos.clone().sub(center);
        const baseDistance = directionToFinal.length();
        const scrollFactor = this.scrollFactor || 1.0;
        const adjustedDistance = Math.max(baseDistance * scrollFactor, this.minDistance);
        const adjustedPos = center.clone().add(directionToFinal.normalize().multiplyScalar(adjustedDistance));

        // Raycasting and obstruction checking
        const rayOriginOffset = new THREE.Vector3(0, this.minDistance * 0.5, 0); // 50% of height
        const rayOrigin = center.clone().add(rayOriginOffset);
        const rayDir = adjustedPos.clone().sub(center).normalize();
        this.raycaster.set(rayOrigin, rayDir);
        
        // Check intersections with scene objects (excluding the avatar)
        const objectsToCheck = sceneObjects.filter(obj => obj !== this.target);
        const intersects = this.raycaster.intersectObjects(objectsToCheck, true);
        let finalPos = adjustedPos;

        // Check for obstructions and adjust position
        if (intersects.length > 0 && intersects[0].distance < idealPos.distanceTo(rayOrigin)) {

            // Move camera to 90% of the obstruction distance, but not closer than minDistance
            const newDist = Math.max(intersects[0].distance * 0.9, this.minDistance);
            finalPos = center.clone().add(rayDir.multiplyScalar(newDist));
        } else if (idealPos.distanceTo(center) < this.minDistance) {

            // Ensure camera stays outside avatar if no intersections
            finalPos = center.clone().add(rayDir.multiplyScalar(this.minDistance));
        }
        this.camera.position.copy(finalPos);
    }

    // Set the target mesh and initialize camera position
    setTarget(mesh) {
        this.target = mesh;
        if (mesh) {

            // Compute the bounding box and get the center
            const box = new THREE.Box3().setFromObject(mesh);
            const size = box.getSize(new THREE.Vector3());
            this.minDistance = box.max.y - box.min.y;
            const center = box.getCenter(new THREE.Vector3());
    
            // Set initial camera position behind and level with the center
            const direction = new THREE.Vector3(0, 0, -1); // Backward direction
            const initialOffset = direction.multiplyScalar(this.maxDistance); // e.g., 2.5 units behind
            this.camera.position.copy(center.clone().add(initialOffset));
            this.camera.lookAt(center); // Look at the center, not mesh.position

            // Set initial yaw and pitch to match the camera's orientation
            const euler = new THREE.Euler().setFromQuaternion(this.camera.quaternion, 'YXZ');
            yaw = euler.y;   // Yaw is rotation around Y-axis
            pitch = euler.x; // Pitch is rotation around X-axis
        }
    }
}

// Arrays and variables to manage scene objects and animations
export const sceneObjects = []; // Store all scene objects
export const animationMixers = []; // Store animation mixers for animated objects

// State object to hold Khet executors (for custom behaviors)
export const khetState = {
    executors: []
};
// World Controller
export const worldController = {
    loadedKhets: new Map(), // khetId => { mesh, body, isAvatar }

    // Sync local world with Node objects
    async syncWithNode(params) {

        try {
            console.log(`Node Type is ${nodeSettings.nodeType}`);
            
            // Load all Khets freshly into khetController
            await khetController.loadAllKhets();
            const nodeKhetIds = new Set(Object.keys(khetController.khets));
            console.log(`Target node has ${nodeKhetIds.size} Khets`);

            // Get IDs of currently loaded Khets
            const loadedKhetIds = new Set(this.loadedKhets.keys());
            console.log(`Current node has ${loadedKhetIds.size} Khets`);

            // Identify Khets to load (in node but not loaded locally)
            const toLoad = [...nodeKhetIds].filter(id => !loadedKhetIds.has(id));
            console.log('Khets to load:', toLoad);

            // Identify Khets to unload (loaded locally but not in node)
            const toUnload = [...loadedKhetIds].filter(id => !nodeKhetIds.has(id));
            console.log('Khets to unload:', toUnload);

            // Load missing Khets (excluding avatars)
            for (const khetId of toLoad) {
                const khet = khetController.khets[khetId];
                if (khet && khet.khetType !== 'Avatar') { // Skip avatars for now
                    await this.loadKhet(khetId, params);
                }
            }

            // Unload Khets no longer in the world
            for (const khetId of toUnload) {
                this.unloadKhet(khetId, params.scene, params.world);
            }

            console.log(`Synced with node: loaded ${toLoad.length}, unloaded ${toUnload.length} Khets`);
        } catch (error) {
            console.error('Error syncing with node:', error);
        }
    },

    // Load a Khet if not already loaded
    async loadKhet(khetId, params) {
        if (this.loadedKhets.has(khetId)) {
            console.log(`Khet ${khetId} already loaded`);
            return this.loadedKhets.get(khetId);
        }
        const { mesh, body, isAvatar } = await loadKhet(khetId, params);
        this.loadedKhets.set(khetId, { mesh, body, isAvatar });
        return { mesh, body, isAvatar };
    },

    // Unload a Khet from the scene and physics world
    unloadKhet(khetId, scene, world) {
        const khet = this.loadedKhets.get(khetId);
        if (khet) {
            if (khet.mesh) {
                scene.remove(khet.mesh);
                khet.mesh.userData.body = null; // Clear reference
            }
            if (khet.body) world.removeRigidBody(khet.body);
            this.loadedKhets.delete(khetId);
            if (this.currentAvatarId === khetId) {
                this.currentAvatarId = null;
            }
            if (khet.isAvatar) {
                avatarState.setAvatarBody(null);
                avatarState.setAvatarMesh(null);
                avatarState.setSelectedAvatarId(null);
            }
        }
    },

    // Clear all loaded Khets (optional utility)
    clearAllKhets(scene, world) {
        for (const khet of this.loadedKhets.values()) {
            if (khet.mesh) {
                scene.remove(khet.mesh);
                khet.mesh.userData.body = null; // Clear reference
            }
            if (khet.body) world.removeRigidBody(khet.body);
        }
        this.loadedKhets.clear();
        avatarState.setSelectedAvatarId(null);
    },

    // Initialize the scene
    async loadScene(params, nodeSettings) {
        
        // Clear scene objects array
        params.sceneObjects.length = 0;
        params.animationMixers.length = 0;
        params.khetState.executors.length = 0;
        
        // Load correct khets for the current node
        await worldController.syncWithNode(params);
    
        // If no scene objects are loaded, add a fallback ground
        if (!Object.values(khetController.khets).some(khet => khet.khetType === 'SceneObject') && nodeSettings.groundPlane) {
            await this.loadFallbackGround(nodeSettings);
        }
        
        // Load Avatar with params
        await this.loadAvatarObject(params);
    
        // Load remote avatars after scene is synced
        await online.loadRemoteAvatars();
    },

    // Set the active avatar, unloading the previous one if necessary
    async setAvatar(newAvatarId, params) { 
        const currentAvatarId = avatarState.getSelectedAvatarId();

        if (currentAvatarId && currentAvatarId !== newAvatarId) {        
            await this.unloadKhet(currentAvatarId, viewerState.scene, viewerState.world);
        }
        const { mesh, body, isAvatar } = await this.loadKhet(newAvatarId, params);
        if (isAvatar && mesh) {  
            avatarState.setSelectedAvatarId(newAvatarId);
            avatarState.setAvatarBody(body);
            avatarState.setAvatarMesh(mesh);
            viewerState.cameraController.setTarget(mesh);
        } else {
            console.warn(`Khet ${newAvatarId} is not an avatar`); // Improve: Only unload if new khet is Avatar, bypass this case
        }
    },
    
    async loadAvatarObject({ scene, sceneObjects, world, animationMixers, khetState }) {
        const avatarId = avatarState.getSelectedAvatarId();
        console.log("Avatar ID: " + avatarId);
        if (avatarId) {
            await worldController.setAvatar(avatarId, { scene, sceneObjects, world, animationMixers, khetState });
        } else {
            console.log("Avatar gets selected automatically");
            const avatars = khetController.getAvatars();
            if (avatars.length > 0) {
                const avatarId = avatars[0].khetId;
                avatarState.setSelectedAvatarId(avatarId);
    
                if (online.connected) {
                    online.send("avatar", avatarId);
                }
    
                await worldController.setAvatar(avatarId, { scene, sceneObjects, world, animationMixers, khetState });
            } else {
                console.warn("No avatars available to select automatically.");
                avatarState.setAvatarBody(null);
                avatarState.setAvatarMesh(null);
            }
        }
    },

    // Function to add a ground plane if no scene objects are loaded
    async loadFallbackGround(nodeSettings) {
        const size = nodeSettings.groundPlaneSize || 100;
        const color = nodeSettings.groundPlaneColor || 0x555555;
    
        // Create a physics plane with no mass (static)
        const rigidBodyDesc = RAPIER.RigidBodyDesc.fixed().setTranslation(0, -0.1, 0);
        const groundBody = viewerState.world.createRigidBody(rigidBodyDesc);
        const colliderDesc = RAPIER.ColliderDesc.cuboid(size / 2, 0.1, size / 2)
            .setFriction(0.3)
            .setRestitution(0.0);
        viewerState.world.createCollider(colliderDesc, groundBody);
        groundBody.userData = { type: 'sceneObject' };
    
        // Create a visual plane mesh using BoxGeometry for a flat horizontal surface
        const groundGeometry = new THREE.BoxGeometry(size, 0.1, size);
        const groundMaterialVisual = new THREE.MeshLambertMaterial({ color: color });
        const groundPlane = new THREE.Mesh(groundGeometry, groundMaterialVisual);
        groundPlane.position.y = -0.05; // Top of the visual ground at y=0 (physics ground is at y=-0.1)
        groundPlane.userData = { body: groundBody };
        viewerState.scene.add(groundPlane);
        sceneObjects.push(groundPlane);
        console.log('Loaded fallback ground plane');
    }
}

// Handle unhandled promise rejections, specifically for certificate verification errors
window.addEventListener('unhandledrejection', async event => {
    if (event.reason && event.reason.message && (event.reason.message.includes('TrustError') || event.reason.message.includes('Certificate verification'))) {
        console.warn('Unhandled certificate verification error, likely due to changed root key. Logging out to force re-authentication.');
        event.preventDefault(); // Prevent the error from being logged as unhandled
        await logout();
        window.location.reload();
    }
});
