import React, { useEffect, useState } from 'react';
import styles from './ConnectionStatus.module.css';

interface ConnectionStatusProps {
  sseConnectionState: 'connecting' | 'open' | 'closed';
  sseError: string | null;
}

export const ConnectionStatus: React.FC<ConnectionStatusProps> = ({ 
  sseConnectionState, 
  sseError 
}) => {
  const [backendStatus, setBackendStatus] = useState<'checking' | 'online' | 'offline'>('checking');
  const [showDetails, setShowDetails] = useState(false);

  // Check backend health
  useEffect(() => {
    const checkBackend = async () => {
      try {
        const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';
        const response = await fetch(`${apiUrl}/health`, {
          method: 'GET',
          signal: AbortSignal.timeout(5000), // 5 second timeout
        });
        
        if (response.ok) {
          setBackendStatus('online');
        } else {
          setBackendStatus('offline');
        }
      } catch (error) {
        setBackendStatus('offline');
      }
    };

    checkBackend();
    const interval = setInterval(checkBackend, 30000); // Check every 30 seconds

    return () => clearInterval(interval);
  }, []);

  // Determine overall status
  const getStatus = () => {
    if (backendStatus === 'checking') return 'checking';
    if (backendStatus === 'offline') return 'offline';
    if (sseConnectionState === 'open') return 'connected';
    if (sseConnectionState === 'connecting') return 'connecting';
    return 'disconnected';
  };

  const status = getStatus();
  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';
  const isRenderBackend = apiUrl.includes('onrender.com');

  // Don't show if everything is working
  if (status === 'connected' && !showDetails) {
    return null;
  }

  return (
    <div className={`${styles.connectionStatus} ${styles[status]}`}>
      <div className={styles.statusBar} onClick={() => setShowDetails(!showDetails)}>
        <div className={styles.statusIndicator}>
          <span className={styles.statusDot}></span>
          {status === 'checking' && 'Checking connection...'}
          {status === 'offline' && 'Backend offline'}
          {status === 'connecting' && 'Connecting...'}
          {status === 'disconnected' && 'Disconnected'}
          {status === 'connected' && 'Connected'}
        </div>
        <button className={styles.toggleButton}>
          {showDetails ? '▼' : '▲'}
        </button>
      </div>

      {showDetails && (
        <div className={styles.details}>
          <div className={styles.detailRow}>
            <span>Backend URL:</span>
            <code className={styles.url}>{apiUrl}</code>
          </div>
          
          <div className={styles.detailRow}>
            <span>Backend Status:</span>
            <span className={`${styles.badge} ${styles[backendStatus]}`}>
              {backendStatus}
            </span>
          </div>
          
          <div className={styles.detailRow}>
            <span>SSE Connection:</span>
            <span className={`${styles.badge} ${styles[sseConnectionState]}`}>
              {sseConnectionState}
            </span>
          </div>

          {sseError && (
            <div className={styles.errorMessage}>
              {sseError}
            </div>
          )}

          {status === 'offline' && isRenderBackend && (
            <div className={styles.helpText}>
              <strong>Render Free Tier Notice:</strong>
              <p>The backend service may be sleeping. Free tier services on Render spin down after 15 minutes of inactivity.</p>
              <p>Please wait 1-2 minutes for the service to wake up, then refresh the page.</p>
              <a 
                href={apiUrl.replace('/api/v1', '/health')} 
                target="_blank" 
                rel="noopener noreferrer"
                className={styles.wakeupLink}
              >
                Click here to wake up the backend →
              </a>
            </div>
          )}

          {status === 'offline' && !isRenderBackend && (
            <div className={styles.helpText}>
              <strong>Local Development:</strong>
              <p>Make sure your backend is running locally:</p>
              <code>cd apps/api && npm run dev:api</code>
            </div>
          )}
        </div>
      )}
    </div>
  );
};