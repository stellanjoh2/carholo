// App bootstrap (feature-flagged entry). Kept minimal to avoid side-effects.
import { initLightbox } from './ui/lightbox.js';

function onReady(fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn, { once: true });
    else fn();
}

onReady(() => {
    // Initialize lightbox only; rest of the app still runs via legacy code.
    try {
        initLightbox();
        // Future: init history/wiki, chart, and 3D here as we migrate.
    } catch (err) {
        console.error('Module app init failed', err);
    }
});


