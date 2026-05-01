/**
 * DrawingCanvas
 * Transparent canvas overlay for freehand annotation on top of question content.
 * - Stores strokes per question ID so drawings persist when navigating questions.
 * - Stroke points are stored in "world space": X is content-relative (independent
 *   of the calculator panel), Y is document-space (scrollY-relative).
 * - When the calculator opens/closes the mx-auto content shifts ±220px. An animated
 *   xOffsetRef tracks this and is added at render time so strokes follow the text.
 * - pointer-events: none when inactive so the page remains fully interactive.
 *
 * Props:
 *   isActive        - boolean, enables drawing
 *   questionId      - string|number, key for per-question stroke storage
 *   scrollRef       - optional React ref to a scrollable container element
 *   showCalculator  - boolean, whether the 440px calculator panel is open
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import { Eraser, Trash2, Undo2 } from 'lucide-react';

const COLORS = [
  { value: '#111827', label: 'Black' },
  { value: '#ffffff', label: 'White' },
  { value: '#ef4444', label: 'Red' },
  { value: '#3b82f6', label: 'Blue' },
  { value: '#22c55e', label: 'Green' },
  { value: '#f59e0b', label: 'Amber' },
];

const isDarkMode = () =>
  typeof document !== 'undefined' &&
  document.documentElement.classList.contains('dark');

const getDefaultPenColor = () => (isDarkMode() ? '#ffffff' : '#111827');

const PEN_SIZE = 3;
const ERASER_SIZES = [12, 22, 36];

// ── Drawing helpers ────────────────────────────────────────────────────────
// xOffset: render-time horizontal shift to align strokes with shifted content.
// scrollY: subtract from stored document-space Y to get canvas Y.

const applyStroke = (ctx, stroke, scrollY = 0, xOffset = 0) => {
  const { points, color, size, eraser } = stroke;
  if (!points.length) return;

  ctx.save();
  ctx.globalCompositeOperation = eraser ? 'destination-out' : 'source-over';
  ctx.strokeStyle = color;
  ctx.lineWidth = size;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  if (points.length === 1) {
    ctx.beginPath();
    ctx.arc(points[0].x + xOffset, points[0].y - scrollY, size / 2, 0, Math.PI * 2);
    ctx.fillStyle = eraser ? 'rgba(0,0,0,1)' : color;
    ctx.fill();
  } else {
    ctx.beginPath();
    ctx.moveTo(points[0].x + xOffset, points[0].y - scrollY);
    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(points[i].x + xOffset, points[i].y - scrollY);
    }
    ctx.stroke();
  }
  ctx.restore();
};

const redrawAll = (ctx, canvas, strokes, scrollY = 0, xOffset = 0) => {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  for (const stroke of strokes) {
    applyStroke(ctx, stroke, scrollY, xOffset);
  }
};

// ── Component ──────────────────────────────────────────────────────────────

const DrawingCanvas = ({ isActive, questionId, scrollRef, showCalculator = false }) => {
  const canvasRef = useRef(null);
  const isPointerDown = useRef(false);
  const currentStroke = useRef(null);
  const strokesMap = useRef(new Map());

  // Render-time X offset (animated). Strokes are in world space; offset converts to canvas pixels.
  // When calculator is fully open: xOffsetRef.current = -220. Closed: 0.
  const xOffsetRef = useRef(0);
  const animFrameRef = useRef(null);

  const [penColor, setPenColor] = useState(getDefaultPenColor);
  const [isEraser, setIsEraser] = useState(false);
  const [eraserSizeIdx, setEraserSizeIdx] = useState(1);

  // Switch the default pen color when the user toggles theme, but only if
  // the user hasn't explicitly picked a non-default ink color yet.
  useEffect(() => {
    const root = document.documentElement;
    const observer = new MutationObserver(() => {
      setPenColor((prev) => {
        if (prev === '#111827' && isDarkMode()) return '#ffffff';
        if (prev === '#ffffff' && !isDarkMode()) return '#111827';
        return prev;
      });
    });
    observer.observe(root, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  const penColorRef = useRef(penColor);
  const isEraserRef = useRef(isEraser);
  const eraserSizeIdxRef = useRef(eraserSizeIdx);
  const questionIdRef = useRef(questionId);

  useEffect(() => { penColorRef.current = penColor; }, [penColor]);
  useEffect(() => { isEraserRef.current = isEraser; }, [isEraser]);
  useEffect(() => { eraserSizeIdxRef.current = eraserSizeIdx; }, [eraserSizeIdx]);
  useEffect(() => { questionIdRef.current = questionId; }, [questionId]);

  // ── Scroll offset helper ─────────────────────────────────────────────────

  const getScrollY = useCallback(() => {
    if (scrollRef?.current) return scrollRef.current.scrollTop;
    return window.scrollY;
  }, [scrollRef]);

  // ── Calculator offset animation ──────────────────────────────────────────
  // When the calculator opens/closes, animate xOffsetRef from current → target
  // over 300ms (matching the CSS transition-all duration-300 on the content div).
  // Strokes are in world space so they don't need data mutation — only the render
  // offset changes.

  const prevShowCalculator = useRef(showCalculator);

  useEffect(() => {
    if (prevShowCalculator.current === showCalculator) return;
    prevShowCalculator.current = showCalculator;

    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);

    const targetX = showCalculator ? -220 : 0;
    const startX = xOffsetRef.current;
    const duration = 300;
    const startTime = performance.now();

    const animate = (now) => {
      const elapsed = now - startTime;
      const t = Math.min(elapsed / duration, 1);
      // ease-in-out to match CSS ease
      const eased = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
      xOffsetRef.current = startX + (targetX - startX) * eased;

      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        const strokes = strokesMap.current.get(questionIdRef.current) || [];
        redrawAll(ctx, canvas, strokes, getScrollY(), xOffsetRef.current);
      }

      if (t < 1) {
        animFrameRef.current = requestAnimationFrame(animate);
      } else {
        xOffsetRef.current = targetX;
        animFrameRef.current = null;
      }
    };

    animFrameRef.current = requestAnimationFrame(animate);
    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }
    };
  }, [showCalculator, getScrollY]);

  // ── Canvas sizing ────────────────────────────────────────────────────────

  const syncSize = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    if (canvas.width === rect.width && canvas.height === rect.height) return;
    canvas.width = rect.width;
    canvas.height = rect.height;
    const ctx = canvas.getContext('2d');
    const strokes = strokesMap.current.get(questionIdRef.current) || [];
    redrawAll(ctx, canvas, strokes, getScrollY(), xOffsetRef.current);
  }, [getScrollY]);

  useEffect(() => {
    syncSize();
    const ro = new ResizeObserver(syncSize);
    if (canvasRef.current) ro.observe(canvasRef.current);
    return () => ro.disconnect();
  }, [syncSize]);

  // ── Redraw when question changes ─────────────────────────────────────────

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const strokes = strokesMap.current.get(questionId) || [];
    redrawAll(ctx, canvas, strokes, getScrollY(), xOffsetRef.current);
  }, [questionId, getScrollY]);

  // ── Redraw on scroll ─────────────────────────────────────────────────────

  useEffect(() => {
    const el = scrollRef?.current || window;
    const onScroll = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      const strokes = strokesMap.current.get(questionIdRef.current) || [];
      redrawAll(ctx, canvas, strokes, scrollRef?.current?.scrollTop ?? window.scrollY, xOffsetRef.current);
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [scrollRef]);

  // ── Pointer events ───────────────────────────────────────────────────────
  // getPos returns world-space coords: X = viewport X minus current render offset.
  // This means strokes are content-relative and don't shift when offset changes.

  const getPos = useCallback((e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left - xOffsetRef.current,
      y: e.clientY - rect.top + getScrollY(),
    };
  }, [getScrollY]);

  const handlePointerDown = useCallback((e) => {
    if (!isActive) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    isPointerDown.current = true;
    const pos = getPos(e);
    const eraser = isEraserRef.current;
    currentStroke.current = {
      color: eraser ? 'rgba(0,0,0,1)' : penColorRef.current,
      size: eraser ? ERASER_SIZES[eraserSizeIdxRef.current] : PEN_SIZE,
      eraser,
      points: [pos],
    };
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    applyStroke(ctx, currentStroke.current, getScrollY(), xOffsetRef.current);
  }, [isActive, getPos, getScrollY]);

  const handlePointerMove = useCallback((e) => {
    if (!isPointerDown.current || !isActive) return;
    e.preventDefault();
    const pos = getPos(e);
    const stroke = currentStroke.current;
    stroke.points.push(pos);

    const pts = stroke.points;
    const n = pts.length;
    const sy = getScrollY();
    const xOff = xOffsetRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.save();
    ctx.globalCompositeOperation = stroke.eraser ? 'destination-out' : 'source-over';
    ctx.strokeStyle = stroke.color;
    ctx.lineWidth = stroke.size;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(pts[n - 2].x + xOff, pts[n - 2].y - sy);
    ctx.lineTo(pts[n - 1].x + xOff, pts[n - 1].y - sy);
    ctx.stroke();
    ctx.restore();
  }, [isActive, getPos, getScrollY]);

  const handlePointerUp = useCallback(() => {
    if (!isPointerDown.current) return;
    isPointerDown.current = false;
    const stroke = currentStroke.current;
    if (!stroke) return;
    const qId = questionIdRef.current;
    if (!strokesMap.current.has(qId)) strokesMap.current.set(qId, []);
    strokesMap.current.get(qId).push(stroke);
    currentStroke.current = null;
  }, []);

  // ── Undo ─────────────────────────────────────────────────────────────────

  const handleUndo = useCallback(() => {
    const qId = questionIdRef.current;
    const strokes = strokesMap.current.get(qId);
    if (!strokes || strokes.length === 0) return;
    strokes.pop();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    redrawAll(ctx, canvas, strokes, getScrollY(), xOffsetRef.current);
  }, [getScrollY]);

  useEffect(() => {
    if (!isActive) return;
    const onKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        handleUndo();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isActive, handleUndo]);

  // ── Clear ────────────────────────────────────────────────────────────────

  const handleClear = () => {
    strokesMap.current.delete(questionId);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  // ── Cursor ───────────────────────────────────────────────────────────────

  const eraserPx = ERASER_SIZES[eraserSizeIdx];
  const cursor = !isActive ? 'default'
    : isEraser ? `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='${eraserPx}' height='${eraserPx}'%3E%3Ccircle cx='${eraserPx/2}' cy='${eraserPx/2}' r='${eraserPx/2-1}' fill='white' stroke='%23555' stroke-width='1.5'/%3E%3C/svg%3E") ${eraserPx/2} ${eraserPx/2}, cell`
    : 'crosshair';

  return (
    <>
      {/* Full-page canvas overlay */}
      <canvas
        ref={canvasRef}
        className="fixed z-20"
        style={{
          top: 112,
          left: 0,
          right: 0,
          bottom: 0,
          width: '100%',
          height: 'calc(100vh - 112px)',
          pointerEvents: isActive ? 'all' : 'none',
          touchAction: 'none',
          cursor,
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
      />

      {/* Floating toolbar — shown when draw mode is active, above the bottom nav */}
      {isActive && (
        <div
          className="fixed z-30 flex items-center gap-1.5 px-3 py-2 bg-surface-card rounded-full shadow-lg border border-edge"
          style={{ bottom: 80, right: 16 }}
        >
          {COLORS.map(({ value, label }) => (
            <button
              key={value}
              title={label}
              onClick={() => { setPenColor(value); setIsEraser(false); }}
              className="w-5 h-5 rounded-full transition-transform hover:scale-110 focus:outline-none border border-edge"
              style={{
                backgroundColor: value,
                outline: !isEraser && penColor === value ? '2px solid #6b7280' : '2px solid transparent',
                outlineOffset: 2,
              }}
            />
          ))}

          <div className="w-px h-5 bg-edge mx-0.5" />

          <button
            title="Eraser"
            onClick={() => setIsEraser(!isEraser)}
            className={`p-1 rounded-lg transition-colors ${
              isEraser
                ? 'bg-brand-600 text-white'
                : 'text-ink-muted hover:bg-edge-subtle'
            }`}
          >
            <Eraser className="h-4 w-4" />
          </button>

          {isEraser && (
            <>
              <div className="w-px h-5 bg-edge mx-0.5" />
              {ERASER_SIZES.map((size, idx) => (
                <button
                  key={size}
                  title={`Eraser size ${idx + 1}`}
                  onClick={() => setEraserSizeIdx(idx)}
                  className={`flex items-center justify-center w-6 h-6 rounded-lg transition-colors ${
                    eraserSizeIdx === idx
                      ? 'bg-edge-strong'
                      : 'hover:bg-edge-subtle'
                  }`}
                >
                  <span
                    className="rounded-full border border-ink-faint bg-surface-input"
                    style={{ width: 4 + idx * 4, height: 4 + idx * 4 }}
                  />
                </button>
              ))}
            </>
          )}

          <div className="w-px h-5 bg-edge mx-0.5" />

          <button
            title="Undo (Ctrl+Z)"
            onClick={handleUndo}
            className="p-1 text-ink-muted hover:bg-edge-subtle rounded-lg transition-colors"
          >
            <Undo2 className="h-4 w-4" />
          </button>

          <button
            title="Clear all drawings"
            onClick={handleClear}
            className="p-1 text-ink-muted hover:bg-edge-subtle rounded-lg transition-colors"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      )}
    </>
  );
};

export { DrawingCanvas };
export default DrawingCanvas;
