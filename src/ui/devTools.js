// In-game art direction / post-processing toolkit.
// Toggle with H. Esc closes when open.

import { captureViewportExport, resolveViewportExportSize } from './viewportExport.js';
import { CLIP_DURATION_SEC, CLIP_FPS, renderClipToProRes } from './clipExport.js';
import {
    advanceGimbalFrame,
    applyCameraTilt,
    isGimbalActive,
    normalizeGimbalMode,
    setGimbalMode,
} from './cameraGimbal.js';

const GOLD = '#ffd700';
const HUD_DEFAULT = '#d1faff';
const PANEL_BG = 'rgba(8, 8, 10, 0.92)';

function hexFromThreeColor(color) {
    if (!color) return '#ffffff';
    return '#' + color.getHexString();
}

function waitForArtDir(timeoutMs = 20000) {
    return new Promise((resolve, reject) => {
        const start = performance.now();
        const tick = () => {
            if (window.__artDir?.bloom) return resolve(window.__artDir);
            if (performance.now() - start > timeoutMs) return reject(new Error('__artDir not ready'));
            requestAnimationFrame(tick);
        };
        tick();
    });
}

function injectStyles() {
    if (document.getElementById('art-dir-styles')) return;
    const style = document.createElement('style');
    style.id = 'art-dir-styles';
    style.textContent = `
#art-dir-panel {
  position: fixed;
  top: 72px;
  right: 18px;
  width: min(340px, calc(100vw - 36px));
  max-height: calc(100vh - 96px);
  overflow: auto;
  z-index: 10050;
  background: ${PANEL_BG};
  border: 1px solid ${GOLD};
  color: ${GOLD};
  font-family: 'Geist Pixel', monospace;
  font-size: 12px;
  padding: 14px 16px 18px;
  display: none;
  backdrop-filter: blur(8px);
  box-shadow: 0 12px 40px rgba(0,0,0,0.45);
  pointer-events: auto;
  cursor: default;
}
#art-dir-panel.visible { display: block; }
#art-dir-panel * { cursor: default; box-sizing: border-box; }
#art-dir-panel h2 {
  margin: 0 0 4px;
  font-size: 13px;
  font-weight: 500;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}
#art-dir-panel .art-dir-hint {
  opacity: 0.55;
  font-size: 10px;
  margin-bottom: 12px;
}
#art-dir-panel .art-dir-section {
  margin-top: 14px;
  padding-top: 10px;
  border-top: 1px solid rgba(255, 215, 0, 0.25);
}
#art-dir-panel .art-dir-section:first-of-type {
  border-top: none;
  margin-top: 0;
  padding-top: 0;
}
#art-dir-panel .art-dir-section-title {
  font-size: 10px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  opacity: 0.7;
  margin-bottom: 8px;
}
#art-dir-panel .art-dir-row {
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}
#art-dir-panel .art-dir-row label {
  opacity: 0.9;
  font-size: 11px;
}
#art-dir-panel .art-dir-row .art-dir-value {
  min-width: 42px;
  text-align: right;
  opacity: 0.65;
  font-variant-numeric: tabular-nums;
}
#art-dir-panel input[type="range"] {
  width: 100%;
  grid-column: 1 / -1;
  accent-color: ${GOLD};
  cursor: pointer;
  margin: 0;
}
#art-dir-panel input[type="color"] {
  width: 36px;
  height: 22px;
  padding: 0;
  border: 1px solid ${GOLD};
  background: transparent;
  cursor: pointer;
}
#art-dir-panel select {
  width: 100%;
  grid-column: 1 / -1;
  background: rgba(0,0,0,0.45);
  border: 1px solid ${GOLD};
  color: ${GOLD};
  font-family: inherit;
  font-size: 11px;
  padding: 6px 8px;
  cursor: pointer;
}
#art-dir-panel .art-dir-color-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 8px;
}
#art-dir-panel .art-dir-actions {
  margin-top: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
#art-dir-panel button.art-dir-btn {
  width: 100%;
  background: rgba(255, 215, 0, 0.1);
  border: 1px solid ${GOLD};
  color: ${GOLD};
  font-family: inherit;
  font-size: 11px;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  padding: 8px 10px;
  cursor: pointer;
}
#art-dir-panel button.art-dir-btn:hover {
  background: ${GOLD};
  color: #000;
}
#art-dir-panel .art-dir-tabs {
  display: flex;
  gap: 4px;
  margin-bottom: 12px;
}
#art-dir-panel .art-dir-tab {
  flex: 1;
  background: transparent;
  border: 1px solid rgba(255, 215, 0, 0.35);
  color: ${GOLD};
  font-family: inherit;
  font-size: 10px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  padding: 7px 6px;
  cursor: pointer;
  opacity: 0.65;
}
#art-dir-panel .art-dir-tab:hover { opacity: 0.9; }
#art-dir-panel .art-dir-tab.active {
  background: rgba(255, 215, 0, 0.15);
  border-color: ${GOLD};
  opacity: 1;
}
#art-dir-panel .art-dir-tab-panel { display: none; }
#art-dir-panel .art-dir-tab-panel.active { display: block; }
`;
    document.head.appendChild(style);
}

function hexToRgb(hex) {
    const h = String(hex || '').replace('#', '').trim();
    if (h.length !== 6) return { r: 255, g: 215, b: 0 };
    return {
        r: parseInt(h.slice(0, 2), 16),
        g: parseInt(h.slice(2, 4), 16),
        b: parseInt(h.slice(4, 6), 16),
    };
}

