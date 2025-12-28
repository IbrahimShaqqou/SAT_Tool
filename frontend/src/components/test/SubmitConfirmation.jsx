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
          <div className="flex items-start gap-3 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <AlertTriangle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-yellow-800">
                You have unanswered questions
              </p>
              <p className="text-sm text-yellow-700 mt-1">
                {unansweredCount} question{unansweredCount !== 1 ? 's' : ''} will be marked as incorrect if you submit now.
              </p>
            </div>
          </div>
        ) : (
          <p className="text-gray-600">
            You have answered all questions. Are you ready to submit?
          </p>
        )}

        {/* Summary */}
        <div className="grid grid-cols-3 gap-4 py-4 border-y border-gray-100">
          <div className="text-center">
            <p className="text-2xl font-semibold text-gray-900">{answeredCount}</p>
            <p className="text-sm text-gray-500">Answered</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-semibold text-gray-900">{unansweredCount}</p>
            <p className="text-sm text-gray-500">Unanswered</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-semibold text-gray-900">{markedCount}</p>
            <p className="text-sm text-gray-500">Marked</p>
          </div>
        </div>

        <p className="text-sm text-gray-500">
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
