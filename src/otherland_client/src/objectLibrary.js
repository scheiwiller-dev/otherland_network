// Import External Dependencies
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

// Import Internal Modules

// Compute SHA-256 hash of a Uint8Array
async function computeSHA256(data) {
    const buffer = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(buffer))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
}

// IndexedDB Cache Setup for Object Library
const DB_NAME = 'KhetCache';
const DB_VERSION = 3;

function openDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains('assets')) {
                db.createObjectStore('assets', { keyPath: 'id' });
            }
            if (!db.objectStoreNames.contains('khets')) {
                db.createObjectStore('khets', { keyPath: 'id' });
            }
        };
    });
}

async function saveToStore(storeName, id, data) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.put({ id, ...data });
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
        transaction.oncomplete = () => db.close();
    });
}

async function getFromStore(storeName, id) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([storeName], 'readonly');
        const store = transaction.objectStore(storeName);
        const request = store.get(id);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
        transaction.oncomplete = () => db.close();
    });
}

async function deleteFromStore(storeName, id) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.delete(id);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
        transaction.oncomplete = () => db.close();
    });
}

async function getAllFromStore(storeName) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([storeName], 'readonly');
        const store = transaction.objectStore(storeName);
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
        transaction.oncomplete = () => db.close();
    });
}

// Object Library Controller
export const objectLibrary = {
    // Add a new asset to the library
    async addAsset(file) {
        const reader = new FileReader();
        return new Promise((resolve) => {
            reader.onload = async () => {
                const gltfData = new Uint8Array(reader.result);
                const hash = await computeSHA256(gltfData);

                // Check if asset already exists
                const existing = await getFromStore('assets', hash);
                if (existing) {
                    console.log(`Asset with hash ${hash} already exists in library`);
                    resolve(hash);
                    return;
                }

                // Parse GLTF to extract metadata
                const loader = new GLTFLoader();
                loader.parse(gltfData.buffer, '', (gltf) => {
                    const object = gltf.scene;
                    const box = new THREE.Box3().setFromObject(object);
                    const originalSize = box.getSize(new THREE.Vector3());
                    const animations = gltf.animations.length > 0 ? gltf.animations.map(a => a.name) : [];

                    const asset = {
                        gltfData,
                        originalSize: [originalSize.x, originalSize.y, originalSize.z],
                        animations
                    };

                    saveToStore('assets', hash, asset);
                    console.log(`Asset added to library with hash ${hash}`);
                    resolve(hash);
                });
            };
            reader.readAsArrayBuffer(file);
        });
    },

    // Get an asset by hash
    async getAsset(hash) {
        const data = await getFromStore('assets', hash);
        return data ? { hash, ...data } : null;
    },

    // Delete an asset from the library
    async deleteAsset(hash) {
        await deleteFromStore('assets', hash);
        console.log(`Asset with hash ${hash} deleted from library`);
    },

    // List all assets in the library
    async listAssets() {
        const assets = await getAllFromStore('assets');
        return assets.map(asset => ({
            hash: asset.id,
            originalSize: asset.originalSize,
            animations: asset.animations
        }));
    }
};