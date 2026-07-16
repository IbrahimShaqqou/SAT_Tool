import { computeLiveIndicatorState } from './liveHelpers';

test('tutor_joined sets present true, tutor_left sets it false', () => {
  let state = computeLiveIndicatorState({}, { type: 'tutor_joined', payload: {} });
  expect(state.present).toBe(true);
  state = computeLiveIndicatorState(state, { type: 'tutor_left', payload: {} });
  expect(state.present).toBe(false);
});

test('ignores unrelated message types', () => {
  const state = computeLiveIndicatorState({ present: true }, { type: 'answer_selected' });
  expect(state.present).toBe(true);
});

test('captures tutor name from tutor_joined payload', () => {
  const state = computeLiveIndicatorState({}, { type: 'tutor_joined', payload: { tutor_name: 'Sam' } });
  expect(state.tutorName).toBe('Sam');
});
