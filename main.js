import * as THREE from 'three';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

// Scene setup
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1a1a1a);

const camera = new THREE.PerspectiveCamera(
    50,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
);
camera.position.set(0, 5, 10);

const renderer = new THREE.WebGLRenderer({ 
    antialias: true,
    preserveDrawingBuffer: true  // Disable CORS restrictions
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.3; // Much lower to see reflections
renderer.outputColorSpace = THREE.SRGBColorSpace;

// Append canvas to container
const container = document.getElementById('canvas-container');
if (container) {
    container.appendChild(renderer.domElement);
} else {
    document.body.appendChild(renderer.domElement);
}

// Controls
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;

// Set up mouse buttons
controls.mouseButtons.LEFT = THREE.MOUSE.ROTATE;
controls.mouseButtons.MIDDLE = THREE.MOUSE.DOLLY;
controls.mouseButtons.RIGHT = null; // Disable right-click

// Set up keyboard panning (CMD/Ctrl + left mouse drag)
controls.enablePan = true;
controls.panSpeed = 0.8;
controls.screenSpacePanning = true;

// Enable CMD/Ctrl + left mouse drag for panning
controls.mouseButtons = {
    LEFT: THREE.MOUSE.ROTATE,
    MIDDLE: THREE.MOUSE.DOLLY,
    RIGHT: THREE.MOUSE.PAN  // Re-enable right-click for panning with modifier
};

// Override to use middle button for pan, or add custom logic for CMD+left
const domElement = renderer.domElement;
let isModifierPressed = false;

domElement.addEventListener('mousedown', (event) => {
    isModifierPressed = event.metaKey || event.ctrlKey;
    
    if (isModifierPressed && event.button === 0) {
        // CMD/CTRL + Left mouse = Pan
        controls.mouseButtons.LEFT = THREE.MOUSE.PAN;
    } else if (!isModifierPressed && event.button === 0) {
        // Normal Left mouse = Rotate
        controls.mouseButtons.LEFT = THREE.MOUSE.ROTATE;
    }
});

domElement.addEventListener('mouseup', () => {
    if (!isModifierPressed) {
        controls.mouseButtons.LEFT = THREE.MOUSE.ROTATE;
    }
});

// Keyboard keys for panning
controls.keys = {
    LEFT: 'ArrowLeft',
    UP: 'ArrowUp',
    RIGHT: 'ArrowRight',
    BOTTOM: 'ArrowDown'
};

// 3-Point Studio Lighting Setup
// Function to convert Kelvin to RGB
function kelvinToRgb(kelvin) {
    const temp = kelvin / 100;
    let r, g, b;
    
    if (temp <= 66) {
        r = 255;
        g = temp;
        g = 99.4708025861 * Math.log(g) - 161.1195681661;
        if (temp <= 19) {
            b = 0;
        } else {
            b = temp - 10;
            b = 138.5177312231 * Math.log(b) - 305.0447927307;
        }
    } else {
        r = temp - 60;
        r = 329.698727446 * Math.pow(r, -0.1332047592);
        g = temp - 60;
        g = 288.1221695283 * Math.pow(g, -0.0755148492);
        b = 255;
    }
    
    r = Math.max(0, Math.min(255, r));
    g = Math.max(0, Math.min(255, g));
    b = Math.max(0, Math.min(255, b));
    
    return new THREE.Color(r / 255, g / 255, b / 255);
}

// Studio 3-Point Lighting with Directional Lights for even illumination

// Key Light (Primary) - Neutral 6000K from top-right
const keyLight = new THREE.DirectionalLight(kelvinToRgb(6000), 2.0); // -50%
keyLight.position.set(8, 10, 6);
keyLight.castShadow = true;
keyLight.shadow.mapSize.width = 2048;
keyLight.shadow.mapSize.height = 2048;
keyLight.shadow.camera.near = 0.5;
keyLight.shadow.camera.far = 50;
keyLight.shadow.camera.left = -10;
keyLight.shadow.camera.right = 10;
keyLight.shadow.camera.top = 10;
keyLight.shadow.camera.bottom = -10;
scene.add(keyLight);

// Fill Light - Warm 3200K from left
const fillLight = new THREE.DirectionalLight(kelvinToRgb(3200), 2.5); // -50%
fillLight.position.set(-8, 6, 5);
scene.add(fillLight);

// Back Light - Cool 8000K from behind
const backLight = new THREE.DirectionalLight(kelvinToRgb(8000), 2.0); // -50%
backLight.position.set(-3, 8, -10);
scene.add(backLight);

// Ambient fill for overall illumination
const ambientLight = new THREE.AmbientLight(0xffffff, 0.5); // Increased significantly
scene.add(ambientLight);

// No HDRI - keeping it lightweight

// Post-processing with Bloom
const composer = new EffectComposer(renderer);
const renderPass = new RenderPass(scene, camera);
composer.addPass(renderPass);

const bloomPass = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    0.2, // strength
    0.7, // radius
    0.9  // threshold (much higher to reduce burn-out and flickering)
);
composer.addPass(bloomPass);

// Vignette effect
const vignetteShader = {
    uniforms: {
        tDiffuse: { value: null },
        offset: { value: 0.93 },
        darkness: { value: 0.6 }
    },
    vertexShader: `
        varying vec2 vUv;
        void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `,
    fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform float offset;
        uniform float darkness;
        varying vec2 vUv;
        
        void main() {
            vec4 texel = texture2D(tDiffuse, vUv);
            vec2 uv = (vUv - vec2(0.5)) * vec2(1.0);
            float dist = length(uv);
            float vignette = smoothstep(offset, darkness + offset, dist);
            texel.rgb = mix(texel.rgb, texel.rgb * (1.0 - vignette), 0.8);
            gl_FragColor = texel;
        }
    `
};

const vignettePass = new ShaderPass(vignetteShader);
composer.addPass(vignettePass);

// Mouse position for shader inputs
let mouseX = 0;
let mouseY = 0;

// Raycaster for hover detection
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
let hoveredMesh = null;

function onMouseMove(event) {
    // Normalize mouse coordinates to -1 to 1 range for shader inputs
    mouseX = (event.clientX / window.innerWidth) * 2 - 1;
    mouseY = -(event.clientY / window.innerHeight) * 2 + 1;
    
    // For raycaster
    mouse.x = mouseX;
    mouse.y = mouseY;
    
    raycaster.setFromCamera(mouse, camera);
    
    if (porscheModel) {
        const intersects = raycaster.intersectObject(porscheModel, true);
        
        if (intersects.length > 0) {
            const currentHovered = intersects[0].object;
            
            // If we're hovering a new mesh
            if (currentHovered !== hoveredMesh) {
                // Restore previous hovered mesh
                if (hoveredMesh && hoveredMesh.userData.originalMaterial) {
                    const originalMat = hoveredMesh.userData.originalMaterial;
                    if (Array.isArray(hoveredMesh.material)) {
                        hoveredMesh.material.forEach((m, i) => {
                            if (hoveredMesh.userData.originalMaterial[i]) {
                                m.dispose();
                                m = hoveredMesh.userData.originalMaterial[i].clone();
                            }
                        });
                    } else {
                        hoveredMesh.material.dispose();
                        hoveredMesh.material = hoveredMesh.userData.originalMaterial.clone();
                        
                        // Re-apply properties to prevent loss over time
                        if (hoveredMesh.material.isMeshPhysicalMaterial) {
                            hoveredMesh.material.envMap = scene.environment;
                            hoveredMesh.material.envMapIntensity = 1.0;
                            hoveredMesh.material.roughness = 0.0;
                            hoveredMesh.material.metalness = 1.0;
                            hoveredMesh.material.sheen = 2.0;
                            hoveredMesh.material.sheenRoughness = 0.3;
                            hoveredMesh.material.sheenColor = new THREE.Color(0xff6600);
                            hoveredMesh.material.iridescence = 1.0;
                            hoveredMesh.material.iridescenceIOR = 1.3;
                            hoveredMesh.material.iridescenceThicknessRange = [100, 500];
                            hoveredMesh.material.needsUpdate = true;
                        }
                    }
                }
                
                // Store original material and switch to wireframe
                hoveredMesh = currentHovered;
                if (hoveredMesh.isMesh && hoveredMesh.material) {
                    hoveredMesh.userData.originalMaterial = hoveredMesh.material.clone();
                    
                    const wireframeMat = new THREE.MeshStandardMaterial({
                        color: 0xff6600,
                        wireframe: true,
                        emissive: 0xff6600, // Orange
                        emissiveIntensity: 7.5 // 50% brighter (increased from 5.0)
                    });
                    
                    hoveredMesh.material = wireframeMat;
                }
            }
        } else {
            // Mouse not over anything - restore previous hovered mesh
            if (hoveredMesh && hoveredMesh.userData.originalMaterial) {
                hoveredMesh.material.dispose();
                hoveredMesh.material = hoveredMesh.userData.originalMaterial.clone();
                
                // Material now has correct HDRI properties stored
                
                hoveredMesh.userData.originalMaterial = null;
            }
            hoveredMesh = null;
        }
    }
}

window.addEventListener('mousemove', onMouseMove);

// Load Porsche model
const loader = new FBXLoader();
let porscheModel = null;

loader.load(
    'porsche_911.fbx',
    (object) => {
        console.log('Porsche model loaded successfully');
        
        // Scale and position the model
        object.scale.multiplyScalar(0.01);
        
        // Log all mesh names and positions to identify parts
        console.log('=== FBX Model Parts ===');
        const meshInfo = [];
        object.traverse((child) => {
            if (child.isMesh) {
                const bbox = new THREE.Box3().setFromObject(child);
                const center = bbox.getCenter(new THREE.Vector3());
                const size = bbox.getSize(new THREE.Vector3());
                const info = {
                    name: child.name,
                    type: child.geometry.type,
                    position: center,
                    size: size,
                    mesh: child
                };
                meshInfo.push(info);
                    const matInfo = child.material ? 
                        (Array.isArray(child.material) ? 
                            `[${child.material.length} mats]` : 
                            `Material: ${child.material.name || 'unnamed'} | Color: ${child.material.color?.getHexString() || 'N/A'}`) 
                        : 'No material';
                    
                    console.log(`Mesh: "${child.name}" | Type: ${child.geometry.type} | ${matInfo}`);
            }
        });
        
        // Remove podium/base meshes by name OR by position/size characteristics
        const toRemove = [];
        object.traverse((child) => {
            if (child.isMesh) {
                const name = child.name.toLowerCase();
                
                // Check by name
                if (name.includes('podium') || name.includes('base') || 
                    name.includes('platform') || name.includes('stand') ||
                    name.includes('pedestal')) {
                    toRemove.push(child);
                    console.log('Removing by name:', child.name);
                } else {
                    // Check by position/geometry characteristics
                    const bbox = new THREE.Box3().setFromObject(child);
                    const size = bbox.getSize(new THREE.Vector3());
                    const center = bbox.getCenter(new THREE.Vector3());
                    
                    // Detect circular/cylindrical bases (typically wide and flat)
                    const isLikelyBase = (
                        child.geometry.type === 'CylinderGeometry' ||
                        child.geometry.type === 'CircleGeometry' ||
                        child.geometry.type === 'BoxGeometry'
                    ) && (
                        Math.max(size.x, size.z) > Math.max(size.y * 2) && // Wide and flat
                        size.y < Math.max(size.x, size.z) * 0.3 // Low height ratio
                    );
                    
                    if (isLikelyBase && center.y < 0) {
                        toRemove.push(child);
                        console.log('Removing likely base by geometry:', child.name);
                    }
                }
            }
        });
        
        toRemove.forEach(mesh => {
            // Remove from parent
            if (mesh.parent) {
                mesh.parent.remove(mesh);
            }
            // Dispose geometry and material
            mesh.geometry.dispose();
            if (mesh.material) {
                if (Array.isArray(mesh.material)) {
                    mesh.material.forEach(mat => mat.dispose());
                } else {
                    mesh.material.dispose();
                }
            }
        });
        
        // Center the model
        const box = new THREE.Box3().setFromObject(object);
        const center = box.getCenter(new THREE.Vector3());
        object.position.sub(center);
        
        // Identify and convert ONLY window/glass materials (by name only, not color)
        object.traverse((child) => {
            if (child.isMesh) {
                const name = child.name.toLowerCase();
                const matName = (child.material?.name || '').toLowerCase();
                
                // Only check by explicit names - windows and glass parts
                const isGlass = name.includes('glass') || 
                                name.includes('window') || 
                                name.includes('windshield') ||
                                name.includes('windscreen') ||
                                matName === 'glass' ||
                                matName === 'window' ||
                                matName === 'windshield';
                
                if (isGlass) {
                    console.log('Converting to glass:', child.name, 'Material:', child.material?.name);
                    
                    // Create new glass material
                    const glassMaterial = new THREE.MeshPhysicalMaterial({
                        color: 0xffffff,
                        metalness: 0,
                        roughness: 0.05,
                        transmission: 0.95, // Transparency
                        opacity: 0.2,
                        transparent: true,
                        side: THREE.DoubleSide,
                        clearcoat: 1.0,
                        clearcoatRoughness: 0.05,
                        ior: 1.5, // Index of refraction for glass
                        envMapIntensity: 15.0, // Very strong glass reflections
                        envMap: scene.environment, // Apply current environment map
                    });
                    
                    // Dispose old material
                    if (Array.isArray(child.material)) {
                        child.material.forEach(mat => mat.dispose());
                    } else {
                        child.material.dispose();
                    }
                    
                    child.material = glassMaterial;
                    child.material.needsUpdate = true;
                }
            }
        });
        
        // Convert materials to physical materials for reflections
        object.traverse((child) => {
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
                
                if (child.material && !child.name.toLowerCase().includes('glass')) {
                    // Convert to MeshPhysicalMaterial with black, slightly transparent, but highly reflective
                    const physicalMaterial = new THREE.MeshPhysicalMaterial({
                        color: 0x333333, // Dark gray instead of black for better visibility
                        opacity: 0.9, // Less transparent
                        transparent: true,
                        roughness: 0.0, // Perfectly smooth for maximum reflections
                        metalness: 1.0, // Fully metallic
                        envMapIntensity: 1.0, // Normal reflection intensity
                        envMap: scene.environment, // Use HDRI environment
                        clearcoat: 1.0, // Maximum clearcoat for glossy reflections
                        clearcoatRoughness: 0.0, // Perfectly smooth clearcoat
                        sheen: 2.0, // Moderate hologram-like Fresnel
                        sheenRoughness: 0.3, // Balanced Fresnel effect
                        sheenColor: new THREE.Color(0xff6600), // Orange Fresnel edge
                        iridescence: 1.0, // Moderate iridescence intensity
                        iridescenceIOR: 1.3, // Standard refraction
                        iridescenceThicknessRange: [100, 500] // Balanced range for rainbow effects
                    });
                    
                    // Dispose old material
                    if (Array.isArray(child.material)) {
                        child.material.forEach(mat => mat.dispose());
                    } else {
                        child.material.dispose();
                    }
                    
                    child.material = physicalMaterial;
                    child.material.needsUpdate = true;
                }
            }
        });
        
        scene.add(object);
        porscheModel = object;
        
        // Adjust camera to view the car
        const size = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);
        camera.position.set(maxDim * 0.3825, maxDim * 0.3078, maxDim * 0.3825); // Even closer and even lower
        controls.target = new THREE.Vector3(0, 0, 0);
        controls.update();
        
        // Collect all meshes for automatic wireframe cycling
        const allMeshes = [];
        object.traverse((child) => {
            if (child.isMesh && !child.name.toLowerCase().includes('glass')) {
                allMeshes.push(child);
                // Store original material
                child.userData.originalMaterial = child.material.clone();
            }
        });
        
        // Automatic wireframe cycling with smooth transitions
        let currentMeshIndex = 0;
        let transitionProgress = 0;
        let wireframeCycleData = {
            allMeshes: allMeshes,
            currentMeshIndex: 0,
            transitionProgress: 0,
            transitionSpeed: 0.1 // 0.1s per part cycle
        };
        
        const wireframeMaterial = new THREE.MeshStandardMaterial({
            color: 0xff6600,
            wireframe: true,
            emissive: 0xff6600, // Orange
            emissiveIntensity: 7.5 // 50% brighter (increased from 5.0)
        });
        
        // Store cycle data for access in animation loop
        object.userData.wireframeCycle = wireframeCycleData;
        object.userData.wireframeMaterial = wireframeMaterial;
    },
    (progress) => {
        console.log('Loading progress:', (progress.loaded / progress.total * 100) + '%');
    },
    (error) => {
        console.error('Error loading Porsche model:', error);
    }
);

// Animation loop
function animate() {
    requestAnimationFrame(animate);
    
    // Update controls
    controls.update();
    
    // Auto-rotate the car model slowly
    if (porscheModel) {
        porscheModel.rotation.y += 0.005;
        
        // Update wireframe cycle with smooth transitions
        if (porscheModel.userData.wireframeCycle) {
            const cycle = porscheModel.userData.wireframeCycle;
            const meshCount = cycle.allMeshes.length;
            
            if (meshCount > 0) {
                // Fade in current wireframe
                const currentMesh = cycle.allMeshes[cycle.currentMeshIndex];
                if (currentMesh && currentMesh.userData.originalMaterial) {
                    const opacity = Math.min(cycle.transitionProgress, 1.0);
                    currentMesh.material.dispose();
                    currentMesh.material = porscheModel.userData.wireframeMaterial.clone();
                    currentMesh.material.opacity = opacity;
                    currentMesh.material.transparent = true;
                    
                    // Log the currently highlighted part
                    if (cycle.transitionProgress < 0.01) { // Only log at start of transition
                        console.log('Highlighting part:', currentMesh.name || 'Unnamed part', `(${cycle.currentMeshIndex + 1}/${meshCount})`);
                    }
                    
                    // Ensure Fresnel and HDRI are never disabled
                    if (currentMesh.material.isMeshPhysicalMaterial) {
                        currentMesh.material.envMap = scene.environment;
                        currentMesh.material.envMapIntensity = 1.0;
                        currentMesh.material.sheen = 2.0;
                        currentMesh.material.sheenRoughness = 0.3;
                        currentMesh.material.sheenColor = new THREE.Color(0xff6600);
                        currentMesh.material.iridescence = 1.0;
                        currentMesh.material.iridescenceIOR = 1.3;
                    }
                }
                
                // Fade out previous wireframe
                const prevIndex = (cycle.currentMeshIndex - 1 + meshCount) % meshCount;
                const prevMesh = cycle.allMeshes[prevIndex];
                if (prevMesh && prevMesh.userData.originalMaterial && cycle.transitionProgress < 1.0) {
                    const opacity = 1.0 - cycle.transitionProgress;
                    if (opacity < 1.0) {
                        prevMesh.material.dispose();
                        prevMesh.material = prevMesh.userData.originalMaterial.clone();
                        
                        // Re-apply properties to prevent loss over time
                        if (prevMesh.material.isMeshPhysicalMaterial) {
                            prevMesh.material.envMap = scene.environment;
                            prevMesh.material.envMapIntensity = 1.0;
                            prevMesh.material.roughness = 0.0;
                            prevMesh.material.metalness = 1.0;
                            prevMesh.material.sheen = 2.0;
                            prevMesh.material.sheenRoughness = 0.3;
                            prevMesh.material.sheenColor = new THREE.Color(0xff6600);
                            prevMesh.material.iridescence = 1.0;
                            prevMesh.material.iridescenceIOR = 1.3;
                            prevMesh.material.iridescenceThicknessRange = [100, 500];
                        }
                        
                        prevMesh.material.opacity = opacity;
                        prevMesh.material.transparent = opacity < 1.0;
                        prevMesh.material.needsUpdate = true;
                    }
                }
                
                // Update progress
                cycle.transitionProgress += cycle.transitionSpeed;
                
                if (cycle.transitionProgress >= 1.0) {
                    cycle.transitionProgress = 0;
                    cycle.currentMeshIndex = (cycle.currentMeshIndex + 1) % meshCount;
                }
            }
        }
        
        // Update shader uniforms based on mouse position
        porscheModel.traverse((child) => {
            if (child.isMesh && child.material) {
                // This is where you'll add shader uniform updates
                // For now, we can just store the mouse values
                if (child.material.userData) {
                    child.material.userData.mouseX = mouseX;
                    child.material.userData.mouseY = mouseY;
                }
            }
        });
    }
    
    composer.render();
}

animate();

// Handle window resize
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    composer.setSize(window.innerWidth, window.innerHeight);
});

