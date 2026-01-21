/**
 * Student Test Page - SAT-Realistic Test Interface
 * Split layout with passage/question, Desmos calculator, timer, navigation
 */
import { useState, useEffect, useCallback, useRef } from 'react';
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
  SubmitConfirmation,
} from '../../components/test';
import { useTimer } from '../../hooks';
import { assignmentService } from '../../services';

const TestPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  // Assignment and question state
  const [assignment, setAssignment] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [markedForReview, setMarkedForReview] = useState(new Set());

  // Check answer state
  const [checkedAnswers, setCheckedAnswers] = useState({}); // { questionId: { isCorrect, correctIndex, correctAnswer } }
  const [showExplanation, setShowExplanation] = useState(false);

  // UI state
  const [isLoading, setIsLoading] = useState(true);
  const [showCalculator, setShowCalculator] = useState(false);
  const [showReferenceSheet, setShowReferenceSheet] = useState(false);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [showNav, setShowNav] = useState(false);

  // Adaptive mode state
  const [isCheckingAnswer, setIsCheckingAnswer] = useState(false);
  const [adaptiveAnswerChecked, setAdaptiveAnswerChecked] = useState(false);
  const [isLoadingNextQuestion, setIsLoadingNextQuestion] = useState(false);
  const isAdaptive = assignment?.is_adaptive || false;

  // Ref to hold submit function (to avoid circular dependency with timer)
  const submitRef = useRef(null);

  // Timer
  const timeLimit = assignment?.time_limit_minutes
    ? assignment.time_limit_minutes * 60
    : 60 * 60; // Default 60 minutes

  const {
    timeRemaining,
    formattedTime,
    isPaused,
    start: startTimer,
    pause: pauseTimer,
    resume: resumeTimer,
  } = useTimer(timeLimit, () => {
    // Auto-submit when time runs out - pass true to indicate time expired
    if (submitRef.current) {
      submitRef.current(true);
    }
  });

  // Fetch assignment and questions
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Get assignment info
        const response = await assignmentService.getAssignment(id);
        const assignmentData = response.data;
        setAssignment(assignmentData);

        // If assignment is in progress or completed, load questions
        if (assignmentData.status === 'in_progress' || assignmentData.status === 'completed') {
          try {
            const questionsRes = await assignmentService.getAssignmentQuestions(id);
            const questionsData = questionsRes.data.questions || [];

            // Transform questions to expected format
            const transformedQuestions = questionsData.map(q => ({
              id: q.question_id,
              order: q.order,
              prompt_html: q.prompt_html,
              passage_html: q.passage_html,
              answer_type: q.answer_type || 'MCQ',
              choices_json: q.choices ? q.choices.map(c => c.content) : [],
              is_answered: q.is_answered,
              selected_answer: q.selected_answer,
              correct_answer: q.correct_answer, // { index } for MCQ or { answers: [...] } for SPR
              explanation_html: q.explanation_html,
            }));

            setQuestions(transformedQuestions);

            // Restore answers and checked state from API
            const savedAnswers = {};
            const savedCheckedAnswers = {};
            transformedQuestions.forEach(q => {
              if (q.selected_answer?.index !== undefined) {
                savedAnswers[q.id] = q.selected_answer.index;
              } else if (q.selected_answer?.answer !== undefined) {
                // SPR answer
                savedAnswers[q.id] = q.selected_answer.answer;
              }
              // If question was answered, restore checked state (for adaptive mode)
              if (q.is_answered && q.correct_answer) {
                let isCorrect = false;
                if (q.selected_answer?.index !== undefined && q.correct_answer?.index !== undefined) {
                  isCorrect = q.selected_answer.index === q.correct_answer.index;
                } else if (q.selected_answer?.answer !== undefined && q.correct_answer?.answers) {
                  const userAnswerNorm = String(q.selected_answer.answer).trim().toLowerCase();
                  isCorrect = q.correct_answer.answers.some(ans =>
                    String(ans).trim().toLowerCase() === userAnswerNorm
                  );
                }
                savedCheckedAnswers[q.id] = {
                  isCorrect,
                  correctIndex: q.correct_answer?.index,
                  correctAnswers: q.correct_answer?.answers,
                };
              }
            });
            setAnswers(savedAnswers);
            setCheckedAnswers(savedCheckedAnswers);

            // For adaptive mode, position at the last question (current working question)
            if (assignmentData.is_adaptive && transformedQuestions.length > 0) {
              // Find the last question that hasn't been checked yet, or the last question
              const lastUncheckedIndex = transformedQuestions.findIndex(q => !savedCheckedAnswers[q.id]);
              if (lastUncheckedIndex >= 0) {
                setCurrentIndex(lastUncheckedIndex);
              } else {
                // All questions checked, go to last one
                setCurrentIndex(transformedQuestions.length - 1);
              }
            }
          } catch (qErr) {
            console.error('Failed to fetch questions:', qErr);
          }
        }
      } catch (err) {
        console.error('Failed to fetch assignment:', err);
        setError('Failed to load assignment');
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [id]);

  // Start timer when assignment loads and is in progress
  useEffect(() => {
    if (assignment?.status === 'in_progress') {
      startTimer();
    }
  }, [assignment?.status, startTimer]);

  // Current question
  const currentQuestion = questions[currentIndex] || null;
  // Show split pane for any question with a passage (Reading/Writing questions)
  const passageHtml = currentQuestion?.passage_html;
  const hasPassage = !!passageHtml;

  // Sync adaptiveAnswerChecked state when current question changes (for resume)
  const currentQuestionId = currentQuestion?.id;
  const currentQuestionHasExplanation = !!currentQuestion?.explanation_html;
  useEffect(() => {
    if (isAdaptive && currentQuestionId) {
      const isAlreadyChecked = !!checkedAnswers[currentQuestionId];
      setAdaptiveAnswerChecked(isAlreadyChecked);
      // Also show explanation if already checked
      if (isAlreadyChecked && currentQuestionHasExplanation) {
        setShowExplanation(true);
      }
    }
  }, [currentQuestionId, currentQuestionHasExplanation, isAdaptive, checkedAnswers]);

  // Handlers
  const handleStartAssignment = async () => {
    try {
      await assignmentService.startAssignment(id);

      // Reload assignment and questions
      const response = await assignmentService.getAssignment(id);
      setAssignment(response.data);

      // Load questions
      const questionsRes = await assignmentService.getAssignmentQuestions(id);
      const questionsData = questionsRes.data.questions || [];

      const transformedQuestions = questionsData.map(q => ({
        id: q.question_id,
        order: q.order,
        prompt_html: q.prompt_html,
        passage_html: q.passage_html,
        answer_type: q.answer_type || 'MCQ',
        choices_json: q.choices ? q.choices.map(c => c.content) : [],
        is_answered: q.is_answered,
        selected_answer: q.selected_answer,
        correct_answer: q.correct_answer,
        explanation_html: q.explanation_html,
      }));

      setQuestions(transformedQuestions);
      startTimer();
    } catch (err) {
      console.error('Failed to start assignment:', err);
      setError('Failed to start assignment');
    }
  };

  const handleSelectAnswer = useCallback((index) => {
    const questionId = currentQuestion?.id || currentIndex;
    setAnswers((prev) => ({
      ...prev,
      [questionId]: index,
    }));

    // For non-adaptive, submit answer immediately
    // For adaptive, wait for explicit "Check Answer" click
    if (!isAdaptive) {
      assignmentService.submitAnswer(id, {
        question_id: currentQuestion?.id,
        answer: { index },
      }).catch(console.error);
    }
  }, [currentQuestion, currentIndex, id, isAdaptive]);

  // Handler for SPR (free text) answers
  const handleSPRAnswer = useCallback((answerText) => {
    const questionId = currentQuestion?.id || currentIndex;
    setAnswers((prev) => ({
      ...prev,
      [questionId]: answerText,
    }));

    // For non-adaptive, submit answer immediately
    // For adaptive, wait for explicit "Check Answer" click
    if (!isAdaptive) {
      assignmentService.submitAnswer(id, {
        question_id: currentQuestion?.id,
        answer: { answer: answerText },
      }).catch(console.error);
    }
  }, [currentQuestion, currentIndex, id, isAdaptive]);

  const handleToggleMark = useCallback(() => {
    const questionId = currentQuestion?.id || currentIndex;
    setMarkedForReview((prev) => {
      const next = new Set(prev);
      if (next.has(questionId)) {
        next.delete(questionId);
      } else {
        next.add(questionId);
      }
      return next;
    });
  }, [currentQuestion, currentIndex]);

  const handleNavigate = useCallback((index) => {
    setCurrentIndex(index);
    setShowExplanation(false); // Reset explanation when navigating
  }, []);

  // Check answer for current question
  const handleCheckAnswer = useCallback(() => {
    const question = currentQuestion;
    if (!question) return;

    const questionId = question.id;
    const userAnswer = answers[questionId];

    if (userAnswer === undefined) return;

    let isCorrect = false;
    let correctIndex = null;
    let correctAnswers = null;

    if (question.answer_type === 'MCQ') {
      correctIndex = question.correct_answer?.index;
      isCorrect = userAnswer === correctIndex;
    } else {
      // SPR - check against correct answers array
      correctAnswers = question.correct_answer?.answers || [];
      const userAnswerNorm = String(userAnswer).trim().toLowerCase();
      isCorrect = correctAnswers.some(ans =>
        String(ans).trim().toLowerCase() === userAnswerNorm
      );
    }

    setCheckedAnswers(prev => ({
      ...prev,
      [questionId]: { isCorrect, correctIndex, correctAnswers },
    }));
  }, [currentQuestion, answers]);

  const handlePrevious = useCallback(() => {
    setCurrentIndex((prev) => Math.max(0, prev - 1));
    setShowExplanation(false);
  }, []);

  const handleNext = useCallback(() => {
    setCurrentIndex((prev) => Math.min(questions.length - 1, prev + 1));
    setShowExplanation(false);
  }, [questions.length]);

  // Submit/complete assignment - defined before handleAdaptiveNext which uses it
  const handleSubmit = useCallback(async (timeExpired = false) => {
    setIsSubmitting(true);
    try {
      await assignmentService.completeAssignment(id, { time_expired: timeExpired });
      navigate(`/student/results/${id}`);
    } catch (err) {
      console.error('Failed to submit:', err);
      setError('Failed to submit. Please try again.');
    } finally {
      setIsSubmitting(false);
      setShowSubmitModal(false);
    }
  }, [id, navigate]);

  // Keep submitRef updated for timer callback
  useEffect(() => {
    submitRef.current = handleSubmit;
  }, [handleSubmit]);

  // Adaptive mode: Check answer and get feedback from API
  const handleAdaptiveCheckAnswer = useCallback(async () => {
    const question = currentQuestion;
    if (!question) return;

    const questionId = question.id;
    const userAnswer = answers[questionId];
    if (userAnswer === undefined) return;

    setIsCheckingAnswer(true);
    try {
      // Submit answer to API and get result
      const answerPayload = question.answer_type === 'MCQ'
        ? { index: userAnswer }
        : { answer: userAnswer };

      const response = await assignmentService.submitAnswer(id, {
        question_id: questionId,
        answer: answerPayload,
      });

      const result = response.data;

      // Update checked answers state with result from API
      setCheckedAnswers(prev => ({
        ...prev,
        [questionId]: {
          isCorrect: result.is_correct,
          correctIndex: result.correct_answer?.index,
          correctAnswers: result.correct_answer?.answers,
        },
      }));

      // Store explanation from API response
      if (result.explanation_html) {
        setQuestions(prev => prev.map(q =>
          q.id === questionId ? { ...q, explanation_html: result.explanation_html } : q
        ));
      }

      setAdaptiveAnswerChecked(true);
      setShowExplanation(true); // Auto-show explanation in adaptive mode
    } catch (err) {
      console.error('Failed to check answer:', err);
      setError('Failed to check answer. Please try again.');
    } finally {
      setIsCheckingAnswer(false);
    }
  }, [currentQuestion, answers, id]);

  // Adaptive mode: Load next question
  const handleAdaptiveNext = useCallback(async () => {
    const totalNeeded = assignment?.total_questions || 10;
    const questionsAnswered = Object.keys(checkedAnswers).length;

    // Check if this was the last question
    if (questionsAnswered >= totalNeeded) {
      // Submit/complete the assignment
      handleSubmit();
      return;
    }

    setIsLoadingNextQuestion(true);
    try {
      // Refetch questions to get the newly added question
      const questionsRes = await assignmentService.getAssignmentQuestions(id);
      const questionsData = questionsRes.data.questions || [];

      const transformedQuestions = questionsData.map(q => ({
        id: q.question_id,
        order: q.order,
        prompt_html: q.prompt_html,
        passage_html: q.passage_html,
        answer_type: q.answer_type || 'MCQ',
        choices_json: q.choices ? q.choices.map(c => c.content) : [],
        is_answered: q.is_answered,
        selected_answer: q.selected_answer,
        correct_answer: q.correct_answer,
        explanation_html: q.explanation_html,
      }));

      setQuestions(transformedQuestions);
      setCurrentIndex(transformedQuestions.length - 1); // Go to the new question
      setAdaptiveAnswerChecked(false);
      setShowExplanation(false);
    } catch (err) {
      console.error('Failed to load next question:', err);
      setError('Failed to load next question.');
    } finally {
      setIsLoadingNextQuestion(false);
    }
  }, [id, assignment, checkedAnswers, handleSubmit]);

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-white">
        <LoadingSpinner size="lg" text="Loading test..." />
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex items-center justify-center h-screen bg-white">
        <Card className="max-w-md text-center">
          <p className="text-red-600">{error}</p>
          <Button
            variant="secondary"
            className="mt-4"
            onClick={() => navigate('/student/assignments')}
          >
            Back to Assignments
          </Button>
        </Card>
      </div>
    );
  }

  // Not found
  if (!assignment) {
    return (
      <div className="flex items-center justify-center h-screen bg-white">
        <Card className="max-w-md text-center">
          <p className="text-gray-500">Assignment not found</p>
          <Button
            variant="secondary"
            className="mt-4"
            onClick={() => navigate('/student/assignments')}
          >
            Back to Assignments
          </Button>
        </Card>
      </div>
    );
  }

  // Check if assignment is overdue
  const isOverdue = assignment.due_date && new Date(assignment.due_date) < new Date();

  // Start screen
  if (assignment.status === 'pending') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full text-center">
          <h1 className="text-xl font-semibold text-gray-900">{assignment.title}</h1>
          {assignment.instructions && (
            <p className="text-gray-500 mt-2">{assignment.instructions}</p>
          )}
          <div className="mt-6 space-y-2 text-sm text-gray-600">
            <p>{assignment.total_questions ? `${assignment.total_questions} questions` : 'Unlimited questions'}</p>
            {assignment.time_limit_minutes && (
              <p className="flex items-center justify-center gap-1">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Time limit: {assignment.time_limit_minutes} minutes
              </p>
            )}
            {assignment.due_date && (
              <p className={`flex items-center justify-center gap-1 ${isOverdue ? 'text-red-600 font-medium' : ''}`}>
                {isOverdue ? (
                  <>
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    Overdue - was due {new Date(assignment.due_date).toLocaleDateString()}
                  </>
                ) : (
                  <>Due: {new Date(assignment.due_date).toLocaleDateString()}</>
                )}
              </p>
            )}
          </div>

          {isOverdue ? (
            <div className="mt-6 space-y-3">
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-700">
                  This assignment is past its due date and can no longer be started.
                </p>
              </div>
              <Button
                variant="secondary"
                className="w-full"
                onClick={() => navigate('/student/assignments')}
              >
                Back to Assignments
              </Button>
            </div>
          ) : (
            <Button
              variant="primary"
              className="mt-6 w-full"
              onClick={handleStartAssignment}
            >
              Start Assessment
            </Button>
          )}
        </Card>
      </div>
    );
  }

  // Get current answer and check status
  const questionId = currentQuestion?.id || currentIndex;
  const currentAnswer = answers[questionId];
  const isCurrentMarked = markedForReview.has(questionId);
  const answeredCount = Object.keys(answers).length;
  const currentChecked = checkedAnswers[questionId];
  const isAnswered = currentAnswer !== undefined;

  // Question panel content (without bottom nav - that's now fixed to viewport)
  // For split pane (with passage), use scrollable container
  // For single column (no passage), let content flow naturally
  const questionPanel = (
    <div className={`bg-white pb-20 ${hasPassage ? 'h-full flex flex-col' : ''}`}>
      {/* Content area - scrollable only in split pane mode */}
      <div className={hasPassage ? 'flex-1 overflow-y-auto' : ''}>
        <QuestionDisplay
          questionNumber={currentIndex + 1}
          questionHtml={currentQuestion?.prompt_html || ''}
          stimulusHtml={null}
          isMarked={isCurrentMarked}
          onToggleMark={handleToggleMark}
          onReport={() => console.log('Report question')}
          hideMarkForReview={isAdaptive}
        />

        {/* Answer choices or SPR input */}
        <div className="px-6 pb-4">
          <AnswerChoices
            choices={currentQuestion?.choices_json || []}
            answerType={currentQuestion?.answer_type || 'MCQ'}
            selectedIndex={typeof currentAnswer === 'number' ? currentAnswer : undefined}
            selectedAnswer={typeof currentAnswer === 'string' ? currentAnswer : undefined}
            onSelect={handleSelectAnswer}
            onAnswerChange={handleSPRAnswer}
            questionId={currentQuestion?.id}
            isChecked={!!currentChecked}
            correctIndex={currentChecked?.correctIndex}
            isCorrect={currentChecked?.isCorrect}
          />

          {/* Check Answer / Show Explanation buttons - different for adaptive vs regular */}
          {!isAdaptive && (
            <div className="mt-4 flex items-center gap-3">
              {!currentChecked && isAnswered && (
                <Button
                  variant="secondary"
                  onClick={handleCheckAnswer}
                  className="text-sm"
                >
                  Check Answer
                </Button>
              )}
              {currentChecked && currentQuestion?.explanation_html && (
                <Button
                  variant="secondary"
                  onClick={() => setShowExplanation(!showExplanation)}
                  className="text-sm"
                >
                  {showExplanation ? 'Hide Explanation' : 'Show Explanation'}
                </Button>
              )}
              {currentChecked && !currentQuestion?.explanation_html && (
                <span className="text-sm text-gray-400 italic">
                  No explanation available for this question
                </span>
              )}
              {currentChecked && !currentChecked.isCorrect && currentQuestion?.answer_type === 'SPR' && (
                <span className="text-sm text-gray-600">
                  {currentChecked.correctAnswers?.length > 0 && currentChecked.correctAnswers[0] !== '*'
                    ? `Correct answer: ${currentChecked.correctAnswers.join(' or ')}`
                    : 'See explanation for correct answer'}
                </span>
              )}
            </div>
          )}

          {/* Explanation display - auto-shown in adaptive mode after checking */}
          {showExplanation && currentQuestion?.explanation_html && (
            <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <h4 className="text-sm font-medium text-blue-900 mb-2">Explanation</h4>
              <div
                className="prose prose-sm prose-blue max-w-none text-blue-800"
                dangerouslySetInnerHTML={{ __html: currentQuestion.explanation_html }}
              />
            </div>
          )}
          {/* Show "no explanation" message in adaptive mode */}
          {isAdaptive && adaptiveAnswerChecked && !currentQuestion?.explanation_html && (
            <div className="mt-4 p-4 bg-gray-50 border border-gray-200 rounded-lg">
              <span className="text-sm text-gray-500 italic">
                No explanation available for this question
              </span>
            </div>
          )}
          {/* Show correct answer for SPR in adaptive mode */}
          {isAdaptive && adaptiveAnswerChecked && !currentChecked?.isCorrect && currentQuestion?.answer_type === 'SPR' && (
            <div className="mt-2 text-sm text-gray-600">
              {currentChecked?.correctAnswers?.length > 0 && currentChecked.correctAnswers[0] !== '*'
                ? `Correct answer: ${currentChecked.correctAnswers.join(' or ')}`
                : ''}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  // Bottom navigation bar (fixed to viewport bottom)
  // Different layout for adaptive vs regular mode
  const totalNeeded = assignment?.total_questions || 10;
  const questionsAnsweredCount = Object.keys(checkedAnswers).length;
  const isLastAdaptiveQuestion = questionsAnsweredCount >= totalNeeded - 1 && adaptiveAnswerChecked;

  const bottomNavBar = isAdaptive ? (
    // Adaptive mode: simpler navigation with Check/Next flow
    <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-gray-200 bg-white">
      {/* Progress indicator */}
      <div className="flex items-center justify-center py-2 border-b border-gray-100">
        <span className="text-sm text-gray-600">
          Question <span className="font-semibold">{questionsAnsweredCount + 1}</span> of{' '}
          <span className="font-semibold">{totalNeeded}</span>
        </span>
      </div>

      {/* Single action button */}
      <div className="flex items-center justify-center px-4 py-3">
        {!adaptiveAnswerChecked ? (
          // Show Check Answer button
          <Button
            variant="primary"
            onClick={handleAdaptiveCheckAnswer}
            disabled={!isAnswered || isCheckingAnswer}
            className="min-w-[200px]"
          >
            {isCheckingAnswer ? 'Checking...' : 'Check Answer'}
          </Button>
        ) : isLastAdaptiveQuestion ? (
          // Last question - show Finish button
          <Button
            variant="primary"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="min-w-[200px]"
          >
            {isSubmitting ? 'Submitting...' : 'Finish'}
          </Button>
        ) : (
          // Show Next Question button
          <Button
            variant="primary"
            onClick={handleAdaptiveNext}
            disabled={isLoadingNextQuestion}
            className="min-w-[200px]"
          >
            {isLoadingNextQuestion ? 'Loading...' : 'Next Question'}
          </Button>
        )}
      </div>
    </div>
  ) : (
    // Regular mode: full navigation
    <>
      {/* Collapsible Question Navigator */}
      {showNav && (
        <div className="fixed bottom-16 left-1/2 -translate-x-1/2 z-40 bg-white shadow-xl border border-gray-200 rounded-t-xl max-h-[50vh] overflow-hidden"
             style={{ width: 'min(500px, calc(100vw - 32px))' }}>
          <QuestionNav
            totalQuestions={questions.length}
            currentIndex={currentIndex}
            answers={answers}
            markedForReview={markedForReview}
            questions={questions}
            checkedAnswers={checkedAnswers}
            onNavigate={(index) => {
              handleNavigate(index);
              setShowNav(false);
            }}
          />
        </div>
      )}

      {/* Fixed bottom controls */}
      <div className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-between px-4 py-3 border-t border-gray-200 bg-white">
        {/* Previous */}
        <Button
          variant="secondary"
          onClick={handlePrevious}
          disabled={currentIndex === 0}
          className="min-w-[100px]"
        >
          Previous
        </Button>

        {/* Question selector */}
        <button
          onClick={() => setShowNav(!showNav)}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
        >
          <span className="font-semibold">{currentIndex + 1}</span>
          <span className="text-gray-400">/</span>
          <span>{questions.length}</span>
          <svg className={`w-4 h-4 transition-transform ${showNav ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
          </svg>
        </button>

        {/* Next or Submit */}
        {currentIndex === questions.length - 1 ? (
          <Button
            variant="primary"
            onClick={() => setShowSubmitModal(true)}
            className="min-w-[100px]"
          >
            Submit
          </Button>
        ) : (
          <Button
            variant="primary"
            onClick={handleNext}
            className="min-w-[100px]"
          >
            Next
          </Button>
        )}
      </div>
    </>
  );

  // Passage panel content
  const passagePanel = hasPassage ? (
    <div className="h-full overflow-auto p-6 bg-white">
      <div
        className="prose prose-gray max-w-none"
        dangerouslySetInnerHTML={{ __html: currentQuestion.passage_html }}
      />
    </div>
  ) : (
    <div className="h-full flex items-center justify-center bg-gray-50">
      <p className="text-gray-400">No passage for this question</p>
    </div>
  );

  return (
    <div className="h-screen flex flex-col bg-white">
      {/* Header */}
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
        subjectArea={assignment.subject_area || 'math'}
      />

      {/* Main content - shifts right when calculator is open */}
      <div className={`flex-1 transition-all duration-300 ${showCalculator ? 'mr-[440px]' : ''} ${hasPassage ? 'overflow-hidden' : 'overflow-y-auto'}`}>
        {hasPassage ? (
          <SplitPane
            left={passagePanel}
            right={questionPanel}
            defaultSplit={50}
            minLeft={25}
            minRight={35}
          />
        ) : (
          <div className="max-w-3xl mx-auto">
            {questionPanel}
          </div>
        )}
      </div>

      {/* Desmos Calculator */}
      <DesmosCalculator
        isOpen={showCalculator}
        onClose={() => setShowCalculator(false)}
        initialPosition={{ x: window.innerWidth - 450, y: 80 }}
      />

      {/* Reference Sheet */}
      <ReferenceSheet
        isOpen={showReferenceSheet}
        onClose={() => setShowReferenceSheet(false)}
        initialPosition={{ x: 100, y: 80 }}
      />

      {/* Submit Confirmation Modal */}
      <SubmitConfirmation
        isOpen={showSubmitModal}
        onClose={() => setShowSubmitModal(false)}
        onConfirm={handleSubmit}
        totalQuestions={questions.length}
        answeredCount={answeredCount}
        markedCount={markedForReview.size}
        isSubmitting={isSubmitting}
      />

      {/* Fixed bottom navigation bar */}
      {bottomNavBar}

      {/* Paused overlay */}
      {isPaused && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-40 flex items-center justify-center">
          <Card className="text-center">
            <h2 className="text-xl font-semibold text-gray-900">Test Paused</h2>
            <p className="text-gray-500 mt-2">Click resume to continue</p>
            <Button
              variant="primary"
              className="mt-4"
              onClick={resumeTimer}
            >
              Resume Test
            </Button>
          </Card>
        </div>
      )}
    </div>
  );
};

export default TestPage;
