/**
 * Answer Choice Component
 * Individual MCQ choice with outlined circle (A, B, C, D)
 * Also includes SPR (Student-Produced Response) input for math
 * Based on SAT design reference
 * Renders MathML content using MathJax
 */
import { useState, useEffect, useRef } from 'react';

const letters = ['A', 'B', 'C', 'D'];

const AnswerChoice = ({
  index,
  content,
  isSelected,
  onClick,
  disabled = false,
  isChecked = false,
  isCorrect = null, // true if this is the correct answer, false if wrong
  showAsCorrect = false, // Show this choice as the correct one (after checking wrong answer)
}) => {
  const letter = letters[index] || String.fromCharCode(65 + index);
  const contentRef = useRef(null);

  // Trigger MathJax rendering when content changes
  useEffect(() => {
    if (contentRef.current && window.MathJax?.typesetPromise) {
      window.MathJax.typesetPromise([contentRef.current]).catch(() => {});
    }
  }, [content]);

  // Determine styling based on state
  const getButtonStyle = () => {
    if (isChecked && isCorrect === true) {
      return 'bg-emerald-50 dark:bg-emerald-900/20';
    }
    if (isChecked && isCorrect === false) {
      return 'bg-rose-50 dark:bg-rose-900/20';
    }
    if (showAsCorrect) {
      return 'bg-emerald-50 dark:bg-emerald-900/20';
    }
    if (isSelected) {
      return 'bg-gray-50 dark:bg-gray-700';
    }
    return 'hover:bg-gray-50 dark:hover:bg-gray-700';
  };

  const getCircleStyle = () => {
    if (isChecked && isCorrect === true) {
      return 'border-emerald-500 bg-emerald-500 text-white';
    }
    if (isChecked && isCorrect === false) {
      return 'border-rose-500 bg-rose-500 text-white';
    }
    if (showAsCorrect) {
      return 'border-emerald-500 bg-emerald-500 text-white';
    }
    if (isSelected) {
      return 'border-gray-900 dark:border-gray-100 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900';
    }
    return 'border-gray-400 dark:border-gray-500 text-gray-600 dark:text-gray-400';
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled || isChecked}
      className={`
        w-full flex items-center gap-4 p-4
        border border-gray-200 dark:border-gray-700 rounded-lg text-left
        transition-all duration-150
        focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-gray-400 focus:ring-offset-1 dark:focus:ring-offset-gray-800
        ${disabled || isChecked ? 'cursor-not-allowed' : 'cursor-pointer'}
        ${getButtonStyle()}
      `}
    >
      {/* Letter circle */}
      <span
        className={`
          flex items-center justify-center
          w-8 h-8 rounded-full border-2 flex-shrink-0
          text-sm font-medium
          transition-colors
          ${getCircleStyle()}
        `}
      >
        {letter}
      </span>

      {/* Choice content - flex to align with letter circle */}
      <span
        ref={contentRef}
        className="flex-1 text-gray-900 dark:text-gray-100 flex items-center min-h-[2rem]"
        dangerouslySetInnerHTML={{ __html: content }}
      />

      {/* Status indicator */}
      {isChecked && isCorrect === true && (
        <span className="text-emerald-600 dark:text-emerald-400 font-medium text-sm">Correct</span>
      )}
      {isChecked && isCorrect === false && (
        <span className="text-rose-600 dark:text-rose-400 font-medium text-sm">Incorrect</span>
      )}
      {showAsCorrect && !isSelected && (
        <span className="text-emerald-600 dark:text-emerald-400 font-medium text-sm">Correct Answer</span>
      )}
    </button>
  );
};

// Validate SPR input - accepts numbers, fractions, and decimals
const validateSPRInput = (value) => {
  if (!value || value.trim() === '') return { valid: false, error: null };

  const trimmed = value.trim();

  // Allow negative sign at start
  const numberPattern = /^-?\d+\.?\d*$/;
  // Fraction pattern: -?number/number
  const fractionPattern = /^-?\d+\/\d+$/;
  // Mixed number: -?number space number/number (e.g., "1 3/4")
  const mixedPattern = /^-?\d+\s+\d+\/\d+$/;

  if (numberPattern.test(trimmed) || fractionPattern.test(trimmed) || mixedPattern.test(trimmed)) {
    return { valid: true, error: null };
  }

  return { valid: false, error: 'Enter a number, fraction (3/4), or decimal (0.75)' };
};

