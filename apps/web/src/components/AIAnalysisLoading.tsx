import React from 'react';
import styles from './AIAnalysisLoading.module.css';

interface AIAnalysisLoadingProps {
  isVisible: boolean;
  analysisStartTime?: number;
}

export const AIAnalysisLoading: React.FC<AIAnalysisLoadingProps> = ({
  isVisible,
  analysisStartTime
}) => {
  const [elapsedTime, setElapsedTime] = React.useState(0);

  React.useEffect(() => {
    if (!isVisible || !analysisStartTime) {
      setElapsedTime(0);
      return;
    }

    const interval = setInterval(() => {
      const elapsed = (Date.now() - analysisStartTime) / 1000;
      setElapsedTime(elapsed);
    }, 100);

    return () => clearInterval(interval);
  }, [isVisible, analysisStartTime]);

  if (!isVisible) return null;

  return (
    <div className={styles.overlay}>
      <div className={styles.card}>
        <div className={styles.header}>
          <div className={styles.title}>
            <span className={styles.aiIcon}>🧠</span>
            AI Analysis in Progress
          </div>
          <div className={styles.timer}>
            {elapsedTime.toFixed(1)}s
          </div>
        </div>
        
        <div className={styles.content}>
          <div className={styles.spinner}>
            <div className={styles.spinnerRing}></div>
            <div className={styles.spinnerRing}></div>
            <div className={styles.spinnerRing}></div>
          </div>
          <p className={styles.message}>
            Analyzing captured frame with LLaVA...
          </p>
          <div className={styles.progressBar}>
            <div className={styles.progressFill}></div>
          </div>
        </div>
        
        <div className={styles.footer}>
          <span className={styles.note}>This may take 30-60 seconds</span>
        </div>
      </div>
    </div>
  );
};