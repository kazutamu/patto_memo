import React, { useState, useEffect } from 'react';
import { AIAnalysis } from '../hooks/useSSE';
import styles from './AIAnalysisOverlay.module.css';

interface AIAnalysisOverlayProps {
  analysis: AIAnalysis | null;
  isVisible: boolean;
  onDismiss?: () => void;
  autoHideDelay?: number; // Auto hide after X milliseconds
}

export const AIAnalysisOverlay: React.FC<AIAnalysisOverlayProps> = ({
  analysis,
  isVisible,
  onDismiss,
  autoHideDelay = 10000 // 10 seconds default
}) => {
  const [shouldShow, setShouldShow] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    if (isVisible && analysis) {
      setShouldShow(true);
      setIsAnimating(true);
      
      // Auto hide after delay
      if (autoHideDelay > 0) {
        const timer = setTimeout(() => {
          handleDismiss();
        }, autoHideDelay);
        
        return () => clearTimeout(timer);
      }
    } else {
      setIsAnimating(false);
      // Delay hiding to allow fade-out animation
      const timer = setTimeout(() => setShouldShow(false), 300);
      return () => clearTimeout(timer);
    }
  }, [isVisible, analysis, autoHideDelay]);

  const handleDismiss = () => {
    setIsAnimating(false);
    onDismiss?.();
  };

  if (!shouldShow || !analysis) {
    return null;
  }

  return (
    <div className={`${styles.overlay} ${isAnimating ? styles.visible : styles.hidden}`}>
      <div className={styles.card}>
        <div className={styles.header}>
          <div className={styles.title}>
            <span className={styles.aiIcon}>🤖</span>
            AI Analysis
          </div>
          <div className={styles.metadata}>
            <span className={styles.processingTime}>
              {analysis.processing_time.toFixed(1)}s
            </span>
            <button 
              className={styles.dismissButton}
              onClick={handleDismiss}
              aria-label="Dismiss analysis"
            >
              ×
            </button>
          </div>
        </div>
        
        <div className={styles.content}>
          <p className={styles.description}>
            {analysis.description}
          </p>
        </div>
        
        <div className={styles.footer}>
          <span className={styles.timestamp}>
            {new Date(analysis.timestamp).toLocaleTimeString()}
          </span>
          <div className={styles.progressBar}>
            <div 
              className={styles.progressFill}
              style={{ 
                animationDuration: `${autoHideDelay}ms`,
                animationPlayState: isAnimating ? 'running' : 'paused'
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};