/**
 * HighlightableText
 * Wraps rendered HTML content and intercepts text selections to show a
 * highlight / underline toolbar. Highlights persist per questionId for the
 * lifetime of the page (stored in a module-level Map so they survive
 * React unmounts and question navigation).
 *
 * Props:
 *   html         - raw HTML string to render
 *   questionId   - key used to store/restore highlights
 *   className    - extra classes forwarded to the content div
 *   contentRef   - optional ref forwarded to the inner content element
 *                  (QuestionDisplay uses this for MathJax)
 */
import { useState, useRef, useEffect, useCallback, forwardRef } from 'react';
import { Underline, Trash2 } from 'lucide-react';

// ── Color palette ─────────────────────────────────────────────────────────────
const COLORS = [
  { id: 'yellow', bg: '#fde68a', ring: '#f59e0b' },
  { id: 'blue',   bg: '#bae6fd', ring: '#38bdf8' },
  { id: 'pink',   bg: '#fbcfe8', ring: '#f472b6' },
];

// Module-level persistence: highlights survive React unmounts / question changes
const highlightsMap = new Map(); // questionId → modified innerHTML

// ── Floating Toolbar ─────────────────────────────────────────────────────────

const HighlightToolbar = forwardRef(function HighlightToolbar(
  { x, y, isExistingMark, onHighlight, onUnderline, onRemove, onClose },
  ref
) {
  // Prevent the mousedown that opens the toolbar from immediately closing it
  const handleMouseDown = (e) => e.preventDefault();

  return (
    <div
      ref={ref}
      onMouseDown={handleMouseDown}
      className="fixed z-[60] flex items-center gap-1 px-2.5 py-2 bg-white rounded-full shadow-xl border border-slate-100"
      style={{
        left: x,
        top: y - 8,
        transform: 'translateX(-50%) translateY(-100%)',
        whiteSpace: 'nowrap',
      }}
    >
      {/* Color swatches */}
      {COLORS.map(({ id, bg, ring }) => (
        <button
          key={id}
          title={`Highlight ${id}`}
          onClick={() => onHighlight(id)}
          className="w-7 h-7 rounded-full transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-offset-1"
          style={{ backgroundColor: bg, '--tw-ring-color': ring }}
        />
      ))}

      {/* Divider */}
      <div className="w-px h-5 bg-slate-200 mx-0.5" />

      {/* Underline — only for new selections */}
      {!isExistingMark && (
        <button
          title="Underline"
          onClick={onUnderline}
          className="p-1.5 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
        >
          <Underline className="h-4 w-4" />
        </button>
      )}

      {/* Remove highlight — only for existing marks */}
      {isExistingMark && (
        <button
          title="Remove highlight"
          onClick={onRemove}
          className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      )}
    </div>
  );
});

// ── Main component ────────────────────────────────────────────────────────────

