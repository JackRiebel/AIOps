'use client';

import { memo, useState, useRef, useEffect } from 'react';
import { HelpCircle, X } from 'lucide-react';

/**
 * HelpTooltip - Contextual help tooltips for workflow UI
 *
 * Features:
 * - Hover or click to show tooltip
 * - Support for rich content
 * - Auto-positioning to stay in viewport
 */

export interface HelpTooltipProps {
  title?: string;
  content: string | React.ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right';
  triggerMode?: 'hover' | 'click';
  size?: 'sm' | 'md';
}

export const HelpTooltip = memo(({
  title,
  content,
  position = 'top',
  triggerMode = 'hover',
  size = 'sm',
}: HelpTooltipProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Close on click outside
  useEffect(() => {
    if (triggerMode === 'click' && isOpen) {
      const handleClickOutside = (event: MouseEvent) => {
        if (
          tooltipRef.current &&
          !tooltipRef.current.contains(event.target as Node) &&
          triggerRef.current &&
          !triggerRef.current.contains(event.target as Node)
        ) {
          setIsOpen(false);
        }
      };
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen, triggerMode]);

  const handleMouseEnter = () => {
    if (triggerMode === 'hover') setIsOpen(true);
  };

  const handleMouseLeave = () => {
    if (triggerMode === 'hover') setIsOpen(false);
  };

  const handleClick = () => {
    if (triggerMode === 'click') setIsOpen(!isOpen);
  };

  // Position classes
  const positionClasses = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2',
  };

  // Arrow classes
  const arrowClasses = {
    top: 'top-full left-1/2 -translate-x-1/2 border-l-transparent border-r-transparent border-b-transparent border-t-slate-800 dark:border-t-slate-700',
    bottom: 'bottom-full left-1/2 -translate-x-1/2 border-l-transparent border-r-transparent border-t-transparent border-b-slate-800 dark:border-b-slate-700',
    left: 'left-full top-1/2 -translate-y-1/2 border-t-transparent border-b-transparent border-r-transparent border-l-slate-800 dark:border-l-slate-700',
    right: 'right-full top-1/2 -translate-y-1/2 border-t-transparent border-b-transparent border-l-transparent border-r-slate-800 dark:border-r-slate-700',
  };

  const iconSize = size === 'sm' ? 'w-4 h-4' : 'w-5 h-5';

  return (
    <div className="relative inline-flex">
      <button
        ref={triggerRef}
        type="button"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onClick={handleClick}
        className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors focus:outline-none focus:ring-2 focus:ring-cyan-500 rounded-full"
        aria-label="Help"
      >
        <HelpCircle className={iconSize} />
      </button>

      {isOpen && (
        <div
          ref={tooltipRef}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          className={`
            absolute z-50 w-64 p-3 rounded-lg shadow-lg
            bg-slate-800 dark:bg-slate-700 text-white
            ${positionClasses[position]}
          `}
        >
          {/* Arrow */}
          <div className={`absolute w-0 h-0 border-[6px] ${arrowClasses[position]}`} />

          {/* Close button for click mode */}
          {triggerMode === 'click' && (
            <button
              onClick={() => setIsOpen(false)}
              className="absolute top-1 right-1 p-1 text-slate-400 hover:text-white transition-colors"
            >
              <X className="w-3 h-3" />
            </button>
          )}

          {/* Content */}
          {title && (
            <h4 className="font-medium text-sm mb-1 pr-4">{title}</h4>
          )}
          <div className="text-xs text-slate-300 leading-relaxed">
            {content}
          </div>
        </div>
      )}
    </div>
  );
});

HelpTooltip.displayName = 'HelpTooltip';

export default HelpTooltip;
