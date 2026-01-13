/**
 * Centralized logging utility for the web-ui
 *
 * Features:
 * - Environment-aware logging (only errors in production)
 * - Module-tagged messages for easier debugging
 * - Consistent formatting across the app
 *
 * Usage:
 * ```typescript
 * import { logger } from '@/utils/logger';
 *
 * logger.debug('MyComponent', 'Initializing with props', { prop1, prop2 });
 * logger.info('MyComponent', 'User action completed');
 * logger.warn('MyComponent', 'Deprecation warning: use newMethod instead');
 * logger.error('MyComponent', 'Failed to fetch data', error);
 * ```
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/**
 * Determine if a log level should be output based on environment
 */
function shouldLog(level: LogLevel): boolean {
  // In production, only log errors
  if (process.env.NODE_ENV === 'production') {
    return level === 'error';
  }
  // In development/test, log everything
  return true;
}

/**
 * Format a log message with module tag and optional data
 */
function formatMessage(module: string, message: string): string {
  return `[${module}] ${message}`;
}

/**
 * Safely stringify data for logging
 */
function formatData(data: unknown): unknown {
  if (data === undefined) return '';
  if (data instanceof Error) {
    return {
      name: data.name,
      message: data.message,
      stack: data.stack,
    };
  }
  return data;
}

export const logger = {
  /**
   * Debug-level logging (development only)
   * Use for detailed information useful during development
   */
  debug: (module: string, message: string, data?: unknown): void => {
    if (shouldLog('debug')) {
      if (data !== undefined) {
        console.log(formatMessage(module, message), formatData(data));
      } else {
        console.log(formatMessage(module, message));
      }
    }
  },

  /**
   * Info-level logging (development only)
   * Use for general operational information
   */
  info: (module: string, message: string, data?: unknown): void => {
    if (shouldLog('info')) {
      if (data !== undefined) {
        console.info(formatMessage(module, message), formatData(data));
      } else {
        console.info(formatMessage(module, message));
      }
    }
  },

  /**
   * Warning-level logging (development only)
   * Use for unexpected but non-critical issues
   */
  warn: (module: string, message: string, data?: unknown): void => {
    if (shouldLog('warn')) {
      if (data !== undefined) {
        console.warn(formatMessage(module, message), formatData(data));
      } else {
        console.warn(formatMessage(module, message));
      }
    }
  },

  /**
   * Error-level logging (always logged)
   * Use for errors that need attention
   */
  error: (module: string, message: string, error?: unknown): void => {
    if (shouldLog('error')) {
      if (error !== undefined) {
        console.error(formatMessage(module, message), formatData(error));
      } else {
        console.error(formatMessage(module, message));
      }
    }
  },

  /**
   * Group logging for related messages (development only)
   * Useful for complex operations with multiple log lines
   */
  group: (module: string, label: string, fn: () => void): void => {
    if (shouldLog('debug')) {
      console.group(formatMessage(module, label));
      try {
        fn();
      } finally {
        console.groupEnd();
      }
    }
  },

  /**
   * Time a function execution (development only)
   * Useful for performance debugging
   */
  time: async <T>(module: string, label: string, fn: () => T | Promise<T>): Promise<T> => {
    if (!shouldLog('debug')) {
      return fn();
    }

    const start = performance.now();
    try {
      const result = await fn();
      const duration = performance.now() - start;
      console.log(formatMessage(module, `${label} completed in ${duration.toFixed(2)}ms`));
      return result;
    } catch (error) {
      const duration = performance.now() - start;
      console.error(formatMessage(module, `${label} failed after ${duration.toFixed(2)}ms`), error);
      throw error;
    }
  },
};

export default logger;
