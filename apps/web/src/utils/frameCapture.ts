/**
 * Utility functions for capturing and processing video frames
 */

/**
 * Captures a frame from a video element and returns it as base64
 * @param videoElement - The video element to capture from
 * @param quality - JPEG quality (0.1 to 1.0, default 0.8)
 * @returns Base64 encoded image string (without data URI prefix)
 */
export function captureVideoFrame(videoElement: HTMLVideoElement, quality: number = 0.8): string | null {
  try {
    // Create a canvas with the same dimensions as the video
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    
    if (!context) {
      throw new Error('Could not get 2D context from canvas');
    }

    // Set canvas size to match video
    canvas.width = videoElement.videoWidth;
    canvas.height = videoElement.videoHeight;

    // Draw the current video frame to canvas
    context.drawImage(videoElement, 0, 0, canvas.width, canvas.height);

    // Convert to base64 (JPEG for smaller size)
    const dataURL = canvas.toDataURL('image/jpeg', quality);
    
    // Remove the data URI prefix to get just the base64 string
    const base64 = dataURL.split(',')[1];
    
    return base64;
  } catch (error) {
    console.error('Error capturing video frame:', error);
    return null;
  }
}

/**
 * Captures a smaller frame for faster processing
 * @param videoElement - The video element to capture from
 * @param maxWidth - Maximum width for the captured frame (default 640)
 * @param quality - JPEG quality (0.1 to 1.0, default 0.7)
 * @returns Base64 encoded image string
 */
export function captureCompressedFrame(
  videoElement: HTMLVideoElement, 
  maxWidth: number = 640, 
  quality: number = 0.7
): string | null {
  try {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    
    if (!context) {
      throw new Error('Could not get 2D context from canvas');
    }

    // Calculate scaled dimensions while maintaining aspect ratio
    const videoWidth = videoElement.videoWidth;
    const videoHeight = videoElement.videoHeight;
    const aspectRatio = videoHeight / videoWidth;
    
    const scaledWidth = Math.min(maxWidth, videoWidth);
    const scaledHeight = Math.round(scaledWidth * aspectRatio);
    
    canvas.width = scaledWidth;
    canvas.height = scaledHeight;

    // Draw the scaled video frame
    context.drawImage(videoElement, 0, 0, scaledWidth, scaledHeight);

    // Convert to base64
    const dataURL = canvas.toDataURL('image/jpeg', quality);
    const base64 = dataURL.split(',')[1];
    
    return base64;
  } catch (error) {
    console.error('Error capturing compressed frame:', error);
    return null;
  }
}

/**
 * Throttled frame capture to avoid overwhelming the AI service
 */
export class ThrottledFrameCapture {
  private lastCaptureTime: number = 0;
  private readonly throttleDelay: number;

  constructor(throttleDelayMs: number = 5000) { // 5 seconds by default
    this.throttleDelay = throttleDelayMs;
  }

  /**
   * Capture frame only if enough time has passed since last capture
   * @param videoElement - The video element to capture from
   * @param quality - JPEG quality
   * @returns Base64 encoded image string or null if throttled
   */
  captureIfReady(videoElement: HTMLVideoElement, quality: number = 0.7): string | null {
    const now = Date.now();
    if (now - this.lastCaptureTime >= this.throttleDelay) {
      this.lastCaptureTime = now;
      return captureCompressedFrame(videoElement, 640, quality);
    }
    return null;
  }

  /**
   * Reset the throttle timer
   */
  reset(): void {
    this.lastCaptureTime = 0;
  }
}