# Shared Live Drawing (Phase 2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the Phase-1 one-way drawing mirror into a bidirectional, color-coded shared whiteboard whose strokes align to the same question-content position on both the student and tutor screens, streaming mid-stroke, in-memory only.

**Architecture:** Strokes are stored as normalized fractions of a shared question-content box (`liveCoords`), so equal coordinates map to the same visual spot on any window size. A symmetric `SharedDrawingSurface` canvas captures/renders normalized strokes for either role; `useSharedDrawing` owns the merged stroke set and the outbound/inbound stroke_* messages over the existing live WebSocket (now relayed both directions). The tutor watch view renders the student's real question HTML at the same relative width and mounts the same surface.

**Tech Stack:** FastAPI WebSockets + Pydantic (backend); React 18 / CRA, HTML5 Canvas, Jest + React Testing Library (frontend). No new deps, no DB.

**Spec:** `docs/superpowers/specs/2026-07-09-shared-drawing-design.md`

**Conventions (from Phase 1, must follow):**
- Backend tests: `cd backend && python3 -m pytest ...` (NOT `python`). The `app/tests/conftest.py` SQLite shim + `httpx==0.26.0` make `TestClient.websocket_connect` work.
- Frontend tests: `cd frontend && CI=true npx react-scripts test --watchAll=false --testPathPattern="X"` (NOT bare jest). Build gate: `CI=true npm run build`.
- Any frontend test importing a module that transitively imports `./services/api` (axios) MUST `jest.mock` it — a shared manual mock exists at `frontend/src/services/__mocks__/api.js`, and `frontend/src/hooks/__mocks__/useLiveSession.js` mocks the live hook.
- Tailwind semantic tokens only: `text-ink-body/muted/subtle`, `brand-*`, `accent-*`, `rose-*`, `emerald-*`, `border-edge`, `bg-surface-card/muted`, `font-display`. No `text-ink`, `surface-soft`, `danger-*`.
- **NO git.** Leave all changes in the working tree; skip every commit step.

---

## File Structure

**Frontend (new):**
- `src/utils/liveCoords.js` — normalized ↔ local pixel coordinate conversion (pure).
- `src/hooks/useSharedDrawing.js` — merged stroke set + inbound message application + outbound emit helpers + sync payload.
- `src/components/live/SharedDrawingSurface.jsx` — symmetric canvas overlay (capture + render normalized strokes) for either role.

**Frontend (modified):**
- `src/components/test/liveHelpers.js` — add builders for the new stroke_* messages.
- `src/hooks/useStudentLiveEmit.js` — expose the shared-drawing channel to student pages.
- `src/pages/tutor/LiveSessionsPage.jsx` — `LiveWatchView` renders content-anchored question + SharedDrawingSurface (tutor author); remove Phase-1 read-only LiveStrokeLayer scaling.
- The three student direct pages + `ModuleTestInterface` — mount SharedDrawingSurface on the live content box (last integration task).

**Backend (modified):**
- `app/schemas/live.py` — add the new message types to the `MessageType` Literal.
- `app/api/v1/live.py` — relay tutor→student as well as student→tutor.

---

## Task 1: Normalized coordinate module

**Files:**
- Create: `frontend/src/utils/liveCoords.js`
- Test: `frontend/src/utils/liveCoords.test.js`

Pure functions converting between viewport pixels and content-box-normalized fractions. A "box metrics" object is `{left, top, width, scrollTop, scrollHeight}`.

- [ ] **Step 1: Write the failing test**

```javascript
// frontend/src/utils/liveCoords.test.js
import { toNormalizedPoint, toLocalPoint, boxMetrics } from './liveCoords';

const box = { left: 100, top: 50, width: 800, scrollTop: 0, scrollHeight: 2000 };

test('normalizes a viewport point to content fractions', () => {
  // point at x=500 (400px into an 800px box), y=250 (200px into content from top)
  const n = toNormalizedPoint(500, 250, box);
  expect(n.nx).toBeCloseTo(0.5, 5);      // 400/800
  expect(n.ny).toBeCloseTo(0.1, 5);      // (250-50+0)/2000
});

test('accounts for scrollTop in ny', () => {
  const scrolled = { ...box, scrollTop: 300 };
  const n = toNormalizedPoint(500, 50, scrolled); // at top of viewport while scrolled 300
  expect(n.ny).toBeCloseTo(0.15, 5);     // (50-50+300)/2000
});

test('round-trips normalized -> local at a DIFFERENT box width (alignment)', () => {
  const n = toNormalizedPoint(500, 250, box);       // captured on 800px box
  const wideBox = { left: 0, top: 0, width: 1200, scrollTop: 0, scrollHeight: 3000 };
  const local = toLocalPoint(n, wideBox);
  // same relative position: 0.5 * 1200 = 600 ; 0.1 * 3000 - 0 = 300
  expect(local.x).toBeCloseTo(600, 5);
  expect(local.y).toBeCloseTo(300, 5);
});

test('toLocalPoint subtracts scrollTop to place within visible canvas', () => {
  const n = { nx: 0.5, ny: 0.1 };
  const b = { left: 0, top: 0, width: 800, scrollTop: 100, scrollHeight: 2000 };
  const local = toLocalPoint(n, b);
  expect(local.x).toBeCloseTo(400, 5);
  expect(local.y).toBeCloseTo(0.1 * 2000 - 100, 5); // 100
});

test('boxMetrics reads rect + scroll from an element-like object', () => {
  const el = {
    getBoundingClientRect: () => ({ left: 10, top: 20, width: 640 }),
    scrollTop: 5,
    scrollHeight: 1600,
  };
  expect(boxMetrics(el)).toEqual({ left: 10, top: 20, width: 640, scrollTop: 5, scrollHeight: 1600 });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && CI=true npx react-scripts test --watchAll=false --testPathPattern="liveCoords"`
Expected: FAIL — Cannot find module './liveCoords'

- [ ] **Step 3: Write minimal implementation**

```javascript
// frontend/src/utils/liveCoords.js
/**
 * Normalized content-anchored coordinates for the shared live-drawing surface.
 *
 * A stroke point is stored as {nx, ny} — fractions of the question CONTENT box
 * (nx of its width, ny of its full scrollable height). Because both the student
 * and tutor render the same question HTML at the same relative width, equal
 * {nx, ny} land on the same visual spot regardless of window size or scroll.
 *
 * A "box metrics" object is { left, top, width, scrollTop, scrollHeight }.
 */

/** Read box metrics from a DOM element (rect + scroll position/height). */
export function boxMetrics(el) {
  const r = el.getBoundingClientRect();
  return {
    left: r.left,
    top: r.top,
    width: r.width,
    scrollTop: el.scrollTop || 0,
    scrollHeight: el.scrollHeight || r.height || 1,
  };
}

/** Viewport (clientX/clientY) -> normalized {nx, ny}. */
export function toNormalizedPoint(clientX, clientY, box) {
  const width = box.width || 1;
  const scrollHeight = box.scrollHeight || 1;
  return {
    nx: (clientX - box.left) / width,
    ny: (clientY - box.top + (box.scrollTop || 0)) / scrollHeight,
  };
}

/** Normalized {nx, ny} -> local canvas pixels for a given box. */
export function toLocalPoint(n, box) {
  const width = box.width || 1;
  const scrollHeight = box.scrollHeight || 1;
  return {
    x: n.nx * width,
    y: n.ny * scrollHeight - (box.scrollTop || 0),
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && CI=true npx react-scripts test --watchAll=false --testPathPattern="liveCoords"`
Expected: PASS (5 passed)

