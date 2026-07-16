import { useCallback, useEffect, useRef, useState } from 'react';
import useLiveSession from './useLiveSession';
import useSharedDrawing from './useSharedDrawing';
import {
  computeLiveIndicatorState,
  buildStrokeBatchMessage,
  buildAnswerSelectedMessage,
} from '../components/test/liveHelpers';

/**
 * Shared live-session emit logic for student surfaces that render the test
 * components directly (Adaptive, Practice Tests, Assignments). Wraps
 * useLiveSession and exposes emit helpers + tutor-presence indicator state.
 * Also exposes a `shared` bundle (bound to author 'student') driving the
 * bidirectional shared-drawing surface. ModuleTestInterface has its own inline
 * copy and does not use this hook.
 */
export function useStudentLiveEmit({ enabled, sessionId, currentQuestionId, currentQuestionIndex }) {
  const sendRef = useRef(null);
  const shared = useSharedDrawing({ sessionId, author: 'student', send: (m) => sendRef.current && sendRef.current(m) });
  const { lastByType, send } = useLiveSession({
    sessionId, role: 'student', enabled: !!enabled,
    onMessage: (m) => shared.applyMessage(m),
  });
  sendRef.current = send;
  const [indicator, setIndicator] = useState({ present: false, tutorName: null });
  const lastStrokeBatchRef = useRef({ questionId: null, strokes: [], dims: null });
  // Current question, read synchronously in the tutor_joined handler so a
  // freshly-joined tutor immediately learns which question the student is on.
  const currentQuestionRef = useRef({ id: null, index: null });
  currentQuestionRef.current = { id: currentQuestionId, index: currentQuestionIndex };

  // Keep the shared surface's question in sync so syncPayload is scoped right.
  useEffect(() => {
    if (currentQuestionId) shared.setQuestionId(currentQuestionId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentQuestionId]);

  // question_changed on id change
  useEffect(() => {
    if (!enabled || !currentQuestionId) return;
    send(buildQuestionChangedMessage(sessionId, currentQuestionIndex, currentQuestionId));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, sessionId, currentQuestionId, currentQuestionIndex]);

  // tutor presence + re-send strokes on tutor_joined
  useEffect(() => {
    const joined = lastByType?.tutor_joined;
    const left = lastByType?.tutor_left;
    const latest = [joined, left].filter(Boolean).sort((a, b) => (b?._rx || 0) - (a?._rx || 0))[0];
    if (!latest) return;
    setIndicator((prev) => computeLiveIndicatorState(prev, latest));
    if (latest.type === 'tutor_joined' && enabled) {
      // Tell the just-joined tutor which question we're on right now (the
      // question_changed emitted on navigation reached an empty room before
      // they joined).
      const { id, index } = currentQuestionRef.current;
      if (id) send(buildQuestionChangedMessage(sessionId, index, id));
      // Legacy completed-stroke batch (kept for backward compat).
      const { questionId, strokes, dims } = lastStrokeBatchRef.current;
      if (questionId) send(buildStrokeBatchMessage(sessionId, questionId, strokes, dims));
      // Shared-drawing resync: send our own normalized strokes to the joiner.
      send({ type: 'strokes_sync', session_id: sessionId, sender_role: 'student', seq: 0, payload: shared.syncPayload() });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastByType, enabled, sessionId]);

  const emitAnswer = useCallback((questionId, selectedAnswer) => {
    if (!enabled) return;
    send(buildAnswerSelectedMessage(sessionId, questionId, selectedAnswer));
  }, [enabled, sessionId, send]);

  const emitStrokeBatch = useCallback((questionId, strokes, dims) => {
    if (!enabled) return;
    lastStrokeBatchRef.current = { questionId, strokes, dims };
    send(buildStrokeBatchMessage(sessionId, questionId, strokes, dims));
  }, [enabled, sessionId, send]);

  return { indicator, emitAnswer, emitStrokeBatch, shared };
}

function buildQuestionChangedMessage(sessionId, index, questionId) {
  return {
    type: 'question_changed',
    session_id: sessionId,
    sender_role: 'student',
    seq: 0,
    payload: { question_index: index, question_id: questionId },
  };
}

export default useStudentLiveEmit;
