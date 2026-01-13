'use client';

import { memo, useState, useRef, useEffect } from 'react';
import { HelpCircle } from 'lucide-react';

export interface HelpTooltipProps {
  /** The help text to display */
  content: string;
  /** Optional title for the tooltip */
  title?: string;
  /** Size of the icon */
  size?: 'xs' | 'sm' | 'md';
  /** Additional CSS classes */
  className?: string;
}

/**
 * HelpTooltip - A "[?]" icon that shows explanatory text on hover
 *
 * Use this for explaining how metrics are calculated or what they mean.
 */
export const HelpTooltip = memo(({
  content,
  title,
  size = 'sm',
  className = '',
}: HelpTooltipProps) => {
  const [isVisible, setIsVisible] = useState(false);
  const [position, setPosition] = useState<'top' | 'bottom'>('top');
  const triggerRef = useRef<HTMLButtonElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  // Determine if tooltip should appear above or below
  useEffect(() => {
    if (isVisible && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const spaceAbove = rect.top;
      const spaceBelow = window.innerHeight - rect.bottom;

      // Show below if not enough space above (need ~100px for tooltip)
      if (spaceAbove < 100 && spaceBelow > spaceAbove) {
        setPosition('bottom');
      } else {
        setPosition('top');
      }
    }
  }, [isVisible]);

  const sizeClasses = {
    xs: 'w-3 h-3',
    sm: 'w-3.5 h-3.5',
    md: 'w-4 h-4',
  };

  return (
    <div className={`relative inline-flex ${className}`}>
      <button
        ref={triggerRef}
        type="button"
        onMouseEnter={() => setIsVisible(true)}
        onMouseLeave={() => setIsVisible(false)}
        onFocus={() => setIsVisible(true)}
        onBlur={() => setIsVisible(false)}
        className="p-0.5 rounded-full text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
        aria-label={title || 'Help'}
      >
        <HelpCircle className={sizeClasses[size]} />
      </button>

      {/* Tooltip */}
      {isVisible && (
        <div
          ref={tooltipRef}
          role="tooltip"
          className={`
            absolute z-50 w-64 p-3 rounded-lg shadow-lg
            bg-slate-900 dark:bg-slate-700 text-white
            text-xs leading-relaxed
            animate-in fade-in-0 zoom-in-95 duration-150
            ${position === 'top' ? 'bottom-full mb-2' : 'top-full mt-2'}
            left-1/2 -translate-x-1/2
          `}
        >
          {title && (
            <div className="font-semibold mb-1 text-slate-100">{title}</div>
          )}
          <div className="text-slate-300">{content}</div>

          {/* Arrow */}
          <div
            className={`
              absolute left-1/2 -translate-x-1/2 w-0 h-0
              border-x-[6px] border-x-transparent
              ${position === 'top'
                ? 'top-full border-t-[6px] border-t-slate-900 dark:border-t-slate-700'
                : 'bottom-full border-b-[6px] border-b-slate-900 dark:border-b-slate-700'
              }
            `}
          />
        </div>
      )}
    </div>
  );
});

HelpTooltip.displayName = 'HelpTooltip';

export default HelpTooltip;
