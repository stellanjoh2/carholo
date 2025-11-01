/**
 * Porsche 911 3D Configurator
 * Interactive 3D model viewer with part inspection, hover effects, and post-processing
 */

// ============================================================================
// IMPORTS
// ============================================================================

import * as THREE from 'three';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { Reflector } from 'three/addons/objects/Reflector.js';

// ============================================================================
// CONSTANTS & CONFIGURATION
// ============================================================================

const CONFIG = {
    CAMERA: {
        FOV: 50,
        NEAR: 0.1,
        FAR: 5000
    },
    BLOOM: {
        STRENGTH: 0.2,
        RADIUS: 0.7,
        THRESHOLD: 0.9
    },
    FISHEYE: {
        FOV: 60,
        STRENGTH: 0.165,
        CYLINDRICAL_RATIO: 1.0
    },
    RGB_SPLIT: {
        AMOUNT: 0.002
    },
    GRAIN: {
        AMOUNT: 0.075
    },
    FOG: {
        COLOR: 0xff6600,
        DENSITY: 0.06
    },
    CLICK: {
        THRESHOLD: 10,
        MAX_TIME: 500
    },
    SOUND: {
        THROTTLE: 50
    }
};

// ============================================================================
// MOBILE DETECTION
// ============================================================================

function isMobileDevice() {
    // Check user agent for mobile devices
    const isMobileUserAgent = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    // Check touch capability
    const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    // Check screen size (optional - phones are typically < 768px)
    const isSmallScreen = window.innerWidth < 768;
    
    return isMobileUserAgent || (isTouchDevice && isSmallScreen);
}

const IS_MOBILE = isMobileDevice();

// ============================================================================
// SCENE SETUP
// ============================================================================

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1a1a1a);

const camera = new THREE.PerspectiveCamera(
    CONFIG.CAMERA.FOV,
    window.innerWidth / window.innerHeight,
    CONFIG.CAMERA.NEAR,
    CONFIG.CAMERA.FAR
);
scene.add(camera); // Required for camera children (UI elements) to render
camera.position.set(0, 5, 10);
camera.updateProjectionMatrix();

const renderer = new THREE.WebGLRenderer({ 
    antialias: true,
    preserveDrawingBuffer: true
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.3;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const container = document.getElementById('canvas-container');
if (container) {
    container.appendChild(renderer.domElement);
} else {
    document.body.appendChild(renderer.domElement);
}

// ============================================================================
// CAMERA CONTROLS
// ============================================================================

const controls = new OrbitControls(camera, renderer.domElement);
// Disable controls on mobile - keep 3D scene visible but non-interactive
if (IS_MOBILE) {
    controls.enabled = false;
    // Disable pointer events on canvas
    renderer.domElement.style.pointerEvents = 'none';
} else {
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.enablePan = true;
controls.panSpeed = 0.8;
controls.screenSpacePanning = true;
controls.mouseButtons = {
    LEFT: THREE.MOUSE.ROTATE,
    MIDDLE: THREE.MOUSE.DOLLY,
        RIGHT: THREE.MOUSE.PAN
    };
    controls.keys = {
        LEFT: 'ArrowLeft',
        UP: 'ArrowUp',
        RIGHT: 'ArrowRight',
        BOTTOM: 'ArrowDown'
    };
}

// Track interaction state for menu/click detection
let isDragging = false;
let cameraIsBeingRotated = false;
let lastCameraRotationTime = 0;

if (!IS_MOBILE) {
    controls.addEventListener('start', () => {
        cameraIsBeingRotated = true;
        isDragging = true;
        lastCameraRotationTime = Date.now();
    });

    controls.addEventListener('end', () => {
        cameraIsBeingRotated = false;
    });

    // Modifier key support for panning (CMD/Ctrl + left mouse)
const domElement = renderer.domElement;
let isModifierPressed = false;

domElement.addEventListener('mousedown', (event) => {
    isModifierPressed = event.metaKey || event.ctrlKey;
    if (isModifierPressed && event.button === 0) {
        controls.mouseButtons.LEFT = THREE.MOUSE.PAN;
    } else if (!isModifierPressed && event.button === 0) {
        controls.mouseButtons.LEFT = THREE.MOUSE.ROTATE;
    }
});

domElement.addEventListener('mouseup', () => {
    if (!isModifierPressed) {
        controls.mouseButtons.LEFT = THREE.MOUSE.ROTATE;
    }
});
}

// ============================================================================
// LIGHTING UTILITIES
// ============================================================================

/**
 * Converts Kelvin temperature to RGB color
 * @param {number} kelvin - Color temperature in Kelvin
 * @returns {THREE.Color} RGB color
 */
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

// ============================================================================
// LIGHTING SETUP
// ============================================================================

// 3-Point Studio Lighting
const keyLight = new THREE.DirectionalLight(kelvinToRgb(6000), 2.0);
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

const fillLight = new THREE.DirectionalLight(kelvinToRgb(3200), 2.5);
fillLight.position.set(-8, 6, 5);
scene.add(fillLight);

const backLight = new THREE.DirectionalLight(kelvinToRgb(8000), 2.0);
backLight.position.set(-3, 8, -10);
scene.add(backLight);

const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
scene.add(ambientLight);

// ============================================================================
// POST-PROCESSING SETUP
// ============================================================================

const composer = new EffectComposer(renderer);
const renderPass = new RenderPass(scene, camera);
composer.addPass(renderPass);

const bloomPass = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    CONFIG.BLOOM.STRENGTH,
    CONFIG.BLOOM.RADIUS,
    CONFIG.BLOOM.THRESHOLD
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
const horizontalFOV = CONFIG.FISHEYE.FOV;
const strength = CONFIG.FISHEYE.STRENGTH;
const cylindricalRatio = CONFIG.FISHEYE.CYLINDRICAL_RATIO;
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
        amount: { value: 0.00225 }
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

// Film grain effect
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
grainPass.uniforms.amount.value = CONFIG.GRAIN.AMOUNT;
let grainTime = 0;
composer.addPass(grainPass);

// Fog
scene.fog = new THREE.FogExp2(CONFIG.FOG.COLOR, CONFIG.FOG.DENSITY);

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

// Panel blur (disabled by default for performance)
const ENABLE_PANEL_BLUR = false;
let panelBlurPass = null;
if (ENABLE_PANEL_BLUR) {
    panelBlurPass = new ShaderPass(panelBlurShader);
    composer.addPass(panelBlurPass);
}

// ============================================================================
// INTERACTION STATE
// ============================================================================

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
let mouseX = 0;
let mouseY = 0;
let hoveredMesh = null;
let hoverFadeProgress = 0;
let boundingBoxHelper = null;
let cornerIndicators = [];
let cornerLabels = [];
let labelsLayerEl = null;
let lockRing = null;
let lockRingTargetScale = 1.0;
let lockRingThickness = 0.01; // ratio of base radius (50% shorter lines)
let lockRingTargetThickness = 0.01;
let lockRingAnim = {
    active: false,
    startTime: 0,
    duration: 200, // ms, same as bbox animation
    fromScale: 1.0,
    toScale: 1.0,
    fromThick: 0.01,
    toThick: 0.01,
    fromOpacity: 0.0,
    toOpacity: 0.0
};

// ============================================================================
// FEATURE FLAGS
// ============================================================================

const ENABLE_HOVER_LIGHT = true;
const ENABLE_SPOT_SHADOW = false;
const ENABLE_GHOST_POINTS = false;

let infoPanelEnabled = true;
let autoRotateEnabled = true;
let assetsReady = false;

// Shared glass materials
let __sharedGlassMaterial = null;
let __windshieldGlassMaterial = null;

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Computes a stable local-space center for a mesh, suitable for attaching hover lights
 * @param {THREE.Mesh} targetMesh - The mesh to compute center for
 * @returns {THREE.Vector3} Local-space center position
 */
function getStableLocalCenter(targetMesh) {
    const tmpBox = new THREE.Box3();
    const tmpVec = new THREE.Vector3();
    // 1) Try world bbox center from full object, then convert to local
    tmpBox.setFromObject(targetMesh);
    let worldCenter = tmpBox.getCenter(new THREE.Vector3());
    if (!(Number.isFinite(worldCenter.x) && Number.isFinite(worldCenter.y) && Number.isFinite(worldCenter.z))) {
        // 2) Fallback to geometry bbox center
        if (targetMesh.geometry) {
            targetMesh.geometry.computeBoundingBox();
            const gb = targetMesh.geometry.boundingBox;
            if (gb) {
                worldCenter = gb.getCenter(new THREE.Vector3());
                targetMesh.localToWorld(worldCenter);
            }
        }
    }
    if (!(Number.isFinite(worldCenter.x) && Number.isFinite(worldCenter.y) && Number.isFinite(worldCenter.z))) {
        // 3) Fallback to world position
        worldCenter = targetMesh.getWorldPosition(new THREE.Vector3());
    }
    // Convert to local
    const localCenter = targetMesh.worldToLocal(worldCenter.clone());
    if (!(Number.isFinite(localCenter.x) && Number.isFinite(localCenter.y) && Number.isFinite(localCenter.z))) {
        // 4) Final fallback: origin
        return tmpVec.set(0, 0, 0);
    }
    return localCenter;
}

// 3D UI: spinning cog icon (bottom-left), rendered as textured plane parented to camera
let uiCogMesh = null;
let uiCogTargetPx = 141; // +10% size from 128px
function initializeUICog() {
    if (uiCogMesh) return;
    try {
        // Load local Porsche logo SVG and tint to UI orange
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = uiCogTargetPx;
            canvas.height = uiCogTargetPx;
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            // Draw with padding and tint to UI yellow
            const pad = Math.floor(canvas.width * 0.08);
            ctx.drawImage(img, pad, pad, canvas.width - pad * 2, canvas.height - pad * 2);
            // Tint
            ctx.globalCompositeOperation = 'source-atop';
            ctx.fillStyle = '#ffd700'; // UI yellow
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.globalCompositeOperation = 'source-over';
            const tex = new THREE.CanvasTexture(canvas);
            tex.colorSpace = THREE.SRGBColorSpace;
            // Keep texture static; we'll rotate mesh in 3D
            const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false, side: THREE.DoubleSide });
            const geo = new THREE.PlaneGeometry(1, 1);
            uiCogMesh = new THREE.Mesh(geo, mat);
            // Parent to camera so it’s a 3D UI element
            camera.add(uiCogMesh);
            uiCogMesh.position.set(0, 0, -1); // will be updated in layout
            uiCogMesh.renderOrder = 2000;
            uiCogMesh.frustumCulled = false;
        };
        img.src = 'porsche-3-logo-svg-vector.svg';
    } catch (_) {
        // No-op fallback
    }
}

function layoutUICog() {
    if (!uiCogMesh) return;
    // keep at constant 128px size and bottom-left with 24px margin
    const d = 1; // fixed distance in camera space
    uiCogMesh.position.z = -d;
    const vFov = THREE.MathUtils.degToRad(camera.fov || 50);
    const viewH = 2 * Math.tan(vFov / 2) * d;
    const viewW = viewH * (camera.aspect || (window.innerWidth / Math.max(1, window.innerHeight)));
    const pxH = viewH / Math.max(1, window.innerHeight);
    const targetHWorld = pxH * uiCogTargetPx;
    const targetWWorld = targetHWorld; // square
    uiCogMesh.scale.set(targetWWorld, targetHWorld, 1);
    // Match other UI vertical padding (~50px) and consistent side margin
    const marginPx = 50;
    const offsetX = (marginPx - window.innerWidth / 2 + uiCogTargetPx / 2) * (viewW / Math.max(1, window.innerWidth));
    const offsetY = (-window.innerHeight / 2 + marginPx + uiCogTargetPx / 2) * (viewH / Math.max(1, window.innerHeight));
    uiCogMesh.position.x = offsetX;
    uiCogMesh.position.y = offsetY;
}

//

function buildLockRingGeometry(baseRadius, thicknessRatio, segments = 32) {
    const outer = baseRadius;
    const inner = baseRadius * (1.0 - Math.max(0, Math.min(1, thicknessRatio)));
    const positions = new Float32Array(segments * 2 * 3);
    for (let i = 0; i < segments; i++) {
        const a = (i / segments) * Math.PI * 2;
        const cos = Math.cos(a);
        const sin = Math.sin(a);
        const ox = cos * outer;
        const oz = sin * outer;
        const ix = cos * inner;
        const iz = sin * inner;
        const idx = i * 2 * 3;
        // outer point (x, y, z) with y=0 plane (we rotate to XZ later)
        positions[idx + 0] = ox;
        positions[idx + 1] = 0;
        positions[idx + 2] = oz;
        // inner point
        positions[idx + 3] = ix;
        positions[idx + 4] = 0;
        positions[idx + 5] = iz;
    }
    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    return geom;
}

// Bounding box animation system
let boundingBoxAnimation = {
    isAnimating: false,
    startTime: 0,
    duration: 200, // 0.2 seconds in milliseconds
    startScale: new THREE.Vector3(0, 0, 0),
    targetScale: new THREE.Vector3(1, 1, 1),
    currentScale: new THREE.Vector3(0, 0, 0),
    cornerIndicators: [] // Track corner indicators for animation
};

// Easing function for smooth animation (ease-out for clean scaling)
function easeOut(t) {
    return 1 - Math.pow(1 - t, 3);
}

// Start bounding box animation
function startBoundingBoxAnimation() {
    boundingBoxAnimation.isAnimating = true;
    boundingBoxAnimation.startTime = performance.now();
    boundingBoxAnimation.startScale.set(0, 0, 0);
    boundingBoxAnimation.targetScale.set(1, 1, 1);
    boundingBoxAnimation.currentScale.set(0, 0, 0);
    boundingBoxAnimation.cornerIndicators = []; // Clear previous indicators
    // Clear labels in animation state as well
    boundingBoxAnimation.cornerLabels = [];
}
// screenOutline removed completely
let enableScreenOutline = false; // feature toggle
let modelMaxDimension = 1; // updated after model load for scale-aware filters
let warningMesh = null;
let warningOriginalEmissive = null;
let warningOriginalEmissiveIntensity = 0;

// Soft hover light that matches hovered part status color
let hoverPointLight = null;
let hoverLightOwner = null;
let hoverLightLastUpdate = 0;

function cleanupHoverLights() {
    // Ensure only one hover light exists in the scene
    const toRemove = [];
    scene.traverse((n) => {
        if (n.isLight && n.userData && n.userData.isHoverLight) {
            if (hoverPointLight && n === hoverPointLight) return;
            toRemove.push(n);
        }
    });
    toRemove.forEach((l) => {
        if (l.parent) l.parent.remove(l);
        l.dispose?.();
    });
}


// Text decoding animation
let currentText = '';
let targetText = '';
let textDecodeIndex = 0;
let textDecodeSpeed = 3; // characters per frame

// Planetary orbits (dashed ring dashes) around car
const orbitsGroup = new THREE.Group();
orbitsGroup.userData.isHelper = true;
let orbitParents = [];
scene.add(orbitsGroup);

function createPlanetaryOrbitsAround(object) {
    // Compute a comfortable radius based on model size
    const modelBox = new THREE.Box3().setFromObject(object);
    const modelSize = modelBox.getSize(new THREE.Vector3());
    const modelCenter = modelBox.getCenter(new THREE.Vector3());
    const maxDim = Math.max(modelSize.x, modelSize.y, modelSize.z);
    const modelRadius = maxDim * 0.65;
    const sphereRadius = maxDim * 0.8; // matches wireframe sphere radius
    
    // Slightly lift and center the orbit group above the podium to avoid intersections
    orbitsGroup.position.set(modelCenter.x, modelCenter.y + modelSize.y * 0.05, modelCenter.z);

    // Helper to create one orbit with dashes
    function makeOrbit(radius, colorHex, tiltEuler, dashCount, spinSpeed) {
        const parent = new THREE.Group();
        parent.rotation.set(tiltEuler.x, tiltEuler.y, tiltEuler.z);

        // Create very thin dash segments as lines (1px, like wireframes)
        // Choose dash length so that dash length equals gap length along the arc
        const phiStep = (Math.PI * 2) / dashCount;
        const arcLengthPerStep = radius * phiStep;
        const dashLength = arcLengthPerStep * 0.5; // dash == gap for symmetry
        const lineMat = new THREE.LineBasicMaterial({ color: colorHex, transparent: true, opacity: 0.8 });
        for (let i = 0; i < dashCount; i++) {
            const theta = (i / dashCount) * Math.PI * 2;
            const center = new THREE.Vector3(Math.cos(theta) * radius, 0, Math.sin(theta) * radius);
            // Tangent direction along ring
            const tangent = new THREE.Vector3(-Math.sin(theta), 0, Math.cos(theta)).normalize();
            const start = center.clone().addScaledVector(tangent, -dashLength * 0.5);
            const end = center.clone().addScaledVector(tangent, dashLength * 0.5);
            const g = new THREE.BufferGeometry().setFromPoints([start, end]);
            const seg = new THREE.Line(g, lineMat.clone());
            parent.add(seg);
        }

        // Optional faint guide ring (also as a thin line)
        const circlePts = new THREE.Path().absarc(0, 0, radius, 0, Math.PI * 2, false).getPoints(256);
        const circleGeom = new THREE.BufferGeometry().setFromPoints(circlePts.map(p => new THREE.Vector3(p.x, 0, p.y)));
        const circleMat = new THREE.LineBasicMaterial({ color: colorHex, opacity: 0.18, transparent: true });
        const circle = new THREE.LineLoop(circleGeom, circleMat);
        parent.add(circle);

        orbitsGroup.add(parent);
        orbitParents.push({ parent, spinSpeed });
    }

    // Build 3 differently tilted orbits; ensure they never intersect the wireframe sphere
    // Push outward ~15% more, clamped to stay inside the wireframe sphere
    const r1 = sphereRadius * 0.995; // was 0.98
    const r2 = sphereRadius * 0.965; // ~0.93 * 1.15 (clamped)
    const r3 = sphereRadius * 0.94;  // ~0.88 * 1.15 (clamped)
    makeOrbit(r1, 0xffa500, new THREE.Euler(0.45, 0.0, 0.12), 64, 0.12);
    makeOrbit(r2, 0xffd700, new THREE.Euler(0.1, 0.6, -0.2), 96, -0.08);
    makeOrbit(r3, 0xff8844, new THREE.Euler(-0.35, -0.15, 0.4), 128, 0.06);
}

