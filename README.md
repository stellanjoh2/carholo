# CAR HOLO — 3D Porsche Showcase

A lightweight Three.js experience showcasing a Porsche model with tasteful post‑processing, smooth intro/reveal, and responsive UI. Built to run as a static site (no build step required).

- Live repo: `https://github.com/stellanjoh2/carholo`
- Tech: Three.js, GSAP, vanilla JS/CSS, static assets in `Media/`

## Features
- 3D car scene with controlled camera intro zoom and fade‑in.
- History page with timeline-style content and emphasized key terms.
- Post‑processing stack (vignette, bloom, etc.) with tuned parameters.
- Clean intro flow with video preface (simple overlay reveal).
- Top navigation with hover scaling, brighter hover color, and reliable visibility.
- Interactivity is disabled during intro zoom/fade, enabled once the scene is ready.

## Project Structure
```
/Media                # Images, videos, HDRI, logos, model files
/src
  /input              # Input handlers (e.g., gamepad)
  /ui                 # UI helpers (e.g., lightbox)
index.html            # Main HTML + CSS and intro sequence
main.js               # Three.js scene, loaders, UI logic
package.json          # Dev dependency: terser (optional)
```

## Getting Started
No build is required. You can open `index.html` directly or serve it locally for correct CORS behavior when loading some assets.

### Option A — Open directly
- Double‑click `index.html` (works in most desktop browsers)

### Option B — Serve locally (recommended)
- Using Python:
  ```bash
  cd /path/to/carholo
  python3 -m http.server 8080
  # open http://localhost:8080
  ```
- Or with Node’s `http-server` (if you prefer):
  ```bash
  npx http-server -p 8080
  ```

## Development Notes
- All asset paths are relative (under `Media/`), so moving the project folder is safe.
- The intro overlay reveal is a simple top‑to‑bottom clip‑path animation.
- Car hover/interactivity is disabled during the intro and enabled after the camera zoom completes.
- 3D Porsche logo remains on‑screen during popups (no fade‑outs), matching other UI behavior.

## Post‑Processing
The vignette and other effects are configured in `main.js`. The vignette shader was corrected to ensure visibility by normalizing distance to the corners.

## Deployment
This site works with any static host:

### GitHub Pages
1. Push to `main` (done)
2. In GitHub, enable Pages for the repo (Settings → Pages → Source: `Deploy from a branch`, select `main` root)
3. Access your site at the provided Pages URL

## Troubleshooting
- Video doesn’t play: ensure the file `Media/herointro.mp4` exists and you’re serving over HTTP(s) if the browser blocks autoplay.
- Black screen after Enter: check console for shader or asset path errors. Restore `main.js` if the shader block was edited.
- UI icons disappear on hover: ensure custom CSS for `opacity: 1` on hover/active/focus is present (already included).

## License
No license specified. All rights reserved by the project owner.

## Credits / Assets
- Porsche model, logos, and media are included under `Media/`. Verify rights before public redistribution.

---
If you have any issues or want to extend the experience, open `index.html` and `main.js`—they are the primary control points.
