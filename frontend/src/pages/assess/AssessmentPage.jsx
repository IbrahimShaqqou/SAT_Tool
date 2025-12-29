/**
 * Assessment Page - SAT-Realistic Test Interface
 * For students taking assessments via invite links
 * Requires student account (login or register)
 */
import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { CheckCircle, AlertCircle, User, UserPlus } from 'lucide-react';
import { Card, Button, Input, LoadingSpinner } from '../../components/ui';
import {
  TestHeader,
  QuestionNav,
  QuestionDisplay,
  AnswerChoices,
  DesmosCalculator,
  SplitPane,
  SubmitConfirmation,
} from '../../components/test';
import { useTimer } from '../../hooks';
import { useAuth } from '../../contexts/AuthContext';
import { assessService } from '../../services';

// Assessment states
const STATES = {
  LOADING: 'loading',
  AUTH_REQUIRED: 'auth_required',  // Need to login or register
  INTRO: 'intro',
  IN_PROGRESS: 'in_progress',
  SUBMITTING: 'submitting',
  COMPLETED: 'completed',
  ERROR: 'error',
};

// Auth modes
const AUTH_MODES = {
  CHOOSE: 'choose',
  LOGIN: 'login',
  REGISTER: 'register',
};

// Extract error message from API response
const getErrorMessage = (err, fallback = 'An error occurred') => {
  const detail = err.response?.data?.detail;
  if (!detail) return fallback;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail) && detail.length > 0) {
    return detail[0].msg || fallback;
  }
  return fallback;
};

