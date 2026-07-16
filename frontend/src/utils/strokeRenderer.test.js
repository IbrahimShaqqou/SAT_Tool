import { renderStrokes } from './strokeRenderer';

function makeFakeCtx() {
  const calls = [];
  return {
    calls,
    beginPath: () => calls.push(['beginPath']),
    moveTo: (x, y) => calls.push(['moveTo', x, y]),
    lineTo: (x, y) => calls.push(['lineTo', x, y]),
    stroke: () => calls.push(['stroke']),
    set strokeStyle(v) { calls.push(['strokeStyle', v]); },
    set lineWidth(v) { calls.push(['lineWidth', v]); },
    set lineCap(v) {},
    set lineJoin(v) {},
    set globalCompositeOperation(v) { calls.push(['gco', v]); },
  };
}

test('renders a stroke as moveTo + lineTo sequence', () => {
  const ctx = makeFakeCtx();
  renderStrokes(ctx, [
    { color: '#111827', size: 3, eraser: false, points: [{ x: 0, y: 0 }, { x: 5, y: 5 }] },
  ]);
  expect(ctx.calls).toContainEqual(['moveTo', 0, 0]);
  expect(ctx.calls).toContainEqual(['lineTo', 5, 5]);
  expect(ctx.calls).toContainEqual(['stroke']);
});

test('eraser stroke sets destination-out composite op', () => {
  const ctx = makeFakeCtx();
  renderStrokes(ctx, [
    { color: '#fff', size: 22, eraser: true, points: [{ x: 1, y: 1 }, { x: 2, y: 2 }] },
  ]);
  expect(ctx.calls).toContainEqual(['gco', 'destination-out']);
});

test('supports an x/y offset for panel/scroll shifts', () => {
  const ctx = makeFakeCtx();
  renderStrokes(
    ctx,
    [{ color: '#000', size: 3, eraser: false, points: [{ x: 10, y: 10 }] }],
    { offsetX: 100, offsetY: 0 },
  );
  expect(ctx.calls).toContainEqual(['moveTo', 110, 10]);
});

test('scales points before applying offset', () => {
  const ctx = makeFakeCtx();
  renderStrokes(
    ctx,
    [{ color: '#000', size: 4, eraser: false, points: [{ x: 10, y: 10 }] }],
    { scaleX: 0.5, scaleY: 0.5 },
  );
  expect(ctx.calls).toContainEqual(['moveTo', 5, 5]);
  // lineWidth scales with scaleX
  expect(ctx.calls).toContainEqual(['lineWidth', 2]);
});

test('scale + offset compose: point maps to x*scale+offset', () => {
  const ctx = makeFakeCtx();
  renderStrokes(
    ctx,
    [{ color: '#000', size: 3, eraser: false, points: [{ x: 10, y: 10 }] }],
    { scaleX: 2, scaleY: 2, offsetX: 5, offsetY: 1 },
  );
  expect(ctx.calls).toContainEqual(['moveTo', 25, 21]);
});
