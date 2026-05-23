/**
 * Split a Reading & Writing question's prompt_html into a passage and a
 * question stem so they can be rendered side-by-side (Bluebook style).
 *
 * College Board ships the passage and the question stem concatenated inside
 * a single prompt_html string, e.g.
 *
 *   <p>Intro sentence about the source...</p>
 *   <blockquote>... passage ...</blockquote>
 *   <p>Which choice best states the main idea of the text?</p>
 *
 * The last block is the question; everything before it is the passage.
 *
 * Math prompts are single-statement and never split. Anything that doesn't
 * have at least two block-level children is returned as-is on the question
 * side with no passage.
 *
 * @param {object} options
 * @param {string} [options.promptHtml] - The question's prompt_html
 * @param {string} [options.passageHtml] - Explicit passage_html if present
 * @param {string} [options.subjectArea]  - "math" | "reading_writing"
 * @returns {{ passageHtml: string|null, questionHtml: string }}
 */
export function splitRWPrompt({ promptHtml = '', passageHtml = null, subjectArea = '' } = {}) {
  // Explicit passage_html field takes precedence — the data already supplies
  // the split.
  if (passageHtml) {
    return { passageHtml, questionHtml: promptHtml };
  }

  // Only split for Reading & Writing. Math prompts never have a passage.
  if (subjectArea !== 'reading_writing' || !promptHtml) {
    return { passageHtml: null, questionHtml: promptHtml };
  }

  // Parse the HTML and look at the top-level block children.
  let blocks = [];
  if (typeof DOMParser !== 'undefined') {
    const parser = new DOMParser();
    const doc = parser.parseFromString(`<div>${promptHtml}</div>`, 'text/html');
    const root = doc.body.firstChild;
    blocks = root ? Array.from(root.children) : [];
  }

  // Need at least 2 blocks to have something resembling passage + question.
  if (blocks.length < 2) {
    return { passageHtml: null, questionHtml: promptHtml };
  }

  // Last block is the question stem; everything before it is the passage.
  const last = blocks[blocks.length - 1];
  const passageBlocks = blocks.slice(0, -1);
  return {
    passageHtml: passageBlocks.map((el) => el.outerHTML).join(''),
    questionHtml: last.outerHTML,
  };
}

export default splitRWPrompt;
