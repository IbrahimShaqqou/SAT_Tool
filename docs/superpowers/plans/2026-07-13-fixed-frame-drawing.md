# Fixed Content Frame + Per-Question Shared Drawing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make live drawing align exactly 1:1 between student and tutor on every device, and give each question its own saved/restored drawing, by rendering question content into one shared fixed-size `QuestionFrame` that scales uniformly, with the drawing canvas as a sibling layer inside that scaled frame.

**Architecture:** A canonical **820×1160 logical `QuestionFrame`** renders the question/passage/choices, scaled uniformly (`transform: scale`) to fit any container — so content lays out identically everywhere. The `SharedDrawingSurface` canvas is a sibling INSIDE the scaled frame, sized in logical units, so the browser scales content + ink in lockstep and scrolling moves them together (no per-point scale/scroll math — only pointer capture divides by scale). Strokes are stored per-question in logical units. Panels overlay above the frame instead of shifting it.

**Tech Stack:** React 18 / CRA, HTML5 Canvas, Jest + React Testing Library; FastAPI (unchanged transport). No DB. No new deps.

**Spec:** `docs/superpowers/specs/2026-07-13-fixed-frame-drawing-design.md`

**Conventions (must follow):**
- Frontend tests: `cd frontend && CI=true npx react-scripts test --watchAll=false --testPathPattern="X"` (NOT bare jest). Build gate: `CI=true npm run build`. Run all frontend commands from `frontend/`.
- Backend tests: `cd backend && python3 -m pytest ...` (NOT `python`).
- Any frontend test importing a module that transitively imports `./services/api` (axios) MUST `jest.mock` it — shared manual mocks exist: `frontend/src/services/__mocks__/api.js`, `frontend/src/hooks/__mocks__/useLiveSession.js`.
- Tailwind semantic tokens only: `text-ink-body/muted/subtle`, `brand-*`, `accent-*`, `rose-*`, `emerald-*`, `border-edge`, `bg-surface-card/muted/page`, `font-display`. No `text-ink`, `surface-soft`, `danger-*`.
- **NO git.** Leave changes in the working tree; skip every commit step.

---

## File Structure

**Frontend (new):**
- `src/utils/frameCoords.js` — fixed-frame constants + scale + viewport→logical conversion (replaces `liveCoords.js`).
- `src/components/test/QuestionFrame.jsx` — the scaling fixed-size page wrapper hosting content + a drawing-layer slot.

**Frontend (modified):**
- `src/utils/liveCoords.js` — DELETE (superseded by frameCoords). Update importers.
- `src/components/live/SharedDrawingSurface.jsx` — render logical-unit strokes on a logical-sized canvas inside the frame; logical dot grid.
- `src/hooks/useSharedDrawing.js` — per-question stroke map keyed by question_id.
- `src/components/test/liveHelpers.js` — add `question_id` to stroke_* message builders.
- `src/pages/student/AdaptivePracticePage.jsx`, `src/pages/student/TestPage.jsx`, `src/pages/student/PracticeTestTakingPage.jsx`, `src/components/test/ModuleTestInterface.jsx` — render question content through `QuestionFrame`; remove `mr-[440px]` shift; per-question drawing wiring.
- `src/pages/tutor/LiveSessionsPage.jsx` — tutor watch view renders through `QuestionFrame`; per-question.

**Backend (modified):**
- `backend/app/tests/test_live_api.py` — one relay test confirming `question_id` passes through (no code change to relay expected).

---

## Task 1: Fixed-frame coordinate module

**Files:**
- Create: `frontend/src/utils/frameCoords.js`
- Test: `frontend/src/utils/frameCoords.test.js`

Pure constants + conversion. A stroke point is `{x, y}` in logical frame units. The canvas is sized in logical units and lives inside the scaled frame, so rendering draws raw logical coords — only capture converts viewport pixels to logical by dividing by the frame scale.

- [ ] **Step 1: Write the failing test**

```javascript
// frontend/src/utils/frameCoords.test.js
import { FRAME_W, FRAME_H, MIN_SCALE, frameScale, toFramePoint } from './frameCoords';

test('constants are the canonical page dimensions', () => {
  expect(FRAME_W).toBe(820);
  expect(FRAME_H).toBe(1160);
  expect(MIN_SCALE).toBeGreaterThan(0);
  expect(MIN_SCALE).toBeLessThan(1);
});

test('frameScale scales to fit narrower containers', () => {
  expect(frameScale(410)).toBeCloseTo(0.5, 5);   // 410/820
  expect(frameScale(820)).toBeCloseTo(1, 5);
});

test('frameScale caps at 1 for large screens (no upscaling)', () => {
  expect(frameScale(2000)).toBe(1);
});

test('frameScale floors at MIN_SCALE for tiny screens', () => {
  expect(frameScale(10)).toBe(MIN_SCALE);
});

test('toFramePoint converts a viewport point to logical units by dividing by scale', () => {
  // canvas element rect is post-transform (scaled). At scale 0.5 a click 205px
  // into the scaled canvas is logical x=410.
  const rect = { left: 100, top: 50 };
  const p = toFramePoint(305, 150, rect, 0.5);
  expect(p.x).toBeCloseTo((305 - 100) / 0.5, 5); // 410
  expect(p.y).toBeCloseTo((150 - 50) / 0.5, 5);  // 200
});

test('toFramePoint at scale 1 is a straight offset', () => {
  const p = toFramePoint(500, 300, { left: 0, top: 0 }, 1);
  expect(p.x).toBeCloseTo(500, 5);
  expect(p.y).toBeCloseTo(300, 5);
});
```

- [ ] **Step 2: Run to verify failure**

Run: `cd frontend && CI=true npx react-scripts test --watchAll=false --testPathPattern="frameCoords"`
Expected: FAIL — Cannot find module './frameCoords'.

- [ ] **Step 3: Implement**

