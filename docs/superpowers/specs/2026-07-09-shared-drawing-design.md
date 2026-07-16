# Phase 2: Shared Live Drawing — Design Spec

**Date:** 2026-07-09
**Status:** Approved for planning
**Register:** product (student + tutor surfaces)
**Builds on:** `2026-07-07-live-tutor-session-design.md` (Phase 1, shipped)

## Summary

Turn the Phase-1 one-way drawing mirror into a **bidirectional, color-coded shared
whiteboard** with **pixel-aligned strokes** across the student and tutor screens.
Both participants draw on the same logical surface; each author's strokes are
tagged and rendered in a distinct color; each author manages only their own ink.
Strokes stream live (mid-stroke) and are kept in memory only (resync on join).

The keystone is a **normalized content-anchored coordinate system**: stroke points
are stored as fractions of a shared question-content box, so a point at 0.5×width
lands on the same word on both machines regardless of window size or scroll. This
supersedes the Phase-1 raw-pixel + dimension-scaling workaround.

## Goals

- Tutor can draw; strokes appear on the student's screen live, and vice-versa.
- Strokes are **color-coded by author** on one shared, merged layer.
- Strokes **align to the same content position** on both screens (pixel-perfect
  relative to the question content, independent of window size / scroll).
- Each author can undo/erase **only their own** strokes.
- Strokes **stream mid-stroke** (throttled) for a live "watch it being drawn" feel.
- Tutor's watch view renders the student's **real question/passage HTML** at the
  same relative width (content-anchored), with **synced scroll**, so the shared
  surface is visually identical enough for normalized coords to align.
- No new DB tables. In-memory resync: each side is source of truth for its own
  ink and re-sends on join/reconnect.

## Non-Goals (explicitly out of scope)

- Full test-chrome replica on the tutor side (calculator panel, reference sheet,
  toolbars, split-pane resizing). Content-anchored only.
- Cross-author erase/undo (tutor erasing student ink or vice-versa).
- Database persistence / async review of drawings / replay.
- Live cursor, shared highlight, remote navigation, tutor-triggered reveal
  (separate Phase-2 features; not this spec).
- Drawing on anything other than the current question's content box.

## Context (current state, verified)

- **WS relay is one-directional** (`backend/app/api/v1/live.py:227` —
  `if role == "student": relay_to_tutors`). `LiveRoomManager` already has
  `broadcast_to_student` and `relay_to_tutors`.
- **Message envelope** (`app/schemas/live.py`): `{type, session_id, sender_role,
  seq, payload}`; `type` is a `Literal` allow-list; `stroke_batch` already exists.
- **DrawingCanvas** (`frontend/src/components/test/DrawingCanvas.jsx`) is
  student-only. Points are world-space X (calculator-offset-independent) +
  document-space Y (scroll-relative), rendered on a full-page fixed overlay.
  It owns the toolbar, per-question `strokesMap`, undo, clear, eraser. It calls
  `onStrokeBatch(qId, strokes, dims)` on pointer-up (Phase-1 streaming of
  completed strokes + canvas dims).
- **Tutor watch view** (`frontend/src/pages/tutor/LiveSessionsPage.jsx`
  `LiveWatchView`) renders a simplified `QuestionDisplay` (prompt only) + a plain
  choices list + a read-only `LiveStrokeLayer` scaled by streamed dims.
- **Shared render helper** `frontend/src/utils/strokeRenderer.js` supports
  `offsetX/offsetY/scaleX/scaleY`.
- **`useStudentLiveEmit`** (`frontend/src/hooks/useStudentLiveEmit.js`) wraps
  `useLiveSession` for the direct student pages; emits question_changed /
  answer_selected / stroke_batch.

## Architecture

### 1. Normalized content-anchored coordinates (the keystone)

New module `frontend/src/utils/liveCoords.js`. A **content box** is the DOM
element wrapping the question/passage content that both sides render (the element
`QuestionDisplay`/`HighlightableText` render into). Define:

- **Normalized point:** `{ nx, ny }` where
  - `nx = (clientX - boxLeft) / boxWidth` — fraction of content width (0..1, may
    slightly exceed for margins; not clamped).
  - `ny = (clientY - boxTop + boxScrollTop) / boxScrollHeight` — fraction of the
    full scrollable content height, anchored to content (scroll-independent).
