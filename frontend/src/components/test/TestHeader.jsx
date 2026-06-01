/**
 * Test Header Component
 * Timer, question count, subject indicator, reference sheet, calculator
 */
import { useRef, useState, useEffect } from 'react';
import { Clock, Calculator, Pause, Play, FileText, Pencil } from 'lucide-react';

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
  onDrawToggle,
  isDrawing = false,
}) => {
  // Screen-reader timer announcements: the visible counter changes every second
  // (so it can't carry aria-live), so we announce only at meaningful thresholds.
  const [announcement, setAnnouncement] = useState('');
  const lastThreshold = useRef(null);
  useEffect(() => {
    if (!hasTimeLimit || timeRemaining == null) return;
    let label = null;
    if (timeRemaining <= 0) label = "Time's up";
    else if (timeRemaining <= 60) label = '1 minute remaining';
    else if (timeRemaining <= 300) label = '5 minutes remaining';
    if (label && label !== lastThreshold.current) {
      lastThreshold.current = label;
      setAnnouncement(label);
    }
  }, [timeRemaining, hasTimeLimit]);

  return (
    <header className="sticky top-0 z-30 h-14 bg-surface-muted border-b border-edge flex items-center justify-between px-6">
      {/* Screen-reader-only timer announcements (assertive at the final minute) */}
      <div
        className="sr-only"
        role="status"
        aria-live={timeRemaining != null && timeRemaining <= 60 ? 'assertive' : 'polite'}
      >
        {announcement}
      </div>
      {/* Left: Subject */}
      <div className="flex items-center gap-4">
        <span className="text-sm font-medium text-ink-muted uppercase tracking-wide">
          {subjectArea === 'math' ? 'Math' : 'Reading & Writing'}
        </span>
      </div>

      {/* Center: Question count */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-ink-subtle">Question</span>
        <span className="font-semibold text-ink-body">
          {currentQuestion} of {totalQuestions}
        </span>
      </div>

      {/* Right: Timer and controls */}
      <div className="flex items-center gap-2">
        {/* Draw toggle — always available */}
        {onDrawToggle && (
          <button
            onClick={onDrawToggle}
            aria-label={isDrawing ? 'Stop drawing' : 'Draw on question'}
            aria-pressed={isDrawing}
            className={`p-2 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${
              isDrawing
                ? 'bg-brand-600 text-white'
                : 'text-ink-muted hover:bg-surface-card'
            }`}
            title={isDrawing ? 'Stop drawing' : 'Draw on question'}
          >
            <Pencil className="h-5 w-5" />
          </button>
        )}

        {/* Reference Sheet toggle (only for math) */}
        {subjectArea === 'math' && onReferenceToggle && (
          <button
            onClick={onReferenceToggle}
            aria-label="Reference sheet"
            aria-pressed={showReference}
            className={`p-2 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${
              showReference
                ? 'bg-brand-600 text-white'
                : 'text-ink-muted hover:bg-surface-card'
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
            aria-label="Calculator"
            aria-pressed={showCalculator}
            className={`p-2 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${
              showCalculator
                ? 'bg-brand-600 text-white'
                : 'text-ink-muted hover:bg-surface-card'
            }`}
            title="Calculator"
          >
            <Calculator className="h-5 w-5" />
          </button>
        )}

        {/* Timer - only shown when tutor sets a time limit */}
        {hasTimeLimit && (
          <>
            <div
              role="timer"
              aria-hidden="true"
              className={`flex items-center gap-2 ml-2 px-3 py-1 rounded-lg transition-all ${
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
                timeRemaining < 300 ? 'text-current' : 'text-ink-faint'
              }`} />
              <span className={`font-mono text-lg font-medium ${
                timeRemaining <= 0
                  ? 'text-white'
                  : timeRemaining < 60
                  ? 'text-rose-700 dark:text-rose-300'
                  : timeRemaining < 300
                  ? 'text-amber-700 dark:text-amber-300'
                  : 'text-ink-body'
              }`}>
                {timeRemaining <= 0 ? "Time's Up!" : formattedTime}
              </span>
            </div>

            {/* Pause/Resume */}
            <button
              onClick={isPaused ? onResume : onPause}
              aria-label={isPaused ? 'Resume timer' : 'Pause timer'}
              className="p-2 text-ink-muted hover:bg-surface-card rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
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
