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

// Fisheye effect using Giliam de Carpentier's lens distortion shader
const fisheyeShader = {
    uniforms: {
        "tDiffuse": { value: null },
        "strength": { value: 0.3 },
        "height": { value: 1.0 },
        "aspectRatio": { value: 1.0 },
        "cylindricalRatio": { value: 1.0 }
    },
    vertexShader: `
        uniform float strength;
        uniform float height;
        uniform float aspectRatio;
        uniform float cylindricalRatio;
        
        varying vec3 vUV;
        varying vec2 vUVDot;
        
        void main() {
            gl_Position = projectionMatrix * (modelViewMatrix * vec4(position, 1.0));
            
            float scaledHeight = strength * height;
            float cylAspectRatio = aspectRatio * cylindricalRatio;
            float aspectDiagSq = aspectRatio * aspectRatio + 1.0;
            float diagSq = scaledHeight * scaledHeight * aspectDiagSq;
            vec2 signedUV = (2.0 * uv + vec2(-1.0, -1.0));
            
            float z = 0.5 * sqrt(diagSq + 1.0) + 0.5;
            float ny = (z - 1.0) / (cylAspectRatio * cylAspectRatio + 1.0);
            
            vUVDot = sqrt(ny) * vec2(cylAspectRatio, 1.0) * signedUV;
            vUV = vec3(0.5, 0.5, 1.0) * z + vec3(-0.5, -0.5, 0.0);
            vUV.xy += uv;
        }
    `,
    fragmentShader: `
        uniform sampler2D tDiffuse;
        varying vec3 vUV;
        varying vec2 vUVDot;
        
        void main() {
            vec3 uv = dot(vUVDot, vUVDot) * vec3(-0.5, -0.5, -1.0) + vUV;
            gl_FragColor = texture2DProj(tDiffuse, uv);
        }
    `
};

const fisheyePass = new ShaderPass(fisheyeShader);
const horizontalFOV = 60; // Subtle wide-angle
const strength = 0.165; // Increased by 10% from 0.15
const cylindricalRatio = 1.0;
const height = Math.tan(THREE.MathUtils.degToRad(horizontalFOV) / 2) / camera.aspect;

fisheyePass.uniforms.strength.value = strength;
fisheyePass.uniforms.height.value = height;
fisheyePass.uniforms.aspectRatio.value = camera.aspect;
fisheyePass.uniforms.cylindricalRatio.value = cylindricalRatio;

composer.addPass(fisheyePass);

