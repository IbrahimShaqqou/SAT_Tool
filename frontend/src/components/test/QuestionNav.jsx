/**
 * Question Navigator Component
 * Compact, scrollable grid of numbered buttons with color-coded status
 * - Gray: Not answered
 * - Green: Correct
 * - Red: Incorrect
 * - Yellow: Answered (not checked)
 * - Orange: Marked for review
 */
import { Check, X, Flag } from 'lucide-react';

const QuestionNav = ({
  totalQuestions,
  currentIndex,
  answers,
  markedForReview,
  onNavigate,
  questions = [], // Array of question objects with id property
  checkedAnswers = {}, // { questionId: { isCorrect: boolean } }
}) => {
  const getButtonStyle = (index) => {
    // Use actual question ID if available, otherwise fall back to index
    const questionId = questions[index]?.id ?? index;
    const isAnswered = answers[questionId] !== undefined;
    const isMarked = markedForReview.has(questionId);
    const isCurrent = currentIndex === index;
    const checked = checkedAnswers[questionId];

    // Current question - dark outline
    if (isCurrent) {
      if (checked?.isCorrect === true) return 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 ring-2 ring-gray-900 dark:ring-gray-100 shadow-sm';
      if (checked?.isCorrect === false) return 'bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300 ring-2 ring-gray-900 dark:ring-gray-100 shadow-sm';
      if (isMarked) return 'bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300 ring-2 ring-gray-900 dark:ring-gray-100 shadow-sm';
      if (isAnswered) return 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 ring-2 ring-gray-900 dark:ring-gray-100 shadow-sm';
      return 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 ring-2 ring-gray-900 dark:ring-gray-100 shadow-sm';
    }

    // Checked answers
    if (checked?.isCorrect === true) {
      return 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700 hover:bg-emerald-200 dark:hover:bg-emerald-900/50';
    }
    if (checked?.isCorrect === false) {
      return 'bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300 border-rose-300 dark:border-rose-700 hover:bg-rose-200 dark:hover:bg-rose-900/50';
    }

    // Marked for review
    if (isMarked) {
      return 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 border-orange-300 dark:border-orange-700 hover:bg-orange-200 dark:hover:bg-orange-900/50';
    }

    // Answered but not checked
    if (isAnswered) {
      return 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-700 hover:bg-amber-200 dark:hover:bg-amber-900/50';
    }

    // Not answered
    return 'bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-600';
  };

  const getStatusIcon = (index) => {
    const questionId = questions[index]?.id ?? index;
    const checked = checkedAnswers[questionId];

    if (checked?.isCorrect === true) {
      return <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 absolute -top-1 -right-1 bg-white dark:bg-gray-800 rounded-full" />;
    }
    if (checked?.isCorrect === false) {
      return <X className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400 absolute -top-1 -right-1 bg-white dark:bg-gray-800 rounded-full" />;
    }
    return null;
  };

  return (
    <div className="p-4 bg-white dark:bg-gray-800">
      {/* Legend - compact row */}
      <div className="flex flex-wrap items-center justify-center gap-4 mb-3 text-xs text-gray-600 dark:text-gray-400">
        <div className="flex items-center gap-1.5">
          <Flag className="w-3.5 h-3.5 text-orange-500 dark:text-orange-400" />
          <span>Review</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3.5 h-3.5 rounded bg-emerald-100 dark:bg-emerald-900/30 border border-emerald-300 dark:border-emerald-700" />
          <span>Correct</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3.5 h-3.5 rounded bg-rose-100 dark:bg-rose-900/30 border border-rose-300 dark:border-rose-700" />
          <span>Incorrect</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3.5 h-3.5 rounded bg-amber-100 dark:bg-amber-900/30 border border-amber-300 dark:border-amber-700" />
          <span>Answered</span>
        </div>
      </div>

      {/* Scrollable grid - fixed 10 columns, centered */}
      <div className="max-h-[40vh] overflow-y-auto overflow-x-hidden px-4 py-1">
        <div className="grid grid-cols-10 gap-2 mx-auto" style={{ maxWidth: '440px' }}>
          {Array.from({ length: totalQuestions }, (_, i) => (
            <button
              key={i}
              onClick={() => onNavigate(i)}
              className={`
                relative w-10 h-10 rounded-lg border text-sm font-semibold
                transition-all duration-150 focus:outline-none
                ${getButtonStyle(i)}
              `}
            >
              {i + 1}
              {getStatusIcon(i)}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default QuestionNav;
