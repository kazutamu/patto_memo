/**
 * Motion detection related types shared across the monorepo
 */

// Motion event from backend
export interface MotionEvent {
  id: number;
  timestamp: string;
  confidence: number;
  duration: number;
  description: string;
}

// Motion event creation payload
export interface MotionEventCreate {
  confidence: number;
  duration: number;
  description?: string;
}

// Motion detection settings
export interface MotionSettings {
  detection_enabled: boolean;
  sensitivity: number;
  min_confidence: number;
  recording_enabled: boolean;
  alert_notifications: boolean;
}

// Client-side motion detection state
export interface MotionDetectionState {
  isDetecting: boolean;
  motionStrength: number;
  lastMotionTime: number | null;
  sensitivity: number;
}

// Motion detection result from frame analysis
export interface MotionDetectionResult {
  hasMotion: boolean;
  motionStrength: number;
  timestamp: number;
}

// Frame comparison data for motion detection
export interface FrameComparisonData {
  currentFrame: ImageData;
  previousFrame: ImageData | null;
  diffThreshold: number;
}

// Motion detection configuration
export interface MotionDetectionConfig {
  sensitivity: number; // 0.1 to 1.0
  significanceThreshold: number; // 0.1 to 1.0
  detectionInterval: number; // milliseconds
  aiAnalysisEnabled: boolean;
  aiAnalysisRate: number; // max requests per minute
}