```javascript
// frontend/src/utils/frameCoords.js
/**
 * Fixed-frame coordinates for the shared drawing surface.
 *
 * Question content renders into a canonical logical page (FRAME_W x FRAME_H),
 * scaled uniformly to fit its container. The drawing canvas is a sibling INSIDE
 * that scaled frame, sized in logical units, so content + ink scale in lockstep
 * and scroll together. A stroke point is {x, y} in LOGICAL units (x in [0,FRAME_W],
 * y in [0, contentHeight]). Rendering draws raw logical coords onto the logical-
 * sized canvas; only pointer capture converts viewport px -> logical (÷ scale).
 */
export const FRAME_W = 820;
export const FRAME_H = 1160;
export const MIN_SCALE = 0.4;

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/** Uniform scale to fit the frame into a container of the given CSS width. */
export function frameScale(containerWidth) {
  if (!containerWidth || containerWidth <= 0) return MIN_SCALE;
  return clamp(containerWidth / FRAME_W, MIN_SCALE, 1);
}

/**
 * Viewport (clientX/clientY) -> logical frame units, given the canvas element's
 * (post-transform, scaled) bounding rect and the current frame scale.
 */
export function toFramePoint(clientX, clientY, canvasRect, scale) {
  const s = scale || 1;
  return {
    x: (clientX - canvasRect.left) / s,
    y: (clientY - canvasRect.top) / s,
  };
}
```

- [ ] **Step 4: Run to verify pass**

Run: `cd frontend && CI=true npx react-scripts test --watchAll=false --testPathPattern="frameCoords"`
Expected: PASS (6 passed)

- [ ] **Step 5: Commit** — SKIP (no git).

---

## Task 2: Stroke messages carry question_id

**Files:**
- Modify: `frontend/src/components/test/liveHelpers.js`
- Test: `frontend/src/components/test/strokeQuestionId.test.js`

Add `question_id` to `buildStrokeStart/Points/End/Undo/Clear` so the receiver can file strokes into the right per-question set. Keep `buildStrokesSync` (already has question_id) and all other exports unchanged.

- [ ] **Step 1: Write the failing test**

```javascript
// frontend/src/components/test/strokeQuestionId.test.js
import {
  buildStrokeStart, buildStrokePoints, buildStrokeEnd, buildStrokeUndo, buildStrokeClear,
} from './liveHelpers';

test('every stroke message carries question_id', () => {
  const q = 'q-42';
  expect(buildStrokeStart('s', 'tutor', { strokeId: 't-1', color: '#000', size: 3, eraser: false, point: { x: 1, y: 2 }, questionId: q }).payload.question_id).toBe(q);
  expect(buildStrokePoints('s', 'tutor', 't-1', [{ x: 3, y: 4 }], q).payload.question_id).toBe(q);
  expect(buildStrokeEnd('s', 'tutor', 't-1', q).payload.question_id).toBe(q);
  expect(buildStrokeUndo('s', 'tutor', 't-1', q).payload.question_id).toBe(q);
  expect(buildStrokeClear('s', 'tutor', q).payload.question_id).toBe(q);
});

test('stroke_start still carries the point and style', () => {
  const m = buildStrokeStart('s', 'student', { strokeId: 'x', color: '#111827', size: 3, eraser: false, point: { x: 10, y: 20 }, questionId: 'q1' });
  expect(m.type).toBe('stroke_start');
  expect(m.payload.point).toEqual({ x: 10, y: 20 });
  expect(m.payload.author).toBe('student');
});
```

- [ ] **Step 2: Run to verify failure**

Run: `cd frontend && CI=true npx react-scripts test --watchAll=false --testPathPattern="strokeQuestionId"`
Expected: FAIL — `question_id` undefined on payloads.

- [ ] **Step 3: Implement**

In `frontend/src/components/test/liveHelpers.js`, update the five builders (READ the file first to match the existing `envelope` helper). New signatures + payloads:

```javascript
export function buildStrokeStart(sessionId, author, opts) {
  return envelope('stroke_start', sessionId, author, {
    stroke_id: opts.strokeId,
    author,
    color: opts.color,
    size: opts.size,
    eraser: !!opts.eraser,
    point: opts.point,
    question_id: opts.questionId ?? null,
  });
}

export function buildStrokePoints(sessionId, author, strokeId, points, questionId) {
  return envelope('stroke_points', sessionId, author, { stroke_id: strokeId, points: points || [], question_id: questionId ?? null });
}

export function buildStrokeEnd(sessionId, author, strokeId, questionId) {
  return envelope('stroke_end', sessionId, author, { stroke_id: strokeId, question_id: questionId ?? null });
}

export function buildStrokeUndo(sessionId, author, strokeId, questionId) {
  return envelope('stroke_undo', sessionId, author, { author, stroke_id: strokeId, question_id: questionId ?? null });
}

export function buildStrokeClear(sessionId, author, questionId) {
  return envelope('stroke_clear', sessionId, author, { author, question_id: questionId ?? null });
}
```

Leave `buildStrokesSync`, `buildStrokeBatchMessage`, `buildAnswerSelectedMessage`, `computeLiveIndicatorState`, `resolveWatchState` unchanged.

- [ ] **Step 4: Run to verify pass**

Run: `cd frontend && CI=true npx react-scripts test --watchAll=false --testPathPattern="strokeQuestionId"`
Expected: PASS (2 passed)

Also confirm existing liveHelpers consumers still pass:
Run: `cd frontend && CI=true npx react-scripts test --watchAll=false --testPathPattern="liveHelpers|sharedStrokeMsgs|resolveWatchState"`
Expected: PASS (adjust: if `sharedStrokeMsgs.test.js` asserts exact payload equality without question_id, update those expectations to include `question_id: null`).

- [ ] **Step 5: Commit** — SKIP (no git).

---

## Task 3: Per-question stroke map in useSharedDrawing

**Files:**
- Modify: `frontend/src/hooks/useSharedDrawing.js`
- Test: `frontend/src/hooks/useSharedDrawing.test.js` (rewrite for per-question + logical points)

