import React, { useRef, useEffect, useState, useCallback } from 'react';
import { useManualCapture } from '../hooks/useManualCapture';
import { useSSE, AIAnalysis } from '../hooks/useSSE';
import { AIAnalysisOverlay } from './AIAnalysisOverlay';
import { api } from '../api';
import styles from './VideoFeed.module.css';

interface VideoFeedProps {
  isActive: boolean;
  onError: (error: string) => void;
  onStreamReady: (stream: MediaStream) => void;
  sensitivity: number;
  cameraFacing?: 'user' | 'environment';
  onCameraFacingChange?: (facing: 'user' | 'environment') => void;
  onCameraSwitchVisibility?: (shouldShow: boolean) => void;
}

export const VideoFeed: React.FC<VideoFeedProps> = ({
  isActive,
  onError,
  onStreamReady,
  sensitivity: _sensitivity, // Keep for interface compatibility but unused
  cameraFacing = 'environment',
  onCameraFacingChange: _onCameraFacingChange, // Keep for interface compatibility but unused
  onCameraSwitchVisibility,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  
  // Consolidated state
  const [videoState, setVideoState] = useState({
    isLoading: false,
    hasPermission: null as boolean | null,
    hasMultipleCameras: false,
    isMobileDevice: /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
  });
  
  const [analysisState, setAnalysisState] = useState({
    current: null as AIAnalysis | null,
    isAnalyzing: false,
    startTime: null as number | null
  });

  // Frame stack state - up to 3 frames
  const [frameStack, setFrameStack] = useState<Array<{ id: string; url: string; timestamp: number }>>([]);
  const maxFrames = 3;
  
  // Item identification state
  const [identifiedItem, setIdentifiedItem] = useState<string>('');
  const [showItemOverlay, setShowItemOverlay] = useState<boolean>(false);
  const [isIdentifyingItem, setIsIdentifyingItem] = useState<boolean>(false);

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
      console.log('🔍 Camera detection debug:', {
        totalDevices: devices.length,
        videoDevices: cameras.length,
        hasMultipleCameras: cameras.length > 1,
        cameras: cameras.map(cam => ({ id: cam.deviceId, label: cam.label })),
        isMobile: /iPhone|iPad|iPod|Android/i.test(navigator.userAgent),
        isIOS: /iPhone|iPad|iPod/i.test(navigator.userAgent)
      });
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

  // Manual capture integration
  const { captureFrame } = useManualCapture({
    videoElement: videoRef.current,
    customPrompt: '', // No custom prompt needed
    onAnalysisStart: handleAnalysisStart
  });

  // Handle frame capture with stacking
  const handleCaptureFrame = useCallback(async () => {
    if (!videoRef.current || frameStack.length >= maxFrames) return;
    
    try {
      // Create canvas to capture current frame
      const canvas = document.createElement('canvas');
      const video = videoRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        // Convert to data URL for display
        const frameDataUrl = canvas.toDataURL('image/jpeg', 0.8);
        
        // Add to stack with unique ID and timestamp
        const newFrame = {
          id: Date.now().toString(),
          url: frameDataUrl,
          timestamp: Date.now()
        };
        
        setFrameStack(prev => [...prev, newFrame]);
      }
      
      // Trigger the actual analysis capture
      await captureFrame();
    } catch (error) {
      console.error('Error capturing frame:', error);
    }
  }, [captureFrame, frameStack.length, maxFrames]);
  
  // Remove frame from stack
  const removeFrame = useCallback((frameId: string) => {
    setFrameStack(prev => prev.filter(frame => frame.id !== frameId));
  }, []);
  
  // Identify single item from current frame stack
  const identifyItem = useCallback(async () => {
    if (frameStack.length === 0 || isIdentifyingItem) return;
    
    setIsIdentifyingItem(true);
    setShowItemOverlay(true);
    
    try {
      // Extract base64 data from frame URLs (remove data:image/jpeg;base64, prefix)
      const imagesBase64 = frameStack.map(frame => 
        frame.url.replace(/^data:image\/[a-z]+;base64,/, '')
      );
      
      const response = await api.generateTodos({
        images_base64: imagesBase64,
        context: 'Identify the main item in the center of these images'
      });
      
      if (response.success && response.todos.length > 0) {
        setIdentifiedItem(response.todos[0].task);
      } else {
        console.error('Failed to identify item:', response.error_message);
        setIdentifiedItem('unknown');
      }
    } catch (error) {
      console.error('Error identifying item:', error);
      setIdentifiedItem('error');
    } finally {
      setIsIdentifyingItem(false);
    }
  }, [frameStack, isIdentifyingItem]);
  
  // Close item overlay
  const closeItemOverlay = useCallback(() => {
    setShowItemOverlay(false);
    setIdentifiedItem('');
  }, []);

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
      
      // Re-enumerate cameras now that we have permission
      getAvailableCameras();
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

  // Notify parent about camera switch button visibility
  useEffect(() => {
    const shouldShow = (videoState.hasMultipleCameras || videoState.isMobileDevice) && isActive && videoState.hasPermission === true;
    console.log('📱 Camera switch button visibility:', {
      hasMultipleCameras: videoState.hasMultipleCameras,
      isMobileDevice: videoState.isMobileDevice,
      isActive,
      hasPermission: videoState.hasPermission,
      shouldShow
    });
    onCameraSwitchVisibility?.(shouldShow);
  }, [videoState.hasMultipleCameras, videoState.isMobileDevice, isActive, videoState.hasPermission, onCameraSwitchVisibility]);

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
  }, [isActive, cameraFacing]); // Add cameraFacing to deps to restart stream when camera switches



  const handleRetry = () => {
    if (isActive) {
      startStream();
    }
  };



  // Determine detection status class
  const detectionClass = analysisState.current?.detected === 'YES' 
    ? styles.detectedYes 
    : analysisState.current?.detected === 'NO' 
    ? styles.detectedNo 
    : '';

  return (
    <div className={styles.videoContainer}>
      <div className={`${styles.videoWrapper} ${detectionClass}`}>
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


        {/* AI Analysis Overlay - Only show when there's analysis */}
        {analysisState.current && (
          <AIAnalysisOverlay
            analysis={analysisState.current}
            isPersistent={false}
            isAnalyzing={false}
          />
        )}

        {/* Stylish Capture Button */}
        {isActive && videoState.hasPermission && (
          <div className={styles.simpleCaptureOverlay}>
            <button
              className={`${styles.simpleCaptureButton} ${analysisState.isAnalyzing ? styles.analyzing : ''} ${frameStack.length >= maxFrames ? styles.stackFull : ''}`}
              onClick={handleCaptureFrame}
              disabled={analysisState.isAnalyzing || frameStack.length >= maxFrames}
              title={frameStack.length >= maxFrames ? `Maximum ${maxFrames} frames captured` : "Capture current frame for analysis"}
              aria-label="Capture frame"
            >
              {analysisState.isAnalyzing ? (
                <div className={styles.captureButtonInner}>
                  <div className={styles.spinner}></div>
                </div>
              ) : (
                <div className={styles.captureButtonInner}>
                  <div className={styles.cameraIcon}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="8"/>
                      <circle cx="12" cy="12" r="2"/>
                    </svg>
                  </div>
                </div>
              )}
            </button>
          </div>
        )}
        
        {/* Identify Item Button - appears when frames are captured */}
        {isActive && videoState.hasPermission && frameStack.length > 0 && (
          <div className={styles.todoButtonOverlay}>
            <button
              className={`${styles.todoButton} ${isIdentifyingItem ? styles.generating : ''}`}
              onClick={identifyItem}
              disabled={isIdentifyingItem}
              title={`Identify item from ${frameStack.length} captured frame${frameStack.length > 1 ? 's' : ''}`}
              aria-label="Identify item"
            >
              {isIdentifyingItem ? (
                <div className={styles.todoButtonContent}>
                  <div className={styles.spinner}></div>
                  <span>Thinking...</span>
                </div>
              ) : (
                <div className={styles.todoButtonContent}>
                  <span>🤖</span>
                  <span>What's this?</span>
                </div>
              )}
            </button>
          </div>
        )}

        {/* Stacked Frame Overlays */}
        <div className={styles.frameStackContainer}>
          {frameStack.map((frame, index) => (
            <div 
              key={frame.id}
              className={`${styles.frameOverlay} ${styles[`stackPosition${index}`]}`}
              style={{ zIndex: 25 + index }}
            >
              <img 
                src={frame.url} 
                alt={`Captured frame ${index + 1}`} 
                className={styles.overlayImage}
              />
              <div className={styles.frameNumber}>{index + 1}</div>
              <button 
                className={styles.closeOverlay}
                onClick={() => removeFrame(frame.id)}
                title={`Remove frame ${index + 1}`}
              >
                ×
              </button>
            </div>
          ))}
        </div>
        
        {/* Item Identification Overlay */}
        {showItemOverlay && (
          <div className={styles.itemOverlay}>
            <div className={styles.itemContent}>
              {isIdentifyingItem ? (
                <div className={styles.identifyingState}>
                  <div className={styles.spinner}></div>
                  <span>Identifying...</span>
                </div>
              ) : (
                <div className={styles.identifiedItem}>
                  <span className={styles.itemText}>{identifiedItem}</span>
                  <button 
                    className={styles.closeItemOverlay}
                    onClick={closeItemOverlay}
                    title="Close"
                  >
                    ×
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  );
};