import { useState, useEffect, useRef, useCallback } from 'react';
import { MotionDetectionState, MotionDetectionResult } from '../types';
import { motionDetectionService } from '../services/motionDetectionService';
import { api } from '../api';
import { ThrottledFrameCapture } from '../utils/frameCapture';
import { LLAVA_PROMPTS } from '../config/prompts';

interface UseMotionDetectionOptions {
  videoElement: HTMLVideoElement | null;
  isActive: boolean;
  sensitivity: number;
  detectionInterval?: number;
  onAnalysisStart?: () => void;
}

interface UseMotionDetectionReturn {
  motionState: MotionDetectionState;
  lastResult: MotionDetectionResult | null;
  startDetection: () => void;
  stopDetection: () => void;
  resetDetection: () => void;
}

/**
 * Custom hook for motion detection functionality
 * Integrates with video elements and provides real-time motion detection
 */
export function useMotionDetection({
  videoElement,
  isActive,
  sensitivity,
  detectionInterval = 100, // Check for motion every 100ms
  onAnalysisStart
}: UseMotionDetectionOptions): UseMotionDetectionReturn {
  
  // Adjust detection interval for mobile performance
  const [adaptiveInterval, setAdaptiveInterval] = useState(detectionInterval);
  
  useEffect(() => {
    const checkMobile = () => {
      const userAgent = navigator.userAgent.toLowerCase();
      const mobileKeywords = ['mobile', 'android', 'iphone', 'ipad', 'ipod', 'blackberry', 'windows phone'];
      const isMobileDevice = mobileKeywords.some(keyword => userAgent.includes(keyword));
      const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
      const isMobile = isMobileDevice || isTouchDevice;
      
      // Use longer intervals on mobile for better performance
      const adjustedInterval = isMobile ? Math.max(detectionInterval, 200) : detectionInterval;
      setAdaptiveInterval(adjustedInterval);
    };
    
    checkMobile();
  }, [detectionInterval]);
  
  const [motionState, setMotionState] = useState<MotionDetectionState>({
    isDetecting: false,
    motionStrength: 0,
    lastMotionTime: null,
    sensitivity
  });

  const [lastResult, setLastResult] = useState<MotionDetectionResult | null>(null);
  
  const intervalRef = useRef<number | null>(null);
  const isDetectingRef = useRef(false);
  const frameCapture = useRef(new ThrottledFrameCapture(8000)); // Capture every 8 seconds max

  // Update sensitivity in state when prop changes
  useEffect(() => {
    setMotionState(prev => ({
      ...prev,
      sensitivity
    }));
  }, [sensitivity]);

  const startDetection = useCallback(() => {
    if (!videoElement || isDetectingRef.current) return;

    isDetectingRef.current = true;
    setMotionState(prev => ({ ...prev, isDetecting: true }));

    intervalRef.current = setInterval(() => {
      if (!videoElement || videoElement.readyState < 2) {
        // Video not ready yet
        return;
      }

      try {
        const result = motionDetectionService.detectMotion(videoElement, sensitivity);
        setLastResult(result);

        setMotionState(prev => ({
          ...prev,
          motionStrength: result.motionStrength,
          lastMotionTime: result.hasMotion ? result.timestamp : prev.lastMotionTime,
          sensitivity
        }));

        // Send significant motion events to backend and trigger AI analysis
        if (result.hasMotion && result.motionStrength > 20) {
          // Send motion event to backend (fire and forget - SSE will handle updates)
          api.createMotionEvent({
            confidence: result.motionStrength / 100,
            duration: 1.0, // Approximate duration for single detection
            description: `Motion detected with ${result.motionStrength.toFixed(1)}% confidence`
          }).catch(error => {
            console.warn('Failed to send motion event to backend:', error);
          });

          // Capture LLaVA-optimized frame for AI analysis (throttled)
          const frameBase64 = frameCapture.current.captureIfReady(videoElement, result.motionStrength);
          if (frameBase64) {
            onAnalysisStart?.(); // Notify parent component that analysis is starting
            
            api.analyzeLLaVA({
              image_base64: frameBase64,
              prompt: LLAVA_PROMPTS.default
            }).then(response => {
              if (!response.success) {
                console.warn('AI Analysis failed:', response.error_message);
              }
            }).catch(error => {
              console.warn('Failed to get AI analysis:', error);
            });
          }
        }
      } catch (error) {
        console.error('Error during motion detection:', error);
      }
    }, adaptiveInterval);

  }, [videoElement, sensitivity, adaptiveInterval]);

  const stopDetection = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    
    isDetectingRef.current = false;
    setMotionState(prev => ({
      ...prev,
      isDetecting: false,
      motionStrength: 0
    }));
    setLastResult(null);
  }, []);

  const resetDetection = useCallback(() => {
    motionDetectionService.reset();
    setMotionState(prev => ({
      ...prev,
      motionStrength: 0,
      lastMotionTime: null
    }));
    setLastResult(null);
  }, []);

  // Auto start/stop detection based on isActive prop
  useEffect(() => {
    if (isActive && videoElement) {
      // Small delay to ensure video is ready
      const timeout = setTimeout(() => {
        startDetection();
      }, 500);
      
      return () => {
        clearTimeout(timeout);
        stopDetection();
      };
    } else {
      stopDetection();
    }
  }, [isActive, videoElement, startDetection, stopDetection]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopDetection();
    };
  }, [stopDetection]);

  return {
    motionState,
    lastResult,
    startDetection,
    stopDetection,
    resetDetection
  };
}