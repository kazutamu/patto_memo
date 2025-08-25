
export interface SSEEvent {
  type: 'ai_analysis' | 'connected' | 'heartbeat';
  data: any;
}

export interface SSEEventHandlers {
  onAIAnalysis?: (analysis: { description: string; detected?: 'YES' | 'NO' | null; processing_time: number; timestamp: string }) => void;
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

  constructor(private baseUrl?: string) {
    // Use the same API URL from environment variables
    if (!baseUrl) {
      this.baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';
    }
  }

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

      // Motion detection removed

      this.eventSource.addEventListener('ai_analysis', (event) => {
        const analysisData = JSON.parse(event.data);
        this.handlers.onAIAnalysis?.(analysisData);
      });

      this.eventSource.addEventListener('heartbeat', () => {
        console.debug('SSE heartbeat received');
        // Keep connection alive, no additional action needed
      });

      this.eventSource.onerror = (error) => {
        console.error('SSE connection error:', error);
        this.isConnected = false;
        
        // Don't attempt to reconnect if the backend is completely unreachable
        // This prevents endless reconnection attempts when backend is down
        if (this.eventSource?.readyState === EventSource.CLOSED) {
          console.log('SSE connection closed');
          
          // Only attempt reconnection if we haven't exceeded max attempts
          if (this.reconnectAttempts < this.maxReconnectAttempts) {
            console.log('Attempting to reconnect...');
            this.handleReconnection();
          } else {
            console.log('Backend appears to be down. Please check if the API server is running.');
            this.handlers.onClose?.();
          }
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