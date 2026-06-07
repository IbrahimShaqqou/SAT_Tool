/**
 * MathHtml — render trusted question/explanation HTML (incl. MathML) and run
 * MathJax over it. Used in the practice-test review where prompts and rationales
 * contain <math> markup from the College Board content.
 */
import { useEffect, useRef } from 'react';

const MathHtml = ({ html, className = '' }) => {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (el && window.MathJax?.typesetPromise) {
      window.MathJax.typesetClear?.([el]);
      window.MathJax.typesetPromise([el]).catch((err) => {
        console.warn('MathJax typeset error:', err);
      });
    }
  }, [html]);

  if (!html) return null;
  return (
    <div
      ref={ref}
      className={className}
      // Content is first-party College Board question HTML stored in our DB.
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
};

export default MathHtml;
