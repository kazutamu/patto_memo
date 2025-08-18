/**
 * Shared animation constants for streaming text and timing calculations
 */

export const ANIMATION_CONSTANTS = {
  // Streaming text animation speed (characters per second)
  STREAMING_SPEED: 25,
  
  // Initial delay before streaming starts (milliseconds)
  STREAMING_DELAY: 200,
  
  // Buffer time before next frame capture (milliseconds)
  FRAME_BUFFER_TIME: 200,
  
  // Default streaming speed fallback
  DEFAULT_STREAMING_SPEED: 30,
  
  // Default delay fallback
  DEFAULT_STREAMING_DELAY: 100,
} as const;

/**
 * Calculate optimal response length for animation timing
 * @param intervalSeconds - Frame capture interval in seconds
 * @returns Optimal character count for response
 */
export function calculateOptimalResponseLength(intervalSeconds: number): number {
  const availableAnimationTime = (intervalSeconds * 1000) - 
                                ANIMATION_CONSTANTS.STREAMING_DELAY - 
                                ANIMATION_CONSTANTS.FRAME_BUFFER_TIME;
  
  return Math.floor((availableAnimationTime / 1000) * ANIMATION_CONSTANTS.STREAMING_SPEED);
}