Hold `Map<questionId, stroke[]>`. `strokes` returns the current question's set. Emits + applies include question_id. Undo/clear are per-author AND per-current-question. `strokes_sync` replaces that author's set for the payload's question_id.

- [ ] **Step 1: Rewrite the test**

```javascript
// frontend/src/hooks/useSharedDrawing.test.js
import { renderHook, act } from '@testing-library/react';
import { useSharedDrawing } from './useSharedDrawing';

function setup(author = 'tutor') {
  const send = jest.fn();
  const hook = renderHook(() => useSharedDrawing({ sessionId: 's1', author, send }));
  return { hook, send };
}

test('strokes are scoped to the current question and restored on return', () => {
  const { hook } = setup('student');
  act(() => hook.result.current.setQuestionId('q1'));
  act(() => { const id = hook.result.current.startStroke({ color: '#111827', size: 3, eraser: false, point: { x: 10, y: 10 } }); hook.result.current.endStroke(id); });
  expect(hook.result.current.strokes).toHaveLength(1);

  // navigate to q2 -> empty
  act(() => hook.result.current.setQuestionId('q2'));
  expect(hook.result.current.strokes).toHaveLength(0);

  // back to q1 -> restored
  act(() => hook.result.current.setQuestionId('q1'));
  expect(hook.result.current.strokes).toHaveLength(1);
});

test('emitted messages carry the current question_id', () => {
  const { hook, send } = setup('student');
  act(() => hook.result.current.setQuestionId('q7'));
  act(() => { const id = hook.result.current.startStroke({ color: '#111827', size: 3, eraser: false, point: { x: 1, y: 1 } }); hook.result.current.endStroke(id); });
  expect(send).toHaveBeenCalledWith(expect.objectContaining({ type: 'stroke_start', payload: expect.objectContaining({ question_id: 'q7' }) }));
});

test('applyMessage files a remote stroke into its question; shown only when current', () => {
  const { hook } = setup('tutor');
  act(() => hook.result.current.setQuestionId('q1'));
  // remote student stroke for q2 arrives while tutor is on q1
  act(() => hook.result.current.applyMessage({ type: 'stroke_start', payload: { stroke_id: 'st-1', author: 'student', color: '#111827', size: 3, eraser: false, point: { x: 5, y: 5 }, question_id: 'q2' } }));
  act(() => hook.result.current.applyMessage({ type: 'stroke_end', payload: { stroke_id: 'st-1', question_id: 'q2' } }));
  expect(hook.result.current.strokes).toHaveLength(0); // not shown on q1
  act(() => hook.result.current.setQuestionId('q2'));
  expect(hook.result.current.strokes).toHaveLength(1); // shown on q2
});

test('undo removes only this author’s last stroke in the current question', () => {
  const { hook, send } = setup('tutor');
  act(() => hook.result.current.setQuestionId('q1'));
  act(() => hook.result.current.applyMessage({ type: 'stroke_start', payload: { stroke_id: 'st-1', author: 'student', color: '#111827', size: 3, eraser: false, point: { x: 0, y: 0 }, question_id: 'q1' } }));
  act(() => hook.result.current.applyMessage({ type: 'stroke_end', payload: { stroke_id: 'st-1', question_id: 'q1' } }));
  act(() => { const id = hook.result.current.startStroke({ color: '#b45309', size: 3, eraser: false, point: { x: 1, y: 1 } }); hook.result.current.endStroke(id); });
  act(() => hook.result.current.undo());
  expect(hook.result.current.strokes.filter((s) => s.author === 'tutor')).toHaveLength(0);
  expect(hook.result.current.strokes.filter((s) => s.author === 'student')).toHaveLength(1);
  expect(send).toHaveBeenCalledWith(expect.objectContaining({ type: 'stroke_undo' }));
});

test('strokes_sync replaces the syncing author’s set for that question only', () => {
  const { hook } = setup('tutor');
  act(() => hook.result.current.setQuestionId('q1'));
  act(() => hook.result.current.applyMessage({ type: 'stroke_start', payload: { stroke_id: 'old', author: 'student', color: '#111827', size: 3, eraser: false, point: { x: 0, y: 0 }, question_id: 'q1' } }));
  act(() => hook.result.current.applyMessage({ type: 'stroke_end', payload: { stroke_id: 'old', question_id: 'q1' } }));
  act(() => hook.result.current.applyMessage({ type: 'strokes_sync', payload: { question_id: 'q1', strokes: [{ id: 'new', author: 'student', color: '#111827', size: 3, eraser: false, points: [{ x: 9, y: 9 }] }] } }));
  expect(hook.result.current.strokes.filter((s) => s.author === 'student').map((s) => s.id)).toEqual(['new']);
});

test('syncPayload returns the current question’s own-author strokes', () => {
  const { hook } = setup('student');
  act(() => hook.result.current.setQuestionId('q5'));
  act(() => { const id = hook.result.current.startStroke({ color: '#111827', size: 3, eraser: false, point: { x: 2, y: 2 } }); hook.result.current.endStroke(id); });
  const payload = hook.result.current.syncPayload();
  expect(payload.question_id).toBe('q5');
  expect(payload.strokes).toHaveLength(1);
  expect(payload.strokes.every((s) => s.author === 'student')).toBe(true);
});
```

- [ ] **Step 2: Run to verify failure**

Run: `cd frontend && CI=true npx react-scripts test --watchAll=false --testPathPattern="useSharedDrawing"`
Expected: FAIL (per-question behavior not implemented).

- [ ] **Step 3: Implement**

