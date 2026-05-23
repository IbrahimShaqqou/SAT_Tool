/**
 * Practice Test Taking Page - Main test interface with timer and questions
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { startPracticeTest, getCurrentModule, submitModule } from '../../services/practiceTestApi';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const PracticeTestTakingPage = () => {
  const { testNumber } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sessionId, setSessionId] = useState(null);
  const [moduleData, setModuleData] = useState(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [responses, setResponses] = useState({});
  const [flaggedQuestions, setFlaggedQuestions] = useState(new Set());
  const [timeRemaining, setTimeRemaining] = useState(null);
  const [startTime, setStartTime] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showExitModal, setShowExitModal] = useState(false);

  // Initialize test session
  useEffect(() => {
    initializeTest();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [testNumber]);

  const initializeTest = async () => {
    try {
      setLoading(true);

      // The URL param is either a test number (initial start) or a session UUID
      // (returning from a break to take the next module).
      let activeSessionId;
      if (UUID_REGEX.test(testNumber)) {
        activeSessionId = testNumber;
      } else {
        const startResponse = await startPracticeTest(testNumber);
        activeSessionId = startResponse.session_id;
      }
      setSessionId(activeSessionId);

      // Load current module (first module on initial start, or next module after break)
      const moduleResponse = await getCurrentModule(activeSessionId);
      setModuleData(moduleResponse);
      setTimeRemaining(moduleResponse.time_limit_minutes * 60); // Convert to seconds
      setStartTime(Date.now());
      // Reset per-module state when re-entering after a break
      setResponses({});
      setFlaggedQuestions(new Set());
      setCurrentQuestionIndex(0);
      setError(null);
    } catch (err) {
      console.error('Error initializing test:', err);
      setError('Failed to load test module');
    } finally {
      setLoading(false);
    }
  };

  // Timer countdown
  useEffect(() => {
    if (!timeRemaining || timeRemaining <= 0 || isSubmitting) return;

    const timer = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          handleAutoSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [timeRemaining, isSubmitting]);

  const handleAutoSubmit = async () => {
    if (isSubmitting) return;
    alert('Time is up! Your module will be submitted automatically.');
    await handleSubmitModule();
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleSelectAnswer = (questionId, answer) => {
    setResponses((prev) => ({
      ...prev,
      [questionId]: answer
    }));
  };

  const toggleFlag = (questionId) => {
    setFlaggedQuestions((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(questionId)) {
        newSet.delete(questionId);
      } else {
        newSet.add(questionId);
      }
      return newSet;
    });
  };

  const handleSubmitModule = async () => {
    if (isSubmitting) return;

    const unansweredCount = moduleData.questions.length - Object.keys(responses).length;
    if (unansweredCount > 0) {
      const confirmed = window.confirm(
        `You have ${unansweredCount} unanswered question${unansweredCount > 1 ? 's' : ''}. ` +
        'Are you sure you want to submit this module?'
      );
      if (!confirmed) return;
    }

    try {
      setIsSubmitting(true);

      // Calculate time spent
      const timeSpentSeconds = Math.floor((Date.now() - startTime) / 1000);

      // Format responses
      const formattedResponses = moduleData.questions.map((q) => ({
        question_id: q.question_id,
        selected_answer: responses[q.question_id] || null
      }));

      const result = await submitModule(sessionId, formattedResponses, timeSpentSeconds);

      // Navigate based on result
      if (result.is_complete) {
        // Test complete - go to results
        navigate(`/student/practice-tests/results/${sessionId}`);
      } else {
        // Go to break screen before next module
        navigate(`/student/practice-tests/break/${sessionId}`, {
          state: {
            currentModule: result.module_submitted,
            nextModule: result.next_module,
            modulePath: result.module_2_path,
            message: result.message
          }
        });
      }
    } catch (err) {
      console.error('Error submitting module:', err);
      alert('Failed to submit module. Please try again.');
      setIsSubmitting(false);
    }
  };

  const handleExitTest = () => {
    setShowExitModal(true);
  };

  const confirmExit = () => {
    navigate('/student/practice-tests');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading test module...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-700">{error}</p>
          <button
            onClick={() => navigate('/student/practice-tests')}
            className="mt-2 text-red-600 hover:text-red-800 underline"
          >
            Back to Practice Tests
          </button>
        </div>
      </div>
    );
  }

  if (!moduleData) return null;

  const currentQuestion = moduleData.questions[currentQuestionIndex];
  const progress = ((currentQuestionIndex + 1) / moduleData.questions.length) * 100;
  const timeWarning = timeRemaining <= 300; // 5 minutes remaining

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <h1 className="text-lg font-semibold text-gray-900">
              {moduleData.subject_area === 'reading_writing' ? 'Reading and Writing' : 'Math'} Module {moduleData.module_number}
            </h1>
            <span className="text-sm text-gray-500">
              Question {currentQuestionIndex + 1} of {moduleData.questions.length}
            </span>
          </div>

          <div className="flex items-center space-x-4">
            {/* Timer */}
            <div className={`font-mono text-lg font-semibold px-4 py-2 rounded ${
              timeWarning ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-700'
            }`}>
              {formatTime(timeRemaining)}
            </div>

            <button
              onClick={handleExitTest}
              className="text-gray-600 hover:text-gray-900 text-sm font-medium"
            >
              Exit Test
            </button>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-gray-200 h-1">
          <div
            className="bg-blue-600 h-1 transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
          {/* Question Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-2">
              <span className="font-semibold text-gray-700">Question {currentQuestion.question_number}</span>
              <span className="text-sm text-gray-500">({currentQuestion.skill_name})</span>
            </div>
            <button
              onClick={() => toggleFlag(currentQuestion.question_id)}
              className={`flex items-center space-x-1 text-sm font-medium ${
                flaggedQuestions.has(currentQuestion.question_id)
                  ? 'text-yellow-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <svg className="w-5 h-5" fill={flaggedQuestions.has(currentQuestion.question_id) ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" />
              </svg>
              <span>Flag</span>
            </button>
          </div>

          {/* Question Prompt (includes stimulus passage if any) */}
          <div
            className="prose max-w-none mb-6"
            dangerouslySetInnerHTML={{ __html: currentQuestion.prompt_html }}
          />

          {/* Answer Choices (MCQ) or Free Response (SPR) */}
          {currentQuestion.answer_type === 'MCQ' ? (
            <div className="space-y-3">
              {(currentQuestion.choices || []).map((choiceHtml, idx) => {
                const letter = String.fromCharCode(65 + idx); // A, B, C, D
                const isSelected = responses[currentQuestion.question_id] === idx;
                return (
                  <button
                    key={idx}
                    onClick={() => handleSelectAnswer(currentQuestion.question_id, idx)}
                    className={`w-full text-left p-4 rounded-lg border-2 transition-colors ${
                      isSelected
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300 bg-white'
                    }`}
                  >
                    <div className="flex items-start">
                      <span className="font-semibold mr-3 text-gray-700">{letter}.</span>
                      <span
                        className="text-gray-900 prose max-w-none"
                        dangerouslySetInnerHTML={{ __html: choiceHtml }}
                      />
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Your answer
              </label>
              <input
                type="text"
                value={responses[currentQuestion.question_id] || ''}
                onChange={(e) => handleSelectAnswer(currentQuestion.question_id, e.target.value)}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:outline-none"
                placeholder="Enter your answer"
              />
            </div>
          )}
        </div>

        {/* Navigation */}
        <div className="mt-6 flex items-center justify-between">
          <button
            onClick={() => setCurrentQuestionIndex((prev) => Math.max(0, prev - 1))}
            disabled={currentQuestionIndex === 0}
            className="px-6 py-2 rounded-lg font-medium border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            ← Previous
          </button>

          {currentQuestionIndex === moduleData.questions.length - 1 ? (
            <button
              onClick={handleSubmitModule}
              disabled={isSubmitting}
              className="px-8 py-2 rounded-lg font-medium bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
            >
              {isSubmitting ? 'Submitting...' : 'Submit Module'}
            </button>
          ) : (
            <button
              onClick={() => setCurrentQuestionIndex((prev) => Math.min(moduleData.questions.length - 1, prev + 1))}
              className="px-6 py-2 rounded-lg font-medium bg-blue-600 text-white hover:bg-blue-700"
            >
              Next →
            </button>
          )}
        </div>

        {/* Question Navigator */}
        <div className="mt-6 bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Question Navigator</h3>
          <div className="grid grid-cols-10 gap-2">
            {moduleData.questions.map((q, idx) => (
              <button
                key={q.question_id}
                onClick={() => setCurrentQuestionIndex(idx)}
                className={`w-10 h-10 rounded text-sm font-medium transition-colors ${
                  idx === currentQuestionIndex
                    ? 'bg-blue-600 text-white'
                    : responses[q.question_id] !== undefined && responses[q.question_id] !== null && responses[q.question_id] !== ''
                    ? 'bg-green-100 text-green-800 border border-green-300'
                    : flaggedQuestions.has(q.question_id)
                    ? 'bg-yellow-100 text-yellow-800 border border-yellow-300'
                    : 'bg-gray-100 text-gray-600 border border-gray-300 hover:bg-gray-200'
                }`}
              >
                {idx + 1}
              </button>
            ))}
          </div>
          <div className="mt-3 flex items-center justify-between text-xs text-gray-600">
            <span>Answered: {Object.keys(responses).length}</span>
            <span>Flagged: {flaggedQuestions.size}</span>
            <span>Unanswered: {moduleData.questions.length - Object.keys(responses).length}</span>
          </div>
        </div>
      </div>

      {/* Exit Confirmation Modal */}
      {showExitModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-bold text-gray-900 mb-2">Exit Practice Test?</h3>
            <p className="text-gray-700 mb-4">
              Your progress will be lost if you exit now. Are you sure you want to leave this test?
            </p>
            <div className="flex space-x-3">
              <button
                onClick={() => setShowExitModal(false)}
                className="flex-1 px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={confirmExit}
                className="flex-1 px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700"
              >
                Exit Test
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PracticeTestTakingPage;
