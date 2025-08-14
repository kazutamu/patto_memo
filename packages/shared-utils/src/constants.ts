/**
 * Shared constants across the monorepo
 */

// Motion detection constants
export const MOTION_DETECTION = {
  DEFAULT_SENSITIVITY: 0.5,
  MIN_SENSITIVITY: 0.1,
  MAX_SENSITIVITY: 1.0,
  DEFAULT_SIGNIFICANCE_THRESHOLD: 0.7,
  DEFAULT_DETECTION_INTERVAL: 100, // ms
  DEFAULT_AI_ANALYSIS_RATE: 10, // per minute
  FRAME_COMPRESSION_QUALITY: 0.8,
} as const;

// API endpoints
export const API_ENDPOINTS = {
  BASE: '/api/v1',
  MOTION_EVENTS: '/api/v1/motion/events',
  MOTION_SETTINGS: '/api/v1/motion/settings',
  LLAVA_ANALYZE: '/api/v1/llava/analyze',
  LLAVA_UPLOAD: '/api/v1/llava/analyze-upload',
  SSE_STREAM: '/api/v1/events/stream',
  SSE_CONNECTIONS: '/api/v1/events/connections',
  HEALTH: '/health',
} as const;

// SSE configuration
export const SSE_CONFIG = {
  RECONNECT_INTERVAL: 3000, // ms
  MAX_RECONNECT_ATTEMPTS: 10,
  HEARTBEAT_INTERVAL: 30000, // ms
} as const;

// UI theme colors
export const THEME_COLORS = {
  PRIMARY: '#0ea5e9',
  SECONDARY: '#8b5cf6',
  SUCCESS: '#10b981',
  WARNING: '#f59e0b',
  ERROR: '#ef4444',
  BACKGROUND: '#0f172a',
  SURFACE: '#1e293b',
  TEXT_PRIMARY: '#f1f5f9',
  TEXT_SECONDARY: '#94a3b8',
} as const;

// Camera constraints
export const CAMERA_CONSTRAINTS = {
  VIDEO: {
    width: { ideal: 1280 },
    height: { ideal: 720 },
    frameRate: { ideal: 30 },
  },
  AUDIO: false,
} as const;

// Error messages
export const ERROR_MESSAGES = {
  CAMERA_ACCESS_DENIED: 'Camera access was denied. Please enable camera permissions.',
  CAMERA_NOT_FOUND: 'No camera device found.',
  HTTPS_REQUIRED: 'HTTPS is required for camera access.',
  SSE_CONNECTION_FAILED: 'Failed to connect to server events stream.',
  API_REQUEST_FAILED: 'API request failed. Please try again.',
  INVALID_IMAGE_FORMAT: 'Invalid image format. Please upload a valid image.',
} as const;