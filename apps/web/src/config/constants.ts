/**
 * Application-wide constants and configuration values
 * Centralized location for all magic numbers and configuration
 */

// Motion Detection Configuration
export const MOTION_DETECTION = {
  // Sensitivity settings
  DEFAULT_SENSITIVITY: 50,
  MIN_SENSITIVITY: 1,
  MAX_SENSITIVITY: 100,
  
  // Detection intervals (milliseconds)
  DEFAULT_INTERVAL: 100,
  MOBILE_INTERVAL: 200,
  DESKTOP_INTERVAL: 100,
  ADAPTIVE_MIN_INTERVAL: 150,
  
  // Thresholds
  SIGNIFICANCE_THRESHOLD: 20, // Motion strength threshold for AI analysis
  NOISE_THRESHOLD_MOBILE: 15,
  NOISE_THRESHOLD_DESKTOP: 10,
  
  // Frame processing
  FRAME_CAPTURE_THROTTLE: 8000, // 8 seconds max between captures
  MOBILE_PIXEL_SAMPLING: 8, // Sample every 8th pixel on mobile
  DESKTOP_PIXEL_SAMPLING: 4, // Sample every 4th pixel on desktop
  
  // Canvas dimensions for motion detection
  CANVAS_WIDTH: 320,
  CANVAS_HEIGHT: 240,
} as const;

// Camera Configuration
export const CAMERA = {
  // Video constraints - mobile
  MOBILE_CONSTRAINTS: {
    width: { ideal: 640, max: 1280 },
    height: { ideal: 480, max: 720 },
    frameRate: { ideal: 15, max: 30 },
  },
  
  // Video constraints - desktop
  DESKTOP_CONSTRAINTS: {
    width: { ideal: 1280, max: 1920 },
    height: { ideal: 720, max: 1080 },
    frameRate: { ideal: 30 },
  },
  
  // Retry settings
  STREAM_READY_DELAY: 500, // Delay before starting motion detection
} as const;

// UI Configuration
export const UI = {
  // Event display limits
  MAX_MOTION_EVENTS_DISPLAY: 5,
  MAX_MOTION_EVENTS_RECENT: 3,
  MAX_AI_ANALYSIS_DISPLAY: 3,
  MAX_AI_ANALYSIS_RECENT: 2,
  
  // Auto-hide delays (milliseconds)
  AI_ANALYSIS_AUTO_HIDE_DELAY: 12000, // 12 seconds
  
  // Animation timing
  LOADING_SPINNER_DELAY: 200,
} as const;

// API Configuration
export const API = {
  // Default confidence values
  DEFAULT_CONFIDENCE_THRESHOLD: 0.6,
  DEFAULT_MOTION_DURATION: 1.0,
  
  // Request timeouts
  DEFAULT_TIMEOUT: 60000, // 60 seconds
  
  // Retry settings
  MAX_RETRIES: 3,
} as const;

// Device Detection
export const DEVICE = {
  MOBILE_KEYWORDS: ['mobile', 'android', 'iphone', 'ipad', 'ipod', 'blackberry', 'windows phone'],
  
  BROWSER_COMPATIBILITY: {
    FIREFOX: { name: 'Firefox', isMobileCompatible: true },
    CHROME: { name: 'Chrome', isMobileCompatible: false },
    SAFARI: { name: 'Safari', isMobileCompatible: false },
    EDGE: { name: 'Edge', isMobileCompatible: false },
    UNKNOWN: { name: 'Unknown', isMobileCompatible: true },
  },
} as const;

// Error Messages
export const ERROR_MESSAGES = {
  CAMERA_ACCESS_DENIED_MOBILE: 'Camera access denied. Please check your browser settings and allow camera access for this site.',
  CAMERA_ACCESS_DENIED_DESKTOP: 'Camera access denied. Please grant camera permissions and try again.',
  NO_CAMERA_MOBILE: 'No camera found. Please ensure your device has a working camera.',
  NO_CAMERA_DESKTOP: 'No camera found. Please connect a camera and try again.',
  CAMERA_IN_USE_MOBILE: 'Camera is being used by another app. Please close other camera apps and try again.',
  CAMERA_IN_USE_DESKTOP: 'Camera is being used by another application.',
  CAMERA_NOT_SUPPORTED_MOBILE: 'This camera configuration is not supported on your device. Try switching cameras.',
  CAMERA_NOT_SUPPORTED_DESKTOP: 'Camera does not support the requested configuration.',
  HTTPS_REQUIRED_FIREFOX: '🔒 Camera access requires HTTPS. You\'re using Firefox which should work - please accept the security warning.',
  HTTPS_REQUIRED_OTHER: (browserName: string) => `🔒 Camera access requires HTTPS. ${browserName} has strict security requirements. Try Firefox mobile for easier access, or accept the security warning in advanced settings.`,
  HTTPS_REQUIRED_DESKTOP: '🔒 Camera access requires a secure connection (HTTPS).',
  GENERIC_CAMERA_ERROR: 'Camera error occurred. Please try again.',
} as const;

// Type exports for better type safety
export type MotionDetectionConfig = typeof MOTION_DETECTION;
export type CameraConfig = typeof CAMERA;
export type UIConfig = typeof UI;
export type APIConfig = typeof API;
export type DeviceConfig = typeof DEVICE;
export type ErrorMessages = typeof ERROR_MESSAGES;