const AssessmentPage = () => {
  const { token } = useParams();
  const navigate = useNavigate();
  const { user, login, register } = useAuth();

  // State management
  const [state, setState] = useState(STATES.LOADING);
  const [error, setError] = useState(null);
  const [config, setConfig] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [markedForReview, setMarkedForReview] = useState(new Set());
  const [checkedAnswers, setCheckedAnswers] = useState({});
  const [showExplanation, setShowExplanation] = useState(false);
  const [results, setResults] = useState(null);

  // UI state
  const [showCalculator, setShowCalculator] = useState(false);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [showNav, setShowNav] = useState(false);

  // Auth state
  const [authMode, setAuthMode] = useState(AUTH_MODES.CHOOSE);
  const [authError, setAuthError] = useState('');
  const [isAuthLoading, setIsAuthLoading] = useState(false);
  const [loginForm, setLoginForm] = useState({ email: '', password: '' });
  const [registerForm, setRegisterForm] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    first_name: '',
    last_name: '',
  });

  // Timer
  const timeLimit = config?.time_limit_minutes ? config.time_limit_minutes * 60 : null;

  const {
    timeRemaining,
    formattedTime,
    isPaused,
    start: startTimer,
    pause: pauseTimer,
    resume: resumeTimer,
  } = useTimer(timeLimit || 3600, () => {
    // Auto-submit when time runs out
    if (timeLimit) {
      handleSubmit();
    }
  });

  // Fetch assessment config
  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const response = await assessService.getConfig(token);
        setConfig(response.data);
        // Check if user is logged in as a student
        if (user && user.role === 'student') {
          setState(STATES.INTRO);
        } else {
          setState(STATES.AUTH_REQUIRED);
        }
      } catch (err) {
        console.error('Failed to fetch assessment config:', err);
        setError(getErrorMessage(err, 'Assessment not found or expired'));
        setState(STATES.ERROR);
      }
    };

    fetchConfig();
  }, [token, user]);

  // Handle login
  const handleLogin = async (e) => {
    e.preventDefault();
    setAuthError('');
    setIsAuthLoading(true);

    try {
      const result = await login(loginForm.email, loginForm.password);
      if (!result.success) {
        setAuthError(result.error || 'Invalid email or password');
      }
      // Auth context will update user, useEffect will transition to INTRO
    } catch (err) {
      setAuthError(getErrorMessage(err, 'Invalid email or password'));
    } finally {
      setIsAuthLoading(false);
    }
  };

  // Handle registration
  const handleRegister = async (e) => {
    e.preventDefault();
    setAuthError('');

    // Validate passwords match
    if (registerForm.password !== registerForm.confirmPassword) {
      setAuthError('Passwords do not match');
      return;
    }

    // Validate password length
    if (registerForm.password.length < 8) {
      setAuthError('Password must be at least 8 characters');
      return;
    }

    setIsAuthLoading(true);

    try {
      // Register the student (auth context handles auto-login)
      const result = await register({
        email: registerForm.email,
        password: registerForm.password,
        first_name: registerForm.first_name,
        last_name: registerForm.last_name,
        role: 'student',
      });

      if (!result.success) {
        setAuthError(result.error || 'Registration failed');
      }
      // Auth context will update user, useEffect will transition to INTRO
    } catch (err) {
      setAuthError(getErrorMessage(err, 'Registration failed. Email may already be in use.'));
    } finally {
      setIsAuthLoading(false);
    }
  };

  // Current question
  const currentQuestion = questions[currentIndex] || null;
  const passageHtml = currentQuestion?.passage_html;
  // Show split pane for any question with a passage
  const hasPassage = !!passageHtml;

  // Handlers
  const handleStart = async () => {
    setState(STATES.LOADING);
    try {
      // Start the assessment (user is authenticated, no guest info needed)
      const startRes = await assessService.start(token, {});

      // Get questions
      const questionsRes = await assessService.getQuestions(token);
      const questionsData = questionsRes.data.questions || [];

      // Transform questions to expected format
      const transformedQuestions = questionsData.map(q => ({
        id: q.question_id,
        order: q.order,
        prompt_html: q.prompt_html,
        passage_html: q.passage_html,
        answer_type: q.answer_type || 'MCQ',
        choices_json: q.choices ? q.choices.map(c => c.content) : [],
      }));

      setQuestions(transformedQuestions);

      // If resuming, restore previous answers and state
      if (startRes.data.is_resuming) {
        try {
          const answersRes = await assessService.getAnswers(token);
          const { answers: savedAnswers, flagged_question_ids, current_question_index } = answersRes.data;

          // Restore answers - convert from backend format to frontend format
          const restoredAnswers = {};
          const restoredChecked = {};
          Object.entries(savedAnswers || {}).forEach(([questionId, answerData]) => {
            // answerData has: answer (the submitted answer), is_correct, correct_answer
            if (answerData.answer?.index !== undefined) {
              restoredAnswers[questionId] = answerData.answer.index;
            } else if (answerData.answer?.answer !== undefined) {
              restoredAnswers[questionId] = answerData.answer.answer;
            }
            // Mark as checked since answer was already submitted
            restoredChecked[questionId] = {
              isCorrect: answerData.is_correct,
              correctIndex: answerData.correct_answer?.index,
              correctAnswers: answerData.correct_answer?.answers,
              explanation: answerData.explanation_html,
            };
          });

          setAnswers(restoredAnswers);
          setCheckedAnswers(restoredChecked);

          // Restore flagged questions
          if (flagged_question_ids && flagged_question_ids.length > 0) {
            setMarkedForReview(new Set(flagged_question_ids));
          }

          // Set current position
          setCurrentIndex(current_question_index || startRes.data.current_question_index || 0);
        } catch (restoreErr) {
          console.warn('Failed to restore session state:', restoreErr);
          // Continue anyway with fresh state
        }
      }

      // Start timer if time limit exists
      if (startRes.data.time_limit_minutes) {
        startTimer();
      }

      setState(STATES.IN_PROGRESS);
    } catch (err) {
      console.error('Failed to start assessment:', err);
      setError(getErrorMessage(err, 'Failed to start assessment'));
      setState(STATES.ERROR);
    }
  };

  const handleSelectAnswer = useCallback((index) => {
    if (!currentQuestion) return;
    const questionId = currentQuestion.id;

    // Don't allow changing if already checked
    if (checkedAnswers[questionId]) return;

    setAnswers((prev) => ({
      ...prev,
      [questionId]: index,
    }));
  }, [currentQuestion, checkedAnswers]);

  const handleSPRAnswer = useCallback((answerText) => {
    if (!currentQuestion) return;
    const questionId = currentQuestion.id;

    // Don't allow changing if already checked
    if (checkedAnswers[questionId]) return;

    setAnswers((prev) => ({
      ...prev,
      [questionId]: answerText,
    }));
  }, [currentQuestion, checkedAnswers]);

  const handleToggleMark = useCallback(() => {
    if (!currentQuestion) return;
    const questionId = currentQuestion.id;

    setMarkedForReview((prev) => {
      const next = new Set(prev);
      if (next.has(questionId)) {
        next.delete(questionId);
      } else {
        next.add(questionId);
      }
      return next;
    });
    // Persist flag to backend (fire and forget)
    assessService.toggleFlag(token, questionId).catch(() => {});
  }, [currentQuestion, token]);

  const handleNavigate = useCallback((index) => {
    setCurrentIndex(index);
    setShowExplanation(false);
    // Save position to backend (fire and forget)
    assessService.updateState(token, index).catch(() => {});
  }, [token]);

  // Check answer for current question
  const handleCheckAnswer = useCallback(async () => {
    if (!currentQuestion) return;

    const questionId = currentQuestion.id;
    const userAnswer = answers[questionId];

    if (userAnswer === undefined) return;

    try {
      // Submit answer to API
      const answerPayload = typeof userAnswer === 'number'
        ? { index: userAnswer }
        : { answer: userAnswer };

      const response = await assessService.submitAnswer(token, {
        question_id: questionId,
        answer: answerPayload,
        time_spent_seconds: 0,
      });

      setCheckedAnswers(prev => ({
        ...prev,
        [questionId]: {
          isCorrect: response.data.is_correct,
          correctIndex: response.data.correct_answer?.index,
          correctAnswers: response.data.correct_answer?.answers,
          explanation: response.data.explanation_html,
        },
      }));
    } catch (err) {
      console.error('Failed to submit answer:', err);
    }
  }, [currentQuestion, answers, token]);

  const handlePrevious = useCallback(() => {
    setCurrentIndex((prev) => {
      const newIndex = Math.max(0, prev - 1);
      // Save position to backend (fire and forget)
      assessService.updateState(token, newIndex).catch(() => {});
      return newIndex;
    });
    setShowExplanation(false);
  }, [token]);

  const handleNext = useCallback(() => {
    setCurrentIndex((prev) => {
      const newIndex = Math.min(questions.length - 1, prev + 1);
      // Save position to backend (fire and forget)
      assessService.updateState(token, newIndex).catch(() => {});
      return newIndex;
    });
    setShowExplanation(false);
  }, [questions.length, token]);

  const handleSubmit = async () => {
    setShowSubmitModal(false);
    setState(STATES.SUBMITTING);

    try {
      const response = await assessService.submit(token);
      setResults(response.data);
      setState(STATES.COMPLETED);
    } catch (err) {
      console.error('Failed to submit assessment:', err);
      setError(getErrorMessage(err, 'Failed to submit assessment'));
      setState(STATES.ERROR);
    }
  };

  // Error state
  if (state === STATES.ERROR) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full text-center">
          <div className="p-6">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h1 className="text-xl font-semibold text-gray-900 mb-2">Assessment Unavailable</h1>
            <p className="text-gray-600">{error}</p>
          </div>
        </Card>
      </div>
    );
  }

  // Loading state
  if (state === STATES.LOADING) {
    return (
      <div className="flex items-center justify-center h-screen bg-white">
        <LoadingSpinner size="lg" text="Loading assessment..." />
      </div>
    );
  }

  // Auth required state - login or register
  if (state === STATES.AUTH_REQUIRED && config) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="max-w-lg w-full">
          <div className="p-6">
            {/* Assessment info header */}
            <div className="text-center mb-6">
              <h1 className="text-2xl font-semibold text-gray-900 mb-2">
                {config.title || 'SAT Practice Assessment'}
              </h1>
              <p className="text-gray-600">
                Prepared by {config.tutor_name}
              </p>
              <div className="mt-4 bg-gray-50 rounded-lg p-3 text-sm text-gray-600">
                <div>{config.question_count} questions</div>
                <div>{config.subject_area === 'math' ? 'Math' : 'Reading & Writing'}</div>
                {config.time_limit_minutes && <div>~{config.time_limit_minutes} minutes</div>}
              </div>
            </div>

            {/* Auth error */}
            {authError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                {authError}
              </div>
            )}

            {/* Choose mode */}
            {authMode === AUTH_MODES.CHOOSE && (
              <div className="space-y-4">
                <p className="text-center text-gray-600 mb-4">
                  Create an account or log in to take this assessment. Your results will be saved to your profile.
                </p>
                <Button
                  variant="primary"
                  size="lg"
                  className="w-full"
                  onClick={() => setAuthMode(AUTH_MODES.REGISTER)}
                >
                  <UserPlus className="h-5 w-5 mr-2" />
                  Create Account
                </Button>
                <Button
                  variant="secondary"
                  size="lg"
                  className="w-full"
                  onClick={() => setAuthMode(AUTH_MODES.LOGIN)}
                >
                  <User className="h-5 w-5 mr-2" />
                  I have an account
                </Button>
              </div>
            )}

            {/* Login form */}
            {authMode === AUTH_MODES.LOGIN && (
              <form onSubmit={handleLogin} className="space-y-4">
                <Input
                  label="Email"
                  type="email"
                  value={loginForm.email}
                  onChange={(e) => setLoginForm({ ...loginForm, email: e.target.value })}
                  required
                  autoFocus
                />
                <Input
                  label="Password"
                  type="password"
                  value={loginForm.password}
                  onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                  required
                />
                <Button
                  type="submit"
                  variant="primary"
                  size="lg"
                  className="w-full"
                  disabled={isAuthLoading}
                >
                  {isAuthLoading ? 'Logging in...' : 'Log In'}
                </Button>
                <button
                  type="button"
                  className="w-full text-sm text-gray-600 hover:text-gray-900"
                  onClick={() => {
                    setAuthMode(AUTH_MODES.CHOOSE);
                    setAuthError('');
                  }}
                >
                  ← Back
                </button>
              </form>
            )}

            {/* Register form */}
            {authMode === AUTH_MODES.REGISTER && (
              <form onSubmit={handleRegister} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <Input
                    label="First Name"
                    value={registerForm.first_name}
                    onChange={(e) => setRegisterForm({ ...registerForm, first_name: e.target.value })}
                    required
                    autoFocus
                  />
                  <Input
                    label="Last Name"
                    value={registerForm.last_name}
                    onChange={(e) => setRegisterForm({ ...registerForm, last_name: e.target.value })}
                    required
                  />
                </div>
                <Input
                  label="Email"
                  type="email"
                  value={registerForm.email}
                  onChange={(e) => setRegisterForm({ ...registerForm, email: e.target.value })}
                  required
                />
                <Input
                  label="Password"
                  type="password"
                  value={registerForm.password}
                  onChange={(e) => setRegisterForm({ ...registerForm, password: e.target.value })}
                  required
                  placeholder="At least 8 characters"
                />
                <Input
                  label="Confirm Password"
                  type="password"
                  value={registerForm.confirmPassword}
                  onChange={(e) => setRegisterForm({ ...registerForm, confirmPassword: e.target.value })}
                  required
                />
                <Button
                  type="submit"
                  variant="primary"
                  size="lg"
                  className="w-full"
                  disabled={isAuthLoading}
                >
                  {isAuthLoading ? 'Creating account...' : 'Create Account & Continue'}
                </Button>
                <button
                  type="button"
                  className="w-full text-sm text-gray-600 hover:text-gray-900"
                  onClick={() => {
                    setAuthMode(AUTH_MODES.CHOOSE);
                    setAuthError('');
                  }}
                >
                  ← Back
                </button>
              </form>
            )}
          </div>
        </Card>
      </div>
    );
  }

  // Intro state (user is authenticated)
  if (state === STATES.INTRO && config) {
    const hasInProgress = config.has_in_progress_session;

    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="max-w-lg w-full">
          <div className="p-6 text-center">
            <h1 className="text-2xl font-semibold text-gray-900 mb-2">
              {config.title || 'SAT Practice Assessment'}
            </h1>
            <p className="text-gray-600 mb-2">
              Prepared by {config.tutor_name}
            </p>

            {/* Show logged in user */}
            {user && (
              <p className="text-sm text-green-600 mb-6">
                Logged in as {user.first_name} {user.last_name}
              </p>
            )}

            {/* Resume session notice */}
            {hasInProgress && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6 text-left">
                <h3 className="font-medium text-amber-900 mb-2">Resume Your Session</h3>
                <p className="text-sm text-amber-800">
                  You have an in-progress session with {config.questions_answered} of {config.question_count} questions answered.
                  Click continue to pick up where you left off.
                </p>
              </div>
            )}

            <div className="bg-gray-50 rounded-lg p-4 mb-6 text-left">
              <h3 className="font-medium text-gray-900 mb-3">Assessment Details</h3>
              <ul className="space-y-2 text-sm text-gray-600">
                <li><strong>Questions:</strong> {config.question_count}</li>
                <li><strong>Subject:</strong> {config.subject_area === 'math' ? 'Math' : config.subject_area === 'reading_writing' ? 'Reading & Writing' : 'Math & Reading/Writing'}</li>
                <li><strong>Time Limit:</strong> {config.time_limit_minutes ? `${config.time_limit_minutes} minutes` : 'No limit'}</li>
              </ul>
            </div>

            {!hasInProgress && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 text-left text-sm text-blue-800">
                <strong>Before you begin:</strong>
                <ul className="mt-2 space-y-1 list-disc list-inside">
                  <li>Find a quiet place without distractions</li>
                  <li>Have scratch paper ready for calculations</li>
                  <li>Answer every question - there's no penalty for guessing</li>
                </ul>
              </div>
            )}

            <Button variant="primary" size="lg" onClick={handleStart} className="w-full">
              {hasInProgress ? 'Continue Assessment' : 'Start Assessment'}
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  // Submitting state
  if (state === STATES.SUBMITTING) {
    return (
      <div className="flex items-center justify-center h-screen bg-white">
        <div className="text-center">
          <LoadingSpinner size="lg" />
          <p className="mt-4 text-gray-600">Submitting your assessment...</p>
        </div>
      </div>
    );
  }

  // Completed state
  if (state === STATES.COMPLETED && results) {
    const passed = results.score_percentage >= 70;
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="max-w-lg w-full text-center">
          <div className="p-8">
            <CheckCircle className={`h-16 w-16 mx-auto mb-4 ${passed ? 'text-green-500' : 'text-amber-500'}`} />
            <h1 className="text-2xl font-semibold text-gray-900 mb-2">Assessment Complete</h1>
            <p className="text-gray-600 mb-6">Thank you for completing the assessment</p>

            <div className="bg-gray-50 rounded-lg p-6 mb-6">
              <p className="text-4xl font-bold text-gray-900 mb-2">
                {results.score_percentage.toFixed(0)}%
              </p>
              <p className="text-gray-600">
                {results.questions_correct} out of {results.total_questions} correct
              </p>
              <p className="text-sm text-gray-500 mt-2">
                Time: {Math.floor(results.time_spent_seconds / 60)} minutes
              </p>
            </div>

            <Button
              variant="primary"
              size="lg"
              className="w-full mb-4"
              onClick={() => window.location.href = `/assess/${token}/results`}
            >
              View Detailed Results
            </Button>

            <p className="text-sm text-gray-500">
              Your tutor will review your results and may reach out to you.
            </p>
          </div>
        </Card>
      </div>
    );
  }

  // In Progress state - SAT-Realistic Interface
  if (state === STATES.IN_PROGRESS && questions.length > 0) {
    const questionId = currentQuestion?.id;
    const currentAnswer = answers[questionId];
    const isCurrentMarked = markedForReview.has(questionId);
    const answeredCount = Object.keys(answers).length;
    const currentChecked = checkedAnswers[questionId];
    const isAnswered = currentAnswer !== undefined;

    // Question panel content
    const questionPanel = (
      <div className="h-full flex flex-col bg-white pb-16">
        <div className="flex-1 overflow-auto">
          <QuestionDisplay
            questionNumber={currentIndex + 1}
            questionHtml={currentQuestion?.prompt_html || ''}
            isMarked={isCurrentMarked}
            onToggleMark={handleToggleMark}
            onReport={() => console.log('Report question')}
          />

          {/* Answer choices */}
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

            {/* Check Answer / Show Explanation buttons */}
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
              {currentChecked && currentChecked.explanation && (
                <Button
                  variant="secondary"
                  onClick={() => setShowExplanation(!showExplanation)}
                  className="text-sm"
                >
                  {showExplanation ? 'Hide Explanation' : 'Show Explanation'}
                </Button>
              )}
              {currentChecked && !currentChecked.isCorrect && currentQuestion?.answer_type === 'SPR' && (
                <span className="text-sm text-gray-600">
                  {currentChecked.correctAnswers?.length > 0 && currentChecked.correctAnswers[0] !== '*'
                    ? `Correct answer: ${currentChecked.correctAnswers.join(' or ')}`
                    : 'See explanation for correct answer'}
                </span>
              )}
            </div>

            {/* Explanation display */}
            {showExplanation && currentChecked?.explanation && (
              <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <h4 className="text-sm font-medium text-blue-900 mb-2">Explanation</h4>
                <div
                  className="prose prose-sm prose-blue max-w-none text-blue-800 question-content"
                  dangerouslySetInnerHTML={{ __html: currentChecked.explanation }}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    );

    // Passage panel content
    const passagePanel = hasPassage ? (
      <div className="h-full overflow-auto p-6 pb-20 bg-white">
        <div
          className="prose prose-gray max-w-none"
          dangerouslySetInnerHTML={{ __html: currentQuestion.passage_html }}
        />
      </div>
    ) : null;

    // Bottom navigation bar
    const bottomNavBar = (
      <>
        {/* Collapsible Question Navigator */}
        {showNav && (
          <div className="fixed bottom-16 left-0 right-0 z-40 bg-white shadow-lg border-t border-gray-200">
            <QuestionNav
              totalQuestions={questions.length}
              currentIndex={currentIndex}
              answers={answers}
              markedForReview={markedForReview}
              questions={questions}
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

    return (
      <div className="h-screen flex flex-col bg-white">
        {/* Header */}
        <TestHeader
          currentQuestion={currentIndex + 1}
          totalQuestions={questions.length}
          timeRemaining={timeLimit ? timeRemaining : null}
          formattedTime={timeLimit ? formattedTime : null}
          isPaused={isPaused}
          onPause={pauseTimer}
          onResume={resumeTimer}
          onCalculatorToggle={() => setShowCalculator(!showCalculator)}
          showCalculator={showCalculator}
          subjectArea={config?.subject_area || 'math'}
        />

        {/* Main content */}
        <div className={`flex-1 overflow-hidden transition-all duration-300 ${showCalculator ? 'mr-[440px]' : ''}`}>
          {hasPassage ? (
            <SplitPane
              left={passagePanel}
              right={questionPanel}
              defaultSplit={50}
              minLeft={25}
              minRight={35}
            />
          ) : (
            <div className="h-full max-w-3xl mx-auto">
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

        {/* Submit Confirmation Modal */}
        <SubmitConfirmation
          isOpen={showSubmitModal}
          onClose={() => setShowSubmitModal(false)}
          onConfirm={handleSubmit}
          totalQuestions={questions.length}
          answeredCount={answeredCount}
          markedCount={markedForReview.size}
          isSubmitting={false}
        />

        {/* Fixed bottom navigation bar */}
        {bottomNavBar}

        {/* Paused overlay */}
        {isPaused && timeLimit && (
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
  }

  return null;
};

export default AssessmentPage;
