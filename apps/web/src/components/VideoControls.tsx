import React from 'react';
import { MotionDetectionState } from '../types';
import styles from './VideoControls.module.css';

interface VideoControlsProps {
  isActive: boolean;
  onToggleCamera: () => void;
  sensitivity: number;
  onSensitivityChange: (value: number) => void;
  disabled?: boolean;
  motionState?: MotionDetectionState;
}

export const VideoControls: React.FC<VideoControlsProps> = ({
  isActive,
  onToggleCamera,
  sensitivity,
  onSensitivityChange,
  disabled = false,
  motionState,
}) => {
  const handleSensitivityChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(event.target.value, 10);
    onSensitivityChange(value);
  };

  const getMotionStatusText = () => {
    if (!isActive) return 'Camera inactive';
    if (!motionState?.isDetecting) return 'Motion detection inactive';
    if (motionState.motionStrength > 0) return 'Motion detected!';
    return 'Monitoring for motion';
  };

  const getMotionStatusClass = () => {
    if (!isActive) return '';
    if (!motionState?.isDetecting) return styles.inactive;
    if (motionState.motionStrength > 0) return styles.motionActive;
    return styles.monitoring;
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
        <label className={styles.controlLabel}>Motion Detection Status</label>
        <div className={styles.statusIndicator}>
          <div className={`${styles.statusDot} ${getMotionStatusClass()}`}></div>
          <span className={styles.statusText}>
            {getMotionStatusText()}
          </span>
        </div>
        {motionState?.isDetecting && (
          <div className={styles.motionDetails}>
            <div className={styles.motionStrength}>
              <span className={styles.motionLabel}>Motion Strength:</span>
              <div className={styles.strengthBar}>
                <div 
                  className={styles.strengthFill}
                  style={{ width: `${Math.min(100, motionState.motionStrength)}%` }}
                ></div>
              </div>
              <span className={styles.strengthValue}>
                {motionState.motionStrength.toFixed(1)}%
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};