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
      // Get actual video dimensions to maintain aspect ratio
      const videoWidth = videoElement.videoWidth;
      const videoHeight = videoElement.videoHeight;
      
      if (!videoWidth || !videoHeight) {
        console.warn('Video dimensions not ready');
        return null;
      }
      
      // Calculate proper dimensions maintaining aspect ratio
      const aspectRatio = videoWidth / videoHeight;
      let canvasWidth = 640;
      let canvasHeight = Math.round(canvasWidth / aspectRatio);
      
      // If height exceeds max, scale based on height instead
      if (canvasHeight > 480) {
        canvasHeight = 480;
        canvasWidth = Math.round(canvasHeight * aspectRatio);
      }
      
      // Create canvas with proper dimensions
      const canvas = document.createElement('canvas');
      canvas.width = canvasWidth;
      canvas.height = canvasHeight;
      
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;

      // Draw video frame maintaining aspect ratio
      ctx.drawImage(videoElement, 0, 0, canvasWidth, canvasHeight);
      
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

// Export simplified capture utility with shorter interval for testing
export const frameCapture = new FrameCapture(3000); // 3 seconds instead of 5