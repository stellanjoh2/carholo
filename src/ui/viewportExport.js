// Viewport still export — adapted from Orby's CaptureSizePolicy + forceExportCaptureFramebuffer.
// 1×/2× = multiples of the current preview backing store (what you see), not a different crop.

const JPEG_QUALITY = 0.92;

function getDrawingBufferPixels(renderer) {
    const gl = renderer?.getContext?.();
    if (gl && gl.drawingBufferWidth > 0 && gl.drawingBufferHeight > 0) {
        return { width: gl.drawingBufferWidth, height: gl.drawingBufferHeight };
    }
    // Fallback without THREE.Vector2 — canvas backing store.
    const canvas = renderer?.domElement;
    return {
        width: Math.max(1, canvas?.width || 1),
        height: Math.max(1, canvas?.height || 1),
    };
}

function getMaxCapturePixelDimension(renderer) {
    const gl = renderer?.getContext?.();
    if (!gl) return 8192;
    const maxTex = gl.getParameter(gl.MAX_TEXTURE_SIZE) || 8192;
    const maxRb = gl.getParameter(gl.MAX_RENDERBUFFER_SIZE) || maxTex;
    return Math.max(1, Math.min(maxTex, maxRb, 16384));
}

function clampCapturePixelSize(width, height, renderer) {
    const cap = getMaxCapturePixelDimension(renderer);
    let w = Math.max(1, Math.round(width));
    let h = Math.max(1, Math.round(height));
    if (w > cap || h > cap) {
        const fit = Math.min(cap / w, cap / h);
        w = Math.max(1, Math.floor(w * fit));
        h = Math.max(1, Math.floor(h * fit));
    }
    return { width: w, height: h };
}

/**
 * PNG/JPG 1×/2× — multiples of preview backing store (logical × preview DPR).
 * Same framing as the live viewport; 2× is just higher pixel density.
 * Equivalent to Orby resolvePngExportCaptureSize: dbPixels × scale.
 */
export function resolveViewportExportSize(renderer, scale = 1) {
    const db = getDrawingBufferPixels(renderer);
    const s = Math.max(0.25, Number(scale) || 1);
    return clampCapturePixelSize(db.width * s, db.height * s, renderer);
}

export function snapshotViewport(art) {
    const { renderer, fxaa } = art;
    return {
        pixelRatio: renderer.getPixelRatio(),
        fxaaRes: fxaa?.material?.uniforms?.resolution?.value
            ? {
                x: fxaa.material.uniforms.resolution.value.x,
                y: fxaa.material.uniforms.resolution.value.y,
            }
            : null,
        clearAlpha: renderer.getClearAlpha?.(),
    };
}

export function forceExportFramebuffer(art, pixelWidth, pixelHeight) {
    const { renderer, composer, fxaa, fisheye } = art;
    const camera = window.camera;
    const w = Math.max(1, Math.round(pixelWidth));
    const h = Math.max(1, Math.round(pixelHeight));

    // Orby: DPR 1 + exact backing-store pixels so 1×/2× match preview framing.
    renderer.setPixelRatio(1);
    if (typeof renderer.setDrawingBufferSize === 'function') {
        renderer.setDrawingBufferSize(w, h, 1);
    } else {
        renderer.setSize(w, h, false);
    }

    if (composer) {
        composer.setPixelRatio?.(1);
        composer.setSize(w, h);
        composer.renderTarget1?.setSize(w, h);
        composer.renderTarget2?.setSize(w, h);
    }

    if (camera) {
        camera.aspect = w / Math.max(1e-6, h);
        camera.updateProjectionMatrix();
    }
    if (fisheye?.uniforms?.aspectRatio) {
        fisheye.uniforms.aspectRatio.value = w / Math.max(1e-6, h);
    }
    if (fxaa?.material?.uniforms?.resolution?.value) {
        fxaa.material.uniforms.resolution.value.set(1 / w, 1 / h);
    }

    renderer.setRenderTarget(null);
    renderer.setViewport(0, 0, w, h);
    renderer.setScissorTest(false);

    return getDrawingBufferPixels(renderer);
}

export function restoreViewport(art, snap) {
    const { renderer, composer, fxaa, fisheye } = art;
    const camera = window.camera;
    const w = window.innerWidth;
    const h = window.innerHeight;
    const pr = snap.pixelRatio || 1;
    const aspect = w / Math.max(1, h);

    // Mirror main.js resize handler so the live viewport returns exactly.
    renderer.setPixelRatio(pr);
    renderer.setSize(w, h);
    composer?.setPixelRatio?.(pr);
    composer?.setSize(w, h);

    if (camera) {
        camera.aspect = aspect;
        camera.updateProjectionMatrix();
    }
    if (fisheye?.uniforms?.aspectRatio) {
        fisheye.uniforms.aspectRatio.value = aspect;
    }
    if (fxaa?.material?.uniforms?.resolution?.value) {
        fxaa.material.uniforms.resolution.value.set(1 / w, 1 / h);
    }

    renderer.setRenderTarget(null);
}

function encodeCanvasToBlob(canvas, format) {
    const mime = format === 'jpeg' ? 'image/jpeg' : 'image/png';
    return new Promise((resolve, reject) => {
        const onBlob = (blob) => {
            if (blob) resolve(blob);
            else reject(new Error(`${mime} encode failed`));
        };
        if (format === 'jpeg') canvas.toBlob(onBlob, mime, JPEG_QUALITY);
        else canvas.toBlob(onBlob, mime);
    });
}

export function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/**
 * Capture the post-processed viewport as PNG or JPEG at 1× or 2× preview density.
 * @param {object} art — window.__artDir
 * @param {{ format?: 'png'|'jpeg', scale?: 1|2, filename?: string }} opts
 * @returns {Promise<{ width: number, height: number, blob: Blob }>}
 */
export async function captureViewportExport(art, opts = {}) {
    const format = opts.format === 'jpeg' ? 'jpeg' : 'png';
    const scale = opts.scale === 2 ? 2 : 1;
    const { renderer, composer } = art;
    if (!renderer) throw new Error('Renderer not ready');

    const requested = resolveViewportExportSize(renderer, scale);
    const snap = snapshotViewport(art);

    // Opaque capture — no transparency
    if (typeof renderer.getClearAlpha === 'function') {
        renderer.setClearAlpha(1);
    }

    let actual;
    try {
        actual = forceExportFramebuffer(art, requested.width, requested.height);

        if (composer) composer.render();
        else renderer.render(art.scene, window.camera);

        const gl = renderer.getContext();
        if (gl && typeof gl.finish === 'function') gl.finish();

        const canvas = renderer.domElement;
        const blob = await encodeCanvasToBlob(canvas, format);
        const ext = format === 'jpeg' ? 'jpg' : 'png';
        const filename = opts.filename || `cardemo-${scale}x.${ext}`;
        downloadBlob(blob, filename);
        return { width: actual.width, height: actual.height, blob };
    } finally {
        restoreViewport(art, snap);
        if (typeof snap.clearAlpha === 'number' && typeof renderer.setClearAlpha === 'function') {
            renderer.setClearAlpha(snap.clearAlpha);
        }
    }
}