// Scattered crosses around the car near the rings
const scatteredCrossGroup = new THREE.Group();
scatteredCrossGroup.userData.isHelper = true;
let scatteredCrosses = [];
scene.add(scatteredCrossGroup);

function createScatteredCrossesAround(object, count = 32) {
    // Use model radius for placement similar to rings
    const modelBox = new THREE.Box3().setFromObject(object);
    const modelSize = modelBox.getSize(new THREE.Vector3());
    const modelRadius = Math.max(modelSize.x, modelSize.y, modelSize.z) * 0.65;
    const targetRadius = modelRadius * 1.26; // close to outer ring but inside sphere

    // Clear previous
    scatteredCrosses.forEach(c => scatteredCrossGroup.remove(c));
    scatteredCrosses = [];

    // Golden spiral (Fibonacci sphere) distribution
    const offset = 2 / count;
    const increment = Math.PI * (3 - Math.sqrt(5));

    for (let i = 0; i < count; i++) {
        const y = ((i * offset) - 1) + (offset / 2);
        const r = Math.sqrt(1 - y * y);
        const phi = i * increment;
        const pos = new THREE.Vector3(
            Math.cos(phi) * r,
            y,
            Math.sin(phi) * r
        ).multiplyScalar(targetRadius);

        // Build a small 3D cross like bbox corners
        const crossSize = modelRadius * 0.04; // half size compared to previous scattered crosses
        const lineLength = crossSize * 0.3; // half the perceived arm length
        const points = [
            // X axis
            new THREE.Vector3(-lineLength, 0, 0), new THREE.Vector3(lineLength, 0, 0),
            // Y axis
            new THREE.Vector3(0, -lineLength, 0), new THREE.Vector3(0, lineLength, 0),
            // Z axis
            new THREE.Vector3(0, 0, -lineLength), new THREE.Vector3(0, 0, lineLength),
        ];
        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        const material = new THREE.LineBasicMaterial({ color: 0xffd700, transparent: true, opacity: 0.6 });
        const cross = new THREE.LineSegments(geometry, material);
        cross.position.copy(pos);
        cross.raycast = () => {};
        scatteredCrossGroup.add(cross);
        scatteredCrosses.push(cross);
    }
}

// Tooltip typewriter animation
let tooltipTypewriterActive = false;
let tooltipCurrentText = '';
let tooltipTargetText = '';
let tooltipTypewriterIndex = 0;
let tooltipTypewriterSpeed = 1.5; // characters per frame (slower)

// Sound effects - preload audio
const hoverSound = new Audio('261590__kwahmah_02__little-glitch.flac');
hoverSound.volume = 0.36; // Increased by 20% (0.3 * 1.2 = 0.36)

// Web Audio API sound generator for retro/digital UI sounds
let audioContext = null;
let soundThrottleLastPlayed = {};
const SOUND_THROTTLE = CONFIG.SOUND.THROTTLE;

// Initialize audio context on first user interaction (browser requirement)
function initAudioContext() {
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    // Resume if suspended (browsers suspend audio context until user interaction)
    if (audioContext.state === 'suspended') {
        audioContext.resume();
    }
}

function createUISound(type) {
    // Initialize audio context if needed
    initAudioContext();
    
    if (!audioContext) return;
    
    const now = performance.now();
    if (soundThrottleLastPlayed[type] && (now - soundThrottleLastPlayed[type]) < SOUND_THROTTLE) {
        return; // Throttle rapid sounds
    }
    soundThrottleLastPlayed[type] = now;
    
    const now_time = audioContext.currentTime;
    const masterVolume = 0.15; // Subtle volume
    
    switch(type) {
        case 'reveal':
            // Short digital pop/click with upward sweep
            const osc1 = audioContext.createOscillator();
            const gain1 = audioContext.createGain();
            osc1.type = 'square';
            osc1.frequency.setValueAtTime(800, now_time);
            osc1.frequency.exponentialRampToValueAtTime(1200, now_time + 0.08);
            gain1.gain.setValueAtTime(0, now_time);
            gain1.gain.linearRampToValueAtTime(masterVolume * 0.6, now_time + 0.01);
            gain1.gain.exponentialRampToValueAtTime(0.001, now_time + 0.08);
            osc1.connect(gain1);
            gain1.connect(audioContext.destination);
            osc1.start(now_time);
            osc1.stop(now_time + 0.08);
            break;
            
        case 'close':
            // Reverse reveal - downward sweep
            const osc2 = audioContext.createOscillator();
            const gain2 = audioContext.createGain();
            osc2.type = 'square';
            osc2.frequency.setValueAtTime(1200, now_time);
            osc2.frequency.exponentialRampToValueAtTime(600, now_time + 0.1);
            gain2.gain.setValueAtTime(0, now_time);
            gain2.gain.linearRampToValueAtTime(masterVolume * 0.5, now_time + 0.01);
            gain2.gain.exponentialRampToValueAtTime(0.001, now_time + 0.1);
            osc2.connect(gain2);
            gain2.connect(audioContext.destination);
            osc2.start(now_time);
            osc2.stop(now_time + 0.1);
            break;
            
        case 'hover':
            // Short digital blip/click - higher frequency and sharper
            const osc3 = audioContext.createOscillator();
            const gain3 = audioContext.createGain();
            osc3.type = 'square'; // Square wave for sharper sound
            osc3.frequency.setValueAtTime(1800, now_time); // Increased from 1200 to 1800Hz
            gain3.gain.setValueAtTime(0, now_time);
            gain3.gain.linearRampToValueAtTime(masterVolume * 0.4, now_time + 0.005);
            gain3.gain.exponentialRampToValueAtTime(0.001, now_time + 0.03);
            osc3.connect(gain3);
            gain3.connect(audioContext.destination);
            osc3.start(now_time);
            osc3.stop(now_time + 0.03);
            break;
            
        case 'select':
            // Fast digital click/blip for button selection - higher frequency and sharper
            const osc4 = audioContext.createOscillator();
            const gain4 = audioContext.createGain();
            osc4.type = 'square'; // Square wave for sharper sound
            osc4.frequency.setValueAtTime(2200, now_time); // Increased from 1500 to 2200Hz
            gain4.gain.setValueAtTime(0, now_time);
            gain4.gain.linearRampToValueAtTime(masterVolume * 0.5, now_time + 0.002);
            gain4.gain.exponentialRampToValueAtTime(0.001, now_time + 0.02);
            osc4.connect(gain4);
            gain4.connect(audioContext.destination);
            osc4.start(now_time);
            osc4.stop(now_time + 0.02);
            break;
    }
}

// UI hover sound throttling (using hoverSound)
let uiHoverSoundLastPlayed = 0;
const UI_HOVER_SOUND_THROTTLE = 150; // Minimum ms between plays

// Ambient music
const ambientMusic = new Audio('674414__gregorquendel__sci-fi-soundscape-drone-pad-harmonic-008-iv-designed-atmospheres.mp3');
ambientMusic.volume = 0.4;
ambientMusic.loop = true;
ambientMusic.preload = 'auto';
ambientMusic.crossOrigin = 'anonymous';

// Part selection sound (with reverse playback for closing)
let partSelectSoundBuffer = null;
let partSelectSoundReversedBuffer = null;

// Load part selection sound with Web Audio API for reverse playback
async function loadPartSelectSound() {
    if (partSelectSoundBuffer) return; // Already loaded
    
    try {
        initAudioContext();
        if (!audioContext) return;
        
        const response = await fetch('63138__uzerx__sub-a-2-secs.wav');
        const arrayBuffer = await response.arrayBuffer();
        partSelectSoundBuffer = await audioContext.decodeAudioData(arrayBuffer);
        
        // Create reversed buffer
        const length = partSelectSoundBuffer.length;
        const reversed = audioContext.createBuffer(
            partSelectSoundBuffer.numberOfChannels,
            length,
            partSelectSoundBuffer.sampleRate
        );
        
        for (let channel = 0; channel < partSelectSoundBuffer.numberOfChannels; channel++) {
            const channelData = partSelectSoundBuffer.getChannelData(channel);
            const reversedData = reversed.getChannelData(channel);
            for (let i = 0; i < length; i++) {
                reversedData[i] = channelData[length - 1 - i];
            }
        }
        partSelectSoundReversedBuffer = reversed;
    } catch (error) {
        console.error('Failed to load part selection sound:', error);
    }
}

// Play part selection sound (forward or reverse)
function playPartSelectSound(reverse = false) {
    // Initialize audio context if needed
    initAudioContext();
    
    if (!audioContext) {
        // If audio context still not available, try to load and play later
        if (!partSelectSoundBuffer && !partSelectSoundReversedBuffer) {
            loadPartSelectSound().then(() => {
                if (audioContext) {
                    playPartSelectSound(reverse);
                }
            });
        }
        return;
    }
    
    // Resume if suspended
    if (audioContext.state === 'suspended') {
        audioContext.resume();
    }
    
    // Load sound if not already loaded
    if (!partSelectSoundBuffer && !partSelectSoundReversedBuffer) {
        loadPartSelectSound().then(() => playPartSelectSound(reverse));
        return;
    }
    
    const buffer = reverse ? partSelectSoundReversedBuffer : partSelectSoundBuffer;
    if (!buffer) return;
    
    const source = audioContext.createBufferSource();
    const gainNode = audioContext.createGain();
    
    source.buffer = buffer;
    source.connect(gainNode);
    gainNode.connect(audioContext.destination);
    gainNode.gain.value = 0.6; // Volume control
    source.start(0);
}

// Music player state
let isMusicPlaying = false;

// Music player functionality
function initializeMusicPlayer() {
    const musicPlayer = document.getElementById('music-player');
    const musicIcon = document.getElementById('music-icon');
    
    if (!musicPlayer || !musicIcon) {
        console.error('Music player elements not found');
        return;
    }
    
    // Set initial music note icon (yellow) - neutral state
    musicIcon.innerHTML = '<i data-feather="music"></i>';
    if (typeof feather !== 'undefined') {
        feather.replace();
    }
    
    // Add click handler
    musicPlayer.addEventListener('click', () => {
        if (isMusicPlaying) {
            // Pause music
            ambientMusic.pause();
            isMusicPlaying = false;
            musicPlayer.classList.remove('playing');
            
            // Change to music note icon (yellow) - neutral state
            musicIcon.innerHTML = '<i data-feather="music"></i>';
            if (typeof feather !== 'undefined') {
                feather.replace();
            }
            
            console.log('Music paused');
        } else {
            // Play music
            ambientMusic.play().then(() => {
                isMusicPlaying = true;
                musicPlayer.classList.add('playing');
                
                // Change to pause icon (green)
                musicIcon.innerHTML = '<i data-feather="pause"></i>';
                if (typeof feather !== 'undefined') {
                    feather.replace();
                }
                
                console.log('Music started');
            }).catch(e => {
                console.error('Failed to play music:', e);
            });
        }
    });
    
    console.log('Music player initialized');
}

// Fullscreen functionality
function initializeFullscreen() {
    const fullscreenButton = document.getElementById('fullscreen-button');
    const fullscreenIcon = document.getElementById('fullscreen-icon');
    
    if (!fullscreenButton || !fullscreenIcon) {
        console.error('Fullscreen elements not found');
        return;
    }
    
    // Set initial fullscreen icon
    fullscreenIcon.innerHTML = '<i data-feather="maximize"></i>';
    if (typeof feather !== 'undefined') {
        feather.replace();
    }
    
    // Function to toggle fullscreen
    function toggleFullscreen() {
        if (!document.fullscreenElement) {
            // Enter fullscreen
            document.documentElement.requestFullscreen().then(() => {
                console.log('Entered fullscreen');
                // Change icon to minimize (exit fullscreen)
                fullscreenIcon.innerHTML = '<i data-feather="minimize"></i>';
                if (typeof feather !== 'undefined') {
                    feather.replace();
                }
            }).catch(err => {
                console.error('Error entering fullscreen:', err);
            });
        } else {
            // Exit fullscreen
            document.exitFullscreen().then(() => {
                console.log('Exited fullscreen');
                // Change icon back to maximize
                fullscreenIcon.innerHTML = '<i data-feather="maximize"></i>';
                if (typeof feather !== 'undefined') {
                    feather.replace();
                }
            }).catch(err => {
                console.error('Error exiting fullscreen:', err);
            });
        }
    }
    
    // Add click handler
    fullscreenButton.addEventListener('click', toggleFullscreen);
    
    // Add keyboard shortcut (J key)
    document.addEventListener('keydown', (event) => {
        if (event.key.toLowerCase() === 'j' && !event.ctrlKey && !event.metaKey && !event.altKey) {
            // Only trigger if not typing in an input field
            if (event.target.tagName !== 'INPUT' && event.target.tagName !== 'TEXTAREA') {
                event.preventDefault();
                toggleFullscreen();
            }
        }
    });
    
    // Listen for fullscreen changes to update icon
    document.addEventListener('fullscreenchange', () => {
        if (document.fullscreenElement) {
            // In fullscreen
            fullscreenIcon.innerHTML = '<i data-feather="minimize"></i>';
        } else {
            // Not in fullscreen
            fullscreenIcon.innerHTML = '<i data-feather="maximize"></i>';
        }
        if (typeof feather !== 'undefined') {
            feather.replace();
        }
    });
    
    console.log('Fullscreen functionality initialized (J key)');
}

function initializeInfoToggle() {
    const infoBtn = document.getElementById('info-button');
    const infoIcon = document.getElementById('info-icon');
    const partContainer = document.getElementById('part-container');
    if (!infoBtn || !infoIcon || !partContainer) return;
    infoIcon.innerHTML = '<i data-feather="info"></i>';
    if (typeof feather !== 'undefined') { try { feather.replace(); } catch (_) {} }
    const updateButtonState = () => {
        if (infoPanelEnabled) {
            infoBtn.classList.remove('off');
        } else {
            infoBtn.classList.add('off');
        }
    };
    updateButtonState();
    infoBtn.addEventListener('click', () => {
        infoPanelEnabled = !infoPanelEnabled;
        updateButtonState();
        if (!infoPanelEnabled) {
            partContainer.classList.remove('visible');
        } else {
            // If currently hovering, show immediately
            if (hoveredMesh) partContainer.classList.add('visible');
        }
    });
}

// UI hover hard-blink (match tooltip blink)
const uiHoverBlinkTargets = [];
function initializeUIHoverBlink() {
    const buttonIds = ['music-player', 'rotate-button', 'info-button', 'fullscreen-button'];
    buttonIds.forEach((id) => {
        const el = document.getElementById(id);
        if (!el) return;
        // Track hover state via class
        el.addEventListener('mouseenter', () => {
            el.classList.add('ui-hover-blink');
            if (!uiHoverBlinkTargets.includes(el)) uiHoverBlinkTargets.push(el);
            
            // Play popup UI hover sound (same as popup window buttons)
            createUISound('hover');
        });
        el.addEventListener('mouseleave', () => {
            el.classList.remove('ui-hover-blink');
            el.style.opacity = ''; // reset inline override
        });
    });
}

function initializeRotateToggle() {
    const btn = document.getElementById('rotate-button');
    const icon = document.getElementById('rotate-icon');
    if (!btn || !icon) return;
    // Feather repeat icon (two arrows in loop pattern)
    icon.innerHTML = '<i data-feather="repeat"></i>';
    if (typeof feather !== 'undefined') { try { feather.replace(); } catch(_){} }
    const sync = () => {
        if (autoRotateEnabled) btn.classList.remove('paused');
        else btn.classList.add('paused');
    };
    sync();
    btn.addEventListener('click', () => {
        autoRotateEnabled = !autoRotateEnabled;
        sync();
    });
}

// Utility function to capitalize first letter
function capitalizeFirstLetter(string) {
    if (!string) return string;
    return string.charAt(0).toUpperCase() + string.slice(1);
}

