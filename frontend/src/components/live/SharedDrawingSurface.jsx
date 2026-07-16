// frontend/src/components/live/SharedDrawingSurface.jsx
import React, { useCallback, useEffect, useRef } from 'react';
import { renderStrokes } from '../../utils/strokeRenderer';
import { toFramePoint, FRAME_W } from '../../utils/frameCoords';

/**
 * Time-based point batcher for mid-stroke streaming. Buffers points and flushes
 * the buffer when a point arrives more than `intervalMs` after the window start.
 * Exported for unit testing. `now` is passed in so tests are deterministic.
 */
export function throttlePoints(onFlush, intervalMs = 60) {
  let buffer = [];
  let windowStart = null;
  return {
    add(point, now) {
      if (windowStart === null) windowStart = now;
      if (now - windowStart >= intervalMs && buffer.length > 0) {
        onFlush(buffer); buffer = []; windowStart = now;
      }
      buffer.push(point);
    },
    flush() { if (buffer.length > 0) { onFlush(buffer); buffer = []; } windowStart = null; },
  };
}

const DOT_SPACING = 28; // logical units

/**
 * Shared drawing canvas that lives INSIDE the scaled QuestionFrame. Sized in
 * logical units (FRAME_W x heightPx); the browser scales it with content, so
 * ink is stored/drawn in raw logical coordinates. Only pointer capture converts
 * viewport px -> logical via the frame scale.
 *
 * Props:
 *   active, author, penColor, size, eraser
 *   strokes   - current question's merged strokes [{id,author,color,size,eraser,points:[{x,y}]}]
 *   showGrid  - draw the logical dot grid
 *   scale     - current frame scale (from QuestionFrame)
 *   heightPx  - logical height of the frame content (canvas covers this)
 *   onStrokeStart(opts)->id ; onStrokePoints(id, points) ; onStrokeEnd(id)
 */
export default function SharedDrawingSurface({
  active, author, penColor = '#b45309', size = 3, eraser = false,
  strokes = [], showGrid = true, scale = 1, heightPx = 0,
  onStrokeStart, onStrokePoints, onStrokeEnd,
}) {
  const canvasRef = useRef(null);
  const drawingId = useRef(null);
  const batcher = useRef(null);
  const height = heightPx || 1160;

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    // Backing store in device px; logical drawing space via ctx scale(dpr).
    if (canvas.width !== Math.round(FRAME_W * dpr) || canvas.height !== Math.round(height * dpr)) {
      canvas.width = Math.round(FRAME_W * dpr);
      canvas.height = Math.round(height * dpr);
    }
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); // 1 logical unit = 1 css px in backing store
    ctx.clearRect(0, 0, FRAME_W, height);
    if (showGrid) drawGrid(ctx, FRAME_W, height);
    for (const s of strokes) {
      renderStrokes(ctx, [{ color: s.color, size: s.size, eraser: s.eraser, points: s.points }]);
    }
  }, [strokes, showGrid, height]);

  useEffect(() => { redraw(); }, [redraw]);

  const nowMs = () => (typeof performance !== 'undefined' ? performance.now() : 0);

  const handleDown = useCallback((e) => {
    if (!active) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const n = toFramePoint(e.clientX, e.clientY, canvas.getBoundingClientRect(), scale);
    const id = onStrokeStart && onStrokeStart({ color: eraser ? '#000000' : penColor, size, eraser, point: n });
    drawingId.current = id;
    batcher.current = throttlePoints((pts) => { if (drawingId.current) onStrokePoints && onStrokePoints(drawingId.current, pts); }, 60);
  }, [active, onStrokeStart, onStrokePoints, penColor, size, eraser, scale]);

  const handleMove = useCallback((e) => {
    if (!active || !drawingId.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const n = toFramePoint(e.clientX, e.clientY, canvas.getBoundingClientRect(), scale);
    batcher.current.add(n, nowMs());
  }, [active, scale]);

  const handleUp = useCallback(() => {
    if (!drawingId.current) return;
    if (batcher.current) batcher.current.flush();
    onStrokeEnd && onStrokeEnd(drawingId.current);
    drawingId.current = null;
  }, [onStrokeEnd]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute', top: 0, left: 0,
        width: `${FRAME_W}px`, height: `${height}px`,
        pointerEvents: active ? 'all' : 'none', touchAction: 'none',
        cursor: active ? 'crosshair' : 'default',
      }}
      onPointerDown={handleDown}
      onPointerMove={handleMove}
      onPointerUp={handleUp}
      onPointerLeave={handleUp}
      aria-hidden="true"
    />
  );
}

/** Faint logical-unit dot grid. Aligns across sides because units are shared. */
function drawGrid(ctx, w, h) {
  ctx.save();
  ctx.fillStyle = 'rgba(120,120,120,0.35)';
  for (let x = DOT_SPACING; x < w; x += DOT_SPACING) {
    for (let y = DOT_SPACING; y < h; y += DOT_SPACING) {
      ctx.beginPath(); ctx.arc(x, y, 1, 0, Math.PI * 2); ctx.fill();
    }
  }
  ctx.restore();
}
