/**
 * AnimatedNumber — counts up to `value` when scrolled into view, easing out.
 * Snaps instantly under reduced motion. Uses tabular figures so the width
 * doesn't jitter while counting.
 */
import { useCountUp, useInView } from '../../hooks/useMotion';

const AnimatedNumber = ({
  value,
  decimals = 0,
  duration = 1100,
  prefix = '',
  suffix = '',
  className = '',
  ...props
}) => {
  const [ref, inView] = useInView();
  const display = useCountUp(value, { duration, decimals, start: inView });
  const formatted = Number(display).toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

  return (
    <span ref={ref} className={`tabular-nums ${className}`} {...props}>
      {prefix}
      {formatted}
      {suffix}
    </span>
  );
};

export default AnimatedNumber;
