/**
 * parseMarkdown — shared utility
 * Extracted from LessonViewerPage.jsx
 *
 * Parses simple markdown to HTML.
 * Supports: **bold**, *italic*, $math$, $$display math$$, markdown tables,
 *           bullet lists (- item), numbered lists (1. item)
 * Handles dollar amounts by requiring math to have letters/operators.
 */

import 'katex/dist/katex.min.css';
import katex from 'katex';

/** Render any inline $...$ math found inside a table cell string. */
const renderCellMath = (cell) => {
  // Display math $$...$$
  cell = cell.replace(/\$\$([^$]+)\$\$/g, (match, math) => {
    try { return katex.renderToString(math.trim(), { displayMode: true, throwOnError: false }); }
    catch (e) { return match; }
  });
  // Inline math $...$
  cell = cell.replace(/\$([^$\n]+)\$/g, (match, math) => {
    const looksLikeMath = /[a-zA-Z=+\-*/\\^_{}]/.test(math) || /^-?\d+(\.\d+)?$/.test(math.trim());
    if (!looksLikeMath) return match;
    try { return katex.renderToString(math.trim(), { displayMode: false, throwOnError: false }); }
    catch (e) { return match; }
  });
  // Bold **text**
  cell = cell.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  return cell;
};

/** Parse a markdown table string into an HTML table. */
const parseTable = (tableText) => {
  const lines = tableText.trim().split('\n').filter(l => l.trim());
  if (lines.length < 2) return tableText;

  const parseRow = (line) =>
    line.split('|').slice(1, -1).map(cell => cell.trim());

  const isSeparator = (line) => /^[\s|:-]+$/.test(line);
  if (!isSeparator(lines[1])) return tableText; // not a real table

  const headers = parseRow(lines[0]);
  const bodyRows = lines.slice(2);

  const thCells = headers
    .map(h => `<th class="px-4 py-2 text-left font-semibold text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600">${renderCellMath(h)}</th>`)
    .join('');

  const trRows = bodyRows.map(row => {
    const cells = parseRow(row);
    const tds = cells
      .map(c => `<td class="px-4 py-2 text-gray-800 dark:text-gray-200 border border-gray-300 dark:border-gray-600">${renderCellMath(c)}</td>`)
      .join('');
    return `<tr class="even:bg-gray-50 dark:even:bg-gray-800/50">${tds}</tr>`;
  }).join('');

  return `<div class="overflow-x-auto my-4"><table class="border-collapse w-full text-sm rounded-lg overflow-hidden"><thead><tr>${thCells}</tr></thead><tbody>${trRows}</tbody></table></div>`;
};

/** Parse bullet and numbered lists. */
const parseLists = (text) => {
  // Numbered list: lines starting with `1.`, `2.`, etc.
  text = text.replace(/((?:^\d+\.\s.+\n?)+)/gm, (block) => {
    const items = block.trim().split('\n').map(l => {
      const content = l.replace(/^\d+\.\s*/, '').trim();
      return `<li class="ml-4 list-decimal">${content}</li>`;
    }).join('');
    return `<ol class="list-decimal list-inside space-y-1 my-2">${items}</ol>`;
  });

  // Bullet list: lines starting with `- `
  text = text.replace(/((?:^- .+\n?)+)/gm, (block) => {
    const items = block.trim().split('\n').map(l => {
      const content = l.replace(/^- /, '').trim();
      return `<li class="ml-4">${content}</li>`;
    }).join('');
    return `<ul class="list-disc list-inside space-y-1 my-2">${items}</ul>`;
  });

  return text;
};

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

  // 0. Extract markdown tables BEFORE other processing
  //    Tables are blocks where every line starts with |
  //    renderCellMath() handles LaTeX inside individual cells
  html = html.replace(/((?:^\|.+\|\n?)+)/gm, (block) => {
    const rendered = parseTable(block);
    return addPlaceholder(rendered, 'TABLE');
  });

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

  // 2b. Protect escaped dollar signs (\$ in source) so they pass through as literal $
  //     This lets JSON problem strings use \$ for currency amounts (e.g. \$40).
  //     Negative lookbehind (?<!\$) ensures we don't match \$ that's inside $...$
  //     math expressions (like $\$40$ which is valid LaTeX for "$40").
  html = html.replace(/(?<!\$)\\\$/g, () => addPlaceholder('$', 'DLRSGN'));

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

  // 5. Escape HTML (math, tables, and bold are already replaced with placeholders)
  html = html.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  // 6. Italic *text* (but not placeholder markers which use __)
  html = html.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '<em>$1</em>');

  // 7. Bullet and numbered lists (before line-break conversion)
  html = parseLists(html);

  // 8. Line breaks
  html = html.replace(/\n\n/g, '</p><p>');
  html = html.replace(/\n/g, '<br/>');

  // 9. Remove <br/> between consecutive display math blocks
  html = html.replace(/__DMATH_(\d+)__(<br\/>)+__DMATH_/g, (_match, idx) => {
    return `__DMATH_${idx}____DMATH_`;
  });

  // 10. Restore ALL placeholders
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
  html = html.replace(/__(DMATH|IMATH|SYSTEM|TABLE|DLRSGN)_(\d+)__/g, (m, _type, index) => {
    return placeholders[parseInt(index)] || m;
  });

  // 11. Wrap in paragraph if not already block-level
  if (!html.startsWith('<') && !html.startsWith(' ')) {
    html = `<p>${html}</p>`;
  }

  return html;
};

export default parseMarkdown;
