import { useState, useEffect, useCallback, useRef } from 'react';
import { sseService, SSEEventHandlers } from '../services/sseService';
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
 * Custom hook for AI analysis using Server-Sent Events (SSE)
 * Much simpler than WebSocket/polling - just HTTP POST + SSE for results
 */
export function useAIAnalysis({
  videoElement,
  isActive,
  significanceThreshold = 2, // Low threshold for testing
  analysisRateLimit = 10, // Max 10 requests per minute
  frameQuality = 0.7
}: UseAIAnalysisOptions): UseAIAnalysisReturn {
  
  const [analysis, setAnalysis] = useState<AIAnalysisResult | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  
  // Rate limiting state
  const requestHistory = useRef<number[]>([]);
  const lastAnalysisTime = useRef<number>(0);
  const analysisTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pendingFrames = useRef<Set<string>>(new Set());
  
  // SSE event handlers
  const eventHandlers: SSEEventHandlers = {
    onConnect: (connectionId: string) => {
      console.log('✅ AI Analysis SSE connected:', connectionId);
      setIsConnected(true);
    },
    
    onDisconnect: () => {
      console.log('❌ AI Analysis SSE disconnected');
      setIsConnected(false);
      setIsAnalyzing(false);
    },
    
    onAIAnalysis: (analysisResult: AIAnalysisResult) => {
      console.log('🤖 Received AI analysis:', analysisResult);
      
      // Check if this is one of our pending frames
      if (analysisResult.frame_id && pendingFrames.current.has(analysisResult.frame_id)) {
        pendingFrames.current.delete(analysisResult.frame_id);
        setAnalysis(analysisResult);
        setIsAnalyzing(pendingFrames.current.size > 0);
        
        // Clear timeout since we got a response
        if (analysisTimeoutRef.current && pendingFrames.current.size === 0) {
          clearTimeout(analysisTimeoutRef.current);
          analysisTimeoutRef.current = null;
        }
      }
    },
    
    onError: (error: any) => {
      console.error('SSE error:', error);
      setIsAnalyzing(false);
    },
    
    onPing: () => {
      // Keep-alive ping received
    }
  };

  // Initialize SSE connection
  useEffect(() => {
    if (isActive) {
      console.log('📡 Initializing SSE connection for AI analysis');
      sseService.setHandlers(eventHandlers);
      sseService.connect()
        .then((connectionId) => {
          console.log('✅ SSE connected successfully:', connectionId);
        })
        .catch((error) => {
          console.error('❌ SSE connection failed:', error);
          // For HTTPS pages trying to connect to HTTP SSE, show a warning
          if (window.location.protocol === 'https:') {
            console.warn('⚠️ You are on HTTPS but SSE is using HTTP. This may be blocked by browser security.');
            console.warn('💡 Try accessing the app via HTTP instead: http://' + window.location.host);
          }
        });
    }

    return () => {
      if (!isActive) {
        sseService.disconnect();
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
    console.log(`📸 Request analysis - Motion: ${motionStrength}%, Connected: ${isConnected}`);
    
    if (!videoElement || !isConnected) {
      console.log(`Skipping - Video: ${!!videoElement}, Connected: ${isConnected}`);
      return;
    }

    // Check significance threshold
    if (motionStrength < significanceThreshold) {
      console.log(`Motion ${motionStrength}% below threshold ${significanceThreshold}%`);
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

      // Update rate limiting
      requestHistory.current.push(Date.now());
      lastAnalysisTime.current = Date.now();
      pendingFrames.current.add(frameId);
      setIsAnalyzing(true);
      
      // Set timeout to clear analyzing state if no response after 30 seconds
      if (analysisTimeoutRef.current) {
        clearTimeout(analysisTimeoutRef.current);
      }
      analysisTimeoutRef.current = setTimeout(() => {
        console.error('Analysis timeout - clearing analyzing state');
        pendingFrames.current.clear();
        setIsAnalyzing(false);
      }, 30000);

      // Send frame via HTTP POST - results will come via SSE
      console.log(`📤 Sending frame for analysis - ID: ${frameId}, Motion: ${motionStrength.toFixed(1)}%`);
      
      // Use Vite proxy (relative URL) or environment variable
      const apiUrl = import.meta.env.VITE_API_URL || '/api/v1';
      
      fetch(`${apiUrl}/ai/analyze-frame`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          frame_id: frameId,
          frame_data: frameData,
          motion_strength: motionStrength,
          timestamp: new Date().toISOString(),
          client_type: 'sse'
        })
      }).then(response => {
        if (!response.ok) {
          console.error('Failed to submit frame:', response.status);
          pendingFrames.current.delete(frameId);
          setIsAnalyzing(pendingFrames.current.size > 0);
        } else {
          console.log('✅ Frame submitted successfully, waiting for SSE result...');
        }
      }).catch(error => {
        console.error('Error submitting frame:', error);
        pendingFrames.current.delete(frameId);
        setIsAnalyzing(pendingFrames.current.size > 0);
      });

    } catch (error) {
      console.error('Error requesting AI analysis:', error);
      setIsAnalyzing(false);
    }
  }, [videoElement, isConnected, significanceThreshold, frameQuality, canMakeRequest]);

  // Clear current analysis
  const clearAnalysis = useCallback(() => {
    setAnalysis(null);
  }, []);

  // Manually reconnect SSE
  const reconnect = useCallback(() => {
    sseService.disconnect();
    setTimeout(() => {
      sseService.connect().catch(console.error);
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