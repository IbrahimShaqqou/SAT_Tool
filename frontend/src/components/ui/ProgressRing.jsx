/**
 * ProgressRing — circular progress that draws in when scrolled into view.
 * Accessible (role=img with a descriptive label). Stroke uses brand by default.
 */
import { useInView, useReducedMotion } from '../../hooks/useMotion';

const ProgressRing = ({
  value = 0,            // 0–100
  size = 92,
  stroke = 8,
  trackClass = 'text-edge',
  progressClass = 'text-brand-500',
  label,                // accessible label; falls back to "{value}% complete"
  children,             // centered content (e.g. the number)
  className = '',
}) => {
  const reduced = useReducedMotion();
  const [ref, inView] = useInView();
  const pct = Math.max(0, Math.min(100, value));
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const shown = reduced ? pct : inView ? pct : 0;
  const offset = circ - (shown / 100) * circ;

  return (
    <div
      ref={ref}
      className={`relative inline-flex items-center justify-center ${className}`}
      role="img"
      aria-label={label || `${Math.round(pct)} percent`}
    >
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          className={trackClass}
          stroke="currentColor"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          className={progressClass}
          stroke="currentColor"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          style={{
            transition: reduced ? 'none' : 'stroke-dashoffset 1.1s cubic-bezier(0.16,1,0.3,1)',
          }}
        />
      </svg>
      {children != null && (
        <div className="absolute inset-0 flex items-center justify-center">{children}</div>
      )}
    </div>
  );
};

export default ProgressRing;
