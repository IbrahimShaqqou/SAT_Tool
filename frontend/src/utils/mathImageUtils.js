/**
 * mathImageUtils.js
 *
 * Converts College Board base64 PNG math images to MathJax-rendered LaTeX.
 * CB embeds math as <img class="math-img" alt="..."> where alt is accessibility text
 * describing the math in natural language (e.g. "the fraction 3 over 4").
 *
 * Call preprocessMathHTML(html) before setting dangerouslySetInnerHTML.
 * MathJax will then process the injected \(...\) / \[...\] delimiters.
 */

// ---------------------------------------------------------------------------
// 1. ALT TEXT → LaTeX
// ---------------------------------------------------------------------------

/**
 * Convert a single CB alt-text math description to a LaTeX string.
 * Handles: fractions, decimals, powers, roots, function notation, ordered pairs,
 * Greek letters, basic operators, inequalities, absolute value, etc.
 */
export const altTextToLatex = (raw) => {
  if (!raw || !raw.trim()) return '';

  let s = raw.trim();

  // ── strip CB pause-commas ────────────────────────────────────────────────
  // CB alt text uses punctuation commas as screen-reader pauses between tokens:
  //   "2 times, left parenthesis, x minus 5, right parenthesis, plus 3..."
  // Semantic commas (coordinates, etc.) are always written as the word "comma".
  // So we can safely strip ALL punctuation commas before any other processing.
  s = s.replace(/,/g, ' ');

  // ── multi-equation blocks (handled at call site, but guard here) ─────────
  s = s.replace(/^open brace\s*/i, '');

  // ── word-form numerals (used in ordinal fractions like "two thirds") ──────
  const WORD_NUMS = {
    one: 1, two: 2, three: 3, four: 4, five: 5,
    six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
    eleven: 11, twelve: 12,
  };

  // ── ordinal denominator words ─────────────────────────────────────────────
  // "4 thirds" → \frac{4}{3},  "two thirds" → \frac{2}{3}, etc.
  const ORDINALS = {
    half: 2, halves: 2,
    third: 3, thirds: 3,
    fourth: 4, fourths: 4, quarter: 4, quarters: 4,
    fifth: 5, fifths: 5,
    sixth: 6, sixths: 6,
    seventh: 7, sevenths: 7,
    eighth: 8, eighths: 8,
    ninth: 9, ninths: 9,
    tenth: 10, tenths: 10,
    eleventh: 11, elevenths: 11,
    twelfth: 12, twelfths: 12,
    hundredth: 100, hundredths: 100,
  };
  const ORDINAL_PATTERN = 'half|halves|thirds?|fourths?|quarters?|fifths?|sixths?|sevenths?|eighths?|ninths?|tenths?|elevenths?|twelfths?|hundredths?';
  // Digit numerator: "4 thirds"
  s = s.replace(new RegExp(`(-?\\d+)\\s+(${ORDINAL_PATTERN})`, 'gi'),
    (_, n, ord) => {
      const d = ORDINALS[ord.toLowerCase()];
      return d ? `\\frac{${n}}{${d}}` : `${n} ${ord}`;
    }
  );
  // Word numerator: "two thirds"
  s = s.replace(new RegExp(`(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\\s+(${ORDINAL_PATTERN})`, 'gi'),
    (_, num, ord) => {
      const n = WORD_NUMS[num.toLowerCase()];
      const d = ORDINALS[ord.toLowerCase()];
      return (n && d) ? `\\frac{${n}}{${d}}` : `${num} ${ord}`;
    }
  );

  // ── "the fraction X over Y" / "X over Y" ─────────────────────────────────
  // Greedy inner-expression version (handles nested parens in numerator/denominator)
  s = s.replace(/\bthe fraction\s+(.+?)\s+over\s+(.+?)(?=\s*(?:,|$|\band\b|\bplus\b|\bminus\b|\btimes\b|\bequals\b|\bis\b))/gi,
    (_, num, den) => `\\frac{${altTextToLatex(num)}}{${altTextToLatex(den)}}`
  );
  // Simpler "X over Y" (single tokens)
  s = s.replace(/\b([\w.]+)\s+over\s+([\w.]+)\b/gi,
    (_, num, den) => `\\frac{${altTextToLatex(num)}}{${altTextToLatex(den)}}`
  );

  // ── "N point M" → decimal ─────────────────────────────────────────────────
  s = s.replace(/\b(\d+)\s+point\s+(\d+)\b/gi, '$1.$2');

  // ── "the square root of X" / "the cube root of X" ────────────────────────
  s = s.replace(/\bthe square root of\s+(.+?)(?=\s*(?:,|$|\band\b))/gi,
    (_, x) => `\\sqrt{${altTextToLatex(x)}}`
  );
  s = s.replace(/\bthe cube root of\s+(.+?)(?=\s*(?:,|$|\band\b))/gi,
    (_, x) => `\\sqrt[3]{${altTextToLatex(x)}}`
  );
  s = s.replace(/\bthe nth root of\s+(.+?)(?=\s*(?:,|$|\band\b))/gi,
    (_, x) => `\\sqrt[n]{${altTextToLatex(x)}}`
  );

  // ── powers / exponents ────────────────────────────────────────────────────
  s = s.replace(/\bsquared\b/gi, '^{2}');
  s = s.replace(/\bcubed\b/gi, '^{3}');
  s = s.replace(/\bto the power of\s+(\S+)/gi, '^{$1}');
  s = s.replace(/\bto the\s+(\S+)\s+power/gi, '^{$1}');
  // "x to the nth power" / "x to the 4th"
  s = s.replace(/\bto the\s+(\w+(?:st|nd|rd|th)?)\b/gi, (_, exp) => `^{${exp.replace(/(st|nd|rd|th)$/, '')}}`);

  // ── absolute value ────────────────────────────────────────────────────────
  s = s.replace(/\bthe absolute value of\s+(.+?)(?=\s*(?:,|$))/gi,
    (_, x) => `|${altTextToLatex(x)}|`
  );

  // ── parentheses ───────────────────────────────────────────────────────────
  s = s.replace(/\bleft parenthesis\b/gi, '(');
  s = s.replace(/\bright parenthesis\b/gi, ')');
  s = s.replace(/\bopen parenthesis\b/gi, '(');
  s = s.replace(/\bclose parenthesis\b/gi, ')');

  // ── function notation "f of x" / "g of x" / "h of x" ────────────────────
  // Must come before generic variable handling
  s = s.replace(/\b([fghFGH])\s+of\s+\((.+?)\)/gi, '$1($2)');
  s = s.replace(/\b([fghFGH])\s+of\s+(\S+)/gi, '$1($2)');
  // "f inverse of x"
  s = s.replace(/\b([fghFGH])\s+inverse\s+of\s+(\S+)/gi, '$1^{-1}($2)');

  // ── "the ordered pair X comma Y" / "(X, Y)" ──────────────────────────────
  s = s.replace(/\bthe ordered pair\s+(.+?)\s+comma\s+(.+?)(?=\s*(?:,|$))/gi,
    (_, x, y) => `(${altTextToLatex(x)}, ${altTextToLatex(y)})`
  );
  s = s.replace(/\bwith coordinates\s+(.+?)\s+comma\s+(.+?)(?=\s*(?:,|$))/gi,
    (_, x, y) => `(${altTextToLatex(x)}, ${altTextToLatex(y)})`
  );

  // ── operators ─────────────────────────────────────────────────────────────
  s = s.replace(/\bplus or minus\b/gi, '\\pm ');
  s = s.replace(/\bminus or plus\b/gi, '\\mp ');
  s = s.replace(/\btimes\b/gi, '\\times ');
  s = s.replace(/\bdivided by\b/gi, '\\div ');
  s = s.replace(/\bplus\b/gi, '+');
  s = s.replace(/\bminus\b/gi, '-');
  s = s.replace(/\bnegative\b/gi, '-');

  // ── inequalities ──────────────────────────────────────────────────────────
  s = s.replace(/\bgreater than or equal to\b/gi, '\\geq ');
  s = s.replace(/\bless than or equal to\b/gi, '\\leq ');
  s = s.replace(/\bgreater than\b/gi, '>');
  s = s.replace(/\bless than\b/gi, '<');
  s = s.replace(/\bnot equal to\b/gi, '\\neq ');
  s = s.replace(/\bapproximately equal to\b/gi, '\\approx ');
  s = s.replace(/\bequals\b/gi, '=');
  s = s.replace(/\bequal to\b/gi, '=');

  // ── Greek letters ─────────────────────────────────────────────────────────
  s = s.replace(/\balpha\b/gi, '\\alpha ');
  s = s.replace(/\bbeta\b/gi, '\\beta ');
  s = s.replace(/\bgamma\b/gi, '\\gamma ');
  s = s.replace(/\bdelta\b/gi, '\\delta ');
  s = s.replace(/\bepsilon\b/gi, '\\epsilon ');
  s = s.replace(/\btheta\b/gi, '\\theta ');
  s = s.replace(/\blambda\b/gi, '\\lambda ');
  s = s.replace(/\bmu\b/gi, '\\mu ');
  s = s.replace(/\bpi\b/gi, '\\pi ');
  s = s.replace(/\bsigma\b/gi, '\\sigma ');
  s = s.replace(/\bphi\b/gi, '\\phi ');
  s = s.replace(/\bomega\b/gi, '\\omega ');

  // ── special constants ─────────────────────────────────────────────────────
  s = s.replace(/\binfinity\b/gi, '\\infty ');

  // ── trig functions ────────────────────────────────────────────────────────
  s = s.replace(/\bsine\b/gi, '\\sin');
  s = s.replace(/\bcosine\b/gi, '\\cos');
  s = s.replace(/\btangent\b/gi, '\\tan');
  s = s.replace(/\bsecant\b/gi, '\\sec');
  s = s.replace(/\bcosecant\b/gi, '\\csc');
  s = s.replace(/\bcotangent\b/gi, '\\cot');
  s = s.replace(/\bnatural log\b/gi, '\\ln');
  s = s.replace(/\blog base\s+(\S+)/gi, '\\log_{$1}');
  s = s.replace(/\blog\b/gi, '\\log');

  // ── "comma" word → literal comma (used in coordinate pairs not caught above) ──
  // Punctuation commas were already stripped at the top; the word "comma" is
  // a semantic comma (e.g. "x comma y" in a set or coordinate context).
  s = s.replace(/\bcomma\b/gi, ',');

  // ── "subscript N" / "sub N" ───────────────────────────────────────────────
  s = s.replace(/\bsub(?:script)?\s+(\S+)/gi, '_{$1}');
  s = s.replace(/\bsuperscript\s+(\S+)/gi, '^{$1}');

  // ── clean up whitespace ───────────────────────────────────────────────────
  s = s.replace(/\s{2,}/g, ' ').trim();

  return s;
};


