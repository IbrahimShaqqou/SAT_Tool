/**
 * DrawingCanvas
 * Transparent canvas overlay for freehand annotation on top of question content.
 * - Stores strokes per question ID so drawings persist when navigating questions.
 * - pointer-events: none when inactive so the page remains fully interactive.
 * - Self-contained: manages its own color/eraser state and floating toolbar.
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import { Pencil, Eraser, Trash2 } from 'lucide-react';

const COLORS = [
  { value: '#111827', label: 'Black' },
  { value: '#ef4444', label: 'Red' },
  { value: '#3b82f6', label: 'Blue' },
  { value: '#22c55e', label: 'Green' },
  { value: '#f59e0b', label: 'Amber' },
];

const PEN_SIZE = 3;
const ERASER_SIZE = 22;

// ── Drawing helpers ────────────────────────────────────────────────────────

const applyStroke = (ctx, stroke) => {
  const { points, color, size, eraser } = stroke;
  if (!points.length) return;

  ctx.save();
  ctx.globalCompositeOperation = eraser ? 'destination-out' : 'source-over';
  ctx.strokeStyle = color;
  ctx.lineWidth = size;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  if (points.length === 1) {
    // Single tap → filled dot
    ctx.beginPath();
    ctx.arc(points[0].x, points[0].y, size / 2, 0, Math.PI * 2);
    ctx.fillStyle = eraser ? 'rgba(0,0,0,1)' : color;
    ctx.fill();
  } else {
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(points[i].x, points[i].y);
    }
    ctx.stroke();
  }
  ctx.restore();
};

const redrawAll = (ctx, canvas, strokes) => {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  for (const stroke of strokes) {
    applyStroke(ctx, stroke);
  }
};

// ── Component ──────────────────────────────────────────────────────────────

const DrawingCanvas = ({ isActive, questionId }) => {
  const canvasRef = useRef(null);
  const isPointerDown = useRef(false);
  const currentStroke = useRef(null);
  // Map<questionId, stroke[]>
  const strokesMap = useRef(new Map());

  // Internal tool state
  const [penColor, setPenColor] = useState(COLORS[0].value);
  const [isEraser, setIsEraser] = useState(false);

  // Expose refs for use in event handlers without stale closures
  const penColorRef = useRef(penColor);
  const isEraserRef = useRef(isEraser);
  const questionIdRef = useRef(questionId);

  useEffect(() => { penColorRef.current = penColor; }, [penColor]);
  useEffect(() => { isEraserRef.current = isEraser; }, [isEraser]);
  useEffect(() => { questionIdRef.current = questionId; }, [questionId]);

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
    redrawAll(ctx, canvas, strokes);
  }, []);

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
    redrawAll(ctx, canvas, strokes);
  }, [questionId]);

  // ── Pointer events ───────────────────────────────────────────────────────

  const getPos = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const handlePointerDown = useCallback((e) => {
    if (!isActive) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    isPointerDown.current = true;
    const pos = getPos(e);
    const eraser = isEraserRef.current;
    currentStroke.current = {
      color: eraser ? 'rgba(0,0,0,1)' : penColorRef.current,
      size: eraser ? ERASER_SIZE : PEN_SIZE,
      eraser,
      points: [pos],
    };
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    applyStroke(ctx, currentStroke.current);
  }, [isActive]);

  const handlePointerMove = useCallback((e) => {
    if (!isPointerDown.current || !isActive) return;
    e.preventDefault();
    const pos = getPos(e);
    const stroke = currentStroke.current;
    stroke.points.push(pos);

    // Incremental draw of just the newest segment (fast)
    const pts = stroke.points;
    const n = pts.length;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.save();
    ctx.globalCompositeOperation = stroke.eraser ? 'destination-out' : 'source-over';
    ctx.strokeStyle = stroke.color;
    ctx.lineWidth = stroke.size;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(pts[n - 2].x, pts[n - 2].y);
    ctx.lineTo(pts[n - 1].x, pts[n - 1].y);
    ctx.stroke();
    ctx.restore();
  }, [isActive]);

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

  // ── Clear ────────────────────────────────────────────────────────────────

  const handleClear = () => {
    strokesMap.current.delete(questionId);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  // ── Cursor ───────────────────────────────────────────────────────────────

  const cursor = !isActive ? 'default'
    : isEraser ? `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='${ERASER_SIZE}' height='${ERASER_SIZE}'%3E%3Ccircle cx='${ERASER_SIZE/2}' cy='${ERASER_SIZE/2}' r='${ERASER_SIZE/2-1}' fill='white' stroke='%23555' stroke-width='1.5'/%3E%3C/svg%3E") ${ERASER_SIZE/2} ${ERASER_SIZE/2}, cell`
    : 'crosshair';

  return (
    <>
      {/* Full-page canvas overlay */}
      <canvas
        ref={canvasRef}
        className="fixed z-20"
        style={{
          top: 56,      // below h-14 header
          left: 0,
          right: 0,
          bottom: 0,
          width: '100%',
          height: 'calc(100vh - 56px)',
          pointerEvents: isActive ? 'all' : 'none',
          touchAction: 'none',
          cursor,
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
      />

      {/* Floating toolbar — only shown when draw mode is active */}
      {isActive && (
        <div
          className="fixed z-30 flex items-center gap-1.5 px-3 py-2 bg-white dark:bg-gray-800 rounded-full shadow-lg border border-gray-200 dark:border-gray-600"
          style={{ top: 66, right: 16 }}
        >
          {/* Color swatches */}
          {COLORS.map(({ value, label }) => (
            <button
              key={value}
              title={label}
              onClick={() => { setPenColor(value); setIsEraser(false); }}
              className="w-5 h-5 rounded-full transition-transform hover:scale-110 focus:outline-none"
              style={{
                backgroundColor: value,
                outline: !isEraser && penColor === value ? '2px solid #6b7280' : '2px solid transparent',
                outlineOffset: 2,
              }}
            />
          ))}

          {/* Divider */}
          <div className="w-px h-5 bg-gray-200 dark:bg-gray-600 mx-0.5" />

          {/* Eraser */}
          <button
            title="Eraser"
            onClick={() => setIsEraser(!isEraser)}
            className={`p-1 rounded-lg transition-colors ${
              isEraser
                ? 'bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900'
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
          >
            <Eraser className="h-4 w-4" />
          </button>

          {/* Clear */}
          <button
            title="Clear all drawings"
            onClick={handleClear}
            className="p-1 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
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
