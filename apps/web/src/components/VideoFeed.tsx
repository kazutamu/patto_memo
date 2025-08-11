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
  const [availableCameras, setAvailableCameras] = useState<MediaDeviceInfo[]>([]);
  const [isMobile, setIsMobile] = useState(false);
  const [browserInfo, setBrowserInfo] = useState<{name: string, isMobileCompatible: boolean}>({name: '', isMobileCompatible: true});

  // Detect if device is mobile and browser compatibility
  useEffect(() => {
    const checkMobileAndBrowser = () => {
      const userAgent = navigator.userAgent.toLowerCase();
      const mobileKeywords = ['mobile', 'android', 'iphone', 'ipad', 'ipod', 'blackberry', 'windows phone'];
      const isMobileDevice = mobileKeywords.some(keyword => userAgent.includes(keyword));
      const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
      const mobile = isMobileDevice || isTouchDevice;
      setIsMobile(mobile);
      
      // Detect browser for mobile compatibility guidance
      if (mobile) {
        let browserName = 'Unknown';
        let isCompatible = true;
        
        if (userAgent.includes('firefox')) {
          browserName = 'Firefox';
          isCompatible = true; // Firefox is most compatible
        } else if (userAgent.includes('chrome') && !userAgent.includes('edg')) {
          browserName = 'Chrome';
          isCompatible = false; // Chrome mobile has strict SSL requirements
        } else if (userAgent.includes('safari') && !userAgent.includes('chrome')) {
          browserName = 'Safari';
          isCompatible = false; // Safari iOS has strict SSL requirements
        } else if (userAgent.includes('edg')) {
          browserName = 'Edge';
          isCompatible = false;
        }
        
        setBrowserInfo({ name: browserName, isMobileCompatible: isCompatible });
      }
    };
    
    checkMobileAndBrowser();
    window.addEventListener('resize', checkMobileAndBrowser);
    return () => window.removeEventListener('resize', checkMobileAndBrowser);
  }, []);

  // Get available cameras
  const getAvailableCameras = useCallback(async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const cameras = devices.filter(device => device.kind === 'videoinput');
      setAvailableCameras(cameras);
    } catch (error) {
      console.warn('Could not enumerate devices:', error);
    }
  }, []);

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

      // Check if getUserMedia is available
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('HTTPS_REQUIRED');
      }

      // Mobile-optimized constraints
      const constraints: MediaStreamConstraints = {
        video: isMobile ? {
          width: { ideal: 640, max: 1280 },
          height: { ideal: 480, max: 720 },
          facingMode: cameraFacing,
          frameRate: { ideal: 15, max: 30 }, // Lower frame rate for mobile performance
        } : {
          width: { ideal: 1280, max: 1920 },
          height: { ideal: 720, max: 1080 },
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
          errorMessage = isMobile 
            ? 'Camera access denied. Please check your browser settings and allow camera access for this site.'
            : 'Camera access denied. Please grant camera permissions and try again.';
        } else if (error.name === 'NotFoundError') {
          errorMessage = isMobile
            ? 'No camera found. Please ensure your device has a working camera.'
            : 'No camera found. Please connect a camera and try again.';
        } else if (error.name === 'NotReadableError') {
          errorMessage = isMobile
            ? 'Camera is being used by another app. Please close other camera apps and try again.'
            : 'Camera is being used by another application.';
        } else if (error.name === 'OverconstrainedError') {
          errorMessage = isMobile
            ? 'This camera configuration is not supported on your device. Try switching cameras.'
            : 'Camera does not support the requested configuration.';
        } else if (error.message === 'HTTPS_REQUIRED') {
          if (isMobile) {
            if (browserInfo.isMobileCompatible) {
              errorMessage = '🔒 Camera access requires HTTPS. You\'re using Firefox which should work - please accept the security warning.';
            } else {
              errorMessage = `🔒 Camera access requires HTTPS. ${browserInfo.name} has strict security requirements. Try Firefox mobile for easier access, or accept the security warning in advanced settings.`;
            }
          } else {
            errorMessage = '🔒 Camera access requires a secure connection (HTTPS).';
          }
        } else {
          errorMessage = `Camera error: ${error.message}`;
        }
      }
      
      onError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [onError, onStreamReady, isMobile, cameraFacing]);

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

        {/* Camera Switch Button - Only show on mobile with multiple cameras */}
        {isMobile && availableCameras.length > 1 && isActive && hasPermission && (
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
      </div>
      
      <div className={styles.videoInfo}>
        <span className={`${styles.status} ${isActive && hasPermission ? styles.active : ''}`}>
          {isActive && hasPermission ? 'Live' : 'Inactive'}
        </span>
        {isMobile && (
          <span className={styles.mobileIndicator}>
            📱 Mobile {cameraFacing === 'user' ? 'Front' : 'Back'} Camera
          </span>
        )}
      </div>
    </div>
  );
};