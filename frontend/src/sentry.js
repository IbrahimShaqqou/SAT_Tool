/**
 * Frontend error monitoring (Sentry).
 *
 * Activates ONLY when REACT_APP_SENTRY_DSN is set at build time. With no DSN
 * this is a no-op, so local/dev builds report nothing. Set the DSN in the
 * frontend build env (Vercel dashboard) to turn it on.
 */
import * as Sentry from '@sentry/react';

export function initSentry() {
  const dsn = process.env.REACT_APP_SENTRY_DSN;
  if (!dsn) return;

  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV || 'production',
    // Conservative default; raise if you want performance traces.
    tracesSampleRate: 0.1,
  });
}

// Re-export so the ErrorBoundary can report without its own import path logic.
export { Sentry };
