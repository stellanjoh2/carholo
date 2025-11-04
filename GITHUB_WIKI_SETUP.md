# Setup & Installation

## Requirements

- Modern web browser (Chrome, Firefox, Safari, Edge)
- WebGL support enabled
- Desktop computer (mobile not currently supported)
- Local web server (recommended for development)

## Installation

### Option 1: Direct File Opening
Simply open `index.html` in your browser. Note that some features may not work due to CORS restrictions when opening files directly.

### Option 2: Local Development Server (Recommended)

#### Using Python
```bash
# Python 3
python -m http.server 8000

# Python 2
python -m SimpleHTTPServer 8000
```

Then navigate to: `http://localhost:8000`

#### Using Node.js
```bash
# Install http-server globally
npm install -g http-server

# Run server
http-server -p 8000
```

#### Using PHP
```bash
php -S localhost:8000
```

#### Using VS Code
Install the "Live Server" extension and right-click `index.html` → "Open with Live Server"

## Project Structure

```
carholo/
├── Media/                    # All media assets
│   ├── *.jpg, *.png        # Images
│   ├── *.mp4, *.MP4        # Videos
│   ├── *.wav, *.mp3        # Audio files
│   └── *.hdr               # HDR environment maps
├── porsche-3-logo-pack/    # Logo assets
├── src/                     # Source code
│   ├── app.js              # Main application entry
│   ├── ui/                 # UI components
│   │   └── lightbox.js     # Image lightbox
│   └── input/              # Input handlers
│       └── gamepad.js      # Gamepad support
├── index.html              # Main HTML file
├── main.js                 # Legacy application code
└── package.json            # Dependencies
```

## Dependencies

### External Libraries (CDN)
- **Three.js**: 3D rendering library
- **GSAP**: Animation library
- **Feather Icons**: Icon library
- **Google Fonts**: DM Mono font family

All dependencies are loaded via CDN, so no npm install is required.

### Local Dependencies
- No build tools required
- No npm packages needed (optional terser for minification)

## Development

### File Structure Notes
- `main.js` contains legacy code
- `src/app.js` is the new modular entry point
- Use `?legacy=1` URL parameter to disable modular code if needed

### Browser Compatibility
- Requires ES6 modules support
- Requires WebGL support
- Optimized for desktop browsers

## Troubleshooting

### Issues Opening Locally
If you see CORS errors or assets don't load:
- Use a local web server (see Option 2 above)
- Don't open files directly via `file://` protocol

### 3D Model Not Loading
- Check browser console for errors
- Verify WebGL is enabled in your browser
- Try a different browser

### Audio Not Playing
- Check browser autoplay policies
- Some browsers require user interaction before playing audio
- Click the music player button to start playback

