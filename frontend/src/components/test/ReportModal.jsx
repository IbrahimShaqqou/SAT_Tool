/**
 * ReportModal
 * Lets students flag an issue with the current question.
 * Submits to POST /api/v1/questions/:id/report.
 */
import { useState } from 'react';
import { X, AlertTriangle, CheckCircle2 } from 'lucide-react';
import api from '../../services/api';

const REASONS = [
  { value: 'wrong_answer',        label: 'Answer key is wrong' },
  { value: 'broken_image',        label: 'Image or graph is missing/broken' },
  { value: 'typo_or_formatting',  label: 'Typo or formatting problem' },
  { value: 'unclear_question',    label: 'Question is confusing or unclear' },
  { value: 'other',               label: 'Something else' },
];

const ReportModal = ({ questionId, onClose }) => {
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!reason) { setError('Please select a reason.'); return; }
    setSubmitting(true);
    setError('');
    try {
      await api.post(`/questions/${questionId}/report`, { reason, notes: notes.trim() || undefined });
      setSubmitted(true);
    } catch {
      setError('Could not submit report. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="bg-surface-card rounded-xl shadow-xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-edge">
          <div className="flex items-center gap-2 text-ink-body font-semibold">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Report a Problem
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="p-1 rounded hover:bg-surface-muted text-ink-subtle"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-5">
          {submitted ? (
            <div className="flex flex-col items-center gap-3 py-4 text-center">
              <CheckCircle2 className="h-10 w-10 text-emerald-500" />
              <p className="text-ink-body font-medium">Report submitted, thanks!</p>
              <p className="text-sm text-ink-subtle">We'll review this question and fix any issues.</p>
              <button
                onClick={onClose}
                className="mt-2 px-4 py-2 bg-surface-muted rounded-lg text-sm hover:bg-surface-page"
              >
                Close
              </button>
            </div>
          ) : (
            <>
              <p className="text-sm text-ink-subtle mb-4">
                What's wrong with question #{questionId}?
              </p>

              {/* Reason radio list */}
              <div className="space-y-2 mb-4">
                {REASONS.map((r) => (
                  <label
                    key={r.value}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border cursor-pointer transition-colors ${
                      reason === r.value
                        ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/20 text-brand-800 dark:text-brand-200'
                        : 'border-edge hover:bg-surface-muted text-ink-muted'
                    }`}
                  >
                    <input
                      type="radio"
                      name="report-reason"
                      value={r.value}
                      checked={reason === r.value}
                      onChange={() => { setReason(r.value); setError(''); }}
                      className="accent-brand-500"
                    />
                    <span className="text-sm">{r.label}</span>
                  </label>
                ))}
              </div>

              {/* Optional notes */}
              <textarea
                placeholder="Add details (optional)"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                maxLength={500}
                rows={3}
                className="w-full text-sm px-3 py-2 border border-edge rounded-lg bg-surface-input text-ink-body placeholder-ink-faint focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 resize-none"
              />

              {error && <p className="mt-2 text-sm text-rose-600">{error}</p>}

              {/* Actions */}
              <div className="flex justify-end gap-3 mt-4">
                <button
                  onClick={onClose}
                  className="px-4 py-2 text-sm rounded-lg text-ink-muted hover:bg-surface-muted"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="px-4 py-2 text-sm rounded-lg bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50"
                >
                  {submitting ? 'Submitting…' : 'Submit Report'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ReportModal;
