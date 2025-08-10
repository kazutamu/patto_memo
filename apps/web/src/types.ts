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