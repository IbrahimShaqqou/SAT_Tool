// frontend/src/utils/frameCoords.test.js
import { FRAME_W, FRAME_H, MIN_SCALE, frameScale, toFramePoint } from './frameCoords';

test('constants are the canonical page dimensions', () => {
  expect(FRAME_W).toBe(820);
  expect(FRAME_H).toBe(1160);
  expect(MIN_SCALE).toBeGreaterThan(0);
  expect(MIN_SCALE).toBeLessThan(1);
});

test('frameScale scales to fit narrower containers', () => {
  expect(frameScale(410)).toBeCloseTo(0.5, 5); // 410/820
  expect(frameScale(820)).toBeCloseTo(1, 5);
});

test('frameScale caps at 1 for large screens (no upscaling)', () => {
  expect(frameScale(2000)).toBe(1);
});

test('frameScale floors at MIN_SCALE for tiny screens', () => {
  expect(frameScale(10)).toBe(MIN_SCALE);
});

test('toFramePoint converts a viewport point to logical units by dividing by scale', () => {
  const rect = { left: 100, top: 50 };
  const p = toFramePoint(305, 150, rect, 0.5);
  expect(p.x).toBeCloseTo((305 - 100) / 0.5, 5); // 410
  expect(p.y).toBeCloseTo((150 - 50) / 0.5, 5); // 200
});

test('toFramePoint at scale 1 is a straight offset', () => {
  const p = toFramePoint(500, 300, { left: 0, top: 0 }, 1);
  expect(p.x).toBeCloseTo(500, 5);
  expect(p.y).toBeCloseTo(300, 5);
});

test('toFramePoint round-trips at any logical Y regardless of canvas height', () => {
  // The canvas is positioned top:0 inside the scaled frame, so its rect.top is
  // fixed and independent of the canvas's own height. A click over content at a
  // large logical Y must map back to that same logical Y. Regression guard for
  // the bug where the canvas was floored to 1160px tall (Math.max(1160, h)) even
  // when content was shorter — capture math must not depend on canvas height.
  const scale = 0.5;
  const rect = { left: 0, top: 0 }; // canvas top-left at viewport origin
  for (const logicalY of [10, 450, 573, 1000]) {
    const clientY = logicalY * scale; // where that logical point sits in viewport px
    const p = toFramePoint(0, clientY, rect, scale);
    expect(p.y).toBeCloseTo(logicalY, 5);
  }
});
