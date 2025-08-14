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
  // Camera state
  const [cameraState, setCameraState] = useState({
    isActive: false,
    stream: null as MediaStream | null,
    facing: 'user' as 'user' | 'environment',
    error: null as string | null
  });

  // Motion detection state
  const [motionState, setMotionState] = useState<MotionDetectionState>({
    isDetecting: false,
    motionStrength: 0,
    lastMotionTime: null,
    sensitivity: 50
  });

  // UI state
  const [uiState, setUiState] = useState({
    showSettings: false,
    showConnectionHelper: false
  });

  // Events state
  const [events, setEvents] = useState({
    motionEvents: [] as MotionEvent[],
    aiAnalysis: [] as AIAnalysis[]
  });

  // SSE integration for real-time updates
  const {
    isConnected: sseConnected,
    connectionState,
    error: sseError
  } = useSSE({
    autoConnect: true,
    onMotionDetected: useCallback((event: MotionEvent) => {
      setEvents(prev => ({
        ...prev,
        motionEvents: [...prev.motionEvents.slice(-4), event] // Keep last 5 events
      }));
    }, []),
    onAIAnalysis: useCallback((analysis: AIAnalysis) => {
      setEvents(prev => ({
        ...prev,
        aiAnalysis: [...prev.aiAnalysis.slice(-2), analysis] // Keep last 3 analyses
      }));
    }, [])
  });

  const handleToggleCamera = useCallback(() => {
    setCameraState(prev => ({
      ...prev,
      isActive: !prev.isActive,
      error: null // Clear any previous errors when toggling
    }));
  }, []);

  const handleSensitivityChange = useCallback((newSensitivity: number) => {
    setMotionState(prev => ({
      ...prev,
      sensitivity: newSensitivity
    }));
  }, []);

  const handleVideoError = useCallback((errorMessage: string) => {
    setCameraState(prev => ({
      ...prev,
      error: errorMessage,
      isActive: false
    }));
  }, []);

  const handleStreamReady = useCallback((newStream: MediaStream) => {
    setCameraState(prev => ({
      ...prev,
      stream: newStream
    }));
  }, []);

  const handleToggleSettings = useCallback(() => {
    setUiState(prev => ({
      ...prev,
      showSettings: !prev.showSettings
    }));
  }, []);

  const handleMotionStateChange = useCallback((newMotionState: MotionDetectionState) => {
    setMotionState(newMotionState);
  }, []);

  const handleCameraFacingChange = useCallback((facing: 'user' | 'environment') => {
    setCameraState(prev => ({
      ...prev,
      facing,
      error: null // Clear any previous errors when switching cameras
    }));
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

        {cameraState.error && (
          <div className={styles.errorBanner}>
            <strong>Error:</strong> {cameraState.error}
            {(cameraState.error.includes('HTTPS') || cameraState.error.includes('Camera access')) && (
              <button 
                className={styles.helpButton}
                onClick={() => setUiState(prev => ({ ...prev, showConnectionHelper: true }))}
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
          {events.motionEvents.length > 0 && (
            <div className={styles.eventCounter}>
              Motion Events: {events.motionEvents.length}
            </div>
          )}
          {events.aiAnalysis.length > 0 && (
            <div className={styles.aiCounter}>
              AI Analysis: {events.aiAnalysis.length}
            </div>
          )}
        </div>

        <main className={styles.content} data-stream-active={cameraState.stream !== null}>
          <div className={styles.videoSection}>
            <VideoFeed
              isActive={cameraState.isActive}
              onError={handleVideoError}
              onStreamReady={handleStreamReady}
              sensitivity={motionState.sensitivity}
              onMotionStateChange={handleMotionStateChange}
              cameraFacing={cameraState.facing}
              onCameraFacingChange={handleCameraFacingChange}
            />
            
            <button 
              className={`${styles.settingsToggle} ${uiState.showSettings ? styles.active : ''}`}
              onClick={handleToggleSettings}
              aria-label={uiState.showSettings ? 'Hide settings' : 'Show settings'}
              title={uiState.showSettings ? 'Hide settings' : 'Show settings'}
            >
              <SettingsIcon className={styles.settingsIcon} />
            </button>
          </div>

          <div className={`${styles.settingsPanel} ${uiState.showSettings ? styles.visible : styles.hidden}`}>
            <VideoControls
              isActive={cameraState.isActive}
              onToggleCamera={handleToggleCamera}
              sensitivity={motionState.sensitivity}
              onSensitivityChange={handleSensitivityChange}
              disabled={false}
              motionState={motionState}
            />

            {/* Recent Events Section */}
            {(events.motionEvents.length > 0 || events.aiAnalysis.length > 0) && (
              <div className={styles.eventsSection}>
                <h3 className={styles.sectionTitle}>Recent Events</h3>
                
                {events.motionEvents.length > 0 && (
                  <div className={styles.eventGroup}>
                    <h4 className={styles.eventGroupTitle}>Motion Events</h4>
                    {events.motionEvents.slice(-3).reverse().map(event => (
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

                {events.aiAnalysis.length > 0 && (
                  <div className={styles.eventGroup}>
                    <h4 className={styles.eventGroupTitle}>AI Analysis</h4>
                    {events.aiAnalysis.slice(-2).reverse().map((analysis, index) => (
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
        isVisible={uiState.showConnectionHelper}
        onClose={() => setUiState(prev => ({ ...prev, showConnectionHelper: false }))}
      />
    </div>
  );
}

export default App;