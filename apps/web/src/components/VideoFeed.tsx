import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { useManualCapture } from '../hooks/useManualCapture';
import { useSSE, AIAnalysis } from '../hooks/useSSE';
import { AIAnalysisOverlay } from './AIAnalysisOverlay';
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

  // Custom prompt state
  const [customPrompt, setCustomPrompt] = useState<string>('');
  const [promptToUse, setPromptToUse] = useState<string>('');
  const [promptSubmitted, setPromptSubmitted] = useState<boolean>(false);
  const [validationStatus, setValidationStatus] = useState<'idle' | 'validating' | 'valid' | 'invalid'>('idle');
  const [showValidationPopup, setShowValidationPopup] = useState<boolean>(false);
  const [popupHiding, setPopupHiding] = useState<boolean>(false);

  // Example prompts for placeholder (defined outside component or memoized to prevent recreating)
  const examplePrompts = useMemo(() => [
    "Is he smiling?",
    "Are they waving?", 
    "Is someone sleeping?",
    "Are they standing?",
    "Is she reading?",
    "Are they dancing?",
    "Is he walking?",
    "Are they talking?",
    "Is someone eating?",
    "Are they sitting?"
  ], []);

  const [currentExample, setCurrentExample] = useState<string>(() => 
    examplePrompts[Math.floor(Math.random() * examplePrompts.length)]
  );

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
    
    // Shuffle example prompt when analysis starts
    setCurrentExample(examplePrompts[Math.floor(Math.random() * examplePrompts.length)]);
  }, [examplePrompts]);

  // Manual capture integration
  const { resetCapture, captureFrame } = useManualCapture({
    videoElement: videoRef.current,
    customPrompt: promptToUse,
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

  // Validate if prompt is a yes/no question using rule-based approach
  const validateYesNoPrompt = (prompt: string): { valid: boolean; reason: string } => {
    const promptLower = prompt.toLowerCase().trim();
    
    // Check if it ends with a question mark (basic requirement)
    if (!prompt.trim().endsWith('?')) {
      return { valid: false, reason: "Not a question (missing '?')" };
    }
    
    // Common yes/no question starters
    const yesNoStarters = [
      'is', 'are', 'was', 'were', 'will', 'would', 'should', 'could', 
      'can', 'may', 'might', 'must', 'shall', 'do', 'does', 'did', 
      'have', 'has', 'had', 'am'
    ];
    
    // Open-ended question words that indicate NOT yes/no
    const openEndedWords = [
      'what', 'where', 'when', 'why', 'how', 'which', 'who', 'whose'
    ];
    
    // Words that suggest explanation needed (not yes/no)
    const explanationKeywords = [
      'explain', 'describe', 'tell me', 'elaborate', 'discuss', 
      'analyze', 'compare', 'list', 'name', 'identify'
    ];
    
    // Get first word of the question
    const words = promptLower.split(/\s+/);
    const firstWord = words[0];
    
    // Check for open-ended question words
    if (openEndedWords.includes(firstWord)) {
      return { valid: false, reason: `Open-ended question starting with '${firstWord}'` };
    }
    
    // Check for explanation keywords
    for (const keyword of explanationKeywords) {
      if (promptLower.includes(keyword)) {
        return { valid: false, reason: `Contains explanation keyword '${keyword}'` };
      }
    }
    
    // Check if starts with yes/no indicator
    if (yesNoStarters.includes(firstWord)) {
      return { valid: true, reason: "Valid yes/no question format" };
    }
    
    // Check for pattern like "Are you...", "Is there...", etc.
    if (words.length >= 2) {
      const firstTwoWords = `${words[0]} ${words[1]}`;
      const validPatterns = [
        /^am i/, /^are you/, /^is (he|she|it|this|that|there)/,
        /^are (we|they|these|those|there)/, /^will (you|he|she|it|we|they)/,
        /^would (you|he|she|it|we|they)/, /^can (i|you|he|she|it|we|they)/,
        /^could (i|you|he|she|it|we|they)/, /^should (i|you|he|she|it|we|they)/,
        /^do (i|you|we|they)/, /^does (he|she|it)/, /^did (i|you|he|she|it|we|they)/,
        /^have (i|you|we|they)/, /^has (he|she|it)/, /^had (i|you|he|she|it|we|they)/
      ];
      
      for (const pattern of validPatterns) {
        if (pattern.test(firstTwoWords)) {
          return { valid: true, reason: "Valid yes/no question pattern" };
        }
      }
    }
    
    return { valid: false, reason: "Does not match yes/no question pattern" };
  };

  // Handle submit of custom prompt
  const handlePromptSubmit = useCallback(() => {
    if (customPrompt.trim() && customPrompt !== promptToUse) {
      setValidationStatus('validating');
      
      // Client-side validation
      const validation = validateYesNoPrompt(customPrompt);
      
      setTimeout(() => {
        if (validation.valid) {
          setValidationStatus('valid');
          
          // Reset capture to start fresh with new prompt
          resetCapture();
          
          // Clear any ongoing AI analysis
          setAnalysisState({
            current: null,
            isAnalyzing: false,
            startTime: null
          });
          
          setPromptToUse(customPrompt);
          setPromptSubmitted(true);
          
          // Clear the input field after submission
          setCustomPrompt('');
          // Show feedback for 2 seconds
          setTimeout(() => {
            setPromptSubmitted(false);
            setValidationStatus('idle');
          }, 2000);
          console.log('Custom prompt validated and updated:', customPrompt);
        } else {
          setValidationStatus('invalid');
          setShowValidationPopup(true);
          console.log('Validation failed:', validation.reason);
          // Auto-dismiss toast after 2.5 seconds
          setTimeout(() => {
            handleDismissPopup();
          }, 2500);
          // Reset validation status
          setTimeout(() => {
            setValidationStatus('idle');
          }, 300);
        }
      }, 300); // 300ms delay for smoother UX
    }
  }, [customPrompt, promptToUse, resetCapture]);

  // Handle popup dismissal with animation
  const handleDismissPopup = useCallback(() => {
    setPopupHiding(true);
    setTimeout(() => {
      setShowValidationPopup(false);
      setPopupHiding(false);
    }, 300); // Match the CSS animation duration
  }, []);


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


        {/* AI Analysis Overlay - Persistent */}
        <AIAnalysisOverlay
          analysis={analysisState.current}
          isPersistent={true}
          isAnalyzing={analysisState.isAnalyzing}
        />

        {/* Custom Prompt Input Overlay */}
        <div className={styles.textBoxOverlay}>
          <input
            type="text"
            className={`${styles.textInput} ${validationStatus !== 'idle' ? styles[validationStatus] : ''}`}
            placeholder={`Try: ${currentExample}`}
            value={customPrompt}
            onChange={(e) => {
              setCustomPrompt(e.target.value);
              // Hide popup when user starts typing
              if (showValidationPopup) {
                handleDismissPopup();
              }
            }}
          />
          <button
            className={`${styles.submitButton} ${promptSubmitted ? styles.submitted : ''} ${validationStatus !== 'idle' ? styles[validationStatus] : ''}`}
            onClick={handlePromptSubmit}
            title="Submit custom prompt"
            disabled={!customPrompt.trim() || customPrompt === promptToUse || validationStatus === 'validating'}
          >
            {validationStatus === 'validating' ? '...' : 
             validationStatus === 'valid' ? '✓' : 
             validationStatus === 'invalid' ? '✗' : 
             promptSubmitted ? '✓' : 'Submit'}
          </button>
        </div>

        {/* Combined Prompt Display & Capture Button */}
        {promptToUse && isActive && videoState.hasPermission && (
          <div className={styles.captureButtonOverlay}>
            <button
              className={`${styles.captureButton} ${analysisState.isAnalyzing ? styles.analyzing : ''}`}
              onClick={captureFrame}
              disabled={analysisState.isAnalyzing || !promptToUse}
              title="Click to capture and analyze"
            >
              {analysisState.isAnalyzing ? (
                <span className={styles.captureButtonContent}>
                  <div className={styles.spinner}></div>
                  <span className={styles.captureButtonText}>Analyzing...</span>
                </span>
              ) : (
                <span className={styles.captureButtonContent}>
                  <span className={styles.capturePrompt}>{promptToUse}</span>
                </span>
              )}
            </button>
          </div>
        )}

        {/* Validation Popup */}
        {showValidationPopup && (
          <div 
            className={`${styles.validationToast} ${popupHiding ? styles.hiding : ''}`}
            style={{ 
              top: promptToUse && isActive && videoState.hasPermission 
                ? window.innerWidth <= 480 ? '48px' : '56px' // Adjust spacing based on screen size
                : window.innerWidth <= 480 ? '8px' : '16px' 
            }}
          >
            <span className={styles.toastMessage}>Try a yes/no question</span>
          </div>
        )}
      </div>
    </div>
  );
};