// RGB Split effect
const rgbSplitShader = {
    uniforms: {
        tDiffuse: { value: null },
        amount: { value: 0.003 }
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
        uniform float amount;
        varying vec2 vUv;
        
        void main() {
            vec2 offset = amount * vec2(1.0, 0.0);
            float r = texture2D(tDiffuse, vUv + offset).r;
            float g = texture2D(tDiffuse, vUv).g;
            float b = texture2D(tDiffuse, vUv - offset).b;
            gl_FragColor = vec4(r, g, b, 1.0);
        }
    `
};

const rgbSplitPass = new ShaderPass(rgbSplitShader);
composer.addPass(rgbSplitPass);

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

// Bad TV Shader (by Felix Turner - subtle version)
const badTVShader = {
    uniforms: {
        tDiffuse: { value: null },
        time: { value: 0 },
        distortion: { value: 1.5 },  // Increased for visibility
        distortion2: { value: 2.0 },  // Increased for visibility
        speed: { value: 0.1 },       // Increased for visibility
        rollSpeed: { value: 0.05 }  // Increased for visibility
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
        uniform float time;
        uniform float distortion;
        uniform float distortion2;
        uniform float speed;
        uniform float rollSpeed;
        varying vec2 vUv;
        
        // Ashima 2D Simplex Noise
        vec3 mod289(vec3 x) {
            return x - floor(x * (1.0 / 289.0)) * 289.0;
        }
        
        vec2 mod289(vec2 x) {
            return x - floor(x * (1.0 / 289.0)) * 289.0;
        }
        
        vec3 permute(vec3 x) {
            return mod289(((x*34.0)+1.0)*x);
        }
        
        float snoise(vec2 v) {
            const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
            vec2 i = floor(v + dot(v, C.yy));
            vec2 x0 = v - i + dot(i, C.xx);
            
            vec2 i1;
            i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
            vec4 x12 = x0.xyxy + C.xxzz;
            x12.xy -= i1;
            
            i = mod289(i);
            vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
            
            vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
            m = m*m;
            m = m*m;
            
            vec3 x = 2.0 * fract(p * C.www) - 1.0;
            vec3 h = abs(x) - 0.5;
            vec3 ox = floor(x + 0.5);
            vec3 a0 = x - ox;
            
            m *= 1.79284291400159 - 0.85373472095314 * (a0*a0 + h*h);
            
            vec3 g;
            g.x = a0.x * x0.x + h.x * x0.y;
            g.yz = a0.yz * x12.xz + h.yz * x12.yw;
            return 130.0 * dot(m, g);
        }
        
        void main() {
            vec2 p = vUv;
            float ty = time * speed;
            float yt = p.y - ty;
            
            // Smooth distortion
            float offset = snoise(vec2(yt * 3.0, 0.0)) * 0.2;
            
            // Boost distortion
            offset = offset * distortion * offset * distortion * offset;
            
            // Add fine grain distortion
            offset += snoise(vec2(yt * 50.0, 0.0)) * distortion2 * 0.001;
            
            // Combine distortion on X with roll on Y
            gl_FragColor = texture2D(tDiffuse, vec2(fract(p.x + offset), fract(p.y - time * rollSpeed)));
        }
    `
};

// const badTVPass = new ShaderPass(badTVShader);
// let badTVTime = 0;
// composer.addPass(badTVPass);

// Film grain effect - very subtle dark grain
const grainShader = {
    uniforms: {
        tDiffuse: { value: null },
        time: { value: 0 },
        amount: { value: 0.075 }
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
        uniform float time;
        uniform float amount;
        varying vec2 vUv;
        
        float random(vec2 st) {
            return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123);
        }
        
        void main() {
            vec4 color = texture2D(tDiffuse, vUv);
            
            // Generate random grain
            float grain = random(vUv * vec2(200.0, 200.0) + time);
            
            // Overlay blending mode - only affects blacks and doesn't gray
            float grainValue = (grain - 0.5) * amount;
            
            // Apply dark grain with overlay-like behavior
            gl_FragColor = color - vec4(grainValue * 0.5);
        }
    `
};

const grainPass = new ShaderPass(grainShader);
let grainTime = 0;
composer.addPass(grainPass);

// Panel background blur (shader-based, only under the info panel rect)
const panelBlurShader = {
    uniforms: {
        tDiffuse: { value: null },
        resolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
        rectUV: { value: new THREE.Vector4(0, 0, 0, 0) }, // x0, y0, x1, y1 in 0..1 (GL UV space)
        blurSize: { value: 12.0 } // pixels
    },
    vertexShader: `
        varying vec2 vUv;
        void main(){
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `,
    fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform vec2 resolution;
        uniform vec4 rectUV; // x0,y0,x1,y1
        uniform float blurSize;
        varying vec2 vUv;

        bool inRect(vec2 uv, vec4 r){
            return uv.x >= r.x && uv.x <= r.z && uv.y >= r.y && uv.y <= r.w;
        }

        void main(){
            vec4 base = texture2D(tDiffuse, vUv);
            if (!inRect(vUv, rectUV)){
                gl_FragColor = base;
                return;
            }
            // Higher quality approximate Gaussian blur (32 taps)
            vec2 px = blurSize / resolution;
            vec4 c = vec4(0.0);
            float w0 = 0.140; // center
            float w1 = 0.110; // 1 px offsets
            float w2 = 0.075; // 1 px diagonals
            float w3 = 0.060; // 2 px offsets
            float w4 = 0.040; // 2 px diagonals
            float w5 = 0.025; // 3 px offsets
            float w6 = 0.015; // 3 px diagonals
            
            // center
            c += texture2D(tDiffuse, vUv) * w0;
            
            // 1 px cross
            c += texture2D(tDiffuse, vUv + vec2( px.x, 0.0)) * w1;
            c += texture2D(tDiffuse, vUv + vec2(-px.x, 0.0)) * w1;
            c += texture2D(tDiffuse, vUv + vec2(0.0 ,  px.y)) * w1;
            c += texture2D(tDiffuse, vUv + vec2(0.0 , -px.y)) * w1;
            
            // 1 px diagonals
            c += texture2D(tDiffuse, vUv + vec2( px.x,  px.y)) * w2;
            c += texture2D(tDiffuse, vUv + vec2(-px.x,  px.y)) * w2;
            c += texture2D(tDiffuse, vUv + vec2( px.x, -px.y)) * w2;
            c += texture2D(tDiffuse, vUv + vec2(-px.x, -px.y)) * w2;
            
            // 2 px cross
            c += texture2D(tDiffuse, vUv + vec2( 2.0*px.x, 0.0)) * w3;
            c += texture2D(tDiffuse, vUv + vec2(-2.0*px.x, 0.0)) * w3;
            c += texture2D(tDiffuse, vUv + vec2(0.0 ,  2.0*px.y)) * w3;
            c += texture2D(tDiffuse, vUv + vec2(0.0 , -2.0*px.y)) * w3;
            
            // 2 px diagonals
            c += texture2D(tDiffuse, vUv + vec2( 2.0*px.x,  2.0*px.y)) * w4;
            c += texture2D(tDiffuse, vUv + vec2(-2.0*px.x,  2.0*px.y)) * w4;
            c += texture2D(tDiffuse, vUv + vec2( 2.0*px.x, -2.0*px.y)) * w4;
            c += texture2D(tDiffuse, vUv + vec2(-2.0*px.x, -2.0*px.y)) * w4;

            // 3 px cross
            c += texture2D(tDiffuse, vUv + vec2( 3.0*px.x, 0.0)) * w5;
            c += texture2D(tDiffuse, vUv + vec2(-3.0*px.x, 0.0)) * w5;
            c += texture2D(tDiffuse, vUv + vec2(0.0 ,  3.0*px.y)) * w5;
            c += texture2D(tDiffuse, vUv + vec2(0.0 , -3.0*px.y)) * w5;

            // 3 px diagonals
            c += texture2D(tDiffuse, vUv + vec2( 3.0*px.x,  3.0*px.y)) * w6;
            c += texture2D(tDiffuse, vUv + vec2(-3.0*px.x,  3.0*px.y)) * w6;
            c += texture2D(tDiffuse, vUv + vec2( 3.0*px.x, -3.0*px.y)) * w6;
            c += texture2D(tDiffuse, vUv + vec2(-3.0*px.x, -3.0*px.y)) * w6;
            
            gl_FragColor = c;
        }
    `
};

const enablePanelBlur = false;
let panelBlurPass = null;
if (enablePanelBlur) {
    panelBlurPass = new ShaderPass(panelBlurShader);
    composer.addPass(panelBlurPass);
}

// Mouse position for shader inputs
let mouseX = 0;
let mouseY = 0;

// Raycaster for hover detection
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
let hoveredMesh = null;
let hoverFadeProgress = 0;
let boundingBoxHelper = null;
let cornerIndicators = [];
let screenOutline = null;
let enableScreenOutline = false; // feature toggle
let warningMesh = null;
let warningOriginalEmissive = null;
let warningOriginalEmissiveIntensity = 0;

// Text decoding animation
let currentText = '';
let targetText = '';
let textDecodeIndex = 0;
let textDecodeSpeed = 3; // characters per frame

// Sound effects - preload audio
const hoverSound = new Audio('261590__kwahmah_02__little-glitch.flac');
hoverSound.volume = 0.3;
hoverSound.preload = 'auto';
hoverSound.crossOrigin = 'anonymous';

// Add click handler to enable audio (required by browsers)
document.addEventListener('click', () => {
    hoverSound.play().then(() => {
        hoverSound.pause();
        hoverSound.currentTime = 0;
    }).catch(e => console.log('Initial audio test:', e));
}, { once: true });

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
                    
                    // Play hover sound
                    hoverSound.currentTime = 0;
                    hoverSound.play().catch(e => console.log('Sound playback failed:', e));
                    
                    // Start decoder animation for part name
                    const partContainerEl = document.getElementById('part-container');
                    const partNameEl = document.getElementById('part-name');
                    if (partNameEl) {
                        targetText = hoveredMesh.name || 'Car Part';
                        currentText = '';
                        textDecodeIndex = 0;
                    }
                    
                    // Show container
                    if (partContainerEl) {
                        partContainerEl.classList.add('visible');
                    }
                    
                    // Display detailed part information
                    const partInfoEl = document.getElementById('part-info');
                    if (partInfoEl) {
                        const info = [];
                        info.push(`─────────────────────────────────────────`);
                        info.push(`  POSITION:`);
                        info.push(`    x: ${hoveredMesh.position.x.toFixed(2)}`);
                        info.push(`    y: ${hoveredMesh.position.y.toFixed(2)}`);
                        info.push(`    z: ${hoveredMesh.position.z.toFixed(2)}`);
                        info.push(``);
                        info.push(`  ROTATION:`);
                        info.push(`    x: ${hoveredMesh.rotation.x.toFixed(2)}`);
                        info.push(`    y: ${hoveredMesh.rotation.y.toFixed(2)}`);
                        info.push(`    z: ${hoveredMesh.rotation.z.toFixed(2)}`);
                        info.push(``);
                        info.push(`  SCALE:`);
                        info.push(`    x: ${hoveredMesh.scale.x.toFixed(2)}`);
                        info.push(`    y: ${hoveredMesh.scale.y.toFixed(2)}`);
                        info.push(`    z: ${hoveredMesh.scale.z.toFixed(2)}`);
                        
                        if (hoveredMesh.geometry) {
                            const geometry = hoveredMesh.geometry;
                            info.push(`─────────────────────────────────────────`);
                            info.push(`  GEOMETRY TYPE:`);
                            info.push(`    ${geometry.type}`);
                            
                            if (geometry.attributes && geometry.attributes.position) {
                                const vertexCount = geometry.attributes.position.count;
                                const faces = geometry.index ? geometry.index.count / 3 : vertexCount / 3;
                                info.push(``);
                                info.push(`  VERTICES: ${vertexCount}`);
                                info.push(`  FACES: ${faces.toFixed(0)}`);
                            }
                            
                            if (geometry.boundingBox) {
                                const width = (geometry.boundingBox.max.x - geometry.boundingBox.min.x).toFixed(2);
                                const height = (geometry.boundingBox.max.y - geometry.boundingBox.min.y).toFixed(2);
                                const depth = (geometry.boundingBox.max.z - geometry.boundingBox.min.z).toFixed(2);
                                info.push(``);
                                info.push(`  BOUNDING BOX:`);
                                info.push(`    w: ${width}`);
                                info.push(`    h: ${height}`);
                                info.push(`    d: ${depth}`);
                            }
                        }
                        
                        if (hoveredMesh.material) {
                            info.push(`─────────────────────────────────────────`);
                            info.push(`  MATERIAL: ${hoveredMesh.material.type}`);
                        }
                        
                        info.push(`─────────────────────────────────────────`);
                        info.push(`  UUID: ${hoveredMesh.uuid.substring(0, 8)}...`);
                        info.push(`─────────────────────────────────────────`);
                        
                        // Clear previous content
                        partInfoEl.innerHTML = '';
                        
                        // Create each line as a separate element with staggered delay
                        const totalLines = info.length;
                        const maxDuration = 0.5; // Max total duration
                        const delayPerLine = maxDuration / totalLines;
                        
                        info.forEach((line, index) => {
                            const lineEl = document.createElement('div');
                            lineEl.className = 'info-line';
                            lineEl.textContent = line;
                            lineEl.style.animationDelay = `${index * delayPerLine}s`;
                            partInfoEl.appendChild(lineEl);
                        });
                    }
                    
                    const wireframeMat = new THREE.MeshStandardMaterial({
                        color: 0xff6600,
                        wireframe: true,
                        emissive: 0xff6600, // Orange
                        emissiveIntensity: 7.5 // 50% brighter (increased from 5.0)
                    });
                    
                    hoveredMesh.material = wireframeMat;
                    
                    // Create bounding box helper that respects rotation
                    if (boundingBoxHelper) {
                        boundingBoxHelper.parent.remove(boundingBoxHelper);
                    }
                    
                    // Remove old corner indicators
                    cornerIndicators.forEach(indicator => {
                        if (indicator.parent) {
                            indicator.parent.remove(indicator);
                        }
                    });
                    cornerIndicators = [];
                    
                    if (hoveredMesh.geometry) {
                        // Create a new geometry for the bounding box
                        hoveredMesh.geometry.computeBoundingBox();
                        const bbox = hoveredMesh.geometry.boundingBox;
                        
                        // Calculate center offset from geometry center
                        const center = bbox.getCenter(new THREE.Vector3());
                        
                        const box = new THREE.BoxGeometry(
                            bbox.max.x - bbox.min.x,
                            bbox.max.y - bbox.min.y,
                            bbox.max.z - bbox.min.z
                        );
                        
                        const edges = new THREE.EdgesGeometry(box);
                        const boundingBoxWireframe = new THREE.LineSegments(
                            edges,
                            new THREE.LineBasicMaterial({ 
                                color: 0x00ffff, // Cyan
                                emissive: 0x00ffff,
                                emissiveIntensity: 7.5
                            })
                        );
                        
                        // Disable raycasting so it doesn't interfere with hover detection
                        boundingBoxWireframe.raycast = () => {};
                        
                        // Position relative to object's local space
                        boundingBoxWireframe.position.copy(center);
                        
                        // Add as child so it inherits transformations
                        hoveredMesh.add(boundingBoxWireframe);
                        boundingBoxHelper = boundingBoxWireframe;
                        
                        // Create 3D crosses at the 8 corners of the bounding box
                        const corners = [
                            new THREE.Vector3(bbox.min.x, bbox.min.y, bbox.min.z),
                            new THREE.Vector3(bbox.max.x, bbox.min.y, bbox.min.z),
                            new THREE.Vector3(bbox.min.x, bbox.max.y, bbox.min.z),
                            new THREE.Vector3(bbox.max.x, bbox.max.y, bbox.min.z),
                            new THREE.Vector3(bbox.min.x, bbox.min.y, bbox.max.z),
                            new THREE.Vector3(bbox.max.x, bbox.min.y, bbox.max.z),
                            new THREE.Vector3(bbox.min.x, bbox.max.y, bbox.max.z),
                            new THREE.Vector3(bbox.max.x, bbox.max.y, bbox.max.z)
                        ];
                        
                        corners.forEach(corner => {
                            // Create a tiny cross (6 lines pointing in all directions)
                            const crossSize = 0.125; // 75% closer to bounding box (0.5 * 0.25 = 0.125)
                            
                            // Calculate direction vector from center to corner to extend outward
                            const center = bbox.getCenter(new THREE.Vector3());
                            const direction = corner.clone().sub(center).normalize();
                            const offset = direction.multiplyScalar(crossSize); // Extend outward from corner
                            
                            // Create 6 lines extending from the offset position in all directions
                            const centerPoint = corner.clone().add(offset);
                            const lineLength = crossSize * 0.3; // 2x width (was 0.15)
                            
                            const points = [
                                // Lines pointing in all 6 directions (X, -X, Y, -Y, Z, -Z)
                                centerPoint.clone(),
                                centerPoint.clone().add(new THREE.Vector3(lineLength, 0, 0)),
                                
                                centerPoint.clone(),
                                centerPoint.clone().add(new THREE.Vector3(-lineLength, 0, 0)),
                                
                                centerPoint.clone(),
                                centerPoint.clone().add(new THREE.Vector3(0, lineLength, 0)),
                                
                                centerPoint.clone(),
                                centerPoint.clone().add(new THREE.Vector3(0, -lineLength, 0)),
                                
                                centerPoint.clone(),
                                centerPoint.clone().add(new THREE.Vector3(0, 0, lineLength)),
                                
                                centerPoint.clone(),
                                centerPoint.clone().add(new THREE.Vector3(0, 0, -lineLength))
                            ];
                            
                            const crossMaterial = new THREE.LineBasicMaterial({ 
                                color: 0xffd700, // Yellow to match wireframe
                                emissive: 0xffd700,
                                emissiveIntensity: 7.5,
                                transparent: true,
                                opacity: 1.0
                            });
                            
                            const geometry = new THREE.BufferGeometry().setFromPoints(points);
                            const cross = new THREE.LineSegments(geometry, crossMaterial);
                            
                            // Position at origin relative to hoveredMesh
                            cross.position.set(0, 0, 0);
                            cross.raycast = () => {}; // Disable raycasting
                            
                            hoveredMesh.add(cross);
                            cornerIndicators.push(cross);
                        });

                        // 2D screen-facing outline disabled (feature toggle)
                        if (enableScreenOutline) {
                            const min = bbox.min.clone();
                            const max = bbox.max.clone();
                            const size = new THREE.Vector3().subVectors(max, min);
                            const worldCenter = hoveredMesh.localToWorld(bbox.getCenter(new THREE.Vector3()));
                            const boxWidthWorld = size.x;
                            const boxHeightWorld = size.y;
                            if (screenOutline) {
                                scene.remove(screenOutline);
                                screenOutline.geometry.dispose();
                                screenOutline.material.dispose();
                                screenOutline = null;
                            }
                            const outlineGeom = new THREE.BufferGeometry();
                            const hw = boxWidthWorld * 0.5;
                            const hh = boxHeightWorld * 0.5;
                            const outlinePoints = new Float32Array([
                                -hw, -hh, 0,
                                 hw, -hh, 0,
                                 hw,  hh, 0,
                                -hw,  hh, 0,
                                -hw, -hh, 0
                            ]);
                            outlineGeom.setAttribute('position', new THREE.BufferAttribute(outlinePoints, 3));
                            const outlineMat = new THREE.LineBasicMaterial({ color: 0xffd700, transparent: true, opacity: 0.9 });
                            screenOutline = new THREE.Line(outlineGeom, outlineMat);
                            screenOutline.position.copy(worldCenter);
                            screenOutline.quaternion.copy(camera.quaternion);
                            scene.add(screenOutline);
                        }
                    }
                }
            }
    } else {
        // Mouse not over anything - restore immediately
        if (hoveredMesh && hoveredMesh.userData.originalMaterial) {
            // Restore original material immediately
            if (hoveredMesh.material) {
                hoveredMesh.material.dispose();
            }
            const originalMat = hoveredMesh.userData.originalMaterial.clone();
            hoveredMesh.material = originalMat;
            hoveredMesh.userData.originalMaterial = null;
        }
        
        // Remove bounding box helper
        if (boundingBoxHelper && boundingBoxHelper.parent) {
            boundingBoxHelper.parent.remove(boundingBoxHelper);
            boundingBoxHelper = null;
        }
        if (screenOutline) {
            scene.remove(screenOutline);
            screenOutline.geometry.dispose();
            screenOutline.material.dispose();
            screenOutline = null;
        }
        
        // Remove corner indicators
        cornerIndicators.forEach(indicator => {
            if (indicator.parent) {
                indicator.parent.remove(indicator);
            }
        });
        cornerIndicators = [];
        
        // Reset decoder state
        targetText = '';
        currentText = '';
        textDecodeIndex = 0;
        
        // Hide part container
        const partContainerEl = document.getElementById('part-container');
        if (partContainerEl) {
            partContainerEl.classList.remove('visible');
        }
        
        hoveredMesh = null;
        hoverFadeProgress = 0;
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

    // Ambient dust particle field
    const particleCount = 100;
    const particleGeometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const ranges = new THREE.Vector3(5, 3, 5); // scatter volume around car

    for (let i = 0; i < particleCount; i++) {
        positions[i * 3 + 0] = (Math.random() * 2 - 1) * ranges.x;
        positions[i * 3 + 1] = (Math.random() * 2 - 1) * ranges.y + 0.5;
        positions[i * 3 + 2] = (Math.random() * 2 - 1) * ranges.z;
    }
    particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const particleMaterial = new THREE.PointsMaterial({
        color: 0xffd700, // neon yellow
        size: 0.03,
        sizeAttenuation: true,
        transparent: true,
        opacity: 0.9
    });

    const particles = new THREE.Points(particleGeometry, particleMaterial);
    particles.name = 'ambientDust';
    scene.add(particles);

    // Ghost point cloud duplicate of the car
    const ghostGroup = new THREE.Group();
    ghostGroup.name = 'ghostPointCloud';
    const ghostMaterial = new THREE.PointsMaterial({
        color: 0xffd700, // neon yellow
        size: 0.01,
        sizeAttenuation: true,
        transparent: true,
        opacity: 0.35,
        depthWrite: false,
        blending: THREE.AdditiveBlending
    });
    object.traverse((child) => {
        if (child.isMesh && child.geometry) {
            const geom = child.geometry;
            // Ensure we have positions and downsample by 50%
            if (geom.attributes && geom.attributes.position) {
                const pos = geom.attributes.position;
                const count = pos.count;
                const stride = 4; // take every 4th vertex (~75% reduction total)
                const newCount = Math.max(1, Math.floor(count / stride));
                const sampled = new Float32Array(newCount * 3);
                let w = 0;
                for (let i = 0; i < count && w < newCount; i += stride) {
                    sampled[w * 3 + 0] = pos.getX(i);
                    sampled[w * 3 + 1] = pos.getY(i);
                    sampled[w * 3 + 2] = pos.getZ(i);
                    w++;
                }
                const ghostGeom = new THREE.BufferGeometry();
                ghostGeom.setAttribute('position', new THREE.BufferAttribute(sampled, 3));
                const points = new THREE.Points(ghostGeom, ghostMaterial.clone());
                points.position.copy(child.position);
                points.rotation.copy(child.rotation);
                points.scale.copy(child.scale);
                points.matrix.copy(child.matrix);
                points.matrixAutoUpdate = false;
                points.frustumCulled = true;
                ghostGroup.add(points);
            }
        }
    });
    // Attach to the same parent as the model so it follows all transforms
    object.add(ghostGroup);

    // Pick a tire-like mesh for warning blink (fallback: first child mesh)
    let candidate = null;
    object.traverse((child) => {
        if (child.isMesh) {
            const lname = (child.name || '').toLowerCase();
            if (!candidate) candidate = child;
            if (lname.includes('wheel') || lname.includes('tire') || lname.includes('rim')) {
                candidate = child;
            }
        }
    });
    if (candidate && candidate.material) {
        warningMesh = candidate;
        // Detach material from any sharing and ensure emissive support
        let baseMat = candidate.material;
        if (Array.isArray(baseMat)) baseMat = baseMat[0];
        if (!baseMat.isMeshStandardMaterial && !baseMat.isMeshPhysicalMaterial) {
            baseMat = new THREE.MeshStandardMaterial({ color: baseMat.color || new THREE.Color(0x222222) });
        } else {
            baseMat = baseMat.clone();
        }
        warningOriginalEmissive = baseMat.emissive ? baseMat.emissive.clone() : new THREE.Color(0x000000);
        warningOriginalEmissiveIntensity = baseMat.emissiveIntensity || 0.0;
        baseMat.emissive = new THREE.Color(0xff0000); // set to red once; we'll modulate intensity only
        baseMat.emissiveIntensity = 0.0;
        warningMesh.material = baseMat;
        warningMesh.material.needsUpdate = true;
    }
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
    
    // Update Bad TV shader time (disabled)
    // badTVTime += 0.01;
    // badTVPass.uniforms.time.value = badTVTime;
    
    // Update grain time
    grainTime += 0.01;
    grainPass.uniforms.time.value = grainTime;

    // Warning blink (red) at 4 Hz
    if (warningMesh && warningMesh.material) {
        const blinkHz = 4.0;
        const on = Math.sin(grainTime * Math.PI * 2.0 * blinkHz) > 0.0;
        warningMesh.material.emissiveIntensity = on ? 7.5 : 0.0;
        warningMesh.material.needsUpdate = true;
    }
    
    // Update panel blur rect from DOM position
    const infoEl = document.getElementById('part-info');
    if (enablePanelBlur && panelBlurPass && infoEl) {
        const rect = infoEl.getBoundingClientRect();
        const x0 = rect.left / window.innerWidth;
        const y0 = 1.0 - (rect.bottom / window.innerHeight); // flip to GL UV
        const x1 = rect.right / window.innerWidth;
        const y1 = 1.0 - (rect.top / window.innerHeight);
        panelBlurPass.uniforms.rectUV.value.set(x0, y0, x1, y1);
        panelBlurPass.uniforms.resolution.value.set(window.innerWidth, window.innerHeight);
    }

    // Update corner indicator blink (16 blinks per second = 32 Hz)
    if (cornerIndicators.length > 0) {
        const blinkSpeed = 32; // 32 Hz = 16 on/off cycles per second
        const opacity = Math.sin(grainTime * blinkSpeed) > 0 ? 1.0 : 0.0;
        cornerIndicators.forEach(indicator => {
            if (indicator.material) {
                indicator.material.opacity = opacity;
                indicator.material.transparent = true;
            }
        });
    }
    
    // Update text decoder animation
    if (targetText.length > 0) {
        if (textDecodeIndex < targetText.length) {
            textDecodeIndex += textDecodeSpeed;
        }
        const len = Math.min(Math.floor(textDecodeIndex), targetText.length);
        currentText = targetText.substring(0, len);
        
        const partNameEl = document.getElementById('part-name');
        if (partNameEl) {
            partNameEl.textContent = currentText;
        }
    }
    
    // Flicker effect on all text
    const flickerOpacity = 0.75 + Math.random() * 0.25; // Between 0.75 and 1.0
    const partContainerEl = document.getElementById('part-container');
    if (partContainerEl) {
        partContainerEl.style.opacity = flickerOpacity;
    }
    
    // Update controls
    controls.update();
    
    // Auto-rotate the car model slowly
    if (porscheModel) {
        porscheModel.rotation.y += 0.005;
        
        // No fade effects - instant on/off handled in onMouseMove
        
        // Bounding box now inherits transformation as child of hoveredMesh
        // Keep the 2D screen outline facing the camera and sized per hovered object
        if (enableScreenOutline && screenOutline && hoveredMesh) {
            const bbox = hoveredMesh.geometry && (hoveredMesh.geometry.boundingBox || (hoveredMesh.geometry.computeBoundingBox(), hoveredMesh.geometry.boundingBox));
            if (bbox) {
                const size = new THREE.Vector3().subVectors(bbox.max, bbox.min);
                const worldCenter = hoveredMesh.localToWorld(bbox.getCenter(new THREE.Vector3()));
                const boxWidthWorld = size.x;
                const boxHeightWorld = size.y;

                const hw = boxWidthWorld * 0.5;
                const hh = boxHeightWorld * 0.5;
                const arr = screenOutline.geometry.attributes.position.array;
                arr[0] = -hw; arr[1] = -hh; arr[2] = 0;
                arr[3] =  hw; arr[4] = -hh; arr[5] = 0;
                arr[6] =  hw; arr[7] =  hh; arr[8] = 0;
                arr[9] = -hw; arr[10]=  hh; arr[11]= 0;
                arr[12]= -hw; arr[13]= -hh; arr[14]= 0;
                screenOutline.geometry.attributes.position.needsUpdate = true;
                screenOutline.position.copy(worldCenter);
                screenOutline.quaternion.copy(camera.quaternion);
            }
        }
        
        // Update wireframe cycle with smooth transitions - DISABLED
        if (false && porscheModel.userData.wireframeCycle) {
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
    if (fisheyePass) {
        fisheyePass.uniforms.aspectRatio.value = window.innerWidth / window.innerHeight;
    }
    
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    composer.setSize(window.innerWidth, window.innerHeight);

    if (enablePanelBlur && panelBlurPass) {
        panelBlurPass.uniforms.resolution.value.set(window.innerWidth, window.innerHeight);
    }
});

