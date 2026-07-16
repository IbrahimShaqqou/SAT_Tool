# Live Tutor Session — Design Spec

**Date:** 2026-07-07
**Status:** Approved for planning
**Register:** product (student + tutor surfaces)

## Summary

A tutor can watch a student's in-progress session (question bank, assignment, or
adaptive practice) in real time. The tutor sees which question the student is on,
the student's selected answer, and the student's drawing streamed live. A
collapsible coaching sidebar (expanded by default) shows the correct answer and
explanation for the current question. The student always sees a clear indicator
when a tutor is present.

This spec covers **Phase 1** and deliberately builds the real-time transport for
the **Phase 2** co-pilot end state so Phase 2 is additive, not a rewrite.

## Goals

- Tutor watches a live session with <100ms-feel updates for question changes,
  answer selection, and drawing strokes.
- Beautiful collapsible coaching sidebar (Study Hall style): correct answer as a
  large Fraunces numeral, student status, explanation, co-pilot tool row.
  Starts **expanded**; tutor can collapse it to a thin rail to see exactly what
  the student sees (test fidelity).
- Student's drawing streams to the tutor **read-only** in Phase 1.
- Student always sees a "your tutor joined" indicator (hard requirement, no
  approval flow).
- Tutor sees a live-sessions list of which of their students are active now.

## Non-Goals (Phase 2 / later — explicitly out of scope)

- Bidirectional / shared whiteboard (both draw, color-coded by author).
- Tutor live cursor / pointer on the student's screen.
- Shared highlight (tutor highlights → student sees).
- Remote navigation (tutor moves the student to another question).
- Tutor-triggered reveal of answer/explanation on the student's screen.
- Session replay of finished sessions.
- Voice / text chat.
- The `live_session_event` append-only log (introduced when replay is built;
  replay logs from the day it ships — Phase 1 sessions are not replayable).
- Redis-backed pub/sub / multi-instance scaling.

## Context (current codebase)

- **No real-time infrastructure exists.** No WebSockets, no SSE. Redis is in
  docker-compose but unused. Backend on Railway (single instance), frontend on
  Vercel. Railway supports WebSockets.
- **`DrawingCanvas.jsx`** stores strokes per-question as
  `{color, size, eraser, points:[{x,y}]}` in **world-space** coordinates, in an
  in-memory `Map` keyed by questionId. Currently ephemeral (never sent to server).
  Directly serializable.
- **All three answering surfaces** (practice, assignment, adaptive) share one
  root: `TestSession`, with `current_question_index`, and write answers
  immediately to `StudentResponse` via existing REST `/answer` endpoints.
- **Tutor↔student auth** is a simple `student.tutor_id == tutor.id` check
  (`_get_student_or_404` pattern in `api/v1/tutor.py`).
- Correct answers/explanations are kept server-side; tutor endpoints can already
  fetch correct answers.

## Architecture

### Transport: FastAPI WebSockets, single-instance, in-memory pub/sub

- One WebSocket "live room" per `session_id`. Endpoint:
  `WS /api/v1/live/ws/{session_id}`.
- Backend holds an in-memory registry: `session_id → {student_socket, tutor_sockets:set}`.
- Rooms created lazily on first connect; torn down when the last socket leaves
  (near-zero idle memory).
- No Redis in Phase 1 (single Railway instance makes in-process fan-out correct).
  The registry sits behind a `LiveRoomManager` interface so a Redis-backed
  implementation is a contained swap later.

### Auth: short-lived WS ticket

- Browsers can't easily set Authorization headers on WS. Client first calls
  `POST /api/v1/live/token` (normal JWT-authenticated REST), receiving a
  short-lived (~60s), single-use ticket bound to `{user_id, session_id, role}`.
- Client connects `…/live/ws/{session_id}?ticket=…`. The WS endpoint validates
  the ticket, then re-validates authorization: tutor must own the student
  (`student.tutor_id == tutor.id`) or student must own the session. Defense in
  depth — the owning check happens at both ticket issuance and WS connect.
- Tickets reuse existing JWT signing in `core/`.

### Server-authoritative truth; socket is a mirror

- Answers continue to flow through existing REST `/answer` endpoints, unchanged.
  Those remain the sole writers of `StudentResponse` / `TestSession` state and
  IRT updates.
- The WebSocket only **mirrors** state for the tutor. If the socket drops,
  nothing about the student's actual test is lost. This is a deliberate safety
  property and the basis for reconnection self-healing.

### Message envelope

All messages are JSON: `{ type, session_id, sender_role, seq, payload }`.

## Data Flow

### Room lifecycle

1. Student starts working → client opens WS, sends `presence`. Room created lazily.
2. Tutor opens live-sessions list → sees active students → clicks one → fetches
   ticket → joins room. Backend sends `tutor_joined` to student (drives
   indicator) and sends the tutor a `snapshot`.