function setCssRgb(prefix, hex) {
    const { r, g, b } = hexToRgb(hex);
    const root = document.documentElement.style;
    root.setProperty(`--${prefix}`, hex);
    root.setProperty(`--${prefix}-r`, String(r));
    root.setProperty(`--${prefix}-g`, String(g));
    root.setProperty(`--${prefix}-b`, String(b));
}

function ensureHudColorStyles() {
    if (document.getElementById('hud-color-styles')) return;
    const style = document.createElement('style');
    style.id = 'hud-color-styles';
    style.textContent = `
:root {
  --hud-color: ${HUD_DEFAULT};
  --hud-r: 209; --hud-g: 250; --hud-b: 255;
  --status-medium: #ffd700;
  --status-medium-r: 255; --status-medium-g: 215; --status-medium-b: 0;
  --status-warning: #ff4444;
  --status-warning-r: 255; --status-warning-g: 68; --status-warning-b: 68;
  --text-bloom: 0;
}
#status-indicator,
.ui-fade #music-icon,
#music-player,
#part-container,
#part-menu-title,
#part-menu-close,
#porsche-history-close,
#fullscreen-button,
#info-button,
#book-button,
#rotate-button,
#music-player,
#enter-button,
#porsche-history-content,
#porsche-history-title,
.porsche-history-done-button,
.porsche-history-buy-button,
.wiki-lightbox-close,
.wiki-lightbox-nav {
  color: var(--hud-color) !important;
  border-color: var(--hud-color) !important;
}
/* Default / hover cursor chrome tracks HUD; status classes stay semantic */
#cursor-cross::before,
#cursor-cross::after,
#cursor-cross.hovering::before,
#cursor-cross.hovering::after {
  background: var(--hud-color) !important;
}
#cursor-cross.neutral::before,
#cursor-cross.neutral::after {
  background: var(--status-medium) !important;
}
#cursor-cross.warning::before,
#cursor-cross.warning::after {
  background: var(--status-warning) !important;
}
#cursor-cross.good::before,
#cursor-cross.good::after {
  background: var(--hud-color) !important;
}
#fullscreen-icon svg,
#info-icon svg,
#book-icon svg,
#rotate-icon svg,
#music-icon svg {
  stroke: var(--hud-color) !important;
}
#music-player:hover #music-icon svg,
#fullscreen-button:hover #fullscreen-icon svg,
#rotate-button:hover #rotate-icon svg,
#info-button:hover #info-icon svg,
#book-button:hover #book-icon svg {
  stroke: var(--hud-color) !important;
}
#part-menu-container,
#part-menu-overlay #part-menu-container,
.part-menu-option:not(.warning-option),
#out-of-funds-container,
#porsche-history-container {
  border-color: var(--hud-color) !important;
  box-shadow: 0 0 40px rgba(var(--hud-r), var(--hud-g), var(--hud-b), 0.3) !important;
}
.part-menu-option:not(.warning-option) .part-menu-option-title,
.part-menu-option:not(.warning-option) .part-menu-option-desc,
#part-menu-title,
#porsche-history-title,
.porsche-history-stock-chart-title {
  color: var(--hud-color) !important;
  text-shadow:
    0 0 calc(10px * var(--text-bloom)) rgba(var(--hud-r), var(--hud-g), var(--hud-b), 0.5),
    0 0 calc(20px * var(--text-bloom)) rgba(var(--hud-r), var(--hud-g), var(--hud-b), 0.3),
    0 0 calc(30px * var(--text-bloom)) rgba(var(--hud-r), var(--hud-g), var(--hud-b), 0.2) !important;
}
/* Status tiers (headline + stats panel + tooltip):
   - OK / good / all-clear → HUD colour (tracks UI colour setting)
   - Warning (semi-damaged: Needs Inspection, Minor Wear) → status-medium (yellow)
   - Critical (Requires Maintenance, etc.) → status-warning (red) */
#part-name:not(.warning):not(.good),
#part-name:not(.warning):not(.good) ~ #part-info,
#tooltip-content,
#tooltip-part-name:not(.warning):not(.good),
#tooltip-status:not(.warning):not(.good) {
  color: var(--status-medium) !important;
  text-shadow:
    0 0 calc(10px * var(--text-bloom)) rgba(var(--status-medium-r), var(--status-medium-g), var(--status-medium-b), 0.5),
    0 0 calc(20px * var(--text-bloom)) rgba(var(--status-medium-r), var(--status-medium-g), var(--status-medium-b), 0.3),
    0 0 calc(30px * var(--text-bloom)) rgba(var(--status-medium-r), var(--status-medium-g), var(--status-medium-b), 0.2) !important;
}
#part-name.warning,
#tooltip-part-name.warning,
#tooltip-status.warning,
#part-name.warning ~ #part-info {
  color: var(--status-warning) !important;
  text-shadow:
    0 0 calc(10px * var(--text-bloom)) rgba(var(--status-warning-r), var(--status-warning-g), var(--status-warning-b), 0.55),
    0 0 calc(20px * var(--text-bloom)) rgba(var(--status-warning-r), var(--status-warning-g), var(--status-warning-b), 0.35),
    0 0 calc(30px * var(--text-bloom)) rgba(var(--status-warning-r), var(--status-warning-g), var(--status-warning-b), 0.22) !important;
}
#part-name.good,
#tooltip-part-name.good,
#tooltip-status.good,
#part-name.good ~ #part-info {
  color: var(--hud-color) !important;
  text-shadow:
    0 0 calc(10px * var(--text-bloom)) rgba(var(--hud-r), var(--hud-g), var(--hud-b), 0.55),
    0 0 calc(20px * var(--text-bloom)) rgba(var(--hud-r), var(--hud-g), var(--hud-b), 0.35),
    0 0 calc(30px * var(--text-bloom)) rgba(var(--hud-r), var(--hud-g), var(--hud-b), 0.22) !important;
}
#tooltip-content {
  text-shadow: none !important;
}
#tooltip-icon.warning svg { stroke: var(--status-warning) !important; }
#tooltip-icon.good svg { stroke: var(--hud-color) !important; }
#tooltip-icon:not(.warning):not(.good) svg { stroke: var(--status-medium) !important; }
.part-menu-option:not(.warning-option),
#enter-button,
.porsche-history-done-button,
.porsche-history-buy-button,
#part-menu-close,
#porsche-history-close {
  background: color-mix(in srgb, var(--hud-color) 10%, transparent) !important;
  border-color: var(--hud-color) !important;
  color: var(--hud-color) !important;
}
.part-menu-option:not(.warning-option):hover,
#part-menu-close:hover,
#porsche-history-close:hover,
.porsche-history-done-button:hover,
.porsche-history-buy-button:hover,
#enter-button:hover {
  background: var(--hud-color) !important;
  color: #000 !important;
  border-color: var(--hud-color) !important;
}
.part-menu-option:not(.warning-option):hover .part-menu-option-title,
.part-menu-option:not(.warning-option):hover .part-menu-option-desc {
  color: #000 !important;
  text-shadow: none !important;
}
.part-menu-option.warning-option {
  background: color-mix(in srgb, var(--status-warning) 10%, transparent) !important;
  border-color: var(--status-warning) !important;
  color: var(--status-warning) !important;
}
.part-menu-option.warning-option .part-menu-option-title,
.part-menu-option.warning-option .part-menu-option-desc {
  color: var(--status-warning) !important;
}
.part-menu-option.warning-option:hover {
  background: var(--status-warning) !important;
  color: #000 !important;
  border-color: var(--status-warning) !important;
}
#porsche-history-scrollbar-thumb,
.porsche-history-image-placeholder-block,
.porsche-history-fullwidth-image-placeholder-block {
  background: var(--hud-color) !important;
}
#porsche-history-content p strong {
  color: var(--hud-color) !important;
}
#art-dir-panel {
  border-color: var(--hud-color) !important;
  color: var(--hud-color) !important;
}
#art-dir-panel input[type="range"] { accent-color: var(--hud-color) !important; }
#art-dir-panel input[type="color"],
#art-dir-panel select,
#art-dir-panel button.art-dir-btn {
  border-color: var(--hud-color) !important;
  color: var(--hud-color) !important;
}
#art-dir-panel button.art-dir-btn:hover {
  background: var(--hud-color) !important;
  color: #000 !important;
}
#art-dir-panel .art-dir-tab {
  border-color: color-mix(in srgb, var(--hud-color) 35%, transparent) !important;
  color: var(--hud-color) !important;
}
#art-dir-panel .art-dir-tab.active {
  background: color-mix(in srgb, var(--hud-color) 15%, transparent) !important;
  border-color: var(--hud-color) !important;
}
/* Freeze blinking UI at full opacity for screenshots */
html.ui-blink-always-on #tooltip-status.blinking,
html.ui-blink-always-on #tooltip-icon.blinking,
html.ui-blink-always-on .ui-hover-blink {
  opacity: 1 !important;
}
`;
    document.head.appendChild(style);
}

