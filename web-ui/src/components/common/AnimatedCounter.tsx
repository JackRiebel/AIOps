'use client';

import { memo, useEffect, useRef, useState } from 'react';

export interface AnimatedCounterProps {
  /** The target value to animate to */
  value: number;
  /** Duration of the animation in milliseconds */
  duration?: number;
  /** Number of decimal places to show */
  decimals?: number;
  /** Prefix to add before the number (e.g., "$") */
  prefix?: string;
  /** Suffix to add after the number (e.g., "%") */
  suffix?: string;
  /** Use locale formatting (commas for thousands) */
  useLocale?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Whether to animate on initial mount */
  animateOnMount?: boolean;
}

/**
 * AnimatedCounter - Smoothly animates between number values
 *
 * Use this for displaying stats that change, creating a
 * "rolling numbers" effect when values update.
 */
export const AnimatedCounter = memo(({
  value,
  duration = 500,
  decimals = 0,
  prefix = '',
  suffix = '',
  useLocale = true,
  className = '',
  animateOnMount = true,
}: AnimatedCounterProps) => {
  const [displayValue, setDisplayValue] = useState(animateOnMount ? 0 : value);
  const previousValue = useRef(animateOnMount ? 0 : value);
  const animationRef = useRef<number | null>(null);

  useEffect(() => {
    const startValue = previousValue.current;
    const endValue = value;
    const startTime = performance.now();

    // Cancel any existing animation
    if (animationRef.current !== null) {
      cancelAnimationFrame(animationRef.current);
    }

    // Easing function (ease-out quad)
    const easeOutQuad = (t: number) => t * (2 - t);

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easedProgress = easeOutQuad(progress);

      const currentValue = startValue + (endValue - startValue) * easedProgress;
      setDisplayValue(currentValue);

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      } else {
        previousValue.current = endValue;
      }
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current !== null) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [value, duration]);

  const formatValue = (val: number): string => {
    const fixed = val.toFixed(decimals);
    if (useLocale) {
      return Number(fixed).toLocaleString(undefined, {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      });
    }
    return fixed;
  };

  return (
    <span className={className}>
      {prefix}{formatValue(displayValue)}{suffix}
    </span>
  );
});

AnimatedCounter.displayName = 'AnimatedCounter';

export default AnimatedCounter;
