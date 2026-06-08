/**
 * CookieNotice — a small, inconspicuous acknowledgement that ZooPrep uses only
 * essential first-party storage. Not a consent gate (we set no tracking/ad
 * cookies), so it's a single "Got it" dismissal remembered in localStorage.
 *
 * Renders fixed to the bottom corner, never blocks interaction, and disappears
 * once acknowledged.
 */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

const STORAGE_KEY = 'cookie_ack_v1';

const CookieNotice = () => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(STORAGE_KEY) !== '1') setVisible(true);
    } catch {
      /* storage blocked — just don't show it */
    }
  }, []);

  const dismiss = () => {
    try { localStorage.setItem(STORAGE_KEY, '1'); } catch { /* ignore */ }
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      role="region"
      aria-label="Cookie notice"
      className="fixed bottom-3 left-3 right-3 z-[60] mx-auto max-w-md rounded-xl border border-edge bg-surface-card/95 px-4 py-3 shadow-card-md backdrop-blur sm:left-4 sm:right-auto"
    >
      <div className="flex items-start gap-3">
        <p className="flex-1 text-xs leading-relaxed text-ink-muted">
          ZooPrep uses only essential storage to keep you signed in and remember
          your preferences — no ad or tracking cookies.{' '}
          <Link to="/cookies" className="font-medium text-brand-700 underline dark:text-brand-300">
            Learn more
          </Link>
        </p>
        <button
          onClick={dismiss}
          className="shrink-0 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-brand-700"
        >
          Got it
        </button>
      </div>
    </div>
  );
};

export default CookieNotice;
