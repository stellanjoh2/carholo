// Offline 5s clip: fixed-timestep PNG frames → ProRes 4444 MOV.
// Encoder path mirrors Ultrapilled (mediabunny + prores-wasm-encoder, ap4h).

import {
    downloadBlob,
    forceExportFramebuffer,
    resolveViewportExportSize,
    restoreViewport,
    snapshotViewport,
} from './viewportExport.js';
import {
    GIMBAL_SPEEDS,
    applyCameraTilt,
    applyGimbalPose,
    isGimbalActive,
    normalizeGimbalMode,
    setGimbalMode,
} from './cameraGimbal.js';

export const CLIP_DURATION_SEC = 5;
export const CLIP_FPS = 30;

const LIVE_HZ = 60; // autoRotateSpeed / wheel speeds are tuned for ~60fps rAF

let proresEncoderReady = null;

function ensureProResEncoder() {
    proresEncoderReady ??= import('prores-wasm-encoder/mediabunny').then(({ registerProResEncoder }) => {
        // Single-thread: blob workers work, but 0 is the reliable static-site path.
        registerProResEncoder({ workers: 0 });
    });
    return proresEncoderReady;
}

function evenSize(width, height) {
    return {
        width: Math.max(2, Math.round(width) & ~1),
        height: Math.max(2, Math.round(height) & ~1),
    };
}

function getCar(art) {
    if (typeof art?.getCar === 'function') return art.getCar();
    return art?.car || null;
}

function yieldToUi() {
    return new Promise((resolve) => {
        requestAnimationFrame(() => setTimeout(resolve, 0));
    });
}

function advanceWheels(steps) {
    const mode = window.__wheelSpinMode | 0;
    const pivots = window.__wheelSpinPivots;
    if (!mode || !pivots?.length || steps <= 0) return;
    // Match main.js wheelSpinSpeeds
    const speeds = [0, 0.08, 0.22];
    const speed = speeds[mode] || 0;
    if (!speed) return;
    for (let s = 0; s < steps; s++) {
        for (let i = 0; i < pivots.length; i++) {
            const p = pivots[i];
            const axis = p.userData?.spinAxis;
            if (axis) p.rotateOnAxis(axis, speed * (p.userData.spinSign || 1));
        }
    }
}

/**
 * Offline-render a 5s clip from the current camera + car pose (no rotation reset),
 * then bake ProRes 4444 (ap4h) MOV — same stack as Ultrapilled.
 *
 * @param {object} art — window.__artDir
 * @param {{ scale?: 1|2, fps?: number, durationSec?: number, filename?: string, onProgress?: (msg: string) => void, shouldStop?: () => boolean }} [opts]
 */
