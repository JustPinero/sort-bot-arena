import { Component, type ErrorInfo, type ReactNode } from 'react';

import { HazardStripes } from '@/components/design-system/HazardStripes';
import { Button } from '@/components/ui/button';
import { captureBoundaryError } from '@/lib/sentry';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: (reset: () => void, error: Error) => ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    if (import.meta.env.DEV) {
      console.error('ErrorBoundary caught', error, info.componentStack);
    }
    captureBoundaryError(error, { componentStack: info.componentStack });
  }

  reset = (): void => {
    this.setState({ error: null });
  };

  render(): ReactNode {
    if (!this.state.error) return this.props.children;
    if (this.props.fallback) return this.props.fallback(this.reset, this.state.error);

    return (
      <section
        className="mx-auto max-w-2xl px-4 py-16 text-center"
        role="alert"
        aria-live="assertive"
      >
        <HazardStripes thickness="thick" />
        <h1 className="mt-6 font-display text-3xl uppercase tracking-wide">
          Something broke ringside
        </h1>
        <p className="mt-3 text-muted-foreground">
          The arena hit an unexpected error. Try again, or head back to the homepage.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <Button variant="combat" onClick={this.reset}>
            Try again
          </Button>
          <Button variant="default" asChild>
            <a href="/">Home</a>
          </Button>
        </div>
      </section>
    );
  }
}