3. **Snapshot on join:** backend builds current state from the DB
   (`current_question_index`, student's answer so far) and the student's client
   replies with its current `stroke_batch` for the active question, so a
   mid-session joiner sees the full picture immediately.
4. Student works → client emits deltas (`question_changed`, `answer_selected`,
   `stroke_batch`).
5. Disconnect → room notifies the other side; teardown when last socket leaves.

### Message types (Phase 1)

| Type | Direction | Payload | Trigger |
|---|---|---|---|
| `presence` | student→server | `{status, surface, session_id}` | connect / status change |
| `snapshot` | server→tutor | `{question_index, question_id, selected_answer, elapsed}` | tutor join |
| `question_changed` | student→tutor | `{question_index, question_id}` | student navigates |
| `answer_selected` | student→tutor | `{question_id, selected_answer}` | student picks/changes answer |
| `stroke_batch` | student→tutor | `{question_id, strokes:[…]}` | student draws (throttled) |
| `tutor_joined` / `tutor_left` | server→student | `{tutor_name}` | tutor connect/disconnect |
| `heartbeat` | both | `{}` | ~every 20s, keepalive |

### Drawing on the wire

- Strokes serialize directly from `DrawingCanvas`'s existing
  `{color, size, eraser, points:[{x,y}]}` world-space model.
- Batching: flush a `stroke_batch` on stroke completion (pointer-up), plus every
  ~150ms mid-stroke for long strokes. (Rate is tunable; revisit if it feels bad.)
- World-space coords let the tutor's canvas reconstruct strokes regardless of
  scroll/panel differences.

### No new persistence in Phase 1

- No new tables. The snapshot reads existing `TestSession.current_question_index`
  and `StudentResponse`. No duplicated "current answer" store.
- (JSONB pitfall note for future work: when the replay event-log table is added,
  payloads must be written as whole objects, never mutated in place.)

## Components & Code Structure

### Backend (new)

- `app/api/v1/live.py` — `POST /live/token` + `WS /live/ws/{session_id}`. Thin;
  validates ticket, delegates to the manager.
- `app/services/live_room_manager.py` — in-memory `LiveRoomManager`
  (rooms dict, join/leave, relay/broadcast) behind an interface for future Redis.
- `app/services/live_ticket.py` — issue/validate short-lived WS tickets
  (reuses JWT signing in `core/`).
- `app/schemas/live.py` — Pydantic models for envelope + payloads.
- Reuses: `_get_student_or_404` auth pattern from `tutor.py`;
  `TestSession` / `StudentResponse` reads for the snapshot.

### Frontend (new)

- `services/liveService.js` — get-ticket + WebSocket wrapper (connect,
  auto-reconnect w/ backoff, send/subscribe, heartbeat).
- `hooks/useLiveSession.js` — React hook over the connection: connection state,
  latest snapshot/deltas, `send()`. One hook, role passed in.
- `components/live/TutorLivePanel.jsx` — collapsible coach sidebar (starts
  expanded): correct answer (large Fraunces), student status, explanation, tool
  row. The chosen "Option B, expanded-by-default" layout.
- `components/live/LiveIndicator.jsx` — student "your tutor joined" banner/badge.
- `components/live/LiveStrokeLayer.jsx` — read-only canvas replaying incoming
  `stroke_batch` (uses shared render helper below).
- `pages/tutor/LiveSessionsPage.jsx` — live-sessions list (active students now)
  + watch view (embeds `ModuleTestInterface` in spectator mode with
  `TutorLivePanel` docked).

### Targeted refactor (on the path)

- Extract the pure "render an array of strokes to a canvas context" logic out of
  `DrawingCanvas.jsx` into a shared helper (e.g. `utils/strokeRenderer.js`), so
  `LiveStrokeLayer` and `DrawingCanvas` share one render loop instead of
  diverging. No other test-component changes.

### Spectator mode for `ModuleTestInterface`

- Reuse the student's test interface for the tutor's watch view, gated by a
  `readOnly`/`spectator` prop: disables answer selection, drives the current
  question from incoming `question_changed` messages instead of local state.
  Preserves "two audiences, one system."

## Error Handling & Edge Cases

- **Student socket drops:** test unaffected (answers over REST). WS reconnects
  with exponential backoff (1s→2s→4s, cap ~30s); on reconnect re-sends
  `presence` + current `stroke_batch`; tutor view self-heals.
- **Tutor socket drops:** "reconnecting…" state, then rejoin + fresh snapshot.
  No student impact.
- **Tutor joins an ended session:** room absent → clean "session no longer
  active" state, bounce to live-sessions list.
- **Stale ticket:** WS handshake rejects with a close code; client re-fetches a
  ticket and retries once.
- **Non-owning tutor:** ticket issuance fails at REST layer; WS re-validates on
  connect (defense in depth).
- **Second tutor device:** allowed (room holds a set of tutor sockets); both get
  snapshots; student sees one indicator regardless.
- **Consent/privacy:** student always sees the indicator when a tutor is present
  (hard requirement via `tutor_joined`/`tutor_left`). With no tutor connected,
  the student WS runs presence only, sends nothing sensitive.
- **Ungraceful disconnect:** caught by missed heartbeats (~2 missed → offline).
- **Room teardown:** on last socket leaving, near-zero idle memory.

## Testing Strategy

- **Backend unit:** `LiveRoomManager` join/leave/relay/broadcast tested directly
  (no socket). Ticket issue/validate/expiry in isolation.
- **Backend integration:** FastAPI `TestClient.websocket_connect` — full
  handshake (valid ticket joins; invalid/expired rejected; non-owning tutor
  rejected; relay student→tutor; snapshot on join).
- **Frontend:** `useLiveSession` against a mock WebSocket (connect, reconnect,
  dispatch). `LiveStrokeLayer` fed stroke batches, assert render calls. Focused
  unit test on the extracted `strokeRenderer` helper.
- **Manual/E2E:** two browser sessions (student + tutor) to validate live feel /
  latency — the acceptance check.

## Phase 2 (for reference, not in this build)

Same transport and envelope, additive message types: bidirectional
`stroke_batch` (both draw, color-coded), `cursor`, `highlight`, `navigate`,
`reveal`. Plus session replay (introduces the `live_session_event` log). None of
these require changing the Phase 1 transport, auth, or room model.
