import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { VideoFeed } from '../../components/VideoFeed';
import { VideoControls } from '../../components/VideoControls';
import { createMockMediaStream } from '../test-utils';
import { MotionDetectionState } from '../../types';

// Mock the motion detection service at the module level
vi.mock('../../services/motionDetectionService', () => {
  const mockService = {
    detectMotion: vi.fn(),
    reset: vi.fn(),
    updateDimensions: vi.fn(),
    dispose: vi.fn(),
  };
  
  return {
    MotionDetectionService: vi.fn(() => mockService),
    motionDetectionService: mockService,
  };
});

describe('Motion Detection Flow Integration', () => {
  let mockMediaStream: MediaStream;
  let mockService: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.useFakeTimers();

    mockMediaStream = createMockMediaStream();
    const { motionDetectionService } = await import('../../services/motionDetectionService');
    mockService = motionDetectionService;

    // Setup successful getUserMedia by default
    Object.defineProperty(globalThis, 'navigator', {
      value: {
        mediaDevices: {
          getUserMedia: vi.fn(() => Promise.resolve(mockMediaStream)),
        },
      },
      writable: true,
    });

    // Default motion service behavior - no motion
    mockService.detectMotion.mockReturnValue({
      hasMotion: false,
      motionStrength: 0,
      timestamp: Date.now(),
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  describe('Complete Motion Detection Flow', () => {
    it('should integrate VideoFeed and VideoControls for complete motion detection', async () => {
      const onStreamReady = vi.fn();
      const onError = vi.fn();
      const onToggleCamera = vi.fn();
      let currentMotionState: MotionDetectionState | undefined;

      const TestComponent = () => {
        const [isActive, setIsActive] = React.useState(false);
        const [sensitivity] = React.useState(50);

        const handleToggleCamera = () => {
          setIsActive(!isActive);
          onToggleCamera();
        };

        const handleMotionStateChange = (state: MotionDetectionState) => {
          currentMotionState = state;
        };

        return (
          <div>
            <VideoFeed
              isActive={isActive}
              onError={onError}
              onStreamReady={onStreamReady}
              sensitivity={sensitivity}
              onMotionStateChange={handleMotionStateChange}
            />
            <VideoControls
              isActive={isActive}
              onToggleCamera={handleToggleCamera}
            />
          </div>
        );
      };

      render(<TestComponent />);

      // Initially, camera should be off
      expect(screen.getByText('Camera is off')).toBeInTheDocument();

      // Turn on camera
      const toggleButton = screen.getByRole('button', { name: /turn camera on/i });
      await userEvent.click(toggleButton);

      expect(onToggleCamera).toHaveBeenCalled();

      // Wait for stream to be ready
      await waitFor(() => {
        expect(onStreamReady).toHaveBeenCalledWith(mockMediaStream);
      });

      // Now camera should be on
      expect(screen.getByText('Camera is on')).toBeInTheDocument();

      // Simulate motion detection
      mockService.detectMotion.mockReturnValue({
        hasMotion: true,
        motionStrength: 75,
        timestamp: Date.now(),
      });

      // Trigger detection cycle
      await act(async () => {
        vi.advanceTimersByTime(100);
      });

      await waitFor(() => {
        expect(currentMotionState?.motionStrength).toBe(75);
      });

      // Turn off camera
      const toggleOffButton = screen.getByRole('button', { name: /turn camera off/i });
      await userEvent.click(toggleOffButton);

      expect(screen.getByText('Camera is off')).toBeInTheDocument();
    });

    it('should handle camera activation errors', async () => {
      const onError = vi.fn();
      const onToggleCamera = vi.fn();

      // Setup getUserMedia to fail
      Object.defineProperty(globalThis, 'navigator', {
        value: {
          mediaDevices: {
            getUserMedia: vi.fn(() => Promise.reject(new Error('Permission denied'))),
          },
        },
        writable: true,
      });

      const TestComponent = () => {
        const [isActive, setIsActive] = React.useState(false);

        const handleToggleCamera = () => {
          setIsActive(!isActive);
          onToggleCamera();
        };

        return (
          <div>
            <VideoFeed
              isActive={isActive}
              onError={onError}
              onStreamReady={vi.fn()}
              sensitivity={50}
            />
            <VideoControls
              isActive={isActive}
              onToggleCamera={handleToggleCamera}
            />
          </div>
        );
      };

      render(<TestComponent />);

      // Try to turn on camera
      const toggleButton = screen.getByRole('button', { name: /turn camera on/i });
      await userEvent.click(toggleButton);

      // Wait for error to be reported
      await waitFor(() => {
        expect(onError).toHaveBeenCalledWith(expect.stringContaining('Camera access'));
      });
    });

    it('should update motion detection when camera becomes active', async () => {
      let motionState: MotionDetectionState | undefined;

      const TestComponent = () => {
        const [isActive, setIsActive] = React.useState(false);

        return (
          <div>
            <VideoFeed
              isActive={isActive}
              onError={vi.fn()}
              onStreamReady={vi.fn()}
              sensitivity={50}
              onMotionStateChange={(state) => { motionState = state; }}
            />
            <VideoControls
              isActive={isActive}
              onToggleCamera={() => setIsActive(!isActive)}
            />
          </div>
        );
      };

      render(<TestComponent />);

      // Turn on camera
      const toggleButton = screen.getByRole('button', { name: /turn camera on/i });
      await userEvent.click(toggleButton);

      // Wait for motion detection to start
      await waitFor(() => {
        expect(motionState?.isDetecting).toBe(true);
      });

      // Simulate motion
      mockService.detectMotion.mockReturnValue({
        hasMotion: true,
        motionStrength: 50,
        timestamp: Date.now(),
      });

      await act(async () => {
        vi.advanceTimersByTime(100);
      });

      await waitFor(() => {
        expect(motionState?.motionStrength).toBe(50);
      });
    });

    it('should disable controls when disabled prop is set', () => {
      render(
        <VideoControls
          isActive={false}
          onToggleCamera={vi.fn()}
          disabled={true}
        />
      );

      const button = screen.getByRole('button');
      expect(button).toBeDisabled();
    });

    it('should handle rapid camera toggling', async () => {
      const onToggleCamera = vi.fn();
      let isActive = false;

      const TestComponent = () => {
        const [active, setActive] = React.useState(isActive);

        const handleToggle = () => {
          setActive(!active);
          onToggleCamera();
        };

        return (
          <VideoControls
            isActive={active}
            onToggleCamera={handleToggle}
          />
        );
      };

      render(<TestComponent />);

      const button = screen.getByRole('button');

      // Rapidly toggle camera multiple times
      await userEvent.click(button);
      await userEvent.click(button);
      await userEvent.click(button);

      expect(onToggleCamera).toHaveBeenCalledTimes(3);
    });
  });
});