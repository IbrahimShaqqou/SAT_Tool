/**
 * Test Controls Component
 * Previous, Next, and Submit buttons
 */
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '../ui';

const TestControls = ({
  currentIndex,
  totalQuestions,
  onPrevious,
  onNext,
  onSubmit,
  canSubmit = true,
}) => {
  const isFirst = currentIndex === 0;
  const isLast = currentIndex === totalQuestions - 1;

  return (
    <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 bg-white">
      {/* Previous */}
      <Button
        variant="secondary"
        onClick={onPrevious}
        disabled={isFirst}
      >
        <ChevronLeft className="h-4 w-4 mr-1" />
        Previous
      </Button>

      {/* Next or Submit */}
      {isLast ? (
        <Button
          variant="primary"
          onClick={onSubmit}
          disabled={!canSubmit}
        >
          Submit Test
        </Button>
      ) : (
        <Button
          variant="primary"
          onClick={onNext}
        >
          Next
          <ChevronRight className="h-4 w-4 ml-1" />
        </Button>
      )}
    </div>
  );
};

export default TestControls;
