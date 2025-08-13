/**
 * Server-Sent Events service for AI analysis results
 * Provides one-way real-time communication from server to client
 */

import { AIAnalysisResult } from '../types';

export interface SSEEventHandlers {
  onAIAnalysis?: (analysis: AIAnalysisResult) => void;
  onError?: (error: any) => void;
  onConnect?: (connectionId: string) => void;
  onDisconnect?: () => void;
  onPing?: () => void;
}

/**
 * SSE Service for receiving AI analysis results
 * Much simpler than WebSocket - one-way server push only
 */
class SSEService {
  private eventSource: EventSource | null = null;
  private url: string;
  private handlers: SSEEventHandlers = {};
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private connectionId: string | null = null;

  constructor(url?: string) {
    if (url) {
      this.url = url;
    } else if (import.meta.env.VITE_API_URL && import.meta.env.VITE_API_URL.trim()) {
      // Use explicit environment variable if set
      const baseUrl = import.meta.env.VITE_API_URL.replace('/api/v1', '');
      this.url = `${baseUrl}/api/v1/ai/events`;
    } else {
      // Use Vite proxy for same-origin requests (best for HTTPS)
      this.url = '/api/v1/ai/events';
    }
    
    console.log('📡 SSE Service initialized with URL:', this.url);
  }

  /**
   * Set event handlers for SSE events
   */
  public setHandlers(handlers: SSEEventHandlers): void {
    this.handlers = { ...this.handlers, ...handlers };
  }

  /**
   * Connect to the SSE stream
   */
  public connect(): Promise<string> {
    return new Promise((resolve, reject) => {
      if (this.eventSource?.readyState === EventSource.OPEN) {
        resolve(this.connectionId || 'existing');
        return;
      }

      try {
        console.log('📡 Connecting to SSE:', this.url);
        this.eventSource = new EventSource(this.url);

        // Handle connection established
        this.eventSource.addEventListener('connected', (event) => {
          const data = JSON.parse(event.data);
          this.connectionId = data.connection_id;
          console.log('✅ SSE connected with ID:', this.connectionId);
          
          this.reconnectAttempts = 0;
          this.handlers.onConnect?.(this.connectionId || '');
          resolve(this.connectionId || '');
        });

        // Handle AI analysis results - this is the main event we care about
        this.eventSource.addEventListener('ai_analysis', (event) => {
          try {
            const eventData = JSON.parse(event.data);
            console.log('🤖 Received AI analysis via SSE:', eventData);
            
            // Extract the actual analysis data
            const analysisData = eventData.data || eventData;
            
            // Convert to our expected format
            const analysis: AIAnalysisResult = {
              id: analysisData.frame_id,
              frame_id: analysisData.frame_id,
              description: analysisData.description,
              confidence: analysisData.confidence,
              timestamp: analysisData.timestamp || new Date().toISOString(),
              processing_time: analysisData.processing_time
            };
            
            this.handlers.onAIAnalysis?.(analysis);
          } catch (error) {
            console.error('Error parsing AI analysis event:', error);
          }
        });

        // Handle ping events (keep-alive)
        this.eventSource.addEventListener('ping', () => {
          this.handlers.onPing?.();
        });

        // Handle errors
        this.eventSource.addEventListener('error', (event) => {
          try {
            const data = JSON.parse((event as any).data);
            console.error('SSE error event:', data);
            this.handlers.onError?.(data);
          } catch {
            // Generic error handling - don't parse
          }
        });

        // Handle connection errors
        this.eventSource.onerror = (_event) => {
          console.error('❌ SSE connection error');
          
          if (this.eventSource?.readyState === EventSource.CLOSED) {
            this.handlers.onDisconnect?.();
            this.scheduleReconnect();
          }
          
          if (this.reconnectAttempts === 0) {
            reject(new Error('SSE connection failed'));
          }
        };

        // Connection opened successfully
        this.eventSource.onopen = () => {
          console.log('📡 SSE connection opened, waiting for connected event...');
        };

      } catch (error) {
        console.error('Failed to create EventSource:', error);
        reject(error);
      }
    });
  }

  /**
   * Disconnect from the SSE stream
   */
  public disconnect(): void {
    this.reconnectAttempts = this.maxReconnectAttempts; // Prevent auto-reconnect
    
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
      this.connectionId = null;
      console.log('📡 SSE disconnected');
    }
  }

  /**
   * Check if SSE is connected
   */
  public isConnected(): boolean {
    return this.eventSource?.readyState === EventSource.OPEN;
  }

  /**
   * Get the current connection ID
   */
  public getConnectionId(): string | null {
    return this.connectionId;
  }

  /**
   * Schedule a reconnection attempt
   */
  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log('Max SSE reconnection attempts reached');
      return;
    }

    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts);
    console.log(`Scheduling SSE reconnect attempt ${this.reconnectAttempts + 1} in ${delay}ms`);
    
    setTimeout(() => {
      this.reconnectAttempts++;
      this.connect().catch(console.error);
    }, delay);
  }
}

// Export class and singleton instance
export { SSEService };
export const sseService = new SSEService();