```javascript
// frontend/src/hooks/useSharedDrawing.js
import { useCallback, useRef, useState } from 'react';
import {
  buildStrokeStart, buildStrokePoints, buildStrokeEnd,
  buildStrokeUndo, buildStrokeClear, buildStrokesSync,
} from '../components/test/liveHelpers';

/**
 * Owns per-question shared drawing state for a session. Strokes are grouped by
 * question_id in a Map; `strokes` exposes the CURRENT question's merged set.
 * Transport-agnostic: caller wires the live connection's onMessage to
 * `applyMessage` and provides `send`. Per-author ownership; in-memory only.
 * Points are {x, y} in logical frame units.
 */
export function useSharedDrawing({ sessionId, author, send }) {
  // Map<questionId, stroke[]> kept in a ref (source of truth); `version` bumps
  // to trigger re-render of the derived current-question array.
  const mapRef = useRef(new Map());
  const [, setVersion] = useState(0);
  const bump = useCallback(() => setVersion((v) => v + 1), []);
  const counter = useRef(0);
  const questionIdRef = useRef(null);
  const [currentQid, setCurrentQid] = useState(null);

  const listFor = (qid) => {
    if (!mapRef.current.has(qid)) mapRef.current.set(qid, []);
    return mapRef.current.get(qid);
  };

  const setQuestionId = useCallback((qid) => {
    questionIdRef.current = qid;
    setCurrentQid(qid);
  }, []);

  const startStroke = useCallback(({ color, size, eraser, point }) => {
    const qid = questionIdRef.current;
    const id = `${author}-${++counter.current}`;
    listFor(qid).push({ id, author, color, size, eraser: !!eraser, points: [point] });
    bump();
    if (send) send(buildStrokeStart(sessionId, author, { strokeId: id, color, size, eraser, point, questionId: qid }));
    return id;
  }, [author, sessionId, send, bump]);

  const extendStroke = useCallback((id, points) => {
    const qid = questionIdRef.current;
    const s = listFor(qid).find((x) => x.id === id);
    if (s) { s.points.push(...points); bump(); }
    if (send) send(buildStrokePoints(sessionId, author, id, points, qid));
  }, [author, sessionId, send, bump]);

  const endStroke = useCallback((id) => {
    if (send) send(buildStrokeEnd(sessionId, author, id, questionIdRef.current));
  }, [author, sessionId, send]);

  const undo = useCallback(() => {
    const qid = questionIdRef.current;
    const list = listFor(qid);
    const mineIdx = [...list].reverse().findIndex((s) => s.author === author);
    if (mineIdx === -1) return;
    const removeAt = list.length - 1 - mineIdx;
    const removedId = list[removeAt].id;
    list.splice(removeAt, 1);
    bump();
    if (send) send(buildStrokeUndo(sessionId, author, removedId, qid));
  }, [author, sessionId, send, bump]);

  const clear = useCallback(() => {
    const qid = questionIdRef.current;
    mapRef.current.set(qid, listFor(qid).filter((s) => s.author !== author));
    bump();
    if (send) send(buildStrokeClear(sessionId, author, qid));
  }, [author, sessionId, send, bump]);

  const applyMessage = useCallback((msg) => {
    if (!msg || !msg.type) return;
    const p = msg.payload || {};
    const qid = p.question_id;
    switch (msg.type) {
      case 'stroke_start': {
        const list = listFor(qid);
        if (!list.some((s) => s.id === p.stroke_id)) {
          list.push({ id: p.stroke_id, author: p.author, color: p.color, size: p.size, eraser: !!p.eraser, points: p.point ? [p.point] : [] });
          bump();
        }
        break;
      }
      case 'stroke_points': {
        const s = listFor(qid).find((x) => x.id === p.stroke_id);
        if (s) { s.points.push(...(p.points || [])); bump(); }
        break;
      }
      case 'stroke_end':
        break;
      case 'stroke_undo':
        mapRef.current.set(qid, listFor(qid).filter((s) => s.id !== p.stroke_id));
        bump();
        break;
      case 'stroke_clear':
        mapRef.current.set(qid, listFor(qid).filter((s) => s.author !== p.author));
        bump();
        break;
      case 'strokes_sync': {
        const syncAuthors = new Set((p.strokes || []).map((s) => s.author));
        const kept = listFor(qid).filter((s) => !syncAuthors.has(s.author));
        mapRef.current.set(qid, [...kept, ...(p.strokes || [])]);
        bump();
        break;
      }
      default:
        break;
    }
  }, [bump]);

  const syncPayload = useCallback(() => {
    const qid = questionIdRef.current;
    const mine = listFor(qid).filter((s) => s.author === author);
    return buildStrokesSync(sessionId, qid, mine).payload;
  }, [author, sessionId]);

  const strokes = currentQid == null ? [] : [...listFor(currentQid)];

  return { strokes, applyMessage, startStroke, extendStroke, endStroke, undo, clear, syncPayload, setQuestionId };
}

export default useSharedDrawing;
```

- [ ] **Step 4: Run to verify pass**

Run: `cd frontend && CI=true npx react-scripts test --watchAll=false --testPathPattern="useSharedDrawing"`
Expected: PASS (6 passed)

- [ ] **Step 5: Commit** — SKIP (no git).

---

## Task 4: QuestionFrame component

**Files:**
- Create: `frontend/src/components/test/QuestionFrame.jsx`
- Test: `frontend/src/components/test/QuestionFrame.test.js`

A wrapper that measures its width, computes the frame scale, and renders children into a fixed `FRAME_W`-wide element scaled uniformly (origin top-center). It reserves the scaled height so page flow is correct, and exposes the scale + the scaled inner element ref via a render-prop/child so the drawing layer can live inside it.

- [ ] **Step 1: Write the failing test**

