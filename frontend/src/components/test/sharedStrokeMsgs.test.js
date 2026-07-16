import {
  buildStrokeStart, buildStrokePoints, buildStrokeEnd,
  buildStrokeUndo, buildStrokeClear, buildStrokesSync,
} from './liveHelpers';

test('stroke_start carries id, author, style, first point', () => {
  const m = buildStrokeStart('s1', 'tutor', { strokeId: 't-1', color: '#b45309', size: 3, eraser: false, point: { x: 82, y: 232 } });
  expect(m.type).toBe('stroke_start');
  expect(m.session_id).toBe('s1');
  expect(m.sender_role).toBe('tutor');
  expect(m.payload).toMatchObject({ stroke_id: 't-1', author: 'tutor', color: '#b45309', size: 3, eraser: false, point: { x: 82, y: 232 } });
});

test('stroke_points carries incremental points', () => {
  const m = buildStrokePoints('s1', 'student', 'st-2', [{ x: 246, y: 464 }]);
  expect(m.type).toBe('stroke_points');
  expect(m.payload.stroke_id).toBe('st-2');
  expect(m.payload.points).toHaveLength(1);
});

test('stroke_end / undo / clear / sync shapes', () => {
  expect(buildStrokeEnd('s1', 'tutor', 't-1', 'q9').payload).toEqual({ stroke_id: 't-1', question_id: 'q9' });
  expect(buildStrokeUndo('s1', 'tutor', 't-1', 'q9').payload).toEqual({ author: 'tutor', stroke_id: 't-1', question_id: 'q9' });
  expect(buildStrokeClear('s1', 'student', 'q9').payload).toEqual({ author: 'student', question_id: 'q9' });
  const sync = buildStrokesSync('s1', 'q9', [{ id: 't-1', author: 'tutor', color: '#b45309', size: 3, eraser: false, points: [] }]);
  expect(sync.type).toBe('strokes_sync');
  expect(sync.payload.question_id).toBe('q9');
  expect(sync.payload.strokes).toHaveLength(1);
});
