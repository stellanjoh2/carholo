// Gamepad input handler for 3D car configurator
// Maps gamepad controls to orbit, zoom, part selection, and UI navigation

const DEADZONE = 0.15;
const SENSITIVITY = {
    orbit: 2.0,
    aim: 1.5,
    zoom: 0.5
};

let gamepadConnected = false;
let gamepadIndex = -1;
let animationFrameId = null;
let lastButtonStates = new Set();

// Gamepad button mappings (Xbox/PS controller layout)
const BUTTONS = {
    A: 0,        // Select part
    B: 1,        // Close/Back
    X: 2,
    Y: 3,
    LB: 4,       // L1 - Previous part
    RB: 5,       // R1 - Next part
    LT: 6,       // Left Trigger - Zoom out
    RT: 7,       // Right Trigger - Zoom in
    BACK: 8,     // Close overlay
    START: 9,    // Toggle wiki
    LS: 10,      // Left Stick press
    RS: 11       // Right Stick press
};

// Axes mappings
const AXES = {
    LS_X: 0,    // Left Stick X - Aim/cursor X
    LS_Y: 1,    // Left Stick Y - Aim/cursor Y (inverted)
    RS_X: 2,    // Right Stick X - Orbit horizontal
    RS_Y: 3,    // Right Stick Y - Orbit vertical (inverted)
    LT: 4,      // Left Trigger
    RT: 5       // Right Trigger
};

/**
 * Get active gamepad or null
 */
function getGamepad() {
    const gamepads = navigator.getGamepads();
    if (gamepadIndex >= 0 && gamepadIndex < gamepads.length && gamepads[gamepadIndex]) {
        return gamepads[gamepadIndex];
    }
    // Try to find first connected gamepad
    for (let i = 0; i < gamepads.length; i++) {
        if (gamepads[i]) {
            gamepadIndex = i;
            return gamepads[i];
        }
    }
    return null;
}

/**
 * Apply deadzone to stick input
 */
function applyDeadzone(value) {
    if (Math.abs(value) < DEADZONE) return 0;
    // Normalize after deadzone
    const sign = value >= 0 ? 1 : -1;
    const absValue = Math.abs(value);
    return sign * ((absValue - DEADZONE) / (1 - DEADZONE));
}

/**
 * Check if button was just pressed (not held)
 */
function isButtonPressed(gamepad, buttonIndex) {
    const isPressed = gamepad.buttons[buttonIndex]?.pressed || false;
    const key = `${gamepadIndex}-${buttonIndex}`;
    const wasPressed = lastButtonStates.has(key);
    
    if (isPressed && !wasPressed) {
        lastButtonStates.add(key);
        return true;
    }
    if (!isPressed && wasPressed) {
        lastButtonStates.delete(key);
    }
    return false;
}

/**
 * Get OrbitControls from Three.js scene (if available)
 */
function getOrbitControls() {
    // Try window globals first
    if (window.orbitControls) return window.orbitControls;
    
    // Try to find through canvas/Three.js scene
    const canvas = document.querySelector('canvas');
    if (!canvas) return null;
    
    // Check if Three.js scene is attached to canvas
    if (canvas.__threejs && canvas.__threejs.controls) {
        return canvas.__threejs.controls;
    }
    
    // Try accessing through Three.js renderer
    if (window.renderer && window.renderer.domElement) {
        const renderer = window.renderer;
        if (renderer.__controls) return renderer.__controls;
    }
    
    return null;
}

/**
 * Handle orbit controls (Right Stick)
 */
function handleOrbit(gamepad) {
    const rsX = applyDeadzone(gamepad.axes[AXES.RS_X]);
    const rsY = applyDeadzone(gamepad.axes[AXES.RS_Y]);
    
    if (Math.abs(rsX) < 0.01 && Math.abs(rsY) < 0.01) return;
    
    const controls = getOrbitControls();
    if (!controls) {
        // Fallback: simulate mouse drag for orbit
        const canvas = document.querySelector('canvas');
        if (canvas) {
            const centerX = canvas.width / 2;
            const centerY = canvas.height / 2;
            
            // Simulate mouse drag
            const moveEvent = new MouseEvent('mousemove', {
                clientX: centerX + rsX * 50,
                clientY: centerY + rsY * 50,
                buttons: 1, // Left button pressed
                bubbles: true
            });
            canvas.dispatchEvent(moveEvent);
        }
        return;
    }
    
    // Orbit horizontally (azimuth)
    if (Math.abs(rsX) > 0.01) {
        controls.rotateLeft(rsX * SENSITIVITY.orbit * 0.02);
    }
    
    // Orbit vertically (polar)
    if (Math.abs(rsY) > 0.01) {
        controls.rotateUp(rsY * SENSITIVITY.orbit * 0.02);
    }
    
    controls.update();
}

