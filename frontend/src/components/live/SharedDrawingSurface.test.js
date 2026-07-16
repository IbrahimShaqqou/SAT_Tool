// frontend/src/components/live/SharedDrawingSurface.test.js
import { throttlePoints } from './SharedDrawingSurface';

test('throttlePoints batches points and flushes on interval boundary', () => {
  const flushed = [];
  const t = throttlePoints((pts) => flushed.push(pts), 100);
  t.add({ x: 1, y: 1 }, 0);
  t.add({ x: 2, y: 2 }, 50);
  t.add({ x: 3, y: 3 }, 120);
  expect(flushed.length).toBe(1);
  expect(flushed[0]).toHaveLength(2);
  t.flush();
  expect(flushed.length).toBe(2);
  expect(flushed[1]).toHaveLength(1);
});
