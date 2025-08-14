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
 * LLaVA-optimized resolutions for best AI processing performance
 */
interface LLaVAResolution {
  width: number;
  height: number;
  description: string;
}

const LLAVA_OPTIMAL_RESOLUTIONS: LLaVAResolution[] = [
  { width: 336, height: 336, description: 'Square - fastest processing' },
  { width: 336, height: 672, description: 'Portrait aspect ratio' },
  { width: 672, height: 336, description: 'Landscape aspect ratio' },
];

/**
 * Selects optimal LLaVA resolution based on video aspect ratio
 * @param aspectRatio - Video height / width ratio
 * @returns Optimal resolution for LLaVA processing
 */
function selectOptimalLLaVAResolution(aspectRatio: number): LLaVAResolution {
  if (aspectRatio > 1.5) {
    return LLAVA_OPTIMAL_RESOLUTIONS[1]; // Portrait: 336x672
  }
  if (aspectRatio < 0.67) {
    return LLAVA_OPTIMAL_RESOLUTIONS[2]; // Landscape: 672x336
  }
  return LLAVA_OPTIMAL_RESOLUTIONS[0]; // Square: 336x336 (fastest)
}

/**
 * Calculates adaptive quality based on motion strength
 * Higher motion = higher quality for better AI analysis
 * @param motionStrength - Motion detection strength (0-100)
 * @returns JPEG quality (0.4-0.8)
 */
function calculateAdaptiveQuality(motionStrength: number): number {
  // Base quality range: 0.5-0.8, with motion-based adjustment
  return Math.max(0.4, Math.min(0.8, 0.5 + (motionStrength / 100) * 0.3));
}

/**
 * Captures frame optimized for LLaVA AI analysis
 * Uses LLaVA-optimal dimensions (336px base) and motion-adaptive quality
 * @param videoElement - The video element to capture from
 * @param motionStrength - Current motion strength for adaptive quality (0-100)
 * @returns Base64 encoded image string optimized for LLaVA
 */
export function captureLLaVAOptimizedFrame(
  videoElement: HTMLVideoElement,
  motionStrength: number = 50
): string | null {
  try {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    
    if (!context) {
      throw new Error('Could not get 2D context from canvas');
    }

    // Calculate optimal LLaVA resolution based on video aspect ratio
    const videoWidth = videoElement.videoWidth;
    const videoHeight = videoElement.videoHeight;
    const aspectRatio = videoHeight / videoWidth;
    const targetResolution = selectOptimalLLaVAResolution(aspectRatio);
    
    canvas.width = targetResolution.width;
    canvas.height = targetResolution.height;

    // Draw the video frame to LLaVA-optimal dimensions
    context.drawImage(videoElement, 0, 0, targetResolution.width, targetResolution.height);

    // Apply motion-adaptive quality
    const quality = calculateAdaptiveQuality(motionStrength);

    // Convert to base64 with optimized settings
    const dataURL = canvas.toDataURL('image/jpeg', quality);
    const base64 = dataURL.split(',')[1];
    
    return base64;
  } catch (error) {
    console.error('Error capturing LLaVA-optimized frame:', error);
    return null;
  }
}

/**
 * Legacy function - maintains compatibility but now uses LLaVA optimization
 * @param videoElement - The video element to capture from
 * @param _maxWidth - Maximum width (deprecated, now uses LLaVA-optimal 336px)
 * @param _quality - JPEG quality (0.1 to 1.0, default 0.7)
 * @returns Base64 encoded image string
 * @deprecated Use captureLLaVAOptimizedFrame for better AI performance
 */
export function captureCompressedFrame(
  videoElement: HTMLVideoElement, 
  _maxWidth: number = 336, // Changed default to LLaVA-optimal
  _quality: number = 0.7
): string | null {
  // For backward compatibility, estimate motion strength as medium
  const estimatedMotionStrength = 50;
  return captureLLaVAOptimizedFrame(videoElement, estimatedMotionStrength);
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
   * Capture LLaVA-optimized frame only if enough time has passed since last capture
   * @param videoElement - The video element to capture from
   * @param motionStrength - Current motion strength for adaptive quality (0-100)
   * @returns Base64 encoded image string or null if throttled
   */
  captureIfReady(videoElement: HTMLVideoElement, motionStrength: number = 50): string | null {
    const now = Date.now();
    if (now - this.lastCaptureTime >= this.throttleDelay) {
      this.lastCaptureTime = now;
      return captureLLaVAOptimizedFrame(videoElement, motionStrength);
    }
    return null;
  }

  /**
   * Legacy method for backward compatibility
   * @deprecated Use captureIfReady with motionStrength parameter
   */
  captureIfReadyLegacy(videoElement: HTMLVideoElement, _quality: number = 0.7): string | null {
    return this.captureIfReady(videoElement, 50); // Use medium motion strength
  }

  /**
   * Reset the throttle timer
   */
  reset(): void {
    this.lastCaptureTime = 0;
  }
}