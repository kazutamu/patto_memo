import React, { useState, useCallback } from 'react';
import { VideoFeed, VideoControls } from './components';
import { useSSE } from './hooks/useSSE';
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

function SimpleApp() {
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [sensitivity, setSensitivity] = useState(50);
  const [error, setError] = useState<string | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [motionState, setMotionState] = useState<MotionDetectionState>({
    isDetecting: false,
    motionStrength: 0,
    lastMotionTime: null,
    sensitivity: 50
  });

  // SSE connection for real-time updates
  const { isConnected: isSSEConnected, lastMessage } = useSSE({
    url: '/api/v1/events',
    enabled: true
  });

  const handleToggleCamera = useCallback(() => {
    setIsCameraActive(prev => !prev);
    setError(null);
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
    console.log('Camera stream ready:', newStream.getTracks().length, 'tracks');
  }, []);

  const handleToggleSettings = useCallback(() => {
    setShowSettings(prev => !prev);
  }, []);

  const handleMotionStateChange = useCallback((newMotionState: MotionDetectionState) => {
    console.log(`Motion detected - Strength: ${newMotionState.motionStrength}%, Detecting: ${newMotionState.isDetecting}`);
    setMotionState(newMotionState);
  }, []);

  return (
    <div className={styles.app}>
      <div className={styles.container}>
        <header className={styles.header}>
          <h1 className={styles.title}>Motion Detector</h1>
          <p className={styles.subtitle}>
            Simple motion detection with Server-Sent Events
          </p>
        </header>

        {error && (
          <div className={styles.errorBanner}>
            <strong>Error:</strong> {error}
          </div>
        )}

        {/* SSE Status */}
        <div style={{ 
          padding: '12px', 
          marginBottom: '20px', 
          backgroundColor: isSSEConnected ? '#10b981' : '#ef4444',
          color: 'white',
          borderRadius: '8px',
          textAlign: 'center'
        }}>
          SSE Status: {isSSEConnected ? 'Connected' : 'Disconnected'}
          {lastMessage && (
            <div style={{ fontSize: '12px', marginTop: '4px' }}>
              Last message: {JSON.stringify(lastMessage)}
            </div>
          )}
        </div>

        <main className={styles.content} data-stream-active={stream !== null}>
          <div className={styles.videoSection}>
            <VideoFeed
              isActive={isCameraActive}
              onError={handleVideoError}
              onStreamReady={handleStreamReady}
              sensitivity={sensitivity}
              onMotionStateChange={handleMotionStateChange}
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
      </div>
    </div>
  );
}

export default SimpleApp;