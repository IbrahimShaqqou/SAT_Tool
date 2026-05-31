/**
 * StatBlock — a single big-number metric in the Study Hall voice: a large
 * Fraunces figure (count-up) over a small Inter label, with an optional delta
 * and trailing hint. Borderless by default; lives in rows separated by
 * whitespace, not boxes.
 */
import { TrendingUp, TrendingDown } from 'lucide-react';
import AnimatedNumber from './AnimatedNumber';

const StatBlock = ({
  value,
  label,
  prefix = '',
  suffix = '',
  decimals = 0,
  delta = null,          // number; sign drives color + arrow
  hint,
  size = 'md',           // 'sm' | 'md' | 'lg'
  animate = true,
  className = '',
}) => {
  const sizes = {
    sm: 'text-xl',
    md: 'text-2xl sm:text-3xl',
    lg: 'text-4xl sm:text-5xl',
  };
  return (
    <div className={className}>
      <div className="flex items-end gap-2">
        <span className={`font-display font-semibold tracking-tight text-ink-body ${sizes[size]}`}>
          {animate ? (
            <AnimatedNumber value={value} prefix={prefix} suffix={suffix} decimals={decimals} />
          ) : (
            <span className="tabular-nums">{prefix}{value}{suffix}</span>
          )}
        </span>
        {delta != null && delta !== 0 && (
          <span className={`mb-1 inline-flex items-center gap-0.5 text-xs font-semibold ${delta > 0 ? 'text-accent-700 dark:text-accent-400' : 'text-rose-600 dark:text-rose-400'}`}>
            {delta > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {delta > 0 ? '+' : ''}{delta}
          </span>
        )}
      </div>
      <p className="mt-0.5 text-xs text-ink-subtle">{label}</p>
      {hint && <p className="text-[11px] text-ink-faint">{hint}</p>}
    </div>
  );
};

export default StatBlock;
