import { MotionDetectionResult } from '../types';
import { MOTION_DETECTION, DEVICE } from '../config/constants';

/**
 * Simple motion detection service using pixel difference comparison
 * This service processes video frames and detects motion by comparing pixel differences
 */
export class MotionDetectionService {
  private previousFrame: ImageData | null = null;
  private canvas: HTMLCanvasElement;
  private context: CanvasRenderingContext2D;
  private isMobile: boolean = false;

  constructor(width: number = MOTION_DETECTION.CANVAS_WIDTH, height: number = MOTION_DETECTION.CANVAS_HEIGHT) {
    // Create an offscreen canvas for frame processing
    this.canvas = document.createElement('canvas');
    this.canvas.width = width;
    this.canvas.height = height;
    this.context = this.canvas.getContext('2d')!;
    
    // Detect mobile device for performance optimization
    this.detectMobile();
  }

  /**
   * Detect if the device is mobile for performance optimization
   */
  private detectMobile(): void {
    const userAgent = navigator.userAgent.toLowerCase();
    const isMobileDevice = DEVICE.MOBILE_KEYWORDS.some(keyword => userAgent.includes(keyword));
    const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    this.isMobile = isMobileDevice || isTouchDevice;
  }

  /**
   * Process a video frame and detect motion
   * @param videoElement - The video element to process
   * @param sensitivity - Motion sensitivity (1-100, higher = more sensitive)
   * @returns Motion detection result
   */
  public detectMotion(
    videoElement: HTMLVideoElement, 
    sensitivity: number = MOTION_DETECTION.DEFAULT_SENSITIVITY
  ): MotionDetectionResult {
    try {
      // Capture current frame
      this.context.drawImage(videoElement, 0, 0, this.canvas.width, this.canvas.height);
      const currentFrame = this.context.getImageData(0, 0, this.canvas.width, this.canvas.height);

      // If this is the first frame, store it and return no motion
      if (!this.previousFrame) {
        this.previousFrame = currentFrame;
        return {
          hasMotion: false,
          motionStrength: 0,
          timestamp: Date.now()
        };
      }

      // Compare frames and calculate motion strength
      const motionStrength = this.compareFrames(currentFrame, this.previousFrame, sensitivity);
      
      // Determine if motion threshold is exceeded
      const threshold = this.calculateThreshold(sensitivity);
      const hasMotion = motionStrength > threshold;

      // Update previous frame
      this.previousFrame = currentFrame;

      return {
        hasMotion,
        motionStrength,
        timestamp: Date.now()
      };
    } catch (error) {
      console.error('Motion detection error:', error);
      return {
        hasMotion: false,
        motionStrength: 0,
        timestamp: Date.now()
      };
    }
  }

  /**
   * Compare two frames and calculate motion strength
   * @param currentFrame - Current frame image data
   * @param previousFrame - Previous frame image data
   * @param sensitivity - Motion sensitivity level
   * @returns Motion strength value (0-100)
   */
  private compareFrames(
    currentFrame: ImageData, 
    previousFrame: ImageData, 
    sensitivity: number
  ): number {
    const current = currentFrame.data;
    const previous = previousFrame.data;
    let totalDiff = 0;
    let pixelCount = 0;

    // Adaptive sampling based on device type
    // Mobile devices use more aggressive sampling for better performance
    const step = this.isMobile ? MOTION_DETECTION.MOBILE_PIXEL_SAMPLING : MOTION_DETECTION.DESKTOP_PIXEL_SAMPLING;
    
    for (let i = 0; i < current.length; i += step * 4) {
      // Calculate RGB difference (skip alpha channel)
      const rDiff = Math.abs(current[i] - previous[i]);
      const gDiff = Math.abs(current[i + 1] - previous[i + 1]);
      const bDiff = Math.abs(current[i + 2] - previous[i + 2]);
      
      // Calculate average difference for this pixel
      const pixelDiff = (rDiff + gDiff + bDiff) / 3;
      
      // Adaptive noise threshold - higher for mobile to reduce processing
      const noiseThreshold = this.isMobile ? MOTION_DETECTION.NOISE_THRESHOLD_MOBILE : MOTION_DETECTION.NOISE_THRESHOLD_DESKTOP;
      
      // Only count significant differences to reduce noise
      if (pixelDiff > noiseThreshold) {
        totalDiff += pixelDiff;
        pixelCount++;
      }
    }

    // Calculate normalized motion strength (0-100)
    if (pixelCount === 0) return 0;
    
    const averageDiff = totalDiff / pixelCount;
    const normalizedStrength = Math.min(MOTION_DETECTION.MAX_SENSITIVITY, (averageDiff / 255) * 100 * (sensitivity / MOTION_DETECTION.DEFAULT_SENSITIVITY));
    
    return normalizedStrength;
  }

  /**
   * Calculate motion threshold based on sensitivity
   * @param sensitivity - Sensitivity level (1-100)
   * @returns Threshold value for motion detection
   */
  private calculateThreshold(sensitivity: number): number {
    // Higher sensitivity = lower threshold
    // Sensitivity 1 = threshold 50, Sensitivity 100 = threshold 1
    return Math.max(MOTION_DETECTION.MIN_SENSITIVITY, 51 - (sensitivity * 0.5));
  }

  /**
   * Reset the motion detection state
   */
  public reset(): void {
    this.previousFrame = null;
  }

  /**
   * Update canvas dimensions
   */
  public updateDimensions(width: number, height: number): void {
    this.canvas.width = width;
    this.canvas.height = height;
    this.reset(); // Reset previous frame when dimensions change
  }

  /**
   * Clean up resources
   */
  public dispose(): void {
    this.previousFrame = null;
    // Canvas will be garbage collected
  }
}

// Export a singleton instance for shared use
export const motionDetectionService = new MotionDetectionService();