// Icon mapping function for status types
function getStatusIcon(statusText) {
    if (statusText.includes('Maintenance') || statusText.includes('Warning')) {
        return 'alert-triangle'; // Warning icon
    } else if (statusText.includes('Operational') || statusText.includes('Excellent') || 
               statusText.includes('Good Condition') || statusText.includes('Optimal')) {
        return 'check-circle'; // Success icon
    } else {
        return 'help-circle'; // Neutral/inspection icon
    }
}
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
    // Disable hover interactions on mobile
    if (IS_MOBILE) return;
    // Update tooltip position
    const tooltip = document.getElementById('tooltip');
    if (tooltip) {
        tooltip.style.left = `${event.clientX}px`;
        tooltip.style.top = `${event.clientY}px`;
    }
    
    // If menu is open, track mouse for menu follow effect
    if (menuVisible) {
        // Keep cursor yellow when menu is open
        const crossEl = document.getElementById('cursor-cross');
        if (crossEl) {
            crossEl.classList.remove('hovering', 'warning', 'good', 'neutral');
        }
        
        const container = document.getElementById('part-menu-container');
        if (container) {
            // Calculate subtle offset based on mouse position relative to screen center
            const centerX = window.innerWidth / 2;
            const centerY = window.innerHeight / 2;
            const mouseX = event.clientX;
            const mouseY = event.clientY;
            
            // Calculate normalized offset (-1 to 1 range)
            const normalizedX = (mouseX - centerX) / centerX;
            const normalizedY = (mouseY - centerY) / centerY;
            
            // Apply subtle follow strength
            menuMouseFollow.targetX = normalizedX * MENU_MOUSE_FOLLOW_STRENGTH;
            menuMouseFollow.targetY = normalizedY * MENU_MOUSE_FOLLOW_STRENGTH;
            
            // Smoothly animate to target position using GSAP (kill previous animation if exists)
            const gsap = window.gsap || window.GSAP;
            if (gsap) {
                if (menuFollowAnimation) {
                    menuFollowAnimation.kill();
                }
                menuFollowAnimation = gsap.to(menuMouseFollow, {
                    x: menuMouseFollow.targetX,
                    y: menuMouseFollow.targetY,
                    duration: 0.3,
                    ease: 'power2.out',
                    onUpdate: () => {
                        // Apply transform offset to container (preserve GSAP y, add mouse follow)
                        const gsapY = gsap.getProperty(container, 'y') || 0;
                        container.style.transform = `translate(calc(-50% + ${menuMouseFollow.x}px), calc(-50% + ${gsapY + menuMouseFollow.y}px))`;
                    }
                });
            }
        }
        
        // Clear any existing hover states (but keep clicked mesh emissive)
        if (hoveredMesh && hoveredMesh !== clickedMesh) {
            // Restore original material (don't clear clickedMesh)
            if (hoveredMesh.userData.originalMaterial) {
                if (hoveredMesh.material) {
                    hoveredMesh.material.dispose();
                }
                hoveredMesh.material = hoveredMesh.userData.originalMaterial.clone();
                hoveredMesh.userData.originalMaterial = null;
            }
            
            // Remove bounding box
            if (boundingBoxHelper && boundingBoxHelper.parent) {
                boundingBoxHelper.parent.remove(boundingBoxHelper);
                boundingBoxHelper = null;
            }
            
            // Remove corner indicators
            cornerIndicators.forEach(indicator => {
                if (indicator.parent) {
                    indicator.parent.remove(indicator);
                }
            });
            cornerIndicators = [];
            
            // Remove labels
            if (cornerLabels.length && labelsLayerEl) {
                cornerLabels.forEach(({ el }) => {
                    if (el && el.parentNode) {
                        labelsLayerEl.removeChild(el);
                    }
                });
            }
            cornerLabels = [];
            
            // Remove hover light
            if (hoverPointLight) {
                scene.remove(hoverPointLight);
                hoverPointLight.dispose?.();
                hoverPointLight = null;
                hoverLightOwner = null;
            }
            
            // Hide tooltip
            if (tooltip) {
                tooltip.classList.remove('visible');
            }
            
            // Reset cursor
            const crossEl = document.getElementById('cursor-cross');
            if (crossEl) {
                crossEl.classList.remove('hovering', 'warning', 'good', 'neutral');
            }
            
            hoveredMesh = null;
            hoverFadeProgress = 0;
        }
        return; // Don't process hover when menu is open
    }
    
    // Normalize mouse coordinates to -1 to 1 range for shader inputs
    mouseX = (event.clientX / window.innerWidth) * 2 - 1;
    mouseY = -(event.clientY / window.innerHeight) * 2 + 1;
    
    // For raycaster
    mouse.x = mouseX;
    mouse.y = mouseY;
    
    raycaster.setFromCamera(mouse, camera);
    
    if (porscheModel) {
        const intersects = raycaster.intersectObject(porscheModel, true);

        // Helper: determine if an object is a valid car part to hover
        function isValidHoverTarget(obj) {
            // Must be a Mesh
            if (!obj || !obj.isMesh) return false;
            // Exclude helpers by userData and known groups
            let n = obj;
            while (n) {
                if (n.userData?.isHelper) return false;
                const nm = (n.name || '').toLowerCase();
                if (nm.includes('reference') || nm.includes('ghostpointcloud') || nm.includes('bounding') || nm.includes('hoverlight') || nm.includes('podium')) return false;
                if (n === orbitsGroup || n === scatteredCrossGroup) return false;
                n = n.parent;
            }
            // Exclude tiny degenerate parts near origin
            const bbox = new THREE.Box3().setFromObject(obj);
            const size = bbox.getSize(new THREE.Vector3());
            const center = bbox.getCenter(new THREE.Vector3());
            const largest = Math.max(size.x, size.y, size.z);
            const nearOrigin = center.length() < modelMaxDimension * 0.05;
            const verySmall = largest < modelMaxDimension * 0.03;
            // Also check geometry vertex count
            const geom = obj.geometry;
            const vertCount = geom?.attributes?.position?.count || 0;
            const tooFewVerts = vertCount > 0 && vertCount < 30;
            if ((nearOrigin && verySmall) || tooFewVerts) return false; // skip micro/stray bits
            return true;
        }

        // Pick first intersect that passes filter
        const validIntersect = intersects.find(hit => isValidHoverTarget(hit.object));
        const crossEl = document.getElementById('cursor-cross');
        if (crossEl) {
            // Cursor color is now managed by status-based classes
            // No need to add 'hovering' class here
        }
        
        if (validIntersect) {
            const currentHovered = validIntersect.object;
            
            // Skip hover detection for ground/plateau mesh
            if (currentHovered.name && currentHovered.name.toLowerCase().includes('plateau')) {
                // Treat as if nothing is hovered
                if (hoveredMesh && hoveredMesh.userData.originalMaterial) {
                    // Restore previous hovered mesh immediately
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
                
                // Remove corner indicators
                cornerIndicators.forEach(indicator => {
                    if (indicator.parent) {
                        indicator.parent.remove(indicator);
                    }
                });
                // Remove any existing labels
                if (cornerLabels.length && labelsLayerEl) {
                    cornerLabels.forEach(({ el }) => labelsLayerEl.removeChild(el));
                }
                cornerLabels = [];
                cornerIndicators = [];

                // Remove hover point light
                if (hoverPointLight) {
                    scene.remove(hoverPointLight);
                    hoverPointLight.dispose?.();
                    hoverPointLight = null;
                    hoverLightOwner = null;
                    cleanupHoverLights();
                }

                // Reset cursor color
                const crossEl = document.getElementById('cursor-cross');
                if (crossEl) {
                    crossEl.classList.remove('hovering', 'warning', 'good', 'neutral');
                }
                
                // Reset decoder state
                targetText = '';
                currentText = '';
                textDecodeIndex = 0;
                
                // Hide tooltip
                const tooltip = document.getElementById('tooltip');
                if (tooltip) {
                    tooltip.classList.remove('visible');
                    // Stop typewriter animation
                    tooltipTypewriterActive = false;
                    tooltipCurrentText = '';
                    tooltipTargetText = '';
                    tooltipTypewriterIndex = 0;
                    
                    // Remove blinking class from status and icon
                    const tooltipStatus = document.getElementById('tooltip-status');
                    const tooltipIcon = document.getElementById('tooltip-icon');
                    if (tooltipStatus) {
                        tooltipStatus.classList.remove('blinking');
                    }
                    if (tooltipIcon) {
                        tooltipIcon.classList.remove('blinking', 'warning', 'good');
                        tooltipIcon.innerHTML = ''; // Clear icon
                    }
                }
                
                // Hide part container
                const partContainerEl = document.getElementById('part-container');
                if (partContainerEl) {
                    partContainerEl.classList.remove('visible');
                }
                
                // Clear part name color classes
                const partNameEl = document.getElementById('part-name');
                if (partNameEl) {
                    partNameEl.classList.remove('warning', 'good');
                }
                
                hoveredMesh = null;
                hoverFadeProgress = 0;
                return; // Exit early, don't process hover
            }
            
                // If we're hovering a new mesh
                if (currentHovered !== hoveredMesh) {
                    // Determine static health status based on part name/UUID
                    const partName = currentHovered.name || 'Unknown Part';
                    const partId = currentHovered.uuid;
                    
                    // Create deterministic status based on part characteristics
                    let randomStatus;
                    const hash = partId.split('').reduce((a, b) => {
                        a = ((a << 5) - a) + b.charCodeAt(0);
                        return a & a;
                    }, 0);
                    
                    // Use hash to determine status category
                    const statusCategory = Math.abs(hash) % 3; // 0, 1, or 2
                    
                    if (statusCategory === 0) {
                        // Good statuses
                        const goodStatuses = [
                            'Status: Operational',
                            'Status: Excellent',
                            'Status: Good Condition',
                            'Status: Optimal Performance'
                        ];
                        randomStatus = goodStatuses[Math.abs(hash) % goodStatuses.length];
                    } else if (statusCategory === 1) {
                        // Warning statuses
                        const warningStatuses = [
                            'Status: Requires Maintenance',
                            'Status: Warning - Check Soon'
                        ];
                        randomStatus = warningStatuses[Math.abs(hash) % warningStatuses.length];
                    } else {
                        // Neutral statuses
                        const neutralStatuses = [
                            'Status: Needs Inspection',
                            'Status: Minor Wear'
                        ];
                        randomStatus = neutralStatuses[Math.abs(hash) % neutralStatuses.length];
                    }
                    
                    // Show tooltip
                    const tooltip = document.getElementById('tooltip');
                    const tooltipPartName = document.getElementById('tooltip-part-name');
                    const tooltipStatus = document.getElementById('tooltip-status');
                    const tooltipIcon = document.getElementById('tooltip-icon');
                    
                    if (tooltip && tooltipPartName && tooltipStatus && tooltipIcon) {
                        tooltip.classList.add('visible');
                        // Scale part name by ~20%
                        tooltipPartName.style.display = 'inline-block';
                        tooltipPartName.style.transform = 'scale(1.2)';
                        tooltipPartName.style.transformOrigin = 'left center';
                        
                        // Start typewriter effect for part name
                        tooltipTargetText = capitalizeFirstLetter(currentHovered.name || 'Unknown Part');
                        tooltipCurrentText = '';
                        tooltipTypewriterIndex = 0;
                        tooltipTypewriterActive = true;
                        
                        // Apply color class to tooltip part name based on status
                        tooltipPartName.classList.remove('warning', 'good');
                        if (randomStatus.includes('Maintenance') || randomStatus.includes('Warning')) {
                            tooltipPartName.classList.add('warning');
                            // Only warning tooltips blink
                            tooltipStatus.classList.add('blinking');
                            tooltipIcon.classList.add('blinking');
                            // Let animator control opacity
                        } else if (randomStatus.includes('Operational') || randomStatus.includes('Excellent') || 
                                   randomStatus.includes('Good Condition') || randomStatus.includes('Optimal')) {
                            tooltipPartName.classList.add('good');
                            tooltipStatus.classList.remove('blinking');
                            tooltipIcon.classList.remove('blinking');
                            // Ensure fully visible when not blinking
                            tooltipStatus.style.opacity = '1';
                            tooltipIcon.style.opacity = '1';
                        } else {
                            // Neutral/static state
                            tooltipStatus.classList.remove('blinking');
                            tooltipIcon.classList.remove('blinking');
                            tooltipStatus.style.opacity = '1';
                            tooltipIcon.style.opacity = '1';
                        }
                        
                        // Set status text and add appropriate class
                        tooltipStatus.textContent = randomStatus;
                        tooltipStatus.classList.remove('warning', 'good'); // Keep blinking flag if set for warnings
                        
                        // Blinking is controlled above; do not force blink here
                        
                        // Set icon based on status
                        const iconName = getStatusIcon(randomStatus);
                        tooltipIcon.innerHTML = `<i data-feather="${iconName}"></i>`;
                        tooltipIcon.classList.remove('warning', 'good'); // Keep blinking flag if set for warnings
                        
                        // Add appropriate color class to icon
                        if (randomStatus.includes('Maintenance') || randomStatus.includes('Warning')) {
                            tooltipIcon.classList.add('warning');
                        } else if (randomStatus.includes('Operational') || randomStatus.includes('Excellent') || 
                                   randomStatus.includes('Good Condition') || randomStatus.includes('Optimal')) {
                            tooltipIcon.classList.add('good');
                        }
                        
                        // Blinking is controlled above; do not force blink here
                        
                        // Initialize Feather icons
                        if (typeof feather !== 'undefined') {
                            feather.replace();
                        }
                        
                        // Update cursor color based on status
                        const crossEl = document.getElementById('cursor-cross');
                        if (crossEl) {
                            crossEl.classList.remove('warning', 'good', 'neutral', 'hovering');
                            
                            if (randomStatus.includes('Maintenance') || randomStatus.includes('Warning')) {
                                tooltipStatus.classList.add('warning');
                                crossEl.classList.add('warning');
                            } else if (randomStatus.includes('Operational') || randomStatus.includes('Excellent') || 
                                       randomStatus.includes('Good Condition') || randomStatus.includes('Optimal')) {
                                tooltipStatus.classList.add('good');
                                crossEl.classList.add('good');
                            } else {
                                crossEl.classList.add('neutral');
                            }
                        }
                        
                        // Tooltip visibility is controlled by CSS classes, not inline styles
                    }
                
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
                    
                    // Start decoder animation for model name (headline)
                    const partContainerEl = document.getElementById('part-container');
                    const partNameEl = document.getElementById('part-name');
                    if (partNameEl) {
                        targetText = 'Porsche 911'; // Source model name as headline
                        currentText = '';
                        textDecodeIndex = 0;
                        
                        // Main mesh name (Porsche 911) should always be yellow neutral
                        partNameEl.classList.remove('warning', 'good');
                        // No color class added - stays default yellow
                    }
                    
                    // Show container if info panel is enabled
                    if (partContainerEl && infoPanelEnabled) {
                        partContainerEl.classList.add('visible');
                    }
                    
                    // Display detailed part information
                    const partInfoEl = document.getElementById('part-info');
                    if (partInfoEl) {
                        const info = [];
                        info.push(`─────────────────────────────────────────`);
                        info.push(`  PART NAME:`);
                        info.push(`    ${capitalizeFirstLetter(hoveredMesh.name || 'Unnamed Part')}`);
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
                    
                    // Determine color based on status (moved here for proper scope)
                    let statusColor = 0xffd700; // Default yellow
                    if (randomStatus.includes('Maintenance') || randomStatus.includes('Warning')) {
                        statusColor = 0xff4444; // Red for warnings
                    } else if (randomStatus.includes('Operational') || randomStatus.includes('Excellent') || 
                               randomStatus.includes('Good Condition') || randomStatus.includes('Optimal')) {
                        statusColor = 0x44ff44; // Green for good status
                    }
                    
                    const wireframeMat = new THREE.MeshStandardMaterial({
                        color: statusColor, // Use status-based color
                        wireframe: true,
                        emissive: statusColor, // Match status color
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
                    if (cornerLabels.length && labelsLayerEl) {
                        cornerLabels.forEach(({ el }) => labelsLayerEl.removeChild(el));
                    }
                    cornerLabels = [];
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
                        
                        // Use the same color as determined for status
                        const bboxColor = statusColor;
                        
                        const edges = new THREE.EdgesGeometry(box);
                        const boundingBoxWireframe = new THREE.LineSegments(
                            edges,
                            new THREE.LineBasicMaterial({ 
                                color: bboxColor, // Status-based color
                                transparent: true,
                                opacity: 1.0,
                                linewidth: 3
                            })
                        );
                        
                        // Disable raycasting so it doesn't interfere with hover detection
                        boundingBoxWireframe.raycast = () => {};
                        
                        // Position relative to object's local space
                        boundingBoxWireframe.position.copy(center);
                        
                        // Add as child so it inherits transformations
                        hoveredMesh.add(boundingBoxWireframe);
                        boundingBoxHelper = boundingBoxWireframe;
                        
                        // Set initial scale to 0 for animation
                        boundingBoxHelper.scale.set(0, 0, 0);
                        
                        // Start bounding box animation
                        startBoundingBoxAnimation();
                        
                        if (ENABLE_HOVER_LIGHT) {
                            // Create or update a soft point light matching part color
                            // Light range scales with the largest dimension of the hovered part
                            const worldBbox = new THREE.Box3().setFromObject(hoveredMesh);
                            const worldCenter = worldBbox.getCenter(new THREE.Vector3());
                            const worldSize = worldBbox.getSize(new THREE.Vector3());
                            const largestDim = Math.max(worldSize.x, worldSize.y, worldSize.z);
                            const lightDistance = Math.max(2.0, largestDim * 4.0);
                            const lightIntensity = 1.6;
                            cleanupHoverLights();
                            if (!hoverPointLight) {
                                hoverPointLight = new THREE.PointLight(statusColor, lightIntensity, lightDistance);
                                hoverPointLight.castShadow = false;
                                hoverPointLight.decay = 2.0;
                                hoverPointLight.userData.isHoverLight = true;
                                hoverPointLight.name = 'HoverLight';
                            }
                            if (hoverPointLight.parent !== hoveredMesh) {
                                if (hoverPointLight.parent) hoverPointLight.parent.remove(hoverPointLight);
                                hoveredMesh.add(hoverPointLight);
                                hoverLightOwner = hoveredMesh;
                            }
                            hoverPointLight.color.setHex(statusColor);
                            const now = performance.now();
                            if (hoverLightOwner !== hoveredMesh || (now - hoverLightLastUpdate) > 100) {
                                hoverPointLight.intensity = lightIntensity;
                                hoverPointLight.distance = lightDistance;
                                const localCenter = getStableLocalCenter(hoveredMesh);
                                hoverPointLight.position.copy(localCenter);
                                hoverLightLastUpdate = now;
                            }
                        } else {
                            cleanupHoverLights();
                        }
                        
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
                            // Place cross exactly at the corner without offset
                            const centerPoint = corner.clone();
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
                                color: bboxColor,
                                transparent: true,
                                opacity: 1.0,
                                linewidth: 3
                            });
                            
                            const geometry = new THREE.BufferGeometry().setFromPoints(points);
                            const cross = new THREE.LineSegments(geometry, crossMaterial);
                            
                            // Position at origin relative to hoveredMesh
                            cross.position.set(0, 0, 0);
                            cross.raycast = () => {}; // Disable raycasting
                            
                            // Set initial scale to 0 for animation
                            cross.scale.set(0, 0, 0);
                            
                            hoveredMesh.add(cross);
                            cornerIndicators.push(cross);
                            boundingBoxAnimation.cornerIndicators.push(cross);

                            // Create/update labels layer once
                            if (!labelsLayerEl) {
                                labelsLayerEl = document.getElementById('labels-layer');
                                if (!labelsLayerEl) {
                                    labelsLayerEl = document.createElement('div');
                                    labelsLayerEl.id = 'labels-layer';
                                    labelsLayerEl.style.position = 'fixed';
                                    labelsLayerEl.style.left = '0';
                                    labelsLayerEl.style.top = '0';
                                    labelsLayerEl.style.width = '100%';
                                    labelsLayerEl.style.height = '100%';
                                    labelsLayerEl.style.pointerEvents = 'none';
                                    document.body.appendChild(labelsLayerEl);
                                }
                            }

                            // Anchor object in 3D to track the cross center
                            const labelAnchor = new THREE.Object3D();
                            labelAnchor.position.copy(centerPoint);
                            hoveredMesh.add(labelAnchor);

                            // DOM element for 2D label
                            const labelEl = document.createElement('div');
                            labelEl.className = 'corner-label';
                            labelEl.style.position = 'absolute';
                            labelEl.style.transform = 'translate(-50%, -50%)';
                            labelEl.style.fontFamily = 'monospace';
                            labelEl.style.fontSize = '11px';
                            const labelColorCss = '#' + ('000000' + bboxColor.toString(16)).slice(-6);
                            labelEl.style.color = labelColorCss;
                            labelEl.style.background = 'transparent';
                            labelEl.style.padding = '0';
                            labelEl.style.borderRadius = '0';
                            labelEl.style.whiteSpace = 'nowrap';
                            labelsLayerEl.appendChild(labelEl);

                            const labelEntry = { anchor: labelAnchor, el: labelEl };
                            cornerLabels.push(labelEntry);
                            if (!boundingBoxAnimation.cornerLabels) boundingBoxAnimation.cornerLabels = [];
                            boundingBoxAnimation.cornerLabels.push(labelEntry);
                        });

                        // Update lock ring target and color to match hovered status
                        if (lockRing && lockRing.material) {
                            // Start lock animation: come from outside (>1) down to podium radius (1.0)
                            lockRingAnim.active = true;
                            lockRingAnim.startTime = performance.now();
                            lockRingAnim.fromScale = Math.max(lockRing.scale.x || 1.0, 1.15);
                            lockRingAnim.toScale = 1.0; // final = podium ring size
                            lockRingAnim.fromThick = lockRingThickness;
                            lockRingAnim.toThick = 0.03; // 50% shorter lines than before
                            lockRingAnim.fromOpacity = lockRing.material.opacity;
                            lockRingAnim.toOpacity = 1.0; // fully visible on lock
                            lockRing.material.color.setHex(statusColor);
                            lockRing.material.needsUpdate = true;
                        }

                        // 2D screen-facing outline removed completely
                    }
                }
            }
    } else {
        // Mouse not over anything - restore immediately
        // Hide tooltip
        const tooltip = document.getElementById('tooltip');
        if (tooltip) {
            tooltip.classList.remove('visible');
            // Stop typewriter animation
            tooltipTypewriterActive = false;
            tooltipCurrentText = '';
            tooltipTargetText = '';
            tooltipTypewriterIndex = 0;
            
            // Remove blinking class from status and icon
            const tooltipStatus = document.getElementById('tooltip-status');
            const tooltipIcon = document.getElementById('tooltip-icon');
                const tooltipPartName = document.getElementById('tooltip-part-name');
            if (tooltipStatus) {
                tooltipStatus.classList.remove('blinking');
            }
            if (tooltipIcon) {
                tooltipIcon.classList.remove('blinking', 'warning', 'good');
                tooltipIcon.innerHTML = ''; // Clear icon
            }
                if (tooltipPartName) {
                    tooltipPartName.style.transform = '';
            }
        }
        
        if (hoveredMesh && hoveredMesh.userData.originalMaterial) {
            // Restore original material immediately
            if (hoveredMesh.material) {
                hoveredMesh.material.dispose();
            }
            const originalMat = hoveredMesh.userData.originalMaterial.clone();
            hoveredMesh.material = originalMat;
            hoveredMesh.userData.originalMaterial = null;
        }

        // Reset lock ring when not hovering
        if (lockRing) {
            // Instantly hide and reset on release
            lockRingAnim.active = false;
            lockRing.scale.set(1, 1, 1);
            lockRingThickness = 0.02;
            const baseR = lockRing.userData.baseRadius || 1.0;
            const inner = baseR * (1.0 - lockRingThickness);
            const outer = baseR;
            const segs = 128;
            const newGeom = new THREE.RingGeometry(inner, outer, segs);
            lockRing.geometry.dispose();
            lockRing.geometry = newGeom;
            lockRing.material.opacity = 0.0;
            lockRing.material.color.setHex(0xffd700);
            lockRing.material.needsUpdate = true;
        }
        
        // Remove bounding box helper
        if (boundingBoxHelper && boundingBoxHelper.parent) {
            boundingBoxHelper.parent.remove(boundingBoxHelper);
            boundingBoxHelper = null;
        }
        // Screen outline removed completely
        
        // Remove corner indicators
        cornerIndicators.forEach(indicator => {
            if (indicator.parent) {
                indicator.parent.remove(indicator);
            }
        });
        if (cornerLabels.length && labelsLayerEl) {
            cornerLabels.forEach(({ el }) => labelsLayerEl.removeChild(el));
        }
        cornerLabels = [];
        cornerIndicators = [];

        // Remove hover point light
        if (hoverPointLight) {
            scene.remove(hoverPointLight);
            hoverPointLight.dispose?.();
            hoverPointLight = null;
            hoverLightOwner = null;
            cleanupHoverLights();
        }

        // Reset cursor color
        const crossEl = document.getElementById('cursor-cross');
        if (crossEl) {
            crossEl.classList.remove('hovering', 'warning', 'good', 'neutral');
        }
        
        // Reset decoder state
        targetText = '';
        currentText = '';
        textDecodeIndex = 0;
        
        // Hide part container
        const partContainerEl = document.getElementById('part-container');
        if (partContainerEl) {
            partContainerEl.classList.remove('visible');
        }
        
        // Clear part name color classes
        const partNameEl = document.getElementById('part-name');
        if (partNameEl) {
            partNameEl.classList.remove('warning', 'good');
        }
        
        hoveredMesh = null;
        hoverFadeProgress = 0;
    }
    }
}

