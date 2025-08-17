import { useState, useEffect, useRef, useCallback } from 'react';
import { MotionDetectionState, MotionDetectionResult } from '../types';
import { motionDetectionService } from '../services/motionDetectionService';
import { api } from '../api';
import { frameCapture } from '../utils/frameCapture';

interface UseMotionDetectionOptions {
  videoElement: HTMLVideoElement | null;
  isActive: boolean;
  sensitivity: number;
  detectionInterval?: number;
  onAnalysisStart?: () => void;
  customPrompt?: string;
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
  onAnalysisStart,
  customPrompt
}: UseMotionDetectionOptions): UseMotionDetectionReturn {
  
  const [motionState, setMotionState] = useState<MotionDetectionState>({
    isDetecting: false,
    motionStrength: 0,
    lastMotionTime: null,
    sensitivity
  });

  const [lastResult, setLastResult] = useState<MotionDetectionResult | null>(null);
  
  const intervalRef = useRef<number | null>(null);
  const isDetectingRef = useRef(false);

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

        // Send significant motion events to backend
        if (result.hasMotion && result.motionStrength > 20) {
          // Send motion event
          api.createMotionEvent({
            confidence: result.motionStrength / 100,
            duration: 1.0,
            description: `Motion detected: ${result.motionStrength.toFixed(0)}%`
          }).catch(console.warn);

          // Capture frame for AI analysis (throttled) - only if user provided a prompt
          if (customPrompt && customPrompt.trim()) {
            const frameBase64 = frameCapture.capture(videoElement);
            if (frameBase64) {
              // Only start loading animation if we actually have a frame to analyze
              onAnalysisStart?.();
              
              api.analyzeLLaVA({
                image_base64: frameBase64,
                prompt: customPrompt
              }).catch(console.warn);
            }
          }
        }
      } catch (error) {
        console.error('Error during motion detection:', error);
      }
    }, detectionInterval);

  }, [videoElement, sensitivity, detectionInterval, onAnalysisStart, customPrompt]);

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