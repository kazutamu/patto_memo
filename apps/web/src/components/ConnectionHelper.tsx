import React from 'react';
import styles from './ConnectionHelper.module.css';

interface ConnectionHelperProps {
  currentUrl: string;
  isVisible: boolean;
  onClose: () => void;
}

export const ConnectionHelper: React.FC<ConnectionHelperProps> = ({ 
  currentUrl, 
  isVisible, 
  onClose 
}) => {
  if (!isVisible) return null;

  // Generate a simple QR code using qr-server.com API
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(currentUrl)}`;

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <h3>📱 Mobile Connection Helper</h3>
          <button className={styles.closeButton} onClick={onClose}>×</button>
        </div>
        
        <div className={styles.content}>
          <div className={styles.section}>
            <h4>🔗 Easy Access</h4>
            <div className={styles.qrSection}>
              <img src={qrCodeUrl} alt="QR Code" className={styles.qrCode} />
              <p>Scan this QR code with your mobile device</p>
            </div>
          </div>

          <div className={styles.section}>
            <h4>📧 Manual Connection</h4>
            <div className={styles.urlSection}>
              <code className={styles.url}>{currentUrl}</code>
              <button 
                className={styles.copyButton} 
                onClick={() => navigator.clipboard?.writeText(currentUrl)}
              >
                Copy
              </button>
            </div>
          </div>

          <div className={styles.section}>
            <h4>🌐 Browser Recommendations</h4>
            <div className={styles.browserTips}>
              <div className={styles.browserTip}>
                <strong>✅ Firefox Mobile</strong> - Works best with self-signed certificates
              </div>
              <div className={styles.browserTip}>
                <strong>⚠️ Safari/Chrome Mobile</strong> - May require accepting security warnings
              </div>
            </div>
          </div>

          <div className={styles.section}>
            <h4>🔒 Security Warning Steps</h4>
            <div className={styles.steps}>
              <div className={styles.step}>
                <strong>1.</strong> You'll see "Not Secure" or "This Connection Is Not Private"
              </div>
              <div className={styles.step}>
                <strong>2.</strong> Tap "Advanced" or "Show Details"  
              </div>
              <div className={styles.step}>
                <strong>3.</strong> Tap "Proceed" or "Visit This Website"
              </div>
              <div className={styles.step}>
                <strong>4.</strong> Allow camera access when prompted
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};