// Only enable mouse interactions on desktop
if (!IS_MOBILE) {
window.addEventListener('mousemove', onMouseMove);
}

// Part menu state and click detection
let clickedMesh = null;
let menuVisible = false;
let menuMouseFollow = { x: 0, y: 0, targetX: 0, targetY: 0 };
let menuFollowAnimation = null; // Track ongoing animation
const MENU_MOUSE_FOLLOW_STRENGTH = 15; // Pixels of movement per screen edge distance (subtle)
let autoRotateStateBeforeMenu = true; // Store auto-rotate state before menu opens
let clickedMeshOriginalMaterial = null; // Store original material of clicked mesh

// Camera focus system - store original camera state before focusing on part
let cameraOriginalState = {
    position: new THREE.Vector3(),
    target: new THREE.Vector3(),
    saved: false
};
let cameraFocusAnimation = null; // Track ongoing camera animation

// Track mouse down position to detect drag vs click
let mouseDownPos = { x: 0, y: 0 };
let mouseDownTime = 0;
const CLICK_THRESHOLD = CONFIG.CLICK.THRESHOLD;
const CLICK_MAX_TIME = CONFIG.CLICK.MAX_TIME;

// Track when mouse button goes down
function onMouseDown(event) {
    if (event.button !== 0) return; // Only left mouse button
    mouseDownPos.x = event.clientX;
    mouseDownPos.y = event.clientY;
    mouseDownTime = Date.now();
    isDragging = false;
}

// Track mouse movement to detect dragging (called from existing onMouseMove handler)
function checkDrag(event) {
    if (mouseDownTime === 0) return false; // Not tracking a drag
    
    const dx = event.clientX - mouseDownPos.x;
    const dy = event.clientY - mouseDownPos.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    if (distance > CLICK_THRESHOLD) {
        isDragging = true; // User is dragging, not clicking
        return true;
    }
    return false;
}

// Note: lastCameraRotationTime is tracked in OrbitControls 'start' event above
// This ensures we only track manual user rotation, not auto-rotation

// Only enable mouse interactions on desktop
if (!IS_MOBILE) {
    window.addEventListener('mousedown', onMouseDown);
}

// Note: We don't add a separate mousemove handler - we'll check drag in the click handler
// The existing onMouseMove handler handles normal mouse tracking

function onMouseClick(event) {
    // Disable clicks on mobile
    if (IS_MOBILE) return;
    // Check if clicking on UI elements (don't trigger menu on UI clicks)
    const target = event.target;
    if (target.closest('#part-menu-overlay') || 
        target.closest('#music-player') || 
        target.closest('#fullscreen-button') || 
        target.closest('#info-button') || 
        target.closest('#rotate-button')) {
        // If clicking backdrop, close menu
        if (target.id === 'part-menu-backdrop') {
            hidePartMenu();
        }
        // Reset drag tracking
        mouseDownTime = 0;
        isDragging = false;
        return;
    }
    
    if (menuVisible) {
        // Reset drag tracking
        mouseDownTime = 0;
        isDragging = false;
        return; // Don't trigger if menu is already open
    }
    
    // Check if this was a true click (not a drag)
    // If mouseDownTime is 0, it means mousedown wasn't tracked - allow click anyway
    let timeSinceDown = 0;
    let distance = 0;
    
    if (mouseDownTime > 0) {
        timeSinceDown = Date.now() - mouseDownTime;
        const dx = event.clientX - mouseDownPos.x;
        const dy = event.clientY - mouseDownPos.y;
        distance = Math.sqrt(dx * dx + dy * dy);
    }
    
    // Don't show menu if:
    // 1. User dragged the mouse (distance > threshold) AND we tracked mousedown
    // 2. Click was too long (time > max time) AND we tracked mousedown
    // 3. Camera is currently being manually rotated by user (not auto-rotation)
    // Note: We don't block based on time since rotation - auto-rotation shouldn't block clicks
    const shouldBlock = (mouseDownTime > 0 && (isDragging || distance > CLICK_THRESHOLD || timeSinceDown > CLICK_MAX_TIME)) ||
                        cameraIsBeingRotated; // Only block if user is actively dragging camera (not auto-rotation)
    
    // Reset drag tracking
    mouseDownTime = 0;
    
    if (shouldBlock) {
        isDragging = false;
        const timeSinceRotation = Date.now() - lastCameraRotationTime;
        console.log('Click blocked:', { isDragging, distance, timeSinceDown, cameraIsBeingRotated, timeSinceRotation });
        return;
    }
    
    // Use same raycaster logic as hover
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    
    raycaster.setFromCamera(mouse, camera);
    
    if (porscheModel) {
        const intersects = raycaster.intersectObject(porscheModel, true);
        
        // Same validation as hover
        function isValidClickTarget(obj) {
            if (!obj || !obj.isMesh) return false;
            let n = obj;
            while (n) {
                if (n.userData?.isHelper) return false;
                const nm = (n.name || '').toLowerCase();
                if (nm.includes('reference') || nm.includes('ghostpointcloud') || nm.includes('bounding') || nm.includes('hoverlight') || nm.includes('podium')) return false;
                if (n === orbitsGroup || n === scatteredCrossGroup) return false;
                n = n.parent;
            }
            const bbox = new THREE.Box3().setFromObject(obj);
            const size = bbox.getSize(new THREE.Vector3());
            const center = bbox.getCenter(new THREE.Vector3());
            const largest = Math.max(size.x, size.y, size.z);
            const nearOrigin = center.length() < modelMaxDimension * 0.05;
            const verySmall = largest < modelMaxDimension * 0.03;
            const geom = obj.geometry;
            const vertCount = geom?.attributes?.position?.count || 0;
            const tooFewVerts = vertCount > 0 && vertCount < 30;
            if ((nearOrigin && verySmall) || tooFewVerts) return false;
            return true;
        }
        
        const validIntersect = intersects.find(hit => isValidClickTarget(hit.object));
        if (validIntersect) {
            clickedMesh = validIntersect.object;
            console.log('Valid click detected on:', clickedMesh.name);
            showPartMenu(clickedMesh);
        } else {
            console.log('Click detected but no valid mesh found. Total intersects:', intersects.length);
        }
    }
}

// Only enable mouse interactions on desktop
if (!IS_MOBILE) {
    window.addEventListener('click', onMouseClick);
}

// Close menu with ESC key
window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && menuVisible) {
        hidePartMenu();
    }
});

// Part menu functions
function getPartMenuOptions(mesh) {
    // Generate part-specific menu options based on the mesh
    const partName = mesh.name || 'Unknown Part';
    const partId = mesh.uuid;
    const hash = partId.split('').reduce((a, b) => {
        a = ((a << 5) - a) + b.charCodeAt(0);
        return a & a;
    }, 0);
    const statusCategory = Math.abs(hash) % 3;
    
    const baseOptions = [
        {
            title: 'View Details',
            desc: 'Inspect part specifications and status',
            action: () => console.log('View details:', partName)
        },
        {
            title: 'Maintenance History',
            desc: 'View service records and maintenance log',
            action: () => console.log('Maintenance history:', partName)
        },
        {
            title: 'Replace Part',
            desc: 'Order replacement or schedule installation',
            action: () => console.log('Replace part:', partName)
        }
    ];
    
    if (statusCategory === 1) {
        // Warning status - add urgent option
        baseOptions.unshift({
            title: '⚠️ Immediate Action Required',
            desc: 'This part requires urgent attention',
            action: () => console.log('Urgent action:', partName)
        });
    } else if (statusCategory === 0) {
        // Good status - add optimization option
        baseOptions.push({
            title: 'Optimize Performance',
            desc: 'Enhance part efficiency and longevity',
            action: () => console.log('Optimize:', partName)
        });
    }
    
    return baseOptions;
}

