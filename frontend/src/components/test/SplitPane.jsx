/**
 * Split Pane Component
 * Draggable divider between left (passage) and right (question) panels
 * Responsive: stacks vertically on mobile
 */
import { useState, useCallback, useEffect, useRef } from 'react';

const SplitPane = ({
  left,
  right,
  defaultSplit = 50,
  minLeft = 20,
  minRight = 30,
  className = '',
}) => {
  const [splitPercent, setSplitPercent] = useState(defaultSplit);
  const [isDragging, setIsDragging] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [mobileView, setMobileView] = useState('question'); // 'passage' or 'question'
  const containerRef = useRef(null);

  // Check for mobile viewport
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const handleMouseDown = useCallback((e) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleMouseMove = useCallback((e) => {
    if (!isDragging || !containerRef.current) return;

    const container = containerRef.current;
    const rect = container.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percent = (x / rect.width) * 100;

    // Clamp to min/max
    const clamped = Math.max(minLeft, Math.min(100 - minRight, percent));
    setSplitPercent(clamped);
  }, [isDragging, minLeft, minRight]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Keyboard resize: arrow keys nudge, Home/End jump to bounds.
  const handleDividerKeyDown = useCallback((e) => {
    const STEP = 2;
    let next = null;
    switch (e.key) {
      case 'ArrowLeft': next = splitPercent - STEP; break;
      case 'ArrowRight': next = splitPercent + STEP; break;
      case 'Home': next = minLeft; break;
      case 'End': next = 100 - minRight; break;
      default: return;
    }
    e.preventDefault();
    setSplitPercent(Math.max(minLeft, Math.min(100 - minRight, next)));
  }, [splitPercent, minLeft, minRight]);

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      // Prevent text selection while dragging
      document.body.style.userSelect = 'none';
      document.body.style.cursor = 'col-resize';

      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        document.body.style.userSelect = '';
        document.body.style.cursor = '';
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  // Mobile layout - tabbed view
  if (isMobile) {
    return (
      <div className={`flex flex-col h-full ${className}`}>
        {/* Toggle tabs */}
        <div role="tablist" aria-label="View" className="flex border-b border-edge bg-surface-muted flex-shrink-0">
          <button
            role="tab"
            aria-selected={mobileView === 'passage'}
            onClick={() => setMobileView('passage')}
            className={`flex-1 py-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${
              mobileView === 'passage'
                ? 'text-ink-body border-b-2 border-brand-500 bg-surface-card'
                : 'text-ink-subtle hover:text-ink-body'
            }`}
          >
            Passage
          </button>
          <button
            role="tab"
            aria-selected={mobileView === 'question'}
            onClick={() => setMobileView('question')}
            className={`flex-1 py-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${
              mobileView === 'question'
                ? 'text-ink-body border-b-2 border-brand-500 bg-surface-card'
                : 'text-ink-subtle hover:text-ink-body'
            }`}
          >
            Question
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          {mobileView === 'passage' ? left : right}
        </div>
      </div>
    );
  }

  // Desktop layout - side by side
  return (
    <div
      ref={containerRef}
      className={`flex h-full ${className}`}
    >
      {/* Left panel - overflow-hidden so content handles its own scroll */}
      <div
        className="overflow-hidden h-full"
        style={{ width: `${splitPercent}%` }}
      >
        {left}
      </div>

      {/* Divider — keyboard-operable separator */}
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize passage and question panels"
        aria-valuenow={Math.round(splitPercent)}
        aria-valuemin={minLeft}
        aria-valuemax={100 - minRight}
        tabIndex={0}
        className={`
          w-1 bg-edge cursor-col-resize
          hover:bg-edge-strong active:bg-brand-500
          transition-colors flex-shrink-0
          relative group
          focus-visible:outline-none focus-visible:bg-brand-500 focus-visible:w-1.5
        `}
        onMouseDown={handleMouseDown}
        onKeyDown={handleDividerKeyDown}
      >
        {/* Visual indicator */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1 h-8 bg-ink-faint rounded-full opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 transition-opacity" />
      </div>

      {/* Right panel - overflow-hidden so content handles its own scroll */}
      <div
        className="overflow-hidden h-full"
        style={{ width: `${100 - splitPercent}%` }}
      >
        {right}
      </div>
    </div>
  );
};

export default SplitPane;
