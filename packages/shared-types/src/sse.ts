/**
 * Server-Sent Events (SSE) related types
 */

// SSE event types
export enum SSEEventType {
  MOTION_DETECTED = 'motion_detected',
  AI_ANALYSIS = 'ai_analysis',
  CONNECTION_STATUS = 'connection_status',
  ERROR = 'error',
  HEARTBEAT = 'heartbeat'
}

// SSE message structure
export interface SSEMessage<T = any> {
  event: SSEEventType;
  data: T;
  id?: string;
  retry?: number;
}

// AI Analysis result from SSE
export interface AIAnalysis {
  description: string;
  processing_time: number;
  timestamp: string;
  confidence?: number;
  motion_event_id?: number;
}

// Connection status
export interface ConnectionStatus {
  connected: boolean;
  connectionState: 'connecting' | 'connected' | 'disconnected' | 'error';
  lastConnected?: string;
  reconnectAttempts?: number;
}

// SSE connection options
export interface SSEConnectionOptions {
  url: string;
  autoConnect?: boolean;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
  heartbeatInterval?: number;
}