/**
 * Library preview uses its own renderer, scene, and camera.
 * It does not touch the world viewer, Rapier, or PeerJS.
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { toArrayBuffer } from './bytes.js';
import { LIBRARY_MESSAGES } from './model.js';

function disposeObject(object) {
    object.traverse((child) => {
        if (child.geometry) child.geometry.dispose();
        if (!child.material) return;
        const materials = Array.isArray(child.material) ? child.material : [child.material];
        for (const material of materials) {
            for (const value of Object.values(material)) {
                if (value && value.isTexture) value.dispose();
            }
            material.dispose();
        }
    });
}

function parseGlb(buffer) {
    const loader = new GLTFLoader();
    return new Promise((resolve, reject) => {
        try {
            loader.parse(buffer, '', resolve, (error) => {
                reject(error instanceof Error ? error : new Error(LIBRARY_MESSAGES.notGlbPayload));
            });
        } catch (error) {
            reject(error);
        }
    });
}

export function createLibraryPreview(canvas) {
    let renderer = null;
    let scene = null;
    let camera = null;
    let controls = null;
    let currentRoot = null;
    let frame = 0;
    let running = false;
    let observer = null;

    function resize() {
        if (!renderer || !camera) return;
        const width = canvas.clientWidth;
        const height = canvas.clientHeight;
        if (width < 2 || height < 2) return;
        renderer.setSize(width, height, false);
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
    }

    function frameObject(object) {
        const box = new THREE.Box3().setFromObject(object);
        const size = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);
        if (!Number.isFinite(maxDim) || maxDim < 1e-6) {
            controls.target.set(0, 0, 0);
            camera.position.set(0, 0.8, 2.4);
        } else {
            const center = box.getCenter(new THREE.Vector3());
            const distance = (maxDim / (2 * Math.tan((camera.fov * Math.PI) / 360))) * 1.45;
            camera.position.set(center.x + distance * 0.65, center.y + distance * 0.4, center.z + distance);
            camera.near = Math.max(distance / 100, 0.001);
            camera.far = Math.max(distance * 100, 10);
            controls.target.copy(center);
        }
        camera.updateProjectionMatrix();
        controls.update();
    }

    function ensure() {
        if (renderer) return;
        renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
        if (!renderer.getContext()) {
            renderer.dispose();
            renderer = null;
            throw new Error(LIBRARY_MESSAGES.previewUnavailable);
        }
        canvas.style.width = '100%';
        canvas.style.height = '100%';
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.setClearColor(0x05080c, 1);

        scene = new THREE.Scene();
        scene.background = new THREE.Color(0x05080c);
        camera = new THREE.PerspectiveCamera(40, 1, 0.01, 100);

        const ambient = new THREE.AmbientLight(0xffffff, 0.85);
        const key = new THREE.DirectionalLight(0xffffff, 1.5);
        key.position.set(2.5, 4, 3);
        const rim = new THREE.DirectionalLight(0x00d4ff, 0.45);
        rim.position.set(-3, 1.5, -2);
        scene.add(ambient, key, rim);

        controls = new OrbitControls(camera, canvas);
        controls.enableDamping = true;
        controls.enablePan = false;
        controls.autoRotate = true;
        controls.autoRotateSpeed = 1.4;

        if (typeof ResizeObserver !== 'undefined') {
            observer = new ResizeObserver(() => resize());
            observer.observe(canvas);
        }
        resize();
    }

    function loop() {
        if (!running || !renderer) return;
        controls.update();
        renderer.render(scene, camera);
        frame = requestAnimationFrame(loop);
    }

    function clear() {
        if (currentRoot && scene) {
            scene.remove(currentRoot);
            disposeObject(currentRoot);
            currentRoot = null;
        }
    }

    return {
        start() {
            ensure();
            running = true;
            resize();
            if (frame) cancelAnimationFrame(frame);
            frame = requestAnimationFrame(loop);
        },
        stop() {
            running = false;
            if (frame) cancelAnimationFrame(frame);
            frame = 0;
        },
        clear,
        async showBytes(bytes) {
            ensure();
            clear();
            const gltf = await parseGlb(toArrayBuffer(bytes));
            const root = gltf.scene || (gltf.scenes && gltf.scenes[0]);
            if (!root) throw new Error(LIBRARY_MESSAGES.notGlbPayload);
            currentRoot = root;
            scene.add(currentRoot);
            frameObject(currentRoot);
            this.start();
        },
    };
}