/**
 * Handle zoom (Triggers)
 */
function handleZoom(gamepad) {
    // Note: Some gamepads use axes[4] and axes[5] for triggers, others use buttons
    let lt = gamepad.buttons[AXES.LT]?.value || 0;
    let rt = gamepad.buttons[AXES.RT]?.value || 0;
    
    // Some gamepads report triggers as axes (0 to 1 range, but axes are -1 to 1)
    if (gamepad.axes && gamepad.axes.length > 4) {
        // Axes 4/5 are often triggers (normalized to -1 to 1, but we want 0 to 1)
        const ltAxis = gamepad.axes[AXES.LT];
        const rtAxis = gamepad.axes[AXES.RT];
        if (ltAxis !== undefined) lt = Math.max(0, (ltAxis + 1) / 2);
        if (rtAxis !== undefined) rt = Math.max(0, (rtAxis + 1) / 2);
    }
    
    const zoomDelta = (rt - lt) * SENSITIVITY.zoom;
    
    if (Math.abs(zoomDelta) < 0.01) return;
    
    const controls = getOrbitControls();
    if (!controls) {
        // Fallback: simulate wheel event for zoom
        const canvas = document.querySelector('canvas');
        if (canvas) {
            const wheelEvent = new WheelEvent('wheel', {
                deltaY: zoomDelta * 100,
                clientX: canvas.width / 2,
                clientY: canvas.height / 2,
                bubbles: true
            });
            canvas.dispatchEvent(wheelEvent);
        }
        return;
    }
    
    const distance = controls.getDistance ? controls.getDistance() : 5;
    const newDistance = distance - (zoomDelta * 0.5);
    
    // Clamp zoom to reasonable bounds
    const minDistance = 1.0;
    const maxDistance = 15.0;
    const clampedDistance = Math.max(minDistance, Math.min(maxDistance, newDistance));
    
    if (Math.abs(clampedDistance - distance) > 0.01) {
        if (controls.setDistance) {
            controls.setDistance(clampedDistance);
            controls.update();
        } else if (controls.dollyIn && controls.dollyOut) {
            // Alternative: use dolly methods
            const delta = clampedDistance - distance;
            if (delta > 0) {
                controls.dollyOut(delta);
            } else {
                controls.dollyIn(-delta);
            }
            controls.update();
        }
    }
}

/**
 * Handle cursor/aim (Left Stick) - simulates mouse movement for part selection
 */
function handleAim(gamepad) {
    const lsX = applyDeadzone(gamepad.axes[AXES.LS_X]);
    const lsY = applyDeadzone(gamepad.axes[AXES.LS_Y]);
    
    if (Math.abs(lsX) < 0.01 && Math.abs(lsY) < 0.01) return;
    
    // Simulate mouse movement for raycaster
    if (window.simulateMouseMove) {
        const deltaX = lsX * SENSITIVITY.aim * 2;
        const deltaY = -lsY * SENSITIVITY.aim * 2; // Invert Y
        
        window.simulateMouseMove(deltaX, deltaY);
    } else {
        // Fallback: move cursor directly
        const cursor = document.getElementById('cursor-cross');
        if (cursor) {
            const deltaX = lsX * SENSITIVITY.aim * 2;
            const deltaY = -lsY * SENSITIVITY.aim * 2; // Invert Y
            
            const currentX = parseFloat(cursor.style.left) || window.innerWidth / 2;
            const currentY = parseFloat(cursor.style.top) || window.innerHeight / 2;
            
            const newX = Math.max(0, Math.min(window.innerWidth, currentX + deltaX));
            const newY = Math.max(0, Math.min(window.innerHeight, currentY + deltaY));
            
            cursor.style.left = `${newX}px`;
            cursor.style.top = `${newY}px`;
            
            // Dispatch mouse move event for raycaster
            const event = new MouseEvent('mousemove', {
                clientX: newX,
                clientY: newY,
                bubbles: true
            });
            document.dispatchEvent(event);
        }
    }
}

/**
 * Handle button presses
 */
