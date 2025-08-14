/**
 * Shared validation utilities
 */

/**
 * Validates if a value is within a specified range
 */
export function validateRange(value: number, min: number, max: number): boolean {
  return value >= min && value <= max;
}

/**
 * Validates sensitivity value (0.1 to 1.0)
 */
export function validateSensitivity(sensitivity: number): boolean {
  return validateRange(sensitivity, 0.1, 1.0);
}

/**
 * Validates confidence value (0.0 to 1.0)
 */
export function validateConfidence(confidence: number): boolean {
  return validateRange(confidence, 0.0, 1.0);
}

/**
 * Validates base64 encoded string
 */
export function isValidBase64(str: string): boolean {
  try {
    return btoa(atob(str)) === str;
  } catch (err) {
    return false;
  }
}

/**
 * Validates image data URL
 */
export function isValidImageDataUrl(dataUrl: string): boolean {
  return /^data:image\/(png|jpeg|jpg|webp);base64,/.test(dataUrl);
}

/**
 * Validates WebSocket URL
 */
export function isValidWebSocketUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'ws:' || parsed.protocol === 'wss:';
  } catch {
    return false;
  }
}