function setHudColor(hex) {
    ensureHudColorStyles();
    const { r, g, b } = hexToRgb(hex);
    document.documentElement.style.setProperty('--hud-color', hex);
    document.documentElement.style.setProperty('--hud-r', String(r));
    document.documentElement.style.setProperty('--hud-g', String(g));
    document.documentElement.style.setProperty('--hud-b', String(b));
    // Status OK always tracks HUD colour
    if (window.__artDir?.statusColors) window.__artDir.statusColors.ok = hex;
}

function setStatusColor(kind, hex) {
    ensureHudColorStyles();
    if (window.__artDir?.statusColors) window.__artDir.statusColors[kind] = hex;
    setCssRgb(`status-${kind}`, hex);
}

function setTextBloom(amount) {
    ensureHudColorStyles();
    document.documentElement.style.setProperty('--text-bloom', String(amount));
}

function sampleMeshMaterial(art) {
    const found = { color: '#888888', metalness: 0.65, roughness: 0.5 };
    const root = art.scene;
    if (!root) return found;
    let done = false;
    root.traverse((child) => {
        if (done || !child.isMesh || !child.material || child.userData?.isHelper) return;
        const mats = [].concat(child.material);
        for (const m of mats) {
            if (!m || !(m.isMeshStandardMaterial || m.isMeshPhysicalMaterial) || m.wireframe) continue;
            const n = ((m.name || child.name || '') + '').toLowerCase();
            if (n.includes('glass') || n.includes('window') || n.includes('podium')) continue;
            found.color = hexFromThreeColor(m.color);
            found.metalness = m.metalness;
            found.roughness = m.roughness;
            done = true;
            return;
        }
    });
    return found;
}

function el(tag, attrs = {}, children = []) {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
        if (k === 'className') node.className = v;
        else if (k === 'text') node.textContent = v;
        else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2).toLowerCase(), v);
        else node.setAttribute(k, v);
    }
    for (const child of [].concat(children)) {
        if (child == null) continue;
        node.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
    }
    return node;
}

function addSlider(section, { label, min, max, step, get, set, format }) {
    const valueNode = el('span', { className: 'art-dir-value' });
    const range = el('input', {
        type: 'range',
        min: String(min),
        max: String(max),
        step: String(step),
    });
    const sync = () => {
        const v = get();
        range.value = String(v);
        valueNode.textContent = format ? format(v) : Number(v).toFixed(3);
    };
    range.addEventListener('input', () => {
        const v = Number(range.value);
        set(v);
        valueNode.textContent = format ? format(v) : v.toFixed(3);
    });
    section.appendChild(
        el('div', { className: 'art-dir-row' }, [
            el('label', { text: label }),
            valueNode,
            range,
        ])
    );
    sync();
    return sync;
}