```javascript
// frontend/src/components/test/QuestionFrame.test.js
import { render, screen } from '@testing-library/react';
import QuestionFrame from './QuestionFrame';
import { FRAME_W } from '../../utils/frameCoords';

// jsdom has no layout; mock the measured width via ResizeObserver shim.
beforeAll(() => {
  global.ResizeObserver = class {
    constructor(cb) { this.cb = cb; }
    observe(el) { this.cb([{ target: el, contentRect: { width: 410 } }]); }
    unobserve() {}
    disconnect() {}
  };
});

test('renders children inside a fixed-width scaled frame', () => {
  render(
    <QuestionFrame>
      {() => <div data-testid="content">hello</div>}
    </QuestionFrame>
  );
  expect(screen.getByTestId('content')).toBeInTheDocument();
  const frame = document.querySelector('[data-frame="true"]');
  expect(frame).toBeTruthy();
  expect(frame.style.width).toBe(`${FRAME_W}px`);
  // width 410 -> scale 0.5
  expect(frame.style.transform).toContain('scale(0.5)');
});

test('passes the computed scale to the child render function', () => {
  let seenScale = null;
  render(
    <QuestionFrame>
      {({ scale }) => { seenScale = scale; return <div>x</div>; }}
    </QuestionFrame>
  );
  expect(seenScale).toBeCloseTo(0.5, 5);
});
```

- [ ] **Step 2: Run to verify failure**

Run: `cd frontend && CI=true npx react-scripts test --watchAll=false --testPathPattern="QuestionFrame"`
Expected: FAIL — Cannot find module './QuestionFrame'.

- [ ] **Step 3: Implement**

```jsx
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

  const measure = useCallback(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    setScale(frameScale(wrap.clientWidth));
  }, []);

  useLayoutEffect(() => {
    measure();
    const ro = new ResizeObserver(measure);
    if (wrapRef.current) ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, [measure]);

  // Reserve scaled height (natural content height * scale) so the page reserves
  // the right vertical space for the transformed element.
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
```

- [ ] **Step 4: Run to verify pass**

Run: `cd frontend && CI=true npx react-scripts test --watchAll=false --testPathPattern="QuestionFrame"`
Expected: PASS (2 passed)

- [ ] **Step 5: Commit** — SKIP (no git).

---

## Task 5: SharedDrawingSurface renders logical-unit strokes inside the frame

**Files:**
- Modify: `frontend/src/components/live/SharedDrawingSurface.jsx`
- Modify: `frontend/src/components/live/SharedDrawingSurface.test.js` (keep the throttle test; it still applies)
- Delete: `frontend/src/utils/liveCoords.js` (and its test) — superseded by frameCoords.

The canvas is an absolute layer covering the full frame (logical size), a sibling of content inside the scaled frame. Its backing store is logical-sized (× dpr for crispness). Points render as raw logical coords. Pointer capture converts via `toFramePoint(clientX, clientY, canvasRect, scale)`. Dot grid drawn in logical units. No scrollTop math (scrolling the frame moves the canvas with content).

- [ ] **Step 1: Keep/adjust the throttle test, add a coordinate-emit test**

Replace `SharedDrawingSurface.test.js` with:

```javascript
// frontend/src/components/live/SharedDrawingSurface.test.js
import { throttlePoints } from './SharedDrawingSurface';

test('throttlePoints batches points and flushes on interval boundary', () => {
  const flushed = [];
  const t = throttlePoints((pts) => flushed.push(pts), 100);
  t.add({ x: 1, y: 1 }, 0);
  t.add({ x: 2, y: 2 }, 50);
  t.add({ x: 3, y: 3 }, 120);
  expect(flushed.length).toBe(1);
  expect(flushed[0]).toHaveLength(2);
  t.flush();
  expect(flushed.length).toBe(2);
  expect(flushed[1]).toHaveLength(1);
});
```

- [ ] **Step 2: Run to verify current state**

Run: `cd frontend && CI=true npx react-scripts test --watchAll=false --testPathPattern="SharedDrawingSurface"`
Expected: PASS (the throttle test is unchanged behavior).

- [ ] **Step 3: Implement the rework**

Rewrite `frontend/src/components/live/SharedDrawingSurface.jsx`:

