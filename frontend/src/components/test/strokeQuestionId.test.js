// frontend/src/components/test/strokeQuestionId.test.js
import {
  buildStrokeStart, buildStrokePoints, buildStrokeEnd, buildStrokeUndo, buildStrokeClear,
} from './liveHelpers';

test('every stroke message carries question_id', () => {
  const q = 'q-42';
  expect(buildStrokeStart('s', 'tutor', { strokeId: 't-1', color: '#000', size: 3, eraser: false, point: { x: 1, y: 2 }, questionId: q }).payload.question_id).toBe(q);
  expect(buildStrokePoints('s', 'tutor', 't-1', [{ x: 3, y: 4 }], q).payload.question_id).toBe(q);
  expect(buildStrokeEnd('s', 'tutor', 't-1', q).payload.question_id).toBe(q);
  expect(buildStrokeUndo('s', 'tutor', 't-1', q).payload.question_id).toBe(q);
  expect(buildStrokeClear('s', 'tutor', q).payload.question_id).toBe(q);
});

test('stroke_start still carries the point and style', () => {
  const m = buildStrokeStart('s', 'student', { strokeId: 'x', color: '#111827', size: 3, eraser: false, point: { x: 10, y: 20 }, questionId: 'q1' });
  expect(m.type).toBe('stroke_start');
  expect(m.payload.point).toEqual({ x: 10, y: 20 });
  expect(m.payload.author).toBe('student');
});