function addColor(section, { label, get, set }) {
    const input = el('input', { type: 'color' });
    const sync = () => {
        input.value = get();
    };
    input.addEventListener('input', () => set(input.value));
    section.appendChild(
        el('div', { className: 'art-dir-color-row' }, [
            el('label', { text: label }),
            input,
        ])
    );
    sync();
    return sync;
}

function addSelect(section, { label, options, get, set }) {
    const select = el('select');
    for (const opt of options) {
        select.appendChild(el('option', { value: opt.value, text: opt.label }));
    }
    const sync = () => {
        select.value = get();
    };
    select.addEventListener('change', () => set(select.value));
    section.appendChild(
        el('div', { className: 'art-dir-row' }, [
            el('label', { text: label }),
            el('span', { className: 'art-dir-value', text: '' }),
            select,
        ])
    );
    sync();
    sync.select = select;
    return sync;
}

function formatExportRes(size) {
    if (!size) return '—';
    return `${size.width}×${size.height}`;
}

function exportScaleOptionLabels(renderer) {
    if (!renderer) {
        return { 1: '1×', 2: '2×' };
    }
    try {
        return {
            1: formatExportRes(resolveViewportExportSize(renderer, 1)),
            2: formatExportRes(resolveViewportExportSize(renderer, 2)),
        };
    } catch {
        return { 1: '1×', 2: '2×' };
    }
}

function applyExportScaleLabels(select, renderer) {
    if (!select) return;
    const labels = exportScaleOptionLabels(renderer);
    for (const opt of select.options) {
        const key = Number(opt.value);
        if (labels[key]) opt.textContent = labels[key];
    }
}

function shadowQualityFromSize(size) {
    if (size >= 4096) return 'ultra';
    if (size >= 3072) return 'high';
    if (size >= 2048) return 'medium';
    return 'low';
}

function section(parent, title) {
    const wrap = el('div', { className: 'art-dir-section' }, [
        el('div', { className: 'art-dir-section-title', text: title }),
    ]);
    parent.appendChild(wrap);
    return wrap;
}

function setUiBlinkMode(mode) {
    document.documentElement.classList.toggle('ui-blink-always-on', mode === 'always');
}

function getCamera() {
    return window.camera || null;
}

function getCameraFov() {
    const cam = getCamera();
    return cam ? cam.fov : 50;
}

function setCameraFov(fov) {
    const cam = getCamera();
    if (!cam) return;
    cam.fov = fov;
    cam.updateProjectionMatrix();
}

function installCameraTiltHook(art) {
    const tryHook = () => {
        const controls = window.controls;
        if (!controls) {
            requestAnimationFrame(tryHook);
            return;
        }
        if (controls.__artDirTiltHooked) return;
        controls.__artDirTiltHooked = true;
        const origUpdate = controls.update.bind(controls);
        controls.update = function (...args) {
            let result;
            // Orby: while gimbal/auto-orbit is on, drive pose ourselves (skip OrbitControls).
            // Fixed 1/60 step — same cadence as car autoRotate, so hover frame hitches
            // don't make the car look like it stalled or reversed relative to the camera.
            if (isGimbalActive(art)) {
                advanceGimbalFrame(art);
            } else {
                result = origUpdate(...args);
            }
            applyCameraTilt(art);
            return result;
        };
    };
    tryHook();
}

function snapshotDefaults(art) {
    const L = art.lights;
    const mapSize = L.key?.shadow?.mapSize?.width || 512;
    return {
        bloom: {
            strength: art.bloom.strength,
            radius: art.bloom.radius,
            threshold: art.bloom.threshold,
        },
        rgb: art.rgbSplit.uniforms.amount.value,
        vignette: {
            offset: art.vignette.uniforms.offset.value,
            darkness: art.vignette.uniforms.darkness.value,
        },
        grain: art.grain.uniforms.amount.value,
        fisheye: art.fisheye.uniforms.strength.value,
        hue: art.hueSat.uniforms.hue.value,
        saturation: art.hueSat.uniforms.saturation.value,
        fog: {
            color: hexFromThreeColor(art.fog.color),
            density: art.fog.density,
        },
        lights: {
            key: { color: hexFromThreeColor(L.key.color), intensity: L.key.intensity },
            fill: { color: hexFromThreeColor(L.fill.color), intensity: L.fill.intensity },
            back: { color: hexFromThreeColor(L.back.color), intensity: L.back.intensity },
            ambient: { color: hexFromThreeColor(L.ambient.color), intensity: L.ambient.intensity },
        },
        wireframe: art._wireframeHex || (art.wireframeMaterial ? hexFromThreeColor(art.wireframeMaterial.color) : '#ff6600'),
        shadowQuality: art.shadowQuality || shadowQualityFromSize(mapSize),
        shadowMapSize: mapSize,
        aaMode: art.aaMode || 'none',
        bboxThickness: art.bboxThickness ?? 2,
        hudColor: getComputedStyle(document.documentElement).getPropertyValue('--hud-color').trim() || HUD_DEFAULT,
        textBloom: Number(getComputedStyle(document.documentElement).getPropertyValue('--text-bloom').trim() || 0),
        statusColors: {
            medium: art.statusColors?.medium || '#ffd700',
            warning: art.statusColors?.warning || '#ff4444',
        },
        mesh: sampleMeshMaterial(art),
        cameraFov: getCameraFov(),
        cameraTilt: art.cameraTilt || 0,
        uiBlink: document.documentElement.classList.contains('ui-blink-always-on') ? 'always' : 'animated',
    };
}