// ---------------------------------------------------------------------------
// 2. SYSTEM-OF-EQUATIONS DETECTION & STACKING
// ---------------------------------------------------------------------------

/**
 * Parse a multi-equation alt text in any of CB's three formats:
 *
 *   Format A – "open brace" style (already stripped before calling altTextToLatex):
 *     "open brace, 4x + 2y = 86, and, 3x + 5y = 166"
 *
 *   Format B – newline "and" style (from question prompt HTML):
 *     "4 x plus 2 y, equals 86 \n and \n 3 x plus 5 y, equals 166"
 *     (detected by adjacent imgs separated by " and ")
 *
 *   Format C – "Equation 1: ... Equation 2: ..." style:
 *     "Equation 1: 4 x plus 2 y equals 86 Equation 2: 3 x plus 5 y equals 166"
 *
 * Returns array of equation strings (already converted to LaTeX), or null.
 */
const parseSystemOfEquations = (alt) => {
  if (!alt) return null;

  // Format A: open brace  (most common in choices)
  if (/^open brace/i.test(alt.trim())) {
    const body = alt.replace(/^open brace[,\s]*/i, '');
    const parts = body.split(/\s*,\s*and\s*,\s*/i).filter(Boolean);
    if (parts.length >= 2) return parts.map(altTextToLatex);
  }

  // Format C: "Equation 1: ... Equation 2: ..." (prompts)
  const eqMatches = [...alt.matchAll(/Equation\s+\d+:\s*(.+?)(?=Equation\s+\d+:|$)/gi)];
  if (eqMatches.length >= 2) {
    return eqMatches.map((m) => altTextToLatex(m[1].trim()));
  }

  return null;
};


