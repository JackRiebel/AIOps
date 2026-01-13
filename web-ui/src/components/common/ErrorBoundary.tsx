'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

interface ErrorBoundaryProps {
  children: ReactNode;
  /** Custom fallback component to render when an error occurs */
  fallback?: ReactNode;
  /** Called when an error is caught */
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  /** Whether to show a reset button */
  showReset?: boolean;
  /** Custom reset handler */
  onReset?: () => void;
  /** Optional name for this boundary (for logging) */
  name?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

/**
 * ErrorBoundary - Catches JavaScript errors in child components
 *
 * Usage:
 * ```tsx
 * <ErrorBoundary name="ChatSection" onError={logError}>
 *   <ChatComponent />
 * </ErrorBoundary>
 * ```
 *
 * Features:
 * - Catches errors in child component tree
 * - Prevents entire app from crashing
 * - Provides reset functionality
 * - Dark mode support
 * - Optional error callback for logging
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    this.setState({ errorInfo });

    // Call the optional error handler
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error(`[ErrorBoundary${this.props.name ? `:${this.props.name}` : ''}] Caught error:`, error);
      console.error('Component stack:', errorInfo.componentStack);
    }
  }

  handleReset = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });

    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  handleGoHome = (): void => {
    window.location.href = '/';
  };

  render(): ReactNode {
    if (this.state.hasError) {
      // If a custom fallback is provided, use it
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default error UI
      return (
        <div className="flex items-center justify-center min-h-[200px] p-6">
          <div className="max-w-md w-full">
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 rounded-xl p-6">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                  <AlertTriangle className="w-6 h-6 text-red-600 dark:text-red-400" />
                </div>

                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-semibold text-red-800 dark:text-red-300 mb-2">
                    Something went wrong
                  </h3>
                  <p className="text-sm text-red-700 dark:text-red-400 mb-4">
                    {this.state.error?.message || 'An unexpected error occurred'}
                  </p>

                  {process.env.NODE_ENV === 'development' && this.state.errorInfo && (
                    <details className="mb-4">
                      <summary className="text-xs text-red-600 dark:text-red-400 cursor-pointer hover:underline">
                        View error details
                      </summary>
                      <pre className="mt-2 p-2 bg-red-100 dark:bg-red-900/40 rounded text-xs overflow-auto max-h-32 text-red-800 dark:text-red-300">
                        {this.state.error?.stack}
                      </pre>
                    </details>
                  )}

                  <div className="flex items-center gap-3">
                    {this.props.showReset !== false && (
                      <button
                        onClick={this.handleReset}
                        className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-900/60 transition-colors"
                      >
                        <RefreshCw className="w-4 h-4" />
                        Try Again
                      </button>
                    )}
                    <button
                      onClick={this.handleGoHome}
                      className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                    >
                      <Home className="w-4 h-4" />
                      Go Home
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * withErrorBoundary - HOC to wrap a component with an error boundary
 *
 * Usage:
 * ```tsx
 * const SafeComponent = withErrorBoundary(MyComponent, {
 *   name: 'MyComponent',
 *   onError: (error) => logError(error),
 * });
 * ```
 */
export function withErrorBoundary<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  errorBoundaryProps?: Omit<ErrorBoundaryProps, 'children'>
): React.FC<P> {
  const WithErrorBoundary: React.FC<P> = (props) => (
    <ErrorBoundary {...errorBoundaryProps}>
      <WrappedComponent {...props} />
    </ErrorBoundary>
  );

  WithErrorBoundary.displayName = `withErrorBoundary(${WrappedComponent.displayName || WrappedComponent.name || 'Component'})`;

  return WithErrorBoundary;
}

export default ErrorBoundary;
