/**
 * computeBounds — shared utility
 * Extracted from LessonViewerPage.jsx
 *
 * Computes Desmos viewport bounds from linear equations.
 */

/**
 * Parse a linear equation like "2x + 8y = 198" into { a, b, c } for ax + by = c
 * Returns null if it can't parse.
 */
export const parseLinearEquation = (eq) => {
  let s = eq.replace(/\s+/g, '');

  const sides = s.split('=');
  if (sides.length !== 2) return null;

  const extractCoeffs = (expr) => {
    let a = 0, b = 0, c = 0;
    const termRegex = /([+-]?)(\d+\.?\d*)(x|y)|([+-]?)(x|y)|([+-]?\d+\.?\d*)/g;
    let m;
    while ((m = termRegex.exec(expr)) !== null) {
      if (m[3]) {
        const sign = m[1] === '-' ? -1 : 1;
        const val = sign * parseFloat(m[2]);
        if (m[3] === 'x') a += val;
        else b += val;
      } else if (m[5]) {
        const sign = m[4] === '-' ? -1 : 1;
        if (m[5] === 'x') a += sign;
        else b += sign;
      } else if (m[6]) {
        c += parseFloat(m[6]);
      }
    }
    return { a, b, c };
  };

  const left = extractCoeffs(sides[0]);
  const right = extractCoeffs(sides[1]);

  return {
    a: left.a - right.a,
    b: left.b - right.b,
    c: right.c - left.c,
  };
};

/**
 * Compute Desmos viewport bounds from a list of equations.
 * Finds intercepts and intersection points, then sets bounds with padding.
 */
const computeBoundsFromEquations = (equations) => {
  const defaultBounds = { left: -10, right: 10, bottom: -10, top: 10 };
  if (!equations || equations.length === 0) return defaultBounds;

  const keyPoints = [];

  const parsed = equations.map(parseLinearEquation).filter(Boolean);

  parsed.forEach(({ a, b, c }) => {
    if (Math.abs(a) > 0.001) keyPoints.push({ x: c / a, y: 0 });
    if (Math.abs(b) > 0.001) keyPoints.push({ x: 0, y: c / b });
  });

  for (let i = 0; i < parsed.length; i++) {
    for (let j = i + 1; j < parsed.length; j++) {
      const { a: a1, b: b1, c: c1 } = parsed[i];
      const { a: a2, b: b2, c: c2 } = parsed[j];
      const det = a1 * b2 - a2 * b1;
      if (Math.abs(det) > 0.001) {
        const x = (c1 * b2 - c2 * b1) / det;
        const y = (a1 * c2 - a2 * c1) / det;
        keyPoints.push({ x, y });
      }
    }
  }

  if (keyPoints.length === 0) return defaultBounds;

  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  keyPoints.forEach(({ x, y }) => {
    if (isFinite(x)) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); }
    if (isFinite(y)) { minY = Math.min(minY, y); maxY = Math.max(maxY, y); }
  });

  if (!isFinite(minX)) return defaultBounds;

  const padX = Math.max(5, (maxX - minX) * 0.3);
  const padY = Math.max(5, (maxY - minY) * 0.3);

  return {
    left: Math.floor(minX - padX),
    right: Math.ceil(maxX + padX),
    bottom: Math.floor(minY - padY),
    top: Math.ceil(maxY + padY),
  };
};

export default computeBoundsFromEquations;
