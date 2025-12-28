/**
 * Desmos Calculator Component
 * Floating, draggable, resizable window with graphing and scientific tabs
 * Uses Desmos API for calculator functionality
 * State persists when switching between tabs
 */
import { useState, useRef, useEffect, useCallback } from 'react';
import { X, Minimize2, Maximize2, GripHorizontal } from 'lucide-react';

const DesmosCalculator = ({
  isOpen,
  onClose,
  initialPosition = { x: 100, y: 100 },
  initialSize = { width: 434, height: 666 },
}) => {
  const [activeTab, setActiveTab] = useState('graphing');
  const [position, setPosition] = useState(initialPosition);
  const [size, setSize] = useState(initialSize);
  const [isMinimized, setIsMinimized] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  const containerRef = useRef(null);
  const graphingRef = useRef(null);
  const scientificRef = useRef(null);
  const graphingCalcRef = useRef(null);
  const scientificCalcRef = useRef(null);
  const initializingRef = useRef({ graphing: false, scientific: false });

  const [desmosLoaded, setDesmosLoaded] = useState(!!window.Desmos);
  const [hasBeenOpened, setHasBeenOpened] = useState(false);

  // Track when calculator is first opened
  useEffect(() => {
    if (isOpen && !hasBeenOpened) {
      setHasBeenOpened(true);
    }
  }, [isOpen, hasBeenOpened]);

  // Load Desmos API
  useEffect(() => {
    if (window.Desmos) {
      setDesmosLoaded(true);
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://www.desmos.com/api/v1.11/calculator.js?apiKey=dcb31709b452b1cf9dc26972add0fda6';
    script.async = true;
    script.onload = () => setDesmosLoaded(true);
    document.head.appendChild(script);
  }, []);

  // Initialize graphing calculator only when opened for the first time
  // This ensures the container is visible and properly sized
  useEffect(() => {
    if (!desmosLoaded || !window.Desmos) return;
    if (!hasBeenOpened) return; // Wait until first open
    if (graphingCalcRef.current || initializingRef.current.graphing) return;

    initializingRef.current.graphing = true;

    const timer = setTimeout(() => {
      try {
        if (graphingRef.current && !graphingCalcRef.current) {
          graphingCalcRef.current = window.Desmos.GraphingCalculator(graphingRef.current, {
            expressions: true,
            settingsMenu: true,
            zoomButtons: true,
            expressionsTopbar: true,
            pointsOfInterest: true,
            trace: true,
            // Enable regression features for tables
            regressionTemplates: true,
            customRegressions: true,
          });
        }
      } catch (err) {
        console.warn('Desmos graphing calculator error:', err);
      }
      initializingRef.current.graphing = false;
    }, 100);

    return () => clearTimeout(timer);
  }, [desmosLoaded, hasBeenOpened]);

  // Initialize scientific calculator only when opened for the first time
  useEffect(() => {
    if (!desmosLoaded || !window.Desmos) return;
    if (!hasBeenOpened) return; // Wait until first open
    if (scientificCalcRef.current || initializingRef.current.scientific) return;

    initializingRef.current.scientific = true;

    const timer = setTimeout(() => {
      try {
        if (scientificRef.current && !scientificCalcRef.current) {
          scientificCalcRef.current = window.Desmos.ScientificCalculator(scientificRef.current);
        }
      } catch (err) {
        console.warn('Desmos scientific calculator error:', err);
      }
      initializingRef.current.scientific = false;
    }, 100);

    return () => clearTimeout(timer);
  }, [desmosLoaded, hasBeenOpened]);

  // Cleanup calculators on unmount
  useEffect(() => {
    return () => {
      if (graphingCalcRef.current) {
        graphingCalcRef.current.destroy();
        graphingCalcRef.current = null;
      }
      if (scientificCalcRef.current) {
        scientificCalcRef.current.destroy();
        scientificCalcRef.current = null;
      }
    };
  }, []);

  // Force Desmos to resize when calculator becomes visible
  // This fixes blank calculator issues - use multiple resize calls for reliability
  useEffect(() => {
    if (isOpen && graphingCalcRef.current) {
      // Multiple resize calls with increasing delays to ensure rendering
      const timers = [50, 150, 300].map(delay =>
        setTimeout(() => {
          if (graphingCalcRef.current) {
            graphingCalcRef.current.resize();
          }
        }, delay)
      );
      return () => timers.forEach(clearTimeout);
    }
  }, [isOpen]);

  // Dragging handlers
  const handleMouseDown = useCallback((e) => {
    if (e.target.closest('.calc-header')) {
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
    if (isResizing) {
      const newWidth = Math.max(300, e.clientX - position.x);
      const newHeight = Math.max(300, e.clientY - position.y);
      setSize({ width: newWidth, height: newHeight });
    }
  }, [isDragging, isResizing, dragOffset, position]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    setIsResizing(false);
  }, []);

  useEffect(() => {
    if (isDragging || isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, isResizing, handleMouseMove, handleMouseUp]);

  // Keep component mounted but hidden to preserve calculator state
  // Use position offscreen instead of visibility:hidden so Desmos can render
  return (
    <div
      ref={containerRef}
      className={`fixed z-50 bg-white rounded-lg shadow-2xl border border-gray-200 overflow-hidden transition-opacity duration-150 ${
        isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
      }`}
      style={{
        left: isOpen ? position.x : -9999,
        top: isOpen ? position.y : -9999,
        width: isMinimized ? 300 : size.width,
        height: isMinimized ? 'auto' : size.height,
      }}
      onMouseDown={handleMouseDown}
    >
      {/* Header */}
      <div className="calc-header flex items-center justify-between px-3 py-2 bg-gray-100 border-b border-gray-200 cursor-move select-none">
        <div className="flex items-center gap-2">
          <GripHorizontal className="h-4 w-4 text-gray-400" />
          <span className="text-sm font-medium text-gray-700">Calculator</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setIsMinimized(!isMinimized)}
            className="p-1 text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded"
          >
            {isMinimized ? (
              <Maximize2 className="h-4 w-4" />
            ) : (
              <Minimize2 className="h-4 w-4" />
            )}
          </button>
          <button
            onClick={onClose}
            className="p-1 text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {!isMinimized && (
        <>
          {/* Tabs */}
          <div className="flex border-b border-gray-200">
            <button
              onClick={() => setActiveTab('graphing')}
              className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === 'graphing'
                  ? 'text-gray-900 border-b-2 border-gray-900'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Graphing
            </button>
            <button
              onClick={() => setActiveTab('scientific')}
              className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === 'scientific'
                  ? 'text-gray-900 border-b-2 border-gray-900'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Scientific
            </button>
          </div>

          {/* Calculator containers - both rendered, visibility toggled */}
          <div style={{ height: size.height - 90 }}>
            <div
              ref={graphingRef}
              className="w-full h-full"
              style={{ display: activeTab === 'graphing' ? 'block' : 'none' }}
            />
            <div
              ref={scientificRef}
              className="w-full h-full"
              style={{ display: activeTab === 'scientific' ? 'block' : 'none' }}
            />
          </div>

          {/* Resize handle - larger and more visible */}
          <div
            className="absolute bottom-0 right-0 w-6 h-6 cursor-se-resize flex items-center justify-center bg-gray-100 hover:bg-gray-200 rounded-tl transition-colors"
            onMouseDown={(e) => {
              e.stopPropagation();
              setIsResizing(true);
            }}
          >
            <svg
              className="w-4 h-4 text-gray-500"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path d="M22 22H20V20H22V22ZM22 18H18V22H22V18ZM18 22H14V20H18V22ZM22 14H20V18H22V14ZM14 22H10V20H14V22Z" />
            </svg>
          </div>
        </>
      )}
    </div>
  );
};

export default DesmosCalculator;
