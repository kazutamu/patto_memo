import React from 'react';
import styles from './VideoControls.module.css';

interface VideoControlsProps {
  isActive: boolean;
  onToggleCamera: () => void;
  sensitivity: number;
  onSensitivityChange: (value: number) => void;
  disabled?: boolean;
}

export const VideoControls: React.FC<VideoControlsProps> = ({
  isActive,
  onToggleCamera,
  sensitivity,
  onSensitivityChange,
  disabled = false,
}) => {
  const handleSensitivityChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(event.target.value, 10);
    onSensitivityChange(value);
  };

  return (
    <div className={styles.controls}>
      <div className={styles.controlGroup}>
        <label className={styles.controlLabel}>Camera</label>
        <button
          className={`${styles.toggleButton} ${isActive ? styles.active : ''}`}
          onClick={onToggleCamera}
          disabled={disabled}
          aria-label={isActive ? 'Turn camera off' : 'Turn camera on'}
        >
          <span className={styles.toggleIcon}>
            {isActive ? '📹' : '📷'}
          </span>
          <span className={styles.toggleText}>
            {isActive ? 'On' : 'Off'}
          </span>
        </button>
      </div>

      <div className={styles.controlGroup}>
        <label htmlFor="sensitivity-slider" className={styles.controlLabel}>
          Motion Sensitivity
        </label>
        <div className={styles.sliderContainer}>
          <input
            id="sensitivity-slider"
            type="range"
            min="1"
            max="100"
            value={sensitivity}
            onChange={handleSensitivityChange}
            disabled={disabled}
            className={styles.slider}
            aria-label="Motion detection sensitivity"
          />
          <div className={styles.sliderLabels}>
            <span className={styles.sliderLabel}>Low</span>
            <span className={styles.sliderValue}>{sensitivity}%</span>
            <span className={styles.sliderLabel}>High</span>
          </div>
        </div>
        <p className={styles.controlDescription}>
          Adjust how sensitive the motion detection should be
        </p>
      </div>

      <div className={styles.controlGroup}>
        <div className={styles.statusIndicator}>
          <div className={`${styles.statusDot} ${isActive ? styles.active : ''}`}></div>
          <span className={styles.statusText}>
            {isActive ? 'Ready for detection' : 'Camera inactive'}
          </span>
        </div>
      </div>
    </div>
  );
};