// ---------------------------------------------------------------------------
// 3. HTML PREPROCESSOR
// ---------------------------------------------------------------------------

/**
 * Scan `html` for all <img class="math-img" alt="..."> elements and replace
 * each with MathJax-renderable inline LaTeX \(...\).
 *
 * Adjacent images separated only by " and " (system-of-equations in prompts)
 * are collapsed into a stacked block.
 *
 * Returns the processed HTML string.
 */
export const preprocessMathHTML = (html) => {
  if (!html) return html;

  // Quick bail-out: no math images present
  if (!html.includes('math-img') && !html.includes('math_expression')) return html;

  const parser = new DOMParser();
  const doc = parser.parseFromString(`<div>${html}</div>`, 'text/html');
  const wrapper = doc.body.firstChild;

  // ── Step 1: handle "open brace" system-of-equations images ───────────────
  wrapper.querySelectorAll('img.math-img').forEach((img) => {
    const alt = (img.getAttribute('alt') || '').trim();
    if (!alt.toLowerCase().startsWith('open brace')) return;

    const equations = parseSystemOfEquations(alt);
    if (!equations || equations.length < 2) return;

    const stack = doc.createElement('div');
    stack.setAttribute(
      'style',
      'display:flex;flex-direction:column;gap:0.2em;align-items:flex-start;'
    );
    equations.forEach((eq) => {
      const span = doc.createElement('span');
      span.textContent = `\\(${eq}\\)`;
      stack.appendChild(span);
    });

    const container =
      img.closest('.math_expression') ||
      img.closest('.math-container') ||
      img.parentElement;
    container.replaceWith(stack);
  });

  // ── Step 2: handle "Equation N:" style images in prompt ──────────────────
  wrapper.querySelectorAll('img.math-img').forEach((img) => {
    const alt = (img.getAttribute('alt') || '').trim();
    const equations = parseSystemOfEquations(alt);
    if (!equations) return;

    const stack = doc.createElement('div');
    stack.setAttribute(
      'style',
      'display:flex;flex-direction:column;gap:0.2em;align-items:flex-start;'
    );
    equations.forEach((eq) => {
      const span = doc.createElement('span');
      span.textContent = `\\(${eq}\\)`;
      stack.appendChild(span);
    });

    const container =
      img.closest('.math_expression') ||
      img.closest('.math-container') ||
      img.parentElement;
    container.replaceWith(stack);
  });

  // ── Step 3: collapse adjacent single-equation images joined by "and" ─────
  // Some prompts render two separate <img> tags: [img1] " and " [img2]
  // If both are equations (contain "="), stack them.
  const allMathContainers = Array.from(
    wrapper.querySelectorAll('.math_expression, .math-container')
  );
  allMathContainers.forEach((container) => {
    const img = container.querySelector('img.math-img');
    if (!img) return;
    // Look at the next sibling text and the sibling after that
    let next = container.nextSibling;
    // Skip whitespace text nodes
    while (next && next.nodeType === Node.TEXT_NODE && /^\s*$/.test(next.textContent)) {
      next = next.nextSibling;
    }
    if (!next) return;

    // Check for " and " text node
    if (next.nodeType === Node.TEXT_NODE && /^\s*and\s*$/i.test(next.textContent.trim())) {
      const andNode = next;
      let sibling = andNode.nextSibling;
      while (sibling && sibling.nodeType === Node.TEXT_NODE && /^\s*$/.test(sibling.textContent)) {
        sibling = sibling.nextSibling;
      }
      if (!sibling) return;

      const sibImg = sibling.nodeName === 'IMG'
        ? sibling
        : sibling.querySelector?.('img.math-img');
      if (!sibImg) return;

      const alt1 = (img.getAttribute('alt') || '').trim();
      const alt2 = (sibImg.getAttribute('alt') || '').trim();
      const latex1 = altTextToLatex(alt1);
      const latex2 = altTextToLatex(alt2);

      // Only stack if both contain "=" (are equations, not standalone expressions)
      if (latex1.includes('=') && latex2.includes('=')) {
        const stack = doc.createElement('div');
        stack.setAttribute(
          'style',
          'display:flex;flex-direction:column;gap:0.2em;align-items:flex-start;'
        );
        [latex1, latex2].forEach((eq) => {
          const span = doc.createElement('span');
          span.textContent = `\\(${eq}\\)`;
          stack.appendChild(span);
        });

        const sibContainer = sibImg.closest('.math_expression') ||
          sibImg.closest('.math-container') ||
          sibling;

        container.replaceWith(stack);
        andNode.remove();
        sibContainer.remove();
      }
    }
  });

  // ── Step 4: replace remaining single math images with inline \(...\) ──────
  wrapper.querySelectorAll('img.math-img').forEach((img) => {
    const alt = (img.getAttribute('alt') || '').trim();
    if (!alt) return;

    const latex = altTextToLatex(alt);
    if (!latex) return;

    const span = doc.createElement('span');
    span.textContent = `\\(${latex}\\)`;

    const container =
      img.closest('.math_expression') ||
      img.closest('.math-container') ||
      img.parentElement;

    // If the container only contains the img (possibly with whitespace), replace it
    // Otherwise just replace the img itself
    const containerText = container.textContent.replace(/\s/g, '');
    const imgAltText = alt.replace(/\s/g, '');
    if (container !== wrapper && containerText === imgAltText) {
      container.replaceWith(span);
    } else {
      img.replaceWith(span);
    }
  });

  return wrapper.innerHTML;
};
