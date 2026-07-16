import { buildStrokeBatchMessage } from './liveHelpers';

test('builds a stroke_batch message from strokes', () => {
  const msg = buildStrokeBatchMessage('sess-1', 'q-1', [{ color: '#000', size: 3, eraser: false, points: [] }]);
  expect(msg.type).toBe('stroke_batch');
  expect(msg.session_id).toBe('sess-1');
  expect(msg.payload.question_id).toBe('q-1');
  expect(msg.payload.strokes).toHaveLength(1);
});
