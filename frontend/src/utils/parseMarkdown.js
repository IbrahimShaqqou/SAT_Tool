/**
 * parseMarkdown — shared utility
 * Extracted from LessonViewerPage.jsx
 *
 * Parses simple markdown to HTML.
 * Supports: **bold**, *italic*, $math$, $$display math$$
 * Handles dollar amounts by requiring math to have letters/operators.
 */

import 'katex/dist/katex.min.css';
import katex from 'katex';

const parseMarkdown = (text) => {
  if (!text) return '';

  const placeholders = [];   // rendered HTML
  const mathSources = [];    // original math text (for inline math only)
  let html = text;

  // Helper to create a placeholder
  const addPlaceholder = (rendered, prefix, source) => {
    const placeholder = `__${prefix}_${placeholders.length}__`;
    placeholders.push(rendered);
    mathSources.push(source || '');
    return placeholder;
  };

  // 1. Bold **text** FIRST — prevents **$5** from being matched as math
  html = html.replace(/\*\*([^*]+)\*\*/g, (match) => {
    return addPlaceholder(match, 'BOLD');
  });

  // 2. Display math $$...$$ (before HTML escaping to preserve & in \begin{aligned})
  html = html.replace(/\$\$([^$]+)\$\$/g, (match, math) => {
    try {
      const rendered = katex.renderToString(math.trim(), { displayMode: true, throwOnError: false });
      return addPlaceholder(rendered, 'DMATH');
    } catch (e) {
      return match;
    }
  });

  // 3. Inline math $...$ — must contain letters/operators, OR be a pure number
  html = html.replace(/\$([^$]+)\$/g, (match, math) => {
    const looksLikeMath = /[a-zA-Z=+\-*/\\^_{}]/.test(math)
      || /^-?\d+(\.\d+)?$/.test(math.trim()); // pure number like $32$ or $273.15$
    if (!looksLikeMath) {
      return match; // Keep as-is (probably a dollar amount like $5 per unit)
    }
    try {
      const rendered = katex.renderToString(math.trim(), { displayMode: false, throwOnError: false });
      return addPlaceholder(rendered, 'IMATH', math);
    } catch (e) {
      return match;
    }
  });

  // 4. Convert " and " between two inline math expressions into a stacked system
  //    Only stack when BOTH expressions are actual equations (contain "=")
  html = html.replace(/__IMATH_(\d+)__\s+and\s+__IMATH_(\d+)__/g, (_match, idx1, idx2) => {
    const i1 = parseInt(idx1);
    const i2 = parseInt(idx2);
    const src1 = mathSources[i1] || '';
    const src2 = mathSources[i2] || '';
    if (src1.includes('=') && src2.includes('=')) {
      const eq1 = placeholders[i1] || '';
      const eq2 = placeholders[i2] || '';
      const stacked = `<div class="system-of-equations">${eq1}${eq2}</div>`;
      return addPlaceholder(stacked, 'SYSTEM');
    }
    return _match;
  });

  // 5. Escape HTML (math and bold are already replaced with placeholders)
  html = html.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  // 6. Italic *text* (but not placeholder markers which use __)
  html = html.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '<em>$1</em>');

  // 7. Line breaks
  html = html.replace(/\n\n/g, '</p><p>');
  html = html.replace(/\n/g, '<br/>');

  // 8. Remove <br/> between consecutive display math blocks
  html = html.replace(/__DMATH_(\d+)__(<br\/>)+__DMATH_/g, (_match, idx) => {
    return `__DMATH_${idx}____DMATH_`;
  });

  // 9. Restore ALL placeholders
  html = html.replace(/__BOLD_(\d+)__/g, (match, index) => {
    const original = placeholders[parseInt(index)] || match;
    const boldMatch = original.match(/\*\*([^*]+)\*\*/);
    if (boldMatch) {
      const inner = boldMatch[1]
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      return `<strong>${inner}</strong>`;
    }
    return match;
  });
  html = html.replace(/__(DMATH|IMATH|SYSTEM)_(\d+)__/g, (m, _type, index) => {
    return placeholders[parseInt(index)] || m;
  });

  // 10. Wrap in paragraph if not already
  if (!html.startsWith('<') && !html.startsWith(' ')) {
    html = `<p>${html}</p>`;
  }

  return html;
};

export default parseMarkdown;
