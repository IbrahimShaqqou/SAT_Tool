/**
 * Badge component for status indicators
 * Supports dark mode
 */

const variants = {
  default: 'bg-slate-100 text-slate-600 dark:bg-slate-700/60 dark:text-slate-300',
  success: 'bg-accent-50 text-accent-700 dark:bg-accent-900/25 dark:text-accent-300',
  warning: 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-200',
  danger:  'bg-rose-50 text-rose-600 dark:bg-rose-900/25 dark:text-rose-300',
  info:    'bg-brand-50 text-brand-700 dark:bg-brand-900/25 dark:text-brand-300',
};

const sizes = {
  sm: 'px-2 py-0.5 text-xs',
  md: 'px-2.5 py-1 text-xs',
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
        inline-flex items-center font-semibold rounded-full
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
