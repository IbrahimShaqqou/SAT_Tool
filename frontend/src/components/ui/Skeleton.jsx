/**
 * Skeleton — shimmer loading placeholder. Use instead of a center spinner so
 * the layout doesn't shift when content arrives (calm, low-anxiety loading).
 */
const Skeleton = ({ className = '', rounded = 'rounded-lg' }) => (
  <span
    aria-hidden="true"
    className={`relative block overflow-hidden bg-surface-muted ${rounded} ${className}`}
  >
    <span className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-black/[0.04] to-transparent dark:via-white/[0.06]" />
  </span>
);

export default Skeleton;
