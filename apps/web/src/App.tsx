import React, { useState, useCallback } from 'react';
import { VideoFeed, VideoControls } from './components';
import { ConnectionHelper } from './components/ConnectionHelper';
import { MotionDetectionState, MotionEvent } from './types';
import { useSSE, AIAnalysis } from './hooks/useSSE';
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
  const [recentMotionEvents, setRecentMotionEvents] = useState<MotionEvent[]>([]);
  const [recentAIAnalysis, setRecentAIAnalysis] = useState<AIAnalysis[]>([]);

  // SSE integration for real-time updates
  const {
    isConnected: sseConnected,
    connectionState,
    error: sseError
  } = useSSE({
    autoConnect: true,
    onMotionDetected: useCallback((event: MotionEvent) => {
      setRecentMotionEvents(prev => [...prev.slice(-4), event]); // Keep last 5 events
    }, []),
    onAIAnalysis: useCallback((analysis: AIAnalysis) => {
      setRecentAIAnalysis(prev => [...prev.slice(-2), analysis]); // Keep last 3 analyses
    }, [])
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
  }, []);

  const handleToggleSettings = useCallback(() => {
    setShowSettings(prev => !prev);
  }, []);

  const handleMotionStateChange = useCallback((newMotionState: MotionDetectionState) => {
    setMotionState(newMotionState);
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

        {sseError && (
          <div className={styles.errorBanner} style={{ backgroundColor: '#dc2626' }}>
            <strong>Connection Error:</strong> {sseError}
          </div>
        )}

        {/* SSE Connection Status */}
        <div className={styles.statusBar}>
          <div className={`${styles.connectionStatus} ${sseConnected ? styles.connected : styles.disconnected}`}>
            <span className={styles.statusDot}></span>
            Backend: {sseConnected ? 'Connected' : `Disconnected (${connectionState})`}
          </div>
          {recentMotionEvents.length > 0 && (
            <div className={styles.eventCounter}>
              Motion Events: {recentMotionEvents.length}
            </div>
          )}
          {recentAIAnalysis.length > 0 && (
            <div className={styles.aiCounter}>
              AI Analysis: {recentAIAnalysis.length}
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

            {/* Recent Events Section */}
            {(recentMotionEvents.length > 0 || recentAIAnalysis.length > 0) && (
              <div className={styles.eventsSection}>
                <h3 className={styles.sectionTitle}>Recent Events</h3>
                
                {recentMotionEvents.length > 0 && (
                  <div className={styles.eventGroup}>
                    <h4 className={styles.eventGroupTitle}>Motion Events</h4>
                    {recentMotionEvents.slice(-3).reverse().map(event => (
                      <div key={event.id} className={styles.eventItem}>
                        <span className={styles.eventTime}>
                          {new Date(event.timestamp).toLocaleTimeString()}
                        </span>
                        <span className={styles.eventConfidence}>
                          {(event.confidence * 100).toFixed(0)}%
                        </span>
                        {event.description && (
                          <span className={styles.eventDescription}>{event.description}</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {recentAIAnalysis.length > 0 && (
                  <div className={styles.eventGroup}>
                    <h4 className={styles.eventGroupTitle}>AI Analysis</h4>
                    {recentAIAnalysis.slice(-2).reverse().map((analysis, index) => (
                      <div key={index} className={styles.analysisItem}>
                        <span className={styles.eventTime}>
                          {new Date(analysis.timestamp).toLocaleTimeString()}
                        </span>
                        <span className={styles.processingTime}>
                          {analysis.processing_time.toFixed(1)}s
                        </span>
                        <p className={styles.analysisDescription}>{analysis.description}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </main>
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