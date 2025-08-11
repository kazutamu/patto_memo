import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { VideoControls } from '../VideoControls';
import { MotionDetectionState } from '../../types';

// Mock CSS modules
vi.mock('../VideoControls.module.css', () => ({
  default: {
    controls: 'controls',
    controlGroup: 'controlGroup',
    controlLabel: 'controlLabel',
    toggleButton: 'toggleButton',
    active: 'active',
    toggleIcon: 'toggleIcon',
    toggleText: 'toggleText',
    sliderContainer: 'sliderContainer',
    slider: 'slider',
    sliderLabels: 'sliderLabels',
    sliderLabel: 'sliderLabel',
    sliderValue: 'sliderValue',
    controlDescription: 'controlDescription',
    statusIndicator: 'statusIndicator',
    statusDot: 'statusDot',
    statusText: 'statusText',
    inactive: 'inactive',
    motionActive: 'motionActive',
    monitoring: 'monitoring',
    motionDetails: 'motionDetails',
    motionStrength: 'motionStrength',
    motionLabel: 'motionLabel',
    strengthBar: 'strengthBar',
    strengthFill: 'strengthFill',
    strengthValue: 'strengthValue',
  },
}));

describe('VideoControls', () => {
  const defaultProps = {
    isActive: false,
    onToggleCamera: vi.fn(),
    sensitivity: 50,
    onSensitivityChange: vi.fn(),
    disabled: false,
  };

  const defaultMotionState: MotionDetectionState = {
    isDetecting: false,
    motionStrength: 0,
    lastMotionTime: null,
    sensitivity: 50,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('should render all control sections', () => {
      render(<VideoControls {...defaultProps} />);

      expect(screen.getByText('Camera')).toBeInTheDocument();
      expect(screen.getByText('Motion Sensitivity')).toBeInTheDocument();
      expect(screen.getByText('Motion Detection Status')).toBeInTheDocument();
    });

    it('should render camera toggle button with correct state', () => {
      render(<VideoControls {...defaultProps} isActive={false} />);

      const button = screen.getByRole('button', { name: /turn camera on/i });
      expect(button).toBeInTheDocument();
      expect(screen.getByText('📷')).toBeInTheDocument(); // Camera off icon
      expect(screen.getByText('Off')).toBeInTheDocument();
    });

    it('should render active camera toggle button', () => {
      render(<VideoControls {...defaultProps} isActive={true} />);

      const button = screen.getByRole('button', { name: /turn camera off/i });
      expect(button).toBeInTheDocument();
      expect(screen.getByText('📹')).toBeInTheDocument(); // Camera on icon
      expect(screen.getByText('On')).toBeInTheDocument();
    });

    it('should render sensitivity slider with correct value', () => {
      render(<VideoControls {...defaultProps} sensitivity={75} />);

      const slider = screen.getByRole('slider', { name: /motion detection sensitivity/i });
      expect(slider).toHaveValue('75');
      expect(screen.getByText('75%')).toBeInTheDocument();
    });

    it('should render slider labels correctly', () => {
      render(<VideoControls {...defaultProps} />);

      expect(screen.getByText('Low')).toBeInTheDocument();
      expect(screen.getByText('High')).toBeInTheDocument();
      expect(screen.getByText('Adjust how sensitive the motion detection should be')).toBeInTheDocument();
    });
  });

  describe('camera controls', () => {
    it('should call onToggleCamera when button is clicked', async () => {
      const user = userEvent.setup();
      render(<VideoControls {...defaultProps} />);

      const button = screen.getByRole('button', { name: /turn camera on/i });
      await user.click(button);

      expect(defaultProps.onToggleCamera).toHaveBeenCalledTimes(1);
    });

    it('should disable camera button when disabled prop is true', () => {
      render(<VideoControls {...defaultProps} disabled={true} />);

      const button = screen.getByRole('button', { name: /turn camera on/i });
      expect(button).toBeDisabled();
    });

    it('should apply active class when camera is on', () => {
      const { container } = render(<VideoControls {...defaultProps} isActive={true} />);

      const button = container.querySelector('.toggleButton');
      expect(button).toHaveClass('active');
    });

    it('should not apply active class when camera is off', () => {
      const { container } = render(<VideoControls {...defaultProps} isActive={false} />);

      const button = container.querySelector('.toggleButton');
      expect(button).not.toHaveClass('active');
    });
  });

  describe('sensitivity controls', () => {
    it('should call onSensitivityChange when slider value changes', async () => {
      render(<VideoControls {...defaultProps} />);

      const slider = screen.getByRole('slider');
      
      // Simulate changing slider value
      fireEvent.change(slider, { target: { value: '80' } });

      expect(defaultProps.onSensitivityChange).toHaveBeenCalledWith(80);
    });

    it('should disable sensitivity slider when disabled prop is true', () => {
      render(<VideoControls {...defaultProps} disabled={true} />);

      const slider = screen.getByRole('slider');
      expect(slider).toBeDisabled();
    });

    it('should display correct sensitivity value', () => {
      render(<VideoControls {...defaultProps} sensitivity={25} />);

      expect(screen.getByText('25%')).toBeInTheDocument();
    });

    it('should handle slider boundaries correctly', async () => {
      render(<VideoControls {...defaultProps} />);

      const slider = screen.getByRole('slider');
      expect(slider).toHaveAttribute('min', '1');
      expect(slider).toHaveAttribute('max', '100');
    });

    it('should parse sensitivity values as integers', () => {
      render(<VideoControls {...defaultProps} />);

      const slider = screen.getByRole('slider');
      fireEvent.change(slider, { target: { value: '75.7' } });

      expect(defaultProps.onSensitivityChange).toHaveBeenCalledWith(75);
    });
  });

  describe('motion status display', () => {
    it('should show "Camera inactive" when camera is off', () => {
      render(<VideoControls {...defaultProps} isActive={false} />);

      expect(screen.getByText('Camera inactive')).toBeInTheDocument();
    });

    it('should show "Motion detection inactive" when camera is on but no motion state', () => {
      render(<VideoControls {...defaultProps} isActive={true} />);

      expect(screen.getByText('Motion detection inactive')).toBeInTheDocument();
    });

    it('should show "Motion detection inactive" when camera is on but motion detection is not active', () => {
      const motionState = {
        ...defaultMotionState,
        isDetecting: false,
      };

      render(<VideoControls {...defaultProps} isActive={true} motionState={motionState} />);

      expect(screen.getByText('Motion detection inactive')).toBeInTheDocument();
    });

    it('should show "Monitoring for motion" when actively detecting with no motion', () => {
      const motionState = {
        ...defaultMotionState,
        isDetecting: true,
        motionStrength: 0,
      };

      render(<VideoControls {...defaultProps} isActive={true} motionState={motionState} />);

      expect(screen.getByText('Monitoring for motion')).toBeInTheDocument();
    });

    it('should show "Motion detected!" when motion is present', () => {
      const motionState = {
        ...defaultMotionState,
        isDetecting: true,
        motionStrength: 65,
      };

      render(<VideoControls {...defaultProps} isActive={true} motionState={motionState} />);

      expect(screen.getByText('Motion detected!')).toBeInTheDocument();
    });
  });

  describe('motion status styling', () => {
    it('should apply inactive class when camera is off', () => {
      const { container } = render(<VideoControls {...defaultProps} isActive={false} />);

      const statusDot = container.querySelector('.statusDot');
      expect(statusDot).toHaveClass('inactive');
    });

    it('should apply inactive class when motion detection is not active', () => {
      const motionState = {
        ...defaultMotionState,
        isDetecting: false,
      };

      const { container } = render(
        <VideoControls {...defaultProps} isActive={true} motionState={motionState} />
      );

      const statusDot = container.querySelector('.statusDot');
      expect(statusDot).toHaveClass('inactive');
    });

    it('should apply monitoring class when actively monitoring', () => {
      const motionState = {
        ...defaultMotionState,
        isDetecting: true,
        motionStrength: 0,
      };

      const { container } = render(
        <VideoControls {...defaultProps} isActive={true} motionState={motionState} />
      );

      const statusDot = container.querySelector('.statusDot');
      expect(statusDot).toHaveClass('monitoring');
    });

    it('should apply motionActive class when motion is detected', () => {
      const motionState = {
        ...defaultMotionState,
        isDetecting: true,
        motionStrength: 40,
      };

      const { container } = render(
        <VideoControls {...defaultProps} isActive={true} motionState={motionState} />
      );

      const statusDot = container.querySelector('.statusDot');
      expect(statusDot).toHaveClass('motionActive');
    });
  });

  describe('motion strength display', () => {
    it('should show motion details when motion detection is active', () => {
      const motionState = {
        ...defaultMotionState,
        isDetecting: true,
        motionStrength: 45,
      };

      render(<VideoControls {...defaultProps} isActive={true} motionState={motionState} />);

      expect(screen.getByText('Motion Strength:')).toBeInTheDocument();
      expect(screen.getByText('45.0%')).toBeInTheDocument();
    });

    it('should not show motion details when motion detection is inactive', () => {
      const motionState = {
        ...defaultMotionState,
        isDetecting: false,
      };

      render(<VideoControls {...defaultProps} isActive={true} motionState={motionState} />);

      expect(screen.queryByText('Motion Strength:')).not.toBeInTheDocument();
    });

    it('should not show motion details when no motion state is provided', () => {
      render(<VideoControls {...defaultProps} isActive={true} />);

      expect(screen.queryByText('Motion Strength:')).not.toBeInTheDocument();
    });

    it('should display motion strength bar with correct width', () => {
      const motionState = {
        ...defaultMotionState,
        isDetecting: true,
        motionStrength: 75,
      };

      const { container } = render(
        <VideoControls {...defaultProps} isActive={true} motionState={motionState} />
      );

      const strengthFill = container.querySelector('.strengthFill');
      expect(strengthFill).toHaveStyle({ width: '75%' });
    });

    it('should cap motion strength bar at 100%', () => {
      const motionState = {
        ...defaultMotionState,
        isDetecting: true,
        motionStrength: 150, // Over 100%
      };

      const { container } = render(
        <VideoControls {...defaultProps} isActive={true} motionState={motionState} />
      );

      const strengthFill = container.querySelector('.strengthFill');
      expect(strengthFill).toHaveStyle({ width: '100%' });
    });

    it('should display motion strength value with one decimal place', () => {
      const motionState = {
        ...defaultMotionState,
        isDetecting: true,
        motionStrength: 33.456,
      };

      render(<VideoControls {...defaultProps} isActive={true} motionState={motionState} />);

      expect(screen.getByText('33.5%')).toBeInTheDocument();
    });

    it('should handle zero motion strength', () => {
      const motionState = {
        ...defaultMotionState,
        isDetecting: true,
        motionStrength: 0,
      };

      const { container } = render(
        <VideoControls {...defaultProps} isActive={true} motionState={motionState} />
      );

      const strengthFill = container.querySelector('.strengthFill');
      expect(strengthFill).toHaveStyle({ width: '0%' });
      expect(screen.getByText('0.0%')).toBeInTheDocument();
    });
  });

  describe('accessibility', () => {
    it('should have proper labels for form controls', () => {
      render(<VideoControls {...defaultProps} />);

      expect(screen.getByLabelText(/motion detection sensitivity/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /turn camera/i })).toBeInTheDocument();
    });

    it('should have descriptive button aria-labels', () => {
      render(<VideoControls {...defaultProps} isActive={false} />);

      expect(screen.getByRole('button', { name: 'Turn camera on' })).toBeInTheDocument();

      const { rerender } = render(<VideoControls {...defaultProps} isActive={true} />);
      rerender(<VideoControls {...defaultProps} isActive={true} />);

      expect(screen.getByRole('button', { name: 'Turn camera off' })).toBeInTheDocument();
    });

    it('should associate slider with its label', () => {
      render(<VideoControls {...defaultProps} />);

      const slider = screen.getByRole('slider');
      expect(slider).toHaveAttribute('id', 'sensitivity-slider');
      
      const label = screen.getByText('Motion Sensitivity');
      expect(label).toHaveAttribute('for', 'sensitivity-slider');
    });

    it('should provide helpful descriptions', () => {
      render(<VideoControls {...defaultProps} />);

      expect(screen.getByText('Adjust how sensitive the motion detection should be')).toBeInTheDocument();
    });
  });

  describe('edge cases', () => {
    it('should handle undefined motionState gracefully', () => {
      expect(() => {
        render(<VideoControls {...defaultProps} motionState={undefined} />);
      }).not.toThrow();

      expect(screen.getByText('Camera inactive')).toBeInTheDocument();
    });

    it('should handle negative sensitivity values', () => {
      render(<VideoControls {...defaultProps} sensitivity={-10} />);

      expect(screen.getByDisplayValue('-10')).toBeInTheDocument();
      expect(screen.getByText('-10%')).toBeInTheDocument();
    });

    it('should handle very high sensitivity values', () => {
      render(<VideoControls {...defaultProps} sensitivity={500} />);

      expect(screen.getByDisplayValue('500')).toBeInTheDocument();
      expect(screen.getByText('500%')).toBeInTheDocument();
    });

    it('should handle NaN sensitivity values', () => {
      render(<VideoControls {...defaultProps} />);

      const slider = screen.getByRole('slider');
      fireEvent.change(slider, { target: { value: 'not-a-number' } });

      // parseInt('not-a-number') returns NaN, so onSensitivityChange should be called with NaN
      expect(defaultProps.onSensitivityChange).toHaveBeenCalledWith(NaN);
    });

    it('should handle missing callback functions gracefully', () => {
      const propsWithoutCallbacks = {
        isActive: false,
        sensitivity: 50,
        disabled: false,
      };

      expect(() => {
        render(<VideoControls {...propsWithoutCallbacks as any} />);
      }).toThrow(); // Should throw because onToggleCamera and onSensitivityChange are required
    });
  });

  describe('complex motion states', () => {
    it('should handle rapid motion strength changes', () => {
      const { rerender } = render(<VideoControls {...defaultProps} isActive={true} />);

      // Simulate rapidly changing motion strength
      const motionStates = [
        { ...defaultMotionState, isDetecting: true, motionStrength: 0 },
        { ...defaultMotionState, isDetecting: true, motionStrength: 50 },
        { ...defaultMotionState, isDetecting: true, motionStrength: 100 },
        { ...defaultMotionState, isDetecting: true, motionStrength: 25 },
      ];

      motionStates.forEach((state) => {
        rerender(<VideoControls {...defaultProps} isActive={true} motionState={state} />);
        expect(screen.getByText(`${state.motionStrength.toFixed(1)}%`)).toBeInTheDocument();
      });
    });

    it('should handle switching between motion states', () => {
      const { rerender } = render(<VideoControls {...defaultProps} isActive={true} />);

      // Start with inactive detection
      rerender(<VideoControls {...defaultProps} isActive={true} motionState={{
        ...defaultMotionState,
        isDetecting: false,
      }} />);
      expect(screen.getByText('Motion detection inactive')).toBeInTheDocument();

      // Switch to monitoring
      rerender(<VideoControls {...defaultProps} isActive={true} motionState={{
        ...defaultMotionState,
        isDetecting: true,
        motionStrength: 0,
      }} />);
      expect(screen.getByText('Monitoring for motion')).toBeInTheDocument();

      // Switch to motion detected
      rerender(<VideoControls {...defaultProps} isActive={true} motionState={{
        ...defaultMotionState,
        isDetecting: true,
        motionStrength: 80,
      }} />);
      expect(screen.getByText('Motion detected!')).toBeInTheDocument();
    });
  });
});