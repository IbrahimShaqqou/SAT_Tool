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
        <div className="flex border-b border-gray-200 bg-gray-50 flex-shrink-0">
          <button
            onClick={() => setMobileView('passage')}
            className={`flex-1 py-3 text-sm font-medium transition-colors ${
              mobileView === 'passage'
                ? 'text-gray-900 border-b-2 border-gray-900 bg-white'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Passage
          </button>
          <button
            onClick={() => setMobileView('question')}
            className={`flex-1 py-3 text-sm font-medium transition-colors ${
              mobileView === 'question'
                ? 'text-gray-900 border-b-2 border-gray-900 bg-white'
                : 'text-gray-500 hover:text-gray-700'
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
