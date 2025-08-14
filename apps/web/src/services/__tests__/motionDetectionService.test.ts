import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MotionDetectionService } from '../motionDetectionService';
import { createMockVideoElement, createImageDataWithMotion, createMockImageData } from '../../test/test-utils';
import { MockCanvasRenderingContext2D } from '../../test/setup';

describe('MotionDetectionService', () => {
  let service: MotionDetectionService;
  let mockVideoElement: HTMLVideoElement;
  let mockContext: MockCanvasRenderingContext2D;

  beforeEach(() => {
    service = new MotionDetectionService();
    mockVideoElement = createMockVideoElement({
      videoWidth: 1280,
      videoHeight: 720,
      readyState: 4
    });

    // Get the mock context to spy on its methods
    const canvas = document.createElement('canvas');
    mockContext = canvas.getContext('2d') as unknown as MockCanvasRenderingContext2D;
  });

  afterEach(() => {
    service.dispose();
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create service with default dimensions', () => {
      const defaultService = new MotionDetectionService();
      expect(defaultService).toBeInstanceOf(MotionDetectionService);
      defaultService.dispose();
    });

    it('should create canvas with correct dimensions', () => {
      const customService = new MotionDetectionService();
      
      // Access private canvas through reflection for testing
      const canvas = (customService as any).canvas as HTMLCanvasElement;
      expect(canvas.width).toBe(160);
      expect(canvas.height).toBe(160);
      
      customService.dispose();
    });
  });

  describe('detectMotion', () => {
    it('should return no motion for first frame', () => {
      const staticImageData = createMockImageData(320, 240, 'black');
      mockContext.getImageData.mockReturnValueOnce(staticImageData);

      const result = service.detectMotion(mockVideoElement, 50);

      expect(result).toEqual({
        hasMotion: false,
        motionStrength: 0,
        timestamp: expect.any(Number)
      });
      expect(mockContext.drawImage).toHaveBeenCalledWith(mockVideoElement, 0, 0, 320, 240);
      expect(mockContext.getImageData).toHaveBeenCalledWith(0, 0, 320, 240);
    });

    it('should detect motion between different frames', () => {
      const { static: staticFrame, withMotion: motionFrame } = createImageDataWithMotion(320, 240, 30);

      // First frame - no motion expected
      mockContext.getImageData.mockReturnValueOnce(staticFrame);
      const firstResult = service.detectMotion(mockVideoElement, 50);
      expect(firstResult.hasMotion).toBe(false);

      // Second frame with motion
      mockContext.getImageData.mockReturnValueOnce(motionFrame);
      const secondResult = service.detectMotion(mockVideoElement, 50);
      
      expect(secondResult.hasMotion).toBe(true);
      expect(secondResult.motionStrength).toBeGreaterThan(0);
      expect(secondResult.timestamp).toEqual(expect.any(Number));
    });

    it('should not detect motion with identical frames', () => {
      const staticFrame = createMockImageData(320, 240, 'black');
      
      // First frame
      mockContext.getImageData.mockReturnValueOnce(staticFrame);
      service.detectMotion(mockVideoElement, 50);

      // Second identical frame
      const identicalFrame = createMockImageData(320, 240, 'black');
      mockContext.getImageData.mockReturnValueOnce(identicalFrame);
      const result = service.detectMotion(mockVideoElement, 50);

      expect(result.hasMotion).toBe(false);
      expect(result.motionStrength).toBe(0);
    });

    it('should adjust sensitivity correctly - high sensitivity', () => {
      const { static: staticFrame, withMotion: motionFrame } = createImageDataWithMotion(320, 240, 10); // Low motion intensity

      // First frame
      mockContext.getImageData.mockReturnValueOnce(staticFrame);
      service.detectMotion(mockVideoElement, 90); // High sensitivity

      // Second frame with slight motion
      mockContext.getImageData.mockReturnValueOnce(motionFrame);
      const result = service.detectMotion(mockVideoElement, 90); // High sensitivity

      expect(result.hasMotion).toBe(true); // Should detect even small motion
      expect(result.motionStrength).toBeGreaterThan(0);
    });

    it('should adjust sensitivity correctly - low sensitivity', () => {
      const { static: staticFrame, withMotion: motionFrame } = createImageDataWithMotion(320, 240, 10); // Low motion intensity

      // First frame
      mockContext.getImageData.mockReturnValueOnce(staticFrame);
      service.detectMotion(mockVideoElement, 10); // Low sensitivity

      // Second frame with slight motion
      mockContext.getImageData.mockReturnValueOnce(motionFrame);
      const result = service.detectMotion(mockVideoElement, 10); // Low sensitivity

      expect(result.hasMotion).toBe(false); // Should not detect small motion
    });

    it('should handle errors gracefully', () => {
      // Mock an error in drawImage
      mockContext.drawImage.mockImplementationOnce(() => {
        throw new Error('Canvas error');
      });

      const result = service.detectMotion(mockVideoElement, 50);

      expect(result).toEqual({
        hasMotion: false,
        motionStrength: 0,
        timestamp: expect.any(Number)
      });
    });

    it('should validate sensitivity boundaries', () => {
      const { static: staticFrame, withMotion: motionFrame } = createImageDataWithMotion(320, 240, 50);

      // First frame
      mockContext.getImageData.mockReturnValueOnce(staticFrame);
      service.detectMotion(mockVideoElement, 1); // Minimum sensitivity

      mockContext.getImageData.mockReturnValueOnce(motionFrame);
      const minResult = service.detectMotion(mockVideoElement, 1);

      // Reset service for max sensitivity test
      service.reset();

      // First frame again
      mockContext.getImageData.mockReturnValueOnce(staticFrame);
      service.detectMotion(mockVideoElement, 100); // Maximum sensitivity

      mockContext.getImageData.mockReturnValueOnce(motionFrame);
      const maxResult = service.detectMotion(mockVideoElement, 100);

      // Both should work without errors
      expect(minResult.motionStrength).toBeGreaterThanOrEqual(0);
      expect(maxResult.motionStrength).toBeGreaterThanOrEqual(0);
      // Max sensitivity should generally detect motion more easily
      expect(maxResult.motionStrength).toBeGreaterThanOrEqual(minResult.motionStrength);
    });
  });

  describe('compareFrames', () => {
    it('should calculate motion strength correctly', () => {
      const { static: staticFrame, withMotion: motionFrame } = createImageDataWithMotion(320, 240, 50);

      // First frame to set up previous frame
      mockContext.getImageData.mockReturnValueOnce(staticFrame);
      service.detectMotion(mockVideoElement, 50);

      // Second frame with motion
      mockContext.getImageData.mockReturnValueOnce(motionFrame);
      const result = service.detectMotion(mockVideoElement, 50);

      expect(result.motionStrength).toBeGreaterThan(0);
      expect(result.motionStrength).toBeLessThanOrEqual(100);
    });

    it('should handle frames with different motion intensities', () => {
      const { static: staticFrame, withMotion: lightMotion } = createImageDataWithMotion(320, 240, 20);
      const { withMotion: heavyMotion } = createImageDataWithMotion(320, 240, 80);

      // Establish baseline
      mockContext.getImageData.mockReturnValueOnce(staticFrame);
      service.detectMotion(mockVideoElement, 50);

      // Test light motion
      mockContext.getImageData.mockReturnValueOnce(lightMotion);
      const lightResult = service.detectMotion(mockVideoElement, 50);

      // Reset and test heavy motion
      service.reset();
      mockContext.getImageData.mockReturnValueOnce(staticFrame);
      service.detectMotion(mockVideoElement, 50);

      mockContext.getImageData.mockReturnValueOnce(heavyMotion);
      const heavyResult = service.detectMotion(mockVideoElement, 50);

      expect(heavyResult.motionStrength).toBeGreaterThan(lightResult.motionStrength);
    });
  });

  describe('calculateThreshold', () => {
    it('should calculate correct threshold for different sensitivities', () => {
      // We can't directly test the private method, but we can test its effects
      const { static: staticFrame, withMotion: motionFrame } = createImageDataWithMotion(320, 240, 25); // Medium motion

      // Test with low sensitivity (high threshold)
      mockContext.getImageData.mockReturnValueOnce(staticFrame);
      service.detectMotion(mockVideoElement, 20);
      
      mockContext.getImageData.mockReturnValueOnce(motionFrame);
      const lowSensResult = service.detectMotion(mockVideoElement, 20);

      // Reset for high sensitivity test
      service.reset();

      // Test with high sensitivity (low threshold)
      mockContext.getImageData.mockReturnValueOnce(staticFrame);
      service.detectMotion(mockVideoElement, 80);
      
      mockContext.getImageData.mockReturnValueOnce(motionFrame);
      const highSensResult = service.detectMotion(mockVideoElement, 80);

      // High sensitivity should be more likely to detect motion
      if (lowSensResult.hasMotion === false) {
        expect(highSensResult.hasMotion).toBe(true);
      }
    });
  });

  describe('reset', () => {
    it('should reset previous frame', () => {
      // Establish a previous frame
      const staticFrame = createMockImageData(320, 240, 'black');
      mockContext.getImageData.mockReturnValueOnce(staticFrame);
      service.detectMotion(mockVideoElement, 50);

      // Reset the service
      service.reset();

      // Next detection should behave like first frame again
      const newFrame = createMockImageData(320, 240, 'white');
      mockContext.getImageData.mockReturnValueOnce(newFrame);
      const result = service.detectMotion(mockVideoElement, 50);

      expect(result.hasMotion).toBe(false);
      expect(result.motionStrength).toBe(0);
    });
  });

  // updateDimensions test removed - method no longer exists in simplified version

  describe('dispose', () => {
    it('should clean up resources', () => {
      // Set up some state
      const staticFrame = createMockImageData(320, 240, 'black');
      mockContext.getImageData.mockReturnValueOnce(staticFrame);
      service.detectMotion(mockVideoElement, 50);

      // Dispose should not throw
      expect(() => service.dispose()).not.toThrow();

      // Should be able to use service after dispose (it just resets)
      const newFrame = createMockImageData(320, 240, 'white');
      mockContext.getImageData.mockReturnValueOnce(newFrame);
      const result = service.detectMotion(mockVideoElement, 50);
      
      expect(result.hasMotion).toBe(false); // No previous frame after dispose
    });
  });

  describe('edge cases', () => {
    it('should handle empty or invalid image data', () => {
      // Mock getImageData to return invalid data
      const invalidImageData = {
        data: new Uint8ClampedArray(0), // Empty data
        width: 0,
        height: 0,
        colorSpace: 'srgb'
      } as ImageData;

      mockContext.getImageData.mockReturnValueOnce(invalidImageData);
      
      const result = service.detectMotion(mockVideoElement, 50);
      
      // Should handle gracefully
      expect(result.hasMotion).toBe(false);
      expect(result.motionStrength).toBe(0);
      expect(result.timestamp).toEqual(expect.any(Number));
    });

    it('should handle video element in invalid state', () => {
      const invalidVideo = createMockVideoElement({ readyState: 0 });
      
      const result = service.detectMotion(invalidVideo, 50);
      
      // Should still attempt detection (the method doesn't check readyState)
      expect(result.timestamp).toEqual(expect.any(Number));
    });

    it('should handle extreme sensitivity values gracefully', () => {
      const { static: staticFrame } = createImageDataWithMotion(320, 240, 50);

      // Test with sensitivity outside normal range
      mockContext.getImageData.mockReturnValueOnce(staticFrame);
      expect(() => service.detectMotion(mockVideoElement, -10)).not.toThrow();

      mockContext.getImageData.mockReturnValueOnce(staticFrame);
      expect(() => service.detectMotion(mockVideoElement, 1000)).not.toThrow();
    });
  });

  describe('performance considerations', () => {
    it('should use pixel sampling for performance', () => {
      const { static: staticFrame, withMotion: motionFrame } = createImageDataWithMotion(320, 240, 50);

      // The service uses step = 4, meaning it samples every 4th pixel
      // This is tested implicitly through the motion detection working correctly
      mockContext.getImageData.mockReturnValueOnce(staticFrame);
      service.detectMotion(mockVideoElement, 50);

      mockContext.getImageData.mockReturnValueOnce(motionFrame);
      const result = service.detectMotion(mockVideoElement, 50);

      expect(result.hasMotion).toBe(true);
      expect(result.motionStrength).toBeGreaterThan(0);
    });

    it('should normalize motion strength to 0-100 range', () => {
      const { static: staticFrame, withMotion: motionFrame } = createImageDataWithMotion(320, 240, 90);

      mockContext.getImageData.mockReturnValueOnce(staticFrame);
      service.detectMotion(mockVideoElement, 50);

      mockContext.getImageData.mockReturnValueOnce(motionFrame);
      const result = service.detectMotion(mockVideoElement, 50);

      expect(result.motionStrength).toBeGreaterThanOrEqual(0);
      expect(result.motionStrength).toBeLessThanOrEqual(100);
    });
  });
});