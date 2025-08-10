import React, { useState, useCallback } from 'react';
import { VideoFeed, VideoControls } from './components';
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
          </div>
        )}

        <main className={styles.content} data-stream-active={stream !== null}>
          <div className={styles.videoSection}>
            <VideoFeed
              isActive={isCameraActive}
              onError={handleVideoError}
              onStreamReady={handleStreamReady}
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
            />
          </div>
        </main>
      </div>
    </div>
  );
}

export default App;