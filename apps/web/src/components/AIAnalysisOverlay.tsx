import React, { useState, useEffect } from 'react';
import { AIAnalysis } from '../hooks/useSSE';
import { useStreamingText } from '../hooks/useStreamingText';
import { ANIMATION_CONSTANTS } from '../constants/animation';
import styles from './AIAnalysisOverlay.module.css';

interface AIAnalysisOverlayProps {
  analysis: AIAnalysis | null;
  isPersistent?: boolean; // Whether to show persistently
  isAnalyzing?: boolean; // Whether analysis is in progress
}

export const AIAnalysisOverlay: React.FC<AIAnalysisOverlayProps> = ({
  analysis,
  isPersistent = false,
  isAnalyzing = false
}) => {
  const [shouldShow, setShouldShow] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [showDebug, setShowDebug] = useState(false);
  
  // Streaming text effect for AI analysis
  const { displayText, isComplete, isStreaming, skipToEnd } = useStreamingText(
    analysis?.description || '', 
    { speed: ANIMATION_CONSTANTS.STREAMING_SPEED, delay: ANIMATION_CONSTANTS.STREAMING_DELAY }
  );

  useEffect(() => {
    if (analysis) {
      setShouldShow(true);
      setIsAnimating(true);
    } else if (!isPersistent) {
      setIsAnimating(false);
      // Delay hiding to allow fade-out animation
      const timer = setTimeout(() => setShouldShow(false), 300);
      return () => clearTimeout(timer);
    }
  }, [analysis, isPersistent]);

  if (!shouldShow && !isPersistent) {
    return null;
  }

  // Show placeholder when persistent but no analysis yet
  if (isPersistent && !analysis) {
    return (
      <div className={`${styles.overlay} ${styles.persistent} ${styles.waiting}`}>
        <div className={styles.card}>
          <div className={styles.content}>
            <div className={styles.analysisContainer}>
              {isAnalyzing && (
                <div className={styles.loadingSpinner}>
                  <div className={styles.spinnerRing}></div>
                </div>
              )}
              <p className={styles.description}>
                Waiting for detection result...
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`${styles.overlay} ${isPersistent ? styles.persistent : ''} ${isAnimating ? styles.visible : styles.hidden}`}>
      <div className={styles.card}>
        <div className={styles.content}>
          <div className={styles.analysisContainer}>
            {isAnalyzing && (
              <div className={styles.loadingSpinner}>
                <div className={styles.spinnerRing}></div>
              </div>
            )}
            <div className={styles.streamingContainer} onClick={skipToEnd}>
              <p className={`${styles.description} ${isStreaming ? styles.streaming : ''}`}>
                {displayText}
                {isStreaming && <span className={styles.cursor}>|</span>}
              </p>
              {!isComplete && isStreaming && (
                <div className={styles.streamingIndicator}>
                  <span className={styles.streamingDot}></span>
                  <span className={styles.streamingDot}></span>
                  <span className={styles.streamingDot}></span>
                </div>
              )}
            </div>
            
            {/* Debug toggle and JSON output */}
            <button 
              className={styles.debugToggle}
              onClick={() => setShowDebug(!showDebug)}
              title="Toggle debug output"
            >
              🐛 Debug
            </button>
            
            {showDebug && analysis && (
              <div className={styles.debugSection}>
                <h4>Raw JSON Response:</h4>
                <pre className={styles.debugJson}>
                  {JSON.stringify(analysis, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};