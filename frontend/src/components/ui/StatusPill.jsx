/**
 * StatusPill — one centralized accuracy/performance tone mapping so "good /
 * needs work / struggling" looks identical across every tutor and student
 * surface (the audit flagged divergent thresholds + hues per page). Color is
 * always paired with text, never the sole signal.
 *
 *   <StatusPill value={accuracy} />            // auto tone from 0–100
 *   <StatusPill tone="good">On track</StatusPill>
 */
const TONES = {
  good:   'bg-accent-50 text-accent-700 dark:bg-accent-900/30 dark:text-accent-300',
  warn:   'bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300',
  bad:    'bg-rose-50 text-rose-700 dark:bg-rose-900/25 dark:text-rose-300',
  neutral:'bg-surface-muted text-ink-muted',
};

// Canonical thresholds (percent). Used everywhere.
export const toneForAccuracy = (pct) => {
  if (pct == null) return 'neutral';
  if (pct >= 75) return 'good';
  if (pct >= 55) return 'warn';
  return 'bad';
};

const StatusPill = ({ value, tone, children, size = 'md', className = '' }) => {
  const resolved = tone || toneForAccuracy(value);
  const sizes = { sm: 'px-2 py-0.5 text-[11px]', md: 'px-2.5 py-1 text-xs' };
  const content = children != null ? children : (value != null ? `${Math.round(value)}%` : 'N/A');
  return (
    <span className={`inline-flex items-center gap-1 rounded-full font-semibold ${TONES[resolved]} ${sizes[size]} ${className}`}>
      {content}
    </span>
  );
};

export default StatusPill;
