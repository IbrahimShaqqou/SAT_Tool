/**
 * Resolve the tutor watch view's current question + the answer to show, from
 * the live deltas (lastByType) and the join snapshot.
 *
 * - currentQuestionId = whichever of question_changed / answer_selected arrived
 *   MOST RECENTLY (by the hook's _rx stamp), else the snapshot's question.
 *   Using recency (not a fixed precedence) means a fresh question_changed always
 *   wins over an older answer, and a fresh answer wins once the student answers.
 * - answer is shown ONLY if it belongs to currentQuestionId, so a previous
 *   question's answer never lingers after the student moves on.
 */
export function resolveWatchState(lastByType, snapshot) {
  const qc = lastByType?.question_changed;
  const as = lastByType?.answer_selected;
  const qcRx = qc?._rx || 0;
  const asRx = as?._rx || 0;

  let currentQuestionId = null;
  let questionIndex = null;
  if (qcRx || asRx) {
    if (qcRx >= asRx) {
      currentQuestionId = qc?.payload?.question_id ?? as?.payload?.question_id ?? null;
      questionIndex = qc?.payload?.question_index ?? null;
    } else {
      currentQuestionId = as?.payload?.question_id ?? qc?.payload?.question_id ?? null;
      questionIndex = qc?.payload?.question_index ?? null;
    }
  }
  if (!currentQuestionId && snapshot) {
    currentQuestionId = snapshot.question_id ?? null;
    questionIndex = snapshot.question_index ?? null;
  }

  // Candidate answer: prefer the live answer_selected, else the snapshot.
  const answerCandidate = as?.payload
    || (snapshot ? { question_id: snapshot.question_id, selected_answer: snapshot.selected_answer } : null);
  const answer = (answerCandidate && answerCandidate.question_id === currentQuestionId) ? answerCandidate : null;

  return { currentQuestionId, questionIndex, answer };
}

/** Reduce a live message into indicator state {present, tutorName}. */
export function computeLiveIndicatorState(prev, msg) {
  if (!msg || !msg.type) return prev;
  if (msg.type === 'tutor_joined') {
    return { present: true, tutorName: (msg.payload && msg.payload.tutor_name) || null };
  }
  if (msg.type === 'tutor_left') {
    return { present: false, tutorName: null };
  }
  return prev;
}

/** Build a stroke_batch live message. dims = student canvas {width, height}. */
export function buildStrokeBatchMessage(sessionId, questionId, strokes, dims) {
  return {
    type: 'stroke_batch',
    session_id: sessionId,
    sender_role: 'student',
    seq: 0,
    payload: {
      question_id: questionId,
      strokes: strokes || [],
      width: dims?.width || null,
      height: dims?.height || null,
    },
  };
}

/** Build an answer_selected live message. */
export function buildAnswerSelectedMessage(sessionId, questionId, selectedAnswer) {
  return {
    type: 'answer_selected',
    session_id: sessionId,
    sender_role: 'student',
    seq: 0,
    payload: { question_id: questionId, selected_answer: selectedAnswer },
  };
}

// ── Shared live-drawing messages (Phase 2) ──────────────────────────────────
function envelope(type, sessionId, senderRole, payload) {
  return { type, session_id: sessionId, sender_role: senderRole, seq: 0, payload };
}

/** Begin a stroke. opts: {strokeId, color, size, eraser, point:{x,y}, questionId} */
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

/** Append points to an in-progress stroke. */
export function buildStrokePoints(sessionId, author, strokeId, points, questionId) {
  return envelope('stroke_points', sessionId, author, { stroke_id: strokeId, points: points || [], question_id: questionId ?? null });
}

/** Finalize a stroke. */
export function buildStrokeEnd(sessionId, author, strokeId, questionId) {
  return envelope('stroke_end', sessionId, author, { stroke_id: strokeId, question_id: questionId ?? null });
}

/** Remove one of an author's strokes. */
export function buildStrokeUndo(sessionId, author, strokeId, questionId) {
  return envelope('stroke_undo', sessionId, author, { author, stroke_id: strokeId, question_id: questionId ?? null });
}

/** Remove all of an author's strokes for a question. */
export function buildStrokeClear(sessionId, author, questionId) {
  return envelope('stroke_clear', sessionId, author, { author, question_id: questionId ?? null });
}

/** Full-state resync for a joining/reconnecting peer. */
export function buildStrokesSync(sessionId, questionId, strokes) {
  return envelope('strokes_sync', sessionId, 'server', { question_id: questionId, strokes: strokes || [] });
}