// SPR Answer Input for Student-Produced Response questions
const SPRAnswerInput = ({
  value,
  onChange,
  onSubmit,
  disabled = false,
  questionId, // Add questionId to reset state when question changes
  isChecked = false,
  isCorrect = null,
}) => {
  const [inputValue, setInputValue] = useState(value || '');
  const [error, setError] = useState(null);

  // Sync internal state when value prop changes (question changes)
  useEffect(() => {
    setInputValue(value || '');
    setError(null);
  }, [value, questionId]);

  const handleChange = (e) => {
    const newValue = e.target.value;
    setInputValue(newValue);
    setError(null);
    // Update parent on every keystroke (for tracking purposes)
    // Validation happens on blur/submit
    onChange(newValue.trim());
  };

  const handleBlur = () => {
    if (inputValue.trim()) {
      const validation = validateSPRInput(inputValue);
      if (!validation.valid) {
        setError(validation.error);
      }
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      const validation = validateSPRInput(inputValue);
      if (validation.valid) {
        if (onSubmit) onSubmit();
      } else {
        setError(validation.error);
      }
    }
  };

  // Determine border color based on state
  const getBorderClass = () => {
    if (isChecked && isCorrect === true) return 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20';
    if (isChecked && isCorrect === false) return 'border-rose-500 bg-rose-50 dark:bg-rose-900/20';
    if (error) return 'border-rose-400';
    if (inputValue) return 'border-gray-900 dark:border-gray-100';
    return 'border-gray-300 dark:border-gray-600';
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        <input
          type="text"
          value={inputValue}
          onChange={handleChange}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          disabled={disabled || isChecked}
          placeholder="Your answer"
          className={`
            w-48 px-3 py-2 text-base text-gray-900 dark:text-gray-100
            border rounded-lg
            focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-gray-400 focus:border-gray-900 dark:focus:border-gray-400
            ${disabled || isChecked ? 'bg-gray-100 dark:bg-gray-700 cursor-not-allowed' : 'bg-white dark:bg-gray-800'}
            ${getBorderClass()}
          `}
        />
        {isChecked && isCorrect === true && (
          <span className="text-emerald-600 dark:text-emerald-400 font-medium">Correct</span>
        )}
        {isChecked && isCorrect === false && (
          <span className="text-rose-600 dark:text-rose-400 font-medium">Incorrect</span>
        )}
      </div>
      {error ? (
        <p className="text-xs text-rose-500 dark:text-rose-400">{error}</p>
      ) : (
        <p className="text-xs text-gray-400 dark:text-gray-500">
          Enter a number, fraction (3/4), or decimal (0.75)
        </p>
      )}
    </div>
  );
};

const AnswerChoices = ({
  choices,
  selectedIndex,
  selectedAnswer, // For SPR: string value
  answerType = 'MCQ',
  onSelect,
  onAnswerChange, // For SPR
  disabled = false,
  questionId, // To reset SPR state when question changes
  isChecked = false, // Whether answer has been checked
  correctIndex = null, // Correct answer index for MCQ
  isCorrect = null, // Whether the selected answer is correct
}) => {
  // SPR questions - show input field
  if (answerType === 'SPR') {
    return (
      <SPRAnswerInput
        value={selectedAnswer}
        onChange={onAnswerChange}
        disabled={disabled}
        questionId={questionId}
        isChecked={isChecked}
        isCorrect={isCorrect}
      />
    );
  }

  // MCQ questions - show choices
  if (!choices || choices.length === 0) {
    return (
      <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg text-center text-gray-500 dark:text-gray-400">
        No answer choices available for this question.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {choices.map((choice, index) => {
        const isSelected = selectedIndex === index;
        const isThisCorrect = correctIndex === index;

        return (
          <AnswerChoice
            key={index}
            index={index}
            content={choice}
            isSelected={isSelected}
            onClick={() => onSelect(index)}
            disabled={disabled || isChecked}
            isChecked={isChecked && isSelected}
            isCorrect={isChecked && isSelected ? isThisCorrect : null}
            showAsCorrect={isChecked && !isCorrect && isThisCorrect && !isSelected}
          />
        );
      })}
    </div>
  );
};

export { AnswerChoice, AnswerChoices, SPRAnswerInput };
export default AnswerChoices;