- **To local pixels (for rendering on a given box):**
  - `x = nx * boxWidth`
  - `y = ny * boxScrollHeight - boxScrollTop` (subtract viewport scroll to place
    within the visible canvas).

Functions: `toNormalizedPoint(clientX, clientY, box)`,
`toLocalPoint({nx, ny}, box)`, `boxMetrics(el)` (returns
`{left, top, width, scrollTop, scrollHeight}` from getBoundingClientRect +
scroll props). Pure, unit-tested. Because both sides render the same HTML at the
same relative width, equal `nx/ny` map to the same visual location.

**Stroke shape (shared/live):**
```
{ id, author: 'student'|'tutor', color, size, eraser, points: [{nx, ny}, ...] }
```
`id` is a per-stroke unique string (author + counter) enabling mid-stroke
streaming and per-author undo. Colors: student keeps their palette; tutor ink
defaults to a distinct signature color (amber/bronze `brand-600`), student ink
to their chosen color (author still recorded so ownership is unambiguous even if
colors coincide).

### 2. Bidirectional transport

`backend/app/api/v1/live.py` WS loop: relay in **both** directions.
- student messages → `relay_to_tutors` (unchanged)
- tutor messages → `broadcast_to_student` (NEW)
Keep heartbeat drop. Both still ignore malformed. Add new message types to the
`Literal` in `app/schemas/live.py`:
- `stroke_start` — `{stroke_id, author, color, size, eraser, point:{nx,ny}}`
- `stroke_points` — `{stroke_id, points:[{nx,ny}, ...]}` (incremental, throttled)
- `stroke_end` — `{stroke_id}`
- `stroke_undo` — `{author, stroke_id}` (removes one stroke)
- `stroke_clear` — `{author}` (removes all of an author's strokes for the current question)
- `strokes_sync` — `{question_id, strokes:[full stroke objects]}` (resync on join)

`stroke_batch` (Phase 1, completed-stroke) is retained for backward compat but
the live path now uses start/points/end. Relay is role-gated only for direction,
not per-type: any of these from a student go to tutors, from a tutor go to the
student. Server does not interpret stroke contents.

### 3. Shared drawing surface component

New `frontend/src/components/live/SharedDrawingSurface.jsx` — a canvas overlay
positioned over a referenced content box, driven by normalized strokes. Unlike
the student-only `DrawingCanvas`, it is **symmetric** (used by both roles):
- Props: `contentBoxRef`, `active` (can this user draw now), `author`
  ('student'|'tutor'), `penColor`, `eraser`, `localStrokes`, `remoteStrokes`,
  and callbacks `onStrokeStart/onStrokePoints/onStrokeEnd/onUndo/onClear`.
- Captures pointer events → normalized points via `liveCoords` → emits
  incremental stroke events (throttled ~60ms for `stroke_points`).
- Renders all strokes (local + remote) via `strokeRenderer`, converting each
  normalized point to local pixels with the current content-box metrics; redraws
  on scroll/resize of the content box.
- Per-author undo/clear operate only on `author`-owned strokes.

The existing student `DrawingCanvas` is refactored to delegate its capture/render
to this surface (or is replaced by it on live-enabled surfaces). To bound risk:
DrawingCanvas keeps its toolbar + per-question storage + world-space behavior for
**non-live** use; when live is enabled it switches to normalized capture and
feeds the shared surface. (Plan will decide extract-vs-wrap after reading both;
the coordinate module and SharedDrawingSurface are the stable interfaces.)

### 4. Tutor content-anchored watch view

`LiveWatchView` renders the student's real question/passage HTML in a scrollable
pane at the same relative width as the student's content column, wrapping it in a
`contentBoxRef`, and mounts a `SharedDrawingSurface` (author='tutor', active).
Scroll is synced: student streams a lightweight `viewport` message
(`{scrollFraction}` of the content box) and the tutor's pane scrolls to match
(and optionally vice-versa). The tutor gets the drawing toolbar (color fixed to
tutor signature; eraser/undo/clear for own ink). The Phase-1 read-only
`LiveStrokeLayer` + dimension-scaling is **removed** from this view (superseded).

### 5. Shared surface state hook

New `frontend/src/hooks/useSharedDrawing.js` — owns the merged stroke set for a
session+question: applies inbound `stroke_start/points/end/undo/clear/sync`
messages into remote-stroke state, exposes local-stroke state + emit helpers that
send the outbound messages via the live channel, and produces a `strokes_sync`
payload on demand (for answering a peer's join). Used by both the student live
surface and the tutor watch view. `useStudentLiveEmit` is extended (or composes
this) so the student side drives the shared surface.

## Data Flow

1. Student or tutor begins a stroke → `stroke_start` (with new id, author, style,
   first normalized point) → relayed to the peer → peer creates a pending stroke.
2. Pointer moves → throttled `stroke_points` (batched normalized points) → peer
   appends to the pending stroke and redraws incrementally.
3. Pointer up → `stroke_end` → peer finalizes the stroke.
4. Undo → `stroke_undo{author, stroke_id}` → peer removes it. Clear →
   `stroke_clear{author}` → peer removes that author's strokes for the question.
5. **Join/reconnect:** when a peer connects (tutor_joined, or student reconnect),
   each side sends `strokes_sync` for the current question so the newcomer gets
   the full current drawing. Each side is authoritative for its own author's
   strokes; on receiving a sync, replace that author's remote strokes.
6. **Question change:** strokes are per-question; changing questions clears the
   live surface and syncs the new question's strokes (each side re-sends its own).
7. **Scroll:** student emits `viewport{scrollFraction}`; tutor pane matches so the
   same content region is visible under the shared coordinates.

## Error Handling & Edge Cases

- **Reconnect mid-stroke:** a `stroke_start` without a matching `stroke_end`
  (peer dropped) is finalized on the next `strokes_sync` (authoritative replace)
  or discarded after a short idle; never leaves a dangling pending stroke.
- **Out-of-order points:** `stroke_points` append in arrival order; acceptable
  for freehand (minor jitter only). `stroke_id` scopes points to their stroke.
- **Author color collision:** rendering is by author tag, not color; ownership
  for undo/erase always uses `author`, never color.
- **Content box not yet mounted / different content:** if the tutor's question
  detail hasn't loaded, the surface shows nothing and buffers inbound strokes
  keyed by question_id; applies once the box exists.
- **Normalized point slightly out of [0,1]:** allowed (margins); not clamped, so
  marginalia render faithfully.
- **Socket drop:** unchanged from Phase 1 — drawing is non-essential; the
  student's test/answers are unaffected. On reconnect, `strokes_sync` restores.
- **No tutor connected:** student draws normally; stroke messages relay to an
  empty tutor set (no-op), exactly as Phase 1.

## Testing Strategy

- **Unit — `liveCoords.js`:** round-trip normalize→local at different box sizes
  yields the same *relative* position; scroll offset handled; edge fractions.
- **Unit — `useSharedDrawing.js`:** applying start/points/end builds a stroke;
  undo removes only the matching id; clear removes only that author; sync
  replaces an author's set; per-author isolation.
- **Component — `SharedDrawingSurface`:** pointer events produce normalized
  emits (mock coords); inbound strokes render (assert `renderStrokes` calls);
  redraw on scroll/resize.
- **Backend — bidirectional relay:** `TestClient.websocket_connect` — a tutor
  message reaches the student; a student message reaches tutors; new stroke_*
  types pass the schema; malformed dropped.
- **Backend — schema:** the new message types validate; unknown still rejected.
- **Manual/E2E (isolated contexts):** two browsers, student + tutor draw
  simultaneously; strokes appear color-coded on both; alignment holds when the
  two windows are different sizes; each undoes only their own; join mid-drawing
  resyncs; scroll sync keeps strokes over the right content.

## Migration / Cleanup of Phase-1 bits

- Remove the read-only `LiveStrokeLayer` + `sourceWidth/sourceHeight` scaling
  from `LiveWatchView` (superseded by the shared surface). `LiveStrokeLayer` and
  the `strokeRenderer` scale params may remain for any other consumer, but the
  watch view stops using dimension-scaling.
- The Phase-1 `stroke_batch` message + `buildStrokeBatchMessage` remain valid but
  are no longer the live drawing path; the shared surface uses stroke_* events.
  (Keep `stroke_batch` handling so nothing breaks; note it as legacy.)

## Rollout note

Coordinate module + schema/transport + `useSharedDrawing` are the stable
interfaces; the DrawingCanvas rework and the tutor content-anchored view are the
higher-risk integration steps and come last, after the pure pieces are tested.
