/**
 * Input component with label and error states
 * Supports dark mode
 */
import { forwardRef } from 'react';

const Input = forwardRef(({
  label,
  error,
  hint,
  type = 'text',
  className = '',
  id,
  required = false,
  ...props
}, ref) => {
  const inputId = id || `input-${label?.toLowerCase().replace(/\s+/g, '-')}`;

  return (
    <div className={className}>
      {label && (
        <label
          htmlFor={inputId}
          className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5"
        >
          {label}
          {required && <span className="text-rose-500 ml-1">*</span>}
        </label>
      )}
      <input
        ref={ref}
        id={inputId}
        type={type}
        className={`
          block w-full px-3.5 py-2.5
          border rounded-xl text-sm
          text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500
          bg-white dark:bg-slate-800
          focus:outline-none focus:ring-2 focus:ring-offset-0
          transition-colors
          ${error
            ? 'border-rose-300 dark:border-rose-500 focus:border-rose-500 focus:ring-rose-400/40'
            : 'border-slate-200 dark:border-slate-600 focus:border-brand-400 focus:ring-brand-400/30 dark:focus:border-brand-500 dark:focus:ring-brand-500/30'
          }
        `}
        aria-invalid={error ? 'true' : 'false'}
        aria-describedby={error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined}
        {...props}
      />
      {hint && !error && (
        <p id={`${inputId}-hint`} className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${inputId}-error`} className="mt-1.5 text-xs text-rose-600 dark:text-rose-400">
          {error}
        </p>
      )}
    </div>
  );
});

Input.displayName = 'Input';

export default Input;
