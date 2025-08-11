import { WebSocketMessage, MotionEventForAI, AIAnalysisResult } from '../types';

export type WebSocketEventHandler = (data: any) => void;

export interface WebSocketEventHandlers {
  onAIAnalysis?: (analysis: AIAnalysisResult) => void;
  onError?: (error: any) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
}

/**
 * WebSocket service for LLaVA AI analysis communication
 * Handles sending motion events to backend and receiving AI analysis results
 */
export class WebSocketService {
  private ws: WebSocket | null = null;
  private url: string;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000; // Start with 1 second
  private isConnecting = false;
  private handlers: WebSocketEventHandlers = {};
  private pingInterval: number | null = null;

  constructor(url?: string) {
    if (url) {
      this.url = url;
    } else if (import.meta.env.VITE_WS_URL) {
      // Use explicit environment variable if set
      this.url = import.meta.env.VITE_WS_URL;
    } else {
      // Dynamic WebSocket URL based on current location
      // Note: Always use 'ws:' since our backend doesn't support WSS yet
      const host = window.location.hostname;
      const port = import.meta.env.VITE_API_PORT || '8000';
      this.url = `ws://${host}:${port}/ws`;
    }
    
    console.log('WebSocket connecting to:', this.url);
  }

  /**
   * Set event handlers for WebSocket events
   */
  public setHandlers(handlers: WebSocketEventHandlers): void {
    this.handlers = { ...this.handlers, ...handlers };
  }

  /**
   * Connect to the WebSocket server
   */
  public connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        resolve();
        return;
      }

      if (this.isConnecting) {
        reject(new Error('Connection already in progress'));
        return;
      }

      this.isConnecting = true;

      try {
        this.ws = new WebSocket(this.url);

        this.ws.onopen = () => {
          console.log('WebSocket connected to:', this.url);
          this.isConnecting = false;
          this.reconnectAttempts = 0;
          this.startPing();
          this.handlers.onConnect?.();
          resolve();
        };

        this.ws.onmessage = (event) => {
          this.handleMessage(event.data);
        };

        this.ws.onclose = (event) => {
          console.log('WebSocket disconnected:', event.code, event.reason);
          this.isConnecting = false;
          this.stopPing();
          this.handlers.onDisconnect?.();
          
          // Auto-reconnect if not a normal closure
          if (event.code !== 1000 && this.reconnectAttempts < this.maxReconnectAttempts) {
            this.scheduleReconnect();
          }
        };

        this.ws.onerror = (error) => {
          console.error('WebSocket error:', error);
          console.error('WebSocket URL was:', this.url);
          this.isConnecting = false;
          this.handlers.onError?.(error);
          reject(error);
        };

      } catch (error) {
        this.isConnecting = false;
        reject(error);
      }
    });
  }

  /**
   * Disconnect from the WebSocket server
   */
  public disconnect(): void {
    this.stopPing();
    this.reconnectAttempts = this.maxReconnectAttempts; // Prevent auto-reconnect
    
    if (this.ws) {
      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
    }
  }

  /**
   * Send motion event to backend for AI analysis
   */
  public sendMotionEvent(motionEvent: MotionEventForAI): void {
    if (!this.isConnected()) {
      console.warn('WebSocket not connected, cannot send motion event');
      return;
    }

    const message: WebSocketMessage = {
      type: 'motion_event',
      data: motionEvent,
      timestamp: new Date().toISOString()
    };

    this.sendMessage(message);
  }

  /**
   * Check if WebSocket is connected
   */
  public isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  /**
   * Handle incoming WebSocket messages
   */
  private handleMessage(rawMessage: string): void {
    try {
      const message: WebSocketMessage = JSON.parse(rawMessage);
      
      switch (message.type) {
        case 'ai_analysis':
          this.handlers.onAIAnalysis?.(message.data as AIAnalysisResult);
          break;
          
        case 'error':
          console.error('Server error:', message.data);
          this.handlers.onError?.(message.data);
          break;
          
        case 'pong':
          // Handle pong response (keep connection alive)
          break;
          
        default:
          console.log('Unknown message type:', message.type);
      }
    } catch (error) {
      console.error('Error parsing WebSocket message:', error);
      this.handlers.onError?.(error);
    }
  }

  /**
   * Send a message to the server
   */
  private sendMessage(message: WebSocketMessage): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }

  /**
   * Schedule a reconnection attempt
   */
  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log('Max reconnection attempts reached');
      return;
    }

    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts);
    console.log(`Scheduling reconnect attempt ${this.reconnectAttempts + 1} in ${delay}ms`);
    
    setTimeout(() => {
      this.reconnectAttempts++;
      this.connect().catch(console.error);
    }, delay);
  }

  /**
   * Start ping to keep connection alive
   */
  private startPing(): void {
    this.pingInterval = setInterval(() => {
      if (this.isConnected()) {
        const pingMessage: WebSocketMessage = {
          type: 'ping',
          data: {},
          timestamp: new Date().toISOString()
        };
        this.sendMessage(pingMessage);
      }
    }, 30000); // Ping every 30 seconds
  }

  /**
   * Stop ping interval
   */
  private stopPing(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }
}

// Export a singleton instance
export const websocketService = new WebSocketService();