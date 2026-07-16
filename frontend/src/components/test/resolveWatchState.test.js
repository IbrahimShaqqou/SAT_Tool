import { resolveWatchState } from './liveHelpers';

test('shows the answer when it belongs to the current question', () => {
  const lastByType = {
    question_changed: { payload: { question_id: 'q1', question_index: 0 }, _rx: 1 },
    answer_selected: { payload: { question_id: 'q1', selected_answer: 2 }, _rx: 2 },
  };
  const s = resolveWatchState(lastByType, null);
  expect(s.currentQuestionId).toBe('q1');
  expect(s.answer).toEqual({ question_id: 'q1', selected_answer: 2 });
});

test('clears a stale answer after the student moves to a new question', () => {
  // answered q1 (rx 2), then navigated to q2 (rx 3) — newer question wins,
  // and the q1 answer must NOT show on q2.
  const lastByType = {
    answer_selected: { payload: { question_id: 'q1', selected_answer: 2 }, _rx: 2 },
    question_changed: { payload: { question_id: 'q2', question_index: 1 }, _rx: 3 },
  };
  const s = resolveWatchState(lastByType, null);
  expect(s.currentQuestionId).toBe('q2');
  expect(s.answer).toBeNull();
});

test('a fresh answer on the new question shows once it arrives', () => {
  const lastByType = {
    question_changed: { payload: { question_id: 'q2', question_index: 1 }, _rx: 3 },
    answer_selected: { payload: { question_id: 'q2', selected_answer: 0 }, _rx: 4 },
  };
  const s = resolveWatchState(lastByType, null);
  expect(s.currentQuestionId).toBe('q2');
  expect(s.answer).toEqual({ question_id: 'q2', selected_answer: 0 });
});

test('falls back to the snapshot when no deltas yet, gating the snapshot answer', () => {
  const snapshot = { question_id: 'q5', question_index: 4, selected_answer: 1 };
  const s = resolveWatchState({}, snapshot);
  expect(s.currentQuestionId).toBe('q5');
  expect(s.answer).toEqual({ question_id: 'q5', selected_answer: 1 });
});

test('snapshot answer is cleared once the student navigates past it', () => {
  const snapshot = { question_id: 'q5', question_index: 4, selected_answer: 1 };
  const lastByType = { question_changed: { payload: { question_id: 'q6', question_index: 5 }, _rx: 10 } };
  const s = resolveWatchState(lastByType, snapshot);
  expect(s.currentQuestionId).toBe('q6');
  expect(s.answer).toBeNull();
});

test('returns nulls when there is nothing yet', () => {
  const s = resolveWatchState({}, null);
  expect(s.currentQuestionId).toBeNull();
  expect(s.answer).toBeNull();
});
