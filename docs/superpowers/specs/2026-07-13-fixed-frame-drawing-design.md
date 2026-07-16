# Fixed Content Frame + Per-Question Shared Drawing — Design Spec

**Date:** 2026-07-13
**Status:** Approved for planning
**Register:** product (student + tutor surfaces)
**Builds on:** `2026-07-09-shared-drawing-design.md` (Phase 2 bidirectional drawing, shipped)

## Summary

Make live drawing align **1:1 between student and tutor on every device**, and give
**each question its own drawing**. The mechanism is a shared **`QuestionFrame`**: a
fixed-dimension canonical "page" (**820 × 1160 logical units**) that renders the
question/passage/choices identically everywhere by scaling as one unit (uniform CSS
`transform: scale`). The drawing canvas is a sibling layer inside the same frame at the
same logical dimensions, so a stroke at logical (410, 300) sits on the same content on a
phone, a laptop, and the tutor's screen. Panels (calculator, answer sidebar) **overlay
on top** of the frame instead of shifting content. Strokes are keyed per question and
saved/restored on navigation, in memory for the live session.

## Goals

- **Exact 1:1 alignment**: identical content layout + identical logical coordinate space
  on student and tutor, across devices and window sizes. Ink lands on the same spot for
  everyone.
- **Fixed content frame**: question content renders into an 820×1160 logical page that
  scales uniformly to fit its container (document/PDF model), never reflows.
- **Panels overlay, never shift**: opening the calculator or any sidebar floats above the
  frame; the content and its drawing never move. Removes the `mr-[440px]` shift.
- **Per-question drawings**: each question keeps its own stroke set; navigating away hides
  it and returning restores it. Both roles see the drawing for the currently-shown
  question. In-memory for the session (no DB).
- **One shared `QuestionFrame` component** used by all live-capable surfaces, eliminating
  the current 4-way layout duplication.
- **Draw mode is a toggle, off by default**: canvas is `pointer-events:none` when off
  (answers clickable); captures drawing when on.

## Non-Goals

