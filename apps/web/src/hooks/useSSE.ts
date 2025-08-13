import { useEffect, useRef, useState, useCallback } from 'react';
import { SSEService, SSEEventHandlers } from '../services/sseService';
import { MotionEvent } from '../types';

export interface AIAnalysis {
  description: string;
  processing_time: number;
  timestamp: string;
}

export interface UseSSEOptions {
  autoConnect?: boolean;
  onMotionDetected?: (event: MotionEvent) => void;
  onAIAnalysis?: (analysis: AIAnalysis) => void;
}

export interface UseSSEReturn {
  isConnected: boolean;
  connectionState: 'connecting' | 'open' | 'closed';
  lastMotionEvent: MotionEvent | null;
  lastAIAnalysis: AIAnalysis | null;
  connect: () => void;
  disconnect: () => void;
  error: string | null;
}

/**
 * Custom hook for managing SSE connections and handling real-time events
 */
export function useSSE({
  autoConnect = true,
  onMotionDetected,
  onAIAnalysis
}: UseSSEOptions = {}): UseSSEReturn {
  const [isConnected, setIsConnected] = useState(false);
  const [connectionState, setConnectionState] = useState<'connecting' | 'open' | 'closed'>('closed');
  const [lastMotionEvent, setLastMotionEvent] = useState<MotionEvent | null>(null);
  const [lastAIAnalysis, setLastAIAnalysis] = useState<AIAnalysis | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const sseServiceRef = useRef<SSEService | null>(null);

  // Create SSE service instance if not exists
  useEffect(() => {
    if (!sseServiceRef.current) {
      sseServiceRef.current = new SSEService();
    }
  }, []);

  // Monitor connection state periodically
  useEffect(() => {
    if (!sseServiceRef.current) return;

    const interval = setInterval(() => {
      const currentState = sseServiceRef.current!.getConnectionState();
      setConnectionState(currentState);
      setIsConnected(sseServiceRef.current!.connected);
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const connect = useCallback(() => {
    if (!sseServiceRef.current) return;

    const handlers: SSEEventHandlers = {
      onMotionDetected: (event: MotionEvent) => {
        setLastMotionEvent(event);
        setError(null);
        onMotionDetected?.(event);
      },

      onAIAnalysis: (analysis: AIAnalysis) => {
        setLastAIAnalysis(analysis);
        setError(null);
        onAIAnalysis?.(analysis);
      },

      onConnected: (data) => {
        console.log('SSE connected with client ID:', data.client_id);
        setIsConnected(true);
        setError(null);
      },

      onError: (event) => {
        console.error('SSE connection error:', event);
        setError('Connection error occurred');
        setIsConnected(false);
      },

      onClose: () => {
        console.log('SSE connection closed');
        setIsConnected(false);
        setError('Connection closed after max retry attempts');
      }
    };

    sseServiceRef.current.connect(handlers);
  }, [onMotionDetected, onAIAnalysis]);

  const disconnect = useCallback(() => {
    if (sseServiceRef.current) {
      sseServiceRef.current.disconnect();
      setIsConnected(false);
      setConnectionState('closed');
      setError(null);
    }
  }, []);

  // Auto-connect if enabled
  useEffect(() => {
    if (autoConnect) {
      connect();
    }

    // Cleanup on unmount
    return () => {
      disconnect();
    };
  }, [autoConnect, connect, disconnect]);

  return {
    isConnected,
    connectionState,
    lastMotionEvent,
    lastAIAnalysis,
    connect,
    disconnect,
    error
  };
}