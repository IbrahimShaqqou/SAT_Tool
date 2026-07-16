/**
 * Pure stroke rendering shared by the student's DrawingCanvas and the tutor's
 * read-only LiveStrokeLayer. A stroke is {color, size, eraser, points:[{x,y}]}
 * in world-space coordinates; callers pass an offset to map world-space to the
 * local canvas (e.g. when a calculator panel shifts content or on scroll).
 */
export function renderStrokes(
  ctx,
  strokes,
  { offsetX = 0, offsetY = 0, scaleX = 1, scaleY = 1 } = {},
) {
  if (!ctx || !strokes) return;
  // Guard against a zero scale collapsing the drawing / pen width.
  const sx = scaleX || 1;
  const sy = scaleY || 1;
  for (const stroke of strokes) {
    if (!stroke.points || stroke.points.length === 0) continue;
    ctx.globalCompositeOperation = stroke.eraser ? 'destination-out' : 'source-over';
    ctx.strokeStyle = stroke.color;
    // Scale pen thickness with the drawing so it stays proportional.
    ctx.lineWidth = stroke.size * sx;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    const [first, ...rest] = stroke.points;
    ctx.moveTo(first.x * sx + offsetX, first.y * sy + offsetY);
    if (rest.length === 0) {
      ctx.lineTo(first.x * sx + offsetX, first.y * sy + offsetY);
    } else {
      for (const p of rest) ctx.lineTo(p.x * sx + offsetX, p.y * sy + offsetY);
    }
    ctx.stroke();
  }
  ctx.globalCompositeOperation = 'source-over';
}
