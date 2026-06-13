/**
 * DesmosGraph — embedded read-only Desmos graph for step-by-step explanations.
 *
 * Props:
 *   equations  — string[] of Desmos-compatible equations (x and y only)
 *   x_min, x_max, y_min, y_max — viewport bounds (optional, auto-computed if omitted)
 *   hint       — string shown below graph (e.g. "Click the intersection point")
 */

import { useEffect, useRef } from 'react';
import computeBoundsFromEquations from '../../utils/computeBounds';
import { desmosScriptSrc } from '../../utils/desmos';

const DesmosGraph = ({ equations = [], x_min, x_max, y_min, y_max, hint }) => {
  const containerRef = useRef(null);
  const calcRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const init = () => {
      if (!window.Desmos || !containerRef.current) return;
      if (calcRef.current) return; // already initialized

      calcRef.current = window.Desmos.GraphingCalculator(containerRef.current, {
        expressions: false,
        settingsMenu: false,
        zoomButtons: true,
        expressionsTopbar: false,
        pointsOfInterest: true,
        trace: true,
        lockViewport: false,
      });

      equations.forEach((eq, i) => {
        // Handle table syntax: "table:x1,y1;x2,y2;x3,y3"
        if (eq.startsWith('table:')) {
          const rows = eq.slice(6).split(';').map(r => r.split(',').map(Number));
          const tableData = {
            id: `eq${i}`,
            type: 'table',
            columns: [
              { latex: 'x', values: rows.map(r => String(r[0])) },
              { latex: 'y', values: rows.map(r => String(r[1])) },
            ],
          };
          calcRef.current.setExpression(tableData);
        } else {
          calcRef.current.setExpression({ id: `eq${i}`, latex: eq });
        }
      });

      // Use provided bounds, falling back to auto-computed
      const autoBounds = computeBoundsFromEquations(equations);
      calcRef.current.setMathBounds({
        left:   x_min ?? autoBounds.left,
        right:  x_max ?? autoBounds.right,
        bottom: y_min ?? autoBounds.bottom,
        top:    y_max ?? autoBounds.top,
      });
    };

    if (window.Desmos) {
      init();
    } else {
      const existing = document.querySelector('script[data-desmos]');
      if (!existing) {
        const script = document.createElement('script');
        script.src = desmosScriptSrc();
        script.async = true;
        script.dataset.desmos = 'true';
        script.onload = init;
        document.body.appendChild(script);
      } else {
        existing.addEventListener('load', init);
      }
    }

    return () => {
      if (calcRef.current) {
        calcRef.current.destroy();
        calcRef.current = null;
      }
    };
  }, [equations, x_min, x_max, y_min, y_max]);

  return (
    <div className="my-3">
      <div
        ref={containerRef}
        style={{ width: '100%', height: '280px', borderRadius: '8px', overflow: 'hidden' }}
        className="border border-edge"
      />
      {hint && (
        <p className="mt-2 text-sm text-ink-subtle italic flex items-center gap-1">
          <span>👆</span> {hint}
        </p>
      )}
    </div>
  );
};

export default DesmosGraph;
