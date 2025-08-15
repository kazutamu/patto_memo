import React, { useState, useEffect } from 'react';
import { AIAnalysis } from '../hooks/useSSE';
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
            <p className={styles.description}>
              Waiting for detection result...
            </p>
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
            <p className={styles.description}>
              {analysis?.description}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};