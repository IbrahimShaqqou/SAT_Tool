import React, { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import tutorService from '../../services/tutorService';
import { useLiveSession } from '../../hooks';
import { TutorLivePanel, SharedDrawingSurface } from '../../components/live';
import { correctAnswerLabel, correctIndex } from '../../components/live/liveFormat';
import { resolveWatchState } from '../../components/test/liveHelpers';
import { getQuestionDetail } from '../../services/liveService';
import QuestionDisplay from '../../components/test/QuestionDisplay';
import QuestionFrame from '../../components/test/QuestionFrame';
import useSharedDrawing from '../../hooks/useSharedDrawing';

/**
 * Tutor live sessions. Without :sessionId, shows the list of students who are
 * active right now. With :sessionId, shows the live watch view (full render in
 * Task 20). Polls the list lightly (5s) since room membership changes are infrequent.
 */
export default function LiveSessionsPage() {
  const { sessionId } = useParams();
  if (sessionId) return <LiveWatchView sessionId={sessionId} />;
  return <LiveSessionsList />;
}

function LiveSessionsList() {
  const [sessions, setSessions] = useState(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const { data } = await tutorService.getActiveSessions();
        if (active) setSessions(data.sessions);
      } catch (_) {
        if (active) setSessions([]);
      }
    };
    load();
    const id = setInterval(load, 5000);
    return () => { active = false; clearInterval(id); };
  }, []);

  if (sessions === null) return <div className="p-6 text-ink-muted">Loading…</div>;

  return (
    <div className="p-6">
      <h1 className="font-display text-2xl text-ink-body">Live now</h1>
      <p className="mb-6 text-sm text-ink-muted">Students working right now. Join to watch and coach.</p>
      {sessions.length === 0 ? (
        <div className="rounded-lg border border-edge bg-surface-muted p-8 text-center text-ink-muted">
          No active sessions right now.
        </div>
      ) : (
        <ul className="divide-y divide-edge">
          {sessions.map((s) => (
            <li key={s.session_id} className="flex items-center justify-between py-3">
              <div>
                <div className="font-semibold text-ink-body">{s.student_name}</div>
                <div className="text-xs text-ink-muted">{s.test_type}</div>
              </div>
              <Link
                to={`/tutor/live/${s.session_id}`}
                className="rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white"
              >
                Join live
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const LETTERS = ['A', 'B', 'C', 'D', 'E'];
const TUTOR_INK = '#b45309'; // amber/bronze signature

function LiveWatchView({ sessionId }) {
  const contentInnerRef = useRef(null);
  const sendRef = useRef(null);
  const [eraser, setEraser] = useState(false);
  const [contentHeight, setContentHeight] = useState(1160);

  const shared = useSharedDrawing({ sessionId, author: 'tutor', send: (m) => sendRef.current && sendRef.current(m) });

  const { status, snapshot, lastByType, send } = useLiveSession({
    sessionId, role: 'tutor', enabled: true,
    onMessage: (m) => shared.applyMessage(m),
  });
  sendRef.current = send;

  const { currentQuestionId, questionIndex, answer } = resolveWatchState(lastByType, snapshot);

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

  // Measure the frame content height so the drawing surface covers it (matches
  // the student surfaces; the frame renders content at the shared 820 logical
  // width so tutor + student ink align 1:1).
  useEffect(() => {
    const el = contentInnerRef.current;
    if (!el) return undefined;
    const ro = new ResizeObserver(() => setContentHeight(el.offsetHeight > 0 ? el.offsetHeight : 1160));
    ro.observe(el);
    return () => ro.disconnect();
  }, [detail]);

  // Re-sync our own ink when content (re)renders so a reconnected surface reflects it.
  useEffect(() => {
    if (detail && send) send({ type: 'strokes_sync', session_id: sessionId, sender_role: 'tutor', seq: 0, payload: shared.syncPayload() });
  }, [detail]); // eslint-disable-line react-hooks/exhaustive-deps

  // selected_answer shape varies by surface: a bare index (number), an MCQ
  // object {index}, a bare SPR string, or an SPR object {answer}. Normalize.
  const rawSelected = answer?.selected_answer;
  const selected = (rawSelected && typeof rawSelected === 'object')
    ? (rawSelected.index != null ? rawSelected.index : rawSelected.answer)
    : rawSelected;
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
          <div className="overflow-y-auto" style={{ maxHeight: 'calc(100vh - 220px)' }}>
            <QuestionFrame>
              {({ scale }) => (
                <>
                  <div ref={contentInnerRef}>
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
                  </div>
                  <SharedDrawingSurface
                    active
                    showGrid
                    author="tutor"
                    penColor={TUTOR_INK}
                    eraser={eraser}
                    scale={scale}
                    heightPx={contentHeight}
                    strokes={shared.strokes}
                    onStrokeStart={(opts) => shared.startStroke(opts)}
                    onStrokePoints={(id, pts) => shared.extendStroke(id, pts)}
                    onStrokeEnd={(id) => shared.endStroke(id)}
                  />
                </>
              )}
            </QuestionFrame>
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
