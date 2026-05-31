/**
 * Reveal — wraps children in a scroll-triggered fade-up. Content is visible by
 * default (CSS gates the hidden state behind `.js`), so it never ships blank,
 * and it collapses to instant under reduced motion.
 *
 *   <Reveal>…</Reveal>              single element fade-up
 *   <Reveal stagger>…children…</Reveal>  staggered children
 */
import useScrollReveal from '../../hooks/useScrollReveal';

const Reveal = ({ children, stagger = false, className = '', as: Tag = 'div', ...props }) => {
  const ref = useScrollReveal();
  return (
    <Tag
      ref={ref}
      className={`${stagger ? 'reveal-stagger' : 'reveal'} ${className}`}
      {...props}
    >
      {children}
    </Tag>
  );
};

export default Reveal;
