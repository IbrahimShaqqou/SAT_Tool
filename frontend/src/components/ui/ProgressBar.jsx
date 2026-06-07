/**
 * Progress bar component
 * Supports dark mode with softer colors
 */

const ProgressBar = ({
  value = 0,
  max = 100,
  showLabel = false,
  size = 'md',
  variant = 'default',
  className = '',
}) => {
  const percentage = Math.min(Math.max((value / max) * 100, 0), 100);

  const heights = {
    sm: 'h-1',
    md: 'h-2',
    lg: 'h-3',
  };

  const colors = {
    default: 'bg-ink-muted',
    success: 'bg-accent-500 dark:bg-accent-400',
    warning: 'bg-amber-500 dark:bg-amber-400',
    danger: 'bg-rose-500 dark:bg-rose-400',
    info: 'bg-brand-500 dark:bg-brand-400',
  };

  // Auto-color based on percentage
  const getAutoColor = () => {
    if (percentage >= 80) return colors.success;
    if (percentage >= 60) return colors.info;
    if (percentage >= 40) return colors.warning;
    return colors.danger;
  };

  const barColor = variant === 'auto' ? getAutoColor() : colors[variant];

  return (
    <div className={className}>
      {showLabel && (
        <div className="flex justify-between mb-1">
          <span className="text-sm font-medium text-ink-muted">Progress</span>
          <span className="text-sm text-ink-subtle">{Math.round(percentage)}%</span>
        </div>
      )}
      <div className={`w-full bg-surface-muted rounded-full overflow-hidden ${heights[size]}`}>
        <div
          className={`${barColor} ${heights[size]} rounded-full transition-all duration-300`}
          style={{ width: `${percentage}%` }}
          role="progressbar"
          aria-valuenow={value}
          aria-valuemin={0}
          aria-valuemax={max}
        />
      </div>
    </div>
  );
};

export default ProgressBar;