function buildPanel(art) {
    injectStyles();
    ensureHudColorStyles();
    if (art.cameraTilt == null) art.cameraTilt = 0;
    if (art.gimbalMode == null) art.gimbalMode = 'off';
    installCameraTiltHook(art);
    const defaults = snapshotDefaults(art);
    const syncers = [];

    const panel = el('div', { id: 'art-dir-panel' }, [
        el('h2', { text: 'Art Direction' }),
        el('div', { className: 'art-dir-hint', text: 'H panel · L rotate (Fast/Slow/Off) · Esc close' }),
    ]);

    const tabBar = el('div', { className: 'art-dir-tabs' });
    const tabBodies = {};
    const tabs = [
        { id: 'mesh', label: 'Mesh' },
        { id: 'post', label: 'Post process' },
        { id: 'camera', label: 'Camera' },
        { id: 'export', label: 'Export' },
    ];
    let activeTab = 'mesh';
    let refreshExportSizeHint = null;
    const setTab = (id) => {
        activeTab = id;
        for (const t of tabs) {
            tabBar.querySelector(`[data-tab="${t.id}"]`)?.classList.toggle('active', t.id === id);
            tabBodies[t.id]?.classList.toggle('active', t.id === id);
        }
        if (id === 'export') refreshExportSizeHint?.();
    };
    for (const t of tabs) {
        const btn = el('button', {
            className: 'art-dir-tab' + (t.id === activeTab ? ' active' : ''),
            type: 'button',
            text: t.label,
            'data-tab': t.id,
            onClick: () => setTab(t.id),
        });
        tabBar.appendChild(btn);
        tabBodies[t.id] = el('div', {
            className: 'art-dir-tab-panel' + (t.id === activeTab ? ' active' : ''),
            'data-panel': t.id,
        });
    }
    panel.appendChild(tabBar);
    for (const t of tabs) panel.appendChild(tabBodies[t.id]);

    const meshTab = tabBodies.mesh;
    const postTab = tabBodies.post;
    const cameraTab = tabBodies.camera;
    const exportTab = tabBodies.export;

    const hud = section(meshTab, 'HUD');
    syncers.push(addColor(hud, {
        label: 'HUD colour',
        get: () => {
            const inline = document.documentElement.style.getPropertyValue('--hud-color').trim();
            if (inline) return inline;
            return getComputedStyle(document.documentElement).getPropertyValue('--hud-color').trim() || defaults.hudColor;
        },
        set: (hex) => setHudColor(hex),
    }));
    syncers.push(addSlider(hud, {
        label: 'Text bloom',
        min: 0, max: 3, step: 0.05,
        get: () => Number(getComputedStyle(document.documentElement).getPropertyValue('--text-bloom').trim() || 0),
        set: (v) => setTextBloom(v),
    }));
    syncers.push(addColor(hud, {
        label: 'Warning (semi)',
        get: () => art.statusColors?.medium || defaults.statusColors.medium,
        set: (hex) => setStatusColor('medium', hex),
    }));
    syncers.push(addColor(hud, {
        label: 'Critical',
        get: () => art.statusColors?.warning || defaults.statusColors.warning,
        set: (hex) => setStatusColor('warning', hex),
    }));
    syncers.push(addSelect(hud, {
        label: 'UI blink',
        options: [
            { value: 'animated', label: 'Animated' },
            { value: 'always', label: 'Always on' },
        ],
        get: () => (document.documentElement.classList.contains('ui-blink-always-on') ? 'always' : 'animated'),
        set: (mode) => setUiBlinkMode(mode),
    }));

    // Seed CSS vars from artDir defaults (OK tracks HUD)
    setHudColor(defaults.hudColor || HUD_DEFAULT);
    setStatusColor('medium', defaults.statusColors.medium);
    setStatusColor('warning', defaults.statusColors.warning);
    setTextBloom(defaults.textBloom ?? 0);

    const mesh = section(meshTab, 'Mesh');
    const meshState = { ...defaults.mesh };
    syncers.push(addColor(mesh, {
        label: 'Colour',
        get: () => meshState.color,
        set: (hex) => {
            meshState.color = hex;
            art.applyMeshMaterial?.({ color: hex, metalness: meshState.metalness, roughness: meshState.roughness });
        },
    }));
    syncers.push(addSlider(mesh, {
        label: 'Metallic',
        min: 0, max: 1, step: 0.01,
        get: () => meshState.metalness,
        set: (v) => {
            meshState.metalness = v;
            art.applyMeshMaterial?.({ color: meshState.color, metalness: v, roughness: meshState.roughness });
        },
    }));
    syncers.push(addSlider(mesh, {
        label: 'Roughness',
        min: 0, max: 1, step: 0.01,
        get: () => meshState.roughness,
        set: (v) => {
            meshState.roughness = v;
            art.applyMeshMaterial?.({ color: meshState.color, metalness: meshState.metalness, roughness: v });
        },
    }));
    syncers.push(addSlider(mesh, {
        label: 'HDRI intensity',
        min: 0, max: 4, step: 0.05,
        get: () => (typeof art.getHdriIntensity === 'function' ? art.getHdriIntensity() : 2),
        set: (v) => {
            if (typeof art.setHdriIntensity === 'function') art.setHdriIntensity(v);
        },
    }));

    const wire = section(meshTab, 'Wireframe');
    syncers.push(addColor(wire, {
        label: 'Colour',
        get: () => art._wireframeHex || defaults.wireframe,
        set: (hex) => {
            art._wireframeHex = hex;
            if (typeof art.setWireframeColor === 'function') art.setWireframeColor(hex);
        },
    }));

    const bbox = section(meshTab, 'Bounding box');
    syncers.push(addSlider(bbox, {
        label: 'Thickness',
        min: 1, max: 3, step: 0.5,
        get: () => art.bboxThickness ?? defaults.bboxThickness ?? 2,
        set: (v) => {
            if (typeof art.setBboxThickness === 'function') art.setBboxThickness(v);
            else art.bboxThickness = v;
        },
        format: (v) => `${Number(v).toFixed(1)} px`,
    }));

    const lights = section(meshTab, 'Lights');
    syncers.push(addSelect(lights, {
        label: 'Shadow quality',
        options: [
            { value: 'low', label: 'Low (1024)' },
            { value: 'medium', label: 'Medium (2048)' },
            { value: 'high', label: 'High (3072)' },
            { value: 'ultra', label: 'Ultra (4096)' },
        ],
        get: () => art.shadowQuality || shadowQualityFromSize(art.lights.key?.shadow?.mapSize?.width || 512),
        set: (q) => {
            if (typeof art.setShadowQuality === 'function') art.setShadowQuality(q);
        },
    }));
    for (const key of ['key', 'fill', 'back', 'ambient']) {
        const light = art.lights[key];
        const label = key[0].toUpperCase() + key.slice(1);
        syncers.push(addColor(lights, {
            label: `${label} colour`,
            get: () => hexFromThreeColor(light.color),
            set: (hex) => light.color.set(hex),
        }));
        syncers.push(addSlider(lights, {
            label: `${label} intensity`,
            min: 0, max: key === 'ambient' ? 2 : 6, step: 0.05,
            get: () => light.intensity,
            set: (v) => { light.intensity = v; },
        }));
    }

    const aa = section(postTab, 'Anti-aliasing');
    syncers.push(addSelect(aa, {
        label: 'AA',
        options: [
            { value: 'none', label: 'None' },
            { value: 'fxaa', label: 'FXAA' },
        ],
        get: () => art.aaMode || 'none',
        set: (mode) => {
            if (typeof art.setAA === 'function') art.setAA(mode);
        },
    }));

    const colorGrade = section(postTab, 'Colour grade');
    syncers.push(addSlider(colorGrade, {
        label: 'Hue',
        min: -1, max: 1, step: 0.01,
        get: () => art.hueSat.uniforms.hue.value,
        set: (v) => { art.hueSat.uniforms.hue.value = v; },
    }));
    syncers.push(addSlider(colorGrade, {
        label: 'Saturation',
        min: -1, max: 1, step: 0.01,
        get: () => art.hueSat.uniforms.saturation.value,
        set: (v) => { art.hueSat.uniforms.saturation.value = v; },
    }));

    const post = section(postTab, 'Post');
    syncers.push(addSlider(post, {
        label: 'Chromatic aberration',
        min: 0, max: 0.02, step: 0.0001,
        get: () => art.rgbSplit.uniforms.amount.value,
        set: (v) => { art.rgbSplit.uniforms.amount.value = v; },
        format: (v) => v.toFixed(4),
    }));
    syncers.push(addSlider(post, {
        label: 'Bloom strength',
        min: 0, max: 2, step: 0.01,
        get: () => art.bloom.strength,
        set: (v) => { art.bloom.strength = v; },
    }));
    syncers.push(addSlider(post, {
        label: 'Bloom radius',
        min: 0, max: 2, step: 0.01,
        get: () => art.bloom.radius,
        set: (v) => { art.bloom.radius = v; },
    }));
    syncers.push(addSlider(post, {
        label: 'Bloom threshold',
        min: 0, max: 1, step: 0.01,
        get: () => art.bloom.threshold,
        set: (v) => { art.bloom.threshold = v; },
    }));
    syncers.push(addSlider(post, {
        label: 'Grain',
        min: 0, max: 0.4, step: 0.005,
        get: () => art.grain.uniforms.amount.value,
        set: (v) => { art.grain.uniforms.amount.value = v; },
    }));
    syncers.push(addSlider(post, {
        label: 'Vignette offset',
        min: 0, max: 1.5, step: 0.01,
        get: () => art.vignette.uniforms.offset.value,
        set: (v) => { art.vignette.uniforms.offset.value = v; },
    }));
    syncers.push(addSlider(post, {
        label: 'Vignette darkness',
        min: 0, max: 2, step: 0.01,
        get: () => art.vignette.uniforms.darkness.value,
        set: (v) => { art.vignette.uniforms.darkness.value = v; },
    }));

    const fog = section(postTab, 'Fog');
    syncers.push(addColor(fog, {
        label: 'Colour',
        get: () => hexFromThreeColor(art.fog.color),
        set: (hex) => {
            art.fog.color.set(hex);
            art.syncFogBackground?.();
        },
    }));
    syncers.push(addSlider(fog, {
        label: 'Density',
        min: 0, max: 0.12, step: 0.0005,
        get: () => art.fog.density,
        set: (v) => {
            art.fog.density = v;
            art.syncFogBackground?.();
        },
        format: (v) => v.toFixed(4),
    }));

    const cam = section(cameraTab, 'Lens');
    syncers.push(addSlider(cam, {
        label: 'FOV',
        min: 20, max: 100, step: 0.5,
        get: () => getCameraFov(),
        set: (v) => setCameraFov(v),
        format: (v) => v.toFixed(1),
    }));
    syncers.push(addSlider(cam, {
        label: 'Tilt',
        min: -45, max: 45, step: 0.5,
        get: () => art.cameraTilt || 0,
        set: (v) => { art.cameraTilt = v; },
        format: (v) => `${v.toFixed(1)}°`,
    }));
    syncers.push(addSlider(cam, {
        label: 'Fisheye',
        min: 0, max: 1, step: 0.005,
        get: () => art.fisheye.uniforms.strength.value,
        set: (v) => { art.fisheye.uniforms.strength.value = v; },
    }));

    const gimbal = section(cameraTab, 'Gimbal');
    syncers.push(addSelect(gimbal, {
        label: 'Orbit',
        options: [
            { value: 'off', label: 'Off' },
            { value: 'slow', label: 'Slow' },
            { value: 'fast', label: 'Fast' },
        ],
        get: () => normalizeGimbalMode(art.gimbalMode),
        set: (v) => setGimbalMode(art, v),
    }));
    gimbal.appendChild(el('div', {
        className: 'art-dir-hint',
        text: 'Auto-orbit around look target · baked into ProRes',
    }));

    // --- Export ---
    const exportState = { format: 'png', scale: 1 };
    const exp = section(exportTab, 'Still');
    const exportSizeHint = el('div', {
        className: 'art-dir-hint',
        text: 'Same framing as viewport',
    });
    const initialScaleLabels = exportScaleOptionLabels(art.renderer);
    syncers.push(addSelect(exp, {
        label: 'Format',
        options: [
            { value: 'png', label: 'PNG' },
            { value: 'jpeg', label: 'JPG' },
        ],
        get: () => exportState.format,
        set: (v) => { exportState.format = v === 'jpeg' ? 'jpeg' : 'png'; },
    }));
    const stillScaleSync = addSelect(exp, {
        label: 'Size',
        options: [
            { value: '1', label: initialScaleLabels[1] },
            { value: '2', label: initialScaleLabels[2] },
        ],
        get: () => String(exportState.scale),
        set: (v) => {
            exportState.scale = v === '2' ? 2 : 1;
            refreshExportSizeHint();
        },
    });
    syncers.push(stillScaleSync);
    exp.appendChild(exportSizeHint);

    const captureBtn = el('button', {
        className: 'art-dir-btn',
        text: 'Capture',
        type: 'button',
    });
    captureBtn.addEventListener('click', async () => {
        if (captureBtn.disabled) return;
        const prev = captureBtn.textContent;
        captureBtn.disabled = true;
        captureBtn.textContent = 'Capturing…';
        try {
            const result = await captureViewportExport(art, {
                format: exportState.format,
                scale: exportState.scale,
            });
            captureBtn.textContent = `${result.width}×${result.height}`;
            setTimeout(() => { captureBtn.textContent = prev; }, 1400);
        } catch (err) {
            console.warn('Viewport export failed', err);
            captureBtn.textContent = 'Failed';
            setTimeout(() => { captureBtn.textContent = prev; }, 1400);
        } finally {
            captureBtn.disabled = false;
            refreshExportSizeHint();
        }
    });
    exp.appendChild(el('div', { className: 'art-dir-actions' }, [captureBtn]));
    exp.appendChild(el('div', {
        className: 'art-dir-hint',
        text: '⌘E / Ctrl+E · JPG 2× (keeps hover)',
    }));

    // --- Clip (offline PNG frames → ProRes 4444 MOV) ---
    const clipState = { scale: 1, busy: false };
    const clip = section(exportTab, 'Clip');
    const clipHint = el('div', {
        className: 'art-dir-hint',
        text: `${CLIP_DURATION_SEC}s · ${CLIP_FPS}fps · ProRes 4444 · starts at current camera`,
    });
    const clipScaleSync = addSelect(clip, {
        label: 'Size',
        options: [
            { value: '1', label: initialScaleLabels[1] },
            { value: '2', label: initialScaleLabels[2] },
        ],
        get: () => String(clipState.scale),
        set: (v) => { clipState.scale = v === '2' ? 2 : 1; },
    });
    syncers.push(clipScaleSync);
    clip.appendChild(clipHint);

    refreshExportSizeHint = () => {
        applyExportScaleLabels(stillScaleSync.select, art.renderer);
        applyExportScaleLabels(clipScaleSync.select, art.renderer);
        stillScaleSync();
        clipScaleSync();
    };
    refreshExportSizeHint();
    window.addEventListener('resize', refreshExportSizeHint);
    const clipBtn = el('button', {
        className: 'art-dir-btn',
        text: 'Render ProRes',
        type: 'button',
    });
    clipBtn.addEventListener('click', async () => {
        if (clipBtn.disabled || clipState.busy) return;
        clipState.busy = true;
        clipBtn.disabled = true;
        const prev = clipBtn.textContent;
        clipBtn.textContent = 'Starting…';
        try {
            const result = await renderClipToProRes(art, {
                scale: clipState.scale,
                onProgress: (msg) => { clipBtn.textContent = msg; },
            });
            clipBtn.textContent = `${result.frames}f · ${result.width}×${result.height}`;
            setTimeout(() => { clipBtn.textContent = prev; }, 1800);
        } catch (err) {
            console.warn('Clip export failed', err);
            clipBtn.textContent = 'Failed';
            setTimeout(() => { clipBtn.textContent = prev; }, 1800);
        } finally {
            clipState.busy = false;
            clipBtn.disabled = false;
        }
    });
    clip.appendChild(el('div', { className: 'art-dir-actions' }, [clipBtn]));
    clip.appendChild(el('div', {
        className: 'art-dir-hint',
        text: 'Offline frame bake · car rotation not reset',
    }));

    const copyBtn = el('button', {
        className: 'art-dir-btn',
        text: 'Copy settings',
        type: 'button',
    });
    copyBtn.addEventListener('click', async () => {
        const snap = snapshotDefaults(art);
        snap.mesh = { ...meshState };
        snap.hdriIntensity = typeof art.getHdriIntensity === 'function' ? art.getHdriIntensity() : undefined;
        snap.cameraFov = getCameraFov();
        snap.cameraTilt = art.cameraTilt || 0;
        snap.uiBlink = document.documentElement.classList.contains('ui-blink-always-on') ? 'always' : 'animated';
        const text = JSON.stringify(snap, null, 2);
        try {
            await navigator.clipboard.writeText(text);
            const prev = copyBtn.textContent;
            copyBtn.textContent = 'Copied';
            setTimeout(() => { copyBtn.textContent = prev; }, 1200);
        } catch (err) {
            console.warn('Clipboard write failed', err);
            window.prompt('Copy settings:', text);
        }
    });

    const resetBtn = el('button', {
        className: 'art-dir-btn',
        text: 'Reset defaults',
        type: 'button',
    });
    resetBtn.addEventListener('click', () => {
        const d = defaults;
        art.bloom.strength = d.bloom.strength;
        art.bloom.radius = d.bloom.radius;
        art.bloom.threshold = d.bloom.threshold;
        art.rgbSplit.uniforms.amount.value = d.rgb;
        art.vignette.uniforms.offset.value = d.vignette.offset;
        art.vignette.uniforms.darkness.value = d.vignette.darkness;
        art.grain.uniforms.amount.value = d.grain;
        art.fisheye.uniforms.strength.value = d.fisheye;
        art.hueSat.uniforms.hue.value = d.hue;
        art.hueSat.uniforms.saturation.value = d.saturation;
        art.fog.color.set(d.fog.color);
        art.fog.density = d.fog.density;
        art.syncFogBackground?.();
        for (const key of ['key', 'fill', 'back', 'ambient']) {
            art.lights[key].color.set(d.lights[key].color);
            art.lights[key].intensity = d.lights[key].intensity;
        }
        art._wireframeHex = d.wireframe;
        if (typeof art.setWireframeColor === 'function') art.setWireframeColor(d.wireframe);
        // Restore original shadow map size (may be below Orby Low)
        if (art.lights?.key?.shadow) {
            const size = d.shadowMapSize || 512;
            art.lights.key.shadow.mapSize.set(size, size);
            if (art.lights.key.shadow.map) {
                art.lights.key.shadow.map.dispose();
                art.lights.key.shadow.map = null;
            }
            art.shadowQuality = d.shadowQuality;
        }
        if (typeof art.setAA === 'function') art.setAA(d.aaMode);
        if (typeof art.setBboxThickness === 'function') art.setBboxThickness(d.bboxThickness ?? 2);
        else art.bboxThickness = d.bboxThickness ?? 2;
        setHudColor(d.hudColor || HUD_DEFAULT);
        setTextBloom(d.textBloom ?? 0);
        setStatusColor('medium', d.statusColors.medium);
        setStatusColor('warning', d.statusColors.warning);
        setUiBlinkMode(d.uiBlink || 'animated');
        setCameraFov(d.cameraFov ?? 50);
        art.cameraTilt = d.cameraTilt || 0;
        meshState.color = d.mesh.color;
        meshState.metalness = d.mesh.metalness;
        meshState.roughness = d.mesh.roughness;
        art.applyMeshMaterial?.({ ...d.mesh });
        syncers.forEach((fn) => fn());
    });

    panel.appendChild(el('div', { className: 'art-dir-actions' }, [copyBtn, resetBtn]));

    // Don't let world pick / orbit handlers see panel interaction
    for (const type of ['click', 'mousedown', 'mouseup', 'pointerdown', 'pointerup', 'wheel']) {
        panel.addEventListener(type, (e) => e.stopPropagation());
    }

    document.body.appendChild(panel);
    return panel;
}

