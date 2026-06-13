/**
 * Desmos API key resolution.
 *
 * The key comes from REACT_APP_DESMOS_API_KEY (set at build time in the Vercel
 * dashboard). There is intentionally NO hardcoded fallback — get your own key
 * at https://www.desmos.com/api/v1.11/docs/index.html and set the env var.
 *
 * If it's missing we warn loudly and return '' (the Desmos script then loads
 * unauthenticated, which Desmos rejects on non-allowlisted domains — so a blank
 * calculator is your signal the env var wasn't set).
 */
export function getDesmosApiKey() {
  const key = process.env.REACT_APP_DESMOS_API_KEY;
  if (!key) {
    // eslint-disable-next-line no-console
    console.error(
      '[ZooPrep] REACT_APP_DESMOS_API_KEY is not set — the Desmos calculator/graphs ' +
      'will not load. Set it in your Vercel build environment.'
    );
    return '';
  }
  return key;
}

export const DESMOS_SCRIPT_BASE = 'https://www.desmos.com/api/v1.11/calculator.js';

/** Full Desmos script URL with the resolved key. */
export function desmosScriptSrc() {
  return `${DESMOS_SCRIPT_BASE}?apiKey=${getDesmosApiKey()}`;
}
