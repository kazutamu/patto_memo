import { useState, useEffect, useCallback, useRef } from 'react';
import { websocketService, WebSocketEventHandlers } from '../services';
import { motionDetectionService } from '../services';
import { AIAnalysisResult, MotionEventForAI } from '../types';

interface UseAIAnalysisOptions {
  videoElement: HTMLVideoElement | null;
  isActive: boolean;
  significanceThreshold?: number; // Motion strength threshold to trigger AI analysis
  analysisRateLimit?: number; // Max AI requests per minute
  frameQuality?: number; // JPEG quality for frames (0.1-1.0)
}

interface UseAIAnalysisReturn {
  analysis: AIAnalysisResult | null;
  isConnected: boolean;
  isAnalyzing: boolean;
  requestAnalysis: (motionStrength: number) => void;
  clearAnalysis: () => void;
  reconnect: () => void;
}

/**
 * Custom hook for AI analysis integration with LLaVA
 * Manages WebSocket connection and triggers analysis for significant motion events
 */
export function useAIAnalysis({
  videoElement,
  isActive,
  significanceThreshold = 30, // Only analyze motion above 30% strength
  analysisRateLimit = 10, // Max 10 requests per minute
  frameQuality = 0.7
}: UseAIAnalysisOptions): UseAIAnalysisReturn {
  
  const [analysis, setAnalysis] = useState<AIAnalysisResult | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  
  // Rate limiting state
  const requestHistory = useRef<number[]>([]);
  const lastAnalysisTime = useRef<number>(0);

  // WebSocket event handlers
  const eventHandlers: WebSocketEventHandlers = {
    onConnect: () => {
      console.log('AI Analysis WebSocket connected');
      setIsConnected(true);
    },
    
    onDisconnect: () => {
      console.log('AI Analysis WebSocket disconnected');
      setIsConnected(false);
      setIsAnalyzing(false);
    },
    
    onAIAnalysis: (analysisResult: AIAnalysisResult) => {
      console.log('Received AI analysis:', analysisResult);
      setAnalysis(analysisResult);
      setIsAnalyzing(false);
    },
    
    onError: (error: any) => {
      console.error('AI Analysis error:', error);
      setIsAnalyzing(false);
    }
  };

  // Initialize WebSocket connection
  useEffect(() => {
    if (isActive) {
      websocketService.setHandlers(eventHandlers);
      websocketService.connect().catch(console.error);
    }

    return () => {
      if (!isActive) {
        websocketService.disconnect();
      }
    };
  }, [isActive]);

  // Rate limiting check
  const canMakeRequest = useCallback((): boolean => {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    
    // Clean old requests from history
    requestHistory.current = requestHistory.current.filter(time => time > oneMinuteAgo);
    
    // Check if we've exceeded the rate limit
    if (requestHistory.current.length >= analysisRateLimit) {
      console.log('AI analysis rate limit reached');
      return false;
    }
    
    // Check if minimum time has passed since last analysis
    const minInterval = 5000; // At least 5 seconds between analyses
    if (now - lastAnalysisTime.current < minInterval) {
      console.log('AI analysis too soon after last request');
      return false;
    }
    
    return true;
  }, [analysisRateLimit]);

  // Request AI analysis for current frame
  const requestAnalysis = useCallback((motionStrength: number) => {
    if (!videoElement || !isConnected || isAnalyzing) {
      return;
    }

    // Check significance threshold
    if (motionStrength < significanceThreshold) {
      console.log(`Motion strength ${motionStrength}% below significance threshold ${significanceThreshold}%`);
      return;
    }

    // Check rate limiting
    if (!canMakeRequest()) {
      return;
    }

    try {
      // Capture frame for AI analysis
      const frameData = motionDetectionService.captureFrame(videoElement, frameQuality);
      if (!frameData) {
        console.error('Failed to capture frame for AI analysis');
        return;
      }

      // Generate unique frame ID
      const frameId = `frame_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const motionEvent: MotionEventForAI = {
        frame_data: frameData,
        timestamp: new Date().toISOString(),
        motion_strength: motionStrength,
        frame_id: frameId
      };

      // Send to backend for analysis
      websocketService.sendMotionEvent(motionEvent);
      
      // Update rate limiting
      requestHistory.current.push(Date.now());
      lastAnalysisTime.current = Date.now();
      setIsAnalyzing(true);

      console.log(`Sent frame for AI analysis - Motion: ${motionStrength.toFixed(1)}%, Frame ID: ${frameId}`);

    } catch (error) {
      console.error('Error requesting AI analysis:', error);
      setIsAnalyzing(false);
    }
  }, [videoElement, isConnected, isAnalyzing, significanceThreshold, frameQuality, canMakeRequest]);

  // Clear current analysis
  const clearAnalysis = useCallback(() => {
    setAnalysis(null);
  }, []);

  // Manually reconnect WebSocket
  const reconnect = useCallback(() => {
    websocketService.disconnect();
    setTimeout(() => {
      websocketService.connect().catch(console.error);
    }, 1000);
  }, []);

  return {
    analysis,
    isConnected,
    isAnalyzing,
    requestAnalysis,
    clearAnalysis,
    reconnect
  };
}