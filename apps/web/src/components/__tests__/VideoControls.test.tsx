import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { VideoControls } from '../VideoControls';

// Mock CSS modules
vi.mock('../VideoControls.module.css', () => ({
  default: {
    controls: 'controls',
    controlGroup: 'controlGroup',
    toggleButton: 'toggleButton',
    active: 'active',
  },
}));

describe('VideoControls', () => {
  const defaultProps = {
    isActive: false,
    onToggleCamera: vi.fn(),
    disabled: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('should render camera toggle button', () => {
      render(<VideoControls {...defaultProps} />);

      const button = screen.getByRole('button', { name: /turn camera on/i });
      expect(button).toBeInTheDocument();
    });

    it('should render active camera toggle button', () => {
      render(<VideoControls {...defaultProps} isActive={true} />);

      const button = screen.getByRole('button', { name: /turn camera off/i });
      expect(button).toBeInTheDocument();
    });

    it('should show correct title for inactive state', () => {
      render(<VideoControls {...defaultProps} isActive={false} />);

      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('title', 'Camera is inactive');
    });

    it('should show correct title for active state', () => {
      render(<VideoControls {...defaultProps} isActive={true} />);

      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('title', 'Camera is active');
    });

    it('should disable button when disabled prop is true', () => {
      render(<VideoControls {...defaultProps} disabled={true} />);

      const button = screen.getByRole('button');
      expect(button).toBeDisabled();
    });
  });

  describe('interactions', () => {
    it('should call onToggleCamera when button is clicked', async () => {
      const user = userEvent.setup();
      const onToggleCamera = vi.fn();
      
      render(<VideoControls {...defaultProps} onToggleCamera={onToggleCamera} />);

      const button = screen.getByRole('button');
      await user.click(button);

      expect(onToggleCamera).toHaveBeenCalledTimes(1);
    });

    it('should not call onToggleCamera when button is disabled', async () => {
      const user = userEvent.setup();
      const onToggleCamera = vi.fn();
      
      render(<VideoControls {...defaultProps} onToggleCamera={onToggleCamera} disabled={true} />);

      const button = screen.getByRole('button');
      await user.click(button);

      expect(onToggleCamera).not.toHaveBeenCalled();
    });

    it('should apply active class when camera is active', () => {
      const { container } = render(<VideoControls {...defaultProps} isActive={true} />);

      const button = container.querySelector('.toggleButton');
      expect(button).toHaveClass('active');
    });

    it('should not apply active class when camera is inactive', () => {
      const { container } = render(<VideoControls {...defaultProps} isActive={false} />);

      const button = container.querySelector('.toggleButton');
      expect(button).not.toHaveClass('active');
    });
  });

  describe('accessibility', () => {
    it('should have correct aria-label for inactive state', () => {
      render(<VideoControls {...defaultProps} isActive={false} />);

      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('aria-label', 'Turn camera on');
    });

    it('should have correct aria-label for active state', () => {
      render(<VideoControls {...defaultProps} isActive={true} />);

      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('aria-label', 'Turn camera off');
    });
  });
});