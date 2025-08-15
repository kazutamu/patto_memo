import React from 'react';
import styles from './VideoControls.module.css';

interface VideoControlsProps {
  isActive: boolean;
  onToggleCamera: () => void;
  disabled?: boolean;
}

export const VideoControls: React.FC<VideoControlsProps> = ({
  isActive,
  onToggleCamera,
  disabled = false,
}) => {

  return (
    <div className={styles.controls}>
      <div className={styles.controlGroup}>
        <button
          className={`${styles.toggleButton} ${isActive ? styles.active : ''}`}
          onClick={onToggleCamera}
          disabled={disabled}
          aria-label={isActive ? 'Turn camera off' : 'Turn camera on'}
          title={isActive ? 'Camera is active' : 'Camera is inactive'}
        >
          {isActive ? (
            // Video camera ON icon
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" stroke="none">
              <path d="M17 10.5V7a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-3.5l4 4v-11l-4 4z" />
            </svg>
          ) : (
            // Video camera OFF icon  
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M17 10.5V7a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-3.5l4 4v-11l-4 4z" />
              <line x1="1" y1="1" x2="23" y2="23" strokeLinecap="round" />
            </svg>
          )}
        </button>
      </div>


    </div>
  );
};