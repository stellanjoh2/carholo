# Technical Documentation

## Architecture

### Code Organization

Carholo uses a hybrid architecture with both legacy code and modern modular components:

- **Legacy Code**: `main.js` contains the original application code
- **Modular Code**: `src/` directory contains new modular components
- **Feature Flag**: Use `?legacy=1` URL parameter to disable modular code

### Module System

The project uses ES6 modules with an import map:

```javascript
{
  "imports": {
    "three": "https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js",
    "three/addons/": "https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/"
  }
}
```

## Key Components

### 3D Rendering (Three.js)

The application uses Three.js for 3D rendering:
- WebGL renderer
- Scene, camera, and lighting setup
- FBX model loading for the Porsche 911
- HDRI environment maps for realistic lighting

### Animation System (GSAP)

GSAP is used for:
- UI animations and transitions
- Scroll-triggered animations
- Overlay enter/exit animations
- Image reveal effects

### UI Components

#### Lightbox (`src/ui/lightbox.js`)
- Image and video lightbox functionality
- Navigation between media items
- Blur and scale animations
- Keyboard navigation support

#### Gamepad Input (`src/input/gamepad.js`)
- Gamepad detection and handling
- Button mapping for navigation
- Controller-friendly interface

## Styling

### Color Scheme
- Primary: `#ffd700` (Gold/Yellow)
- Warning: `#ff4444` (Red)
- Success: `#44ff44` (Green)
- Background: `rgba(0, 0, 0, 0.75)` (Semi-transparent black)

### Typography
- Font Family: DM Mono (Google Fonts)
- Font Weights: 100 (Light), 300, 400 (Regular), 700 (Bold)

### Effects
- Text shadows with glow effects
- Backdrop blur filters
- CSS animations for flicker and interlace effects
- Custom scrollbar styling

## State Management

The application uses a combination of:
- DOM classes for UI state
- Global variables for 3D scene state
- Event-driven architecture

## Performance Considerations

- **WebGL Optimization**: Efficient 3D rendering
- **Animation Performance**: GPU-accelerated transforms
- **Image Loading**: Lazy loading for media assets
- **Scroll Performance**: Throttled scroll handlers

## Browser APIs Used

- **WebGL**: 3D rendering
- **Fullscreen API**: Fullscreen mode
- **Gamepad API**: Controller support
- **Pointer Events**: Mouse and touch input
- **Intersection Observer**: Scroll-based animations (if used)

## Media Assets

### Supported Formats
- **Images**: JPG, PNG
- **Videos**: MP4
- **Audio**: WAV, MP3, FLAC
- **3D Models**: FBX
- **Environment Maps**: HDR

### Asset Organization
All media assets are stored in the `Media/` directory with descriptive filenames.

## Custom Features

### Custom Cursor
- Replaces default browser cursor
- CSS-based crosshair design
- State-based color changes
- Always visible on top

### Scroll Animations
- Reveal animations on scroll
- Parallax effects for images
- Custom scrollbar implementation
- Smooth scrolling behavior

## Future Improvements

Potential areas for enhancement:
- Mobile support
- Build system integration
- TypeScript conversion
- Progressive Web App features
- Performance optimizations