export function initDevTools() {
    let panel = null;
    let visible = false;
    let artRef = null;
    let exportBusy = false;

    const setVisible = (next) => {
        visible = next;
        if (!panel) return;
        panel.classList.toggle('visible', visible);
        // Keep custom cursor behaviour: panel uses default cursor; body still cursor:none outside
    };

    const toggle = () => setVisible(!visible);

    const exportJpg2x = async () => {
        const art = artRef || window.__artDir;
        if (!art?.renderer || exportBusy) return;
        exportBusy = true;
        try {
            await captureViewportExport(art, { format: 'jpeg', scale: 2 });
        } catch (err) {
            console.warn('Viewport export failed', err);
        } finally {
            exportBusy = false;
        }
    };

    document.addEventListener('keydown', (event) => {
        const tag = event.target?.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || event.target?.isContentEditable) return;
        if (event.key.toLowerCase() === 'h' && !event.ctrlKey && !event.metaKey && !event.altKey) {
            event.preventDefault();
            toggle();
            return;
        }
        // JPG 2× still — modifier+E so hover highlight stays while capturing
        if (event.key.toLowerCase() === 'e' && (event.metaKey || event.ctrlKey) && !event.altKey && !event.shiftKey) {
            event.preventDefault();
            exportJpg2x();
            return;
        }
        if (event.key === 'Escape' && visible) {
            event.preventDefault();
            setVisible(false);
        }
    });

    waitForArtDir()
        .then((art) => {
            artRef = art;
            panel = buildPanel(art);
            console.log('Art Direction toolkit ready (H · ⌘/Ctrl+E JPG 2×)');
        })
        .catch((err) => {
            console.warn('Art Direction toolkit unavailable', err);
        });
}
