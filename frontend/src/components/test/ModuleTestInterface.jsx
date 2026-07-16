/**
 * Module Test Interface
 * Active test-taking UI for a single module
 * Matches Bluebook interface with timer, question nav, tools
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { practiceService, responseService } from '../../services';
import { LoadingSpinner } from '../ui';
import {
  QuestionNav,
  QuestionDisplay,
  AnswerChoices,
  DesmosCalculator,
  ReferenceSheet,
  SplitPane,
  DrawingCanvas,
} from './';
import { useTimer, useLiveSession } from '../../hooks';
import useSharedDrawing from '../../hooks/useSharedDrawing';
import { LiveIndicator, SharedDrawingSurface } from '../live';
import { computeLiveIndicatorState, buildStrokeBatchMessage } from './liveHelpers';
import QuestionFrame from './QuestionFrame';

const ModuleTestInterface = ({ module, moduleNumber, totalModules, onReadyToSubmit, live = { enabled: false } }) => {
  // Question state
  const [questions, setQuestions] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [markedForReview, setMarkedForReview] = useState(new Set(module.flagged_question_indices || []));
  const [isLoading, setIsLoading] = useState(true);

  // UI state
  const [showCalculator, setShowCalculator] = useState(false);
  const [showReferenceSheet, setShowReferenceSheet] = useState(false);
  const [showNav, setShowNav] = useState(false);
  // eslint-disable-next-line no-unused-vars
  const [isDrawing, setIsDrawing] = useState(false);

  // Bidirectional shared drawing (student ink <-> tutor ink), in normalized
  // content coordinates. Read via a ref inside onMessage so applying inbound
  // strokes never re-triggers the socket effect.
  const sharedRef = useRef(null);
  const shared = useSharedDrawing({
    sessionId: live?.sessionId,
    author: 'student',
    send: (m) => liveSendRef.current && liveSendRef.current(m),
  });
  sharedRef.current = shared;

  // Live tutor session (optional; no-op when live.enabled is false)
  const { lastByType, send: liveSend } = useLiveSession({
    sessionId: live?.sessionId,
    role: 'student',
    enabled: !!live?.enabled,
    onMessage: (m) => sharedRef.current && sharedRef.current.applyMessage(m),
  });
  const liveSendRef = useRef(null);
  liveSendRef.current = liveSend;
  const [liveIndicator, setLiveIndicator] = useState({ present: false, tutorName: null });

  // Remember the last stroke batch so a tutor joining mid-session gets the current ink.
  const lastStrokeBatchRef = useRef({ questionId: null, strokes: [], dims: null });
  // Current question/index read synchronously in the tutor_joined handler.
  const questionsRef = useRef(questions);
  questionsRef.current = questions;
  const currentIndexRef = useRef(currentIndex);
  currentIndexRef.current = currentIndex;

  useEffect(() => {
    const joined = lastByType?.tutor_joined;
    const left = lastByType?.tutor_left;
    // Pick whichever arrived most recently using the hook's _rx stamp.
    const latest = [joined, left].filter(Boolean).sort((a, b) => (b?._rx || 0) - (a?._rx || 0))[0];
    if (latest) setLiveIndicator((prev) => computeLiveIndicatorState(prev, latest));
    // Re-send current strokes when a tutor joins so they see existing ink.
    if (latest && latest.type === 'tutor_joined' && live?.enabled) {
      // Tell the just-joined tutor which question we're on right now.
      const q = questionsRef.current[currentIndexRef.current];
      if (q) liveSend({ type: 'question_changed', session_id: live.sessionId,
        sender_role: 'student', seq: 0,
        payload: { question_index: currentIndexRef.current, question_id: q.id } });
      // Legacy completed-stroke batch (kept for backward compat).
      const { questionId, strokes, dims } = lastStrokeBatchRef.current;
      if (questionId) liveSend(buildStrokeBatchMessage(live.sessionId, questionId, strokes, dims));
      // Shared-drawing resync: send our own normalized strokes to the joiner.
      liveSend({ type: 'strokes_sync', session_id: live.sessionId, sender_role: 'student', seq: 0, payload: shared.syncPayload() });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastByType, live, liveSend]);

  // Refs
  const scrollContainerRef = useRef(null);
  const submitRef = useRef(null);

  // Per-question shared drawing wiring (live path). The frame content height is
  // measured so the drawing surface covers the full logical content area.
  const [contentHeight, setContentHeight] = useState(1160);
  const contentInnerRef = useRef(null);
  useEffect(() => {
    const el = contentInnerRef.current;
    if (!el) return undefined;
    const ro = new ResizeObserver(() => setContentHeight(el.offsetHeight > 0 ? el.offsetHeight : 1160));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  useEffect(() => {
    if (questions[currentIndex]?.id) shared.setQuestionId(questions[currentIndex].id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [questions, currentIndex]);

  // Timer
  const timeLimitSeconds = module.time_limit_minutes * 60;
  const {
    timeRemaining,
    formattedTime,
    start: startTimer,
  } = useTimer(timeLimitSeconds, () => {
    // Auto-submit when time runs out
    if (submitRef.current) {
      submitRef.current(true);
    }
  });

  // Attach submit function to ref
  submitRef.current = onReadyToSubmit;

  // Fetch questions
  useEffect(() => {
    const fetchQuestions = async () => {
      try {
        const response = await practiceService.getModuleQuestions(module.id);
        const questionsData = response.data.questions || [];

        // Transform to expected format
        const transformedQuestions = questionsData.map(q => ({
          id: q.id,
          prompt_html: q.prompt_html,
          passage_html: q.passage_html,
          answer_type: q.answer_type || 'MCQ',
          choices_json: q.choices_json || [],
          domain: q.domain,
          skill: q.skill,
        }));

        setQuestions(transformedQuestions);

        // Restore saved answers from module state
        // TODO: Fetch responses and restore answers

        setIsLoading(false);

        // Start timer
        startTimer();
      } catch (err) {
        console.error('Error fetching questions:', err);
        setIsLoading(false);
      }
    };

    fetchQuestions();
  }, [module.id, startTimer]);

  // Save answer
  const handleAnswerSelect = useCallback(async (questionId, answer) => {
    setAnswers(prev => ({ ...prev, [questionId]: answer }));

    if (live?.enabled) {
      liveSend({ type: 'answer_selected', session_id: live.sessionId,
        sender_role: 'student', seq: 0,
        payload: { question_id: questionId, selected_answer: answer } });
    }

    // Submit answer to backend
    try {
      await responseService.submitResponse({
        test_session_id: module.test_session_id,
        question_id: questionId,
        selected_answer: answer,
      });
    } catch (err) {
      console.error('Error saving answer:', err);
    }
  }, [module.test_session_id, live, liveSend]);

  // Emit question_changed to a watching tutor when the current question changes
  useEffect(() => {
    if (!live?.enabled) return;
    const q = questions[currentIndex];
    if (!q) return;
    // Keep the shared surface scoped to the current question for resync payloads.
    shared.setQuestionId(q.id);
    liveSend({ type: 'question_changed', session_id: live.sessionId,
      sender_role: 'student', seq: 0,
      payload: { question_index: currentIndex, question_id: q.id } });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex, live, questions, liveSend]);

  // Navigation
  const handleNext = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(currentIndex + 1);
      scrollToTop();
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
      scrollToTop();
    }
  };

  const handleQuestionSelect = (index) => {
    setCurrentIndex(index);
    setShowNav(false);
    scrollToTop();
  };

  const scrollToTop = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0;
    }
  };

  // Mark for review
  const toggleMarkForReview = () => {
    const newMarked = new Set(markedForReview);
    if (newMarked.has(currentIndex)) {
      newMarked.delete(currentIndex);
    } else {
      newMarked.add(currentIndex);
    }
    setMarkedForReview(newMarked);
    // TODO: Save to backend
  };

  // Get timer color based on remaining time
  const getTimerColor = () => {
    const minutes = Math.floor(timeRemaining / 60);
    if (minutes <= 1) return 'text-rose-600';
    if (minutes <= 5) return 'text-amber-500';
    return 'text-ink-body';
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-surface-page">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  const currentQuestion = questions[currentIndex];
  const hasPassage = currentQuestion?.passage_html;
  const isMath = module.subject_area === 'MATH';

  return (
    <div className="h-screen flex flex-col bg-surface-card">
      {/* Top Header */}
      <div className="border-b border-edge bg-surface-card px-6 py-4 flex items-center justify-between">
        <div className="flex items-center space-x-6">
          {/* Module info */}
          <div className="text-sm text-ink-muted">
            Module {moduleNumber}: {module.title}
          </div>

          {/* Question counter */}
          <div className="text-sm font-medium text-ink-body">
            Question {currentIndex + 1} of {questions.length}
          </div>

          {/* Live tutor indicator */}
          {live?.enabled && (
            <LiveIndicator present={liveIndicator.present} tutorName={liveIndicator.tutorName} />
          )}
        </div>

        <div className="flex items-center space-x-6">
          {/* Tools */}
          {isMath && (
            <>
              <button
                onClick={() => setShowCalculator(!showCalculator)}
                className="text-sm font-medium text-brand-600 hover:text-brand-700"
              >
                Calculator
              </button>
              <button
                onClick={() => setShowReferenceSheet(!showReferenceSheet)}
                className="text-sm font-medium text-brand-600 hover:text-brand-700"
              >
                Reference
              </button>
            </>
          )}

          {/* Timer */}
          <div className={`text-lg font-bold ${getTimerColor()}`}>
            {formattedTime}
          </div>

          {/* Question Nav Toggle */}
          <button
            onClick={() => setShowNav(!showNav)}
            aria-label="Toggle question navigation"
            className="p-2 hover:bg-surface-muted rounded"
          >
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 15a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
      </div>

      {/* Question Navigation Dropdown */}
      {showNav && (
        <QuestionNav
          questions={questions.map((q, idx) => ({
            number: idx + 1,
            isAnswered: !!answers[q.id],
            isFlagged: markedForReview.has(idx),
          }))}
          currentIndex={currentIndex}
          onQuestionSelect={handleQuestionSelect}
        />
      )}

      {/* Main Content */}
      <div className="flex-1 overflow-hidden flex">
        {/* Question Area */}
        <div
          ref={scrollContainerRef}
          className="relative flex-1 overflow-y-auto p-8"
        >
          {(() => {
            const questionContent = hasPassage ? (
              <SplitPane
                left={
                  <div
                    className="prose prose-sm max-w-none"
                    dangerouslySetInnerHTML={{ __html: currentQuestion.passage_html }}
                  />
                }
                right={
                  <>
                    <QuestionDisplay
                      question={currentQuestion}
                      questionNumber={currentIndex + 1}
                    />
                    <AnswerChoices
                      choices={currentQuestion.choices_json}
                      selectedIndex={answers[currentQuestion.id]}
                      onSelect={(index) => handleAnswerSelect(currentQuestion.id, index)}
                      questionType={currentQuestion.answer_type}
                    />
                  </>
                }
              />
            ) : (
              <div className="max-w-4xl mx-auto">
                <QuestionDisplay
                  question={currentQuestion}
                  questionNumber={currentIndex + 1}
                />
                <AnswerChoices
                  choices={currentQuestion.choices_json}
                  selectedIndex={answers[currentQuestion.id]}
                  onSelect={(index) => handleAnswerSelect(currentQuestion.id, index)}
                  questionType={currentQuestion.answer_type}
                />
              </div>
            );

            // Live path: fixed QuestionFrame + per-question shared drawing. The
            // student's ink streams to the tutor and the tutor's ink appears here,
            // in normalized (logical) frame coordinates that scale with content.
            return live?.enabled ? (
              <QuestionFrame>
                {({ scale }) => (
                  <>
                    <div ref={contentInnerRef}>{questionContent}</div>
                    <SharedDrawingSurface
                      active={isDrawing}
                      showGrid={isDrawing}
                      author="student"
                      penColor="#111827"
                      eraser={false}
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
            ) : (
              questionContent
            );
          })()}
        </div>

        {/* Calculator Panel */}
        {showCalculator && isMath && (
          <div className="w-96 border-l border-edge bg-surface-card">
            <DesmosCalculator onClose={() => setShowCalculator(false)} />
          </div>
        )}
      </div>

      {/* Bottom Navigation */}
      <div className="border-t border-edge bg-surface-card px-6 py-4 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button
            onClick={handlePrev}
            disabled={currentIndex === 0}
            className="px-4 py-2 border border-edge rounded hover:bg-surface-muted disabled:opacity-50 disabled:cursor-not-allowed"
          >
            ← Back
          </button>

          <button
            onClick={toggleMarkForReview}
            className={`px-4 py-2 border rounded flex items-center space-x-2 ${
              markedForReview.has(currentIndex)
                ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-400 text-amber-700 dark:text-amber-300'
                : 'border-edge hover:bg-surface-muted'
            }`}
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path d="M3 6a3 3 0 013-3h10a1 1 0 01.8 1.6L14.25 8l2.55 3.4A1 1 0 0116 13H6a1 1 0 00-1 1v3a1 1 0 11-2 0V6z" />
            </svg>
            <span>Mark for Review</span>
          </button>
        </div>

        <div className="flex items-center space-x-4">
          {currentIndex === questions.length - 1 ? (
            <button
              onClick={onReadyToSubmit}
              className="px-6 py-2 bg-brand-600 text-white font-semibold rounded hover:bg-brand-700"
            >
              Review & Submit
            </button>
          ) : (
            <button
              onClick={handleNext}
              className="px-6 py-2 bg-brand-600 text-white rounded hover:bg-brand-700"
            >
              Next →
            </button>
          )}
        </div>
      </div>

      {/* Legacy full-page drawing overlay — NON-live path only. The
          SharedDrawingSurface above handles capture when live is enabled. */}
      {!live?.enabled && (
        <DrawingCanvas
          isActive={isDrawing}
          questionId={currentQuestion?.id}
          scrollRef={scrollContainerRef}
          showCalculator={showCalculator}
        />
      )}

      {/* Modals */}
      {showReferenceSheet && (
        <ReferenceSheet onClose={() => setShowReferenceSheet(false)} />
      )}
    </div>
  );
};

export { ModuleTestInterface };
