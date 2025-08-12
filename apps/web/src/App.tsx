import React, { useState, useCallback, useRef } from 'react';
import { VideoFeed, VideoControls, AIAnalysisPopup } from './components';
import { ConnectionHelper } from './components/ConnectionHelper';
import { useAIAnalysis } from './hooks';
import { MotionDetectionState } from './types';
import styles from './App.module.css';

// Settings icon component
const SettingsIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg 
    className={className} 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round"
    width="20" 
    height="20"
  >
    <circle cx="12" cy="12" r="3"></circle>
    <path d="M12 1v6M12 17v6M4.22 4.22l4.24 4.24M15.54 15.54l4.24 4.24M1 12h6M17 12h6M4.22 19.78l4.24-4.24M15.54 8.46l4.24-4.24"></path>
  </svg>
);

function App() {
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [sensitivity, setSensitivity] = useState(50);
  const [error, setError] = useState<string | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [cameraFacing, setCameraFacing] = useState<'user' | 'environment'>('user');
  const [motionState, setMotionState] = useState<MotionDetectionState>({
    isDetecting: false,
    motionStrength: 0,
    lastMotionTime: null,
    sensitivity: 50
  });
  const [showConnectionHelper, setShowConnectionHelper] = useState(false);

  // Video element ref for AI analysis
  const videoElementRef = useRef<HTMLVideoElement | null>(null);

  // AI Analysis integration
  const { 
    analysis, 
    isConnected: isAIConnected, 
    isAnalyzing, 
    requestAnalysis, 
    clearAnalysis 
  } = useAIAnalysis({
    videoElement: videoElementRef.current,
    isActive: isCameraActive,
    significanceThreshold: 25, // Trigger AI analysis for motion above 25%
    analysisRateLimit: 8, // Max 8 AI requests per minute
    frameQuality: 0.75 // Good quality for AI analysis
  });

  const handleToggleCamera = useCallback(() => {
    setIsCameraActive(prev => !prev);
    setError(null); // Clear any previous errors when toggling
  }, []);

  const handleSensitivityChange = useCallback((newSensitivity: number) => {
    setSensitivity(newSensitivity);
  }, []);

  const handleVideoError = useCallback((errorMessage: string) => {
    setError(errorMessage);
    setIsCameraActive(false);
  }, []);

  const handleStreamReady = useCallback((newStream: MediaStream) => {
    setStream(newStream);
    // Stream is now available for future motion detection implementation
    console.log('Camera stream ready:', newStream.getTracks().length, 'tracks');
  }, []);

  const handleToggleSettings = useCallback(() => {
    setShowSettings(prev => !prev);
  }, []);

  const handleMotionStateChange = useCallback((newMotionState: MotionDetectionState) => {
    console.log(`🎯 Motion detected - Strength: ${newMotionState.motionStrength}%, Detecting: ${newMotionState.isDetecting}`);
    setMotionState(newMotionState);
    
    // Trigger AI analysis for significant motion
    if (newMotionState.motionStrength > 0) {
      console.log(`🎯 Calling requestAnalysis with strength: ${newMotionState.motionStrength}%`);
      requestAnalysis(newMotionState.motionStrength);
    }
  }, [requestAnalysis]);

  const handleVideoElementReady = useCallback((videoElement: HTMLVideoElement | null) => {
    videoElementRef.current = videoElement;
  }, []);

  const handleCameraFacingChange = useCallback((facing: 'user' | 'environment') => {
    setCameraFacing(facing);
    // Clear any previous errors when switching cameras
    setError(null);
  }, []);

  return (
    <div className={styles.app}>
      <div className={styles.container}>
        <header className={styles.header}>
          <h1 className={styles.title}>Motion Detector</h1>
          <p className={styles.subtitle}>
            Advanced motion detection with real-time video analysis
          </p>
        </header>

        {error && (
          <div className={styles.errorBanner}>
            <strong>Error:</strong> {error}
            {(error.includes('HTTPS') || error.includes('Camera access')) && (
              <button 
                className={styles.helpButton}
                onClick={() => setShowConnectionHelper(true)}
              >
                Need Help? 📱
              </button>
            )}
          </div>
        )}

        <main className={styles.content} data-stream-active={stream !== null}>
          <div className={styles.videoSection}>
            <VideoFeed
              isActive={isCameraActive}
              onError={handleVideoError}
              onStreamReady={handleStreamReady}
              sensitivity={sensitivity}
              onMotionStateChange={handleMotionStateChange}
              onVideoElementReady={handleVideoElementReady}
              cameraFacing={cameraFacing}
              onCameraFacingChange={handleCameraFacingChange}
            />
            
            <button 
              className={`${styles.settingsToggle} ${showSettings ? styles.active : ''}`}
              onClick={handleToggleSettings}
              aria-label={showSettings ? 'Hide settings' : 'Show settings'}
              title={showSettings ? 'Hide settings' : 'Show settings'}
            >
              <SettingsIcon className={styles.settingsIcon} />
            </button>
          </div>

          <div className={`${styles.settingsPanel} ${showSettings ? styles.visible : styles.hidden}`}>
            <VideoControls
              isActive={isCameraActive}
              onToggleCamera={handleToggleCamera}
              sensitivity={sensitivity}
              onSensitivityChange={handleSensitivityChange}
              disabled={false}
              motionState={motionState}
            />
          </div>
        </main>

        {/* AI Analysis Status with debugging info */}
        {isCameraActive && (
          <div className={styles.aiStatus}>
            <span className={`${styles.statusDot} ${isAIConnected ? styles.connected : styles.disconnected}`} />
            <span className={styles.statusText}>
              AI Analysis: {isAIConnected ? 'Connected' : 'Disconnected'}
              {isAnalyzing && ' (Analyzing...)'}
            </span>
            {/* Debug info for mobile */}
            <div style={{ fontSize: '12px', marginTop: '4px', color: '#666' }}>
              Debug: Camera={isCameraActive ? 'ON' : 'OFF'}, 
              AI={isAIConnected ? 'OK' : 'FAIL'}, 
              Mode={/mobile|android|iphone|ipad/i.test(navigator.userAgent) || 'ontouchstart' in window ? '📱Mobile-Poll' : '🖥️Desktop-WS'}
            </div>
          </div>
        )}

        {/* AI Analysis Popup */}
        <AIAnalysisPopup
          analysis={analysis}
          isVisible={analysis !== null}
          onClose={clearAnalysis}
          autoCloseDelay={10000} // Auto-close after 10 seconds
        />
      </div>

      <ConnectionHelper 
        currentUrl={window.location.href}
        isVisible={showConnectionHelper}
        onClose={() => setShowConnectionHelper(false)}
      />
    </div>
  );
}

export default App;