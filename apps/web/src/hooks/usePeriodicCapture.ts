import { useEffect, useRef, useCallback, useState } from 'react';
import { api } from '../api';

interface UsePeriodicCaptureOptions {
  videoElement: HTMLVideoElement | null;
  isActive: boolean;
  intervalSeconds?: number; // How often to capture frames
  customPrompt?: string;
  onAnalysisStart?: () => void;
}

interface UsePeriodicCaptureReturn {
  isCapturing: boolean;
  lastCaptureTime: number | null;
  captureCount: number;
  lastCapturedFrame: string | null;
  startCapture: () => void;
  stopCapture: () => void;
  resetCapture: () => void;
}

/**
 * Hook for periodic frame capture and analysis
 * Captures frames at regular intervals and sends them for AI analysis
 */
export function usePeriodicCapture({
  videoElement,
  isActive,
  intervalSeconds = 5, // Default: capture every 5 seconds
  customPrompt,
  onAnalysisStart
}: UsePeriodicCaptureOptions): UsePeriodicCaptureReturn {
  
  const [isCapturing, setIsCapturing] = useState(false);
  const [lastCaptureTime, setLastCaptureTime] = useState<number | null>(null);
  const [captureCount, setCaptureCount] = useState(0);
  const [lastCapturedFrame, setLastCapturedFrame] = useState<string | null>(null);
  
  const intervalRef = useRef<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  
  // Initialize canvas for frame capture
  useEffect(() => {
    if (!canvasRef.current) {
      canvasRef.current = document.createElement('canvas');
      canvasRef.current.width = 640;
      canvasRef.current.height = 480;
    }
  }, []);
  
  // Capture and analyze a single frame
  const captureFrame = useCallback(() => {
    if (!videoElement || !canvasRef.current || videoElement.readyState < 2) {
      return;
    }
    
    if (!customPrompt || !customPrompt.trim()) {
      return;
    }
    
    try {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        console.error('Could not get canvas context');
        return;
      }
      
      // Update canvas size to match video's natural dimensions to preserve aspect ratio
      const videoWidth = videoElement.videoWidth;
      const videoHeight = videoElement.videoHeight;
      
      if (videoWidth && videoHeight) {
        // Set canvas size to match video aspect ratio
        // Cap at reasonable size to avoid huge images
        const maxWidth = 1280;
        const maxHeight = 720;
        
        let targetWidth = videoWidth;
        let targetHeight = videoHeight;
        
        // Scale down if needed while preserving aspect ratio
        if (videoWidth > maxWidth || videoHeight > maxHeight) {
          const widthRatio = maxWidth / videoWidth;
          const heightRatio = maxHeight / videoHeight;
          const ratio = Math.min(widthRatio, heightRatio);
          
          targetWidth = Math.floor(videoWidth * ratio);
          targetHeight = Math.floor(videoHeight * ratio);
        }
        
        // Only update canvas size if it changed (to avoid unnecessary reallocation)
        if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
          canvas.width = targetWidth;
          canvas.height = targetHeight;
        }
      }
      
      // Draw current video frame to canvas (will use canvas's current dimensions)
      ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
      
      // Convert to base64
      const base64 = canvas.toDataURL('image/jpeg', 0.7).replace(/^data:image\/\w+;base64,/, '');
      
      if (base64) {
        // Update state
        setLastCaptureTime(Date.now());
        setCaptureCount(prev => prev + 1);
        setLastCapturedFrame(canvas.toDataURL('image/jpeg', 0.7));
        
        // Notify UI that analysis is starting
        onAnalysisStart?.();
        
        // Send to AI for analysis
        api.analyzeLLaVA({
          image_base64: base64,
          prompt: customPrompt
        }).catch(error => {
          console.error('AI analysis error:', error);
        });
      }
    } catch (error) {
      console.error('Error capturing frame:', error);
    }
  }, [videoElement, customPrompt, onAnalysisStart, captureCount]);
  
  // Start periodic capture
  const startCapture = useCallback(() => {
    // Stop any existing interval first
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    
    setIsCapturing(true);
    
    // Capture first frame immediately
    captureFrame();
    
    // Set up interval for periodic capture
    intervalRef.current = window.setInterval(() => {
      captureFrame();
    }, intervalSeconds * 1000);
    
  }, [captureFrame, intervalSeconds]);
  
  // Stop periodic capture
  const stopCapture = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    
    setIsCapturing(false);
  }, []);
  
  // Reset capture state
  const resetCapture = useCallback(() => {
    stopCapture();
    setLastCaptureTime(null);
    setCaptureCount(0);
  }, [stopCapture]);
  
  // Auto start/stop based on isActive prop
  useEffect(() => {
    if (isActive && videoElement && customPrompt) {
      // Small delay to ensure video is ready
      const timeout = setTimeout(() => {
        startCapture();
      }, 500);
      
      return () => {
        clearTimeout(timeout);
        stopCapture();
      };
    } else {
      stopCapture();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive, videoElement, customPrompt]);
  
  // Handle interval changes separately to avoid restarting capture
  useEffect(() => {
    if (isCapturing && intervalRef.current) {
      // Restart the interval with new timing
      clearInterval(intervalRef.current);
      intervalRef.current = window.setInterval(() => {
        captureFrame();
      }, intervalSeconds * 1000);
    }
  }, [intervalSeconds, isCapturing, captureFrame]);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopCapture();
    };
  }, [stopCapture]);
  
  return {
    isCapturing,
    lastCaptureTime,
    captureCount,
    lastCapturedFrame,
    startCapture,
    stopCapture,
    resetCapture
  };
}