function showPartMenu(mesh) {
    const gsap = window.gsap || window.GSAP;
    if (!gsap) {
        console.warn('GSAP not loaded');
        return;
    }
    
    // Play part selection sound (forward) - non-blocking, won't prevent popup from opening
    try {
        playPartSelectSound(false);
    } catch (error) {
        console.warn('Failed to play part selection sound:', error);
    }
    
    // Pause car rotation when menu opens
    autoRotateStateBeforeMenu = autoRotateEnabled;
    autoRotateEnabled = false;
    
    // Save original camera state before focusing (only first time)
    if (!cameraOriginalState.saved) {
        cameraOriginalState.position.copy(camera.position);
        cameraOriginalState.target.copy(controls.target);
        cameraOriginalState.saved = true;
    }
    
    // Focus camera on clicked part
    if (mesh && mesh.isMesh) {
        // Get mesh bounding box to find center and size
        const bbox = new THREE.Box3().setFromObject(mesh);
        const partCenter = bbox.getCenter(new THREE.Vector3());
        const partSize = bbox.getSize(new THREE.Vector3());
        const maxSize = Math.max(partSize.x, partSize.y, partSize.z);
        
        // Ensure we have a valid size
        const safeSize = maxSize > 0.001 ? maxSize : 1.0;
        
        // Calculate current distance from camera to part center
        const currentDistance = camera.position.distanceTo(partCenter);
        
        // Calculate direction FROM camera TO part center (direction to zoom in)
        const cameraToPart = partCenter.clone().sub(camera.position);
        let directionToPart = cameraToPart.clone().normalize();
        
        // If direction is invalid or too small, use a default viewing direction
        if (!directionToPart.length() || !Number.isFinite(directionToPart.x) || 
            Math.abs(directionToPart.length()) < 0.1) {
            directionToPart.set(0.3, 0.5, 1).normalize();
        }
        
        // Calculate target distance: Always zoom IN (closer to part)
        // Use 60% of current distance OR 2.5x part size, whichever is closer (ensures we always zoom in)
        const minZoomDistance = safeSize * 2.5;
        const targetDistance = Math.min(currentDistance * 0.6, Math.max(minZoomDistance, currentDistance * 0.6));
        
        // Ensure we're always closer than current distance
        const finalDistance = Math.min(targetDistance, currentDistance * 0.9);
        
        // Calculate new camera position: part center - direction * distance (move camera closer)
        const newCameraPos = partCenter.clone().sub(
            directionToPart.multiplyScalar(finalDistance)
        );
        
        // Kill any ongoing camera animation
        if (cameraFocusAnimation) {
            cameraFocusAnimation.kill();
        }
        
        // Create animation objects for GSAP to tween
        const camPos = { 
            x: camera.position.x, 
            y: camera.position.y, 
            z: camera.position.z 
        };
        const camTarget = { 
            x: controls.target.x, 
            y: controls.target.y, 
            z: controls.target.z 
        };
        const targetPos = { 
            x: newCameraPos.x, 
            y: newCameraPos.y, 
            z: newCameraPos.z 
        };
        const targetTarget = { 
            x: partCenter.x, 
            y: partCenter.y, 
            z: partCenter.z 
        };
        
        // Create timeline for synchronized animation
        const cameraTimeline = gsap.timeline();
        
        // Animate camera position and target together
        cameraTimeline
            .to(camPos, {
                x: targetPos.x,
                y: targetPos.y,
                z: targetPos.z,
                duration: 1.0,
                ease: 'power2.inOut',
                onUpdate: () => {
                    if (Number.isFinite(camPos.x) && Number.isFinite(camPos.y) && Number.isFinite(camPos.z)) {
                        camera.position.set(camPos.x, camPos.y, camPos.z);
                        camera.updateProjectionMatrix();
                    }
                }
            }, 0) // Start at time 0
            .to(camTarget, {
                x: targetTarget.x,
                y: targetTarget.y,
                z: targetTarget.z,
                duration: 1.0,
                ease: 'power2.inOut',
                onUpdate: () => {
                    if (Number.isFinite(camTarget.x) && Number.isFinite(camTarget.y) && Number.isFinite(camTarget.z)) {
                        controls.target.set(camTarget.x, camTarget.y, camTarget.z);
                        controls.update();
                    }
                }
            }, 0); // Start at time 0 (same time as position)
        
        // Store timeline reference
        cameraFocusAnimation = cameraTimeline;
    }
    
    // Keep clicked mesh emissive while menu is open
    if (mesh && mesh.isMesh && mesh.material) {
        // Store original material if not already stored
        if (!clickedMeshOriginalMaterial) {
            if (mesh.userData.originalMaterial) {
                clickedMeshOriginalMaterial = mesh.userData.originalMaterial.clone();
            } else {
                // If mesh currently has wireframe material from hover, we need to find the real original
                // Otherwise clone current material
                clickedMeshOriginalMaterial = mesh.material.clone();
            }
        }
        
        // Determine status color based on mesh UUID (same logic as hover)
        const partId = mesh.uuid;
        const hash = partId.split('').reduce((a, b) => {
            a = ((a << 5) - a) + b.charCodeAt(0);
            return a & a;
        }, 0);
        const statusCategory = Math.abs(hash) % 3;
        
        let statusColor = 0xffd700; // Default yellow
        if (statusCategory === 1) {
            statusColor = 0xff4444; // Red for warnings
        } else if (statusCategory === 0) {
            statusColor = 0x44ff44; // Green for good status
        }
        
        // Apply emissive material (keep wireframe if it's already there, otherwise make it emissive)
        const currentMat = mesh.material;
        let needsNewMaterial = true;
        
        // Check if it already has the right emissive
        if (currentMat.emissive && currentMat.emissiveIntensity && 
            currentMat.emissive.getHex() === statusColor && 
            Math.abs(currentMat.emissiveIntensity - 7.5) < 0.1) {
            needsNewMaterial = false;
        }
        
        if (needsNewMaterial) {
            // Create or clone material with emissive
            const emissiveMat = currentMat.wireframe ? 
                new THREE.MeshStandardMaterial({
                    color: statusColor,
                    wireframe: true,
                    emissive: statusColor,
                    emissiveIntensity: 7.5
                }) :
                currentMat.clone();
            
            if (!currentMat.wireframe) {
                emissiveMat.emissive = new THREE.Color(statusColor);
                emissiveMat.emissiveIntensity = 7.5;
            }
            
            if (currentMat.dispose) {
                currentMat.dispose();
            }
            mesh.material = emissiveMat;
        }
    }
    
    menuVisible = true;
    
    // Force hide OS cursor when menu opens
    document.body.classList.add('menu-open');
    
    // Reset custom cursor to default yellow when menu opens
    const crossEl = document.getElementById('cursor-cross');
    if (crossEl) {
        crossEl.classList.remove('hovering', 'warning', 'good', 'neutral');
        // Keep it at default yellow (no class = yellow)
    }
    
    // Hide tooltip when menu opens
    const tooltip = document.getElementById('tooltip');
    if (tooltip) {
        tooltip.classList.remove('visible');
    }
    
    const overlay = document.getElementById('part-menu-overlay');
    const container = document.getElementById('part-menu-container');
    const title = document.getElementById('part-menu-title');
    const optionsContainer = document.getElementById('part-menu-options');
    const backdrop = document.getElementById('part-menu-backdrop');
    const closeBtn = document.getElementById('part-menu-close');
    
    // Reset menu mouse follow position
    if (menuFollowAnimation) {
        menuFollowAnimation.kill();
        menuFollowAnimation = null;
    }
    menuMouseFollow.x = 0;
    menuMouseFollow.y = 0;
    menuMouseFollow.targetX = 0;
    menuMouseFollow.targetY = 0;
    // GSAP will handle transform via x/y properties, so don't set style directly initially
    
    if (!overlay || !container || !title || !optionsContainer) {
        console.warn('Menu elements not found', { overlay, container, title, optionsContainer });
        return;
    }
    
    console.log('Showing menu for:', mesh.name);
    
    // Set title
    const partName = mesh.name || 'Unknown Part';
    title.textContent = partName;
    
    // Generate options
    const options = getPartMenuOptions(mesh);
    optionsContainer.innerHTML = '';
    
    options.forEach((opt, index) => {
        const optionEl = document.createElement('div');
        optionEl.className = 'part-menu-option';
        
        // Add warning class if it's the urgent action option
        if (opt.title.includes('⚠️') || opt.title.includes('Immediate Action')) {
            optionEl.classList.add('warning-option');
        }
        
        // Replace warning emoji with feather icon
        let titleHtml = opt.title;
        if (opt.title.includes('⚠️')) {
            titleHtml = opt.title.replace('⚠️', 
                '<span class="warning-icon-wrapper">' +
                '<i data-feather="alert-triangle" class="warning-icon-feather"></i>' +
                '</span>'
            );
        }
        
        optionEl.innerHTML = `
            <div class="part-menu-option-title">${titleHtml}</div>
            <div class="part-menu-option-desc">${opt.desc}</div>
        `;
        
        // Initialize feather icons after adding to DOM
        if (typeof feather !== 'undefined') {
            feather.replace();
        }
        
        // Add hover sound to menu options (digital UI sound)
        optionEl.addEventListener('mouseenter', () => {
            createUISound('hover');
        });
        
        optionEl.addEventListener('click', () => {
            opt.action();
            
            // 3 quick hard blinks before closing
            const gsap = window.gsap || window.GSAP;
            if (gsap) {
                const blinkTimeline = gsap.timeline({
                    onComplete: () => {
                        hidePartMenu();
                    }
                });
                
                // 3 quick hard blinks (blink on/off 3 times - faster and harder)
                // Start with opacity 1, then blink off/on 3 times with synced sounds
                for (let i = 0; i < 3; i++) {
                    blinkTimeline
                        .to(optionEl, { opacity: 0, duration: 0.05, ease: 'none' }) // Hard off (fast, no opacity)
                        .call(() => createUISound('select')) // Sync sound to blink
                        .to(optionEl, { opacity: 1, duration: 0.05, ease: 'none' }); // Hard on (fast)
                }
            } else {
                // Fallback if GSAP not available
                hidePartMenu();
            }
        });
        optionsContainer.appendChild(optionEl);
    });
    
    // Close button
    closeBtn.onclick = () => hidePartMenu();
    
    // Close menu when clicking outside (on backdrop)
    backdrop.onclick = (event) => {
        // Only close if clicking directly on backdrop, not if click bubbled from container
        if (event.target === backdrop) {
            hidePartMenu();
        }
    };
    
    // Disable CSS transitions on all elements before animating to ensure same fade speed
    const partContainerEl = document.getElementById('part-container');
    const uiButtons = [
        document.getElementById('music-player'),
        document.getElementById('fullscreen-button'),
        document.getElementById('rotate-button'),
        document.getElementById('info-button')
    ];
    
    // Disable CSS transitions temporarily for synchronized GSAP animations
    const allElements = [partContainerEl, ...uiButtons].filter(el => el !== null);
    allElements.forEach(el => {
        el.style.transition = 'none'; // Disable CSS transitions
    });
    
    // Hide left side info window and title when menu opens
    if (partContainerEl) {
        gsap.to(partContainerEl, { opacity: 0, duration: 0.3, ease: 'power2.out', overwrite: true });
    }
    
    // Hide UI buttons with exact same timing as info field
    uiButtons.forEach(btn => {
        if (btn) {
            gsap.to(btn, { opacity: 0, duration: 0.3, ease: 'power2.out', overwrite: true });
        }
    });
    
    // Hide Porsche logo (3D mesh) with same timing
    if (uiCogMesh && uiCogMesh.material) {
        gsap.to(uiCogMesh.material, { opacity: 0, duration: 0.3, ease: 'power2.out' });
    }
    
    // Show overlay and make visible
    overlay.classList.add('visible');
    gsap.set(overlay, { opacity: 1 }); // Ensure overlay is visible
    
    // GSAP animation: fade in backdrop
    gsap.fromTo(backdrop, { opacity: 0 }, { opacity: 1, duration: 0.3, ease: 'power2.out' });
    
    // GSAP animation: hard mask reveal downward (like being drawn out) + subtle downward movement
    gsap.set(container, { 
        clipPath: 'inset(0% 0% 100% 0%)', // Start: fully masked (revealed from top, 100% hidden at bottom)
        y: -50 // Start 50px above final position
    });
    gsap.to(container, { 
        clipPath: 'inset(0% 0% 0% 0%)', // End: fully revealed
        y: 0, // Ease into final position (50px downward movement)
        duration: 0.25, 
        ease: 'circ.out' // Circular easing - intense at start, smooth at end
    });
    
    // GSAP animation: stagger options in with yellow blink (oldschool digital computer look)
    // Buttons start immediately, overlapping with window reveal (0.25s)
    const optionElements = optionsContainer.querySelectorAll('.part-menu-option');
    
    // Simple ease-out entry animation (no bounce)
    optionElements.forEach((el, index) => {
        gsap.set(el, { opacity: 0, y: -20 }); // Start from top (negative y)
        
        // Clean ease-out animation without bounce
        // Start delay: 0s + stagger offset (buttons start immediately, overlapping with window reveal)
        gsap.to(el, { 
            opacity: 1,
            y: 0,
            duration: 0.3,
            delay: 0 + (index * 0.08),
            ease: 'power1.out' // Simple ease-out, no bounce
        });
        
        // Yellow blink effect (simplified, separate from movement)
        const yellowBlink = gsap.timeline({ delay: 0 + (index * 0.08) });
        yellowBlink
            .set(el, { backgroundColor: '#ffd700' }) // Solid yellow blink
            .to(el, { duration: 0.1, backgroundColor: 'rgba(255, 215, 0, 0.05)' }); // Back to normal
    });
    
    // Clear GSAP inline backgroundColor after animation completes so CSS hover works
    optionElements.forEach((el, index) => {
        setTimeout(() => {
            // Clear GSAP's inline backgroundColor so CSS hover can work
            // Adjusted for new delay: container reveal (0.5s) + stagger delay + animation duration
            gsap.set(el, { clearProps: 'backgroundColor' });
        }, (0 + index * 0.08 + 0.4) * 1000); // After animation completes (delay + stagger + animation)
    });
}