- Database persistence of drawings / async review / replay (stays in-memory).
- Reworking non-live surfaces' layout beyond adopting the shared frame.
- Scroll-syncing the tutor's viewport to the student's (each scrolls independently; the
  frame is fixed-size so within a question there's minimal scroll anyway).
- Changing the WS transport, auth, room model, or the answer/question_changed flow.
- Calculator/reference-sheet internals (only how they're layered changes).

## Context (current state, verified)

- **Divergence sources that break alignment today** (from exploration): container width
  differs per surface (`max-w-2xl` tutor vs `max-w-3xl`/`max-w-4xl`/fluid students); the
  `mr-[440px]` calculator margin physically shifts content left on 3 student surfaces;
  draggable `SplitPane` (default 50%, min 25/35) with no shared position; prose/font
  variants; MathJax; inconsistent `scrollRef`. No coordinate math can reconcile these —
  the content itself must render identically.
- **Coordinate model today** (`utils/liveCoords.js`): grid fractions letterboxed into each
  side's differently-sized canvas via `fitBox`. This is replaced by fixed logical frame
  units.
- **Stroke messages** (`components/test/liveHelpers.js`): `stroke_start/points/end/undo`
  carry `stroke_id` + author but **no `question_id`** (only `strokes_sync` does). Per-
  question routing requires adding `question_id`.
- **`useSharedDrawing`** holds ONE merged stroke set with a `questionIdRef` used only for
  the sync payload — it does not switch stroke sets per question. Must become per-question.
- **`SharedDrawingSurface`** renders grid-fraction strokes with a dot grid and scroll
  anchoring. Reworked to render logical-unit strokes inside the frame.
- **Surfaces**: `AdaptivePracticePage`, `TestPage`, `PracticeTestTakingPage`,
  `ModuleTestInterface` (students) + `LiveWatchView` in `LiveSessionsPage` (tutor).

## Architecture

### 1. QuestionFrame component (the keystone)

New `frontend/src/components/test/QuestionFrame.jsx`.

- **Fixed logical size**: `FRAME_W = 820`, `FRAME_H = 1160` (module constants, exported).
  Portrait, ~SAT-paper proportion. Content taller than 1160 scrolls *within* the frame
  (the frame's inner content area is `min-height: FRAME_H` and vertically scrollable; the
  logical Y coordinate space extends with content height — see coordinates below).
- **Uniform scaling**: a wrapper measures its available width `W` (ResizeObserver) and sets
  `scale = clamp(W / FRAME_W, MIN_SCALE, 1)`. The inner frame is a `FRAME_W`-wide element
  with `transform: scale(scale); transform-origin: top center;`. The wrapper reserves the
  scaled height so layout flows correctly. `MIN_SCALE` (~0.4) prevents illegibility on tiny
  screens (below which the wrapper allows horizontal scroll).
- **Children**: renders `props.children` (the passage/prompt/choices) into the scaled frame,
  plus a drawing layer slot (the `SharedDrawingSurface`) as an absolutely-positioned sibling
  covering the full logical frame.
- **Exposes** via context or props: the current `scale`, `FRAME_W/H`, and a ref to the
  scrollable content element, so the drawing surface converts pointer events → logical units.
- One clear responsibility: "render this content into the canonical scaled page and host the
  drawing layer." All surfaces pass their already-built passage/question/choices as children.

### 2. Logical-unit coordinate model (replaces grid fractions)

Rewrite `frontend/src/utils/liveCoords.js` around the frame:

- A stroke point is `{ x, y }` in **logical frame units** (x ∈ [0, 820], y ∈ [0, contentHeight]).
- `toFramePoint(clientX, clientY, frameEl, scale, scrollTop)`: viewport → logical units.
  `x = (clientX - frameRect.left) / scale`; `y = (clientY - frameRect.top) / scale + scrollTop`.
  (frameRect is the scaled element's rect; dividing by scale undoes the transform.)
- `toClientPixel({x, y}, scale, scrollTop)`: logical → canvas pixels for rendering.
  `cx = x * scale`; `cy = (y - scrollTop) * scale`.
- Because both sides use the same `FRAME_W` and render the same content, equal logical
  points map to the same content position; each side just applies its own `scale`.
- Keep the field names `{x, y}` (logical) — NOT the old `{nx, ny}` fractions. All stroke
  storage, messages, and rendering use logical units. (Simplifies reasoning: 1 unit = 1
  logical px at scale 1.)
- Provide `frameScale(containerWidth)` = `clamp(containerWidth / FRAME_W, MIN_SCALE, 1)`.

### 3. Per-question drawing state

Rework `frontend/src/hooks/useSharedDrawing.js`:

- Hold a **map** `questionId -> stroke[]` instead of one flat array. Expose `strokes` as the
  array for the **current** question (set via `setQuestionId`).
- `startStroke/extendStroke/endStroke/undo/clear` operate on the current question's set and
  include `question_id` in every emitted message.
- `applyMessage`: route inbound stroke messages into the map by `payload.question_id`. The
  rendered `strokes` only reflects the current question, so a stroke for another question is
  stored but not shown until navigated to.
- `strokes_sync` payload includes `question_id` (already does) and replaces that author's set
  **for that question**. On navigation/tutor-join, sync the current question's strokes.
- `syncPayload()` returns the current question's own-author strokes (as today, now per-Q).
- Per-author ownership (undo/clear affect only your strokes) unchanged.

### 4. Message protocol (add question_id)

`components/test/liveHelpers.js`: add `question_id` to `buildStrokeStart/Points/End/Undo/Clear`
payloads (Clear becomes per-question: `{author, question_id}`). Backend `schemas/live.py`
already accepts arbitrary payloads for these `Literal` types — no schema change needed beyond
what exists (the types already validate). The server relay is content-agnostic and already
bidirectional + caches `question_changed`; the room's stroke handling needs no change since it
just relays. `strokes_sync` unchanged (already carries question_id).

### 5. SharedDrawingSurface rework

`frontend/src/components/live/SharedDrawingSurface.jsx`:

- Lives inside the `QuestionFrame` as an absolute layer sized to the logical frame (its canvas
  backing store = `FRAME_W * dpr` × `contentHeight * dpr` or the visible scaled size; render in
  logical units scaled by `scale`).
- Capture: pointer events → `toFramePoint(...)` using the frame's scale + scrollTop → logical
  `{x, y}`.
- Render: each stroke's logical points → `toClientPixel(...)` → draw via `renderStrokes`.
- Dot grid: drawn in logical space (fixed logical spacing, e.g. 28 logical units) so dots align
  across sides; scrolls with content; **student shows it only while `active` (drawing on)**,
  **tutor always shows it** (unchanged from current `showGrid` wiring).
- Draw-mode toggle: `pointer-events` all when `active`, none otherwise (unchanged).
- Redraw on scroll of the frame's content element and on scale change (ResizeObserver).

### 6. Panels overlay instead of shift

Remove the `mr-[440px]` content margin on the 3 student surfaces (and the legacy
`DrawingCanvas` xOffset compensation is no longer needed on the live path). The calculator and
any answer/coach sidebar render as **fixed/absolute overlays above** the frame (higher
z-index), so the frame — and its drawing — never move. The frame stays centered in its area at
all times. (Legacy non-live `DrawingCanvas` path may remain as-is for now, but since the frame
no longer shifts, its xOffset animation becomes a no-op; leave it unless it conflicts.)

### 7. Surfaces adopt QuestionFrame

All five surfaces render their question content through `QuestionFrame` with a
`SharedDrawingSurface` layer, keyed by the current question id:

- Students pass `author="student"`, `active={isDrawing}`, `showGrid={isDrawing}`, and the
  current `questionId`.
- Tutor watch view passes `author="tutor"`, `active`, `showGrid` always on, and the current
  questionId derived from `resolveWatchState`.
- The tutor renders the **same** passage/prompt/choices HTML the student sees (it already
  fetches question detail), inside the same `QuestionFrame`, so layout matches. The tutor's
  answer/explanation sidebar overlays (does not shift the frame).
- `useSharedDrawing.setQuestionId(currentQuestionId)` is called whenever the shown question
  changes on each surface, switching the visible stroke set.

## Data Flow

1. Student toggles draw mode → canvas captures. A stroke's points are logical `{x,y}`.
   `stroke_start/points/end` carry `question_id = current`. Relayed to tutor.
2. Tutor's `useSharedDrawing.applyMessage` files strokes into `map[question_id]`. If the tutor
   is currently viewing that question, they render immediately; otherwise stored for when they
   navigate there.
3. Student navigates to another question → `setQuestionId(newId)` → the surface now shows
   `map[newId]` (empty or previously-drawn). Previous question's ink is retained in the map.
4. Navigating back → `setQuestionId(oldId)` → the old ink reappears.
5. Tutor joins mid-session → server replays cached `question_changed` (current question) →
   tutor sets that question → student’s `tutor_joined` handler sends `strokes_sync` for the
   current question → tutor renders it.
6. Panel opens (calculator/sidebar) → overlay appears above the frame; no content/ink movement.

## Error Handling & Edge Cases

- **Stroke for not-yet-loaded question** (tutor): stored in the map by question_id; rendered
  when the tutor’s detail for that question loads and it becomes current.
- **Scale = 0 / container not measured yet**: guard with `MIN_SCALE`; skip render until width
  known.
- **Very large monitors**: `scale` capped at 1 (frame renders at natural 820px, centered) — no
  upscaling blur.
- **Very small phones**: `scale` floored at `MIN_SCALE`; wrapper permits horizontal scroll below
  that so content stays legible.
- **DPR / crispness**: canvas backing store scaled by `devicePixelRatio` so ink is sharp.
- **Content taller than frame**: inner content scrolls; logical Y extends beyond 1160; grid +
  ink scroll-anchor to content (existing scroll-anchor logic, now in logical units).
- **Reconnect**: in-memory map persists in the client; `strokes_sync` re-exchanges current
  question on reconnect/join. A full reload starts clean (no DB) — acceptable per scope.
- **Non-live drawing**: legacy `DrawingCanvas` retained for the non-live path; unaffected.

## Testing Strategy

- **Unit — `liveCoords`**: `toFramePoint`/`toClientPixel` round-trip at scale 1 and scale 0.5;
  scroll offset; `frameScale` clamping (tiny + huge widths). Same logical point → same relative
  content position regardless of scale (the alignment guarantee).
- **Unit — `useSharedDrawing` per-question**: strokes route by question_id; `setQuestionId`
  switches the visible set; drawing on Q1 then navigating to Q2 shows empty, back to Q1 restores;
  `applyMessage` files remote strokes into the right question; undo/clear stay per-author AND
  per-question; `syncPayload` returns current question only.
- **Unit — message builders**: stroke_* payloads include `question_id`.
- **Component — `QuestionFrame`**: computes scale from a mocked container width (clamp bounds);
  renders children; exposes scale/frame refs.
- **Component — `SharedDrawingSurface`**: throttle batcher (existing); pointer→logical emit with
  a mocked frame rect+scale.
- **Backend**: existing live tests remain green (no transport/schema change). Add a relay test
  that a `stroke_start` with `question_id` passes through unchanged (payload preserved).
- **Manual/E2E (two isolated contexts)**: student + tutor; (a) draw on the student, confirm ink
  lands on the SAME content word on the tutor at a DIFFERENT window size; (b) open calculator,
  confirm content + ink don't move; (c) draw on Q1, navigate to Q2 (blank), back to Q1 (ink
  restored), and confirm the tutor mirrors per-question; (d) resize a window and confirm the
  frame scales as one unit with ink staying aligned.

## Migration / Cleanup

- Extract the shared `QuestionFrame`; the 4 student surfaces + tutor view render through it,
  removing per-surface `max-w-*`/`mr-[440px]`/centering divergence.
- Replace grid-fraction `liveCoords` with logical-unit functions; update `SharedDrawingSurface`
  and `useSharedDrawing` to logical units. The old `fitBox`/`toGridFraction`/`toCanvasPixel` and
  their tests are removed/rewritten.
- `stroke_batch` legacy message + `buildStrokeBatchMessage` may remain unused (Phase-1 vestige);
  leave or remove — not on the critical path.

## Rollout order (for the plan)

`liveCoords` (logical units) → message builders (+question_id) → `useSharedDrawing` (per-question
map) → `QuestionFrame` component → `SharedDrawingSurface` rework → adopt on AdaptivePracticePage +
tutor view (prove 1:1 + per-question E2E) → roll to TestPage, PracticeTestTakingPage,
ModuleTestInterface → panel-overlay cleanup → full verification + E2E.
