// frontend/src/components/test/QuestionFrame.jsx
import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { FRAME_W, frameScale } from '../../utils/frameCoords';

/**
 * Canonical fixed-size "page" for question content. Renders a FRAME_W-wide inner
 * element scaled uniformly to fit the available width, so content lays out
 * identically on every device. The child is a render function receiving
 * { scale, frameRef } — the drawing layer is rendered inside the same scaled
 * frame (as a sibling of content) so ink and content scale/scroll in lockstep.
 *
 * The outer wrapper reserves the scaled height so surrounding page flow is right.
 */
export default function QuestionFrame({ children, className = '' }) {
  const wrapRef = useRef(null);
  const frameRef = useRef(null);
  const [scale, setScale] = useState(1);
  const [frameHeight, setFrameHeight] = useState(0);

  const measure = useCallback((entries) => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    // Prefer the observed contentRect width (reliable under ResizeObserver,
    // and the only source of layout width in jsdom); fall back to clientWidth.
    const observedWidth = entries && entries[0] && entries[0].contentRect
      ? entries[0].contentRect.width
      : 0;
    setScale(frameScale(observedWidth || wrap.clientWidth));
  }, []);

  useLayoutEffect(() => {
    measure();
    const ro = new ResizeObserver(measure);
    if (wrapRef.current) ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, [measure]);

  // Reserve scaled height (natural content height * scale) so the page reserves
  // the right vertical space for the transformed element.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    setFrameHeight(frame.offsetHeight * scale);
  });

  return (
    <div ref={wrapRef} className={`relative w-full flex justify-center ${className}`}>
      <div style={{ height: frameHeight || undefined }}>
        <div
          ref={frameRef}
          data-frame="true"
          style={{
            width: `${FRAME_W}px`,
            transform: `scale(${scale})`,
            transformOrigin: 'top center',
            position: 'relative',
          }}
        >
          {typeof children === 'function' ? children({ scale, frameRef }) : children}
        </div>
      </div>
    </div>
  );
}
