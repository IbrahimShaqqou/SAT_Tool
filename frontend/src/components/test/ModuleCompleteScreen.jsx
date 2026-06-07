/**
 * Module Complete Screen
 * Review questions before final submit
 * Warning: cannot return after submitting
 */
import { useState, useEffect } from 'react';
import { practiceService } from '../../services';
import { LoadingSpinner } from '../ui';

const ModuleCompleteScreen = ({ module, moduleNumber, onSubmit, onBack }) => {
  // eslint-disable-next-line no-unused-vars
  const [questions, setQuestions] = useState([]);
  // eslint-disable-next-line no-unused-vars
  const [answers, setAnswers] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const fetchQuestions = async () => {
      try {
        const response = await practiceService.getModuleQuestions(module.id);
        setQuestions(response.data.questions || []);
        // TODO: Fetch saved answers from responses
        setIsLoading(false);
      } catch (err) {
        console.error('Error fetching questions:', err);
        setIsLoading(false);
      }
    };

    fetchQuestions();
  }, [module.id]);

  const handleSubmit = async () => {
    setIsSubmitting(true);
    await onSubmit(false);
  };

  const answeredCount = module.questions_answered || 0;
  const unansweredCount = module.total_questions - answeredCount;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-surface-page">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-surface-page">
      <div className="max-w-3xl w-full px-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-ink-body mb-4">
            Module {moduleNumber} Complete
          </h1>
          <p className="text-lg text-ink-muted">
            Review your answers before submitting
          </p>
        </div>

        {/* Summary card */}
        <div className="bg-surface-muted rounded-lg p-8 mb-8">
          <div className="grid grid-cols-2 gap-8 text-center mb-6">
            <div>
              <div className="text-4xl font-bold text-emerald-600 mb-2">
                {answeredCount}
              </div>
              <div className="text-sm text-ink-muted uppercase tracking-wide">
                Answered
              </div>
            </div>
            <div>
              <div className="text-4xl font-bold text-amber-500 mb-2">
                {unansweredCount}
              </div>
              <div className="text-sm text-ink-muted uppercase tracking-wide">
                Unanswered
              </div>
            </div>
          </div>

          {/* Flagged questions */}
          {module.flagged_question_indices?.length > 0 && (
            <div className="border-t border-edge pt-4">
              <div className="flex items-center justify-center text-amber-600">
                <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M3 6a3 3 0 013-3h10a1 1 0 01.8 1.6L14.25 8l2.55 3.4A1 1 0 0116 13H6a1 1 0 00-1 1v3a1 1 0 11-2 0V6z" />
                </svg>
                <span className="text-sm font-medium">
                  {module.flagged_question_indices.length} question{module.flagged_question_indices.length !== 1 ? 's' : ''} marked for review
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Warning box */}
        <div className="bg-rose-50 dark:bg-rose-900/20 border-2 border-rose-200 dark:border-rose-800 rounded-lg p-6 mb-8">
          <div className="flex items-start">
            <svg className="w-6 h-6 text-rose-600 dark:text-rose-400 mr-3 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <div>
              <h3 className="text-lg font-bold text-rose-900 dark:text-rose-200 mb-2">
                Important: Cannot Return After Submitting
              </h3>
              <p className="text-sm text-rose-800 dark:text-rose-300">
                Once you submit this module, you will not be able to return to it or change your answers.
                Make sure you have reviewed all questions before proceeding.
              </p>
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex justify-between items-center">
          <button
            onClick={onBack}
            disabled={isSubmitting}
            className="px-8 py-3 border-2 border-edge text-ink-muted font-semibold rounded-lg hover:bg-surface-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Back to Questions
          </button>

          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="px-12 py-3 bg-brand-600 text-white font-semibold rounded-lg hover:bg-brand-700 transition-colors shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Submitting...' : 'Submit Module'}
          </button>
        </div>

        {/* Helper text */}
        {unansweredCount > 0 && (
          <p className="text-center mt-6 text-sm text-ink-subtle">
            You have {unansweredCount} unanswered question{unansweredCount !== 1 ? 's' : ''}. You can still submit if you wish.
          </p>
        )}
      </div>
    </div>
  );
};

export { ModuleCompleteScreen };
