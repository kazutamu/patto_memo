import { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { VideoFeed } from './components';
import { ConnectionHelper } from './components/ConnectionHelper';
import { useSSE, AIAnalysis } from './hooks/useSSE';
import styles from './App.module.css';


export function MainApp() {
  const navigate = useNavigate();
  
  // Camera state - start with camera inactive to prevent race conditions
  const [cameraState, setCameraState] = useState({
    isActive: false,
    stream: null as MediaStream | null,
    facing: 'environment' as 'user' | 'environment', // Default to back camera
    error: null as string | null
  });

  // Sensitivity state (keeping for future use)
  const [sensitivity] = useState(50);

  // UI state
  const [uiState, setUiState] = useState({
    showConnectionHelper: false,
    showCameraSwitchButton: false
  });

  // SSE integration for real-time updates
  const {
    error: sseError
  } = useSSE({
    autoConnect: true,
    onAIAnalysis: useCallback((analysis: AIAnalysis) => {
      // AI analysis is still processed but not displayed
      console.log('AI analysis:', analysis);
    }, [])
  });

  const handleToggleCamera = useCallback(() => {
    setCameraState(prev => ({
      ...prev,
      isActive: !prev.isActive,
      error: null // Clear any previous errors when toggling
    }));
  }, []);

  const handleLogout = useCallback(() => {
    // Clear authentication
    sessionStorage.removeItem('isAuthenticated');
    sessionStorage.removeItem('username');
    
    // Navigate to login page
    navigate('/login');
  }, [navigate]);

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


  const handleCameraFacingChange = useCallback((facing: 'user' | 'environment') => {
    setCameraState(prev => ({
      ...prev,
      facing,
      error: null // Clear any previous errors when switching cameras
    }));
  }, []);

  const handleCameraSwitchVisibility = useCallback((shouldShow: boolean) => {
    setUiState(prev => ({
      ...prev,
      showCameraSwitchButton: shouldShow
    }));
  }, []);

  // Auto-start camera on mount with a small delay
  useEffect(() => {
    // Start camera after a small delay to ensure component is fully mounted
    const timer = setTimeout(() => {
      setCameraState(prev => ({
        ...prev,
        isActive: true,
        error: null
      }));
    }, 500); // 500ms delay to prevent race conditions
    
    return () => clearTimeout(timer);
  }, []);

  const username = sessionStorage.getItem('username') || 'User';

  return (
    <div className={styles.app}>
      <div className={styles.container}>
        <header className={styles.header}>
          <h1 className={styles.title}>Patto Memo</h1>
          <div className={styles.userInfo}>
            <span className={styles.username}>Welcome, {username}</span>
            <button 
              className={styles.logoutButton}
              onClick={handleLogout}
              aria-label="Logout"
            >
              Logout
            </button>
          </div>
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


        <main className={styles.content} data-stream-active={cameraState.stream !== null}>
          <div className={styles.videoSection}>
            <VideoFeed
              isActive={cameraState.isActive}
              onError={handleVideoError}
              onStreamReady={handleStreamReady}
              sensitivity={sensitivity}
              cameraFacing={cameraState.facing}
              onCameraFacingChange={handleCameraFacingChange}
              onCameraSwitchVisibility={handleCameraSwitchVisibility}
            />
            
            {/* Camera toggle button overlay */}
            <button
              className={`${styles.cameraToggle} ${cameraState.isActive ? styles.active : ''}`}
              onClick={handleToggleCamera}
              aria-label={cameraState.isActive ? 'Turn camera off' : 'Turn camera on'}
              title={cameraState.isActive ? 'Camera is active' : 'Camera is inactive'}
            >
              {cameraState.isActive ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" stroke="none">
                  <path d="M17 10.5V7a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-3.5l4 4v-11l-4 4z" />
                </svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M17 10.5V7a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-3.5l4 4v-11l-4 4z" />
                  <line x1="1" y1="1" x2="23" y2="23" strokeLinecap="round" />
                </svg>
              )}
            </button>

            {/* Camera switch button - positioned below main toggle */}
            {uiState.showCameraSwitchButton && (
              <button
                className={styles.cameraSwitchToggle}
                onClick={() => handleCameraFacingChange(cameraState.facing === 'user' ? 'environment' : 'user')}
                aria-label={`Switch to ${cameraState.facing === 'user' ? 'back' : 'front'} camera`}
                title={`Switch to ${cameraState.facing === 'user' ? 'back' : 'front'} camera`}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  {/* Clean refresh/rotate arrows like 🔄 emoji */}
                  <path d="M23 4v6l-6-6" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M1 20v-6l6 6" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M3.51 15a9 9 0 0 0 14.85 3.36L23 14" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
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