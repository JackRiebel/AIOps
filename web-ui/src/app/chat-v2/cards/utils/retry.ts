/**
 * Retry Utility - Exponential backoff retry logic for card data fetching
 *
 * Features:
 * - Exponential backoff with configurable parameters
 * - Respects Retry-After header for 429 responses
 * - Adds jitter to prevent thundering herd
 * - Distinguishes between retryable and non-retryable errors
 */

// =============================================================================
// Constants
// =============================================================================

/** HTTP status codes that are safe to retry */
export const RETRYABLE_STATUS_CODES = new Set([
  408, // Request Timeout
  429, // Too Many Requests
  500, // Internal Server Error
  502, // Bad Gateway
  503, // Service Unavailable
  504, // Gateway Timeout
]);

/** HTTP status codes that should NOT be retried (client errors) */
export const NON_RETRYABLE_STATUS_CODES = new Set([
  400, // Bad Request
  401, // Unauthorized
  403, // Forbidden
  404, // Not Found
  405, // Method Not Allowed
  422, // Unprocessable Entity
]);

// =============================================================================
// Types
// =============================================================================

export interface RetryConfig {
  /** Maximum number of retry attempts (default: 3) */
  maxRetries: number;
  /** Initial delay in milliseconds (default: 500) */
  initialDelayMs: number;
  /** Maximum delay in milliseconds (default: 10000) */
  maxDelayMs: number;
  /** Multiplier for exponential backoff (default: 2) */
  multiplier: number;
  /** Jitter factor (0-1) to randomize delays (default: 0.2) */
  jitterFactor: number;
}

export interface RetryState {
  /** Current retry attempt (0 = first attempt, not a retry) */
  attempt: number;
  /** Whether we're currently retrying */
  isRetrying: boolean;
  /** Total number of retries made */
  retryCount: number;
  /** Last error message if any */
  lastError: string | null;
}

export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  initialDelayMs: 500,
  maxDelayMs: 10000,
  multiplier: 2,
  jitterFactor: 0.2,
};

// =============================================================================
// Core Functions
// =============================================================================

/**
 * Determines if a request should be retried based on HTTP status code
 */
export function shouldRetry(
  status: number,
  attempt: number,
  maxRetries: number
): boolean {
  // Don't retry if we've exhausted attempts
  if (attempt >= maxRetries) {
    return false;
  }

  // Don't retry client errors (4xx except specific ones)
  if (NON_RETRYABLE_STATUS_CODES.has(status)) {
    return false;
  }

  // Retry server errors and specific client errors
  return RETRYABLE_STATUS_CODES.has(status);
}

/**
 * Calculates the delay before the next retry attempt
 *
 * Uses exponential backoff with optional jitter:
 * delay = min(initialDelay * multiplier^attempt, maxDelay) * (1 + random jitter)
 */
export function getRetryDelay(
  attempt: number,
  config: RetryConfig = DEFAULT_RETRY_CONFIG,
  retryAfterHeader?: string | null
): number {
  // If server provided Retry-After header, respect it
  if (retryAfterHeader) {
    const retryAfterSeconds = parseInt(retryAfterHeader, 10);
    if (!isNaN(retryAfterSeconds)) {
      return Math.min(retryAfterSeconds * 1000, config.maxDelayMs);
    }

    // Try parsing as HTTP date
    const retryAfterDate = new Date(retryAfterHeader);
    if (!isNaN(retryAfterDate.getTime())) {
      const delayMs = retryAfterDate.getTime() - Date.now();
      if (delayMs > 0) {
        return Math.min(delayMs, config.maxDelayMs);
      }
    }
  }

  // Calculate exponential backoff
  const baseDelay = config.initialDelayMs * Math.pow(config.multiplier, attempt);
  const cappedDelay = Math.min(baseDelay, config.maxDelayMs);

  // Add jitter to prevent thundering herd
  const jitter = 1 + (Math.random() * 2 - 1) * config.jitterFactor;
  return Math.round(cappedDelay * jitter);
}

/**
 * Creates an error object from an HTTP response
 */
export function createRetryError(response: Response): Error {
  const error = new Error(`HTTP ${response.status}: ${response.statusText}`);
  (error as Error & { status?: number }).status = response.status;
  return error;
}

/**
 * Wraps a fetch function with retry logic
 */
export async function fetchWithRetry<T>(
  fetchFn: () => Promise<Response>,
  config: Partial<RetryConfig> = {},
  onRetry?: (attempt: number, delay: number, error: Error) => void
): Promise<{ response: Response; retryCount: number }> {
  const fullConfig = { ...DEFAULT_RETRY_CONFIG, ...config };
  let lastError: Error | null = null;
  let retryCount = 0;

  for (let attempt = 0; attempt <= fullConfig.maxRetries; attempt++) {
    try {
      const response = await fetchFn();

      // Success - return the response
      if (response.ok) {
        return { response, retryCount };
      }

      // Check if we should retry
      if (shouldRetry(response.status, attempt, fullConfig.maxRetries)) {
        retryCount++;
        const delay = getRetryDelay(
          attempt,
          fullConfig,
          response.headers.get('Retry-After')
        );

        lastError = createRetryError(response);
        onRetry?.(attempt + 1, delay, lastError);

        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }

      // Non-retryable error - return the response as-is
      return { response, retryCount };
    } catch (error) {
      // Network error - retry if we have attempts left
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt < fullConfig.maxRetries) {
        retryCount++;
        const delay = getRetryDelay(attempt, fullConfig);
        onRetry?.(attempt + 1, delay, lastError);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }

      // No more retries - throw the error
      throw lastError;
    }
  }

  // Should never reach here, but TypeScript needs this
  throw lastError || new Error('Max retries exceeded');
}

// =============================================================================
// React Hook Helpers
// =============================================================================

/**
 * Creates initial retry state
 */
export function createInitialRetryState(): RetryState {
  return {
    attempt: 0,
    isRetrying: false,
    retryCount: 0,
    lastError: null,
  };
}

/**
 * Updates retry state for a new attempt
 */
export function updateRetryState(
  state: RetryState,
  attempt: number,
  error?: string
): RetryState {
  return {
    ...state,
    attempt,
    isRetrying: true,
    retryCount: attempt,
    lastError: error ?? state.lastError,
  };
}

/**
 * Resets retry state after success
 */
export function resetRetryState(): RetryState {
  return createInitialRetryState();
}

/**
 * Finalizes retry state with error
 */
export function finalizeRetryStateWithError(
  state: RetryState,
  error: string
): RetryState {
  return {
    ...state,
    isRetrying: false,
    lastError: error,
  };
}