const HighlightableText = ({ html, questionId, className = '', contentRef: externalContentRef, onAfterSave }) => {
  const containerRef = useRef(null);
  const toolbarRef = useRef(null);
  const internalContentRef = useRef(null);
  const contentRef = externalContentRef || internalContentRef;

  const [displayHtml, setDisplayHtml] = useState(() => highlightsMap.get(questionId) ?? html);
  const [toolbar, setToolbar] = useState(null);
  // toolbar shape: { x, y, range: Range|null, markEl: Element|null }

  // ── Restore stored highlights when question changes ───────────────────────
  useEffect(() => {
    setDisplayHtml(highlightsMap.get(questionId) ?? html);
  }, [questionId, html]);

  // ── Dismiss toolbar on outside click ─────────────────────────────────────
  useEffect(() => {
    if (!toolbar) return;
    const onDown = (e) => {
      if (toolbarRef.current?.contains(e.target)) return;
      setToolbar(null);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [toolbar]);

  // ── Persist modified innerHTML to module-level map ────────────────────────
  const save = useCallback(() => {
    const el = contentRef.current;
    if (!el) return;
    highlightsMap.set(questionId, el.innerHTML);
    setDisplayHtml(el.innerHTML);
    onAfterSave?.();
  }, [questionId, contentRef, onAfterSave]);

  // ── Detect text selection ─────────────────────────────────────────────────
  const handleMouseUp = useCallback(() => {
    requestAnimationFrame(() => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || !sel.toString().trim()) return;

      const range = sel.getRangeAt(0);
      const container = containerRef.current;
      if (!container?.contains(range.commonAncestorContainer)) return;

      const rect = range.getBoundingClientRect();
      if (!rect.width) return;

      // Clamp x so toolbar stays within viewport
      const clampedX = Math.min(
        Math.max(rect.left + rect.width / 2, 130),
        window.innerWidth - 130
      );

      setToolbar({ x: clampedX, y: rect.top, range: range.cloneRange(), markEl: null });
    });
  }, []);

  // ── Click on existing highlight mark ─────────────────────────────────────
  const handleClick = useCallback((e) => {
    const mark = e.target.closest('mark[data-hl]');
    if (!mark) return;
    const sel = window.getSelection();
    if (sel && !sel.isCollapsed) return; // let mouseup handle new selections

    const rect = mark.getBoundingClientRect();
    const clampedX = Math.min(
      Math.max(rect.left + rect.width / 2, 130),
      window.innerWidth - 130
    );
    setToolbar({ x: clampedX, y: rect.top, range: null, markEl: mark });
  }, []);

  // ── Apply highlight color ─────────────────────────────────────────────────
  const applyHighlight = useCallback((colorId) => {
    if (toolbar?.markEl) {
      // Change color of existing mark
      const el = toolbar.markEl;
      el.setAttribute('data-hl', colorId);
      el.className = `text-hl text-hl-${colorId}`;
      save();
      setToolbar(null);
      return;
    }
    if (!toolbar?.range) return;

    const mark = document.createElement('mark');
    mark.setAttribute('data-hl', colorId);
    mark.className = `text-hl text-hl-${colorId}`;

    try {
      toolbar.range.surroundContents(mark);
    } catch {
      // Selection spans multiple elements — extractContents is more robust
      const frag = toolbar.range.extractContents();
      mark.appendChild(frag);
      toolbar.range.insertNode(mark);
    }

    window.getSelection()?.removeAllRanges();
    save();
    setToolbar(null);
  }, [toolbar, save]);

  // ── Apply underline ───────────────────────────────────────────────────────
  const applyUnderline = useCallback(() => {
    if (!toolbar?.range) return;

    const span = document.createElement('span');
    span.className = 'text-underline-mark';

    try {
      toolbar.range.surroundContents(span);
    } catch {
      const frag = toolbar.range.extractContents();
      span.appendChild(frag);
      toolbar.range.insertNode(span);
    }

    window.getSelection()?.removeAllRanges();
    save();
    setToolbar(null);
  }, [toolbar, save]);

  // ── Remove highlight ──────────────────────────────────────────────────────
  const removeHighlight = useCallback(() => {
    const el = toolbar?.markEl;
    if (!el) return;
    const parent = el.parentNode;
    while (el.firstChild) parent.insertBefore(el.firstChild, el);
    parent.removeChild(el);
    parent.normalize();
    save();
    setToolbar(null);
  }, [toolbar, save]);

  return (
    <div ref={containerRef} onMouseUp={handleMouseUp} onClick={handleClick}>
      <div
        ref={contentRef}
        className={`prose prose-gray dark:prose-invert max-w-none question-content ${className}`}
        dangerouslySetInnerHTML={{ __html: displayHtml }}
      />
      {toolbar && (
        <HighlightToolbar
          ref={toolbarRef}
          x={toolbar.x}
          y={toolbar.y}
          isExistingMark={!!toolbar.markEl}
          onHighlight={applyHighlight}
          onUnderline={applyUnderline}
          onRemove={removeHighlight}
          onClose={() => setToolbar(null)}
        />
      )}
    </div>
  );
};

export default HighlightableText;