```jsx
// frontend/src/components/live/SharedDrawingSurface.jsx
import React, { useCallback, useEffect, useRef } from 'react';
import { renderStrokes } from '../../utils/strokeRenderer';
import { toFramePoint, FRAME_W } from '../../utils/frameCoords';

/** Time-based point batcher for mid-stroke streaming (see prior docs). */
export function throttlePoints(onFlush, intervalMs = 60) {
  let buffer = [];
  let windowStart = null;
  return {
    add(point, now) {
      if (windowStart === null) windowStart = now;
      if (now - windowStart >= intervalMs && buffer.length > 0) {
        onFlush(buffer); buffer = []; windowStart = now;
      }
      buffer.push(point);
    },
    flush() { if (buffer.length > 0) { onFlush(buffer); buffer = []; } windowStart = null; },
  };
}

const DOT_SPACING = 28; // logical units

/**
 * Shared drawing canvas that lives INSIDE the scaled QuestionFrame. Sized in
 * logical units (FRAME_W x frameHeight); the browser scales it with content, so
 * ink is stored/drawn in raw logical coordinates. Only pointer capture converts
 * viewport px -> logical via the frame scale.
 *
 * Props:
 *   active, author, penColor, size, eraser
 *   strokes   - current question's merged strokes [{id,author,color,size,eraser,points:[{x,y}]}]
 *   showGrid  - draw the logical dot grid
 *   scale     - current frame scale (from QuestionFrame)
 *   heightPx  - logical height of the frame content (canvas covers this)
 *   onStrokeStart(opts)->id ; onStrokePoints(id, points) ; onStrokeEnd(id)
 */
export default function SharedDrawingSurface({
  active, author, penColor = '#b45309', size = 3, eraser = false,
  strokes = [], showGrid = true, scale = 1, heightPx = 0,
  onStrokeStart, onStrokePoints, onStrokeEnd,
}) {
  const canvasRef = useRef(null);
  const drawingId = useRef(null);
  const batcher = useRef(null);
  const height = heightPx || 1160;

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    // Backing store in device px; logical drawing space via ctx scale(dpr).
    if (canvas.width !== FRAME_W * dpr || canvas.height !== height * dpr) {
      canvas.width = FRAME_W * dpr;
      canvas.height = height * dpr;
    }
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); // 1 logical unit = 1 css px in backing store
    ctx.clearRect(0, 0, FRAME_W, height);
    if (showGrid) drawGrid(ctx, FRAME_W, height);
    for (const s of strokes) {
      renderStrokes(ctx, [{ color: s.color, size: s.size, eraser: s.eraser, points: s.points }]);
    }
  }, [strokes, showGrid, height]);

  useEffect(() => { redraw(); }, [redraw]);

  const nowMs = () => (typeof performance !== 'undefined' ? performance.now() : 0);

  const handleDown = useCallback((e) => {
    if (!active) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const n = toFramePoint(e.clientX, e.clientY, canvas.getBoundingClientRect(), scale);
    const id = onStrokeStart && onStrokeStart({ color: eraser ? '#000000' : penColor, size, eraser, point: n });
    drawingId.current = id;
    batcher.current = throttlePoints((pts) => { if (drawingId.current) onStrokePoints && onStrokePoints(drawingId.current, pts); }, 60);
  }, [active, onStrokeStart, onStrokePoints, penColor, size, eraser, scale]);

  const handleMove = useCallback((e) => {
    if (!active || !drawingId.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const n = toFramePoint(e.clientX, e.clientY, canvas.getBoundingClientRect(), scale);
    batcher.current.add(n, nowMs());
  }, [active, scale]);

  const handleUp = useCallback(() => {
    if (!drawingId.current) return;
    if (batcher.current) batcher.current.flush();
    onStrokeEnd && onStrokeEnd(drawingId.current);
    drawingId.current = null;
  }, [onStrokeEnd]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute', top: 0, left: 0,
        width: `${FRAME_W}px`, height: `${height}px`,
        pointerEvents: active ? 'all' : 'none', touchAction: 'none',
        cursor: active ? 'crosshair' : 'default',
      }}
      onPointerDown={handleDown}
      onPointerMove={handleMove}
      onPointerUp={handleUp}
      onPointerLeave={handleUp}
      aria-hidden="true"
    />
  );
}

/** Faint logical-unit dot grid. Aligns across sides because units are shared. */
function drawGrid(ctx, w, h) {
  ctx.save();
  ctx.fillStyle = 'rgba(120,120,120,0.35)';
  for (let x = DOT_SPACING; x < w; x += DOT_SPACING) {
    for (let y = DOT_SPACING; y < h; y += DOT_SPACING) {
      ctx.beginPath(); ctx.arc(x, y, 1, 0, Math.PI * 2); ctx.fill();
    }
  }
  ctx.restore();
}
```

Then DELETE `frontend/src/utils/liveCoords.js` and `frontend/src/utils/liveCoords.test.js`. Grep for any remaining importers of `liveCoords` and update/remove them:
Run: `cd frontend && grep -rn "liveCoords" src` — every hit must be removed or repointed to `frameCoords`. (Expected hits before this task: SharedDrawingSurface only, now replaced.)

- [ ] **Step 4: Run to verify pass + build**

Run: `cd frontend && CI=true npx react-scripts test --watchAll=false --testPathPattern="SharedDrawingSurface|frameCoords"`
Expected: PASS.
Run: `cd frontend && CI=true npm run build`
Expected: Compiled successfully (fails if a stale `liveCoords` import remains — fix it).

- [ ] **Step 5: Commit** — SKIP (no git).

---

## Task 6: Backend relay preserves question_id (confirmation test)

**Files:**
- Test: `backend/app/tests/test_live_api.py` (append)

The relay is content-agnostic; this test locks in that a `stroke_start` with `question_id` reaches the peer unchanged (guards against a future regression that strips payload fields).

- [ ] **Step 1: Append the test**

```python
def test_ws_stroke_message_preserves_question_id(client, db):
    from app.core.live_ticket import create_live_ticket
    from app.api.v1.live import room_manager
    room_manager._rooms.clear()
    room_manager._used_tickets.clear()

    tutor = _mk_user(db, UserRole.TUTOR)
    student = _mk_user(db, UserRole.STUDENT, tutor_id=tutor.id)
    session = _mk_session(db, student.id)
    sid = str(session.id)
    s_ticket = create_live_ticket(user_id=str(student.id), session_id=sid, role="student")
    t_ticket = create_live_ticket(user_id=str(tutor.id), session_id=sid, role="tutor")

    with client.websocket_connect(f"/api/v1/live/ws/{sid}?ticket={s_ticket}") as s_ws:
        with client.websocket_connect(f"/api/v1/live/ws/{sid}?ticket={t_ticket}") as t_ws:
            assert s_ws.receive_json()["type"] == "tutor_joined"
            assert t_ws.receive_json()["type"] == "snapshot"
            s_ws.send_json({"type": "stroke_start", "session_id": sid, "sender_role": "student",
                            "seq": 0, "payload": {"stroke_id": "x1", "author": "student",
                                                  "color": "#111827", "size": 3, "eraser": False,
                                                  "point": {"x": 10, "y": 20}, "question_id": "q-99"}})
            got = t_ws.receive_json()
            assert got["type"] == "stroke_start"
            assert got["payload"]["question_id"] == "q-99"
            assert got["payload"]["point"] == {"x": 10, "y": 20}
    room_manager._rooms.clear()
```

- [ ] **Step 2: Run**

Run: `cd backend && python3 -m pytest app/tests/test_live_api.py -q`
Expected: PASS (no code change needed; the relay forwards the whole payload).

- [ ] **Step 3: Commit** — SKIP (no git).

---

## Task 7: Adopt QuestionFrame + per-question drawing on AdaptivePracticePage (+ prove E2E)

**Files:**
- Modify: `frontend/src/pages/student/AdaptivePracticePage.jsx`

