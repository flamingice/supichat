'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    this.props.onError?.(error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-[200px] flex items-center justify-center p-6">
          <div className="text-center space-y-4 max-w-md">
            <div className="text-6xl">😵</div>
            <div className="space-y-2">
              <h2 className="text-xl font-semibold text-red-400">Something went wrong</h2>
              <p className="text-sm text-neutral-400">
                The component crashed unexpectedly. You can try refreshing the page.
              </p>
              {process.env.NODE_ENV === 'development' && this.state.error && (
                <details className="text-left text-xs bg-neutral-900 p-3 rounded mt-4">
                  <summary className="cursor-pointer text-yellow-400 mb-2">Error details (dev only)</summary>
                  <pre className="whitespace-pre-wrap text-red-300">
                    {this.state.error.message}
                    {'\n\n'}
                    {this.state.error.stack}
                  </pre>
                </details>
              )}
            </div>
            <div className="flex gap-2 justify-center">
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded text-sm"
              >
                Refresh Page
              </button>
              <button
                onClick={() => this.setState({ hasError: false })}
                className="px-4 py-2 bg-neutral-700 hover:bg-neutral-600 text-white rounded text-sm"
              >
                Try Again
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Hook-based error boundary for functional components
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  fallback?: ReactNode
) {
  return function WrappedComponent(props: P) {
    return (
      <ErrorBoundary fallback={fallback}>
        <Component {...props} />
      </ErrorBoundary>
    );
  };
}

// Specialized error boundary for video/WebRTC components
export function VideoErrorBoundary({ children }: { children: ReactNode }) {
  return (
    <ErrorBoundary
      fallback={
        <div className="aspect-video bg-neutral-900 rounded-lg flex items-center justify-center">
          <div className="text-center space-y-2">
            <div className="text-2xl">📹</div>
            <div className="text-sm text-neutral-400">Video component error</div>
            <button
              onClick={() => window.location.reload()}
              className="text-xs text-blue-400 hover:text-blue-300"
            >
              Refresh to retry
            </button>
          </div>
        </div>
      }
    >
      {children}
    </ErrorBoundary>
  );
}
