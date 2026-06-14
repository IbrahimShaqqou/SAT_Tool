/**
 * Desmos API key resolution.
 *
 * Prefers REACT_APP_DESMOS_API_KEY (set it in the Vercel dashboard to use your
 * own Desmos partner key). Falls back to Desmos's public demo key, which Desmos
 * publishes in their own getting-started docs and domain-restricts on their end
 * — it's not a secret, and it keeps the calculator working out of the box.
 */
const DESMOS_DEMO_KEY = 'dcb31709b452b1cf9dc26972add0fda6';

export function getDesmosApiKey() {
  return process.env.REACT_APP_DESMOS_API_KEY || DESMOS_DEMO_KEY;
}

export const DESMOS_SCRIPT_BASE = 'https://www.desmos.com/api/v1.11/calculator.js';

/** Full Desmos script URL with the resolved key. */
export function desmosScriptSrc() {
  return `${DESMOS_SCRIPT_BASE}?apiKey=${getDesmosApiKey()}`;
}
