// TypeScript interfaces matching the backend Pydantic models

export interface MotionEvent {
  id: number;
  timestamp: string;
  confidence: number;
  duration: number;
  description: string;
}

export interface MotionEventCreate {
  confidence: number;
  duration: number;
  description?: string;
}

export interface MotionSettings {
  detection_enabled: boolean;
  sensitivity: number;
  min_confidence: number;
  recording_enabled: boolean;
  alert_notifications: boolean;
}

// Motion detection related types
export interface MotionDetectionState {
  isDetecting: boolean;
  motionStrength: number;
  lastMotionTime: number | null;
  sensitivity: number;
}

export interface MotionDetectionResult {
  hasMotion: boolean;
  motionStrength: number;
  timestamp: number;
}

export interface FrameComparisonData {
  currentFrame: ImageData;
  previousFrame: ImageData | null;
  diffThreshold: number;
}