READ the file fully. Current structure (from exploration): `contentRef` div with `mr-[440px]` calc shift, SplitPane for passages, `max-w-3xl mx-auto` no-split; `SharedDrawingSurface` mounted at ~line 848 with grid-fraction props; `liveShared = useStudentLiveEmit(...).shared`; `isDrawing` toggle; `session?.id` gates live.

Changes:
1. Wrap the question content (passage + prompt + choices — the `questionPanel`/`SplitPane` output) in `<QuestionFrame>`, using the render-prop to get `{ scale, frameRef }`. Inside the frame, render the content, and mount `SharedDrawingSurface` as the absolute sibling with the new props: `scale`, `heightPx` (the frame content height — pass `frameRef.current?.offsetHeight` via state, or a simpler approach: let the surface default height and grow; use a `ResizeObserver` on the content to set heightPx). Simplest robust wiring: track `contentHeight` state via a ResizeObserver on the frame content wrapper and pass it as `heightPx`.
2. Remove `mr-[440px]` from the content container (panels overlay; see Task 11 for the calculator overlay — for now just removing the margin stops the shift). The calculator component is already an absolutely-positioned draggable overlay (`initialPosition`), so removing the margin leaves it floating above — correct.
3. Call `liveShared.setQuestionId(currentQuestion?.id)` whenever `currentQuestion` changes (an effect) so the per-question set switches.
4. Pass `active={isDrawing}`, `showGrid={isDrawing}`, `author="student"`, `penColor="#111827"`, and the stroke callbacks from `liveShared`.
5. The legacy full-screen `DrawingCanvas` on the live path is replaced by this in-frame surface. Keep the legacy `DrawingCanvas` ONLY for the non-live path (when `!session?.id`).

Because this is a layout integration with no unit test, verify by build + E2E. Provide this exact wiring pattern (adapt variable names to the file):

```jsx
// near other state
const [contentHeight, setContentHeight] = useState(1160);
const contentInnerRef = useRef(null);
useEffect(() => {
  const el = contentInnerRef.current;
  if (!el) return undefined;
  const ro = new ResizeObserver(() => setContentHeight(Math.max(1160, el.offsetHeight)));
  ro.observe(el);
  return () => ro.disconnect();
}, []);

useEffect(() => {
  if (currentQuestion?.id) liveShared.setQuestionId(currentQuestion.id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [currentQuestion?.id]);

// render (replacing the old contentRef block on the LIVE path):
{session?.id ? (
  <QuestionFrame>
    {({ scale }) => (
      <>
        <div ref={contentInnerRef}>
          {hasPassage ? <SplitPane left={passagePanel} right={questionPanel} defaultSplit={50} minLeft={25} minRight={35} /> : <div className="max-w-3xl mx-auto">{questionPanel}</div>}
        </div>
        <SharedDrawingSurface
          active={isDrawing}
          showGrid={isDrawing}
          author="student"
          penColor="#111827"
          eraser={false}
          scale={scale}
          heightPx={contentHeight}
          strokes={liveShared.strokes}
          onStrokeStart={(opts) => liveShared.startStroke(opts)}
          onStrokePoints={(id, pts) => liveShared.extendStroke(id, pts)}
          onStrokeEnd={(id) => liveShared.endStroke(id)}
        />
      </>
    )}
  </QuestionFrame>
) : (
  /* existing non-live layout with legacy DrawingCanvas, unchanged */
)}
```

NOTE: SplitPane inside a fixed-width 820 frame — the split panes divide the 820 logical width. That's fine and consistent across devices (the whole 820 frame scales). If the passage layout looks too cramped at 820, that's acceptable for v1 (alignment is the priority); do not widen the frame per-surface (defeats 1:1).

- [ ] **Step 1: Implement the wiring above (read the file, adapt names).**
- [ ] **Step 2: Build**

Run: `cd frontend && CI=true npm run build`
Expected: Compiled successfully.

- [ ] **Step 3: Two-context E2E (Chrome DevTools MCP isolatedContext)** — the controller runs this after the task subagent reports. Student (default context, login e@g.c) starts adaptive; tutor (isolatedContext, login t@g.c) joins. Verify: (a) tutor sees the question in the frame; (b) student draws with grid, ink appears on tutor at a DIFFERENT window width at the SAME content position; (c) resize the tutor window — frame scales, ink stays aligned; (d) student navigates to next question (blank canvas), back (ink restored); (e) open calculator — content + ink don't shift.

- [ ] **Step 4: Commit** — SKIP (no git).

---

## Task 8: Adopt on TestPage

**Files:**
- Modify: `frontend/src/pages/student/TestPage.jsx`

Same integration as Task 7, adapted to TestPage's variables (`scrollContainerRef`, `liveSessionId` gate, `liveShared` from its `useStudentLiveEmit`, `isDrawing`, `showCalculator`). READ the file. Steps:
1. Wrap question content in `<QuestionFrame>`; mount `SharedDrawingSurface` inside with `scale`/`heightPx`/per-question props (same pattern as Task 7).
2. Remove `mr-[440px]` from the content container (line ~916).
3. `liveShared.setQuestionId(currentQuestion?.id)` effect.
4. Legacy `DrawingCanvas` kept only for `!liveSessionId`.

- [ ] **Step 1: Implement (read file, adapt).**
- [ ] **Step 2: Build**

Run: `cd frontend && CI=true npm run build`
Expected: Compiled successfully.

- [ ] **Step 3: Commit** — SKIP (no git).

---

## Task 9: Adopt on PracticeTestTakingPage

**Files:**
- Modify: `frontend/src/pages/student/PracticeTestTakingPage.jsx`

Same as Task 8, variables: `scrollContainerRef`, `sessionId` gate, `liveShared`, `isDrawing`, `showCalculator`, remove `mr-[440px]` (line ~414). READ the file.

- [ ] **Step 1: Implement (read file, adapt).**
- [ ] **Step 2: Build**

Run: `cd frontend && CI=true npm run build`
Expected: Compiled successfully.

- [ ] **Step 3: Commit** — SKIP (no git).

