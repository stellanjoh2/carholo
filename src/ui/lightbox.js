// Minimal lightbox bootstrap wrapper (non-invasive). Uses existing DOM.

export function initLightbox() {
    // Wait for showImageLightbox to be available (it's defined in main.js)
    // Use a MutationObserver or polling to wait for it
    function waitForShowImageLightbox(callback) {
        if (typeof window.showImageLightbox === 'function') {
            callback();
            return;
        }
        
        // Poll for it (main.js loads after this)
        let attempts = 0;
        const maxAttempts = 50; // 5 seconds max
        const interval = setInterval(() => {
            attempts++;
            if (typeof window.showImageLightbox === 'function') {
                clearInterval(interval);
                callback();
            } else if (attempts >= maxAttempts) {
                clearInterval(interval);
                console.warn('showImageLightbox not found after waiting');
            }
        }, 100);
    }
    
    // Set up the lightbox functionality when ready
    waitForShowImageLightbox(() => {
        // Map video sources to their associated image sources
        const videoToImageMap = {
            'pfuture-video.mp4': 'Media/pfuture.PNG',
            'pfuture-video.MP4': 'Media/pfuture.PNG',
            'pfuture-video': 'Media/pfuture.PNG', // Handle partial matches
            'ferdinand-animated.mp4': 'Media/ferdinand.jpg',
            'ferdinand-animated.MP4': 'Media/ferdinand.jpg',
            // Add more mappings as needed
        };
        
        // Helper function to get image source from video source
        function getImageForVideo(videoSrc, contentElement) {
            if (!videoSrc || !contentElement) return null;
            const lowerSrc = videoSrc.toLowerCase();
            // Check exact matches first (this handles the videoToImageMap)
            for (const [video, image] of Object.entries(videoToImageMap)) {
                if (lowerSrc.includes(video.toLowerCase())) {
                    // Return the mapped image directly (already specified in the map)
                    // Check if image element exists in DOM
                    const imgElement = contentElement.querySelector(`img[src*="${image}"], img[src*="${image.split('/').pop()}"]`);
                    if (imgElement) {
                        return imgElement.src || image;
                    }
                    // If no DOM element found, return the mapped path
                    return image;
                }
            }
            // Try to find associated image by looking for same name with different extension
            const baseName = videoSrc.replace(/\.(mp4|webm|mov)$/i, '');
            // Prefer .jpg first, then try other extensions
            const imageExtensions = ['.jpg', '.jpeg', '.JPG', '.JPEG', '.png', '.PNG'];
            for (const ext of imageExtensions) {
                const imageSrc = baseName + ext;
                // Check if this image exists in the content
                const img = contentElement.querySelector(`img[src*="${imageSrc}"], img[src*="${baseName}"]`);
                if (img) return img.src || imageSrc;
            }
            return null;
        }
        
        // Override showImageLightbox to filter out videos from lightboxImages array
        const originalShowImageLightbox = window.showImageLightbox;
        if (typeof originalShowImageLightbox === 'function') {
            window.showImageLightbox = function(mediaElement, imageIndex = null) {
                // Pre-filter lightboxImages if it exists (from previous calls)
                if (window.lightboxImages && Array.isArray(window.lightboxImages)) {
                    window.lightboxImages = window.lightboxImages.filter(src => {
                        if (!src) return false;
                        const lowerSrc = src.toLowerCase();
                        return !lowerSrc.includes('.mp4') && 
                               !lowerSrc.includes('.webm') && 
                               !lowerSrc.includes('.mov') &&
                               !lowerSrc.includes('video') &&
                               !lowerSrc.includes('pfuture-video') &&
                               !lowerSrc.includes('ferdinand-animated');
                    });
                }
                
                // Call original function to populate and show lightbox
                const result = originalShowImageLightbox.call(this, mediaElement, imageIndex);
                
                // Filter out video sources from lightboxImages array immediately after original function populates it
                // This needs to happen synchronously because the original function uses the array
                if (window.lightboxImages && Array.isArray(window.lightboxImages)) {
                    const filteredImages = window.lightboxImages.filter(src => {
                        // Exclude video file extensions and video sources
                        if (!src) return false;
                        const lowerSrc = src.toLowerCase();
                        return !lowerSrc.includes('.mp4') && 
                               !lowerSrc.includes('.webm') && 
                               !lowerSrc.includes('.mov') &&
                               !lowerSrc.includes('video') &&
                               !lowerSrc.includes('pfuture-video') &&
                               !lowerSrc.includes('ferdinand-animated');
                    });
                    
                    // Update the array and adjust index if needed
                    if (filteredImages.length !== window.lightboxImages.length) {
                        const currentIndex = window.currentLightboxIndex || 0;
                        window.lightboxImages = filteredImages;
                        
                        // If current index is out of bounds, adjust it
                        if (window.currentLightboxIndex !== undefined && window.currentLightboxIndex >= filteredImages.length) {
                            window.currentLightboxIndex = Math.max(0, filteredImages.length - 1);
                            // Re-call the original function with the corrected index if needed
                            if (filteredImages.length > 0) {
                                originalShowImageLightbox.call(this, null, window.currentLightboxIndex);
                            }
                        }
                    }
                }
                
                return result;
            };
        }
        
        // Set up click handler when content is available (it's created dynamically)
        // Use MutationObserver to wait for content to be created
        const observer = new MutationObserver((mutations, obs) => {
            const content = document.getElementById('porsche-history-content');
            if (content) {
                obs.disconnect();
                
                // Delegate clicks to legacy handler if present; otherwise, open via legacy function
                // Use capture phase to intercept clicks EARLY, before other handlers
                content.addEventListener('click', (e) => {
                    const el = e.target;
                    if (!(el instanceof Element)) return;
                    
                    // FIRST: Check if clicking on a wrapper that contains the porsche 9000 video
                    // This must come FIRST to catch clicks on wrapper elements
                    const wrapper = el.closest('.porsche-history-image-wrapper, .porsche-history-image');
                    if (wrapper) {
                        const wrapperVideo = wrapper.querySelector('video[src*="pfuture-video"], video[data-no-lightbox="true"]');
                        if (wrapperVideo) {
                            e.preventDefault();
                            e.stopPropagation();
                            e.stopImmediatePropagation();
                            return;
                        }
                    }
                    
                    // SECOND: Block clicks on videos - they should not be clickable
                    // Check if clicked element is a video, or if a video is within the clicked element
                    const video = el.tagName === 'VIDEO' ? el : el.closest('video');
                    if (video) {
                        // Double-check for porsche 9000 thumbnail specifically
                        const videoSrc = video.src || video.getAttribute('src') || '';
                        if (video.getAttribute('data-no-lightbox') === 'true' || 
                            videoSrc.includes('pfuture-video')) {
                            e.preventDefault();
                            e.stopPropagation();
                            e.stopImmediatePropagation();
                            return;
                        }
                        // Block all other videos too
                        e.preventDefault();
                        e.stopPropagation();
                        e.stopImmediatePropagation();
                        return;
                    }
                    
                    // Handle clicks on images normally
                    const media = el.closest('.porsche-history-image img, .porsche-history-fullwidth-image img');
                    if (media && media.tagName === 'IMG') {
                        // Prefer existing global opener to avoid behavior drift
                        if (typeof window.showImageLightbox === 'function') {
                            e.preventDefault();
                            window.showImageLightbox(media);
                        }
                    }
                }, { capture: true }); // Use capture phase to catch clicks before they bubble
            }
        });
        
        // Start observing
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
        
        // Also check immediately in case content already exists
        const content = document.getElementById('porsche-history-content');
        if (content) {
            observer.disconnect();
            
            // Delegate clicks to legacy handler if present; otherwise, open via legacy function
            content.addEventListener('click', (e) => {
                const el = e.target;
                if (!(el instanceof Element)) return;
                
                // Block clicks on videos - they should not be clickable
                if (el.tagName === 'VIDEO' || el.closest('video')) {
                    e.preventDefault();
                    e.stopPropagation();
                    e.stopImmediatePropagation();
                    return;
                }
                
                // Handle clicks on images normally
                const media = el.closest('.porsche-history-image img, .porsche-history-fullwidth-image img');
                if (media && media.tagName === 'IMG') {
                    // Prefer existing global opener to avoid behavior drift
                    if (typeof window.showImageLightbox === 'function') {
                        e.preventDefault();
                        window.showImageLightbox(media);
                    }
                }
            }, { capture: true }); // Use capture phase to catch clicks before they bubble
        }
    });
}


