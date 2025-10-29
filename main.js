import * as THREE from 'three';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

// Debug: Check if Three.js loaded correctly
console.log('Three.js version:', THREE.REVISION);
console.log('Three.js loaded successfully');

// Scene setup
console.log('Creating scene...');
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1a1a1a);
console.log('Scene created with background color:', scene.background);

// Custom height-based ground fog will be added as post-processing effect

const camera = new THREE.PerspectiveCamera(
    50,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
);
camera.position.set(0, 5, 10);

console.log('Creating renderer...');
const renderer = new THREE.WebGLRenderer({ 
    antialias: true,
    preserveDrawingBuffer: true  // Disable CORS restrictions
});
console.log('Renderer created:', renderer);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.3; // Much lower to see reflections
renderer.outputColorSpace = THREE.SRGBColorSpace;
console.log('Renderer configured, canvas:', renderer.domElement);

// Append canvas to container
console.log('Looking for canvas container...');
const container = document.getElementById('canvas-container');
console.log('Container found:', container);
if (container) {
    container.appendChild(renderer.domElement);
    console.log('Canvas appended to container');
} else {
    document.body.appendChild(renderer.domElement);
    console.log('Canvas appended to body (fallback)');
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

// Simple ground fog using standard Three.js fog (more reliable)
scene.fog = new THREE.FogExp2(0xff6600, 0.06); // Orange fog with 25% reduced density

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
}
// screenOutline removed completely
let enableScreenOutline = false; // feature toggle
let warningMesh = null;
let warningOriginalEmissive = null;
let warningOriginalEmissiveIntensity = 0;


// Text decoding animation
let currentText = '';
let targetText = '';
let textDecodeIndex = 0;
let textDecodeSpeed = 3; // characters per frame

// Planetary orbits (dashed ring dashes) around car
const orbitsGroup = new THREE.Group();
let orbitParents = [];
scene.add(orbitsGroup);

function createPlanetaryOrbitsAround(object) {
    // Compute a comfortable radius based on model size
    const modelBox = new THREE.Box3().setFromObject(object);
    const modelSize = modelBox.getSize(new THREE.Vector3());
    const modelRadius = Math.max(modelSize.x, modelSize.y, modelSize.z) * 0.65;

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

    // Build 3 differently tilted orbits (all kept inside main sphere)
    makeOrbit(modelRadius * 1.08, 0xffa500, new THREE.Euler(0.45, 0.0, 0.12), 64, 0.12);
    makeOrbit(modelRadius * 1.20, 0xffd700, new THREE.Euler(0.1, 0.6, -0.2), 96, -0.08);
    makeOrbit(modelRadius * 1.30, 0xff8844, new THREE.Euler(-0.35, -0.15, 0.4), 128, 0.06);
}

// Tooltip typewriter animation
let tooltipTypewriterActive = false;
let tooltipCurrentText = '';
let tooltipTargetText = '';
let tooltipTypewriterIndex = 0;
let tooltipTypewriterSpeed = 1.5; // characters per frame (slower)

// Sound effects - preload audio
const hoverSound = new Audio('261590__kwahmah_02__little-glitch.flac');
hoverSound.volume = 0.3;