function handleButtons(gamepad) {
    // A button - Select part
    if (isButtonPressed(gamepad, BUTTONS.A)) {
        if (window.simulateMouseClick) {
            window.simulateMouseClick();
        } else {
            // Fallback: trigger click on canvas
            const canvas = document.querySelector('canvas');
            if (canvas) {
                const cursor = document.getElementById('cursor-cross');
                if (cursor) {
                    const x = parseFloat(cursor.style.left) || window.innerWidth / 2;
                    const y = parseFloat(cursor.style.top) || window.innerHeight / 2;
                    
                    const event = new MouseEvent('click', {
                        clientX: x,
                        clientY: y,
                        bubbles: true
                    });
                    canvas.dispatchEvent(event);
                }
            }
        }
    }
    
    // B or BACK button - Close lightbox/wiki
    if (isButtonPressed(gamepad, BUTTONS.B) || isButtonPressed(gamepad, BUTTONS.BACK)) {
        // Priority: lightbox > wiki > part menu
        const lightbox = document.getElementById('wiki-image-lightbox');
        if (lightbox && lightbox.classList.contains('visible')) {
            if (window.closeLightbox) {
                window.closeLightbox();
            } else {
                const closeBtn = document.getElementById('wiki-lightbox-close');
                if (closeBtn) closeBtn.click();
            }
        } else {
            const wikiOverlay = document.getElementById('porsche-history-overlay');
            if (wikiOverlay && wikiOverlay.classList.contains('visible')) {
                const closeBtn = document.getElementById('porsche-history-close');
                if (closeBtn) closeBtn.click();
            } else {
                const partMenu = document.getElementById('part-menu-overlay');
                if (partMenu && partMenu.classList.contains('visible')) {
                    const closeBtn = document.getElementById('part-menu-close');
                    if (closeBtn) closeBtn.click();
                }
            }
        }
    }
    
    // START button - Toggle wiki
    if (isButtonPressed(gamepad, BUTTONS.START)) {
        const wikiOverlay = document.getElementById('porsche-history-overlay');
        if (wikiOverlay && wikiOverlay.classList.contains('visible')) {
            const closeBtn = document.getElementById('porsche-history-close');
            if (closeBtn) closeBtn.click();
        } else {
            const bookBtn = document.getElementById('book-button');
            if (bookBtn) bookBtn.click();
        }
    }
    
    // L1 (LB) - Previous part
    if (isButtonPressed(gamepad, BUTTONS.LB)) {
        if (window.cyclePartPrevious) {
            window.cyclePartPrevious();
        }
    }
    
    // R1 (RB) - Next part
    if (isButtonPressed(gamepad, BUTTONS.RB)) {
        if (window.cyclePartNext) {
            window.cyclePartNext();
        }
    }
}

/**
 * Main gamepad update loop
 */
function updateGamepad() {
    const gamepad = getGamepad();
    
    if (!gamepad) {
        gamepadConnected = false;
        if (animationFrameId) {
            cancelAnimationFrame(animationFrameId);
            animationFrameId = null;
        }
        return;
    }
    
    // Update controls
    handleOrbit(gamepad);
    handleZoom(gamepad);
    handleAim(gamepad);
    handleButtons(gamepad);
    
    // Continue polling
    animationFrameId = requestAnimationFrame(updateGamepad);
}

/**
 * Initialize gamepad support
 */
export function initGamepad() {
    // Check if Gamepad API is supported
    if (!navigator.getGamepads) {
        console.warn('Gamepad API not supported in this browser');
        return;
    }
    
    // Listen for gamepad connection
    window.addEventListener('gamepadconnected', (e) => {
        console.log('[Gamepad] Connected:', e.gamepad.id, 'Index:', e.gamepad.index);
        gamepadIndex = e.gamepad.index;
        gamepadConnected = true;
        
        if (!animationFrameId) {
            animationFrameId = requestAnimationFrame(updateGamepad);
        }
    });
    
    // Listen for gamepad disconnection
    window.addEventListener('gamepaddisconnected', (e) => {
        console.log('[Gamepad] Disconnected:', e.gamepad.id);
        if (e.gamepad.index === gamepadIndex) {
            gamepadIndex = -1;
            gamepadConnected = false;
            lastButtonStates.clear();
            
            if (animationFrameId) {
                cancelAnimationFrame(animationFrameId);
                animationFrameId = null;
            }
        }
    });
    
    // Check for already connected gamepads
    const gamepads = navigator.getGamepads();
    for (let i = 0; i < gamepads.length; i++) {
        if (gamepads[i]) {
            console.log('[Gamepad] Already connected:', gamepads[i].id, 'Index:', i);
            gamepadIndex = i;
            gamepadConnected = true;
            animationFrameId = requestAnimationFrame(updateGamepad);
            break;
        }
    }
    
    // Start polling loop even if no gamepad is connected yet
    // This ensures we detect gamepads that connect later
    if (!animationFrameId) {
        animationFrameId = requestAnimationFrame(updateGamepad);
    }
    
    console.log('[Gamepad] Support initialized. Waiting for gamepad...');
    console.log('[Gamepad] Press any button to connect (if supported by browser)');
}

