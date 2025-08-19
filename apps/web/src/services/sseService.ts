import { MotionEvent } from '../types';

export interface SSEEvent {
  type: 'motion_detected' | 'ai_analysis' | 'connected' | 'heartbeat';
  data: any;
}

export interface SSEEventHandlers {
  onMotionDetected?: (event: MotionEvent) => void;
  onAIAnalysis?: (analysis: { description: string; detected?: string | null; processing_time: number; timestamp: string }) => void;
  onConnected?: (data: { client_id: string; timestamp: string }) => void;
  onError?: (error: Event) => void;
  onClose?: () => void;
}

/**
 * Server-Sent Events service for real-time communication with the backend
 * Replaces WebSocket functionality with simpler SSE implementation
 */
export class SSEService {
  private eventSource: EventSource | null = null;
  private isConnected: boolean = false;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private reconnectDelay: number = 1000;
  private handlers: SSEEventHandlers = {};

  constructor(private baseUrl: string = '/api/v1') {}

  /**
   * Connect to the SSE stream
   */
  public connect(handlers: SSEEventHandlers): void {
    if (this.isConnected && this.eventSource) {
      console.warn('SSE already connected');
      return;
    }

    this.handlers = handlers;
    this.createConnection();
  }

  /**
   * Create a new SSE connection
   */
  private createConnection(): void {
    try {
      const url = `${this.baseUrl}/events/stream`;
      this.eventSource = new EventSource(url);

      this.eventSource.onopen = () => {
        console.log('SSE connection established');
        this.isConnected = true;
        this.reconnectAttempts = 0;
      };

      // Handle specific event types
      this.eventSource.addEventListener('connected', (event) => {
        const data = JSON.parse(event.data);
        console.log('SSE connected:', data);
        this.handlers.onConnected?.(data);
      });

      this.eventSource.addEventListener('motion_detected', (event) => {
        const motionData = JSON.parse(event.data);
        console.log('Motion detected via SSE:', motionData);
        this.handlers.onMotionDetected?.(motionData);
      });

      this.eventSource.addEventListener('ai_analysis', (event) => {
        const analysisData = JSON.parse(event.data);
        console.log('AI analysis received via SSE:', analysisData);
        this.handlers.onAIAnalysis?.(analysisData);
      });

      this.eventSource.addEventListener('heartbeat', (event) => {
        const heartbeatData = JSON.parse(event.data);
        console.debug('SSE heartbeat:', heartbeatData);
        // Keep connection alive, no additional action needed
      });

      this.eventSource.onerror = (error) => {
        console.error('SSE connection error:', error);
        this.isConnected = false;
        
        if (this.eventSource?.readyState === EventSource.CLOSED) {
          console.log('SSE connection closed, attempting to reconnect...');
          this.handleReconnection();
        }
        
        this.handlers.onError?.(error);
      };

    } catch (error) {
      console.error('Failed to create SSE connection:', error);
      this.handleReconnection();
    }
  }

  /**
   * Handle reconnection logic with exponential backoff
   */
  private handleReconnection(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached');
      this.handlers.onClose?.();
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
    
    console.log(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
    
    setTimeout(() => {
      this.disconnect();
      this.createConnection();
    }, delay);
  }

  /**
   * Disconnect from SSE stream
   */
  public disconnect(): void {
    if (this.eventSource) {
      console.log('Disconnecting SSE');
      this.eventSource.close();
      this.eventSource = null;
    }
    
    this.isConnected = false;
    this.reconnectAttempts = 0;
  }

  /**
   * Check if SSE is currently connected
   */
  public get connected(): boolean {
    return this.isConnected && this.eventSource?.readyState === EventSource.OPEN;
  }

  /**
   * Get connection state
   */
  public getConnectionState(): 'connecting' | 'open' | 'closed' {
    if (!this.eventSource) return 'closed';
    
    switch (this.eventSource.readyState) {
      case EventSource.CONNECTING:
        return 'connecting';
      case EventSource.OPEN:
        return 'open';
      case EventSource.CLOSED:
        return 'closed';
      default:
        return 'closed';
    }
  }
}

// Export a singleton instance
export const sseService = new SSEService();