import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { VideoFeed } from '../VideoFeed';
import { useMotionDetection } from '../../hooks/useMotionDetection';
import { createMockMediaStream, createMockVideoElement } from '../../test/test-utils';
import { MotionDetectionState } from '@motion-detector/shared-types';

// Mock the useMotionDetection hook
vi.mock('../../hooks/useMotionDetection', () => ({
  useMotionDetection: vi.fn(),
}));

// Mock CSS modules
vi.mock('../VideoFeed.module.css', () => ({
  default: {
    videoContainer: 'videoContainer',
    videoWrapper: 'videoWrapper',
    motionDetected: 'motionDetected',
    video: 'video',
    overlay: 'overlay',
    spinner: 'spinner',
    overlayText: 'overlayText',
    cameraIcon: 'cameraIcon',
    errorIcon: 'errorIcon',
    retryButton: 'retryButton',
    videoInfo: 'videoInfo',
    status: 'status',
    active: 'active',
  },
}));

describe('VideoFeed', () => {
  const mockUseMotionDetection = useMotionDetection as any;
  const defaultProps = {
    isActive: false,
    onError: vi.fn(),
    onStreamReady: vi.fn(),
    sensitivity: 50,
    onMotionStateChange: vi.fn(),
  };

  const defaultMotionState: MotionDetectionState = {
    isDetecting: false,
    motionStrength: 0,
    lastMotionTime: null,
    sensitivity: 50,
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Default mock implementation
    mockUseMotionDetection.mockReturnValue({
      motionState: defaultMotionState,
      lastResult: null,
      startDetection: vi.fn(),
      stopDetection: vi.fn(),
      resetDetection: vi.fn(),
    });

    // Mock getUserMedia success by default
    Object.defineProperty(globalThis.navigator, 'mediaDevices', {
      value: {
        getUserMedia: vi.fn(() => Promise.resolve(createMockMediaStream())),
      },
      writable: true,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('should render with inactive state', () => {
      render(<VideoFeed {...defaultProps} />);

      expect(screen.getByText('Camera is off')).toBeInTheDocument();
      expect(screen.getByText('Inactive')).toBeInTheDocument();
      expect(screen.getByText('📹')).toBeInTheDocument();
    });

    it('should render video element', () => {
      render(<VideoFeed {...defaultProps} />);

      const video = screen.getByRole('generic'); // video elements don't have specific roles in jsdom
      expect(video).toBeInTheDocument();
    });

    it('should apply motion detected class when motion is active', () => {
      const motionActiveState = {
        ...defaultMotionState,
        isDetecting: true,
        motionStrength: 75,
      };

      mockUseMotionDetection.mockReturnValue({
        motionState: motionActiveState,
        lastResult: null,
        startDetection: vi.fn(),
        stopDetection: vi.fn(),
        resetDetection: vi.fn(),
      });

      const { container } = render(<VideoFeed {...defaultProps} isActive={true} />);
      
      // Check if motion detected class is applied
      const videoWrapper = container.querySelector('.videoWrapper');
      expect(videoWrapper).toHaveClass('motionDetected');
    });

    it('should not apply motion detected class when no motion', () => {
      const { container } = render(<VideoFeed {...defaultProps} isActive={true} />);
      
      const videoWrapper = container.querySelector('.videoWrapper');
      expect(videoWrapper).not.toHaveClass('motionDetected');
    });
  });

  describe('camera access', () => {
    it('should request camera access when activated', async () => {
      const mockGetUserMedia = vi.fn(() => Promise.resolve(createMockMediaStream()));
      Object.defineProperty(globalThis.navigator, 'mediaDevices', {
        value: { getUserMedia: mockGetUserMedia },
        writable: true,
      });

      render(<VideoFeed {...defaultProps} isActive={true} />);

      await waitFor(() => {
        expect(mockGetUserMedia).toHaveBeenCalledWith({
          video: {
            width: { ideal: 1280, max: 1920 },
            height: { ideal: 720, max: 1080 },
            facingMode: 'user',
          },
          audio: false,
        });
      });

      expect(defaultProps.onStreamReady).toHaveBeenCalled();
    });

    it('should show loading state during camera access', async () => {
      // Make getUserMedia take some time to resolve
      const mockGetUserMedia = vi.fn(
        () => new Promise(resolve => setTimeout(() => resolve(createMockMediaStream()), 100))
      );
      Object.defineProperty(globalThis.navigator, 'mediaDevices', {
        value: { getUserMedia: mockGetUserMedia },
        writable: true,
      });

      render(<VideoFeed {...defaultProps} isActive={true} />);

      // Should show loading immediately
      expect(screen.getByText('Accessing camera...')).toBeInTheDocument();

      // Wait for loading to complete
      await waitFor(() => {
        expect(screen.queryByText('Accessing camera...')).not.toBeInTheDocument();
      });
    });

    it('should handle camera access denied error', async () => {
      const mockGetUserMedia = vi.fn(() =>
        Promise.reject(new DOMException('Permission denied', 'NotAllowedError'))
      );
      Object.defineProperty(globalThis.navigator, 'mediaDevices', {
        value: { getUserMedia: mockGetUserMedia },
        writable: true,
      });

      render(<VideoFeed {...defaultProps} isActive={true} />);

      await waitFor(() => {
        expect(defaultProps.onError).toHaveBeenCalledWith(
          'Camera access denied. Please grant camera permissions and try again.'
        );
      });

      expect(screen.getByText('Camera access failed')).toBeInTheDocument();
      expect(screen.getByText('⚠️')).toBeInTheDocument();
    });

    it('should handle camera not found error', async () => {
      const mockGetUserMedia = vi.fn(() =>
        Promise.reject(new DOMException('Device not found', 'NotFoundError'))
      );
      Object.defineProperty(globalThis.navigator, 'mediaDevices', {
        value: { getUserMedia: mockGetUserMedia },
        writable: true,
      });

      render(<VideoFeed {...defaultProps} isActive={true} />);

      await waitFor(() => {
        expect(defaultProps.onError).toHaveBeenCalledWith(
          'No camera found. Please connect a camera and try again.'
        );
      });
    });

    it('should handle camera in use error', async () => {
      const mockGetUserMedia = vi.fn(() =>
        Promise.reject(new DOMException('Device in use', 'NotReadableError'))
      );
      Object.defineProperty(globalThis.navigator, 'mediaDevices', {
        value: { getUserMedia: mockGetUserMedia },
        writable: true,
      });

      render(<VideoFeed {...defaultProps} isActive={true} />);

      await waitFor(() => {
        expect(defaultProps.onError).toHaveBeenCalledWith(
          'Camera is being used by another application.'
        );
      });
    });

    it('should handle overconstrained error', async () => {
      const mockGetUserMedia = vi.fn(() =>
        Promise.reject(new DOMException('Constraints not satisfied', 'OverconstrainedError'))
      );
      Object.defineProperty(globalThis.navigator, 'mediaDevices', {
        value: { getUserMedia: mockGetUserMedia },
        writable: true,
      });

      render(<VideoFeed {...defaultProps} isActive={true} />);

      await waitFor(() => {
        expect(defaultProps.onError).toHaveBeenCalledWith(
          'Camera does not support the requested configuration.'
        );
      });
    });

    it('should handle generic camera error', async () => {
      const mockGetUserMedia = vi.fn(() =>
        Promise.reject(new Error('Generic camera error'))
      );
      Object.defineProperty(globalThis.navigator, 'mediaDevices', {
        value: { getUserMedia: mockGetUserMedia },
        writable: true,
      });

      render(<VideoFeed {...defaultProps} isActive={true} />);

      await waitFor(() => {
        expect(defaultProps.onError).toHaveBeenCalledWith(
          'Camera error: Generic camera error'
        );
      });
    });

    it('should show retry button after camera error', async () => {
      const mockGetUserMedia = vi.fn(() =>
        Promise.reject(new DOMException('Permission denied', 'NotAllowedError'))
      );
      Object.defineProperty(globalThis.navigator, 'mediaDevices', {
        value: { getUserMedia: mockGetUserMedia },
        writable: true,
      });

      render(<VideoFeed {...defaultProps} isActive={true} />);

      await waitFor(() => {
        expect(screen.getByText('Try Again')).toBeInTheDocument();
      });

      // Test retry functionality
      const retryButton = screen.getByText('Try Again');
      await userEvent.click(retryButton);

      expect(mockGetUserMedia).toHaveBeenCalledTimes(2);
    });
  });

  describe('stream management', () => {
    it('should stop stream when deactivated', async () => {
      const mockStream = createMockMediaStream();
      const mockStopTrack = vi.fn();
      (mockStream.getTracks as any).mockReturnValue([{ stop: mockStopTrack } as any]);

      const mockGetUserMedia = vi.fn(() => Promise.resolve(mockStream));
      Object.defineProperty(globalThis.navigator, 'mediaDevices', {
        value: { getUserMedia: mockGetUserMedia },
        writable: true,
      });

      const { rerender } = render(<VideoFeed {...defaultProps} isActive={true} />);

      // Wait for stream to start
      await waitFor(() => {
        expect(mockGetUserMedia).toHaveBeenCalled();
      });

      // Deactivate the video feed
      rerender(<VideoFeed {...defaultProps} isActive={false} />);

      expect(mockStopTrack).toHaveBeenCalled();
    });

    it('should clean up on unmount', async () => {
      const mockStream = createMockMediaStream();
      const mockStopTrack = vi.fn();
      (mockStream.getTracks as any).mockReturnValue([{ stop: mockStopTrack } as any]);

      const mockGetUserMedia = vi.fn(() => Promise.resolve(mockStream));
      Object.defineProperty(globalThis.navigator, 'mediaDevices', {
        value: { getUserMedia: mockGetUserMedia },
        writable: true,
      });

      const { unmount } = render(<VideoFeed {...defaultProps} isActive={true} />);

      // Wait for stream to start
      await waitFor(() => {
        expect(mockGetUserMedia).toHaveBeenCalled();
      });

      // Unmount component
      unmount();

      expect(mockStopTrack).toHaveBeenCalled();
    });
  });

  describe('motion detection integration', () => {
    it('should pass correct parameters to useMotionDetection', () => {
      render(<VideoFeed {...defaultProps} isActive={true} sensitivity={75} />);

      expect(mockUseMotionDetection).toHaveBeenCalledWith({
        videoElement: expect.any(Object), // HTMLVideoElement
        isActive: true, // isActive && hasPermission === true
        sensitivity: 75,
        detectionInterval: 150,
      });
    });

    it('should not activate motion detection without camera permission', () => {
      render(<VideoFeed {...defaultProps} isActive={true} sensitivity={75} />);

      // Initially, hasPermission is null, so motion detection should not be active
      expect(mockUseMotionDetection).toHaveBeenCalledWith({
        videoElement: expect.any(Object),
        isActive: false, // Should be false when hasPermission is null
        sensitivity: 75,
        detectionInterval: 150,
      });
    });

    it('should notify parent about motion state changes', () => {
      const motionState = {
        ...defaultMotionState,
        isDetecting: true,
        motionStrength: 60,
      };

      mockUseMotionDetection.mockReturnValue({
        motionState,
        lastResult: null,
        startDetection: vi.fn(),
        stopDetection: vi.fn(),
        resetDetection: vi.fn(),
      });

      render(<VideoFeed {...defaultProps} />);

      expect(defaultProps.onMotionStateChange).toHaveBeenCalledWith(motionState);
    });

    it('should handle missing onMotionStateChange callback gracefully', () => {
      const props = { ...defaultProps };
      delete (props as any).onMotionStateChange;

      expect(() => {
        render(<VideoFeed {...props} />);
      }).not.toThrow();
    });

    it('should update motion detection when sensitivity changes', () => {
      const { rerender } = render(<VideoFeed {...defaultProps} sensitivity={50} />);

      rerender(<VideoFeed {...defaultProps} sensitivity={80} />);

      expect(mockUseMotionDetection).toHaveBeenLastCalledWith({
        videoElement: expect.any(Object),
        isActive: false, // isActive is false in defaultProps
        sensitivity: 80,
        detectionInterval: 150,
      });
    });
  });

  describe('status display', () => {
    it('should show "Live" status when active and has permission', async () => {
      const mockGetUserMedia = vi.fn(() => Promise.resolve(createMockMediaStream()));
      Object.defineProperty(globalThis.navigator, 'mediaDevices', {
        value: { getUserMedia: mockGetUserMedia },
        writable: true,
      });

      render(<VideoFeed {...defaultProps} isActive={true} />);

      await waitFor(() => {
        expect(screen.getByText('Live')).toBeInTheDocument();
      });

      // Check if active class is applied
      const statusElement = screen.getByText('Live');
      expect(statusElement).toHaveClass('active');
    });

    it('should show "Inactive" status when not active', () => {
      render(<VideoFeed {...defaultProps} isActive={false} />);

      expect(screen.getByText('Inactive')).toBeInTheDocument();

      // Check that active class is not applied
      const statusElement = screen.getByText('Inactive');
      expect(statusElement).not.toHaveClass('active');
    });

    it('should show "Inactive" status when camera access fails', async () => {
      const mockGetUserMedia = vi.fn(() =>
        Promise.reject(new DOMException('Permission denied', 'NotAllowedError'))
      );
      Object.defineProperty(globalThis.navigator, 'mediaDevices', {
        value: { getUserMedia: mockGetUserMedia },
        writable: true,
      });

      render(<VideoFeed {...defaultProps} isActive={true} />);

      // Should initially show as trying to access
      await waitFor(() => {
        expect(screen.getByText('Inactive')).toBeInTheDocument();
      });
    });
  });

  describe('accessibility', () => {
    it('should have proper video element attributes', () => {
      const { container } = render(<VideoFeed {...defaultProps} />);
      
      const video = container.querySelector('video');
      expect(video).toHaveAttribute('autoplay');
      expect(video).toHaveAttribute('muted');
      expect(video).toHaveAttribute('playsinline');
    });

    it('should have descriptive overlay texts', async () => {
      render(<VideoFeed {...defaultProps} isActive={false} />);
      expect(screen.getByText('Camera is off')).toBeInTheDocument();

      const mockGetUserMedia = vi.fn(() =>
        Promise.reject(new DOMException('Permission denied', 'NotAllowedError'))
      );
      Object.defineProperty(globalThis.navigator, 'mediaDevices', {
        value: { getUserMedia: mockGetUserMedia },
        writable: true,
      });

      render(<VideoFeed {...defaultProps} isActive={true} />);

      await waitFor(() => {
        expect(screen.getByText('Camera access failed')).toBeInTheDocument();
      });
    });

    it('should provide retry functionality after errors', async () => {
      const mockGetUserMedia = vi.fn(() =>
        Promise.reject(new DOMException('Permission denied', 'NotAllowedError'))
      );
      Object.defineProperty(globalThis.navigator, 'mediaDevices', {
        value: { getUserMedia: mockGetUserMedia },
        writable: true,
      });

      render(<VideoFeed {...defaultProps} isActive={true} />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
      });
    });
  });

  describe('error scenarios', () => {
    it('should handle video play errors gracefully', async () => {
      const mockVideoElement = createMockVideoElement();
      mockVideoElement.play = vi.fn(() => Promise.reject(new Error('Play failed')));

      const mockGetUserMedia = vi.fn(() => Promise.resolve(createMockMediaStream()));
      Object.defineProperty(globalThis.navigator, 'mediaDevices', {
        value: { getUserMedia: mockGetUserMedia },
        writable: true,
      });

      render(<VideoFeed {...defaultProps} isActive={true} />);

      // Should handle the error without crashing
      await waitFor(() => {
        expect(mockGetUserMedia).toHaveBeenCalled();
      });

      // Error should be reported
      expect(defaultProps.onError).toHaveBeenCalled();
    });

    it('should handle non-Error exceptions in getUserMedia', async () => {
      const mockGetUserMedia = vi.fn(() => Promise.reject('String error'));
      Object.defineProperty(globalThis.navigator, 'mediaDevices', {
        value: { getUserMedia: mockGetUserMedia },
        writable: true,
      });

      render(<VideoFeed {...defaultProps} isActive={true} />);

      await waitFor(() => {
        expect(defaultProps.onError).toHaveBeenCalledWith('Failed to access camera');
      });
    });
  });
});