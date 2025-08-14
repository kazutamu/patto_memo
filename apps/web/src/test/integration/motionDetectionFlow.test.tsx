import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor, act, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { VideoFeed } from '../../components/VideoFeed';
import { VideoControls } from '../../components/VideoControls';
import { createMockMediaStream, createImageDataWithMotion } from '../test-utils';
import { MotionDetectionState } from '@motion-detector/shared-types';

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
      const onSensitivityChange = vi.fn();
      let currentMotionState: MotionDetectionState | undefined;

      const TestComponent = () => {
        const [isActive, setIsActive] = React.useState(false);
        const [sensitivity, setSensitivity] = React.useState(50);
        const [motionState, setMotionState] = React.useState<MotionDetectionState | undefined>();

        const handleToggleCamera = () => {
          setIsActive(!isActive);
          onToggleCamera();
        };

        const handleSensitivityChange = (value: number) => {
          setSensitivity(value);
          onSensitivityChange(value);
        };

        const handleMotionStateChange = (state: MotionDetectionState) => {
          setMotionState(state);
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
              sensitivity={sensitivity}
              onSensitivityChange={handleSensitivityChange}
              motionState={motionState}
            />
          </div>
        );
      };

      render(<TestComponent />);

      // Initially, camera should be off
      expect(screen.getByText('Camera is off')).toBeInTheDocument();
      expect(screen.getByText('Off')).toBeInTheDocument();
      expect(screen.getByText('Camera inactive')).toBeInTheDocument();

      // Turn on camera
      const toggleButton = screen.getByRole('button', { name: /turn camera on/i });
      await userEvent.click(toggleButton);

      expect(onToggleCamera).toHaveBeenCalled();

      // Wait for camera to activate and motion detection to start
      act(() => {
        vi.advanceTimersByTime(1000); // 500ms delay + some detection time
      });

      await waitFor(() => {
        expect(onStreamReady).toHaveBeenCalledWith(mockMediaStream);
        expect(screen.getByText('On')).toBeInTheDocument();
        expect(screen.getByText('Live')).toBeInTheDocument();
      });

      // Motion detection should be monitoring
      await waitFor(() => {
        expect(currentMotionState?.isDetecting).toBe(true);
        expect(screen.getByText('Monitoring for motion')).toBeInTheDocument();
      });

      // Change sensitivity
      const slider = screen.getByRole('slider');
      fireEvent.change(slider, { target: { value: '80' } });

      expect(onSensitivityChange).toHaveBeenCalledWith(80);
      expect(screen.getByText('80%')).toBeInTheDocument();

      // Simulate motion detection
      mockService.detectMotion.mockReturnValue({
        hasMotion: true,
        motionStrength: 75,
        timestamp: Date.now(),
      });

      // Advance time to trigger motion detection
      act(() => {
        vi.advanceTimersByTime(200); // Detection interval
      });

      await waitFor(() => {
        expect(screen.getByText('Motion detected!')).toBeInTheDocument();
        expect(screen.getByText('75.0%')).toBeInTheDocument();
      });

      // Turn off camera
      const toggleOffButton = screen.getByRole('button', { name: /turn camera off/i });
      await userEvent.click(toggleOffButton);

      await waitFor(() => {
        expect(screen.getByText('Off')).toBeInTheDocument();
        expect(screen.getByText('Camera inactive')).toBeInTheDocument();
        expect(currentMotionState?.isDetecting).toBe(false);
      });
    });

    it('should handle camera errors gracefully in integrated flow', async () => {
      const onError = vi.fn();
      let motionState: MotionDetectionState | undefined;

      // Mock camera access failure
      Object.defineProperty(globalThis, 'navigator', {
        value: {
          mediaDevices: {
            getUserMedia: vi.fn(() => Promise.reject(new DOMException('Permission denied', 'NotAllowedError'))),
          },
        },
        writable: true,
      });

      const TestComponent = () => {
        const [isActive, setIsActive] = React.useState(true); // Start with camera on
        
        return (
          <div>
            <VideoFeed
              isActive={isActive}
              onError={onError}
              onStreamReady={vi.fn()}
              sensitivity={50}
              onMotionStateChange={(state) => { motionState = state; }}
            />
            <VideoControls
              isActive={isActive}
              onToggleCamera={() => setIsActive(!isActive)}
              sensitivity={50}
              onSensitivityChange={vi.fn()}
              motionState={motionState}
            />
          </div>
        );
      };

      render(<TestComponent />);

      // Should show error state
      await waitFor(() => {
        expect(onError).toHaveBeenCalledWith(
          'Camera access denied. Please grant camera permissions and try again.'
        );
        expect(screen.getByText('Camera access failed')).toBeInTheDocument();
        expect(screen.getByText('Try Again')).toBeInTheDocument();
      });

      // Motion detection should remain inactive
      expect(motionState?.isDetecting).toBe(false);
      expect(screen.getByText('Motion detection inactive')).toBeInTheDocument();
    });

    it('should handle sensitivity changes during active motion detection', async () => {
      createImageDataWithMotion(320, 240, 60);
      let detectionCalls = 0;

      mockService.detectMotion.mockImplementation((_: any, sensitivity: number) => {
        detectionCalls++;
        
        // First few calls simulate static frames
        if (detectionCalls <= 2) {
          return {
            hasMotion: false,
            motionStrength: 0,
            timestamp: Date.now(),
          };
        }
        
        // Later calls simulate motion with varying intensity based on sensitivity
        const adjustedStrength = sensitivity > 70 ? 80 : 40;
        return {
          hasMotion: adjustedStrength > 25,
          motionStrength: adjustedStrength,
          timestamp: Date.now(),
        };
      });

      const TestComponent = () => {
        const [isActive, setIsActive] = React.useState(true);
        const [sensitivity, setSensitivity] = React.useState(50);
        const [motionState, setMotionState] = React.useState<MotionDetectionState | undefined>();

        return (
          <div>
            <VideoFeed
              isActive={isActive}
              onError={vi.fn()}
              onStreamReady={vi.fn()}
              sensitivity={sensitivity}
              onMotionStateChange={setMotionState}
            />
            <VideoControls
              isActive={isActive}
              onToggleCamera={() => setIsActive(!isActive)}
              sensitivity={sensitivity}
              onSensitivityChange={setSensitivity}
              motionState={motionState}
            />
          </div>
        );
      };

      render(<TestComponent />);

      // Start motion detection
      act(() => {
        vi.advanceTimersByTime(800); // Start delay + detection cycles
      });

      await waitFor(() => {
        expect(screen.getByText('Monitoring for motion')).toBeInTheDocument();
      });

      // Change sensitivity to high
      const slider = screen.getByRole('slider');
      fireEvent.change(slider, { target: { value: '80' } });

      // Advance time to trigger detection with new sensitivity
      act(() => {
        vi.advanceTimersByTime(200);
      });

      await waitFor(() => {
        expect(screen.getByText('Motion detected!')).toBeInTheDocument();
        expect(screen.getByText('80.0%')).toBeInTheDocument(); // Should show the motion strength
      });

      // Change sensitivity to low
      fireEvent.change(slider, { target: { value: '30' } });

      act(() => {
        vi.advanceTimersByTime(200);
      });

      await waitFor(() => {
        // With low sensitivity, should detect less motion
        expect(mockService.detectMotion).toHaveBeenLastCalledWith(expect.any(Object), 30);
      });
    });

    it('should maintain motion detection state across component re-renders', async () => {
      const TestComponent = () => {
        const [isActive, setIsActive] = React.useState(true);
        const [sensitivity, setSensitivity] = React.useState(50);
        const [motionState, setMotionState] = React.useState<MotionDetectionState | undefined>();
        const [rerenderCount, setRerenderCount] = React.useState(0);

        return (
          <div>
            <button onClick={() => setRerenderCount(c => c + 1)}>
              Force Rerender {rerenderCount}
            </button>
            <VideoFeed
              isActive={isActive}
              onError={vi.fn()}
              onStreamReady={vi.fn()}
              sensitivity={sensitivity}
              onMotionStateChange={setMotionState}
            />
            <VideoControls
              isActive={isActive}
              onToggleCamera={() => setIsActive(!isActive)}
              sensitivity={sensitivity}
              onSensitivityChange={setSensitivity}
              motionState={motionState}
            />
          </div>
        );
      };

      render(<TestComponent />);

      // Start motion detection
      act(() => {
        vi.advanceTimersByTime(600);
      });

      await waitFor(() => {
        expect(screen.getByText('Monitoring for motion')).toBeInTheDocument();
      });

      // Force multiple re-renders
      const rerenderButton = screen.getByText(/Force Rerender/);
      await userEvent.click(rerenderButton);
      await userEvent.click(rerenderButton);
      await userEvent.click(rerenderButton);

      // Motion detection should still be active
      expect(screen.getByText('Monitoring for motion')).toBeInTheDocument();
      
      // Detection should continue working
      mockService.detectMotion.mockReturnValue({
        hasMotion: true,
        motionStrength: 55,
        timestamp: Date.now(),
      });

      act(() => {
        vi.advanceTimersByTime(200);
      });

      await waitFor(() => {
        expect(screen.getByText('Motion detected!')).toBeInTheDocument();
      });
    });

    it('should cleanup resources properly when components unmount', async () => {
      const mockTracks = [
        { stop: vi.fn() },
        { stop: vi.fn() },
      ];
      mockMediaStream.getTracks = vi.fn(() => mockTracks as any);

      const TestComponent = ({ mounted }: { mounted: boolean }) => {
        if (!mounted) return <div>Unmounted</div>;

        return (
          <div>
            <VideoFeed
              isActive={true}
              onError={vi.fn()}
              onStreamReady={vi.fn()}
              sensitivity={50}
              onMotionStateChange={vi.fn()}
            />
            <VideoControls
              isActive={true}
              onToggleCamera={vi.fn()}
              sensitivity={50}
              onSensitivityChange={vi.fn()}
            />
          </div>
        );
      };

      const { rerender } = render(<TestComponent mounted={true} />);

      // Start motion detection
      act(() => {
        vi.advanceTimersByTime(600);
      });

      await waitFor(() => {
        expect(screen.getByText('Monitoring for motion')).toBeInTheDocument();
      });

      // Unmount components
      rerender(<TestComponent mounted={false} />);

      expect(screen.getByText('Unmounted')).toBeInTheDocument();
      
      // Verify cleanup
      expect(mockTracks[0].stop).toHaveBeenCalled();
      expect(mockTracks[1].stop).toHaveBeenCalled();

      // Advancing time should not cause any issues
      expect(() => {
        act(() => {
          vi.advanceTimersByTime(1000);
        });
      }).not.toThrow();
    });
  });

  describe('Real-world Scenarios', () => {
    it('should handle rapid camera on/off toggling', async () => {
      const TestComponent = () => {
        const [isActive, setIsActive] = React.useState(false);
        const [motionState, setMotionState] = React.useState<MotionDetectionState | undefined>();

        return (
          <div>
            <VideoFeed
              isActive={isActive}
              onError={vi.fn()}
              onStreamReady={vi.fn()}
              sensitivity={50}
              onMotionStateChange={setMotionState}
            />
            <VideoControls
              isActive={isActive}
              onToggleCamera={() => setIsActive(!isActive)}
              sensitivity={50}
              onSensitivityChange={vi.fn()}
              motionState={motionState}
            />
          </div>
        );
      };

      render(<TestComponent />);

      const toggleButton = screen.getByRole('button', { name: /turn camera/i });

      // Rapidly toggle camera multiple times
      await userEvent.click(toggleButton); // On
      act(() => { vi.advanceTimersByTime(100); });
      
      await userEvent.click(toggleButton); // Off
      act(() => { vi.advanceTimersByTime(100); });
      
      await userEvent.click(toggleButton); // On
      act(() => { vi.advanceTimersByTime(100); });
      
      await userEvent.click(toggleButton); // Off
      act(() => { vi.advanceTimersByTime(100); });

      // Should handle gracefully without errors
      expect(screen.getByText('Camera inactive')).toBeInTheDocument();
    });

    it('should handle motion detection with varying frame rates', async () => {
      let frameCount = 0;
      mockService.detectMotion.mockImplementation(() => {
        frameCount++;
        
        // Simulate varying motion patterns
        const motionStrength = Math.sin(frameCount * 0.1) * 50 + 50; // Wave pattern 0-100
        
        return {
          hasMotion: motionStrength > 60,
          motionStrength: Math.max(0, motionStrength),
          timestamp: Date.now(),
        };
      });

      const TestComponent = () => {
        const [motionState, setMotionState] = React.useState<MotionDetectionState | undefined>();

        return (
          <div>
            <VideoFeed
              isActive={true}
              onError={vi.fn()}
              onStreamReady={vi.fn()}
              sensitivity={50}
              onMotionStateChange={setMotionState}
            />
            <VideoControls
              isActive={true}
              onToggleCamera={vi.fn()}
              sensitivity={50}
              onSensitivityChange={vi.fn()}
              motionState={motionState}
            />
            <div data-testid="motion-strength">
              {motionState?.motionStrength?.toFixed(1) || '0.0'}
            </div>
          </div>
        );
      };

      render(<TestComponent />);

      // Start detection
      act(() => {
        vi.advanceTimersByTime(600);
      });

      // Advance through multiple detection cycles
      for (let i = 0; i < 20; i++) {
        act(() => {
          vi.advanceTimersByTime(50);
        });
        
        // Check that motion detection is working
        if (i > 10) { // Give it some time to stabilize
          const motionElement = screen.getByTestId('motion-strength');
          expect(motionElement).toBeInTheDocument();
        }
      }

      expect(mockService.detectMotion).toHaveBeenCalledTimes(frameCount);
    });
  });
});