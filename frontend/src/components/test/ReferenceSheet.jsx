/**
 * Reference Sheet Component
 * Floating, draggable window showing SAT Math reference formulas
 * Uses Unicode math symbols for clean rendering
 */
import { useState, useEffect, useCallback } from 'react';
import { X, GripHorizontal } from 'lucide-react';

const ReferenceSheet = ({
  isOpen,
  onClose,
  initialPosition = { x: 100, y: 100 },
}) => {
  const [position, setPosition] = useState(initialPosition);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  // Dragging handlers
  const handleMouseDown = useCallback((e) => {
    if (e.target.closest('.ref-header')) {
      setIsDragging(true);
      setDragOffset({
        x: e.clientX - position.x,
        y: e.clientY - position.y,
      });
    }
  }, [position]);

  const handleMouseMove = useCallback((e) => {
    if (isDragging) {
      setPosition({
        x: Math.max(0, e.clientX - dragOffset.x),
        y: Math.max(0, e.clientY - dragOffset.y),
      });
    }
  }, [isDragging, dragOffset]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  if (!isOpen) return null;

  // Math formula component for consistent styling
  const Formula = ({ children }) => (
    <span className="font-serif text-lg tracking-wide">{children}</span>
  );

  return (
    <div
      className="fixed z-50 bg-white rounded-lg shadow-2xl border border-gray-200 overflow-hidden"
      style={{
        left: position.x,
        top: position.y,
        width: 420,
        maxHeight: '85vh',
      }}
      onMouseDown={handleMouseDown}
    >
      {/* Header */}
      <div className="ref-header flex items-center justify-between px-3 py-2 bg-gray-100 border-b border-gray-200 cursor-move select-none">
        <div className="flex items-center gap-2">
          <GripHorizontal className="h-4 w-4 text-gray-400" />
          <span className="text-sm font-medium text-gray-700">Reference Sheet</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={onClose}
            className="p-1 text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="p-5 overflow-y-auto" style={{ maxHeight: 'calc(85vh - 50px)' }}>
        {/* Circle and Rectangle */}
        <div className="grid grid-cols-2 gap-6 mb-6">
          {/* Circle */}
          <div className="text-center">
            <svg viewBox="0 0 100 100" className="w-20 h-20 mx-auto mb-2">
              <circle cx="50" cy="50" r="35" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-700" />
              <circle cx="50" cy="50" r="3" fill="currentColor" className="text-gray-700" />
              <line x1="50" y1="50" x2="85" y2="50" stroke="currentColor" strokeWidth="1.5" className="text-gray-700" />
              <text x="68" y="45" fontSize="14" fontStyle="italic" className="text-gray-600">r</text>
            </svg>
            <div className="text-gray-800 space-y-1">
              <p><Formula><em>A</em> = <em>πr</em><sup>2</sup></Formula></p>
              <p><Formula><em>C</em> = 2<em>πr</em></Formula></p>
            </div>
          </div>

          {/* Rectangle */}
          <div className="text-center">
            <svg viewBox="0 0 100 80" className="w-20 h-16 mx-auto mb-2">
              <rect x="15" y="15" width="70" height="45" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-700" />
              <text x="50" y="10" fontSize="14" fontStyle="italic" textAnchor="middle" className="text-gray-600">ℓ</text>
              <text x="92" y="42" fontSize="14" fontStyle="italic" className="text-gray-600">w</text>
            </svg>
            <div className="text-gray-800">
              <p><Formula><em>A</em> = <em>ℓw</em></Formula></p>
            </div>
          </div>
        </div>

        {/* Triangle and Right Triangle */}
        <div className="grid grid-cols-2 gap-6 mb-6">
          {/* Triangle */}
          <div className="text-center">
            <svg viewBox="0 0 100 90" className="w-20 h-18 mx-auto mb-2">
              <polygon points="50,10 15,70 85,70" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-700" />
              <line x1="50" y1="10" x2="50" y2="70" stroke="currentColor" strokeWidth="1" strokeDasharray="3,3" className="text-gray-500" />
              <text x="55" y="45" fontSize="14" fontStyle="italic" className="text-gray-600">h</text>
              <text x="50" y="85" fontSize="14" fontStyle="italic" textAnchor="middle" className="text-gray-600">b</text>
            </svg>
            <div className="text-gray-800">
              <p><Formula><em>A</em> = <sup>1</sup>⁄<sub>2</sub><em>bh</em></Formula></p>
            </div>
          </div>

          {/* Right Triangle - Pythagorean */}
          <div className="text-center">
            <svg viewBox="0 0 100 90" className="w-20 h-18 mx-auto mb-2">
              <polygon points="15,70 85,70 85,15" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-700" />
              <rect x="78" y="63" width="7" height="7" fill="none" stroke="currentColor" strokeWidth="1" className="text-gray-500" />
              <text x="50" y="85" fontSize="14" fontStyle="italic" textAnchor="middle" className="text-gray-600">a</text>
              <text x="92" y="45" fontSize="14" fontStyle="italic" className="text-gray-600">b</text>
              <text x="42" y="38" fontSize="14" fontStyle="italic" className="text-gray-600">c</text>
            </svg>
            <div className="text-gray-800">
              <p><Formula><em>c</em><sup>2</sup> = <em>a</em><sup>2</sup> + <em>b</em><sup>2</sup></Formula></p>
            </div>
          </div>
        </div>

        {/* Special Right Triangles */}
        <div className="mb-6">
          <h3 className="text-sm font-semibold text-center mb-3 text-gray-700 uppercase tracking-wide">Special Right Triangles</h3>
          <div className="grid grid-cols-2 gap-6">
            {/* 30-60-90 triangle */}
            <div className="text-center">
              <svg viewBox="0 0 130 110" className="w-32 h-28 mx-auto">
                <polygon points="20,85 110,85 20,25" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-700" />
                <rect x="20" y="78" width="7" height="7" fill="none" stroke="currentColor" strokeWidth="1" className="text-gray-500" />
                <text x="8" y="58" fontSize="12" fontStyle="italic" className="text-gray-700">x</text>
                <text x="21" y="45" fontSize="10" className="text-gray-600">60°</text>
                <text x="55" y="45" fontSize="12" fontStyle="italic" className="text-gray-700">2x</text>
                <text x="72" y="80" fontSize="10" className="text-gray-600">30°</text>
                <text x="65" y="100" fontSize="12" fontStyle="italic" textAnchor="middle" className="text-gray-700">x√3</text>
              </svg>
            </div>

            {/* 45-45-90 triangle */}
            <div className="text-center">
              <svg viewBox="0 0 130 110" className="w-32 h-28 mx-auto">
                <polygon points="20,85 105,85 105,20" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-700" />
                <rect x="98" y="78" width="7" height="7" fill="none" stroke="currentColor" strokeWidth="1" className="text-gray-500" />
                <text x="35" y="80" fontSize="10" className="text-gray-600">45°</text>
                <text x="50" y="42" fontSize="12" fontStyle="italic" className="text-gray-700">s√2</text>
                <text x="85" y="42" fontSize="10" className="text-gray-600">45°</text>
                <text x="112" y="55" fontSize="12" fontStyle="italic" className="text-gray-700">s</text>
                <text x="62" y="100" fontSize="12" fontStyle="italic" textAnchor="middle" className="text-gray-700">s</text>
              </svg>
            </div>
          </div>
        </div>

        {/* Volume Formulas */}
        <div className="mb-4">
          <h3 className="text-sm font-semibold text-center mb-3 text-gray-700 uppercase tracking-wide">Volume Formulas</h3>
          <div className="space-y-2">
            <div className="flex justify-between items-center px-4 py-2.5 bg-gray-50 rounded-lg">
              <span className="text-gray-600">Rectangular Prism</span>
              <Formula><em>V</em> = <em>ℓwh</em></Formula>
            </div>
            <div className="flex justify-between items-center px-4 py-2.5 bg-gray-50 rounded-lg">
              <span className="text-gray-600">Cylinder</span>
              <Formula><em>V</em> = <em>πr</em><sup>2</sup><em>h</em></Formula>
            </div>
            <div className="flex justify-between items-center px-4 py-2.5 bg-gray-50 rounded-lg">
              <span className="text-gray-600">Sphere</span>
              <Formula><em>V</em> = <sup>4</sup>⁄<sub>3</sub><em>πr</em><sup>3</sup></Formula>
            </div>
            <div className="flex justify-between items-center px-4 py-2.5 bg-gray-50 rounded-lg">
              <span className="text-gray-600">Cone</span>
              <Formula><em>V</em> = <sup>1</sup>⁄<sub>3</sub><em>πr</em><sup>2</sup><em>h</em></Formula>
            </div>
            <div className="flex justify-between items-center px-4 py-2.5 bg-gray-50 rounded-lg">
              <span className="text-gray-600">Pyramid</span>
              <Formula><em>V</em> = <sup>1</sup>⁄<sub>3</sub><em>Bh</em></Formula>
            </div>
          </div>
        </div>

        {/* Additional Info */}
        <div className="text-sm text-gray-600 text-center border-t border-gray-200 pt-4 space-y-1">
          <p>The number of degrees in a circle is <strong>360</strong>.</p>
          <p>The number of radians in a circle is <strong>2π</strong>.</p>
          <p>The sum of angles in a triangle is <strong>180°</strong>.</p>
        </div>
      </div>
    </div>
  );
};

export default ReferenceSheet;
