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
