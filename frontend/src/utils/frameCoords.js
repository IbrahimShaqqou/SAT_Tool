// frontend/src/utils/frameCoords.js
/**
 * Fixed-frame coordinates for the shared drawing surface.
 *
 * Question content renders into a canonical logical page (FRAME_W x FRAME_H),
 * scaled uniformly to fit its container. The drawing canvas is a sibling INSIDE
 * that scaled frame, sized in logical units, so content + ink scale in lockstep
 * and scroll together. A stroke point is {x, y} in LOGICAL units (x in [0,FRAME_W],
 * y in [0, contentHeight]). Rendering draws raw logical coords onto the logical-
 * sized canvas; only pointer capture converts viewport px -> logical (÷ scale).
 */
export const FRAME_W = 820;
export const FRAME_H = 1160;
export const MIN_SCALE = 0.4;

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/** Uniform scale to fit the frame into a container of the given CSS width. */
export function frameScale(containerWidth) {
  if (!containerWidth || containerWidth <= 0) return MIN_SCALE;
  return clamp(containerWidth / FRAME_W, MIN_SCALE, 1);
}

/**
 * Viewport (clientX/clientY) -> logical frame units, given the canvas element's
 * (post-transform, scaled) bounding rect and the current frame scale.
 */
export function toFramePoint(clientX, clientY, canvasRect, scale) {
  const s = scale || 1;
  return {
    x: (clientX - canvasRect.left) / s,
    y: (clientY - canvasRect.top) / s,
  };
}