export async function renderClipToProRes(art, opts = {}) {
    const { renderer, composer, grain } = art || {};
    if (!renderer) throw new Error('Renderer not ready');

    const fps = Math.max(1, Math.round(opts.fps || CLIP_FPS));
    const durationSec = opts.durationSec || CLIP_DURATION_SEC;
    const frameCount = Math.round(durationSec * fps);
    const scale = opts.scale === 2 ? 2 : 1;
    const onProgress = opts.onProgress || (() => {});
    const shouldStop = opts.shouldStop || (() => false);

    const resolved = resolveViewportExportSize(renderer, scale);
    const size = evenSize(resolved.width, resolved.height);

    const car = getCar(art);
    // Capture start pose — never reset rotation or camera.
    const startRotY = car ? car.rotation.y : 0;
    const wasAutoRotate = !!window.autoRotateEnabled;
    const autoSpeed = Number(window.autoRotateSpeed) || 0;
    // Convert per-rAF delta (~60Hz) into radians per offline frame.
    const rotPerFrame = wasAutoRotate ? autoSpeed * (LIVE_HZ / fps) : 0;
    const wheelStepsPerFrame = Math.max(1, Math.round(LIVE_HZ / fps));
    const gimbalOn = isGimbalActive(art);
    if (gimbalOn && !art._gimbalBase) {
        // Ensure base spherical exists without resetting speed/time.
        setGimbalMode(art, normalizeGimbalMode(art.gimbalMode));
    }
    const gimbalTime0 = art._gimbalTime || 0;
    const gimbalSpeed = gimbalOn
        ? (GIMBAL_SPEEDS[normalizeGimbalMode(art.gimbalMode)] || 0)
        : 0;

    const snap = snapshotViewport(art);
    const controls = window.controls;
    const controlsEnabled = controls ? controls.enabled : true;

    await ensureProResEncoder();
    const {
        Output,
        MovOutputFormat,
        BufferTarget,
        CanvasSource,
        Quality,
        canEncodeVideo,
    } = await import('mediabunny');

    const videoQuality = new Quality('high');
    const fullCodecString = 'ap4h'; // ProRes 4444 — Ultrapilled transparent/edit master path
    const proresOk = await canEncodeVideo('prores', {
        width: size.width,
        height: size.height,
        quality: videoQuality,
        fullCodecString,
    });
    if (!proresOk) {
        throw new Error('ProRes 4444 encoding is not available in this browser');
    }

    const encodeCanvas = document.createElement('canvas');
    encodeCanvas.width = size.width;
    encodeCanvas.height = size.height;
    const encodeCtx = encodeCanvas.getContext('2d', { alpha: true, willReadFrequently: true });
    if (!encodeCtx) throw new Error('Could not create encode canvas');

    const output = new Output({
        format: new MovOutputFormat(),
        target: new BufferTarget(),
    });
    const video = new CanvasSource(encodeCanvas, {
        codec: 'prores',
        quality: videoQuality,
        keyFrameInterval: 1 / fps,
        fullCodecString,
    });
    output.addVideoTrack(video, { frameRate: fps });
    await output.start();

    const frameDuration = 1 / fps;
    let frames = 0;

    window.__offlineCapture = true;
    if (controls) controls.enabled = false;
    // Freeze live auto-rotate; we advance rotation ourselves from the start pose.
    window.autoRotateEnabled = false;

    if (typeof renderer.getClearAlpha === 'function') {
        renderer.setClearAlpha(1);
    }

    try {
        forceExportFramebuffer(art, size.width, size.height);

        for (let i = 0; i < frameCount; i++) {
            if (shouldStop()) throw new Error('Export cancelled');

            if (car) {
                car.rotation.y = startRotY + i * rotPerFrame;
            }
            advanceWheels(wheelStepsPerFrame);

            // Gimbal (Orby auto-orbit) — frame 0 = current pose, then orbit (like wheel spin).
            if (gimbalOn) {
                art._gimbalTime = gimbalTime0 + i * frameDuration * gimbalSpeed;
                applyGimbalPose(art);
                applyCameraTilt(art);
            }

            if (grain?.uniforms?.time) {
                grain.uniforms.time.value = i / fps;
            }

            if (composer) composer.render();
            else renderer.render(art.scene, window.camera);

            const gl = renderer.getContext();
            if (gl && typeof gl.finish === 'function') gl.finish();

            encodeCtx.clearRect(0, 0, size.width, size.height);
            encodeCtx.drawImage(renderer.domElement, 0, 0, size.width, size.height);

            await video.add(i * frameDuration, frameDuration);
            frames++;

            if (i % 4 === 0 || i === frameCount - 1) {
                onProgress(`Rendering ${i + 1}/${frameCount}`);
                await yieldToUi();
            }
        }

        onProgress('Packaging ProRes…');
        await yieldToUi();
        await output.finalize();

        const buffer = output.target.buffer;
        if (!buffer) throw new Error('Export failed');

        const filename = opts.filename || `cardemo-${durationSec}s-pr4444.mov`;
        downloadBlob(new Blob([buffer], { type: 'video/quicktime' }), filename);

        return { frames, width: size.width, height: size.height, fps, durationSec };
    } catch (err) {
        await output.cancel().catch(() => undefined);
        throw err;
    } finally {
        window.__offlineCapture = false;
        if (controls) controls.enabled = controlsEnabled;
        window.autoRotateEnabled = wasAutoRotate;
        // Leave car at clip-end pose when rotation was advancing; otherwise keep start.
        if (car && !wasAutoRotate) car.rotation.y = startRotY;
        restoreViewport(art, snap);
        if (typeof snap.clearAlpha === 'number' && typeof renderer.setClearAlpha === 'function') {
            renderer.setClearAlpha(snap.clearAlpha);
        }
    }
}
