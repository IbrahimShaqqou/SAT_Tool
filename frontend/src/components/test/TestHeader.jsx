/**
 * Test Header Component
 * Timer, question count, subject indicator, reference sheet, calculator
 */
import { Clock, Calculator, Pause, Play, FileText } from 'lucide-react';

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
  onReferenceToggle,
  showReference,
  subjectArea,
  hasTimeLimit = true,
}) => {
  return (
    <header className="sticky top-0 z-30 h-14 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between px-6">
      {/* Left: Subject */}
      <div className="flex items-center gap-4">
        <span className="text-sm font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide">
          {subjectArea === 'math' ? 'Math' : 'Reading & Writing'}
        </span>
      </div>

      {/* Center: Question count */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-gray-500 dark:text-gray-400">Question</span>
        <span className="font-semibold text-gray-900 dark:text-gray-100">
          {currentQuestion} of {totalQuestions}
        </span>
      </div>

      {/* Right: Timer and controls */}
      <div className="flex items-center gap-2">
        {/* Reference Sheet toggle (only for math) */}
        {subjectArea === 'math' && onReferenceToggle && (
          <button
            onClick={onReferenceToggle}
            className={`p-2 rounded-lg transition-colors ${
              showReference
                ? 'bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900'
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
            title="Reference Sheet"
          >
            <FileText className="h-5 w-5" />
          </button>
        )}

        {/* Calculator toggle (only for math) */}
        {subjectArea === 'math' && (
          <button
            onClick={onCalculatorToggle}
            className={`p-2 rounded-lg transition-colors ${
              showCalculator
                ? 'bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900'
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
            title="Calculator"
          >
            <Calculator className="h-5 w-5" />
          </button>
        )}

        {/* Timer - only shown when tutor sets a time limit */}
        {hasTimeLimit && (
          <>
            <div className={`flex items-center gap-2 ml-2 px-3 py-1 rounded-lg transition-all ${
              timeRemaining <= 0
                ? 'bg-rose-600 text-white animate-pulse'
                : timeRemaining < 60
                ? 'bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300'
                : timeRemaining < 300
                ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300'
                : ''
            }`}>
              <Clock className={`h-4 w-4 ${
                timeRemaining <= 0 ? 'text-white' :
                timeRemaining < 300 ? 'text-current' : 'text-gray-400 dark:text-gray-500'
              }`} />
              <span className={`font-mono text-lg font-medium ${
                timeRemaining <= 0
                  ? 'text-white'
                  : timeRemaining < 60
                  ? 'text-rose-700 dark:text-rose-300'
                  : timeRemaining < 300
                  ? 'text-amber-700 dark:text-amber-300'
                  : 'text-gray-900 dark:text-gray-100'
              }`}>
                {timeRemaining <= 0 ? "Time's Up!" : formattedTime}
              </span>
            </div>

            {/* Pause/Resume */}
            <button
              onClick={isPaused ? onResume : onPause}
              className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              title={isPaused ? 'Resume' : 'Pause'}
            >
              {isPaused ? (
                <Play className="h-5 w-5" />
              ) : (
                <Pause className="h-5 w-5" />
              )}
            </button>
          </>
        )}
      </div>
    </header>
  );
};

export default TestHeader;
