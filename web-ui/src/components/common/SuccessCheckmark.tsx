'use client';

import { memo, useEffect, useState } from 'react';
import { Check, CheckCircle, CheckCircle2 } from 'lucide-react';

export interface SuccessCheckmarkProps {
  /** Whether to show the checkmark */
  show: boolean;
  /** Callback when animation completes */
  onComplete?: () => void;
  /** Duration to show before auto-hiding (0 = no auto-hide) */
  autoHideDuration?: number;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Style variant */
  variant?: 'minimal' | 'circle' | 'filled';
  /** Additional CSS classes */
  className?: string;
}

/**
 * SuccessCheckmark - Animated success indicator
 *
 * Shows an animated checkmark with optional auto-hide.
 * Use after successful operations like saving, submitting, etc.
 */
export const SuccessCheckmark = memo(({
  show,
  onComplete,
  autoHideDuration = 0,
  size = 'md',
  variant = 'circle',
  className = '',
}: SuccessCheckmarkProps) => {
  const [isVisible, setIsVisible] = useState(show);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    if (show) {
      setIsVisible(true);
      setIsAnimating(true);

      // Trigger complete callback after animation
      const animationTimeout = setTimeout(() => {
        setIsAnimating(false);
        onComplete?.();
      }, 600);

      // Auto-hide if duration is set
      if (autoHideDuration > 0) {
        const hideTimeout = setTimeout(() => {
          setIsVisible(false);
        }, autoHideDuration);

        return () => {
          clearTimeout(animationTimeout);
          clearTimeout(hideTimeout);
        };
      }

      return () => clearTimeout(animationTimeout);
    } else {
      setIsVisible(false);
    }
  }, [show, autoHideDuration, onComplete]);

  if (!isVisible) return null;

  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8',
  };

  const containerSizes = {
    sm: 'w-6 h-6',
    md: 'w-10 h-10',
    lg: 'w-14 h-14',
  };

  const Icon = variant === 'filled' ? CheckCircle2 : variant === 'circle' ? CheckCircle : Check;

  if (variant === 'minimal') {
    return (
      <span
        className={`
          inline-flex items-center justify-center
          text-green-500 dark:text-green-400
          ${isAnimating ? 'animate-in zoom-in-50 duration-300' : ''}
          ${className}
        `}
      >
        <Icon className={sizeClasses[size]} />
      </span>
    );
  }

  return (
    <span
      className={`
        inline-flex items-center justify-center rounded-full
        ${containerSizes[size]}
        ${variant === 'filled'
          ? 'bg-green-500 text-white'
          : 'bg-green-100 dark:bg-green-500/20 text-green-600 dark:text-green-400'
        }
        ${isAnimating ? 'animate-in zoom-in-50 spin-in-12 duration-300' : ''}
        ${className}
      `}
    >
      <Icon className={sizeClasses[size]} />
    </span>
  );
});

SuccessCheckmark.displayName = 'SuccessCheckmark';

export default SuccessCheckmark;
