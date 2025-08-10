# Mobile App - Development Guidelines

## Technology Stack

- Framework: React Native with TypeScript
- Navigation: React Navigation
- State Management: Zustand (shared with web)
- Camera Integration: React Native Camera
- Motion Detection: Native modules with OpenCV
- WebSocket: Native WebSocket implementation
- UI Design: Native components with shared design system

## Environment Variables

- `MOBILE_API_URL` - API base URL for mobile
- `MOBILE_WS_URL` - WebSocket URL for mobile connections
- `MOBILE_MOTION_SENSITIVITY` - Default sensitivity for mobile cameras
- `MOBILE_BACKGROUND_DETECTION` - Enable background motion detection
- `MOBILE_PUSH_NOTIFICATIONS` - Enable push notification alerts
- `MOBILE_HAPTIC_FEEDBACK` - Enable haptic feedback for interactions
- `MOBILE_BATTERY_OPTIMIZATION` - Enable battery-conscious processing
- `MOBILE_OFFLINE_MODE` - Enable offline motion detection storage

## Mobile-Specific Features

### Camera Integration

- Native camera access with React Native Camera
- Front and rear camera switching
- Background camera processing (when app is backgrounded)
- Camera permission handling
- Battery-optimized frame processing

### Motion Detection

- Native OpenCV integration for performance
- Background processing with native modules
- Battery-conscious detection algorithms
- Reduced frame rate processing for battery life
- Wake-lock management for continuous detection

### User Experience

- Touch-optimized controls and gestures
- Haptic feedback for motion events
- Push notifications for alerts
- Offline mode with local storage
- Auto-pause detection when battery is low

### Platform-Specific Optimizations

#### iOS

- Metal performance shaders for frame processing
- Background app refresh integration
- iOS push notification service
- Core Motion integration for device movement detection
- Privacy-focused camera access patterns

#### Android

- OpenGL ES optimization for frame processing
- Background service management
- FCM push notifications
- Sensor fusion with accelerometer data
- Doze mode and battery optimization handling

## Mobile Architecture

### Component Structure

```
src/
├── components/
│   ├── camera/
│   │   ├── CameraView.tsx
│   │   ├── CameraControls.tsx
│   │   └── MotionOverlay.tsx
│   ├── motion/
│   │   ├── MobileMotionDetector.tsx
│   │   └── MotionSettings.tsx
│   ├── ui/
│   │   ├── MobileToggle.tsx
│   │   ├── TouchSlider.tsx
│   │   └── AlertModal.tsx
│   └── navigation/
│       └── AppNavigator.tsx
├── screens/
│   ├── MotionScreen.tsx
│   ├── SettingsScreen.tsx
│   └── AlertsScreen.tsx
├── hooks/
│   ├── useMobileCamera.ts
│   ├── useMobileMotion.ts
│   └── useBackgroundTasks.ts
├── services/
│   ├── cameraService.ts
│   ├── motionService.ts
│   ├── notificationService.ts
│   └── backgroundService.ts
├── native/
│   ├── MotionDetectionModule.ts
│   ├── CameraModule.ts
│   └── BackgroundTaskModule.ts
└── utils/
    ├── permissions.ts
    ├── battery.ts
    └── storage.ts
```

## Native Modules

### Motion Detection Module

```typescript
interface MotionDetectionModule {
  startDetection(sensitivity: number): Promise<boolean>;
  stopDetection(): Promise<void>;
  getMotionEvents(): Promise<MotionEvent[]>;
  setBackgroundMode(enabled: boolean): Promise<void>;
}
```

### Camera Module

```typescript
interface CameraModule {
  requestPermissions(): Promise<boolean>;
  startCamera(facing: 'front' | 'back'): Promise<void>;
  stopCamera(): Promise<void>;
  switchCamera(): Promise<void>;
  getFrame(): Promise<string>; // base64 encoded
}
```

### Background Task Module

```typescript
interface BackgroundTaskModule {
  registerBackgroundTask(): Promise<string>;
  unregisterBackgroundTask(taskId: string): Promise<void>;
  isBackgroundModeAvailable(): Promise<boolean>;
}
```

## State Management

### Mobile-Specific Store

```typescript
interface MobileMotionStore extends MotionStore {
  // Mobile-specific state
  backgroundMode: boolean;
  batteryOptimized: boolean;
  cameraFacing: 'front' | 'back';
  pushNotificationsEnabled: boolean;
  
  // Mobile-specific actions
  toggleBackgroundMode: () => void;
  switchCamera: () => void;
  setBatteryOptimization: (enabled: boolean) => void;
  requestNotificationPermissions: () => Promise<boolean>;
}
```

## Performance Considerations

### Battery Optimization

- Adaptive frame rate based on battery level
- Background processing throttling
- Wake lock management
- CPU usage monitoring
- Memory pressure handling

### Memory Management

- Frame buffer pooling
- Automatic cleanup of processed frames
- Native memory management
- Garbage collection optimization
- Large object disposal

### Network Optimization

- Compression for mobile networks
- Offline queue for poor connectivity
- Adaptive quality based on connection
- Background sync when Wi-Fi available
- Data usage monitoring

## Platform Integration

### iOS Integration

```swift
// Native iOS Motion Detection
@objc(MotionDetectionModule)
class MotionDetectionModule: NSObject {
  @objc
  func startDetection(_ sensitivity: Double) -> Promise<Bool> {
    // OpenCV integration
    // Background processing setup
    // Core Motion integration
  }
}
```

### Android Integration

```kotlin
// Native Android Motion Detection
class MotionDetectionModule : ReactContextBaseJavaModule() {
  override fun getName(): String = "MotionDetectionModule"
  
  @ReactMethod
  fun startDetection(sensitivity: Double, promise: Promise) {
    // OpenCV integration
    // Background service setup
    // Sensor fusion integration
  }
}
```

## Development Commands

- `npm run dev:mobile` - Start React Native development
- `npm run build:mobile:ios` - Build iOS application
- `npm run build:mobile:android` - Build Android application
- `npm run test:mobile` - Run mobile tests
- `npm run lint:mobile` - Run mobile linting
- `npx react-native run-ios` - Run on iOS simulator
- `npx react-native run-android` - Run on Android emulator

## Testing Strategy

- **Unit Tests**: Component and service logic
- **Integration Tests**: Native module integration
- **E2E Tests**: Complete user flows on device
- **Performance Tests**: Battery usage and memory profiling
- **Device Tests**: Testing on various device configurations
- **Platform Tests**: iOS and Android specific functionality