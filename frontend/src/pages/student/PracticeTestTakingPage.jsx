/**
 * Practice Test Taking Page
 *
 * Bluebook-faithful test interface for official College Board practice tests.
 * Reuses the same shared components (TestHeader, QuestionDisplay,
 * AnswerChoices, QuestionNav, SplitPane, calculator, reference, drawing) as
 * the question bank and assignment test pages so the format is consistent
 * across all test surfaces.
 */
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, Button, LoadingSpinner } from '../../components/ui';
import {
  TestHeader,
  QuestionNav,
  QuestionDisplay,
  AnswerChoices,
  DesmosCalculator,
  ReferenceSheet,
  SplitPane,
  DrawingCanvas,
  HighlightableText,
  SubmitConfirmation,
} from '../../components/test';
import ReportModal from '../../components/test/ReportModal';
import { useTimer } from '../../hooks';
import { splitRWPrompt } from '../../utils';
import {
  startPracticeTest,
  getCurrentModule,
  submitModule,
} from '../../services/practiceTestApi';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const PracticeTestTakingPage = () => {
  const { testNumber } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sessionId, setSessionId] = useState(null);
  const [moduleData, setModuleData] = useState(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState({}); // { questionId: index|string }
  const [markedForReview, setMarkedForReview] = useState(new Set());
  const [showCalculator, setShowCalculator] = useState(false);
  const [showReferenceSheet, setShowReferenceSheet] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const [showNav, setShowNav] = useState(false);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const submitRef = useRef(null);
  const startTimeRef = useRef(null);
  const scrollContainerRef = useRef(null);
  const questionHeadingRef = useRef(null);
  const submittedRef = useRef(false); // prevent double-submit / zombie auto-submit

  const questions = useMemo(() => moduleData?.questions || [], [moduleData]);
  const currentQuestion = questions[currentIndex] || null;
  const subjectArea = moduleData?.subject_area || 'math';

  // ── R/W passage split ────────────────────────────────────────────────────
  const { passageHtml, questionHtml } = useMemo(
    () =>
      splitRWPrompt({
        promptHtml: currentQuestion?.prompt_html || '',
        passageHtml: currentQuestion?.passage_html || null,
        subjectArea,
      }),
    [currentQuestion, subjectArea]
  );
  const hasPassage = !!passageHtml;

  // ── Timer ────────────────────────────────────────────────────────────────
  const timeLimitSeconds = (moduleData?.time_limit_minutes || 0) * 60;
  const {
    timeRemaining,
    formattedTime,
    isPaused,
    start: startTimer,
    pause: pauseTimer,
    resume: resumeTimer,
    reset: resetTimer,
  } = useTimer(timeLimitSeconds, () => {
    if (submitRef.current && !submittedRef.current) {
      submitRef.current(true); // time-expired auto-submit
    }
  });

  // ── Initialize: start session (or resume) and load current module ───────
  useEffect(() => {
    let cancelled = false;
    const init = async () => {
      try {
        setLoading(true);

        let activeSessionId;
        if (UUID_REGEX.test(testNumber)) {
          // Returning to take the next module after a break
          activeSessionId = testNumber;
        } else {
          const startResp = await startPracticeTest(testNumber);
          activeSessionId = startResp.session_id;
        }
        if (cancelled) return;
        setSessionId(activeSessionId);

        const mod = await getCurrentModule(activeSessionId);
        if (cancelled) return;

        setModuleData(mod);
        setCurrentIndex(0);
        setAnswers({});
        setMarkedForReview(new Set());
        submittedRef.current = false;
        startTimeRef.current = Date.now();
        // Reset timer with this module's time limit, then start.
        resetTimer((mod.time_limit_minutes || 0) * 60);
        startTimer();
        setError(null);
      } catch (err) {
        if (!cancelled) {
          console.error('Error initializing practice test module:', err);
          setError('Failed to load test module');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    init();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [testNumber]);

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handleSelectAnswer = useCallback(
    (index) => {
      if (!currentQuestion) return;
      setAnswers((prev) => ({ ...prev, [currentQuestion.id]: index }));
    },
    [currentQuestion]
  );

  const handleSPRAnswer = useCallback(
    (value) => {
      if (!currentQuestion) return;
      setAnswers((prev) => ({ ...prev, [currentQuestion.id]: value }));
    },
    [currentQuestion]
  );

  const handleToggleMark = useCallback(() => {
    if (!currentQuestion) return;
    setMarkedForReview((prev) => {
      const next = new Set(prev);
      if (next.has(currentQuestion.id)) next.delete(currentQuestion.id);
      else next.add(currentQuestion.id);
      return next;
    });
  }, [currentQuestion]);

  // a11y: focus the question heading on navigation.
  useEffect(() => {
    const el = questionHeadingRef.current;
    if (el) el.focus({ preventScroll: false });
  }, [currentIndex]);

  const handleNavigate = useCallback((index) => {
    setCurrentIndex(index);
    setShowNav(false);
  }, []);

  const handlePrevious = useCallback(() => {
    setCurrentIndex((i) => Math.max(0, i - 1));
  }, []);

  const handleNext = useCallback(() => {
    setCurrentIndex((i) => Math.min(questions.length - 1, i + 1));
  }, [questions.length]);

  // ── Submit module ────────────────────────────────────────────────────────
  const handleSubmit = useCallback(
    async (timeExpired = false) => {
      if (submittedRef.current || !sessionId) return;
      submittedRef.current = true;

      try {
        setIsSubmitting(true);
        const elapsed = startTimeRef.current
          ? Math.floor((Date.now() - startTimeRef.current) / 1000)
          : 0;

        const responses = questions.map((q) => ({
          question_id: q.id,
          selected_answer: answers[q.id] ?? null,
        }));

        const result = await submitModule(sessionId, responses, elapsed);

        if (result.is_complete) {
          navigate(`/student/practice-tests/results/${sessionId}`);
        } else {
          navigate(`/student/practice-tests/break/${sessionId}`, {
            state: {
              currentModule: result.module_submitted,
              nextModule: result.next_module,
              modulePath: result.module_2_path,
              message: result.message,
              timeExpired,
            },
          });
        }
      } catch (err) {
        console.error('Failed to submit module:', err);
        submittedRef.current = false; // allow retry
        setIsSubmitting(false);
        // surface a non-blocking error in the page rather than alert()
        setError('Failed to submit module. Please try again.');
      }
    },
    [sessionId, questions, answers, navigate]
  );
  // Keep ref fresh so the timer's auto-submit calls the latest closure
  submitRef.current = handleSubmit;

  // ── UI helpers ───────────────────────────────────────────────────────────
  const questionId = currentQuestion?.id;
  const currentAnswer = questionId !== undefined ? answers[questionId] : undefined;
  const isCurrentMarked = questionId !== undefined && markedForReview.has(questionId);
  const answeredCount = Object.keys(answers).filter(
    (k) => answers[k] !== undefined && answers[k] !== null && answers[k] !== ''
  ).length;

  // ── Loading / error states ──────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-surface-page">
        <LoadingSpinner size="lg" text="Loading module..." />
      </div>
    );
  }
  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-surface-page">
        <Card className="max-w-md text-center p-6">
          <p className="text-rose-600 dark:text-rose-400 mb-4">{error}</p>
          <Button
            variant="primary"
            onClick={() => navigate('/student/practice-tests')}
          >
            Back to Practice Tests
          </Button>
        </Card>
      </div>
    );
  }
  if (!moduleData || !currentQuestion) return null;

  // ── Panels ───────────────────────────────────────────────────────────────
  const passagePanel = hasPassage ? (
    <div className="h-full overflow-auto p-6 bg-surface-card">
      <HighlightableText
        key={`passage-${currentQuestion.id}`}
        html={passageHtml}
        questionId={`passage-${currentQuestion.id}`}
      />
    </div>
  ) : null;

  const questionPanel = (
    <div className={`bg-surface-card pb-20 ${hasPassage ? 'h-full flex flex-col' : ''}`}>
      <div className={hasPassage ? 'flex-1 overflow-y-auto' : ''}>
        <QuestionDisplay
          questionNumber={currentIndex + 1}
          totalQuestions={questions.length}
          questionHtml={questionHtml || currentQuestion.prompt_html || ''}
          stimulusHtml={null}
          questionId={currentQuestion.id}
          isMarked={isCurrentMarked}
          onToggleMark={handleToggleMark}
          onReport={() => setShowReportModal(true)}
          headingRef={questionHeadingRef}
        />

        <div className="px-6 pb-4">
          <AnswerChoices
            choices={currentQuestion.choices_json || []}
            answerType={currentQuestion.answer_type || 'MCQ'}
            selectedIndex={typeof currentAnswer === 'number' ? currentAnswer : undefined}
            selectedAnswer={typeof currentAnswer === 'string' ? currentAnswer : undefined}
            onSelect={handleSelectAnswer}
            onAnswerChange={handleSPRAnswer}
            questionId={currentQuestion.id}
          />
        </div>
      </div>
    </div>
  );

  // ── Bottom nav bar ───────────────────────────────────────────────────────
  const isLast = currentIndex === questions.length - 1;
  const bottomNavBar = (
    <>
      {showNav && (
        <div
          className="fixed bottom-16 left-1/2 -translate-x-1/2 z-40 bg-surface-card shadow-xl border border-edge rounded-t-xl max-h-[50vh] overflow-hidden"
          style={{ width: 'min(500px, calc(100vw - 32px))' }}
        >
          <QuestionNav
            totalQuestions={questions.length}
            currentIndex={currentIndex}
            answers={answers}
            markedForReview={markedForReview}
            questions={questions}
            onNavigate={handleNavigate}
          />
        </div>
      )}

      <div className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-between px-4 py-3 border-t border-edge bg-surface-card">
        <Button
          variant="secondary"
          onClick={handlePrevious}
          disabled={currentIndex === 0}
          className="min-w-[100px]"
        >
          Previous
        </Button>

        <button
          onClick={() => setShowNav(!showNav)}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-ink-body bg-surface-muted rounded-lg hover:bg-surface-page"
        >
          <span className="font-semibold">{currentIndex + 1}</span>
          <span className="text-ink-faint">/</span>
          <span>{questions.length}</span>
          <svg
            className={`w-4 h-4 transition-transform ${showNav ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
          </svg>
        </button>

        {isLast ? (
          <Button
            variant="primary"
            onClick={() => setShowSubmitModal(true)}
            className="min-w-[100px]"
            disabled={isSubmitting}
          >
            Submit Module
          </Button>
        ) : (
          <Button variant="primary" onClick={handleNext} className="min-w-[100px]">
            Next
          </Button>
        )}
      </div>
    </>
  );

  return (
    <div className="h-screen flex flex-col bg-surface-card">
      <TestHeader
        currentQuestion={currentIndex + 1}
        totalQuestions={questions.length}
        timeRemaining={timeRemaining}
        formattedTime={formattedTime}
        isPaused={isPaused}
        onPause={pauseTimer}
        onResume={resumeTimer}
        onCalculatorToggle={() => setShowCalculator(!showCalculator)}
        showCalculator={showCalculator}
        onReferenceToggle={() => setShowReferenceSheet(!showReferenceSheet)}
        showReference={showReferenceSheet}
        subjectArea={subjectArea}
        hasTimeLimit={true}
        onDrawToggle={() => setIsDrawing((d) => !d)}
        isDrawing={isDrawing}
      />

      <div
        ref={scrollContainerRef}
        className={`flex-1 transition-all duration-300 bg-surface-card ${showCalculator ? 'mr-[440px]' : ''} ${hasPassage ? 'overflow-hidden' : 'overflow-y-auto'}`}
      >
        {hasPassage ? (
          <SplitPane
            left={passagePanel}
            right={questionPanel}
            defaultSplit={50}
            minLeft={25}
            minRight={35}
          />
        ) : (
          <div className="max-w-3xl mx-auto">{questionPanel}</div>
        )}
      </div>

      <DesmosCalculator
        isOpen={showCalculator}
        onClose={() => setShowCalculator(false)}
        initialPosition={{ x: window.innerWidth - 450, y: 116 }}
      />

      <ReferenceSheet
        isOpen={showReferenceSheet}
        onClose={() => setShowReferenceSheet(false)}
        initialPosition={{ x: 100, y: 116 }}
      />

      {showReportModal && (
        <ReportModal
          questionId={currentQuestion?.id}
          onClose={() => setShowReportModal(false)}
        />
      )}

      <SubmitConfirmation
        isOpen={showSubmitModal}
        onClose={() => setShowSubmitModal(false)}
        onConfirm={() => handleSubmit(false)}
        totalQuestions={questions.length}
        answeredCount={answeredCount}
        markedCount={markedForReview.size}
        isSubmitting={isSubmitting}
      />

      {bottomNavBar}

      <DrawingCanvas
        isActive={isDrawing}
        questionId={currentQuestion?.id ?? currentIndex}
        scrollRef={scrollContainerRef}
        showCalculator={showCalculator}
      />

      {isPaused && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-40 flex items-center justify-center">
          <Card className="text-center p-6">
            <h2 className="text-xl font-semibold text-ink-body">
              Test Paused
            </h2>
            <p className="text-ink-muted mt-2">Click resume to continue</p>
            <Button variant="primary" className="mt-4" onClick={resumeTimer}>
              Resume
            </Button>
          </Card>
        </div>
      )}
    </div>
  );
};

export default PracticeTestTakingPage;
