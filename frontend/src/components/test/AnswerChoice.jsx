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
  // a11y: radio semantics
  roving = false,        // is this the tabbable choice in the group?
  onKeyDown,
  buttonRef,
}) => {
  const letter = letters[index] || String.fromCharCode(65 + index);
  const contentRef = useRef(null);

  // Plain-text version of the choice for the accessible name (strip HTML/MathML).
  const accessibleText = (() => {
    if (typeof content !== 'string') return '';
    const tmp = document.createElement('div');
    tmp.innerHTML = content;
    return (tmp.textContent || '').replace(/\s+/g, ' ').trim();
  })();
  const statusSuffix = isChecked && isCorrect === true ? ', correct'
    : isChecked && isCorrect === false ? ', incorrect'
    : showAsCorrect ? ', correct answer'
    : '';

  // Trigger MathJax rendering when content changes
  useEffect(() => {
    if (contentRef.current && window.MathJax?.typesetPromise) {
      window.MathJax.typesetClear?.([contentRef.current]);
      window.MathJax.typesetPromise([contentRef.current]).catch(() => {});
    }
  }, [content]);

  // Determine styling based on state
  const getButtonStyle = () => {
    if (isChecked && isCorrect === true) {
      return 'border-accent-500 bg-accent-50 dark:bg-accent-900/20';
    }
    if (isChecked && isCorrect === false) {
      return 'border-rose-500 bg-rose-50 dark:bg-rose-900/20';
    }
    if (showAsCorrect) {
      return 'border-accent-500 bg-accent-50 dark:bg-accent-900/20';
    }
    if (isSelected) {
      return 'border-brand-500 bg-brand-50 dark:bg-brand-900/25';
    }
    return 'border-edge hover:border-edge-strong hover:bg-surface-muted';
  };

  const getCircleStyle = () => {
    if (isChecked && isCorrect === true) {
      return 'border-accent-500 bg-accent-500 text-white';
    }
    if (isChecked && isCorrect === false) {
      return 'border-rose-500 bg-rose-500 text-white';
    }
    if (showAsCorrect) {
      return 'border-accent-500 bg-accent-500 text-white';
    }
    if (isSelected) {
      return 'border-brand-600 bg-brand-600 text-white';
    }
    return 'border-edge-strong text-ink-subtle';
  };

  return (
    <button
      ref={buttonRef}
      type="button"
      role="radio"
      aria-checked={isSelected}
      aria-label={`${letter}. ${accessibleText}${statusSuffix}`}
      tabIndex={roving ? 0 : -1}
      onClick={onClick}
      onKeyDown={onKeyDown}
      disabled={disabled || isChecked}
      className={`
        w-full flex items-center gap-4 p-4
        border rounded-lg text-left
        transition-all duration-150
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-page
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
        className="flex-1 text-ink-body flex items-center min-h-[2rem]"
        dangerouslySetInnerHTML={{ __html: content }}
      />

      {/* Status indicator */}
      {isChecked && isCorrect === true && (
        <span className="text-accent-700 dark:text-accent-400 font-medium text-sm">Correct</span>
      )}
      {isChecked && isCorrect === false && (
        <span className="text-rose-600 dark:text-rose-400 font-medium text-sm">Incorrect</span>
      )}
      {showAsCorrect && !isSelected && (
        <span className="text-accent-700 dark:text-accent-400 font-medium text-sm">Correct Answer</span>
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
    if (isChecked && isCorrect === true) return 'border-accent-500 bg-accent-50 dark:bg-accent-900/20';
    if (isChecked && isCorrect === false) return 'border-rose-500 bg-rose-50 dark:bg-rose-900/20';
    if (error) return 'border-rose-400';
    if (inputValue) return 'border-brand-500';
    return 'border-edge';
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
            w-48 px-3 py-2 text-base text-ink-body
            border rounded-lg
            focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus:border-brand-500
            ${disabled || isChecked ? 'bg-surface-muted cursor-not-allowed' : 'bg-surface-input'}
            ${getBorderClass()}
          `}
        />
        {isChecked && isCorrect === true && (
          <span className="text-accent-700 dark:text-accent-400 font-medium">Correct</span>
        )}
        {isChecked && isCorrect === false && (
          <span className="text-rose-600 dark:text-rose-400 font-medium">Incorrect</span>
        )}
      </div>
      {error ? (
        <p className="text-xs text-rose-600 dark:text-rose-400">{error}</p>
      ) : (
        <p className="text-xs text-ink-faint">
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
  return (
    <MCQRadioGroup
      choices={choices}
      selectedIndex={selectedIndex}
      onSelect={onSelect}
      disabled={disabled}
      isChecked={isChecked}
      correctIndex={correctIndex}
      isCorrect={isCorrect}
    />
  );
};

// Keyboard-accessible radio group for MCQ choices.
// Roving tabindex + arrow keys, matching the WAI-ARIA radiogroup pattern.
const MCQRadioGroup = ({ choices, selectedIndex, onSelect, disabled, isChecked, correctIndex, isCorrect }) => {
  const btnRefs = useRef([]);
  // The tabbable choice: the selected one, else the first.
  const [focusIndex, setFocusIndex] = useState(
    typeof selectedIndex === 'number' ? selectedIndex : 0
  );

  useEffect(() => {
    if (typeof selectedIndex === 'number') setFocusIndex(selectedIndex);
  }, [selectedIndex]);

  if (!choices || choices.length === 0) {
    return (
      <div className="p-4 bg-surface-muted rounded-lg text-center text-ink-subtle">
        No answer choices available for this question.
      </div>
    );
  }

  const moveTo = (next) => {
    const clamped = (next + choices.length) % choices.length;
    setFocusIndex(clamped);
    const el = btnRefs.current[clamped];
    if (el) el.focus();
    if (!disabled && !isChecked) onSelect(clamped); // arrow keys also select (radio convention)
  };

  const handleKeyDown = (e, index) => {
    switch (e.key) {
      case 'ArrowDown':
      case 'ArrowRight':
        e.preventDefault();
        moveTo(index + 1);
        break;
      case 'ArrowUp':
      case 'ArrowLeft':
        e.preventDefault();
        moveTo(index - 1);
        break;
      default:
        break;
    }
  };

  return (
    <div role="radiogroup" aria-label="Answer choices" className="space-y-3">
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
            roving={index === focusIndex}
            onKeyDown={(e) => handleKeyDown(e, index)}
            buttonRef={(el) => { btnRefs.current[index] = el; }}
          />
        );
      })}
    </div>
  );
};

export { AnswerChoice, AnswerChoices, SPRAnswerInput };
export default AnswerChoices;
