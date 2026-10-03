import { Component, type ErrorInfo, type ReactNode } from 'react';
import { reportError } from '@/lib/monitoring';

/** Instead of a blank page when something breaks: a way back, and a report to us. */
export default class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    reportError(error, `react${info.componentStack?.split('\n').slice(0, 4).join(' ') ?? ''}`);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-background p-6 text-center">
        <div className="max-w-sm">
          <h1 className="text-xl font-bold text-foreground">Något gick fel</h1>
          <p className="mt-2 text-sm text-muted-foreground">Sidan kunde inte visas. Vi har fått en felrapport. Ladda om, så brukar det fungera igen.</p>
          <div className="mt-5 flex justify-center gap-2">
            <button type="button" onClick={() => window.location.reload()} className="h-10 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground">
              Ladda om
            </button>
            <a href="/" className="flex h-10 items-center rounded-lg border border-border px-4 text-sm text-foreground">Till startsidan</a>
          </div>
        </div>
      </div>
    );
  }
}
