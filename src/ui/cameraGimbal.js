// Camera gimbal — Orby-style auto-orbit around controls.target (off / slow / fast).

import * as THREE from 'three';

/** Orby CameraController.updateAutoOrbit speed multipliers */
export const GIMBAL_SPEEDS = {
    slow: 0.15,
    fast: 0.4,
};

const HORIZONTAL_SPEED = 1.0;
const VERTICAL_SPEED = 0.6;
const DISTANCE_SPEED = 0.4;
const PHI_RANGE = 0.4;
const RADIUS_VARIATION = 0.15;

export function normalizeGimbalMode(mode) {
    return mode === 'slow' || mode === 'fast' ? mode : 'off';
}

export function isGimbalActive(art) {
    return normalizeGimbalMode(art?.gimbalMode) !== 'off';
}

/** Live rAF rate assumed by car autoRotate / wheel spin (per-frame, not wall-clock). */
export const GIMBAL_LIVE_HZ = 60;

function captureGimbalBase() {
    const camera = window.camera;
    const controls = window.controls;
    if (!camera || !controls) return null;
    const offset = camera.position.clone().sub(controls.target);
    const spherical = new THREE.Spherical().setFromVector3(offset);
    return {
        radius: spherical.radius,
        phi: spherical.phi,
        theta: spherical.theta,
        // Freeze look-at so hover / OrbitControls pointer noise can't nudge the pivot.
        target: controls.target.clone(),
    };
}

function lockOrbitControls(art) {
    const controls = window.controls;
    if (!controls || art._gimbalControlsSnap) return;
    art._gimbalControlsSnap = {
        enabled: controls.enabled,
        enablePan: controls.enablePan,
        enableRotate: controls.enableRotate,
        enableZoom: controls.enableZoom,
        enableDamping: controls.enableDamping,
    };
    // Fully disable so pointer hover never feeds OrbitControls while we drive the pose.
    controls.enabled = false;
    controls.enablePan = false;
    controls.enableRotate = false;
    controls.enableZoom = false;
    controls.enableDamping = false;
}

function unlockOrbitControls(art) {
    const controls = window.controls;
    const snap = art._gimbalControlsSnap;
    if (!controls || !snap) return;
    controls.enabled = snap.enabled !== false;
    controls.enablePan = snap.enablePan;
    controls.enableRotate = snap.enableRotate;
    controls.enableZoom = snap.enableZoom;
    controls.enableDamping = snap.enableDamping;
    art._gimbalControlsSnap = null;
}

/**
 * @param {object} art
 * @param {'off'|'slow'|'fast'} mode
 */
export function setGimbalMode(art, mode) {
    const next = normalizeGimbalMode(mode);
    const prev = normalizeGimbalMode(art.gimbalMode);
    art.gimbalMode = next;

    if (next !== 'off') {
        if (prev === 'off' || !art._gimbalBase) {
            art._gimbalBase = captureGimbalBase();
            art._gimbalTime = 0;
        }
        lockOrbitControls(art);
    } else {
        unlockOrbitControls(art);
        art._gimbalBase = null;
        art._gimbalTime = 0;
    }
}

/** Apply current gimbal spherical pose (Orby multi-axis orbit). */
export function applyGimbalPose(art) {
    const base = art._gimbalBase;
    if (!isGimbalActive(art) || !base) return false;
    const camera = window.camera;
    const controls = window.controls;
    if (!camera || !controls) return false;

    const t = art._gimbalTime || 0;
    const theta = base.theta + t * HORIZONTAL_SPEED;
    const phi = THREE.MathUtils.clamp(
        base.phi + Math.sin(t * VERTICAL_SPEED) * PHI_RANGE,
        0.3,
        Math.PI - 0.5,
    );
    const radius = base.radius * (1 + Math.sin(t * DISTANCE_SPEED) * RADIUS_VARIATION);

    const target = base.target || controls.target;
    const offset = new THREE.Vector3().setFromSphericalCoords(radius, phi, theta);
    camera.position.copy(target).add(offset);
    controls.target.copy(target);
    camera.lookAt(target);
    return true;
}

/**
 * Advance gimbal by delta seconds and apply pose.
 * Live path should pass 1/60 (fixed) so hitchy hover frames stay in sync with
 * per-frame car autoRotate — wall-clock delta made the car look like it stalled/reversed.
 * @returns {boolean} true if pose was applied
 */
export function advanceGimbal(art, deltaSec) {
    if (!isGimbalActive(art)) return false;
    if (!art._gimbalBase) {
        art._gimbalBase = captureGimbalBase();
        art._gimbalTime = 0;
        lockOrbitControls(art);
    }
    const speed = GIMBAL_SPEEDS[normalizeGimbalMode(art.gimbalMode)] || 0;
    art._gimbalTime = (art._gimbalTime || 0) + Math.max(0, deltaSec) * speed;
    return applyGimbalPose(art);
}

/** One live-frame step (matches car autoRotate / wheel spin cadence). */
export function advanceGimbalFrame(art) {
    return advanceGimbal(art, 1 / GIMBAL_LIVE_HZ);
}

/** Re-apply dutch tilt after lookAt (same as live controls.update hook). */
export function applyCameraTilt(art) {
    const tilt = art?.cameraTilt || 0;
    if (tilt && window.camera) {
        window.camera.rotateZ((tilt * Math.PI) / 180);
    }
}