---

## Task 10: Adopt on ModuleTestInterface (full-length)

**Files:**
- Modify: `frontend/src/components/test/ModuleTestInterface.jsx`

READ the file. This surface uses a right-sidebar calculator (`w-96 border-l`), not `mr-[440px]`, and has its own inline `useSharedDrawing` (`shared`), `useLiveSession`, `isDrawing` (no toggle wired — stays false), `currentIndex`/`currentQuestion`. Steps:
1. Wrap question content (the `SplitPane`/`max-w-4xl` block) in `<QuestionFrame>`; mount `SharedDrawingSurface` inside with `scale`/`heightPx`/per-question props from `shared`.
2. Add `shared.setQuestionId(currentQuestion?.id)` on question change (it may already emit question_changed; add the setQuestionId call in that same effect).
3. Gate on `live?.enabled`. Keep the legacy `DrawingCanvas` for the non-live path.
4. The sidebar calculator already overlays via flex sibling — since the frame is centered and scales, leave as-is (no margin shift exists here). Confirm the frame doesn't get squeezed oddly when the calculator opens; if it does, make the calculator an overlay too (position absolute) — but only if needed.

- [ ] **Step 1: Implement (read file, adapt).**
- [ ] **Step 2: Build**

Run: `cd frontend && CI=true npm run build`
Expected: Compiled successfully.

- [ ] **Step 3: Commit** — SKIP (no git).

---

## Task 11: Tutor watch view through QuestionFrame + panel overlay + final verification

**Files:**
- Modify: `frontend/src/pages/tutor/LiveSessionsPage.jsx`
- Modify: `README.md`, `docs/CODEBASE_ORGANIZATION.md`

READ `LiveWatchView`. It currently renders `QuestionDisplay` + MCQ choices in a `max-w-2xl` box with `SharedDrawingSurface` (grid-fraction). Steps:
1. Wrap the tutor's question content (same `QuestionDisplay` + choices) in `<QuestionFrame>` so it renders at the SAME 820 logical width as the student — this is what makes 1:1 alignment real.
2. Mount `SharedDrawingSurface` inside the frame with `author="tutor"`, `active` (tutor always annotate), `showGrid` always true, `scale` from the frame, `heightPx` from a content ResizeObserver, per-question props from the tutor's `shared` (already `useSharedDrawing`).
3. `shared.setQuestionId(currentQuestionId)` when the watched question changes (there's already a `getQuestionDetail` effect on `currentQuestionId` — add `shared.setQuestionId` there).
4. The coach sidebar (`TutorLivePanel`) already sits beside the content via flex; ensure it overlays/sits without shifting the frame (frame is centered in its flex-1 area). Keep the answer/explanation panel as the right column.

Then verification:

- [ ] **Step 1: Implement the tutor rework.**
- [ ] **Step 2: Full frontend suite + build**

Run: `cd frontend && CI=true npx react-scripts test --watchAll=false`
Expected: all pass (update any leftover tests referencing removed `liveCoords`/old props — none should remain).
Run: `cd frontend && CI=true npm run build`
Expected: Compiled successfully.

- [ ] **Step 3: Backend suite**

Run: `cd backend && python3 -m pytest app/tests/ -q`
Expected: all pass.

- [ ] **Step 4: Two-context E2E (the definitive alignment proof)**

Student + tutor in isolated contexts, DIFFERENT window sizes. Verify all spec acceptance items:
1. Draw on student → ink lands on the SAME content word on the tutor.
2. Resize either window → frame scales as one unit, ink stays aligned.
3. Open calculator/sidebar → content + ink do NOT move.
4. Per-question: draw Q1, go Q2 (blank), back Q1 (restored), tutor mirrors per-question.
5. Draw-mode toggle off → answers clickable; on → captures.

Record pass/fail per item; fix before done.

- [ ] **Step 5: Docs**

Update README "Live Tutor Sessions" bullet to mention 1:1 fixed-frame alignment + per-question drawing. Add `components/test/QuestionFrame.jsx`, `utils/frameCoords.js` to `docs/CODEBASE_ORGANIZATION.md`; note `utils/liveCoords.js` removed.

- [ ] **Step 6: Commit** — SKIP (no git).

---

## Self-Review Notes

- **Spec coverage:** fixed frame + uniform scale (T1 frameScale, T4 QuestionFrame), logical coords (T1, T5), per-question map + save/restore (T3), question_id in messages (T2, backend T6), overlay-not-shift (T7–T11 remove `mr-[440px]`; calculator already floats), one shared QuestionFrame across all 5 surfaces (T4 + T7–T11), draw-toggle default off (T5 `active` gates pointer-events), grid dots logical + student-only/tutor-always (T5 + per-surface showGrid), tutor renders same content in same frame (T11). In-memory only, no DB (T3). Backend transport unchanged (T6 confirms).
- **Type consistency:** stroke point is `{x, y}` logical everywhere (T1/T3/T5); stroke shape `{id, author, color, size, eraser, points:[{x,y}]}` (T3/T5); message builders add `question_id` (T2) consumed by `useSharedDrawing.applyMessage`/emit (T3) and confirmed on the wire (T6); `QuestionFrame` render-prop yields `{scale, frameRef}` (T4) consumed by surfaces (T7–T11); `SharedDrawingSurface` props `scale`/`heightPx`/`strokes`/`active`/`showGrid`/`author`/`penColor`/`onStroke*` consistent T5↔T7–T11.
- **Known risks flagged inline:** SplitPane inside the 820 frame may feel narrow for passages (accepted for v1; do not per-surface-widen or 1:1 breaks). Integration tasks (T7–T11) rely on build + E2E rather than unit tests since they're layout; the pure logic they orchestrate is unit-tested in T1/T3/T5. `heightPx` is measured via ResizeObserver per surface (pattern given in T7).
- **Placeholder scan:** none; every code step has complete code or an exact adapt-this pattern with real variable names from exploration.