- [ ] **Step 5: Commit** — SKIP (no git).

---

## Task 2: Stroke message builders

**Files:**
- Modify: `frontend/src/components/test/liveHelpers.js`
- Test: `frontend/src/components/test/sharedStrokeMsgs.test.js`

Add builders for the new streaming stroke messages. Keep existing `computeLiveIndicatorState`, `buildStrokeBatchMessage`, `buildAnswerSelectedMessage` untouched.

- [ ] **Step 1: Write the failing test**

```javascript
// frontend/src/components/test/sharedStrokeMsgs.test.js
import {
  buildStrokeStart, buildStrokePoints, buildStrokeEnd,
  buildStrokeUndo, buildStrokeClear, buildStrokesSync,
} from './liveHelpers';

test('stroke_start carries id, author, style, first point', () => {
  const m = buildStrokeStart('s1', 'tutor', { strokeId: 't-1', color: '#b45309', size: 3, eraser: false, point: { nx: 0.1, ny: 0.2 } });
  expect(m.type).toBe('stroke_start');
  expect(m.session_id).toBe('s1');
  expect(m.sender_role).toBe('tutor');
  expect(m.payload).toMatchObject({ stroke_id: 't-1', author: 'tutor', color: '#b45309', size: 3, eraser: false, point: { nx: 0.1, ny: 0.2 } });
});

test('stroke_points carries incremental points', () => {
  const m = buildStrokePoints('s1', 'student', 'st-2', [{ nx: 0.3, ny: 0.4 }]);
  expect(m.type).toBe('stroke_points');
  expect(m.payload.stroke_id).toBe('st-2');
  expect(m.payload.points).toHaveLength(1);
});

test('stroke_end / undo / clear / sync shapes', () => {
  expect(buildStrokeEnd('s1', 'tutor', 't-1').payload).toEqual({ stroke_id: 't-1' });
  expect(buildStrokeUndo('s1', 'tutor', 't-1').payload).toEqual({ author: 'tutor', stroke_id: 't-1' });
  expect(buildStrokeClear('s1', 'student').payload).toEqual({ author: 'student' });
  const sync = buildStrokesSync('s1', 'q9', [{ id: 't-1', author: 'tutor', color: '#b45309', size: 3, eraser: false, points: [] }]);
  expect(sync.type).toBe('strokes_sync');
  expect(sync.payload.question_id).toBe('q9');
  expect(sync.payload.strokes).toHaveLength(1);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && CI=true npx react-scripts test --watchAll=false --testPathPattern="sharedStrokeMsgs"`
Expected: FAIL — buildStrokeStart is not a function / not exported.

- [ ] **Step 3: Write minimal implementation**

Append to `frontend/src/components/test/liveHelpers.js`:

```javascript
// ── Shared live-drawing messages (Phase 2) ──────────────────────────────────
function envelope(type, sessionId, senderRole, payload) {
  return { type, session_id: sessionId, sender_role: senderRole, seq: 0, payload };
}

/** Begin a stroke. opts: {strokeId, color, size, eraser, point:{nx,ny}} */
export function buildStrokeStart(sessionId, author, opts) {
  return envelope('stroke_start', sessionId, author, {
    stroke_id: opts.strokeId,
    author,
    color: opts.color,
    size: opts.size,
    eraser: !!opts.eraser,
    point: opts.point,
  });
}

/** Append points to an in-progress stroke. */
export function buildStrokePoints(sessionId, author, strokeId, points) {
  return envelope('stroke_points', sessionId, author, { stroke_id: strokeId, points: points || [] });
}

/** Finalize a stroke. */
export function buildStrokeEnd(sessionId, author, strokeId) {
  return envelope('stroke_end', sessionId, author, { stroke_id: strokeId });
}

/** Remove one of an author's strokes. */
export function buildStrokeUndo(sessionId, author, strokeId) {
  return envelope('stroke_undo', sessionId, author, { author, stroke_id: strokeId });
}

/** Remove all of an author's strokes for the current question. */
export function buildStrokeClear(sessionId, author) {
  return envelope('stroke_clear', sessionId, author, { author });
}

/** Full-state resync for a joining/reconnecting peer. */
export function buildStrokesSync(sessionId, questionId, strokes) {
  return envelope('strokes_sync', sessionId, 'server', { question_id: questionId, strokes: strokes || [] });
}
```

