/**
 * Badge component for status indicators
 * Supports dark mode
 */

// Using softer, more muted colors for better visual comfort
const variants = {
  default: 'bg-gray-100 text-gray-600 dark:bg-gray-700/60 dark:text-gray-300',
  success: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/25 dark:text-emerald-300',
  warning: 'bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-200',
  danger: 'bg-rose-50 text-rose-600 dark:bg-rose-900/25 dark:text-rose-300',
  info: 'bg-sky-50 text-sky-600 dark:bg-sky-900/25 dark:text-sky-300',
};

const sizes = {
  sm: 'px-2 py-0.5 text-xs',
  md: 'px-2.5 py-1 text-sm',
};

const Badge = ({
  children,
  variant = 'default',
  size = 'md',
  className = '',
}) => {
  return (
    <span
      className={`
        inline-flex items-center font-medium rounded-full
        ${variants[variant]}
        ${sizes[size]}
        ${className}
      `}
    >
      {children}
    </span>
  );
};

export default Badge;