// Ambient music
const ambientMusic = new Audio('calm-cyberpunk-ambient.mp3');
ambientMusic.volume = 0.4;
ambientMusic.loop = true;
ambientMusic.preload = 'auto';
ambientMusic.crossOrigin = 'anonymous';

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
    
    // Set initial play icon (yellow)
    musicIcon.innerHTML = '<i data-feather="play"></i>';
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
            
            // Change to play icon (yellow)
            musicIcon.innerHTML = '<i data-feather="play"></i>';
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
    // Update tooltip position
    const tooltip = document.getElementById('tooltip');
    if (tooltip) {
        tooltip.style.left = `${event.clientX}px`;
        tooltip.style.top = `${event.clientY}px`;
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
        const crossEl = document.getElementById('cursor-cross');
        if (crossEl) {
            // Cursor color is now managed by status-based classes
            // No need to add 'hovering' class here
        }
        
        if (intersects.length > 0) {
            const currentHovered = intersects[0].object;
            
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
                cornerIndicators = [];

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
                        
                        // Start typewriter effect for part name
                        tooltipTargetText = capitalizeFirstLetter(currentHovered.name || 'Unknown Part');
                        tooltipCurrentText = '';
                        tooltipTypewriterIndex = 0;
                        tooltipTypewriterActive = true;
                        
                        // Apply color class to tooltip part name based on status
                        tooltipPartName.classList.remove('warning', 'good');
                        if (randomStatus.includes('Maintenance') || randomStatus.includes('Warning')) {
                            tooltipPartName.classList.add('warning');
                        } else if (randomStatus.includes('Operational') || randomStatus.includes('Excellent') || 
                                   randomStatus.includes('Good Condition') || randomStatus.includes('Optimal')) {
                            tooltipPartName.classList.add('good');
                        }
                        
                        // Set status text and add appropriate class
                        tooltipStatus.textContent = randomStatus;
                        tooltipStatus.classList.remove('warning', 'good', 'blinking'); // Clear previous classes
                        
                        // Add blinking class for hard blink effect
                        tooltipStatus.classList.add('blinking');
                        
                        // Set icon based on status
                        const iconName = getStatusIcon(randomStatus);
                        tooltipIcon.innerHTML = `<i data-feather="${iconName}"></i>`;
                        tooltipIcon.classList.remove('warning', 'good', 'blinking'); // Clear previous classes
                        
                        // Add appropriate color class to icon
                        if (randomStatus.includes('Maintenance') || randomStatus.includes('Warning')) {
                            tooltipIcon.classList.add('warning');
                        } else if (randomStatus.includes('Operational') || randomStatus.includes('Excellent') || 
                                   randomStatus.includes('Good Condition') || randomStatus.includes('Optimal')) {
                            tooltipIcon.classList.add('good');
                        }
                        
                        // Add blinking class to icon
                        tooltipIcon.classList.add('blinking');
                        
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
                    
                    // Show container
                    if (partContainerEl) {
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
                                emissive: bboxColor,
                                emissiveIntensity: 7.5,
                                linewidth: 3 // Increased line width
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
                                color: bboxColor, // Match bounding box color
                                emissive: bboxColor,
                                emissiveIntensity: 7.5,
                                transparent: true,
                                opacity: 1.0,
                                linewidth: 3 // Increased line width
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
                        });

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
            if (tooltipStatus) {
                tooltipStatus.classList.remove('blinking');
            }
            if (tooltipIcon) {
                tooltipIcon.classList.remove('blinking', 'warning', 'good');
                tooltipIcon.innerHTML = ''; // Clear icon
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
        cornerIndicators = [];

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
            'door': 'Door Panel',
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
                
                // Find matching part name (try both original and cleaned name)
                for (const [key, englishName] of Object.entries(partNameMap)) {
                    if (originalName.includes(key) || cleanName.includes(key)) {
                        child.name = englishName;
                        console.log(`Renamed: "${child.name}" -> "${englishName}"`);
                        renamed = true;
                        break;
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
        scene.add(sphereWireframe);
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

        // Add planetary orbit dashes around the car (inside main sphere)
        createPlanetaryOrbitsAround(object);

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

    // Floor light color synced to hovered object health (static, no blinking)
    // DISABLED - was causing wheels to glow constantly
    // if (warningMesh && warningMesh.material) {
    //     // Determine light color based on hovered object health
    //     let lightColor = 0xff6600; // Default orange (no red glow when not hovering)
    //     let lightIntensity = 7.5;
    //     
    //     if (hoveredMesh) {
    //         // Get the health status for the currently hovered mesh
    //         const partId = hoveredMesh.uuid;
    //         const hash = partId.split('').reduce((a, b) => {
    //             a = ((a << 5) - a) + b.charCodeAt(0);
    //             return a & a;
    //         }, 0);
    //         const statusCategory = Math.abs(hash) % 3;
    //         
    //         if (statusCategory === 0) {
    //             // Good status - green light
    //             lightColor = 0x44ff44;
    //             lightIntensity = 5.0; // Slightly dimmer for good status
    //         } else if (statusCategory === 1) {
    //             // Warning status - red light
    //             lightColor = 0xff4444;
    //             lightIntensity = 7.5;
    //         } else {
    //             // Neutral status - yellow light
    //             lightColor = 0xffd700;
    //             lightIntensity = 6.0;
    //         }
    //     }
    //     
    //     warningMesh.material.emissive.setHex(lightColor);
    //     warningMesh.material.emissiveIntensity = lightIntensity;
    //     warningMesh.material.needsUpdate = true;
    // }
    
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
    
    // Spin planetary orbit parents
    if (orbitParents.length > 0) {
        orbitParents.forEach(({ parent, spinSpeed }) => {
            parent.rotation.y += spinSpeed * 0.01; // subtle per-frame spin
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
    
    // Flicker effect disabled - keeping text stable
    // const partContainerEl = document.getElementById('part-container');
    // if (partContainerEl && partContainerEl.classList.contains('visible')) {
    //     const flickerOpacity = 0.75 + Math.random() * 0.25; // Between 0.75 and 1.0
    //     partContainerEl.style.opacity = flickerOpacity;
    // }
    
    // Update controls
    controls.update();
    
    // Auto-rotate the car model slowly
    if (porscheModel) {
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