Note: `buildStrokesSync` uses `sender_role: 'server'` conceptually but it's sent by a client; the relay doesn't care about sender_role beyond direction. Keep `'server'` here to signal "state message, not an authored action". (If a role Literal on the frontend objected we'd change it, but these are plain objects — no validation client-side.)

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && CI=true npx react-scripts test --watchAll=false --testPathPattern="sharedStrokeMsgs"`
Expected: PASS (3 passed)

- [ ] **Step 5: Commit** — SKIP (no git).

---

## Task 3: Backend schema — new message types

**Files:**
- Modify: `backend/app/schemas/live.py`
- Test: `backend/app/tests/test_live_schemas.py` (append)

Add the stroke_* types to the `MessageType` Literal so they pass validation in the WS loop. `sender_role` allows `student|tutor|server` already.

- [ ] **Step 1: Write the failing test (append)**

```python
def test_shared_drawing_message_types_valid():
    from app.schemas.live import LiveMessage
    for t in ["stroke_start", "stroke_points", "stroke_end", "stroke_undo", "stroke_clear", "strokes_sync", "viewport"]:
        msg = LiveMessage(type=t, session_id="s-1", sender_role="tutor", seq=0, payload={})
        assert msg.type == t
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && python3 -m pytest app/tests/test_live_schemas.py::test_shared_drawing_message_types_valid -v`
Expected: FAIL — ValidationError (types not in Literal).

- [ ] **Step 3: Write minimal implementation**

In `backend/app/schemas/live.py`, extend the `MessageType` Literal. Current value ends with `"heartbeat"`. Add the new types:

```python
MessageType = Literal[
    "presence",
    "snapshot",
    "question_changed",
    "answer_selected",
    "stroke_batch",
    "tutor_joined",
    "tutor_left",
    "heartbeat",
    # Phase 2: shared live drawing
    "stroke_start",
    "stroke_points",
    "stroke_end",
    "stroke_undo",
    "stroke_clear",
    "strokes_sync",
    "viewport",
]
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && python3 -m pytest app/tests/test_live_schemas.py -v`
Expected: PASS (all in file)

- [ ] **Step 5: Commit** — SKIP (no git).

---

## Task 4: Backend — bidirectional relay

**Files:**
- Modify: `backend/app/api/v1/live.py`
- Test: `backend/app/tests/test_live_api.py` (append)

Make the WS loop relay tutor→student in addition to student→tutor.

- [ ] **Step 1: Write the failing test (append)**

```python
def test_ws_tutor_message_relays_to_student(client, db):
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
            # drain student's tutor_joined + tutor's snapshot
            assert s_ws.receive_json()["type"] == "tutor_joined"
            assert t_ws.receive_json()["type"] == "snapshot"
            # tutor draws -> student receives it
            t_ws.send_json({"type": "stroke_start", "session_id": sid, "sender_role": "tutor",
                            "seq": 0, "payload": {"stroke_id": "t-1", "author": "tutor",
                                                  "color": "#b45309", "size": 3, "eraser": False,
                                                  "point": {"nx": 0.1, "ny": 0.2}}})
            got = s_ws.receive_json()
            assert got["type"] == "stroke_start"
            assert got["payload"]["stroke_id"] == "t-1"
    room_manager._rooms.clear()
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && python3 -m pytest app/tests/test_live_api.py::test_ws_tutor_message_relays_to_student -v`
Expected: FAIL — student receives nothing (tutor messages not relayed); test times out or errors on receive.

- [ ] **Step 3: Write minimal implementation**

In `backend/app/api/v1/live.py`, the receive loop currently has:

```python
            if role == "student":
                await room_manager.relay_to_tutors(session_id, msg.model_dump())
```

Replace with bidirectional relay:

```python
            # Bidirectional relay: student state mirrors to tutors; tutor actions
            # (shared drawing, etc.) broadcast to the student.
            if role == "student":
                await room_manager.relay_to_tutors(session_id, msg.model_dump())
            elif role == "tutor":
                await room_manager.broadcast_to_student(session_id, msg.model_dump())
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && python3 -m pytest app/tests/test_live_api.py -v`
Expected: PASS (all in file, including the existing relay/snapshot tests)

- [ ] **Step 5: Commit** — SKIP (no git).

---

## Task 5: useSharedDrawing hook — apply inbound + build outbound

**Files:**
- Create: `frontend/src/hooks/useSharedDrawing.js`
- Test: `frontend/src/hooks/useSharedDrawing.test.js`

Owns the merged stroke set for the current question. Applies inbound messages (from `lastByType` deltas is awkward for streaming; instead this hook is fed raw messages via an `applyMessage` function and holds state). Exposes local emit helpers that call a provided `send` and also update local state, plus `syncPayload()` for answering a peer join. Per-author isolation for undo/clear.

Because stroke streaming needs every message (not just the latest per type), this hook does NOT read `useLiveSession().lastByType`. Instead the caller wires the live connection's raw `onMessage` to `applyMessage`. Design the hook to be transport-agnostic: it takes `{ sessionId, author, send }` and returns `{ strokes, applyMessage, startStroke, extendStroke, endStroke, undo, clear, syncPayload, setQuestionId }`.

- [ ] **Step 1: Write the failing test**

```javascript
// frontend/src/hooks/useSharedDrawing.test.js
import { renderHook, act } from '@testing-library/react';
import { useSharedDrawing } from './useSharedDrawing';

function setup(author = 'tutor') {
  const send = jest.fn();
  const hook = renderHook(() => useSharedDrawing({ sessionId: 's1', author, send }));
  return { hook, send };
}

test('startStroke/extendStroke/endStroke build a local stroke and emit messages', () => {
  const { hook, send } = setup('tutor');
  let id;
  act(() => { id = hook.result.current.startStroke({ color: '#b45309', size: 3, eraser: false, point: { nx: 0.1, ny: 0.1 } }); });
  act(() => { hook.result.current.extendStroke(id, [{ nx: 0.2, ny: 0.2 }]); });
  act(() => { hook.result.current.endStroke(id); });

  const local = hook.result.current.strokes.filter((s) => s.author === 'tutor');
  expect(local).toHaveLength(1);
  expect(local[0].points.length).toBe(2);
  expect(send).toHaveBeenCalledWith(expect.objectContaining({ type: 'stroke_start' }));
  expect(send).toHaveBeenCalledWith(expect.objectContaining({ type: 'stroke_points' }));
  expect(send).toHaveBeenCalledWith(expect.objectContaining({ type: 'stroke_end' }));
});

test('applyMessage(stroke_start+points+end) adds a remote stroke', () => {
  const { hook } = setup('tutor');
  act(() => hook.result.current.applyMessage({ type: 'stroke_start', payload: { stroke_id: 'st-1', author: 'student', color: '#111827', size: 3, eraser: false, point: { nx: 0.5, ny: 0.5 } } }));
  act(() => hook.result.current.applyMessage({ type: 'stroke_points', payload: { stroke_id: 'st-1', points: [{ nx: 0.6, ny: 0.6 }] } }));
  act(() => hook.result.current.applyMessage({ type: 'stroke_end', payload: { stroke_id: 'st-1' } }));
  const remote = hook.result.current.strokes.filter((s) => s.author === 'student');
  expect(remote).toHaveLength(1);
  expect(remote[0].points).toHaveLength(2);
});

test('undo removes only the author’s own stroke', () => {
  const { hook, send } = setup('tutor');
  // remote student stroke
  act(() => hook.result.current.applyMessage({ type: 'stroke_start', payload: { stroke_id: 'st-1', author: 'student', color: '#111827', size: 3, eraser: false, point: { nx: 0, ny: 0 } } }));
  act(() => hook.result.current.applyMessage({ type: 'stroke_end', payload: { stroke_id: 'st-1' } }));
  // local tutor stroke
  let id;
  act(() => { id = hook.result.current.startStroke({ color: '#b45309', size: 3, eraser: false, point: { nx: 0.1, ny: 0.1 } }); });
  act(() => { hook.result.current.endStroke(id); });

  act(() => hook.result.current.undo());
  expect(hook.result.current.strokes.filter((s) => s.author === 'tutor')).toHaveLength(0);
  expect(hook.result.current.strokes.filter((s) => s.author === 'student')).toHaveLength(1);
  expect(send).toHaveBeenCalledWith(expect.objectContaining({ type: 'stroke_undo' }));
});

test('applyMessage(stroke_clear) removes only that author’s strokes', () => {
  const { hook } = setup('tutor');
  act(() => hook.result.current.applyMessage({ type: 'stroke_start', payload: { stroke_id: 'st-1', author: 'student', color: '#111827', size: 3, eraser: false, point: { nx: 0, ny: 0 } } }));
  act(() => hook.result.current.applyMessage({ type: 'stroke_end', payload: { stroke_id: 'st-1' } }));
  let id;
  act(() => { id = hook.result.current.startStroke({ color: '#b45309', size: 3, eraser: false, point: { nx: 0.1, ny: 0.1 } }); });
  act(() => { hook.result.current.endStroke(id); });

  act(() => hook.result.current.applyMessage({ type: 'stroke_clear', payload: { author: 'student' } }));
  expect(hook.result.current.strokes.filter((s) => s.author === 'student')).toHaveLength(0);
  expect(hook.result.current.strokes.filter((s) => s.author === 'tutor')).toHaveLength(1);
});

test('applyMessage(strokes_sync) replaces the syncing author’s strokes only', () => {
  const { hook } = setup('tutor');
  // existing student stroke
  act(() => hook.result.current.applyMessage({ type: 'stroke_start', payload: { stroke_id: 'st-old', author: 'student', color: '#111827', size: 3, eraser: false, point: { nx: 0, ny: 0 } } }));
  act(() => hook.result.current.applyMessage({ type: 'stroke_end', payload: { stroke_id: 'st-old' } }));
  // sync brings a different student set
  act(() => hook.result.current.applyMessage({ type: 'strokes_sync', payload: { question_id: 'q1', strokes: [
    { id: 'st-new', author: 'student', color: '#111827', size: 3, eraser: false, points: [{ nx: 0.9, ny: 0.9 }] },
  ] } }));
  const remote = hook.result.current.strokes.filter((s) => s.author === 'student');
  expect(remote.map((s) => s.id)).toEqual(['st-new']);
});

test('syncPayload returns this author’s strokes for the current question', () => {
  const { hook } = setup('tutor');
  act(() => hook.result.current.setQuestionId('q7'));
  let id;
  act(() => { id = hook.result.current.startStroke({ color: '#b45309', size: 3, eraser: false, point: { nx: 0.1, ny: 0.1 } }); });
  act(() => { hook.result.current.endStroke(id); });
  const payload = hook.result.current.syncPayload();
  expect(payload.question_id).toBe('q7');
  expect(payload.strokes.every((s) => s.author === 'tutor')).toBe(true);
  expect(payload.strokes).toHaveLength(1);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && CI=true npx react-scripts test --watchAll=false --testPathPattern="useSharedDrawing"`
Expected: FAIL — Cannot find module './useSharedDrawing'

- [ ] **Step 3: Write minimal implementation**

```javascript
// frontend/src/hooks/useSharedDrawing.js
import { useCallback, useRef, useState } from 'react';
import {
  buildStrokeStart, buildStrokePoints, buildStrokeEnd,
  buildStrokeUndo, buildStrokeClear, buildStrokesSync,
} from '../components/test/liveHelpers';

/**
 * Owns the merged (local + remote) stroke set for the current question of a
 * shared live-drawing surface. Transport-agnostic: the caller wires the live
 * connection's raw onMessage to `applyMessage`, and provides `send`.
 *
 * Strokes: { id, author, color, size, eraser, points:[{nx,ny}] }. Per-author
 * ownership — undo/clear only affect `author`'s own strokes; strokes_sync
 * replaces only the syncing author's set. In-memory only.
 */
export function useSharedDrawing({ sessionId, author, send }) {
  const [strokes, setStrokes] = useState([]);
  const counter = useRef(0);
  const questionIdRef = useRef(null);

  const setQuestionId = useCallback((qid) => { questionIdRef.current = qid; }, []);

  const startStroke = useCallback(({ color, size, eraser, point }) => {
    const id = `${author}-${++counter.current}`;
    const stroke = { id, author, color, size, eraser: !!eraser, points: [point] };
    setStrokes((prev) => [...prev, stroke]);
    if (send) send(buildStrokeStart(sessionId, author, { strokeId: id, color, size, eraser, point }));
    return id;
  }, [author, sessionId, send]);

  const extendStroke = useCallback((id, points) => {
    setStrokes((prev) => prev.map((s) => (s.id === id ? { ...s, points: [...s.points, ...points] } : s)));
    if (send) send(buildStrokePoints(sessionId, author, id, points));
  }, [author, sessionId, send]);

  const endStroke = useCallback((id) => {
    if (send) send(buildStrokeEnd(sessionId, author, id));
  }, [author, sessionId, send]);

  const undo = useCallback(() => {
    let removedId = null;
    setStrokes((prev) => {
      const mine = prev.filter((s) => s.author === author);
      if (mine.length === 0) return prev;
      removedId = mine[mine.length - 1].id;
      return prev.filter((s) => s.id !== removedId);
    });
    if (removedId && send) send(buildStrokeUndo(sessionId, author, removedId));
  }, [author, sessionId, send]);

  const clear = useCallback(() => {
    setStrokes((prev) => prev.filter((s) => s.author !== author));
    if (send) send(buildStrokeClear(sessionId, author));
  }, [author, sessionId, send]);

  const applyMessage = useCallback((msg) => {
    if (!msg || !msg.type) return;
    const p = msg.payload || {};
    switch (msg.type) {
      case 'stroke_start':
        setStrokes((prev) => {
          if (prev.some((s) => s.id === p.stroke_id)) return prev;
          return [...prev, { id: p.stroke_id, author: p.author, color: p.color, size: p.size, eraser: !!p.eraser, points: p.point ? [p.point] : [] }];
        });
        break;
      case 'stroke_points':
        setStrokes((prev) => prev.map((s) => (s.id === p.stroke_id ? { ...s, points: [...s.points, ...(p.points || [])] } : s)));
        break;
      case 'stroke_end':
        break; // finalization is implicit; nothing to change for freehand
      case 'stroke_undo':
        setStrokes((prev) => prev.filter((s) => s.id !== p.stroke_id));
        break;
      case 'stroke_clear':
        setStrokes((prev) => prev.filter((s) => s.author !== p.author));
        break;
      case 'strokes_sync':
        setStrokes((prev) => {
          const authors = new Set((p.strokes || []).map((s) => s.author));
          // Replace only the syncing author(s); keep others.
          const kept = prev.filter((s) => !authors.has(s.author));
          return [...kept, ...(p.strokes || [])];
        });
        break;
      default:
        break;
    }
  }, []);

  const syncPayload = useCallback(() => {
    const mine = strokes.filter((s) => s.author === author);
    return buildStrokesSync(sessionId, questionIdRef.current, mine).payload;
  }, [strokes, author, sessionId]);

  return { strokes, applyMessage, startStroke, extendStroke, endStroke, undo, clear, syncPayload, setQuestionId };
}

export default useSharedDrawing;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && CI=true npx react-scripts test --watchAll=false --testPathPattern="useSharedDrawing"`
Expected: PASS (6 passed)

- [ ] **Step 5: Commit** — SKIP (no git).

---

## Task 6: SharedDrawingSurface component

**Files:**
- Create: `frontend/src/components/live/SharedDrawingSurface.jsx`
- Test: `frontend/src/components/live/SharedDrawingSurface.test.js`
- Modify: `frontend/src/components/live/index.js` (export it)

A symmetric canvas overlay over a content box. Captures pointer events → normalized points → calls the stroke callbacks (throttled points). Renders all strokes (local + remote) by converting normalized → local pixels via `liveCoords`. Because canvas render is hard to unit-test in jsdom, the automated test covers the pure emit path via a helper `strokeEventsFromPointer` extracted from the component; full render is exercised in the E2E.

- [ ] **Step 1: Write the failing test**

```javascript
// frontend/src/components/live/SharedDrawingSurface.test.js
import { throttlePoints } from './SharedDrawingSurface';

test('throttlePoints batches points and flushes on interval boundary', () => {
  const flushed = [];
  const t = throttlePoints((pts) => flushed.push(pts), 100);
  t.add({ nx: 0.1, ny: 0.1 }, 0);
  t.add({ nx: 0.2, ny: 0.2 }, 50);   // within window -> buffered
  t.add({ nx: 0.3, ny: 0.3 }, 120);  // past window -> flush buffered (0.1,0.2), buffer 0.3
  expect(flushed.length).toBe(1);
  expect(flushed[0]).toHaveLength(2);
  t.flush();
  expect(flushed.length).toBe(2);
  expect(flushed[1]).toHaveLength(1);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && CI=true npx react-scripts test --watchAll=false --testPathPattern="SharedDrawingSurface"`
Expected: FAIL — Cannot find module './SharedDrawingSurface' / throttlePoints not exported.

- [ ] **Step 3: Write minimal implementation**

```jsx
// frontend/src/components/live/SharedDrawingSurface.jsx
import React, { useCallback, useEffect, useRef } from 'react';
import { renderStrokes } from '../../utils/strokeRenderer';
import { toNormalizedPoint, toLocalPoint, boxMetrics } from '../../utils/liveCoords';

/**
 * Time-based point batcher for mid-stroke streaming. Buffers points and flushes
 * the buffer when a point arrives more than `intervalMs` after the window start.
 * Exported for unit testing. `now` is passed in so tests are deterministic.
 */
export function throttlePoints(onFlush, intervalMs = 60) {
  let buffer = [];
  let windowStart = null;
  return {
    add(point, now) {
      if (windowStart === null) windowStart = now;
      if (now - windowStart >= intervalMs && buffer.length > 0) {
        onFlush(buffer);
        buffer = [];
        windowStart = now;
      }
      buffer.push(point);
    },
    flush() {
      if (buffer.length > 0) { onFlush(buffer); buffer = []; }
      windowStart = null;
    },
  };
}

/**
 * Symmetric shared-drawing canvas overlaying a content box. Used by both the
 * student (author='student') and tutor (author='tutor'). Strokes are normalized
 * to the content box so they align across window sizes.
 *
 * Props:
 *   contentBoxRef  - ref to the scrollable content element strokes anchor to
 *   active         - can this user draw right now
 *   author         - 'student' | 'tutor'
 *   penColor, size, eraser
 *   strokes        - merged stroke array [{id,author,color,size,eraser,points:[{nx,ny}]}]
 *   onStrokeStart(opts) -> returns strokeId ; onStrokePoints(id, points) ; onStrokeEnd(id)
 */
export default function SharedDrawingSurface({
  contentBoxRef, active, author, penColor = '#b45309', size = 3, eraser = false,
  strokes = [], onStrokeStart, onStrokePoints, onStrokeEnd,
}) {
  const canvasRef = useRef(null);
  const drawingId = useRef(null);
  const batcher = useRef(null);

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    const box = contentBoxRef?.current;
    if (!canvas || !box) return;
    const rect = canvas.getBoundingClientRect();
    if (canvas.width !== rect.width || canvas.height !== rect.height) {
      canvas.width = rect.width; canvas.height = rect.height;
    }
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const m = boxMetrics(box);
    for (const s of strokes) {
      const local = s.points.map((p) => toLocalPoint(p, m));
      renderStrokes(ctx, [{ color: s.color, size: s.size, eraser: s.eraser, points: local }]);
    }
  }, [strokes, contentBoxRef]);

  useEffect(() => { redraw(); }, [redraw]);

  // Redraw when the content box scrolls or resizes.
  useEffect(() => {
    const box = contentBoxRef?.current;
    if (!box) return undefined;
    const onScroll = () => redraw();
    box.addEventListener('scroll', onScroll, { passive: true });
    const ro = new ResizeObserver(redraw);
    ro.observe(box);
    return () => { box.removeEventListener('scroll', onScroll); ro.disconnect(); };
  }, [contentBoxRef, redraw]);

  const nowMs = () => (typeof performance !== 'undefined' ? performance.now() : 0);

  const handleDown = useCallback((e) => {
    if (!active) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    const box = contentBoxRef?.current;
    if (!box) return;
    const n = toNormalizedPoint(e.clientX, e.clientY, boxMetrics(box));
    const id = onStrokeStart && onStrokeStart({ color: eraser ? '#000000' : penColor, size, eraser, point: n });
    drawingId.current = id;
    batcher.current = throttlePoints((pts) => { if (drawingId.current) onStrokePoints && onStrokePoints(drawingId.current, pts); }, 60);
  }, [active, contentBoxRef, onStrokeStart, onStrokePoints, penColor, size, eraser]);

  const handleMove = useCallback((e) => {
    if (!active || !drawingId.current) return;
    const box = contentBoxRef?.current;
    if (!box) return;
    const n = toNormalizedPoint(e.clientX, e.clientY, boxMetrics(box));
    batcher.current.add(n, nowMs());
  }, [active, contentBoxRef]);

  const handleUp = useCallback(() => {
    if (!drawingId.current) return;
    if (batcher.current) batcher.current.flush();
    onStrokeEnd && onStrokeEnd(drawingId.current);
    drawingId.current = null;
  }, [onStrokeEnd]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0"
      style={{ pointerEvents: active ? 'all' : 'none', touchAction: 'none', cursor: active ? 'crosshair' : 'default' }}
      onPointerDown={handleDown}
      onPointerMove={handleMove}
      onPointerUp={handleUp}
      onPointerLeave={handleUp}
      aria-hidden="true"
    />
  );
}
```

Add to `frontend/src/components/live/index.js`:

```javascript
export { default as SharedDrawingSurface } from './SharedDrawingSurface';
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && CI=true npx react-scripts test --watchAll=false --testPathPattern="SharedDrawingSurface"`
Expected: PASS (1 passed)

Also confirm the live component tests still pass:
Run: `cd frontend && CI=true npx react-scripts test --watchAll=false --testPathPattern="components/live"`
Expected: all pass.

- [ ] **Step 5: Commit** — SKIP (no git).

---

## Task 7: Expose raw message stream from useLiveSession

**Files:**
- Modify: `frontend/src/hooks/useLiveSession.js`
- Test: `frontend/src/hooks/useLiveSession.test.js` (append)

`useSharedDrawing.applyMessage` needs EVERY inbound message, but `useLiveSession` currently only exposes `lastByType` (latest per type) — insufficient for streaming points. Add an optional `onMessage` callback prop that fires for every inbound message, without breaking existing consumers.

- [ ] **Step 1: Write the failing test (append)**

```javascript
test('calls onMessage for every inbound message when provided', async () => {
  const seen = [];
  let captured;
  liveService.connect.mockImplementation(async ({ onMessage, onStatusChange }) => {
    captured = { onMessage, onStatusChange };
    onStatusChange('connected');
    return { send: jest.fn(), close: jest.fn() };
  });
  renderHook(() => useLiveSession({ sessionId: 's-1', role: 'tutor', enabled: true, onMessage: (m) => seen.push(m) }));
  await waitFor(() => expect(captured).toBeTruthy());
  act(() => {
    captured.onMessage({ type: 'stroke_points', payload: { stroke_id: 'x', points: [] } });
    captured.onMessage({ type: 'stroke_points', payload: { stroke_id: 'x', points: [] } });
  });
  expect(seen.filter((m) => m.type === 'stroke_points')).toHaveLength(2);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && CI=true npx react-scripts test --watchAll=false --testPathPattern="useLiveSession"`
Expected: FAIL — onMessage prop not wired; `seen` empty.

- [ ] **Step 3: Write minimal implementation**

In `frontend/src/hooks/useLiveSession.js`, the hook signature destructures `{ sessionId, role, enabled }`. Add `onMessage`. In the internal `handleMessage` callback (which currently updates snapshot/lastByType), also invoke the external callback. Keep it stable via a ref to avoid reconnect churn:

```javascript
export function useLiveSession({ sessionId, role, enabled = true, onMessage }) {
  // ...existing state...
  const onMessageRef = useRef(onMessage);
  useEffect(() => { onMessageRef.current = onMessage; }, [onMessage]);

  const handleMessage = useCallback((msg) => {
    if (!msg || !msg.type) return;
    msg._rx = ++rxCounter.current;
    if (msg.type === 'snapshot') setSnapshot(msg.payload);
    setLastByType((prev) => ({ ...prev, [msg.type]: msg }));
    if (onMessageRef.current) onMessageRef.current(msg);   // NEW
  }, []);
  // ...rest unchanged...
}
```

(Do NOT add `onMessage` to the connection effect's deps — it's read via ref, so it won't cause reconnects. Keep the existing eslint-disable on the deps array.)

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && CI=true npx react-scripts test --watchAll=false --testPathPattern="useLiveSession"`
Expected: PASS (all in file)

- [ ] **Step 5: Commit** — SKIP (no git).

---

## Task 8: Tutor watch view — content-anchored shared drawing

**Files:**
- Modify: `frontend/src/pages/tutor/LiveSessionsPage.jsx`
- Test: `frontend/src/pages/tutor/LiveSessionsPage.test.js` (keep existing 2 list tests passing)

Rework `LiveWatchView`: wrap the rendered question content in a scrollable `contentBoxRef` div at a fixed relative width, mount `SharedDrawingSurface` (author='tutor', active) over it, wire `useSharedDrawing` fed by `useLiveSession`'s `onMessage`. Remove the Phase-1 `LiveStrokeLayer` + `sourceWidth/sourceHeight` scaling. Add a minimal tutor draw toolbar (tutor signature color fixed; Undo + Clear for own ink).

- [ ] **Step 1: Update the existing test file's mocks (so it still runs)**

The existing `LiveSessionsPage.test.js` mocks `../../hooks` (useLiveSession) and `../../services/liveService`. It must also tolerate the new `useSharedDrawing` import (which imports liveHelpers → no axios, safe) and `SharedDrawingSurface` (imports strokeRenderer/liveCoords → safe). No new mock needed, but VERIFY by running the existing tests after implementation. Keep the two list tests unchanged.

- [ ] **Step 2: Implement LiveWatchView**

Replace the `LiveWatchView` function in `LiveSessionsPage.jsx`. Add imports:

```javascript
import { useRef } from 'react';  // ensure useRef imported alongside existing hooks
import { TutorLivePanel, SharedDrawingSurface } from '../../components/live';
import useSharedDrawing from '../../hooks/useSharedDrawing';
```

(Remove `LiveStrokeLayer` from the components/live import if it's no longer used in this file.)

New `LiveWatchView`:

```jsx
const TUTOR_INK = '#b45309'; // amber/bronze signature

function LiveWatchView({ sessionId }) {
  const contentBoxRef = useRef(null);
  const shared = useSharedDrawing({ sessionId, author: 'tutor', send: (m) => sendRef.current && sendRef.current(m) });
  const sendRef = useRef(null);
  const [eraser, setEraser] = useState(false);

  const { status, snapshot, lastByType, send } = useLiveSession({
    sessionId, role: 'tutor', enabled: true,
    onMessage: (m) => shared.applyMessage(m),
  });
  sendRef.current = send;

  const qChanged = lastByType?.question_changed?.payload;
  const answer = lastByType?.answer_selected?.payload
    || (snapshot ? { question_id: snapshot.question_id, selected_answer: snapshot.selected_answer } : null);
  const currentQuestionId =
    qChanged?.question_id
    || lastByType?.answer_selected?.payload?.question_id
    || snapshot?.question_id
    || null;
  const questionIndex = qChanged?.question_index ?? snapshot?.question_index ?? null;

  const [detail, setDetail] = useState(null);
  useEffect(() => {
    if (!currentQuestionId) { setDetail(null); return undefined; }
    shared.setQuestionId(currentQuestionId);
    let active = true;
    getQuestionDetail(currentQuestionId)
      .then((r) => { if (active) setDetail(r.data); })
      .catch(() => { if (active) setDetail(null); });
    return () => { active = false; };
  }, [currentQuestionId]); // eslint-disable-line react-hooks/exhaustive-deps

  // When the tutor's content renders (detail changes), re-sync our own ink so a
  // reconnected/newly-rendered surface reflects it. (Cheap; only tutor strokes.)
  useEffect(() => {
    if (detail && send) send({ type: 'strokes_sync', session_id: sessionId, sender_role: 'tutor', seq: 0, payload: shared.syncPayload() });
  }, [detail]); // eslint-disable-line react-hooks/exhaustive-deps

  const selected = answer?.selected_answer;
  const selectedIdx = typeof selected === 'number' ? selected : null;
  let studentIsCorrect = false;
  if (detail && selected != null) {
    if (detail.answer_type === 'MCQ') studentIsCorrect = selectedIdx != null && correctIndex(detail) === selectedIdx;
    else {
      const accepted = (detail.correct_answer_json?.answers || []).map((a) => String(a).trim());
      studentIsCorrect = accepted.includes(String(selected).trim());
    }
  }
  const studentSelectedLabel = selectedIdx != null ? (LETTERS[selectedIdx] || String(selected)) : selected;

  return (
    <div className="flex h-full">
      <div className="flex-1 overflow-hidden p-6">
        <Link to="/tutor/live" className="text-sm text-brand-600">← Back to live</Link>
        <div className="mb-2 mt-2 flex items-center justify-between">
          <span className="text-xs text-ink-muted">{status === 'connected' ? 'Live' : 'Reconnecting…'}</span>
          {detail && (
            <div className="flex items-center gap-2">
              <span className="inline-block h-3 w-3 rounded-full" style={{ backgroundColor: TUTOR_INK }} aria-hidden="true" />
              <span className="text-xs text-ink-muted">Your ink</span>
              <button type="button" onClick={() => setEraser((v) => !v)}
                className={`rounded-lg border border-edge px-2 py-1 text-xs font-semibold ${eraser ? 'bg-brand-600 text-white' : 'text-ink-body'}`}>Eraser</button>
              <button type="button" onClick={() => shared.undo()} className="rounded-lg border border-edge px-2 py-1 text-xs font-semibold text-ink-body">Undo</button>
              <button type="button" onClick={() => shared.clear()} className="rounded-lg border border-edge px-2 py-1 text-xs font-semibold text-ink-body">Clear mine</button>
            </div>
          )}
        </div>
        {detail ? (
          <div ref={contentBoxRef} className="relative mx-auto max-w-2xl overflow-y-auto" style={{ maxHeight: 'calc(100vh - 220px)' }}>
            <QuestionDisplay
              questionNumber={(questionIndex ?? 0) + 1}
              questionHtml={detail.prompt_html}
              stimulusHtml={undefined}
              questionId={detail.question_id}
              hideMarkForReview
              onReport={() => {}}
            />
            {detail.answer_type === 'MCQ' && (
              <ul className="mt-4 space-y-2 px-6">
                {(detail.choices || []).map((c, i) => {
                  const isPicked = selectedIdx === i;
                  const isCorrect = correctIndex(detail) === i;
                  const cls = isCorrect ? 'border-emerald-300' : isPicked ? 'border-rose-500 bg-rose-50' : 'border-edge';
                  return (
                    <li key={i} className={`rounded-lg border px-3 py-2 text-sm text-ink-body ${cls}`}
                      dangerouslySetInnerHTML={{ __html: `<strong>${LETTERS[i] || '?'}.</strong> ${c}${isPicked ? ' — student picked' : ''}${isCorrect ? ' — correct' : ''}` }} />
                  );
                })}
              </ul>
            )}
            <SharedDrawingSurface
              contentBoxRef={contentBoxRef}
              active={!!detail}
              author="tutor"
              penColor={TUTOR_INK}
              eraser={eraser}
              strokes={shared.strokes}
              onStrokeStart={(opts) => shared.startStroke(opts)}
              onStrokePoints={(id, pts) => shared.extendStroke(id, pts)}
              onStrokeEnd={(id) => shared.endStroke(id)}
            />
          </div>
        ) : (
          <div className="text-ink-muted">Waiting for the student’s current question…</div>
        )}
      </div>
      <TutorLivePanel
        correctAnswerLabel={correctAnswerLabel(detail)}
        explanationHtml={detail?.explanation_html || ''}
        studentStatus={{ answered: selected != null, correct: studentIsCorrect, selectedLabel: studentSelectedLabel }}
      />
    </div>
  );
}
```

Note the hook-ordering: `sendRef` must be declared before `useSharedDrawing` uses it. Reorder so `const sendRef = useRef(null);` comes first, then `useSharedDrawing`, then `useLiveSession`, then `sendRef.current = send;`. Adjust to satisfy the linter (no use-before-define). Verify with the build.

- [ ] **Step 3: Run existing tests + build**

Run: `cd frontend && CI=true npx react-scripts test --watchAll=false --testPathPattern="LiveSessionsPage"`
Expected: PASS (2 list tests still pass — watch view isn't rendered by them).

Run: `cd frontend && CI=true npm run build`
Expected: Compiled successfully.

- [ ] **Step 4: Commit** — SKIP (no git).

---

## Task 9: Student side — mount the shared surface on live pages

**Files:**
- Modify: `frontend/src/hooks/useStudentLiveEmit.js` (expose shared-drawing wiring)
- Modify: `frontend/src/components/test/DrawingCanvas.jsx` (delegate to normalized capture when live)
- Modify: the three direct student pages + `ModuleTestInterface.jsx` (pass the content box)
- Test: build gate + existing tests remain green.

This is the highest-risk integration. Approach: the student's existing `DrawingCanvas` keeps its non-live behavior. When live-enabled, the student page ALSO mounts a `SharedDrawingSurface` over the question content box so the student both draws AND sees the tutor's ink in the same coordinate space. To avoid two capture layers fighting, when live is active the student draws via the SharedDrawingSurface (author='student') and the legacy DrawingCanvas overlay is suppressed (its `isActive` gated off when a live session is present), OR the pages keep using DrawingCanvas for the toolbar but route its strokes through normalized coords.

Given the complexity and that DrawingCanvas's world-space capture differs fundamentally from normalized, the SIMPLEST correct approach for this phase: **on live-enabled student pages, use SharedDrawingSurface as the drawing layer** (student author), reusing the page's existing draw-toggle and a content box ref, and keep DrawingCanvas only for non-live. This is a page-level swap gated on `live?.enabled`/`liveSessionId`.

READ each page fully. For each live-enabled student page (AdaptivePracticePage, PracticeTestTakingPage, TestPage), and for ModuleTestInterface (full-length):
1. Identify the question content container element and attach a `contentBoxRef` to it (the scrollable element wrapping QuestionDisplay/passage).
2. Wire `useSharedDrawing({ sessionId, author:'student', send })` where `send` comes from the existing live channel (via `useStudentLiveEmit`, which uses `useLiveSession`). Extend `useStudentLiveEmit` to also accept/return an `onMessage` passthrough and a `shared` bundle so pages don't each re-wire.
3. When the existing draw toggle is on AND live is enabled, render `<SharedDrawingSurface author="student" active strokes={shared.strokes} ...>` over the content box instead of (or above) the legacy DrawingCanvas. When not live, keep DrawingCanvas exactly as-is.
4. On tutor_joined (from lastByType) or reconnect, send `strokes_sync` with the student's own strokes.

Because this spans several large files, implement it incrementally and lean on the build + a manual E2E rather than new unit tests (the pure logic is already covered in Tasks 1/5/6). Extend `useStudentLiveEmit` first (add `onMessage` passthrough to its internal `useLiveSession` and expose a `useSharedDrawing`-backed `shared` object bound to `author:'student'`), with a focused unit test:

- [ ] **Step 1: Extend useStudentLiveEmit — failing test**

```javascript
// append to frontend/src/hooks/useStudentLiveEmit.test.js
test('exposes a shared drawing bundle bound to the student author', () => {
  const { setup } = require('./__testutils_useStudentLiveEmit') // if a helper exists; else inline mock
});
```

Simpler: add to the existing `useStudentLiveEmit.test.js` (which already mocks `./useLiveSession`):

```javascript
test('provides shared.startStroke that emits a student-authored stroke_start', () => {
  const { send } = setup();  // existing helper in this file that mocks useLiveSession return incl. send
  const { result } = renderHook(() =>
    useStudentLiveEmit({ enabled: true, sessionId: 's-1', currentQuestionId: 'q-1', currentQuestionIndex: 0 })
  );
  act(() => { result.current.shared.startStroke({ color: '#111827', size: 3, eraser: false, point: { nx: 0.1, ny: 0.1 } }); });
  expect(send).toHaveBeenCalledWith(expect.objectContaining({ type: 'stroke_start', sender_role: 'student' }));
});
```

(Match the existing test file's `setup`/mock pattern — READ it first; it mocks `useLiveSession` default export returning `{status, snapshot, lastByType, send}`.)

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && CI=true npx react-scripts test --watchAll=false --testPathPattern="useStudentLiveEmit"`
Expected: FAIL — `result.current.shared` undefined.

- [ ] **Step 3: Implement**

In `useStudentLiveEmit.js`: import `useSharedDrawing`. Pass an `onMessage` to the internal `useLiveSession` that forwards to the shared hook's `applyMessage`, and instantiate `useSharedDrawing({ sessionId, author: 'student', send })` using the same `send`. Return `shared` alongside the existing `{ indicator, emitAnswer, emitStrokeBatch }`. Keep everything gated on `enabled` (when disabled, `send` is a no-op and the surface won't be mounted anyway).

```javascript
// inside useStudentLiveEmit, after obtaining { lastByType, send } from useLiveSession:
const shared = useSharedDrawing({ sessionId, author: 'student', send });
// wire inbound: add onMessage to the useLiveSession call:
//   useLiveSession({ sessionId, role: 'student', enabled: !!enabled, onMessage: shared.applyMessage })
// keep currentQuestionId in sync:
useEffect(() => { if (currentQuestionId) shared.setQuestionId(currentQuestionId); }, [currentQuestionId]); // eslint-disable-line
// ...
return { indicator, emitAnswer, emitStrokeBatch, shared };
```

- [ ] **Step 4: Run test + build**

Run: `cd frontend && CI=true npx react-scripts test --watchAll=false --testPathPattern="useStudentLiveEmit|useSharedDrawing|useLiveSession"`
Expected: all pass.

Run: `cd frontend && CI=true npm run build`
Expected: Compiled successfully.

- [ ] **Step 5: Wire the pages (build-gated, no unit tests)**

For AdaptivePracticePage, PracticeTestTakingPage, TestPage: add a `contentBoxRef` to the scrollable question container; when `liveSessionId` is set AND the page's draw toggle is on, render `<SharedDrawingSurface author="student" active strokes={shared.strokes} contentBoxRef={contentBoxRef} penColor={...} eraser={...} onStrokeStart/Points/End={shared...}>` where `shared` comes from the page's `useStudentLiveEmit(...)`. Keep the legacy `<DrawingCanvas>` for the non-live path (render it only when `!liveSessionId`). Re-send `strokes_sync` on `tutor_joined`.

Do the same in ModuleTestInterface for full-length, using its own inline live wiring (it doesn't use useStudentLiveEmit — it has inline useLiveSession; add a `useSharedDrawing` there bound to author='student' with its `liveSend`, and mount the surface over its question container).

After each file, run `CI=true npm run build` and fix any error before moving on. This step has no unit test; correctness is verified by the E2E in Task 10.

- [ ] **Step 6: Commit** — SKIP (no git).

---

## Task 10: Full verification + two-context E2E

**Files:** none (verification only)

- [ ] **Step 1: Frontend suite + build**

Run: `cd frontend && CI=true npx react-scripts test --watchAll=false`
Expected: all suites pass.
Run: `cd frontend && CI=true npm run build`
Expected: Compiled successfully.

- [ ] **Step 2: Backend suite**

Run: `cd backend && python3 -m pytest app/tests/ -q`
Expected: all pass.

- [ ] **Step 3: Two-context manual E2E (Chrome DevTools MCP isolatedContext)**

With both servers running: student in the default context (login e@g.c), tutor in an isolatedContext (login t@g.c). Start an adaptive session as the student; join live as the tutor. Verify:
1. Tutor draws → strokes appear on the student's screen in the tutor signature color.
2. Student draws → strokes appear on the tutor's screen in the student's color.
3. Strokes land on the SAME content position on both, even when the two windows are different sizes (resize one).
4. Each can Undo/Clear only their own ink; the other's remains.
5. Mid-stroke streaming is visible (line appears as it's drawn, not only on pointer-up).
6. Tutor joins mid-drawing → existing strokes resync onto the tutor view.
7. Scroll the student; strokes stay anchored to the right content on both sides.

Record pass/fail per item; fix regressions before declaring done.

- [ ] **Step 4: Docs**

Update `README.md` Live Tutor Sessions bullet to note bidirectional shared drawing (was observe-only). Add a line to `docs/CODEBASE_ORGANIZATION.md` for `utils/liveCoords.js`, `hooks/useSharedDrawing.js`, `components/live/SharedDrawingSurface.jsx`.

- [ ] **Step 5: Commit** — SKIP (no git).

---

## Self-Review Notes

- **Spec coverage:** normalized coords (T1), bidirectional transport (T3 schema, T4 relay), stroke message builders (T2), shared state + per-author undo/clear/sync (T5), symmetric surface + streaming throttle (T6), raw message stream for streaming (T7), tutor content-anchored view + toolbar + Phase-1 scaling removal (T8), student surfaces + sync-on-join (T9), E2E for alignment/color/ownership/streaming/resync/scroll (T10). Color-coding via `author` tag + `TUTOR_INK` (T6/T8). In-memory resync via `strokes_sync` (T5/T8/T9).
- **Type consistency:** stroke shape `{id, author, color, size, eraser, points:[{nx,ny}]}` used in T5/T6/T8/T9; message builders (T2) ↔ schema types (T3) ↔ applyMessage cases (T5) all match: stroke_start/points/end/undo/clear/strokes_sync/viewport. `boxMetrics/toNormalizedPoint/toLocalPoint` (T1) consumed in T6. `useSharedDrawing` API (T5) consumed in T8/T9.
- **Known risk flagged:** T9 spans large files with no new unit tests (relies on build + E2E); the pure logic it orchestrates is fully unit-tested in T1/T5/T6. The extract-vs-swap decision for DrawingCanvas is resolved to "page-level swap: SharedDrawingSurface for live, DrawingCanvas for non-live" to avoid reworking DrawingCanvas's world-space capture.
- **viewport/scroll-sync:** message type reserved (T3) and student→tutor scroll sync is described in the spec; T8/T9 include re-sync but full scroll-fraction mirroring is minimal (tutor scrolls its own pane). If the E2E shows misalignment from independent scroll, that's the follow-up lever — noted, not silently dropped.
