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
      return 'bg-green-50';
    }
    if (isChecked && isCorrect === false) {
      return 'bg-red-50';
    }
    if (showAsCorrect) {
      return 'bg-green-50';
    }
    if (isSelected) {
      return 'bg-gray-50';
    }
    return 'hover:bg-gray-50';
  };

  const getCircleStyle = () => {
    if (isChecked && isCorrect === true) {
      return 'border-green-500 bg-green-500 text-white';
    }
    if (isChecked && isCorrect === false) {
      return 'border-red-500 bg-red-500 text-white';
    }
    if (showAsCorrect) {
      return 'border-green-500 bg-green-500 text-white';
    }
    if (isSelected) {
      return 'border-gray-900 bg-gray-900 text-white';
    }
    return 'border-gray-400 text-gray-600';
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled || isChecked}
      className={`
        w-full flex items-center gap-4 p-4
        border rounded-lg text-left
        transition-all duration-150
        focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-1
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

      {/* Choice content */}
      <span
        ref={contentRef}
        className="flex-1 text-gray-900"
        dangerouslySetInnerHTML={{ __html: content }}
      />

      {/* Status indicator */}
      {isChecked && isCorrect === true && (
        <span className="text-green-600 font-medium text-sm">Correct</span>
      )}
      {isChecked && isCorrect === false && (
        <span className="text-red-600 font-medium text-sm">Incorrect</span>
      )}
      {showAsCorrect && !isSelected && (
        <span className="text-green-600 font-medium text-sm">Correct Answer</span>
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
    if (isChecked && isCorrect === true) return 'border-green-500 bg-green-50';
    if (isChecked && isCorrect === false) return 'border-red-500 bg-red-50';
    if (error) return 'border-red-400';
    if (inputValue) return 'border-gray-900';
    return 'border-gray-300';
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
            w-48 px-3 py-2 text-base
            border rounded-lg
            focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-gray-900
            ${disabled || isChecked ? 'bg-gray-100 cursor-not-allowed' : 'bg-white'}
            ${getBorderClass()}
          `}
        />
        {isChecked && isCorrect === true && (
          <span className="text-green-600 font-medium">Correct</span>
        )}
        {isChecked && isCorrect === false && (
          <span className="text-red-600 font-medium">Incorrect</span>
        )}
      </div>
      {error ? (
        <p className="text-xs text-red-500">{error}</p>
      ) : (
        <p className="text-xs text-gray-400">
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
      <div className="p-4 bg-gray-50 rounded-lg text-center text-gray-500">
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
