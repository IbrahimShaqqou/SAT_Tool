/**
 * Submit Confirmation Modal
 * Shows warning about unanswered questions before submission
 */
import { AlertTriangle } from 'lucide-react';
import { Modal, Button } from '../ui';

const SubmitConfirmation = ({
  isOpen,
  onClose,
  onConfirm,
  totalQuestions,
  answeredCount,
  markedCount,
  isSubmitting = false,
}) => {
  const unansweredCount = totalQuestions - answeredCount;
  const hasUnanswered = unansweredCount > 0;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Submit Test"
      size="sm"
    >
      <div className="space-y-4">
        {hasUnanswered ? (
          <div className="flex items-start gap-3 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
            <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-amber-800 dark:text-amber-200">
                You have unanswered questions
              </p>
              <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                {unansweredCount} question{unansweredCount !== 1 ? 's' : ''} will be marked as incorrect if you submit now.
              </p>
            </div>
          </div>
        ) : (
          <p className="text-ink-muted">
            You have answered all questions. Are you ready to submit?
          </p>
        )}

        {/* Summary */}
        <div className="grid grid-cols-3 gap-4 py-4 border-y border-edge-subtle">
          <div className="text-center">
            <p className="text-2xl font-semibold text-ink-body">{answeredCount}</p>
            <p className="text-sm text-ink-subtle">Answered</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-semibold text-ink-body">{unansweredCount}</p>
            <p className="text-sm text-ink-subtle">Unanswered</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-semibold text-ink-body">{markedCount}</p>
            <p className="text-sm text-ink-subtle">Marked</p>
          </div>
        </div>

        <p className="text-sm text-ink-subtle">
          Once submitted, you cannot change your answers.
        </p>
      </div>

      <Modal.Footer>
        <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
          Review Answers
        </Button>
        <Button
          variant="primary"
          onClick={onConfirm}
          loading={isSubmitting}
          disabled={isSubmitting}
        >
          Submit Test
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default SubmitConfirmation;
