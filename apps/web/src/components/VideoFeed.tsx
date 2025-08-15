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
  
  // Consolidated state
  const [videoState, setVideoState] = useState({
    isLoading: false,
    hasPermission: null as boolean | null,
    hasMultipleCameras: false
  });
  
  const [analysisState, setAnalysisState] = useState({
    current: null as AIAnalysis | null,
    isAnalyzing: false,
    startTime: null as number | null
  });

  // SSE hook to receive AI analysis updates
  useSSE({
    autoConnect: true,
    onAIAnalysis: useCallback((analysis: AIAnalysis) => {
      setAnalysisState({
        current: analysis,
        isAnalyzing: false,
        startTime: null
      });
    }, [])
  });


  // Get available cameras
  const getAvailableCameras = useCallback(async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const cameras = devices.filter(device => device.kind === 'videoinput');
      setVideoState(prev => ({ ...prev, hasMultipleCameras: cameras.length > 1 }));
    } catch (error) {
      console.warn('Could not enumerate devices:', error);
    }
  }, []);

  // Handle analysis start
  const handleAnalysisStart = useCallback(() => {
    setAnalysisState(prev => ({
      ...prev,
      isAnalyzing: true,
      startTime: Date.now()
    }));
  }, []);

  // Motion detection integration
  const { motionState } = useMotionDetection({
    videoElement: videoRef.current,
    isActive: isActive && videoState.hasPermission === true,
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
      setVideoState(prev => ({ 
        ...prev, 
        isLoading: true,
        hasPermission: null 
      }));

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
      
      setVideoState(prev => ({ ...prev, hasPermission: true }));
      onStreamReady(stream);
    } catch (error) {
      console.error('Error accessing camera:', error);
      
      // Don't show error for AbortError - this happens when component unmounts
      if (error instanceof Error && error.name === 'AbortError') {
        console.log('Camera initialization was aborted (this is normal during cleanup)');
        return;
      }
      
      setVideoState(prev => ({ ...prev, hasPermission: false }));
      
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
      setVideoState(prev => ({ ...prev, isLoading: false }));
    }
  }, [onError, onStreamReady, cameraFacing]);

  // Get available cameras on component mount
  useEffect(() => {
    getAvailableCameras();
  }, [getAvailableCameras]);

  useEffect(() => {
    let mounted = true;
    
    const initCamera = async () => {
      if (isActive && mounted) {
        await startStream();
      } else if (!isActive && mounted) {
        stopStream();
        setVideoState(prev => ({ ...prev, hasPermission: null }));
      }
    };
    
    initCamera();

    return () => {
      mounted = false;
      stopStream();
    };
  }, [isActive]); // Remove startStream and stopStream from deps to avoid loops

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
        
        {videoState.isLoading && (
          <div className={styles.overlay}>
            <div className={styles.spinner}></div>
            <p className={styles.overlayText}>Accessing camera...</p>
          </div>
        )}
        
        {!isActive && !videoState.isLoading && (
          <div className={styles.overlay}>
            <div className={styles.cameraIcon}>📹</div>
            <p className={styles.overlayText}>Camera is off</p>
          </div>
        )}
        
        {videoState.hasPermission === false && (
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
        {videoState.hasMultipleCameras && isActive && videoState.hasPermission && (
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
          isVisible={analysisState.isAnalyzing}
          analysisStartTime={analysisState.startTime || undefined}
        />

        {/* AI Analysis Overlay - Persistent */}
        <AIAnalysisOverlay
          analysis={analysisState.current}
          isPersistent={true}
        />
      </div>
      
      <div className={styles.videoInfo}>
        <span className={`${styles.status} ${isActive && videoState.hasPermission ? styles.active : ''}`}>
          {isActive && videoState.hasPermission ? 'Live' : 'Inactive'}
        </span>
        {videoState.hasMultipleCameras && (
          <span className={styles.cameraIndicator}>
            📷 {cameraFacing === 'user' ? 'Front' : 'Back'} Camera
          </span>
        )}
      </div>
    </div>
  );
};