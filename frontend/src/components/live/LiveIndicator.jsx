import React from 'react';

/**
 * Calm, non-anxiety banner shown to the student when a tutor is watching.
 * Color is paired with text + icon (never color alone). Study Hall tokens.
 */
export default function LiveIndicator({ present, tutorName }) {
  if (!present) return null;
  return (
    <div
      role="status"
      className="flex items-center gap-2 rounded-lg border border-edge bg-brand-50 px-3 py-2 text-sm text-ink-body"
    >
      <span className="inline-block h-2 w-2 rounded-full bg-brand-500" aria-hidden="true" />
      <span>{tutorName ? `${tutorName} is here with you` : 'Your tutor is here with you'}</span>
    </div>
  );
}
