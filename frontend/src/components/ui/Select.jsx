/**
 * Select dropdown component
 * Supports dark mode
 */
import { forwardRef } from 'react';
import { ChevronDown } from 'lucide-react';

const Select = forwardRef(({
  label,
  error,
  hint,
  options = [],
  placeholder = 'Select an option',
  className = '',
  id,
  required = false,
  ...props
}, ref) => {
  const selectId = id || `select-${label?.toLowerCase().replace(/\s+/g, '-')}`;

  return (
    <div className={className}>
      {label && (
        <label
          htmlFor={selectId}
          className="block text-sm font-medium text-ink-muted mb-1"
        >
          {label}
          {required && <span className="text-rose-500 ml-1">*</span>}
        </label>
      )}
      <div className="relative">
        <select
          ref={ref}
          id={selectId}
          className={`
            block w-full px-3 py-2 pr-10
            border rounded-lg
            text-ink-body bg-surface-card
            appearance-none
            focus:outline-none focus:ring-2 focus:ring-offset-0
            transition-colors
            ${error
              ? 'border-rose-300 dark:border-rose-500 focus:border-rose-500 focus:ring-rose-500'
              : 'border-edge focus:border-brand-500 focus:ring-brand-500'
            }
          `}
          aria-invalid={error ? 'true' : 'false'}
          {...props}
        >
          <option value="" disabled>
            {placeholder}
          </option>
          {options.map((option) => (
            <option
              key={option.value}
              value={option.value}
              disabled={option.disabled}
            >
              {option.label}
            </option>
          ))}
        </select>
        <ChevronDown
          className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-faint pointer-events-none"
        />
      </div>
      {hint && !error && (
        <p className="mt-1 text-sm text-ink-subtle">{hint}</p>
      )}
      {error && (
        <p className="mt-1 text-sm text-rose-600 dark:text-rose-400">{error}</p>
      )}
    </div>
  );
});

Select.displayName = 'Select';

export default Select;
