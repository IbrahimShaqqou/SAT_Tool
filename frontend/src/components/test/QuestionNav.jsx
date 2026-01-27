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
      if (checked?.isCorrect === true) return 'bg-green-100 text-green-700 ring-2 ring-gray-900 shadow-sm';
      if (checked?.isCorrect === false) return 'bg-red-100 text-red-700 ring-2 ring-gray-900 shadow-sm';
      if (isMarked) return 'bg-orange-100 text-orange-700 ring-2 ring-gray-900 shadow-sm';
      if (isAnswered) return 'bg-yellow-100 text-yellow-700 ring-2 ring-gray-900 shadow-sm';
      return 'bg-white text-gray-700 ring-2 ring-gray-900 shadow-sm';
    }

    // Checked answers
    if (checked?.isCorrect === true) {
      return 'bg-green-100 text-green-700 border-green-300 hover:bg-green-200';
    }
    if (checked?.isCorrect === false) {
      return 'bg-red-100 text-red-700 border-red-300 hover:bg-red-200';
    }

    // Marked for review
    if (isMarked) {
      return 'bg-orange-100 text-orange-700 border-orange-300 hover:bg-orange-200';
    }

    // Answered but not checked
    if (isAnswered) {
      return 'bg-yellow-100 text-yellow-700 border-yellow-300 hover:bg-yellow-200';
    }

    // Not answered
    return 'bg-gray-50 text-gray-600 border-gray-300 hover:bg-gray-100';
  };

  const getStatusIcon = (index) => {
    const questionId = questions[index]?.id ?? index;
    const checked = checkedAnswers[questionId];

    if (checked?.isCorrect === true) {
      return <Check className="w-3.5 h-3.5 text-green-600 absolute -top-1 -right-1 bg-white rounded-full" />;
    }
    if (checked?.isCorrect === false) {
      return <X className="w-3.5 h-3.5 text-red-600 absolute -top-1 -right-1 bg-white rounded-full" />;
    }
    return null;
  };

  return (
    <div className="p-4 bg-white">
      {/* Legend - compact row */}
      <div className="flex flex-wrap items-center justify-center gap-4 mb-3 text-xs text-gray-600">
        <div className="flex items-center gap-1.5">
          <Flag className="w-3.5 h-3.5 text-orange-500" />
          <span>Review</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3.5 h-3.5 rounded bg-green-100 border border-green-300" />
          <span>Correct</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3.5 h-3.5 rounded bg-red-100 border border-red-300" />
          <span>Incorrect</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3.5 h-3.5 rounded bg-yellow-100 border border-yellow-300" />
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
