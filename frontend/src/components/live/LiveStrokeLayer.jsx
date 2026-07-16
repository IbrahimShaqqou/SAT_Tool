import React, { useEffect, useRef } from 'react';
import { renderStrokes } from '../../utils/strokeRenderer';

/**
 * Read-only canvas overlay that replays stroke batches received over the live
 * session. Phase 1: shows the student's drawing to the tutor. Reuses the same
 * renderer as DrawingCanvas so the two never diverge.
 */
export default function LiveStrokeLayer({
  strokes,
  width,
  height,
  sourceWidth,
  sourceHeight,
  className = '',
}) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    // Scale the student's coordinate space into this overlay so the drawing is
    // proportionally sized. No source dims → scale 1 (original behavior).
    const scaleX = sourceWidth ? canvas.width / sourceWidth : 1;
    const scaleY = sourceHeight ? canvas.height / sourceHeight : 1;
    renderStrokes(ctx, strokes || [], { scaleX, scaleY });
  }, [strokes, width, height, sourceWidth, sourceHeight]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      className={`pointer-events-none absolute inset-0 ${className}`}
      aria-hidden="true"
    />
  );
}
