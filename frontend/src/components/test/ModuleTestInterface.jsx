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
} from './';
import { useTimer } from '../../hooks';

const ModuleTestInterface = ({ module, moduleNumber, totalModules, onReadyToSubmit }) => {
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

  // Refs
  const scrollContainerRef = useRef(null);
  const submitRef = useRef(null);

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
  }, [module.test_session_id]);

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
    if (minutes <= 1) return 'text-red-600';
    if (minutes <= 5) return 'text-orange-500';
    return 'text-gray-900';
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  const currentQuestion = questions[currentIndex];
  const hasPassage = currentQuestion?.passage_html;
  const isMath = module.subject_area === 'MATH';

  return (
    <div className="h-screen flex flex-col bg-white">
      {/* Top Header */}
      <div className="border-b border-gray-200 bg-white px-6 py-4 flex items-center justify-between">
        <div className="flex items-center space-x-6">
          {/* Module info */}
          <div className="text-sm text-gray-600">
            Module {moduleNumber}: {module.title}
          </div>

          {/* Question counter */}
          <div className="text-sm font-medium text-gray-900">
            Question {currentIndex + 1} of {questions.length}
          </div>
        </div>

        <div className="flex items-center space-x-6">
          {/* Tools */}
          {isMath && (
            <>
              <button
                onClick={() => setShowCalculator(!showCalculator)}
                className="text-sm font-medium text-[#0077C8] hover:text-[#005fa3]"
              >
                Calculator
              </button>
              <button
                onClick={() => setShowReferenceSheet(!showReferenceSheet)}
                className="text-sm font-medium text-[#0077C8] hover:text-[#005fa3]"
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
            className="p-2 hover:bg-gray-100 rounded"
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
          className="flex-1 overflow-y-auto p-8"
        >
          {hasPassage ? (
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
          )}
        </div>

        {/* Calculator Panel */}
        {showCalculator && isMath && (
          <div className="w-96 border-l border-gray-200 bg-white">
            <DesmosCalculator onClose={() => setShowCalculator(false)} />
          </div>
        )}
      </div>

      {/* Bottom Navigation */}
      <div className="border-t border-gray-200 bg-white px-6 py-4 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button
            onClick={handlePrev}
            disabled={currentIndex === 0}
            className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            ← Back
          </button>

          <button
            onClick={toggleMarkForReview}
            className={`px-4 py-2 border rounded flex items-center space-x-2 ${
              markedForReview.has(currentIndex)
                ? 'bg-amber-50 border-amber-400 text-amber-700'
                : 'border-gray-300 hover:bg-gray-50'
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
              className="px-6 py-2 bg-[#0077C8] text-white font-semibold rounded hover:bg-[#005fa3]"
            >
              Review & Submit
            </button>
          ) : (
            <button
              onClick={handleNext}
              className="px-6 py-2 bg-[#0077C8] text-white rounded hover:bg-[#005fa3]"
            >
              Next →
            </button>
          )}
        </div>
      </div>

      {/* Modals */}
      {showReferenceSheet && (
        <ReferenceSheet onClose={() => setShowReferenceSheet(false)} />
      )}
    </div>
  );
};

export { ModuleTestInterface };
