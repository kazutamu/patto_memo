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
            <div className={styles.aiIcon}>
              <div className={styles.spinnerRing}></div>
            </div>
            Analyzing
          </div>
          <div className={styles.timer}>
            {elapsedTime.toFixed(1)}s
          </div>
        </div>
      </div>
    </div>
  );
};