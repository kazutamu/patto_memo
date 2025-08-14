/**
 * Simplified frame capture utility for AI analysis
 * Handles frame extraction and basic throttling
 */
export class FrameCapture {
  private lastCaptureTime: number = 0;
  private readonly MIN_INTERVAL_MS: number;

  constructor(minIntervalMs: number = 5000) {
    this.MIN_INTERVAL_MS = minIntervalMs;
  }

  /**
   * Capture a frame from video if enough time has passed
   * @param videoElement - Video element to capture from
   * @returns Base64 encoded frame or null if throttled
   */
  public capture(videoElement: HTMLVideoElement): string | null {
    const now = Date.now();
    
    // Throttle captures
    if (now - this.lastCaptureTime < this.MIN_INTERVAL_MS) {
      return null;
    }

    try {
      // Create canvas at reasonable size for AI analysis
      const canvas = document.createElement('canvas');
      canvas.width = 640;
      canvas.height = 480;
      
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;

      // Draw video frame
      ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
      
      // Convert to base64 with compression
      const base64 = canvas.toDataURL('image/jpeg', 0.7);
      
      // Update last capture time
      this.lastCaptureTime = now;
      
      // Return base64 without data URL prefix
      return base64.replace(/^data:image\/\w+;base64,/, '');
    } catch (error) {
      console.error('Frame capture failed:', error);
      return null;
    }
  }

  /**
   * Reset throttle timer
   */
  public reset(): void {
    this.lastCaptureTime = 0;
  }
}

// Export simplified capture utility
export const frameCapture = new FrameCapture();