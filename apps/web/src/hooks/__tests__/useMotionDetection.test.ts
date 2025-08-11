import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useMotionDetection } from '../useMotionDetection';
import { motionDetectionService } from '../../services/motionDetectionService';
import { createMockVideoElement, waitForTicks } from '../../test/test-utils';
import { MotionDetectionResult } from '../../types';

// Mock the motion detection service
vi.mock('../../services/motionDetectionService', () => ({
  motionDetectionService: {
    detectMotion: vi.fn(),
    reset: vi.fn(),
  },
}));

describe('useMotionDetection', () => {
  let mockVideoElement: HTMLVideoElement;
  const mockMotionService = motionDetectionService as any;

  beforeEach(() => {
    mockVideoElement = createMockVideoElement({
      readyState: 4,
      videoWidth: 1280,
      videoHeight: 720
    });

    // Reset all mocks
    vi.clearAllMocks();
    vi.useFakeTimers();

    // Default mock return value - no motion
    mockMotionService.detectMotion.mockReturnValue({
      hasMotion: false,
      motionStrength: 0,
      timestamp: Date.now()
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  describe('initialization', () => {
    it('should initialize with correct default state', () => {
      const { result } = renderHook(() =>
        useMotionDetection({
          videoElement: mockVideoElement,
          isActive: false,
          sensitivity: 50
        })
      );

      expect(result.current.motionState).toEqual({
        isDetecting: false,
        motionStrength: 0,
        lastMotionTime: null,
        sensitivity: 50
      });

      expect(result.current.lastResult).toBeNull();
    });

    it('should update sensitivity when prop changes', () => {
      const { result, rerender } = renderHook(
        ({ sensitivity }) =>
          useMotionDetection({
            videoElement: mockVideoElement,
            isActive: false,
            sensitivity
          }),
        {
          initialProps: { sensitivity: 50 }
        }
      );

      // Initial sensitivity
      expect(result.current.motionState.sensitivity).toBe(50);

      // Update sensitivity
      rerender({ sensitivity: 80 });

      expect(result.current.motionState.sensitivity).toBe(80);
    });
  });

  describe('detection lifecycle', () => {
    it('should start detection when isActive becomes true', async () => {
      const { result, rerender } = renderHook(
        ({ isActive }) =>
          useMotionDetection({
            videoElement: mockVideoElement,
            isActive,
            sensitivity: 50
          }),
        {
          initialProps: { isActive: false }
        }
      );

      expect(result.current.motionState.isDetecting).toBe(false);

      // Activate detection
      rerender({ isActive: true });

      // Wait for the 500ms delay in useEffect
      act(() => {
        vi.advanceTimersByTime(500);
      });

      await waitFor(() => {
        expect(result.current.motionState.isDetecting).toBe(true);
      });
    });

    it('should stop detection when isActive becomes false', async () => {
      const { result, rerender } = renderHook(
        ({ isActive }) =>
          useMotionDetection({
            videoElement: mockVideoElement,
            isActive,
            sensitivity: 50
          }),
        {
          initialProps: { isActive: true }
        }
      );

      // Start detection
      act(() => {
        vi.advanceTimersByTime(500);
      });

      await waitFor(() => {
        expect(result.current.motionState.isDetecting).toBe(true);
      });

      // Deactivate detection
      rerender({ isActive: false });

      await waitFor(() => {
        expect(result.current.motionState.isDetecting).toBe(false);
      });
    });

    it('should not start detection without video element', () => {
      const { result } = renderHook(() =>
        useMotionDetection({
          videoElement: null,
          isActive: true,
          sensitivity: 50
        })
      );

      act(() => {
        vi.advanceTimersByTime(500);
      });

      expect(result.current.motionState.isDetecting).toBe(false);
    });
  });

  describe('motion detection process', () => {
    it('should process motion detection at regular intervals', async () => {
      const { result } = renderHook(() =>
        useMotionDetection({
          videoElement: mockVideoElement,
          isActive: true,
          sensitivity: 50,
          detectionInterval: 100
        })
      );

      // Start detection
      act(() => {
        vi.advanceTimersByTime(500);
      });

      await waitFor(() => {
        expect(result.current.motionState.isDetecting).toBe(true);
      });

      // Advance timers to trigger several detection cycles
      act(() => {
        vi.advanceTimersByTime(300); // 3 detection cycles
      });

      expect(mockMotionService.detectMotion).toHaveBeenCalledTimes(3);
      expect(mockMotionService.detectMotion).toHaveBeenCalledWith(mockVideoElement, 50);
    });

    it('should handle motion detection results', async () => {
      const motionResult: MotionDetectionResult = {
        hasMotion: true,
        motionStrength: 75,
        timestamp: 1640995200000
      };

      mockMotionService.detectMotion.mockReturnValue(motionResult);

      const { result } = renderHook(() =>
        useMotionDetection({
          videoElement: mockVideoElement,
          isActive: true,
          sensitivity: 50,
          detectionInterval: 100
        })
      );

      // Start detection
      act(() => {
        vi.advanceTimersByTime(500);
      });

      await waitFor(() => {
        expect(result.current.motionState.isDetecting).toBe(true);
      });

      // Trigger detection
      act(() => {
        vi.advanceTimersByTime(100);
      });

      await waitFor(() => {
        expect(result.current.motionState.motionStrength).toBe(75);
        expect(result.current.motionState.lastMotionTime).toBe(1640995200000);
        expect(result.current.lastResult).toEqual(motionResult);
      });
    });

    it('should not update lastMotionTime for non-motion results', async () => {
      // First, set up a motion detection
      const motionResult: MotionDetectionResult = {
        hasMotion: true,
        motionStrength: 50,
        timestamp: 1640995200000
      };

      mockMotionService.detectMotion.mockReturnValueOnce(motionResult);

      const { result } = renderHook(() =>
        useMotionDetection({
          videoElement: mockVideoElement,
          isActive: true,
          sensitivity: 50,
          detectionInterval: 100
        })
      );

      // Start detection and get initial motion
      act(() => {
        vi.advanceTimersByTime(600); // Start + one detection
      });

      await waitFor(() => {
        expect(result.current.motionState.lastMotionTime).toBe(1640995200000);
      });

      // Now return no motion
      const noMotionResult: MotionDetectionResult = {
        hasMotion: false,
        motionStrength: 0,
        timestamp: 1640995300000
      };

      mockMotionService.detectMotion.mockReturnValue(noMotionResult);

      // Trigger another detection
      act(() => {
        vi.advanceTimersByTime(100);
      });

      await waitFor(() => {
        expect(result.current.motionState.motionStrength).toBe(0);
        expect(result.current.motionState.lastMotionTime).toBe(1640995200000); // Should not change
        expect(result.current.lastResult).toEqual(noMotionResult);
      });
    });

    it('should skip detection when video is not ready', async () => {
      const notReadyVideo = createMockVideoElement({ readyState: 1 }); // HAVE_METADATA

      const { result } = renderHook(() =>
        useMotionDetection({
          videoElement: notReadyVideo,
          isActive: true,
          sensitivity: 50,
          detectionInterval: 100
        })
      );

      act(() => {
        vi.advanceTimersByTime(600); // Start + one detection cycle
      });

      // Detection should not be called for unready video
      expect(mockMotionService.detectMotion).not.toHaveBeenCalled();
    });

    it('should handle errors during detection gracefully', async () => {
      mockMotionService.detectMotion.mockImplementation(() => {
        throw new Error('Detection error');
      });

      const { result } = renderHook(() =>
        useMotionDetection({
          videoElement: mockVideoElement,
          isActive: true,
          sensitivity: 50,
          detectionInterval: 100
        })
      );

      // Should not throw error
      expect(() => {
        act(() => {
          vi.advanceTimersByTime(600);
        });
      }).not.toThrow();

      // State should remain stable
      expect(result.current.motionState.isDetecting).toBe(true);
    });
  });

  describe('manual controls', () => {
    it('should allow manual start of detection', async () => {
      const { result } = renderHook(() =>
        useMotionDetection({
          videoElement: mockVideoElement,
          isActive: false, // Not auto-active
          sensitivity: 50
        })
      );

      expect(result.current.motionState.isDetecting).toBe(false);

      // Manual start
      act(() => {
        result.current.startDetection();
      });

      await waitFor(() => {
        expect(result.current.motionState.isDetecting).toBe(true);
      });
    });

    it('should allow manual stop of detection', async () => {
      const { result } = renderHook(() =>
        useMotionDetection({
          videoElement: mockVideoElement,
          isActive: true,
          sensitivity: 50
        })
      );

      // Wait for auto start
      act(() => {
        vi.advanceTimersByTime(500);
      });

      await waitFor(() => {
        expect(result.current.motionState.isDetecting).toBe(true);
      });

      // Manual stop
      act(() => {
        result.current.stopDetection();
      });

      await waitFor(() => {
        expect(result.current.motionState.isDetecting).toBe(false);
        expect(result.current.motionState.motionStrength).toBe(0);
        expect(result.current.lastResult).toBeNull();
      });
    });

    it('should allow manual reset of detection', async () => {
      // Set up some motion state
      const motionResult: MotionDetectionResult = {
        hasMotion: true,
        motionStrength: 60,
        timestamp: 1640995200000
      };

      mockMotionService.detectMotion.mockReturnValue(motionResult);

      const { result } = renderHook(() =>
        useMotionDetection({
          videoElement: mockVideoElement,
          isActive: true,
          sensitivity: 50
        })
      );

      // Get some motion detected
      act(() => {
        vi.advanceTimersByTime(600);
      });

      await waitFor(() => {
        expect(result.current.motionState.motionStrength).toBe(60);
        expect(result.current.motionState.lastMotionTime).toBe(1640995200000);
      });

      // Reset detection
      act(() => {
        result.current.resetDetection();
      });

      await waitFor(() => {
        expect(result.current.motionState.motionStrength).toBe(0);
        expect(result.current.motionState.lastMotionTime).toBeNull();
        expect(result.current.lastResult).toBeNull();
      });

      expect(mockMotionService.reset).toHaveBeenCalled();
    });

    it('should prevent multiple simultaneous detection starts', () => {
      const { result } = renderHook(() =>
        useMotionDetection({
          videoElement: mockVideoElement,
          isActive: false,
          sensitivity: 50
        })
      );

      // Start detection multiple times quickly
      act(() => {
        result.current.startDetection();
        result.current.startDetection();
        result.current.startDetection();
      });

      // Should only start once (no way to directly test internal ref, but no errors should occur)
      expect(() => {
        act(() => {
          vi.advanceTimersByTime(100);
        });
      }).not.toThrow();
    });
  });

  describe('cleanup', () => {
    it('should clean up intervals on unmount', () => {
      const { result, unmount } = renderHook(() =>
        useMotionDetection({
          videoElement: mockVideoElement,
          isActive: true,
          sensitivity: 50
        })
      );

      act(() => {
        vi.advanceTimersByTime(500);
      });

      // Should not throw on unmount
      expect(() => unmount()).not.toThrow();

      // Advancing timers after unmount should not cause issues
      expect(() => {
        act(() => {
          vi.advanceTimersByTime(1000);
        });
      }).not.toThrow();
    });

    it('should clean up intervals when isActive changes to false', async () => {
      const { result, rerender } = renderHook(
        ({ isActive }) =>
          useMotionDetection({
            videoElement: mockVideoElement,
            isActive,
            sensitivity: 50
          }),
        {
          initialProps: { isActive: true }
        }
      );

      // Start detection
      act(() => {
        vi.advanceTimersByTime(500);
      });

      await waitFor(() => {
        expect(result.current.motionState.isDetecting).toBe(true);
      });

      // Deactivate
      rerender({ isActive: false });

      await waitFor(() => {
        expect(result.current.motionState.isDetecting).toBe(false);
      });

      // Clear mocks to test that detection stops
      mockMotionService.detectMotion.mockClear();

      // Advance time - no more detections should occur
      act(() => {
        vi.advanceTimersByTime(1000);
      });

      expect(mockMotionService.detectMotion).not.toHaveBeenCalled();
    });
  });

  describe('custom detection interval', () => {
    it('should use custom detection interval', async () => {
      const { result } = renderHook(() =>
        useMotionDetection({
          videoElement: mockVideoElement,
          isActive: true,
          sensitivity: 50,
          detectionInterval: 200 // Custom interval
        })
      );

      // Start detection
      act(() => {
        vi.advanceTimersByTime(500);
      });

      await waitFor(() => {
        expect(result.current.motionState.isDetecting).toBe(true);
      });

      // Should not detect at 100ms (default interval)
      act(() => {
        vi.advanceTimersByTime(100);
      });

      expect(mockMotionService.detectMotion).not.toHaveBeenCalled();

      // Should detect at 200ms (custom interval)
      act(() => {
        vi.advanceTimersByTime(100); // Total 200ms
      });

      expect(mockMotionService.detectMotion).toHaveBeenCalledTimes(1);
    });
  });

  describe('sensitivity changes during detection', () => {
    it('should use updated sensitivity in detection calls', async () => {
      const { result, rerender } = renderHook(
        ({ sensitivity }) =>
          useMotionDetection({
            videoElement: mockVideoElement,
            isActive: true,
            sensitivity,
            detectionInterval: 100
          }),
        {
          initialProps: { sensitivity: 50 }
        }
      );

      // Start detection
      act(() => {
        vi.advanceTimersByTime(500);
      });

      await waitFor(() => {
        expect(result.current.motionState.isDetecting).toBe(true);
      });

      // Trigger detection with initial sensitivity
      act(() => {
        vi.advanceTimersByTime(100);
      });

      expect(mockMotionService.detectMotion).toHaveBeenLastCalledWith(mockVideoElement, 50);

      // Change sensitivity
      rerender({ sensitivity: 80 });

      // Trigger detection with new sensitivity
      act(() => {
        vi.advanceTimersByTime(100);
      });

      expect(mockMotionService.detectMotion).toHaveBeenLastCalledWith(mockVideoElement, 80);
    });
  });
});