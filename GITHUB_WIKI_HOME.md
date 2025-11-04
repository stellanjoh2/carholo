# Carholo

An interactive web-based 3D visualization and configurator for the Porsche 911.

## Overview

Carholo is an immersive web application that allows users to explore and interact with a detailed 3D model of the Porsche 911. The project features a cyberpunk-inspired aesthetic with a distinctive yellow/gold color scheme and retro-futuristic design elements.

## Features

### Interactive 3D Visualization
- Rotate and explore a detailed 3D model of the Porsche 911
- Rendered using Three.js
- Supports mouse and gamepad controls

### Part Inspection
- Click on individual components to view detailed information
- View maintenance status and specifications for each part
- Interactive tooltips with part names and status indicators

### Porsche History Overlay
- Comprehensive article titled "Porsche: The Cult of Precision"
- Historical context about the Porsche brand and 911 model
- Interactive image gallery with lightbox functionality
- Stock chart visualization of Porsche's performance

### Additional Features
- **Music Player**: Ambient soundtracks with cyberpunk atmosphere
- **Fullscreen Mode**: Immersive viewing experience
- **Custom Cursor**: Yellow crosshair cursor interface
- **Gamepad Support**: Enhanced interactivity with game controllers
- **Image Lightbox**: Navigate through Porsche history images and videos

## Technical Details

### Technology Stack
- **Frontend**: HTML, JavaScript (ES6 modules)
- **3D Rendering**: Three.js
- **Animations**: GSAP (GreenSock Animation Platform)
- **Fonts**: DM Mono (Google Fonts)
- **Icons**: Feather Icons

### Architecture
The project uses a modular architecture:
- `src/app.js` - Main application bootstrap
- `src/ui/lightbox.js` - Image lightbox functionality
- `src/input/gamepad.js` - Gamepad input handling
- `main.js` - Legacy application code

### Browser Compatibility
Optimized for desktop browsers. Mobile support is currently disabled.

## Getting Started

### Prerequisites
- Modern web browser with WebGL support
- Desktop computer (mobile not supported)

### Installation

```bash
# Clone the repository
git clone https://github.com/stellanjoh2/carholo.git

# Navigate to the project directory
cd carholo

# Open index.html in your browser
# Or use a local development server
python -m http.server 8000
# Then navigate to http://localhost:8000
```

### Development

The project uses ES6 modules and can be run directly in modern browsers without a build step. For development, use a local HTTP server to avoid CORS issues.

## Project Structure

```
carholo/
├── Media/              # Image, video, and audio assets
├── src/                # Modular source code
│   ├── app.js         # Application bootstrap
│   ├── ui/            # UI components
│   └── input/         # Input handlers
├── index.html         # Main HTML file
├── main.js            # Legacy application code
└── package.json       # Project dependencies
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

[Specify your license here]

## Links

- [GitHub Repository](https://github.com/stellanjoh2/carholo)

