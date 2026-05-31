/**
 * Sparkline — a compact trend line that draws itself in when scrolled into
 * view, with a soft area fill and an end dot. Pure SVG, no chart dependency.
 * Decorative by default (aria-hidden); pass `label` to expose it.
 */
import { useId } from 'react';
import { useInView, useReducedMotion } from '../../hooks/useMotion';

const Sparkline = ({
  data = [],            // array of numbers
  width = 160,
  height = 44,
  strokeClass = 'text-brand-500',
  fillFrom = 'rgb(212 147 62 / 0.24)',
  fillTo = 'rgb(212 147 62 / 0)',
  label,
  className = '',
}) => {
  const gradId = useId();
  const reduced = useReducedMotion();
  const [ref, inView] = useInView();

  if (!data || data.length < 2) {
    return <div ref={ref} className={className} style={{ width, height }} aria-hidden="true" />;
  }

  const min = Math.min(...data);
  const max = Math.max(...data);
  const span = max - min || 1;
  const pad = 4;
  const stepX = (width - pad * 2) / (data.length - 1);
  const toY = (v) => pad + (1 - (v - min) / span) * (height - pad * 2);

  const points = data.map((v, i) => [pad + i * stepX, toY(v)]);
  const linePath = points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const areaPath = `${linePath} L${points[points.length - 1][0].toFixed(1)},${height - pad} L${pad},${height - pad} Z`;
  const [lastX, lastY] = points[points.length - 1];

  const drawn = reduced || inView;

  return (
    <svg
      ref={ref}
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={className}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : 'true'}
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={fillFrom} />
          <stop offset="100%" stopColor={fillTo} />
        </linearGradient>
      </defs>
      <path
        d={areaPath}
        fill={`url(#${gradId})`}
        style={{ opacity: drawn ? 1 : 0, transition: reduced ? 'none' : 'opacity 0.8s ease 0.3s' }}
      />
      <path
        d={linePath}
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={strokeClass}
        pathLength="1"
        style={{
          strokeDasharray: 1,
          strokeDashoffset: drawn ? 0 : 1,
          transition: reduced ? 'none' : 'stroke-dashoffset 1.1s cubic-bezier(0.16,1,0.3,1)',
        }}
      />
      <circle
        cx={lastX}
        cy={lastY}
        r="3"
        className={strokeClass}
        fill="currentColor"
        style={{ opacity: drawn ? 1 : 0, transition: reduced ? 'none' : 'opacity 0.3s ease 1s' }}
      />
    </svg>
  );
};

export default Sparkline;
