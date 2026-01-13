'use client';

import { memo } from 'react';
import { AlertTriangle, RefreshCw, X } from 'lucide-react';

export interface ErrorAlertProps {
  message: string;
  title?: string;
  onRetry?: () => void;
  onDismiss?: () => void;
  variant?: 'error' | 'warning';
  className?: string;
}

/**
 * ErrorAlert - Consistent error display component
 *
 * Features:
 * - Error/warning variants
 * - Optional retry button
 * - Optional dismiss button
 * - Dark mode support
 * - Consistent with app design system
 */
export const ErrorAlert = memo(({
  message,
  title,
  onRetry,
  onDismiss,
  variant = 'error',
  className = '',
}: ErrorAlertProps) => {
  const isError = variant === 'error';

  return (
    <div
      className={`
        flex items-start gap-3 p-4 rounded-xl border
        ${isError
          ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800/50'
          : 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800/50'
        }
        ${className}
      `}
      role="alert"
    >
      <div className={`
        flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center
        ${isError
          ? 'bg-red-100 dark:bg-red-900/30'
          : 'bg-amber-100 dark:bg-amber-900/30'
        }
      `}>
        <AlertTriangle className={`
          w-5 h-5
          ${isError
            ? 'text-red-600 dark:text-red-400'
            : 'text-amber-600 dark:text-amber-400'
          }
        `} />
      </div>

      <div className="flex-1 min-w-0">
        {title && (
          <h3 className={`
            text-sm font-semibold mb-1
            ${isError
              ? 'text-red-800 dark:text-red-300'
              : 'text-amber-800 dark:text-amber-300'
            }
          `}>
            {title}
          </h3>
        )}
        <p className={`
          text-sm
          ${isError
            ? 'text-red-700 dark:text-red-400'
            : 'text-amber-700 dark:text-amber-400'
          }
        `}>
          {message}
        </p>

        {onRetry && (
          <button
            onClick={onRetry}
            className={`
              mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg
              transition-colors
              ${isError
                ? 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-900/60'
                : 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 hover:bg-amber-200 dark:hover:bg-amber-900/60'
              }
            `}
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Try Again
          </button>
        )}
      </div>

      {onDismiss && (
        <button
          onClick={onDismiss}
          className={`
            flex-shrink-0 p-1 rounded-lg transition-colors
            ${isError
              ? 'text-red-500 hover:bg-red-100 dark:hover:bg-red-900/40'
              : 'text-amber-500 hover:bg-amber-100 dark:hover:bg-amber-900/40'
            }
          `}
          aria-label="Dismiss"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
});

ErrorAlert.displayName = 'ErrorAlert';

export default ErrorAlert;
