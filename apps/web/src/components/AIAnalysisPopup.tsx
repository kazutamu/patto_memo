import React, { useEffect, useState } from 'react';
import { AIAnalysisResult } from '../types';
import styles from './AIAnalysisPopup.module.css';

export interface AIAnalysisPopupProps {
  analysis: AIAnalysisResult | null;
  isVisible: boolean;
  onClose: () => void;
  autoCloseDelay?: number; // Auto close after X milliseconds
}

export const AIAnalysisPopup: React.FC<AIAnalysisPopupProps> = ({
  analysis,
  isVisible,
  onClose,
  autoCloseDelay = 8000 // Default 8 seconds
}) => {
  const [isAnimatingIn, setIsAnimatingIn] = useState(false);
  const [isAnimatingOut, setIsAnimatingOut] = useState(false);

  // Handle visibility changes with animations
  useEffect(() => {
    if (isVisible && analysis) {
      setIsAnimatingIn(true);
      setIsAnimatingOut(false);
      
      // Auto close after delay if specified
      if (autoCloseDelay > 0) {
        const timer = setTimeout(() => {
          handleClose();
        }, autoCloseDelay);
        
        return () => clearTimeout(timer);
      }
    }
  }, [isVisible, analysis, autoCloseDelay]);

  const handleClose = () => {
    setIsAnimatingOut(true);
    setIsAnimatingIn(false);
    
    // Wait for animation to complete before calling onClose
    setTimeout(() => {
      onClose();
      setIsAnimatingOut(false);
    }, 300); // Match CSS animation duration
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      handleClose();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      handleClose();
    }
  };

  const formatTimestamp = (timestamp: string): string => {
    try {
      return new Date(timestamp).toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      });
    } catch {
      return timestamp;
    }
  };

  const getConfidenceColor = (confidence: number): string => {
    if (confidence >= 0.8) return styles.highConfidence;
    if (confidence >= 0.6) return styles.mediumConfidence;
    return styles.lowConfidence;
  };

  const formatConfidence = (confidence: number): string => {
    return `${Math.round(confidence * 100)}%`;
  };

  if (!isVisible || !analysis) {
    return null;
  }

  return (
    <div 
      className={`${styles.backdrop} ${
        isAnimatingIn ? styles.fadeIn : ''
      } ${isAnimatingOut ? styles.fadeOut : ''}`}
      onClick={handleBackdropClick}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role="dialog"
      aria-modal="true"
      aria-labelledby="ai-analysis-title"
    >
      <div 
        className={`${styles.popup} ${
          isAnimatingIn ? styles.slideIn : ''
        } ${isAnimatingOut ? styles.slideOut : ''}`}
      >
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.titleSection}>
            <h3 id="ai-analysis-title" className={styles.title}>
              AI Scene Analysis
            </h3>
            <div className={styles.metadata}>
              <span className={styles.timestamp}>
                {formatTimestamp(analysis.timestamp)}
              </span>
              {analysis.processing_time && (
                <span className={styles.processingTime}>
                  {analysis.processing_time}ms
                </span>
              )}
            </div>
          </div>
          
          <button 
            className={styles.closeButton}
            onClick={handleClose}
            aria-label="Close analysis popup"
            title="Close (Esc)"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className={styles.content}>
          <div className={styles.description}>
            {analysis.description}
          </div>
          
          <div className={styles.footer}>
            <div className={styles.confidenceSection}>
              <span className={styles.confidenceLabel}>Confidence:</span>
              <div className={styles.confidenceBar}>
                <div 
                  className={`${styles.confidenceFill} ${getConfidenceColor(analysis.confidence)}`}
                  style={{ width: `${analysis.confidence * 100}%` }}
                />
                <span className={styles.confidenceText}>
                  {formatConfidence(analysis.confidence)}
                </span>
              </div>
            </div>
            
            {analysis.frame_id && (
              <div className={styles.frameInfo}>
                Frame: {analysis.frame_id.slice(-8)}
              </div>
            )}
          </div>
        </div>

        {/* Progress bar for auto-close */}
        {autoCloseDelay > 0 && isVisible && (
          <div className={styles.progressBar}>
            <div 
              className={styles.progressFill}
              style={{ 
                animationDuration: `${autoCloseDelay}ms`,
                animationPlayState: isAnimatingOut ? 'paused' : 'running'
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
};