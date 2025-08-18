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
      console.log('Video not ready for capture');
      return;
    }
    
    if (!customPrompt || !customPrompt.trim()) {
      console.log('No custom prompt provided, skipping capture');
      return;
    }
    
    try {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        console.error('Could not get canvas context');
        return;
      }
      
      // Draw current video frame to canvas
      ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
      
      // Convert to base64
      const base64 = canvas.toDataURL('image/jpeg', 0.7).replace(/^data:image\/\w+;base64,/, '');
      
      if (base64) {
        console.log(`Capturing frame #${captureCount + 1} for analysis with prompt: "${customPrompt}"`);
        
        // Update state
        setLastCaptureTime(Date.now());
        setCaptureCount(prev => prev + 1);
        
        // Notify UI that analysis is starting
        onAnalysisStart?.();
        
        // Send to AI for analysis
        const enhancedPrompt = `${customPrompt} Please provide a response that is exactly 120 characters long to match our animation timing.`;
        api.analyzeLLaVA({
          image_base64: base64,
          prompt: enhancedPrompt
        }).then(response => {
          console.log('AI analysis response:', response);
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
    if (intervalRef.current) {
      console.log('Capture already running');
      return;
    }
    
    console.log(`Starting periodic capture every ${intervalSeconds} seconds`);
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
    console.log('Stopped periodic capture');
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
  }, [isActive, videoElement, customPrompt, startCapture, stopCapture]);
  
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
    startCapture,
    stopCapture,
    resetCapture
  };
}