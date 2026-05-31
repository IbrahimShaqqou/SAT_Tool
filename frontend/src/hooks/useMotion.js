/**
 * Motion primitives — small, dependency-free hooks for the Soft Depth
 * motion layer. All of them respect prefers-reduced-motion.
 */
import { useEffect, useRef, useState } from 'react';

/** Tracks the user's reduced-motion preference reactively. */
export function useReducedMotion() {
  const [reduced, setReduced] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false
  );

  useEffect(() => {
    if (!window.matchMedia) return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = (e) => setReduced(e.matches);
    mq.addEventListener?.('change', onChange);
    return () => mq.removeEventListener?.('change', onChange);
  }, []);

  return reduced;
}

const easeOutExpo = (t) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t));

/**
 * Animates a number from 0 → `value` once, easing out. Returns the current
 * display value. Under reduced motion (or when not started) it snaps to the
 * final value. `start` lets the caller gate the animation on visibility.
 */
export function useCountUp(value, { duration = 1100, decimals = 0, start = true } = {}) {
  const reduced = useReducedMotion();
  const [display, setDisplay] = useState(reduced || !start ? value : 0);
  const rafRef = useRef(null);
  const startedRef = useRef(false);

  useEffect(() => {
    if (!start) return;
    const target = Number(value) || 0;

    if (reduced) {
      setDisplay(target);
      return;
    }

    // Animate from the current displayed value to the target.
    startedRef.current = true;
    const from = 0;
    const t0 = performance.now();
    const factor = Math.pow(10, decimals);

    const tick = (now) => {
      const elapsed = now - t0;
      const p = Math.min(1, elapsed / duration);
      const eased = easeOutExpo(p);
      const current = from + (target - from) * eased;
      setDisplay(Math.round(current * factor) / factor);
      if (p < 1) rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, start, reduced, duration, decimals]);

  return display;
}

/**
 * Returns [ref, inView]. `inView` flips true once the element enters the
 * viewport (once), or immediately under reduced motion. Useful for gating
 * count-ups / chart draw-ins on visibility.
 */
export function useInView({ threshold = 0.2, once = true } = {}) {
  const ref = useRef(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === 'undefined') {
      setInView(true);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          if (once) observer.unobserve(el);
        } else if (!once) {
          setInView(false);
        }
      },
      // Positive bottom margin so elements near the page bottom still trigger
      // their count-up / draw-in at max scroll.
      { threshold, rootMargin: '0px 0px 10% 0px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold, once]);

  return [ref, inView];
}
