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
  questionHtml,
  stimulusHtml, // Optional stimulus content (graphs, tables, etc.)
  questionId,
  isMarked,
  onToggleMark,
  onReport,
  hideMarkForReview = false, // Hide in adaptive mode
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
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-4">
          {/* Question number */}
          <span className="flex items-center justify-center w-8 h-8 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 text-sm font-medium rounded">
            {questionNumber}
          </span>

          {/* Mark for review - hidden in adaptive mode */}
          {!hideMarkForReview && (
            <button
              onClick={onToggleMark}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                isMarked
                  ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
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
          className="flex items-center gap-2 px-3 py-1.5 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-sm transition-colors"
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
