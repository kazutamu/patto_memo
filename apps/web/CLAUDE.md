# Web Frontend - Development Guidelines

## Technology Stack

- Framework: React with TypeScript
- Styling: CSS Modules with modern design system
- State Management: Zustand for simple state management
- Build Tool: Vite
- Motion Detection: Browser-based OpenCV.js or MediaPipe
- Video Processing: WebRTC for camera access and frame analysis
- UI Design: Dark theme with glass morphism and smooth animations

## Environment Variables

- `VITE_API_URL` - API base URL
- `VITE_WS_URL` - WebSocket URL for real-time updates
- `VITE_MOTION_SENSITIVITY` - Default motion detection sensitivity (0.1-1.0)
- `VITE_DETECTION_INTERVAL` - Frame analysis interval (ms)
- `VITE_SIGNIFICANCE_THRESHOLD` - Threshold for triggering AI analysis (0.1-1.0)
- `VITE_AI_ANALYSIS_RATE` - Max AI analysis requests per minute
- `VITE_FRAME_COMPRESSION_QUALITY` - WebP compression quality (0.1-1.0)
- `VITE_ENABLE_WEBWORKERS` - Enable WebWorkers for heavy processing
- `VITE_ENABLE_ANIMATIONS` - Enable UI animations and effects
- `VITE_THEME_MODE` - UI theme (dark/light, default: dark)

## Local HTTPS Setup

This application requires HTTPS for camera access. The development server automatically generates SSL certificates using `@vitejs/plugin-basic-ssl`.

### Automatic Certificate Generation
- SSL certificates are generated automatically when you run `npm run dev`
- Certificates are stored in `apps/web/certs/` (ignored by git)
- No manual certificate setup required

### Browser Security Warnings
When first accessing `https://localhost:3000`, you may see security warnings:
1. Click "Advanced" or "Show Details"
2. Click "Proceed to localhost (unsafe)" or "Accept the Risk and Continue"
3. This is safe for local development with self-signed certificates

### Mobile Device Testing
To test camera features on mobile devices:
1. Find your computer's IP address (e.g., `192.168.1.100`)
2. Access `https://YOUR_IP:3000` from your mobile device
3. Accept the security warning on your mobile browser

### Why HTTPS is Required
- **Camera Access**: `navigator.mediaDevices.getUserMedia()` only works over HTTPS
- **Security**: Modern browsers block media access over HTTP for privacy
- **WebRTC**: Real-time video features require secure connections

## User Experience Design

### MVP Interface Design

- **Single Screen Application**: Full-screen video feed with minimal controls
- **Ultra-Simple Controls**: Motion toggle (ON/OFF) and sensitivity slider only
- **No Complex Features**: No user accounts, history logs, or settings pages for MVP
- **Focus**: Perfect the core experience of motion detection → alert → AI insight

### Visual Design System

- **Theme**: Dark mode with neon accent colors (cyan/purple)
- **Typography**: Modern font (Inter or Poppins) with varied weights
- **Layout**: Glass morphism effects with rounded corners and subtle shadows
- **Animations**: Smooth transitions, slide-in popups, and satisfying interactions

### Interactive Elements

- **Video Display**: Full-screen camera feed with subtle glow effect when motion detected
- **Motion Toggle**: Smooth animated toggle with satisfying click feedback
- **Sensitivity Slider**: Color-coded gradient slider (green → yellow → red)
- **Alert Popups**: Modern card-based notifications with smooth animations
- **AI Analysis**: Typing animation for text reveal with confidence percentage bars

### User Flow

1. **Main Interface**: Live video feed with motion toggle and sensitivity slider
2. **Motion Detection**: Instant popup alert with timestamp and dismiss button
3. **AI Analysis**: Delayed stylish card showing LLaVA insights with confidence score
4. **Visual Feedback**: Pulsing glow around video during motion events

### Responsive Design

- **Desktop**: Full-screen immersive experience
- **Mobile**: Touch-optimized controls with haptic feedback simulation
- **Tablet**: Adaptive layout maintaining visual hierarchy

## Motion Detection Implementation

### Core Features

- Client-side motion detection using webcam and mobile cameras
- Browser-based real-time motion analysis (OpenCV.js/MediaPipe)
- Event-driven architecture (motion events sent to backend)
- Configurable detection sensitivity and thresholds (client-side)
- Cross-platform browser and mobile support
- Modern, stylish user interface with dark theme and animations

### Performance Optimization

- Client-side motion detection eliminates server processing load
- Significance filtering reduces AI analysis to ~5-10% of motion events
- Efficient browser-based frame processing (WebWorkers for heavy operations)
- Compressed frame transmission (WebP/JPEG) reduces bandwidth by 80-90%
- Event-driven backend processing (only significant motion events)

### Camera Integration

- WebRTC for browser-based webcam access
- Mobile camera API integration
- Real-time frame streaming via WebSocket
- Support for multiple simultaneous camera feeds

## Frontend Architecture

### Component Structure

```
src/
├── components/
│   ├── motion/
│   │   ├── MotionDetector.tsx
│   │   ├── VideoFeed.tsx
│   │   └── MotionControls.tsx
│   ├── ui/
│   │   ├── Toggle.tsx
│   │   ├── SensitivitySlider.tsx
│   │   ├── AlertPopup.tsx
│   │   └── AIAnalysisCard.tsx
│   └── layout/
│       └── MainLayout.tsx
├── hooks/
│   ├── useMotionDetection.ts
│   ├── useWebSocket.ts
│   └── useCamera.ts
├── services/
│   ├── motionService.ts
│   ├── websocketService.ts
│   └── cameraService.ts
├── store/
│   └── motionStore.ts
├── styles/
│   ├── globals.css
│   └── components/
└── utils/
    ├── motionUtils.ts
    └── mediaUtils.ts
```

### State Management

Using Zustand for simple, type-safe state management:

```typescript
interface MotionStore {
  isDetecting: boolean;
  sensitivity: number;
  lastEvent: MotionEvent | null;
  aiAnalysis: AIAnalysis | null;
  toggleDetection: () => void;
  setSensitivity: (value: number) => void;
  addEvent: (event: MotionEvent) => void;
  setAIAnalysis: (analysis: AIAnalysis) => void;
}
```

## Development Commands

- `npm run dev:web` - Start React development server
- `npm run build:web` - Build web application
- `npm run test:web` - Run web application tests
- `npm run lint:web` - Run linting for web app
- `npm run type-check:web` - TypeScript type checking

## Testing Strategy

- **Unit Tests**: Component logic and utilities (Jest + Testing Library)
- **Integration Tests**: Motion detection workflow and WebSocket communication
- **E2E Tests**: Complete user flows with camera simulation (Playwright)
- **Visual Tests**: UI component snapshots and accessibility testing
- **Performance Tests**: Motion detection latency and memory usage benchmarks