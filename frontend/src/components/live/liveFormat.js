const LETTERS = ['A', 'B', 'C', 'D', 'E'];

/** For MCQ, the correct choice index; null for SPR/unknown. */
export function correctIndex(detail) {
  if (!detail || detail.answer_type !== 'MCQ') return null;
  const idx = detail.correct_answer_json?.index;
  return typeof idx === 'number' ? idx : null;
}

/** Human label for the correct answer, e.g. "C · 10" or "3/4 or 0.75". */
export function correctAnswerLabel(detail) {
  if (!detail) return '—';
  if (detail.answer_type === 'MCQ') {
    const idx = correctIndex(detail);
    if (idx == null) return '—';
    const text = (detail.choices && detail.choices[idx]) || '';
    return `${LETTERS[idx] || '?'} · ${String(text).replace(/<[^>]+>/g, '').trim()}`;
  }
  const answers = detail.correct_answer_json?.answers || [];
  return answers.length ? answers.join(' or ') : '—';
}
