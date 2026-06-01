/**
 * Question Display Component
 * Shows question number, mark for review, and the question prompt
 * Renders MathML content using MathJax
 */
import { useEffect, useRef, useCallback } from 'react';
import { Flag, AlertTriangle } from 'lucide-react';
import HighlightableText from './HighlightableText';

const QuestionDisplay = ({
  questionNumber,
  totalQuestions,
  questionHtml,
  stimulusHtml, // Optional stimulus content (graphs, tables, etc.)
  questionId,
  isMarked,
  onToggleMark,
  onReport,
  hideMarkForReview = false, // Hide in adaptive mode
  headingRef, // a11y: focus target on question change
}) => {
  // containerRef covers the entire content area (stimulus + question) for MathJax
  const containerRef = useRef(null);
  // questionContentRef is forwarded to HighlightableText's inner div for DOM serialization
  const questionContentRef = useRef(null);

  const runMathJax = useCallback(() => {
    if (containerRef.current && window.MathJax?.typesetPromise) {
      window.MathJax.typesetClear?.([containerRef.current]);
      window.MathJax.typesetPromise([containerRef.current]).catch((err) => {
        console.warn('MathJax typeset error:', err);
      });
    }
  }, []);

  // Trigger MathJax rendering when question content changes
  useEffect(() => {
    runMathJax();
  }, [questionHtml, stimulusHtml, runMathJax]);

  return (
    <div className="flex-1 overflow-y-auto">
      {/* Question header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-edge">
        <div className="flex items-center gap-4">
          {/* Question number — focus target + accessible heading on navigation */}
          <h2
            ref={headingRef}
            tabIndex={-1}
            className="flex items-center gap-2 focus:outline-none"
          >
            <span className="flex items-center justify-center w-8 h-8 bg-brand-600 text-white text-sm font-medium rounded">
              {questionNumber}
            </span>
            <span className="sr-only">
              Question {questionNumber}{totalQuestions ? ` of ${totalQuestions}` : ''}
            </span>
          </h2>

          {/* Mark for review - hidden in adaptive mode */}
          {!hideMarkForReview && (
            <button
              onClick={onToggleMark}
              aria-pressed={isMarked}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${
                isMarked
                  ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300'
                  : 'text-ink-muted hover:bg-surface-muted'
              }`}
            >
              <Flag className="h-4 w-4" />
              <span>Mark for Review</span>
            </button>
          )}
        </div>

        {/* Report button */}
        <button
          onClick={onReport}
          className="flex items-center gap-2 px-3 py-1.5 text-ink-subtle hover:text-ink-body hover:bg-surface-muted rounded-lg text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
        >
          <AlertTriangle className="h-4 w-4" />
          <span>Report</span>
        </button>
      </div>

      {/* Question content */}
      <div className="p-6" ref={containerRef}>
        {/* Stimulus content (graphs, tables, etc.) shown above question */}
        {stimulusHtml && (
          <div
            className="prose prose-gray dark:prose-invert max-w-none question-content mb-4"
            dangerouslySetInnerHTML={{ __html: stimulusHtml }}
          />
        )}
        {/* Question prompt — highlightable.
            key=questionId forces a fresh mount on navigation so displayHtml
            initialises correctly and MathJax always typesets the right content. */}
        <HighlightableText
          key={questionId ?? questionNumber}
          html={questionHtml}
          questionId={questionId ?? questionNumber}
          contentRef={questionContentRef}
          onAfterSave={runMathJax}
        />
      </div>
    </div>
  );
};

export default QuestionDisplay;
