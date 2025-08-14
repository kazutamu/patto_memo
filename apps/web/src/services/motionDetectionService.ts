import { MotionDetectionResult } from '../types';

/**
 * Simplified motion detection service using basic frame comparison
 * Optimized for performance and simplicity
 */
export class MotionDetectionService {
  private previousFrame: Uint8ClampedArray | null = null;
  private canvas: HTMLCanvasElement;
  private context: CanvasRenderingContext2D;
  private readonly CANVAS_SIZE = 160; // Small size for fast processing

  constructor() {
    // Create small offscreen canvas for efficient processing
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.CANVAS_SIZE;
    this.canvas.height = this.CANVAS_SIZE;
    this.context = this.canvas.getContext('2d', { 
      willReadFrequently: true,
      alpha: false 
    })!;
  }

  /**
   * Detect motion by comparing current frame with previous
   * @param videoElement - The video element to process
   * @param sensitivity - Motion sensitivity (1-100)
   * @returns Motion detection result
   */
  public detectMotion(
    videoElement: HTMLVideoElement, 
    sensitivity: number = 50
  ): MotionDetectionResult {
    try {
      // Draw video frame to small canvas
      this.context.drawImage(
        videoElement, 
        0, 0, 
        this.CANVAS_SIZE, 
        this.CANVAS_SIZE
      );
      
      // Get pixel data
      const imageData = this.context.getImageData(
        0, 0, 
        this.CANVAS_SIZE, 
        this.CANVAS_SIZE
      );
      const currentFrame = imageData.data;

      // First frame - no motion
      if (!this.previousFrame) {
        this.previousFrame = new Uint8ClampedArray(currentFrame);
        return {
          hasMotion: false,
          motionStrength: 0,
          timestamp: Date.now()
        };
      }

      // Calculate motion strength
      const motionStrength = this.calculateMotion(
        currentFrame, 
        this.previousFrame, 
        sensitivity
      );

      // Update previous frame
      this.previousFrame.set(currentFrame);

      // Simple threshold: motion detected if strength > 5%
      const hasMotion = motionStrength > 5;

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
   * Calculate motion strength between frames
   * Simplified algorithm for better performance
   */
  private calculateMotion(
    current: Uint8ClampedArray, 
    previous: Uint8ClampedArray,
    sensitivity: number
  ): number {
    let changedPixels = 0;
    const pixelCount = current.length / 4;
    const threshold = 100 - sensitivity; // Higher sensitivity = lower threshold
    
    // Sample every 16th pixel for speed (4x4 grid sampling)
    for (let i = 0; i < current.length; i += 64) {
      // Simple luminance calculation
      const currentLuma = (current[i] + current[i+1] + current[i+2]) / 3;
      const previousLuma = (previous[i] + previous[i+1] + previous[i+2]) / 3;
      
      // Count significant changes
      if (Math.abs(currentLuma - previousLuma) > threshold) {
        changedPixels++;
      }
    }
    
    // Calculate percentage of changed pixels (0-100)
    const sampledPixels = pixelCount / 16;
    const percentage = (changedPixels / sampledPixels) * 100;
    
    return Math.min(100, percentage * 2); // Scale up for visibility
  }

  /**
   * Reset detection state
   */
  public reset(): void {
    this.previousFrame = null;
  }

  /**
   * Clean up resources
   */
  public dispose(): void {
    this.previousFrame = null;
    this.canvas.remove();
  }
}

// Export singleton instance
export const motionDetectionService = new MotionDetectionService();