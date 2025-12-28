/**
 * Question Navigator Component
 * Grid of numbered buttons with color-coded status
 * - Gray: Not visited
 * - Black/filled: Current
 * - Green: Answered
 * - Orange: Marked for review
 * - Orange+check: Marked + Answered
 */

const QuestionNav = ({
  totalQuestions,
  currentIndex,
  answers,
  markedForReview,
  onNavigate,
  questions = [], // Array of question objects with id property
}) => {
  const getButtonStyle = (index) => {
    // Use actual question ID if available, otherwise fall back to index
    const questionId = questions[index]?.id ?? index;
    const isAnswered = answers[questionId] !== undefined;
    const isMarked = markedForReview.has(questionId);
    const isCurrent = currentIndex === index;

    if (isCurrent) {
      return 'bg-gray-900 text-white border-gray-900';
    }

    if (isMarked && isAnswered) {
      return 'bg-orange-500 text-white border-orange-500';
    }

    if (isMarked) {
      return 'bg-orange-100 text-orange-700 border-orange-300';
    }

    if (isAnswered) {
      return 'bg-green-100 text-green-700 border-green-300';
    }

    return 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50';
  };

  return (
    <div className="p-4 bg-gray-50 border-t border-gray-200">
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">
        Question Navigator
      </p>
      <div className="grid grid-cols-5 gap-2">
        {Array.from({ length: totalQuestions }, (_, i) => (
          <button
            key={i}
            onClick={() => onNavigate(i)}
            className={`
              w-10 h-10 rounded-lg border text-sm font-medium
              transition-colors focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-1
              ${getButtonStyle(i)}
            `}
          >
            {i + 1}
          </button>
        ))}
      </div>

      {/* Legend */}
      <div className="mt-4 flex flex-wrap gap-4 text-xs text-gray-500">
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-white border border-gray-300" />
          <span>Not answered</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-green-100 border border-green-300" />
          <span>Answered</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-orange-100 border border-orange-300" />
          <span>Marked</span>
        </div>
      </div>
    </div>
  );
};

export default QuestionNav;
