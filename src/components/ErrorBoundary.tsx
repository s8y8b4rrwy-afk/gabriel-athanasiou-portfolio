
import React, { Component, ErrorInfo, ReactNode } from 'react';
import { THEME } from '../theme';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className={`min-h-screen bg-bg-main flex items-center justify-center p-8 text-center`}>
            <div>
                <h1 className={`${THEME.typography.h2} text-white mb-4`}>Something went wrong</h1>
                <p className={`${THEME.typography.body} text-text-muted mb-8 max-w-md mx-auto`}>
                    The application encountered an unexpected error. Please try refreshing the page.
                </p>
                <button 
                    onClick={() => window.location.reload()}
                    className={`px-6 py-2 border border-white/30 rounded-full text-white hover:bg-white hover:text-black transition uppercase text-xs tracking-widest`}
                >
                    Reload
                </button>
            </div>
        </div>
      );
    }

    return ((this as any).props as Props).children;
  }
}
