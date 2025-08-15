import React from 'react';
import styles from './AIAnalysisLoading.module.css';

interface AIAnalysisLoadingProps {
  isVisible: boolean;
  analysisStartTime?: number;
}

export const AIAnalysisLoading: React.FC<AIAnalysisLoadingProps> = ({
  isVisible
}) => {
  if (!isVisible) return null;

  return (
    <div className={styles.overlay}>
      <div className={styles.card}>
        <div className={styles.aiIcon}>
          <div className={styles.spinnerRing}></div>
        </div>
      </div>
    </div>
  );
};