function hidePartMenu() {
    const gsap = window.gsap || window.GSAP;
    if (!gsap) return;
    
    const overlay = document.getElementById('part-menu-overlay');
    const container = document.getElementById('part-menu-container');
    const backdrop = document.getElementById('part-menu-backdrop');
    const optionsContainer = document.getElementById('part-menu-options');
    
    if (!overlay || !container) return;
    
    // GSAP animation: stagger options out
    const optionElements = optionsContainer.querySelectorAll('.part-menu-option');
    gsap.to(optionElements, {
        opacity: 0,
        y: -10,
        duration: 0.2,
        stagger: 0.03,
        ease: 'power2.in'
    });
    
    // GSAP animation: hard mask hide upward (reverse of reveal)
    gsap.to(container, {
        clipPath: 'inset(0% 0% 100% 0%)', // Hide by masking from bottom (reveal from top, 100% hidden at bottom)
        y: 0, // Keep at final position while hiding
        duration: 0.4,
        ease: 'power2.in',
        onComplete: () => {
            overlay.classList.remove('visible');
            menuVisible = false;
            
            // Restore OS cursor when menu closes
            document.body.classList.remove('menu-open');
            
            // Restore clicked mesh material when menu closes
            if (clickedMesh && clickedMeshOriginalMaterial) {
                // Only restore if mesh is not currently hovered
                if (clickedMesh !== hoveredMesh) {
                    if (clickedMesh.material && clickedMesh.material.dispose) {
                        clickedMesh.material.dispose();
                    }
                    clickedMesh.material = clickedMeshOriginalMaterial.clone();
                }
                clickedMeshOriginalMaterial = null;
            }
            
            clickedMesh = null;
            
            // Restore camera to original position when menu closes
            if (cameraOriginalState.saved) {
                // Create animation objects for GSAP to tween
                const camPos = { x: camera.position.x, y: camera.position.y, z: camera.position.z };
                const camTarget = { x: controls.target.x, y: controls.target.y, z: controls.target.z };
                
                // Kill any ongoing camera animation
                if (cameraFocusAnimation) {
                    cameraFocusAnimation.kill();
                }
                
                // Animate camera back to original position
                gsap.to(camPos, {
                    x: cameraOriginalState.position.x,
                    y: cameraOriginalState.position.y,
                    z: cameraOriginalState.position.z,
                    duration: 1.0,
                    ease: 'power2.inOut',
                    onUpdate: () => {
                        camera.position.set(camPos.x, camPos.y, camPos.z);
                        camera.updateProjectionMatrix();
                    }
                });
                
                // Animate camera target back to original
                gsap.to(camTarget, {
                    x: cameraOriginalState.target.x,
                    y: cameraOriginalState.target.y,
                    z: cameraOriginalState.target.z,
                    duration: 1.0,
                    ease: 'power2.inOut',
                    onUpdate: () => {
                        controls.target.set(camTarget.x, camTarget.y, camTarget.z);
                        controls.update();
                    },
                    onComplete: () => {
                        // Reset saved flag so we can save new position if another part is clicked
                        cameraOriginalState.saved = false;
                        
                        // Resume car rotation to previous state after camera animation completes
                        autoRotateEnabled = autoRotateStateBeforeMenu;
                        
                        // Fade in UI elements after camera has eased back to final position
                        const partContainerEl = document.getElementById('part-container');
                        const uiButtons = [
                            document.getElementById('music-player'),
                            document.getElementById('fullscreen-button'),
                            document.getElementById('rotate-button'),
                            document.getElementById('info-button')
                        ];
                        
                        // Disable CSS transitions temporarily for synchronized GSAP animations
                        const allElements = [partContainerEl, ...uiButtons].filter(el => el !== null);
                        allElements.forEach(el => {
                            el.style.transition = 'none'; // Disable CSS transitions
                        });
                        
                        if (partContainerEl && infoPanelEnabled) {
                            gsap.to(partContainerEl, { opacity: 1, duration: 0.3, ease: 'power2.out', overwrite: true });
                        }
                        
                        // Show UI buttons with same timing as info field
                        uiButtons.forEach(btn => {
                            if (btn) {
                                gsap.to(btn, { opacity: 1, duration: 0.3, ease: 'power2.out', overwrite: true });
                            }
                        });
                        
                        // Show Porsche logo (3D mesh) again with same timing
                        if (uiCogMesh && uiCogMesh.material) {
                            gsap.to(uiCogMesh.material, { opacity: 1, duration: 0.3, ease: 'power2.out' });
                        }
                    }
                });
            } else {
                // No camera animation - resume car rotation and fade in UI elements immediately
                autoRotateEnabled = autoRotateStateBeforeMenu;
                
                const partContainerEl = document.getElementById('part-container');
                const uiButtons = [
                    document.getElementById('music-player'),
                    document.getElementById('fullscreen-button'),
                    document.getElementById('rotate-button'),
                    document.getElementById('info-button')
                ];
                
                // Disable CSS transitions temporarily for synchronized GSAP animations
                const allElements = [partContainerEl, ...uiButtons].filter(el => el !== null);
                allElements.forEach(el => {
                    el.style.transition = 'none'; // Disable CSS transitions
                });
                
                if (partContainerEl && infoPanelEnabled) {
                    gsap.to(partContainerEl, { opacity: 1, duration: 0.3, ease: 'power2.out', overwrite: true });
                }
                
                // Show UI buttons with same timing as info field
                uiButtons.forEach(btn => {
                    if (btn) {
                        gsap.to(btn, { opacity: 1, duration: 0.3, ease: 'power2.out', overwrite: true });
                    }
                });
                
                // Show Porsche logo (3D mesh) again with same timing
                if (uiCogMesh && uiCogMesh.material) {
                    gsap.to(uiCogMesh.material, { opacity: 1, duration: 0.3, ease: 'power2.out' });
                }
            }
            
            // Reset container position when menu closes
            const resetContainer = document.getElementById('part-menu-container');
            if (menuFollowAnimation) {
                menuFollowAnimation.kill();
                menuFollowAnimation = null;
            }
            if (resetContainer) {
                resetContainer.style.transform = 'translate(-50%, -50%)';
            }
            menuMouseFollow.x = 0;
            menuMouseFollow.y = 0;
            menuMouseFollow.targetX = 0;
            menuMouseFollow.targetY = 0;
        }
    });
    
    // Fade out backdrop
    gsap.to(backdrop, { opacity: 0, duration: 0.3 });
}

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
        
        // Rename car parts to proper English names
        const partNameMap = {
            // French to English translations (with variations)
            'carrosserie': 'Body Panel',
            'carosserie': 'Body Panel',
            'carroserie': 'Body Panel',
            'caroserie': 'Body Panel',
            'chassis': 'Chassis Frame',
            'châssis': 'Chassis Frame',
            'cadre': 'Frame Structure',
            'coque': 'Body Shell',
            'exterieur': 'Exterior Panel',
            'extérieur': 'Exterior Panel',
            'interieur': 'Interior Panel',
            'intérieur': 'Interior Panel',
            'porte': 'Door Panel',
            'portes': 'Door Panel',
            'capot': 'Hood Panel',
            'coffre': 'Trunk Lid',
            'pare': 'Bumper',
            'pare': 'Windshield',
            'grille': 'Front Grille',
            'vitre': 'Window Glass',
            'vitres': 'Window Glass',
            'fenetre': 'Window Glass',
            'fenêtre': 'Window Glass',
            'fenetres': 'Window Glass',
            'fenêtres': 'Window Glass',
            'retro': 'Side Mirror',
            'rétro': 'Side Mirror',
            'retroviseur': 'Side Mirror',
            'rétroviseur': 'Side Mirror',
            'siege': 'Seat Assembly',
            'siège': 'Seat Assembly',
            'sieges': 'Seat Assembly',
            'sièges': 'Seat Assembly',
            'volant': 'Steering Wheel',
            'tableau': 'Dashboard',
            'tableau': 'Dashboard',
            'console': 'Center Console',
            'pedale': 'Pedal Assembly',
            'pédale': 'Pedal Assembly',
            'pedales': 'Pedal Assembly',
            'pédales': 'Pedal Assembly',
            'frein': 'Brake System',
            'freins': 'Brake System',
            'roue': 'Wheel Assembly',
            'roues': 'Wheel Assembly',
            'pneu': 'Tire',
            'pneus': 'Tire',
            'jante': 'Wheel Rim',
            'jantes': 'Wheel Rim',
            'suspension': 'Suspension System',
            'suspensions': 'Suspension System',
            'amortisseur': 'Shock Absorber',
            'amortisseurs': 'Shock Absorber',
            'ressort': 'Coil Spring',
            'ressorts': 'Coil Spring',
            'moteur': 'Engine Block',
            'cylindre': 'Cylinder Head',
            'cylindres': 'Cylinder Head',
            'piston': 'Piston Assembly',
            'pistons': 'Piston Assembly',
            'vilebrequin': 'Crankshaft',
            'arbre': 'Camshaft',
            'soupape': 'Valve System',
            'soupapes': 'Valve System',
            'admission': 'Intake Manifold',
            'echappement': 'Exhaust System',
            'échappement': 'Exhaust System',
            'turbo': 'Turbocharger',
            'compresseur': 'Supercharger',
            'batterie': 'Battery',
            'alternateur': 'Alternator',
            'demarreur': 'Starter Motor',
            'démarreur': 'Starter Motor',
            'allumage': 'Ignition System',
            'bougie': 'Spark Plug',
            'bougies': 'Spark Plug',
            'bobine': 'Ignition Coil',
            'bobines': 'Ignition Coil',
            'fil': 'Wiring Harness',
            'fils': 'Wiring Harness',
            'fusible': 'Fuse Box',
            'fusibles': 'Fuse Box',
            'relais': 'Relay Module',
            'transmission': 'Transmission',
            'boite': 'Gearbox',
            'boîte': 'Gearbox',
            'embrayage': 'Clutch Assembly',
            'volant': 'Flywheel',
            'differentiel': 'Differential',
            'différentiel': 'Differential',
            'essieu': 'Drive Axle',
            'essieux': 'Drive Axle',
            'cardan': 'Driveshaft',
            'radiateur': 'Radiator',
            'refroidissement': 'Coolant System',
            'thermostat': 'Thermostat',
            'pompe': 'Water Pump',
            'ventilateur': 'Cooling Fan',
            'ventilateurs': 'Cooling Fan',
            'tuyau': 'Coolant Hose',
            'tuyaux': 'Coolant Hose',
            'carburant': 'Fuel System',
            'reservoir': 'Fuel Tank',
            'réservoir': 'Fuel Tank',
            'injecteur': 'Fuel Injector',
            'injecteurs': 'Fuel Injector',
            'filtre': 'Fuel Filter',
            'filtres': 'Fuel Filter',
            'ligne': 'Fuel Line',
            'lignes': 'Fuel Line',
            'air': 'Air System',
            'masse': 'Mass Air Flow Sensor',
            'papillon': 'Throttle Body',
            'phare': 'Headlight',
            'phares': 'Headlight',
            'feu': 'Taillight',
            'feux': 'Taillight',
            'clignotant': 'Turn Signal',
            'clignotants': 'Turn Signal',
            'antibrouillard': 'Fog Light',
            'antibrouillards': 'Fog Light',
            'led': 'LED Light',
            'aileron': 'Spoiler',
            'ailerons': 'Spoiler',
            'antenne': 'Antenna',
            'antennes': 'Antenna',
            'essuie': 'Wiper Blade',
            'essuie': 'Wiper Blade',
            'silencieux': 'Muffler',
            'catalyseur': 'Catalytic Converter',
            'capteur': 'Sensor Unit',
            'capteurs': 'Sensor Unit',
            'calculateur': 'Engine Control Unit',
            'abs': 'ABS System',
            'airbag': 'Airbag System',
            'airbags': 'Airbag System',
            
            // Additional French terms found
            'disque': 'Brake Disc',
            'disques': 'Brake Disc',
            'porterie': 'Door Assembly',
            'porteries': 'Door Assembly',
            'portiere': 'Door Panel',
            'portieres': 'Door Panel',
            'planche': 'Dashboard',
            'planches': 'Dashboard',
            'baguette': 'Trim Strip',
            'baguettes': 'Trim Strip',
            'enjo': 'Wheel Hub',
            'enjos': 'Wheel Hub',
            
            // Body parts
            'body': 'Body Panel',
            'chassis': 'Chassis Frame',
            'frame': 'Frame Structure',
            'shell': 'Body Shell',
            'exterior': 'Exterior Panel',
            
            // Engine components
            'engine': 'Engine Block',
            'motor': 'Engine Motor',
            'cylinder': 'Cylinder Head',
            'piston': 'Piston Assembly',
            'crankshaft': 'Crankshaft',
            'camshaft': 'Camshaft',
            'valve': 'Valve System',
            'intake': 'Intake Manifold',
            'exhaust': 'Exhaust System',
            'turbo': 'Turbocharger',
            'supercharger': 'Supercharger',
            
            // Wheels and suspension
            'wheel': 'Wheel Assembly',
            'tire': 'Tire',
            'rim': 'Wheel Rim',
            'suspension': 'Suspension System',
            'shock': 'Shock Absorber',
            'spring': 'Coil Spring',
            'strut': 'Strut Assembly',
            'control': 'Control Arm',
            'brake': 'Brake System',
            'rotor': 'Brake Rotor',
            'caliper': 'Brake Caliper',
            'pad': 'Brake Pad',
            
            // Interior
            'seat': 'Seat Assembly',
            'dashboard': 'Dashboard',
            'steering': 'Steering Wheel',
            'pedal': 'Pedal Assembly',
            'console': 'Center Console',
            // Doors (prioritize over drivetrain terms)
            'door': 'Door Panel',
            'porte': 'Door Panel',
            'portiere': 'Door Panel',
            'portière': 'Door Panel',
            'porteri': 'Door Panel',
            'handle': 'Door Handle',
            'mirror': 'Side Mirror',
            
            // Electrical
            'battery': 'Battery',
            'alternator': 'Alternator',
            'starter': 'Starter Motor',
            'ignition': 'Ignition System',
            'spark': 'Spark Plug',
            'coil': 'Ignition Coil',
            'wire': 'Wiring Harness',
            'fuse': 'Fuse Box',
            'relay': 'Relay Module',
            
            // Transmission
            'transmission': 'Transmission',
            'gearbox': 'Gearbox',
            'levier': 'Gearbox',
            'levier de vitesse': 'Gearbox',
            'levier-vitesse': 'Gearbox',
            'clutch': 'Clutch Assembly',
            'flywheel': 'Flywheel',
            'differential': 'Differential',
            'axle': 'Drive Axle',
            'driveshaft': 'Driveshaft',
            'cv': 'CV Joint',
            
            // Cooling system
            'radiator': 'Radiator',
            'coolant': 'Coolant System',
            'thermostat': 'Thermostat',
            'water': 'Water Pump',
            'fan': 'Cooling Fan',
            'hose': 'Coolant Hose',
            
            // Fuel system
            'fuel': 'Fuel System',
            'tank': 'Fuel Tank',
            'pump': 'Fuel Pump',
            'injector': 'Fuel Injector',
            'filter': 'Fuel Filter',
            'line': 'Fuel Line',
            
            // Air system
            'air': 'Air System',
            'filter': 'Air Filter',
            'mass': 'Mass Air Flow Sensor',
            'throttle': 'Throttle Body',
            
            // Glass and windows
            'glass': 'Glass Panel',
            'window': 'Window Glass',
            'windshield': 'Windshield',
            'windscreen': 'Windscreen',
            'rear': 'Rear Window',
            'side': 'Side Window',
            
            // Lights
            'light': 'Light Assembly',
            'headlight': 'Headlight',
            'taillight': 'Taillight',
            'brake': 'Brake Light',
            'turn': 'Turn Signal',
            'fog': 'Fog Light',
            'led': 'LED Light',
            
            // Miscellaneous
            'bumper': 'Bumper',
            'grille': 'Front Grille',
            'hood': 'Hood Panel',
            'trunk': 'Trunk Lid',
            'spoiler': 'Spoiler',
            'wing': 'Rear Wing',
            'antenna': 'Antenna',
            'wiper': 'Wiper Blade',
            'muffler': 'Muffler',
            'catalyst': 'Catalytic Converter',
            'sensor': 'Sensor Unit',
            'ecu': 'Engine Control Unit',
            'abs': 'ABS System',
            'airbag': 'Airbag System'
        };
        
        // Precompute model bounds for naming heuristics
        const namingBBox = new THREE.Box3().setFromObject(object);
        const namingCenter = namingBBox.getCenter(new THREE.Vector3());
        const namingSize = namingBBox.getSize(new THREE.Vector3());
        const namingMax = Math.max(namingSize.x, namingSize.y, namingSize.z);
        
        // Apply English names to car parts
        object.traverse((child) => {
            if (child.isMesh && child.name) {
                const originalName = child.name.toLowerCase();
                let renamed = false;
                
                // Clean the name - remove numbers, special chars, and common prefixes
                const cleanName = originalName
                    .replace(/[0-9_\-\.]/g, ' ')
                    .replace(/\b(mesh|part|object|group|node|porsche|911)\b/g, '')
                    .trim();
                const deaccentName = (originalName || '')
                    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
                    .replace(/[0-9_\-\.]/g, ' ');
                const deaccentClean = (cleanName || '')
                    .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
                
                // Find matching part name (try both original and cleaned name)
                for (const [key, englishName] of Object.entries(partNameMap)) {
                    const k = (key || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
                    if (originalName.includes(key) || cleanName.includes(key) || deaccentName.includes(k) || deaccentClean.includes(k)) {
                        child.name = englishName;
                        console.log(`Renamed: "${originalName}" -> "${englishName}"`);
                        renamed = true;
                        break;
                    }
                }
                // If we matched Gearbox but the part looks like a side door, override to Door Panel
                if (renamed && child.name === 'Gearbox') {
                    const bbox = new THREE.Box3().setFromObject(child);
                    const c = bbox.getCenter(new THREE.Vector3()).sub(namingCenter);
                    const s = bbox.getSize(new THREE.Vector3());
                    // Loosen thresholds: doors are wide/tall side panels near car sides
                    const side = Math.abs(c.x) > namingMax * 0.10; // closer to side
                    const panelLike = (s.y > s.x * 0.6) && (s.z < namingMax * 0.8);
                    if (side && panelLike) {
                        child.name = 'Door Panel';
                    }
                }
                
                // If no match found, try to create a generic name
                if (!renamed) {
                    // Extract meaningful parts from the cleaned name
                    const words = cleanName.split(/\s+/).filter(word => 
                        word.length > 2 && 
                        !['part', 'mesh', 'object', 'group', 'node', 'porsche', '911', 'car'].includes(word)
                    );
                    
                    if (words.length > 0) {
                        const capitalizedWords = words.map(word => 
                            word.charAt(0).toUpperCase() + word.slice(1)
                        );
                        child.name = capitalizedWords.join(' ');
                        console.log(`Generic rename: "${originalName}" -> "${child.name}"`);
                    } else {
                        // Last resort - use a generic name based on position
                        const bbox = new THREE.Box3().setFromObject(child);
                        const center = bbox.getCenter(new THREE.Vector3());
                        const size = bbox.getSize(new THREE.Vector3());
                        
                        if (center.y > 0.5) {
                            child.name = 'Upper Body Panel';
                        } else if (center.y < -0.5) {
                            child.name = 'Lower Body Panel';
                        } else if (center.x > 0.3) {
                            child.name = 'Right Side Panel';
                        } else if (center.x < -0.3) {
                            child.name = 'Left Side Panel';
                        } else {
                            child.name = 'Center Body Panel';
                        }
                        console.log(`Position-based rename: "${originalName}" -> "${child.name}"`);
                    }
                }
            }
        });
        
        // Center the model
        const box = new THREE.Box3().setFromObject(object);
        const center = box.getCenter(new THREE.Vector3());
        object.position.sub(center);
        
        // Store original local transforms for every mesh so we can restore if anything drifts
        object.updateMatrixWorld(true);
        object.traverse((n) => {
            if (n.isMesh || n.isGroup) {
                n.userData.originalLocalMatrix = n.matrix.clone();
            }
        });

        // Hard-restore original local transforms to ensure perfect fidelity on spawn
        object.traverse((n) => {
            if (n.userData && n.userData.originalLocalMatrix && (n.isMesh || n.isGroup)) {
                const m = n.userData.originalLocalMatrix;
                n.matrix.copy(m);
                n.matrix.decompose(n.position, n.quaternion, n.scale);
                n.updateMatrixWorld(true);
            }
        });
        
        // Identify and convert ONLY window/glass materials (by name only, not color)
        const glassMeshes = [];
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
                    
                    // Create or reuse a shared glass material so all glass looks identical
                    if (!__sharedGlassMaterial) {
                        // Simplified: use same base as car body shader, just more transparent and double-sided
                        __sharedGlassMaterial = new THREE.MeshPhysicalMaterial({
                            color: 0x333333, // match car base color tone
                            opacity: 0.52, // ~20% more transparent than 0.65
                        transparent: true,
                        side: THREE.DoubleSide,
                            roughness: 0.0,
                            metalness: 1.0,
                            envMapIntensity: 1.0,
                            envMap: scene.environment,
                        clearcoat: 1.0,
                            clearcoatRoughness: 0.0,
                            sheen: 2.0,
                            sheenRoughness: 0.3,
                            sheenColor: new THREE.Color(0xff6600),
                            iridescence: 1.0,
                            iridescenceIOR: 1.3,
                            iridescenceThicknessRange: [100, 500],
                            depthWrite: false
                        });
                    } else {
                        __sharedGlassMaterial.envMap = scene.environment;
                        __sharedGlassMaterial.opacity = 0.52;
                        __sharedGlassMaterial.needsUpdate = true;
                    }
                    
                    // Dispose old material
                    if (Array.isArray(child.material)) {
                        child.material.forEach(mat => mat.dispose());
                    } else {
                        child.material.dispose();
                    }
                    
                    // Use one unified material for all glass (including windshield)
                    child.material = __sharedGlassMaterial;
                    child.material.needsUpdate = true;
                    // Ensure glass draws after opaque to avoid OIT artifacts
                    child.renderOrder = 1000;
                    child.castShadow = false;
                    child.receiveShadow = false;
                    // Mark and normalize
                    child.userData.isGlass = true;
                    const lname = (child.name || '').toLowerCase();
                    if (lname.includes('windshield') || lname.includes('windscreen')) {
                        child.userData.displayName = 'Window Glass';
                    }

                    glassMeshes.push(child);
                }
            }
        });

        // De-duplicate overlapping glass shells (e.g., windshield inner/outer) to avoid double darkening
        if (glassMeshes.length > 1) {
            const groups = new Map();
            const tmpBox = new THREE.Box3();
            const tmpCenter = new THREE.Vector3();
            glassMeshes.forEach((m) => {
                tmpBox.setFromObject(m);
                const size = tmpBox.getSize(new THREE.Vector3());
                tmpBox.getCenter(tmpCenter);
                const key = [
                    Math.round(tmpCenter.x * 50) / 50,
                    Math.round(tmpCenter.y * 50) / 50,
                    Math.round(tmpCenter.z * 50) / 50,
                    Math.round(size.x * 50) / 50,
                    Math.round(size.y * 50) / 50,
                    Math.round(size.z * 50) / 50
                ].join('|');
                if (!groups.has(key)) groups.set(key, []);
                groups.get(key).push(m);
            });
            groups.forEach((arr) => {
                if (arr.length > 1) {
                    // Keep the first visible, hide the rest to prevent layered transparency
                    for (let i = 1; i < arr.length; i++) {
                        arr[i].visible = false;
                        arr[i].userData.hiddenAsDuplicateGlass = true;
                    }
                }
            });
        }
        
        // Convert materials to physical materials for reflections
        object.traverse((child) => {
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
                
                // Do NOT overwrite any glass we just set up
                if (child.material && !child.userData.isGlass) {
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
                    child.material.side = THREE.DoubleSide; // render both sides to hide flipped faces
                    child.material.needsUpdate = true;
                }
            }
        });

        // Identify and separate the large round base (podium) from the FBX so it can have a unique material
        (function separateAndStylePodium(root) {
            const candidates = [];
            const tmp = new THREE.Vector3();
            const modelBBox = new THREE.Box3().setFromObject(root);
            const modelSize = modelBBox.getSize(new THREE.Vector3());
            const minExpectedRadius = Math.max(modelSize.x, modelSize.z) * 0.5; // podium should be similar size to car footprint

            root.traverse((child) => {
                if (!child.isMesh) return;
                const lname = (child.name || '').toLowerCase();
                const named = lname.includes('floor') || lname.includes('podium') || lname.includes('base') || lname.includes('platform') || lname.includes('stand') || lname.includes('pedestal') || lname.includes('disc') || lname.includes('circle');
                const bbox = new THREE.Box3().setFromObject(child);
                const size = bbox.getSize(tmp);
                const roundish = Math.abs(size.x - size.z) <= Math.max(size.x, size.z) * 0.12; // near circular in XZ
                const flat = size.y <= Math.max(size.x, size.z) * 0.08; // thin slab
                const bigEnough = Math.max(size.x, size.z) >= minExpectedRadius;
                const belowCenter = bbox.getCenter(tmp).y <= modelBBox.getCenter(new THREE.Vector3()).y + size.y * 0.5; // not floating above
                const score = (named ? 3 : 0) + (roundish ? 2 : 0) + (flat ? 1 : 0) + (bigEnough ? 1 : 0) + (belowCenter ? 1 : 0);
                if (score > 0) candidates.push({ child, score, area: size.x * size.z });
            });

            if (candidates.length === 0) return;
            candidates.sort((a, b) => (b.score - a.score) || (b.area - a.area));
            const podiumMesh = candidates[0].child;

            // Detach from FBX so it is its own top-level object and never shares materials
            scene.attach(podiumMesh); // preserves world transform while changing parent
            podiumMesh.name = 'Podium';

            // Assign a clear, unique, non-specular material
            podiumMesh.material = new THREE.MeshStandardMaterial({
                color: 0x1a1a1a, // slightly darker
                roughness: 0.5, // slightly shinier
                metalness: 0.65, // a touch more metallic
                envMapIntensity: 0.45
            });
            podiumMesh.material.side = THREE.DoubleSide;
            podiumMesh.material.needsUpdate = true;
            podiumMesh.receiveShadow = true; // allow floor to receive shadows
            podiumMesh.castShadow = false;
            podiumMesh.userData.isPodium = true;

            // Podium height restored to original (no lift)
            // If the podium was previously lifted in a prior session, ensure no offset is applied here
            podiumMesh.updateMatrixWorld(true);

            console.log('[Podium]', {
                name: podiumMesh.name,
                uuid: podiumMesh.uuid
            });

            // Add realtime ground reflection above the podium
            (function addGroundReflection(podium) {
                try {
                    const pb = new THREE.Box3().setFromObject(podium);
                    const psize = pb.getSize(new THREE.Vector3());
                    const pradius = Math.max(psize.x, psize.z) * 0.48; // slightly smaller than podium
                    const center = pb.getCenter(new THREE.Vector3());
                    const y = pb.max.y + Math.max(psize.y * 0.015, 0.008) + 0.002; // subtle lift to avoid z-fighting without covering car

                    const mirrorGeom = new THREE.CircleGeometry(pradius, 128);
                    const mirror = new Reflector(mirrorGeom, {
                        clipBias: 0.003,
                        textureWidth: Math.max(256, Math.floor(window.innerWidth * 0.35)),
                        textureHeight: Math.max(256, Math.floor(window.innerHeight * 0.35)),
                        color: 0xffffff,
                        multisample: 2
                    });
                    mirror.frustumCulled = false; // never cull reflector when zooming out
                    // Convert world position to podium local since we'll parent to podium
                    const worldPos = new THREE.Vector3(center.x, y, center.z);
                    const localPos = podium.worldToLocal(worldPos.clone());
                    mirror.position.copy(localPos);
                    // Inherit podium orientation (keep mirror flat on podium surface)
                    mirror.rotation.set(0, 0, 0);
                    mirror.material.transparent = true;
                    mirror.material.opacity = 0.04; // much darker reflection
                    mirror.material.depthWrite = false;
                    mirror.material.depthTest = true; // ensure car renders above when closer
                    mirror.material.fog = false; // do not participate in scene fog
                    mirror.renderOrder = 999; // ensure drawn above the podium
                    mirror.name = 'GroundReflection';

                    // Keep helpers from showing too strongly by slightly dimming env
                    if (mirror.material.uniforms && mirror.material.uniforms.color)
                        mirror.material.uniforms.color.value.multiplyScalar(0.5);

                    // Add radial alpha falloff so reflection darkens toward the rim
                    (function addRadialAlpha(m) {
                        const size = 512;
                        const c = document.createElement('canvas');
                        c.width = size; c.height = size;
                        const ctx = c.getContext('2d');
                        const grd = ctx.createRadialGradient(size/2, size/2, size*0.1, size/2, size/2, size*0.5);
                        // center strong, edge faint
                        grd.addColorStop(0.0, 'rgba(255,255,255,0.8)');
                        grd.addColorStop(0.4, 'rgba(255,255,255,0.2)');
                        grd.addColorStop(1.0, 'rgba(255,255,255,0.005)');
                        ctx.fillStyle = grd;
                        ctx.fillRect(0,0,size,size);
                        const alphaTex = new THREE.CanvasTexture(c);
                        alphaTex.colorSpace = THREE.SRGBColorSpace;
                        m.alphaMap = alphaTex;
                        m.needsUpdate = true;
                    })(mirror.material);

                    // Attach to podium so it follows any transforms exactly
                    podium.add(mirror);
                    mirror.visible = true; // enable roughness-style reflector

                    // Duplicate the reflector disc as a black overlay 1mm above
                    try {
                        const overlayGeom = mirrorGeom.clone();
                        const overlayMat = new THREE.MeshBasicMaterial({
                            color: 0x000000,
                            transparent: true,
                            opacity: 0.5,
                            side: THREE.DoubleSide,
                            depthWrite: false
                        });
                        const overlayDisc = new THREE.Mesh(overlayGeom, overlayMat);
                        // Place at same local position as mirror, then nudge up 1mm
                        overlayDisc.position.copy(mirror.position);
                        overlayDisc.position.y += 0.001; // ~1 mm above reflector in local space
                        overlayDisc.rotation.copy(mirror.rotation);
                        overlayDisc.renderOrder = mirror.renderOrder + 1;
                        overlayDisc.name = 'GroundReflectionOverlay';
                        overlayDisc.visible = false; // hide for now
                        podium.add(overlayDisc);
                    } catch (e) {
                        console.warn('Overlay disc add failed:', e);
                    }

                    // Add a semi-transparent black cylinder just above the reflector
                    try {
                        const cylRadiusTop = pradius * 0.98;
                        const cylRadiusBottom = pradius * 0.98;
                        const cylHeight = Math.max(psize.y * 0.02, 0.01); // thin
                        const cylGeom = new THREE.CylinderGeometry(cylRadiusTop, cylRadiusBottom, cylHeight, 128, 1, true);
                        const cylMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.5, side: THREE.DoubleSide, depthWrite: false });
                        const darkCyl = new THREE.Mesh(cylGeom, cylMat);
                        darkCyl.position.copy(mirror.position.clone());
                        darkCyl.position.y += cylHeight * 0.5; // place just above reflector
                        darkCyl.renderOrder = 1000;
                        darkCyl.name = 'PodiumDarkCylinder';
                        // remove/hide dark cylinder for this pass
                        podium.add(darkCyl);
                        darkCyl.visible = false;
                    } catch (e) {
                        console.warn('Dark cylinder add failed:', e);
                    }
                } catch (e) {
                    console.warn('Ground reflection failed:', e);
                }
            })(podiumMesh);
        })(object);

        // Replace heavy right-rear wheel with a clone of the left-rear wheel if confidently detected
        (function replaceRightRearWheelWithClone(root) {
            try {
                function deepDispose(object) {
                    object.traverse((o) => {
                        if (o.geometry) {
                            o.geometry.dispose?.();
                        }
                        if (o.material) {
                            if (Array.isArray(o.material)) {
                                o.material.forEach(m => m?.dispose?.());
                            } else {
                                o.material.dispose?.();
                            }
                        }
                    });
                }
                function findWheelRoot(node) {
                    const isWheelName = (nm) => nm.includes('wheel assembly') || nm.includes('wheel') || nm.includes('tire') || nm.includes('tyre') || nm.includes('rim') || nm.includes('roue') || nm.includes('pneu') || nm.includes('assembly');
                    let cur = node;
                    let best = node;
                    while (cur && cur.parent && (cur.parent.isGroup || cur.parent.isObject3D)) {
                        const nm = (cur.parent.name || '').toLowerCase();
                        if (isWheelName(nm)) best = cur.parent;
                        cur = cur.parent;
                    }
                    return best;
                }

                const wheels = [];
                const bbox = new THREE.Box3().setFromObject(root);
                const center = bbox.getCenter(new THREE.Vector3());
                root.traverse((n) => {
                    if (!n.isMesh && !n.isGroup) return;
                    const rootWheel = findWheelRoot(n);
                    if (!rootWheel || rootWheel.__wheelCollected) return;
                    const nm = (rootWheel.name || '').toLowerCase();
                    const likelyWheelName = nm.includes('wheel assembly') || nm.includes('wheel') || nm.includes('tire') || nm.includes('tyre') || nm.includes('rim') || nm.includes('roue') || nm.includes('pneu') || nm.includes('assembly');
                    if (!likelyWheelName) return;
                    const box = new THREE.Box3().setFromObject(rootWheel);
                    const size = box.getSize(new THREE.Vector3());
                    const diag = size.length();
                    if (!isFinite(diag) || diag === 0) return;
                    const c = box.getCenter(new THREE.Vector3());
                    const roundish = Math.abs(size.x - size.z) / Math.max(1e-3, Math.max(size.x, size.z)) < 0.3 && size.y < Math.max(size.x, size.z) * 0.6;
                    if (roundish) {
                        rootWheel.__wheelCollected = true;
                        wheels.push({ node: rootWheel, center: c, size });
                    }
                });
                if (wheels.length < 2) {
                    console.log('[WheelClone] Not enough wheel candidates found:', wheels.length);
                    return;
                }

                const left = wheels.filter(w => w.center.x < center.x);
                const right = wheels.filter(w => w.center.x >= center.x);
                if (left.length === 0 || right.length === 0) {
                    console.log('[WheelClone] Could not split wheels into left/right');
                    return;
                }

                function farthestAlongZ(arr) {
                    let best = arr[0];
                    let bestDist = Math.abs(arr[0].center.z - center.z);
                    for (let i = 1; i < arr.length; i++) {
                        const d = Math.abs(arr[i].center.z - center.z);
                        if (d > bestDist) { best = arr[i]; bestDist = d; }
                    }
                    return best;
                }
                const leftRear = farthestAlongZ(left);
                let rightRear = farthestAlongZ(right);

                if (!leftRear || !rightRear) {
                    console.log('[WheelClone] Could not identify rear pair');
                    return;
                }

                const zDelta = Math.abs(leftRear.center.z - rightRear.center.z);
                const sizeDelta = Math.abs(leftRear.size.length() - rightRear.size.length()) / Math.max(1e-3, Math.max(leftRear.size.length(), rightRear.size.length()));
                console.log('[WheelClone] Candidates:', { leftRear: leftRear.node.name, rightRear: rightRear.node.name, zDelta, sizeDelta });

                // Decompose right-rear target transform (or mirror placement)
                let target = rightRear.node;
                let targetParent = target.parent || root;
                target.updateWorldMatrix(true, true);
                const targetMatrixWorld = target.matrixWorld.clone();
                const targetPos = new THREE.Vector3();
                const targetQuat = new THREE.Quaternion();
                const targetScale = new THREE.Vector3();
                targetMatrixWorld.decompose(targetPos, targetQuat, targetScale);

                // If symmetry is too poor, mirror left-rear instead
                const modelSize = bbox.getSize(new THREE.Vector3());
                if (zDelta > modelSize.z * 0.2 || sizeDelta > 0.6) {
                    const leftWorld = new THREE.Vector3();
                    leftRear.node.getWorldPosition(leftWorld);
                    targetPos.set(center.x + Math.abs(leftWorld.x - center.x), leftWorld.y, leftWorld.z);
                    targetQuat.copy(leftRear.node.getWorldQuaternion(new THREE.Quaternion()));
                    targetScale.copy(leftRear.node.getWorldScale(new THREE.Vector3()));
                    target = null;
                    targetParent = root;
                    console.log('[WheelClone] Using mirrored placement fallback at', targetPos.toArray());
                }

                const source = leftRear.node;
                const clone = source.clone(true);
                clone.updateMatrixWorld(true);

                const wasVisible = clone.visible;
                scene.attach(clone);
                clone.position.copy(targetPos);
                clone.quaternion.copy(targetQuat);
                clone.scale.copy(targetScale);
                clone.updateMatrixWorld(true);
                targetParent.attach(clone);
                // Preserve naming for clarity
                if (target && target.name) clone.name = target.name;
                clone.visible = wasVisible;

                if (target) {
                    // Fully remove old high-poly wheel
                    target.userData.replacedByClone = true;
                    const parent = target.parent;
                    deepDispose(target);
                    parent?.remove(target);
                } else {
                    // Hide any wheel near the mirrored spot
                    const hideRadius = Math.max(leftRear.size.x, leftRear.size.z) * 1.5;
                    wheels.forEach((w) => {
                        if (w.center.distanceTo(targetPos) < hideRadius && w.node !== source) {
                            w.node.userData.replacedByClone = true;
                            const parent = w.node.parent;
                            deepDispose(w.node);
                            parent?.remove(w.node);
                        }
                    });
                }

                console.log('[WheelClone] Replaced right-rear wheel with clone of left-rear:', { source: source.name, target: target ? target.name : '(mirrored placement)' });
            } catch (err) {
                console.warn('[WheelClone] Replacement failed:', err);
            }
        })(object);
        
        // Create a lock-on ring above the podium
        (function createLockRing() {
            if (lockRing) return;
            const podium = scene.getObjectByName('Podium');
            const modelBox = new THREE.Box3().setFromObject(object);
            const modelCenter = modelBox.getCenter(new THREE.Vector3());
            let radius = 1.0;
            let ringY = modelCenter.y; // align roughly with car body vertical center
            if (podium && podium.isMesh) {
                const pb = new THREE.Box3().setFromObject(podium);
                const psize = pb.getSize(new THREE.Vector3());
                radius = Math.max(psize.x, psize.z) * 0.5;
                // keep Y aligned to car center instead of podium height
            } else {
                // Fallback: use model footprint
                const msize = modelBox.getSize(new THREE.Vector3());
                radius = Math.max(msize.x, msize.z) * 0.55;
                ringY = modelCenter.y;
            }
            const segs = 32;
            const geom = buildLockRingGeometry(radius, lockRingThickness, segs);
            const mat = new THREE.LineBasicMaterial({ color: 0xffd700, transparent: true, opacity: 0.0 });
            lockRing = new THREE.LineSegments(geom, mat);
            lockRing.position.set(modelCenter.x, ringY, modelCenter.z);
            lockRing.rotation.x = 0; // geometry is already in XZ plane
            lockRing.userData.baseRadius = radius;
            lockRing.userData.segments = segs;
            scene.add(lockRing);
        })();
        
        // Wheel lift removed per request - keep original wheel positions

        // Nudge stray tiny origin bits downward so they don't hover above the floor
        (function sinkStrayOriginBits(root) {
            const modelBBox = new THREE.Box3().setFromObject(root);
            const modelSize = modelBBox.getSize(new THREE.Vector3());
            const down = Math.max(modelSize.x, modelSize.y, modelSize.z) * 0.30; // push far below floor
            root.traverse((node) => {
                if (!node.isPoints) return; // only affect ghost/point helpers, never actual meshes
                // Skip helpers/podium/wheels
                if (node.userData?.isHelper) return;
                const nm = (node.name || '').toLowerCase();
                if (nm.includes('podium') || nm.includes('floor') || nm.includes('base')) return;
                const bbox = new THREE.Box3().setFromObject(node);
                const sz = bbox.getSize(new THREE.Vector3());
                const largest = Math.max(sz.x, sz.y, sz.z);
                const center = bbox.getCenter(new THREE.Vector3());
                const nearOrigin = center.length() < Math.max(modelSize.x, modelSize.y, modelSize.z) * 0.05;
                const small = largest < Math.max(modelSize.x, modelSize.y, modelSize.z) * 0.03;
                const vertCount = node.geometry?.attributes?.position?.count || 0;
                if ((nearOrigin && small) || (vertCount > 0 && vertCount < 30)) {
                    // Move in world space to avoid parent transform side-effects
                    const worldPos = new THREE.Vector3();
                    node.getWorldPosition(worldPos);
                    worldPos.y -= down;
                    if (node.parent) {
                        const localPos = node.parent.worldToLocal(worldPos.clone());
                        node.position.copy(localPos);
                    } else {
                        node.position.copy(worldPos);
                    }
                    node.updateMatrixWorld(true);
                    node.userData.isSunk = true;
                }
            });
        })(object);
        
        scene.add(object);
        porscheModel = object;
        assetsReady = true;
        
        // Spotlight that only lights the car and floor (layers), casting shadows onto the podium
        (function addShadowOnlySpotlight() {
            if (!ENABLE_SPOT_SHADOW) return; // disabled for performance
            const spot = new THREE.SpotLight(0xffffff, 0.55);
            spot.castShadow = true;
            spot.angle = 0.9;
            spot.penumbra = 0.5;
            spot.decay = 2.0;
            spot.shadow.mapSize.set(2048, 2048);
            spot.shadow.bias = -0.0005;
            // Position above and slightly in front of the car
            const mSize = new THREE.Box3().setFromObject(object).getSize(new THREE.Vector3());
            const mMax = Math.max(mSize.x, mSize.y, mSize.z);
            spot.position.set(0, mMax * 1.6, mMax * 0.8);
            spot.target = object;
            scene.add(spot);
            scene.add(spot.target);
            // Use layer 1 for shadow/lighting so nothing else is affected
            spot.layers.set(1);
            object.traverse((n) => { if (n.isMesh) { n.layers.enable(1); n.castShadow = true; } });
            // Ensure podium receives and is on the light layer
            const podium = scene.getObjectByName('Podium');
            if (podium && podium.isMesh) { podium.layers.enable(1); podium.receiveShadow = true; }
        })();
        
        // Adjust camera to view the car
        const size = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);
        modelMaxDimension = maxDim;
        
        // Create wireframed sphere around the car
        const sphereRadius = maxDim * 0.8; // Slightly larger than the car
        const sphereGeometry = new THREE.SphereGeometry(sphereRadius, 32, 16);
        const sphereEdges = new THREE.EdgesGeometry(sphereGeometry);
        const sphereWireframe = new THREE.LineSegments(
            sphereEdges,
            new THREE.LineBasicMaterial({
                color: 0xffd700, // Yellow like our wireframe
                transparent: true,
                opacity: 0.6
            })
        );
        
        // Position sphere at the same center as the car
        sphereWireframe.position.copy(object.position);
        sphereWireframe.name = 'referenceSphere';
        sphereWireframe.userData.isHelper = true;
        scene.add(sphereWireframe);
        camera.position.set(maxDim * 0.3825, maxDim * 0.3078, maxDim * 0.3825); // Even closer and even lower
        controls.target = new THREE.Vector3(0, 0, 0);
        controls.update();
        
        // Diagnostics: check for potentially flipped/inverted normals
        (function checkForFlippedNormals(root) {
            const modelCenter = new THREE.Box3().setFromObject(root).getCenter(new THREE.Vector3());
            const tmpVec = new THREE.Vector3();
            const normal = new THREE.Vector3();
            let suspects = 0;
            root.traverse((mesh) => {
                if (!mesh.isMesh || !mesh.geometry) return;
                const geom = mesh.geometry;
                // Ensure normals exist
                if (!geom.attributes.normal) {
                    geom.computeVertexNormals();
                }
                const pos = geom.attributes.position;
                const nrm = geom.attributes.normal;
                if (!pos || !nrm) return;
                // Sample a handful of vertices
                const step = Math.max(1, Math.floor(pos.count / 200));
                let dotSum = 0, samples = 0;
                for (let i = 0; i < pos.count; i += step) {
                    tmpVec.set(pos.getX(i), pos.getY(i), pos.getZ(i));
                    mesh.localToWorld(tmpVec);
                    normal.set(nrm.getX(i), nrm.getY(i), nrm.getZ(i));
                    normal.transformDirection(mesh.matrixWorld);
                    const toOutside = tmpVec.clone().sub(modelCenter).normalize();
                    dotSum += normal.dot(toOutside);
                    samples++;
                }
                // Detection kept but logging disabled since we render DoubleSide
                // const avgDot = dotSum / Math.max(1, samples);
            });
            // Logging disabled
        })(object);
        
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

    // Enhanced ambient dust particle field
    const particleCount = 120; // 20% more particles (100 → 120)
    const particleGeometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const velocities = new Float32Array(particleCount * 3); // Store velocities for movement
    const ranges = new THREE.Vector3(5, 3, 5); // scatter volume around car

    for (let i = 0; i < particleCount; i++) {
        positions[i * 3 + 0] = (Math.random() * 2 - 1) * ranges.x;
        positions[i * 3 + 1] = (Math.random() * 2 - 1) * ranges.y + 0.5;
        positions[i * 3 + 2] = (Math.random() * 2 - 1) * ranges.z;
        
        // Add subtle random velocities for ambient movement
        velocities[i * 3 + 0] = (Math.random() - 0.5) * 0.02; // X velocity
        velocities[i * 3 + 1] = (Math.random() - 0.5) * 0.01; // Y velocity (slower)
        velocities[i * 3 + 2] = (Math.random() - 0.5) * 0.02; // Z velocity
    }
    particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    particleGeometry.setAttribute('velocity', new THREE.BufferAttribute(velocities, 3));

    const particleMaterial = new THREE.PointsMaterial({
        color: 0xffd700, // Default neon yellow
        size: 0.03,
        sizeAttenuation: true,
        transparent: true,
        opacity: 0.9
    });

    const particles = new THREE.Points(particleGeometry, particleMaterial);
    particles.name = 'ambientDust';
    particles.userData = {
        originalPositions: positions.slice(), // Store original positions
        velocities: velocities,
        currentColor: 0xffd700 // Track current color
    };
    scene.add(particles);

    // Ghost point cloud duplicate of the car
    const ghostGroup = new THREE.Group();
    ghostGroup.name = 'ghostPointCloud';
    ghostGroup.userData.isHelper = true;
    const ghostMaterial = new THREE.PointsMaterial({
        color: 0xffd700, // neon yellow
        size: 0.02,
        sizeAttenuation: true,
        transparent: true,
        opacity: 0.28,
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
                const stride = 10; // take every 10th vertex (25% reduction from stride 8)
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

                // Skip degenerate/tiny meshes near origin to avoid glowing specks
                const bbox = new THREE.Box3().setFromObject(child);
                const sz = bbox.getSize(new THREE.Vector3());
                const largest = Math.max(sz.x, sz.y, sz.z);
                const center = bbox.getCenter(new THREE.Vector3());
                const nearOrigin = center.length() < modelMaxDimension * 0.03;
                if (largest < modelMaxDimension * 0.01 && nearOrigin) {
                    return;
                }

                const points = new THREE.Points(ghostGeom, ghostMaterial.clone());
                points.position.copy(child.position);
                points.rotation.copy(child.rotation);
                points.scale.copy(child.scale);
                points.matrix.copy(child.matrix);
                points.matrixAutoUpdate = false;
                points.frustumCulled = true;
                points.userData.isHelper = true;
                ghostGroup.add(points);
            }
        }
    });
    // Attach to the same parent as the model so it follows all transforms
    object.add(ghostGroup);
    if (!ENABLE_GHOST_POINTS) ghostGroup.visible = false;

        // Add planetary orbit dashes around the car (inside main sphere)
        createPlanetaryOrbitsAround(object);
        // Scatter bbox-like crosses near the rings
        createScatteredCrossesAround(object, 32);

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

    // (Removed) handheld idle camera motion

    // Update particle system with ambient movement and color syncing
    const particles = scene.getObjectByName('ambientDust');
    if (particles && particles.geometry) {
        const positions = particles.geometry.attributes.position.array;
        const velocities = particles.userData.velocities;
        const originalPositions = particles.userData.originalPositions;
        
        // Update particle positions with ambient movement
        for (let i = 0; i < positions.length; i += 3) {
            const particleIndex = i / 3;
            
            // Apply velocity to position
            positions[i] += velocities[i];     // X
            positions[i + 1] += velocities[i + 1]; // Y
            positions[i + 2] += velocities[i + 2]; // Z
            
            // Keep particles within bounds (soft boundary)
            const maxDistance = 6; // Slightly larger than original range
            const distance = Math.sqrt(positions[i] * positions[i] + positions[i + 2] * positions[i + 2]);
            
            if (distance > maxDistance) {
                // Reset to original position if too far
                positions[i] = originalPositions[i];
                positions[i + 1] = originalPositions[i + 1];
                positions[i + 2] = originalPositions[i + 2];
            }
        }
        
        particles.geometry.attributes.position.needsUpdate = true;
        
        // Sync particle color with hovered object health status
        let targetColor = 0xffd700; // Default yellow
        
        if (hoveredMesh) {
            // Get the health status for the currently hovered mesh
            const partId = hoveredMesh.uuid;
            const hash = partId.split('').reduce((a, b) => {
                a = ((a << 5) - a) + b.charCodeAt(0);
                return a & a;
            }, 0);
            const statusCategory = Math.abs(hash) % 3;
            
            if (statusCategory === 0) {
                // Good status - green particles
                targetColor = 0x44ff44;
            } else if (statusCategory === 1) {
                // Warning status - red particles
                targetColor = 0xff4444;
            } else {
                // Neutral status - yellow particles
                targetColor = 0xffd700;
            }
        }
        
        // Smooth color transition
        const currentColor = particles.userData.currentColor;
        const colorDiff = targetColor - currentColor;
        if (Math.abs(colorDiff) > 0.1) {
            particles.userData.currentColor += colorDiff * 0.05; // Smooth transition
            particles.material.color.setHex(particles.userData.currentColor);
        }
    }

    // Update bounding box animation
    if (boundingBoxAnimation.isAnimating && boundingBoxHelper) {
        const currentTime = performance.now();
        const elapsed = currentTime - boundingBoxAnimation.startTime;
        const progress = Math.min(elapsed / boundingBoxAnimation.duration, 1);
        
        // Apply easing function
        const easedProgress = easeOut(progress);
        
        // Interpolate scale
        boundingBoxAnimation.currentScale.lerpVectors(
            boundingBoxAnimation.startScale,
            boundingBoxAnimation.targetScale,
            easedProgress
        );
        
        // Apply scale to bounding box
        boundingBoxHelper.scale.copy(boundingBoxAnimation.currentScale);
        
        // Apply scale to corner indicators
        boundingBoxAnimation.cornerIndicators.forEach(indicator => {
            indicator.scale.copy(boundingBoxAnimation.currentScale);
        });
        
        // Check if animation is complete
        if (progress >= 1) {
            boundingBoxAnimation.isAnimating = false;
            boundingBoxHelper.scale.set(1, 1, 1); // Ensure final scale is exact
            // Ensure corner indicators are at final scale
            boundingBoxAnimation.cornerIndicators.forEach(indicator => {
                indicator.scale.set(1, 1, 1);
            });
        }
    }

    // Animate lock ring scale smoothly toward target
    if (lockRing) {
        // Animate lock ring with same cadence as bbox (200ms, easeOut)
        if (lockRingAnim.active) {
            const now = performance.now();
            const t = Math.min(1, (now - lockRingAnim.startTime) / lockRingAnim.duration);
            const e = 1 - Math.pow(1 - t, 3); // easeOut cubic
            const s = lockRingAnim.fromScale + (lockRingAnim.toScale - lockRingAnim.fromScale) * e;
            const thick = lockRingAnim.fromThick + (lockRingAnim.toThick - lockRingAnim.fromThick) * e;
            const op = lockRingAnim.fromOpacity + (lockRingAnim.toOpacity - lockRingAnim.fromOpacity) * e;
            lockRing.scale.set(s, s, s);
            lockRing.material.opacity = op;
            if (Math.abs(thick - lockRingThickness) > 1e-4) {
                lockRingThickness = thick;
                const baseR = lockRing.userData.baseRadius || 1.0;
                const segs = lockRing.userData.segments || 32;
                const newGeom = buildLockRingGeometry(baseR, lockRingThickness, segs);
                lockRing.geometry.dispose();
                lockRing.geometry = newGeom;
            }
            if (t >= 1) lockRingAnim.active = false;
        }

        // Keep it slightly above podium even if the floor animates
        // Align ring with car body vertical center and model horizontal center
        if (porscheModel) {
            const mb = new THREE.Box3().setFromObject(porscheModel);
            const msize = mb.getSize(new THREE.Vector3());
            const mcenter = mb.getCenter(new THREE.Vector3());
            lockRing.position.set(mcenter.x, mcenter.y, mcenter.z);
            // Sync ring rotation with car so they rotate together
            lockRing.rotation.y = porscheModel.rotation.y;
        }
    }

    // Spin and layout the 3D UI cog
    if (uiCogMesh) {
        try {
            // Rotate into the screen around its local Y axis (inward spin) - slower
            uiCogMesh.rotation.y += 0.01;
            layoutUICog();
        } catch (_) {}
    }

    //

    
    
    // Update panel blur rect from DOM position
    const infoEl = document.getElementById('part-info');
    if (ENABLE_PANEL_BLUR && panelBlurPass && infoEl) {
        const rect = infoEl.getBoundingClientRect();
        const x0 = rect.left / window.innerWidth;
        const y0 = 1.0 - (rect.bottom / window.innerHeight); // flip to GL UV
        const x1 = rect.right / window.innerWidth;
        const y1 = 1.0 - (rect.top / window.innerHeight);
        panelBlurPass.uniforms.rectUV.value.set(x0, y0, x1, y1);
        panelBlurPass.uniforms.resolution.value.set(window.innerWidth, window.innerHeight);
    }

    // Update corner indicator blink (30 blinks per second = 60 Hz)
    if (cornerIndicators.length > 0) {
        const blinkSpeed = 60; // 60 Hz = 30 on/off cycles per second (double speed)
        const opacity = Math.sin(grainTime * blinkSpeed) > 0 ? 1.0 : 0.0;
        cornerIndicators.forEach(indicator => {
            if (indicator.material) {
                indicator.material.opacity = opacity;
                indicator.material.transparent = true;
            }
        });
    }

    // Update 2D labels to follow corner anchors and show world XYZ
    if (cornerLabels.length > 0) {
        const width = window.innerWidth;
        const height = window.innerHeight;
        const world = new THREE.Vector3();
        const ndc = new THREE.Vector3();
        cornerLabels.forEach(({ anchor, el }) => {
            if (!anchor || !el) return;
            anchor.getWorldPosition(world);
            ndc.copy(world).project(camera);
            const x = (ndc.x * 0.5 + 0.5) * width;
            let y = ( -ndc.y * 0.5 + 0.5) * height;
            // Nudge label upward to sit above the cross
            y -= 20; // pixels
            el.style.left = `${x}px`;
            el.style.top = `${y}px`;
            el.textContent = `X ${world.x.toFixed(2)}  Y ${world.y.toFixed(2)}  Z ${world.z.toFixed(2)}`;
        });
    }

    // Update tooltip blink (same speed as corner indicators)
    const tooltipStatus = document.getElementById('tooltip-status');
    const tooltipIcon = document.getElementById('tooltip-icon');
    if (tooltipStatus && tooltipStatus.classList.contains('blinking')) {
        const blinkSpeed = 60; // Same speed as corner indicators
        const opacity = Math.sin(grainTime * blinkSpeed) > 0 ? 1.0 : 0.0;
        tooltipStatus.style.opacity = opacity;
    }
    if (tooltipIcon && tooltipIcon.classList.contains('blinking')) {
        const blinkSpeed = 60; // Same speed as corner indicators
        const opacity = Math.sin(grainTime * blinkSpeed) > 0 ? 1.0 : 0.0;
        tooltipIcon.style.opacity = opacity;
    }
    // UI icons hover hard-blink (use current icon color, just toggle opacity)
    if (uiHoverBlinkTargets.length > 0) {
        const blinkSpeed = 60;
        const opacity = Math.sin(grainTime * blinkSpeed) > 0 ? 1.0 : 0.0;
        for (let i = 0; i < uiHoverBlinkTargets.length; i++) {
            const el = uiHoverBlinkTargets[i];
            if (el.classList.contains('ui-hover-blink')) {
                el.style.opacity = opacity;
            }
        }
    }
    // Drive loading text blink at the same speed as red tooltip label
    // loading text blink handled via CSS keyframes for consistent timing
    
    // Spin planetary orbit parents
    if (orbitParents.length > 0) {
        orbitParents.forEach(({ parent, spinSpeed }) => {
            parent.rotation.y += spinSpeed * 0.01; // subtle per-frame spin
        });
    }

    // Keep scattered crosses at a steady subtle opacity (no blinking)
    if (scatteredCrosses.length > 0) {
        scatteredCrosses.forEach(c => {
            if (c.material) {
                c.material.opacity = 0.55;
                c.material.transparent = true;
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
    
    // Tooltip typewriter animation
    if (tooltipTypewriterActive && tooltipTypewriterIndex < tooltipTargetText.length) {
        tooltipTypewriterIndex += tooltipTypewriterSpeed;
        if (tooltipTypewriterIndex >= tooltipTargetText.length) {
            tooltipTypewriterIndex = tooltipTargetText.length;
        }
        tooltipCurrentText = tooltipTargetText.substring(0, Math.floor(tooltipTypewriterIndex));
        const tooltipPartNameEl = document.getElementById('tooltip-part-name');
        if (tooltipPartNameEl) {
            tooltipPartNameEl.textContent = tooltipCurrentText;
        }
    }
    
    
    
    // Update controls
    controls.update();
    
    // Auto-rotate the car model slowly (toggleable)
    if (porscheModel && autoRotateEnabled) {
        porscheModel.rotation.y += 0.005;
        
        // No fade effects - instant on/off handled in onMouseMove
        
        // Bounding box now inherits transformation as child of hoveredMesh
        // 2D screen outline removed completely
        
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

// Initialize music player
initializeMusicPlayer();

// Reset any stuck hover states (fix for glowing wheels)
function resetHoverStates() {
    if (hoveredMesh && hoveredMesh.userData.originalMaterial) {
        // Restore original material
        if (hoveredMesh.material) {
            hoveredMesh.material.dispose();
        }
        const originalMat = hoveredMesh.userData.originalMaterial.clone();
        hoveredMesh.material = originalMat;
        hoveredMesh.userData.originalMaterial = null;
    }
    hoveredMesh = null;
    hoverFadeProgress = 0;
    
    // Reset warningMesh (the glowing wheel) to original state
    if (warningMesh && warningMesh.material && warningOriginalEmissive !== undefined) {
        warningMesh.material.emissive = warningOriginalEmissive.clone();
        warningMesh.material.emissiveIntensity = warningOriginalEmissiveIntensity;
        warningMesh.material.needsUpdate = true;
    }
    
    // Reset particles to default orange
    const particles = scene.getObjectByName('ambientDust');
    if (particles && particles.userData) {
        particles.userData.currentColor = 0xffd700;
        particles.material.color.setHex(0xffd700);
    }
    
    console.log('Hover states reset');
}

// Reset hover states on page load
setTimeout(resetHoverStates, 1000);

// Initialize fullscreen functionality
    initializeFullscreen();
    initializeInfoToggle();
    initializeUICog();
    initializeRotateToggle();
    initializeUIHoverBlink();

    // Fade out loading overlay after brief intro
    (function fadeOutLoading() {
        const overlay = document.getElementById('loading-overlay');
        const text = document.getElementById('loading-text');
        if (!overlay) return;
        const minShowMs = 1200; // ensure at least this long
        const start = performance.now();
        const tick = () => {
            const elapsed = performance.now() - start;
            if (assetsReady && elapsed >= minShowMs) {
                // Fade in UI elements just before scene fade
                document.querySelectorAll('.ui-fade').forEach(el => el.classList.add('visible'));
                if (text) text.style.display = 'none';
                setTimeout(() => {
                    overlay.classList.add('hidden');
                    setTimeout(() => { try { overlay.remove(); } catch(_){} }, 1900);
                }, 200);
            } else {
                requestAnimationFrame(tick);
            }
        };
        requestAnimationFrame(tick);
    })();

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

    if (ENABLE_PANEL_BLUR && panelBlurPass) {
        panelBlurPass.uniforms.resolution.value.set(window.innerWidth, window.innerHeight);
    }
});

