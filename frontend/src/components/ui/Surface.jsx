/**
 * Surface — the Soft Depth panel primitive.
 *
 * Depth comes from soft shadow + subtle elevation, not heavy borders.
 * Optional brand-tinted ambient glow sits behind focal surfaces as light.
 * Use instead of ad-hoc `bg-white dark:bg-slate-800 rounded-2xl shadow-card`.
 *
 * Props:
 *   as        — element/component (default 'div')
 *   elevation — 'flat' | 'sm' | 'md' | 'lg'  (default 'sm')
 *   glow      — false | 'brand' | 'accent'   ambient radial light
 *   interactive — adds hover-lift + pointer affordance
 *   padded    — apply default padding (default true)
 */
import { forwardRef } from 'react';

const elevations = {
  flat: 'shadow-none border border-edge-subtle',
  sm: 'shadow-card',
  md: 'shadow-card-md',
  lg: 'shadow-card-lg',
};

const glows = {
  brand: 'bg-glow-brand',
  accent: 'bg-glow-soft',
};

const Surface = forwardRef(
  (
    {
      as: Tag = 'div',
      elevation = 'sm',
      glow = false,
      interactive = false,
      padded = true,
      className = '',
      children,
      ...props
    },
    ref
  ) => {
    const hasGlow = glow && glows[glow];
    return (
      <Tag
        ref={ref}
        className={[
          'relative isolate overflow-hidden rounded-2xl bg-surface-card',
          elevations[elevation] || elevations.sm,
          padded ? 'p-5 sm:p-6' : '',
          interactive
            ? 'hover-lift hover:shadow-card-lg cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-page'
            : '',
          className,
        ]
          .filter(Boolean)
          .join(' ')}
        {...props}
      >
        {hasGlow && (
          <span
            aria-hidden="true"
            className={`pointer-events-none absolute inset-0 -z-10 ${glows[glow]}`}
          />
        )}
        {children}
      </Tag>
    );
  }
);

Surface.displayName = 'Surface';

export default Surface;
