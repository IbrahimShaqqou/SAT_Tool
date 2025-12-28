/**
 * Test Header Component
 * Timer, question count, subject indicator
 */
import { Clock, Calculator, Pause, Play } from 'lucide-react';

const TestHeader = ({
  currentQuestion,
  totalQuestions,
  timeRemaining,
  formattedTime,
  isPaused,
  onPause,
  onResume,
  onCalculatorToggle,
  showCalculator,
  subjectArea,
}) => {
  return (
    <header className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-6">
      {/* Left: Subject */}
      <div className="flex items-center gap-4">
        <span className="text-sm font-medium text-gray-600 uppercase tracking-wide">
          {subjectArea === 'math' ? 'Math' : 'Reading & Writing'}
        </span>
      </div>

      {/* Center: Question count */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-gray-500">Question</span>
        <span className="font-semibold text-gray-900">
          {currentQuestion} of {totalQuestions}
        </span>
      </div>

      {/* Right: Timer and controls */}
      <div className="flex items-center gap-4">
        {/* Calculator toggle (only for math) */}
        {subjectArea === 'math' && (
          <button
            onClick={onCalculatorToggle}
            className={`p-2 rounded-lg transition-colors ${
              showCalculator
                ? 'bg-gray-900 text-white'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
            title="Calculator"
          >
            <Calculator className="h-5 w-5" />
          </button>
        )}

        {/* Timer */}
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-gray-400" />
          <span
            className={`font-mono text-lg font-medium ${
              timeRemaining < 300 ? 'text-red-600' : 'text-gray-900'
            }`}
          >
            {formattedTime}
          </span>
        </div>

        {/* Pause/Resume */}
        <button
          onClick={isPaused ? onResume : onPause}
          className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          title={isPaused ? 'Resume' : 'Pause'}
        >
          {isPaused ? (
            <Play className="h-5 w-5" />
          ) : (
            <Pause className="h-5 w-5" />
          )}
        </button>
      </div>
    </header>
  );
};

export default TestHeader;
