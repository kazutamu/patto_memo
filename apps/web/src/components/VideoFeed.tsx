import React, { useRef, useEffect, useState, useCallback } from 'react';
import { useMotionDetection } from '../hooks/useMotionDetection';
import { MotionDetectionState } from '../types';
import styles from './VideoFeed.module.css';

interface VideoFeedProps {
  isActive: boolean;
  onError: (error: string) => void;
  onStreamReady: (stream: MediaStream) => void;
  sensitivity: number;
  onMotionStateChange?: (motionState: MotionDetectionState) => void;
  onVideoElementReady?: (videoElement: HTMLVideoElement | null) => void;
  cameraFacing?: 'user' | 'environment';
  onCameraFacingChange?: (facing: 'user' | 'environment') => void;
}

export const VideoFeed: React.FC<VideoFeedProps> = ({
  isActive,
  onError,
  onStreamReady,
  sensitivity,
  onMotionStateChange,
  onVideoElementReady,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);

  // Motion detection integration
  const { motionState } = useMotionDetection({
    videoElement: videoRef.current,
    isActive: isActive && hasPermission === true,
    sensitivity,
    detectionInterval: 150 // Check every 150ms for good performance
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

      const constraints: MediaStreamConstraints = {
        video: {
          width: { ideal: 1280, max: 1920 },
          height: { ideal: 720, max: 1080 },
          facingMode: 'user',
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
          errorMessage = 'No camera found. Please connect a camera and try again.';
        } else if (error.name === 'NotReadableError') {
          errorMessage = 'Camera is being used by another application.';
        } else if (error.name === 'OverconstrainedError') {
          errorMessage = 'Camera does not support the requested configuration.';
        } else {
          errorMessage = `Camera error: ${error.message}`;
        }
      }
      
      onError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [onError, onStreamReady]);

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

  // Notify parent about motion state changes
  useEffect(() => {
    if (onMotionStateChange) {
      onMotionStateChange(motionState);
    }
  }, [motionState, onMotionStateChange]);

  // Notify parent about video element readiness
  useEffect(() => {
    if (onVideoElementReady) {
      onVideoElementReady(videoRef.current);
    }
  }, [onVideoElementReady, hasPermission]);

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
      </div>
      
      <div className={styles.videoInfo}>
        <span className={`${styles.status} ${isActive && hasPermission ? styles.active : ''}`}>
          {isActive && hasPermission ? 'Live' : 'Inactive'}
        </span>
      </div>
    </div>
  );
};