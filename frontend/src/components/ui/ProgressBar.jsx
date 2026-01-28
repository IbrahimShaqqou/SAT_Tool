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
    default: 'bg-gray-600 dark:bg-gray-400',
    success: 'bg-emerald-500 dark:bg-emerald-400',
    warning: 'bg-amber-500 dark:bg-amber-400',
    danger: 'bg-rose-500 dark:bg-rose-400',
    info: 'bg-blue-500 dark:bg-blue-400',
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
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Progress</span>
          <span className="text-sm text-gray-500 dark:text-gray-400">{Math.round(percentage)}%</span>
        </div>
      )}
      <div className={`w-full bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden ${heights[size]}`}>
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
