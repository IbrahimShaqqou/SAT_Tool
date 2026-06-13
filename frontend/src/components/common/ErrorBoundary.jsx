/**
 * ErrorBoundary — catches render-time errors anywhere below it so a single
 * component crash shows a recoverable fallback instead of a blank white screen.
 *
 * Reports to Sentry when it's been initialized (see src/sentry.js); otherwise
 * it just logs. Designed to wrap the whole app at the root.
 */
import { Component } from 'react';
import { Sentry } from '../../sentry';

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    // Always log. Sentry.captureException is a safe no-op until a DSN is set.
    // eslint-disable-next-line no-console
    console.error('Unhandled UI error:', error, info?.componentStack);
    try {
      Sentry.captureException(error, { extra: { componentStack: info?.componentStack } });
    } catch {
      /* never let reporting throw */
    }
  }

  handleReload = () => {
    // Full reload clears the broken render tree and refetches fresh state.
    window.location.assign('/');
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-page px-5">
        <div className="w-full max-w-md rounded-2xl border border-edge bg-surface-card p-8 text-center shadow-card-md">
          <div className="mx-auto mb-5 flex h-11 w-11 items-center justify-center rounded-xl bg-brand-600">
            <span className="font-display text-lg font-bold text-white">Z</span>
          </div>
          <h1 className="font-display text-2xl font-semibold text-ink-body">
            Something went wrong
          </h1>
          <p className="mt-2 text-sm text-ink-muted">
            The page hit an unexpected error. Reloading usually fixes it. If it keeps
            happening, let your tutor know.
          </p>
          <button
            type="button"
            onClick={this.handleReload}
            className="mt-6 inline-flex items-center justify-center rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-700"
          >
            Reload ZooPrep
          </button>
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
