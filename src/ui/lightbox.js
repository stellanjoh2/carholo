// Minimal lightbox bootstrap wrapper (non-invasive). Uses existing DOM.

export function initLightbox() {
    const content = document.getElementById('porsche-history-content');
    if (!content) return;
    // Delegate clicks to legacy handler if present; otherwise, open via legacy function
    content.addEventListener('click', (e) => {
        const el = e.target;
        if (!(el instanceof Element)) return;
        const media = el.closest('.porsche-history-image img, .porsche-history-fullwidth-image img, .porsche-history-image video, .porsche-history-fullwidth-image video');
        if (!media) return;
        // Prefer existing global opener to avoid behavior drift
        if (typeof window.showImageLightbox === 'function') {
            e.preventDefault();
            window.showImageLightbox(media);
        }
    }, { capture: false });
}


