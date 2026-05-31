/**
 * useScrollReveal — attach the returned ref to an element; it gains the
 * `visible` class when it scrolls into view (one shared observer for all
 * consumers). Content is visible by default in CSS; this only drives the
 * enhancement, and is a no-op under reduced motion.
 */
import { useEffect, useRef } from 'react';

let sharedObserver = null;
const callbacks = new WeakMap();

function getObserver() {
  if (sharedObserver || typeof IntersectionObserver === 'undefined') return sharedObserver;
  sharedObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const cb = callbacks.get(entry.target);
          if (cb) cb();
          sharedObserver.unobserve(entry.target);
          callbacks.delete(entry.target);
        }
      });
    },
    // threshold 0 + a positive bottom margin: reveal as soon as any pixel
    // enters (slightly early). A negative bottom margin here would shrink the
    // trigger zone so elements pinned at the bottom at max-scroll never reach
    // the threshold and stay invisible — that was the "can't scroll to the
    // bottom" bug.
    { threshold: 0, rootMargin: '0px 0px 10% 0px' }
  );
  return sharedObserver;
}

const prefersReduced = () =>
  typeof window !== 'undefined' &&
  window.matchMedia &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const useScrollReveal = () => {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Reduced motion or no observer support: reveal immediately.
    const observer = getObserver();
    if (prefersReduced() || !observer) {
      el.classList.add('visible');
      return;
    }

    const reveal = () => el.classList.add('visible');
    callbacks.set(el, reveal);
    observer.observe(el);

    // Safety net: if the observer hasn't fired shortly after mount (already
    // in view on load, print, restored scroll position, or a renderer that
    // doesn't tick intersection), reveal anyway so content never stays hidden.
    const fallback = setTimeout(() => {
      if (!el.classList.contains('visible')) reveal();
    }, 600);

    return () => {
      clearTimeout(fallback);
      observer.unobserve(el);
      callbacks.delete(el);
    };
  }, []);

  return ref;
};

export default useScrollReveal;
