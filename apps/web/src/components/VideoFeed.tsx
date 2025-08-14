import React, { useRef, useEffect, useState, useCallback } from 'react';
import { useMotionDetection } from '../hooks/useMotionDetection';
import { useSSE, AIAnalysis } from '../hooks/useSSE';
import { MotionDetectionState } from '../types';
import { AIAnalysisOverlay } from './AIAnalysisOverlay';
import { AIAnalysisLoading } from './AIAnalysisLoading';
import styles from './VideoFeed.module.css';

interface VideoFeedProps {
  isActive: boolean;
  onError: (error: string) => void;
  onStreamReady: (stream: MediaStream) => void;
  sensitivity: number;
  onMotionStateChange?: (motionState: MotionDetectionState) => void;
  cameraFacing?: 'user' | 'environment';
  onCameraFacingChange?: (facing: 'user' | 'environment') => void;
}

export const VideoFeed: React.FC<VideoFeedProps> = ({
  isActive,
  onError,
  onStreamReady,
  sensitivity,
  onMotionStateChange,
  cameraFacing = 'user',
  onCameraFacingChange,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [hasMultipleCameras, setHasMultipleCameras] = useState(false);
  const [currentAnalysis, setCurrentAnalysis] = useState<AIAnalysis | null>(null);
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisStartTime, setAnalysisStartTime] = useState<number | null>(null);

  // SSE hook to receive AI analysis updates
  useSSE({
    autoConnect: true,
    onAIAnalysis: useCallback((analysis: AIAnalysis) => {
      setCurrentAnalysis(analysis);
      setShowAnalysis(true);
      setIsAnalyzing(false);
      setAnalysisStartTime(null);
    }, [])
  });


  // Get available cameras
  const getAvailableCameras = useCallback(async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const cameras = devices.filter(device => device.kind === 'videoinput');
      setHasMultipleCameras(cameras.length > 1);
    } catch (error) {
      console.warn('Could not enumerate devices:', error);
    }
  }, []);

  // Handle analysis start
  const handleAnalysisStart = useCallback(() => {
    setIsAnalyzing(true);
    setAnalysisStartTime(Date.now());
  }, []);

  // Motion detection integration
  const { motionState } = useMotionDetection({
    videoElement: videoRef.current,
    isActive: isActive && hasPermission === true,
    sensitivity,
    detectionInterval: 150, // Check every 150ms for good performance
    onAnalysisStart: handleAnalysisStart
  });

  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        track.stop();
      });
      streamRef.current = null;
    }
    
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  const startStream = useCallback(async () => {
    try {
      setIsLoading(true);
      setHasPermission(null);

      // Check if getUserMedia is available
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('HTTPS_REQUIRED');
      }

      // Let browser negotiate best constraints for the device
      const constraints: MediaStreamConstraints = {
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: cameraFacing,
          frameRate: { ideal: 30 },
        },
        audio: false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      
      setHasPermission(true);
      onStreamReady(stream);
    } catch (error) {
      console.error('Error accessing camera:', error);
      setHasPermission(false);
      
      let errorMessage = 'Failed to access camera';
      if (error instanceof Error) {
        if (error.name === 'NotAllowedError') {
          errorMessage = 'Camera access denied. Please grant camera permissions and try again.';
        } else if (error.name === 'NotFoundError') {
          errorMessage = 'No camera found. Please ensure your device has a working camera.';
        } else if (error.name === 'NotReadableError') {
          errorMessage = 'Camera is being used by another application. Please close other camera apps and try again.';
        } else if (error.name === 'OverconstrainedError') {
          errorMessage = 'Camera does not support the requested configuration. Try reducing quality settings.';
        } else if (error.message === 'HTTPS_REQUIRED') {
          errorMessage = '🔒 Camera access requires a secure connection (HTTPS). Please use HTTPS or accept the security warning.';
        } else {
          errorMessage = `Camera error: ${error.message}`;
        }
      }
      
      onError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [onError, onStreamReady, cameraFacing]);

  // Get available cameras on component mount
  useEffect(() => {
    getAvailableCameras();
  }, [getAvailableCameras]);

  useEffect(() => {
    if (isActive) {
      startStream();
    } else {
      stopStream();
      setHasPermission(null);
    }

    return () => {
      stopStream();
    };
  }, [isActive, startStream, stopStream]);

  // Handle camera switch
  const handleCameraSwitch = useCallback(() => {
    if (onCameraFacingChange) {
      const newFacing = cameraFacing === 'user' ? 'environment' : 'user';
      onCameraFacingChange(newFacing);
    }
  }, [cameraFacing, onCameraFacingChange]);

  // Notify parent about motion state changes
  useEffect(() => {
    if (onMotionStateChange) {
      onMotionStateChange(motionState);
    }
  }, [motionState, onMotionStateChange]);

  const handleRetry = () => {
    if (isActive) {
      startStream();
    }
  };

  const handleDismissAnalysis = useCallback(() => {
    setShowAnalysis(false);
  }, []);

  return (
    <div className={styles.videoContainer}>
      <div className={`${styles.videoWrapper} ${motionState.motionStrength > 0 ? styles.motionDetected : ''}`}>
        <video
          ref={videoRef}
          className={styles.video}
          autoPlay
          muted
          playsInline
        />
        
        {isLoading && (
          <div className={styles.overlay}>
            <div className={styles.spinner}></div>
            <p className={styles.overlayText}>Accessing camera...</p>
          </div>
        )}
        
        {!isActive && !isLoading && (
          <div className={styles.overlay}>
            <div className={styles.cameraIcon}>📹</div>
            <p className={styles.overlayText}>Camera is off</p>
          </div>
        )}
        
        {hasPermission === false && (
          <div className={styles.overlay}>
            <div className={styles.errorIcon}>⚠️</div>
            <p className={styles.overlayText}>Camera access failed</p>
            <button 
              className={styles.retryButton}
              onClick={handleRetry}
            >
              Try Again
            </button>
          </div>
        )}

        {/* Camera Switch Button - Show when multiple cameras are available */}
        {hasMultipleCameras && isActive && hasPermission && (
          <button 
            className={styles.cameraSwitchButton}
            onClick={handleCameraSwitch}
            aria-label={`Switch to ${cameraFacing === 'user' ? 'back' : 'front'} camera`}
            title={`Switch to ${cameraFacing === 'user' ? 'back' : 'front'} camera`}
          >
            <svg 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="2"
              width="24" 
              height="24"
            >
              <path d="M9 12l2 2 4-4"/>
              <path d="M21 12c-1 0-3-1-3-3s2-3 3-3 3 1 3 3-2 3-3 3"/>
              <path d="M3 12c1 0 3-1 3-3s-2-3-3-3-3 1-3 3 2 3 3 3"/>
              <path d="M12 3v3M12 18v3"/>
            </svg>
            <span className={styles.cameraSwitchText}>
              {cameraFacing === 'user' ? '📷' : '📱'}
            </span>
          </button>
        )}

        {/* AI Analysis Loading Indicator */}
        <AIAnalysisLoading
          isVisible={isAnalyzing}
          analysisStartTime={analysisStartTime || undefined}
        />

        {/* AI Analysis Overlay */}
        <AIAnalysisOverlay
          analysis={currentAnalysis}
          isVisible={showAnalysis}
          onDismiss={handleDismissAnalysis}
          autoHideDelay={12000} // 12 seconds
        />
      </div>
      
      <div className={styles.videoInfo}>
        <span className={`${styles.status} ${isActive && hasPermission ? styles.active : ''}`}>
          {isActive && hasPermission ? 'Live' : 'Inactive'}
        </span>
        {hasMultipleCameras && (
          <span className={styles.cameraIndicator}>
            📷 {cameraFacing === 'user' ? 'Front' : 'Back'} Camera
          </span>
        )}
      </div>
    </div>
  );
};