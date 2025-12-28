/**
 * Split Pane Component
 * Draggable divider between left (passage) and right (question) panels
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
  const containerRef = useRef(null);

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

  return (
    <div
      ref={containerRef}
      className={`flex h-full ${className}`}
    >
      {/* Left panel */}
      <div
        className="overflow-auto"
        style={{ width: `${splitPercent}%` }}
      >
        {left}
      </div>

      {/* Divider */}
      <div
        className={`
          w-1 bg-gray-200 cursor-col-resize
          hover:bg-gray-300 active:bg-gray-400
          transition-colors flex-shrink-0
          relative group
        `}
        onMouseDown={handleMouseDown}
      >
        {/* Visual indicator */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1 h-8 bg-gray-400 rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>

      {/* Right panel */}
      <div
        className="overflow-auto"
        style={{ width: `${100 - splitPercent}%` }}
      >
        {right}
      </div>
    </div>
  );
};

export default SplitPane;
