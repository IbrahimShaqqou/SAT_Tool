/**
 * Break Screen
 * 10-minute break between Math and Reading/Writing sections
 * Matches Bluebook break screen
 */
import { useState, useEffect } from 'react';

const BreakScreen = ({ breakDuration = 10, onEnd }) => {
  const [timeRemaining, setTimeRemaining] = useState(breakDuration * 60); // Convert to seconds
  const [canContinue, setCanContinue] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          setCanContinue(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    // Allow skipping break after 1 minute
    const skipTimer = setTimeout(() => {
      setCanContinue(true);
    }, 60 * 1000);

    return () => {
      clearInterval(timer);
      clearTimeout(skipTimer);
    };
  }, []);

  const minutes = Math.floor(timeRemaining / 60);
  const seconds = timeRemaining % 60;
  const formattedTime = `${minutes}:${seconds.toString().padStart(2, '0')}`;

  return (
    <div className="flex items-center justify-center min-h-screen bg-surface-page">
      <div className="max-w-2xl w-full px-8 text-center">
        {/* Break icon */}
        <div className="mb-6">
          <svg
            className="w-20 h-20 mx-auto text-brand-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </div>

        {/* Break title */}
        <h1 className="text-4xl font-bold text-ink-body mb-4">
          Break Time
        </h1>

        {/* Timer */}
        <div className="bg-surface-muted rounded-lg p-8 mb-8">
          <div className="text-6xl font-bold text-brand-600 mb-2">
            {formattedTime}
          </div>
          <div className="text-sm text-ink-muted uppercase tracking-wide">
            Time Remaining
          </div>
        </div>

        {/* Recommendations */}
        <div className="text-left mb-8 space-y-4 text-ink-muted">
          <p className="font-semibold">Use this time to:</p>
          <ul className="list-disc list-inside space-y-2 ml-4">
            <li>Stretch and move around</li>
            <li>Use the restroom</li>
            <li>Get a drink of water</li>
            <li>Rest your eyes</li>
          </ul>
        </div>

        {/* Continue button */}
        <div className="flex justify-center">
          <button
            onClick={onEnd}
            disabled={!canContinue}
            className={`px-12 py-4 text-lg font-semibold rounded-lg transition-colors shadow-md ${
              canContinue
                ? 'bg-brand-600 text-white hover:bg-brand-700'
                : 'bg-surface-muted text-ink-faint cursor-not-allowed'
            }`}
          >
            {timeRemaining > 0 ? 'Skip Break & Continue' : 'Continue to Next Module'}
          </button>
        </div>

        {!canContinue && (
          <p className="mt-4 text-sm text-ink-subtle">
            You can skip this break in {Math.max(0, 60 - (breakDuration * 60 - timeRemaining))} seconds
          </p>
        )}
      </div>
    </div>
  );
};

export { BreakScreen };
