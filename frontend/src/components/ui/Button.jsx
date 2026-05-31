/**
 * Button — Soft Depth.
 * Variants: primary, secondary, ghost, danger, accent
 * Sizes: sm, md, lg
 * Full state matrix: default / hover / focus-visible / active / disabled / loading.
 * Token-driven, theme-aware, accessible.
 */
import { forwardRef } from 'react';

const variants = {
  primary:
    'bg-brand-600 text-white shadow-card hover:bg-brand-700 hover:shadow-card-md active:bg-brand-800 active:shadow-card focus-visible:ring-brand-500',
  secondary:
    'bg-surface-card text-ink-body border border-edge hover:bg-surface-muted hover:border-edge-strong active:bg-surface-muted focus-visible:ring-brand-500',
  ghost:
    'text-ink-muted hover:bg-surface-muted hover:text-ink-body active:bg-surface-muted focus-visible:ring-brand-500',
  danger:
    'bg-rose-600 text-white shadow-card hover:bg-rose-700 active:bg-rose-800 focus-visible:ring-rose-500',
  accent:
    'bg-accent-500 text-white shadow-card hover:bg-accent-600 active:bg-accent-700 focus-visible:ring-accent-400',
};

const sizes = {
  sm: 'px-3.5 py-2 text-xs gap-1.5 min-h-[36px]',
  md: 'px-4 py-2.5 text-sm gap-2 min-h-[44px]',
  lg: 'px-6 py-3 text-base gap-2 min-h-[52px]',
};

const Button = forwardRef(
  (
    {
      children,
      variant = 'primary',
      size = 'md',
      disabled = false,
      loading = false,
      className = '',
      type = 'button',
      ...props
    },
    ref
  ) => {
    const base =
      'relative inline-flex items-center justify-center font-semibold rounded-xl select-none ' +
      'transition-[background-color,box-shadow,transform,border-color] duration-200 ease-out-quart ' +
      'focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-page ' +
      'active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 disabled:shadow-none';

    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}
        {...props}
      >
        {loading && (
          <svg
            className="animate-spin -ml-0.5 h-4 w-4"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        )}
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';

export default Button;
