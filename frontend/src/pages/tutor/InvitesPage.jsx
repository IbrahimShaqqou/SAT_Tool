/**
 * Tutor Invite Links Page — Study Hall.
 * Generate and manage assessment invite links. Borderless sections, tokens,
 * StatusPill statuses, inline confirm (no window.confirm), dark mode, a11y.
 */
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Copy, Link as LinkIcon, Plus, Trash2, ExternalLink, X, Check, User, BarChart3 } from 'lucide-react';
import {
  Button, Input, Select, Modal, StatusPill,
  PageHeader, Section, Skeleton,
} from '../../components/ui';
import { inviteService } from '../../services';

const InvitesPage = () => {
  const [invites, setInvites] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [generatedLink, setGeneratedLink] = useState('');
  const [copied, setCopied] = useState(false);
  const [revokeTarget, setRevokeTarget] = useState(null);

  const [formData, setFormData] = useState({
    title: '',
    assessment_type: 'intake',
    subject_area: 'math',  // Default to Math
    time_limit_minutes: '',
    expires_in_days: '',
  });
  const [error, setError] = useState('');

  useEffect(() => {
    fetchInvites();
  }, []);

  const [authError, setAuthError] = useState(false);

  const fetchInvites = async () => {
    try {
      const response = await inviteService.list();
      const items = response.data.items || [];
      setInvites(items);
    } catch (error) {
      console.error('Failed to fetch invites:', error);
      if (error.response?.status === 401) {
        setAuthError(true);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  // Get fixed question count based on assessment type and subject
  const getQuestionCount = (type, subject) => {
    if (type === 'intake') {
      // 10 questions per domain for reliable theta estimates
      // Math: 4 domains = 40 questions
      // Reading/Writing: 3 active domains = 30 questions
      return subject === 'math' ? 40 : 30;
    }
    if (type === 'section') return 20;
    if (type === 'quick_check') return 10;
    return 40;
  };

  // Get estimated time based on question count
  const getEstimatedTime = (questionCount) => {
    // Roughly 1.5 minutes per question
    return Math.round(questionCount * 1.5);
  };

  const handleGenerate = async () => {
    setIsCreating(true);
    setError('');
    try {
      const questionCount = getQuestionCount(formData.assessment_type, formData.subject_area);
      const payload = {
        title: formData.title || null,
        assessment_type: formData.assessment_type,
        subject_area: formData.subject_area || null,
        question_count: questionCount,
        time_limit_minutes: formData.time_limit_minutes ? parseInt(formData.time_limit_minutes) : null,
        expires_in_days: formData.expires_in_days ? parseInt(formData.expires_in_days) : null,
        is_adaptive: true,
      };
      const response = await inviteService.create(payload);
      const link = `${window.location.origin}${response.data.link}`;
      setGeneratedLink(link);
      setShowModal(false);
      fetchInvites();
      // Reset form
      setFormData({
        title: '',
        assessment_type: 'intake',
        subject_area: 'math',
        time_limit_minutes: '',
        expires_in_days: '',
      });
    } catch (err) {
      console.error('Failed to create invite:', err);
      if (err.response?.status === 401) {
        setError('Session expired. Please refresh the page and log in again.');
      } else {
        setError(err.response?.data?.detail || 'Failed to create invite link');
      }
    } finally {
      setIsCreating(false);
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(generatedLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  const handleRevoke = async (inviteId) => {
    try {
      await inviteService.revoke(inviteId);
      setRevokeTarget(null);
      fetchInvites();
    } catch (error) {
      console.error('Failed to revoke invite:', error);
    }
  };

  const assessmentTypeOptions = [
    { value: 'intake', label: 'Intake Assessment (Recommended)' },
    { value: 'section', label: 'Section Assessment' },
    { value: 'quick_check', label: 'Quick Check' },
  ];

  const subjectOptions = [
    { value: 'math', label: 'Math' },
    { value: 'reading_writing', label: 'Reading & Writing' },
  ];

  // Update assessment type
  const handleAssessmentTypeChange = (e) => {
    const type = e.target.value;
    setFormData(prev => ({
      ...prev,
      assessment_type: type,
    }));
  };

  const STATUS_TONES = {
    active: 'good',
    used: 'neutral',
    expired: 'warn',
    revoked: 'bad',
  };
  const getStatusPill = (status) => (
    <StatusPill tone={STATUS_TONES[status] || 'neutral'} size="sm">{status}</StatusPill>
  );

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString();
  };

  return (
    <div className="mx-auto max-w-5xl pb-8">
      <PageHeader
        eyebrow="Your studio"
        title="Intake Assessments"
        subtitle="Generate intake assessment links for new students. Share a link and predicted scores arrive here when they finish."
        actions={
          <Button variant="primary" onClick={() => setShowModal(true)}>
            <Plus className="h-4 w-4" /> New Intake Link
          </Button>
        }
      />

      {/* Auth Error Banner */}
      {authError && (
        <div role="alert" className="mb-5 rounded-xl bg-rose-50 p-4 text-sm dark:bg-rose-900/20">
          <p className="font-semibold text-rose-700 dark:text-rose-300">Session expired</p>
          <p className="mt-0.5 text-rose-600 dark:text-rose-400">Please refresh the page and log in again to continue.</p>
        </div>
      )}

      {/* Generated Link Display */}
      {generatedLink && (
        <div className="relative mb-5 rounded-xl bg-accent-50 p-4 dark:bg-accent-900/20">
          <button
            type="button"
            onClick={() => setGeneratedLink('')}
            aria-label="Dismiss generated link"
            className="absolute right-3 top-3 rounded-full p-1 text-accent-700 transition-colors hover:bg-accent-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:text-accent-300 dark:hover:bg-accent-800/40"
          >
            <X className="h-4 w-4" />
          </button>
          <div className="mb-3 flex items-center gap-2">
            <Check className="h-5 w-5 text-accent-700 dark:text-accent-300" />
            <h2 className="text-sm font-semibold text-ink-body">Link generated successfully</h2>
          </div>
          <p className="mb-3 text-sm text-ink-muted">Share this link with your student. It&apos;s also saved below in &ldquo;Your invite links&rdquo;.</p>
          <div className="flex gap-2">
            <Input value={generatedLink} readOnly className="flex-1" />
            <Button variant="secondary" onClick={handleCopy}>
              <Copy className="h-4 w-4" /> {copied ? 'Copied!' : 'Copy'}
            </Button>
            <Button
              variant="secondary"
              onClick={() => window.open(generatedLink, '_blank')}
              aria-label="Open link in new tab"
            >
              <ExternalLink className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {isLoading ? (
        <Section title="Your invite links">
          <ul className="divide-y divide-edge-subtle">
            {[0, 1, 2].map((i) => (
              <li key={i} className="flex items-center justify-between py-4">
                <div className="space-y-1.5"><Skeleton className="h-3.5 w-40" /><Skeleton className="h-3 w-28" /></div>
                <Skeleton className="h-5 w-16" />
              </li>
            ))}
          </ul>
        </Section>
      ) : invites.length === 0 ? (
        <Section title="Intake assessment links" icon={LinkIcon}>
          <div className="space-y-3 text-sm text-ink-muted">
            <p>
              The recommended way to onboard new students. Intake assessments use adaptive
              question selection to efficiently measure ability across all SAT domains.
            </p>
            <ul className="space-y-1.5">
              <li><strong className="text-ink-body">1.</strong> Generate an intake assessment link</li>
              <li><strong className="text-ink-body">2.</strong> Share the link with your student</li>
              <li><strong className="text-ink-body">3.</strong> Student completes 40 questions (~60 min)</li>
              <li><strong className="text-ink-body">4.</strong> View predicted SAT scores and priority areas</li>
            </ul>
            <div className="pt-2">
              <Button variant="primary" size="sm" onClick={() => setShowModal(true)}>
                <Plus className="h-4 w-4" /> New Intake Link
              </Button>
            </div>
          </div>
        </Section>
      ) : (
        <Section title="Your invite links" hint={`${invites.length} link${invites.length === 1 ? '' : 's'}`}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-edge text-left text-xs uppercase tracking-wide text-ink-faint">
                  <th scope="col" className="py-2.5 pr-3 font-semibold">Title</th>
                  <th scope="col" className="py-2.5 px-3 font-semibold">Subject</th>
                  <th scope="col" className="py-2.5 px-3 font-semibold">Questions</th>
                  <th scope="col" className="py-2.5 px-3 font-semibold">Status</th>
                  <th scope="col" className="py-2.5 px-3 font-semibold">Result</th>
                  <th scope="col" className="py-2.5 px-3 font-semibold">Student</th>
                  <th scope="col" className="py-2.5 px-3 font-semibold">Created</th>
                  <th scope="col" className="py-2.5 pl-3 font-semibold"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-edge-subtle">
                {invites.map((row) => (
                  <tr key={row.id} className="text-ink-body">
                    <td className="py-3 pr-3 font-medium">{row.title || 'Untitled Assessment'}</td>
                    <td className="py-3 px-3 text-ink-muted">{row.subject_area ? row.subject_area.replace('_', '/') : 'Both'}</td>
                    <td className="py-3 px-3 text-ink-muted">{row.question_count}</td>
                    <td className="py-3 px-3">{getStatusPill(row.status)}</td>
                    <td className="py-3 px-3">
                      {row.status === 'used' && row.score_percentage != null ? (
                        <StatusPill value={row.score_percentage} size="sm" />
                      ) : row.status === 'used' ? (
                        <span className="text-ink-faint">Pending</span>
                      ) : (
                        <span className="text-ink-faint">-</span>
                      )}
                    </td>
                    <td className="py-3 px-3">
                      {row.student_id ? (
                        <Link
                          to={`/tutor/students/${row.student_id}`}
                          className="inline-flex items-center gap-1 font-medium text-brand-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:text-brand-400"
                        >
                          <User className="h-3 w-3" />
                          {row.guest_name || row.guest_email || '-'}
                        </Link>
                      ) : (
                        <span className="text-ink-muted">{row.guest_name || row.guest_email || '-'}</span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-ink-muted">{formatDate(row.created_at)}</td>
                    <td className="py-3 pl-3">
                      <div className="flex justify-end gap-1">
                        {row.status === 'active' && (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                const link = `${window.location.origin}/assess/${row.token}`;
                                navigator.clipboard.writeText(link);
                              }}
                              aria-label="Copy link"
                            >
                              <Copy className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setRevokeTarget(row.id)}
                              aria-label="Revoke link"
                            >
                              <Trash2 className="h-4 w-4 text-rose-600 dark:text-rose-400" />
                            </Button>
                          </>
                        )}
                        {row.status === 'used' && row.score_percentage != null && (
                          <Link to={`/tutor/invites/${row.id}/results`}>
                            <Button variant="ghost" size="sm" aria-label="View results">
                              <BarChart3 className="h-4 w-4 text-brand-600 dark:text-brand-400" />
                            </Button>
                          </Link>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}

      {/* Generate Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title="Generate Intake Assessment Link"
      >
        <div className="space-y-4">
          {/* Info banner for intake */}
          <div className="rounded-lg bg-brand-50 p-3 text-sm text-brand-800 dark:bg-brand-900/20 dark:text-brand-200">
            <strong>Intake Assessment:</strong> Tests each domain with adaptive difficulty to establish
            baseline ability levels. Results include predicted section scores and priority skills.
          </div>

          {/* Error message */}
          {error && (
            <div role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700 dark:bg-rose-900/20 dark:text-rose-300">
              {error}
            </div>
          )}

          <Input
            label="Title (optional)"
            name="title"
            value={formData.title}
            onChange={handleChange}
            placeholder="e.g., John's Initial Assessment"
          />

          <Select
            label="Assessment Type"
            name="assessment_type"
            value={formData.assessment_type}
            onChange={handleAssessmentTypeChange}
            options={assessmentTypeOptions}
          />

          <Select
            label="Subject Area"
            name="subject_area"
            value={formData.subject_area}
            onChange={handleChange}
            options={subjectOptions}
          />

          {/* Show fixed question count and estimated time */}
          {(() => {
            const questionCount = getQuestionCount(formData.assessment_type, formData.subject_area);
            const estimatedTime = getEstimatedTime(questionCount);
            const domainCount = formData.subject_area === 'math' ? 4 : 3;
            return (
              <div className="space-y-1 rounded-lg bg-surface-muted p-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-ink-muted"><strong>Questions:</strong></span>
                  <span className="text-ink-body">{questionCount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-ink-muted"><strong>Estimated time:</strong></span>
                  <span className="text-ink-body">~{estimatedTime} minutes</span>
                </div>
                {formData.assessment_type === 'intake' && (
                  <div className="mt-2 border-t border-edge pt-1 text-xs text-ink-subtle">
                    10 questions per domain × {domainCount} domains for reliable ability estimates
                  </div>
                )}
              </div>
            );
          })()}

          <Input
            label="Time Limit (minutes, optional)"
            name="time_limit_minutes"
            type="number"
            min="5"
            value={formData.time_limit_minutes}
            onChange={handleChange}
            placeholder="No limit"
          />

          <Input
            label="Link Expires In (days, optional)"
            name="expires_in_days"
            type="number"
            min="1"
            max="30"
            value={formData.expires_in_days}
            onChange={handleChange}
            placeholder="Never"
          />
        </div>

        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowModal(false)}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleGenerate}
            disabled={isCreating}
          >
            {isCreating ? 'Generating...' : 'Generate Link'}
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Revoke confirmation */}
      <Modal
        isOpen={revokeTarget != null}
        onClose={() => setRevokeTarget(null)}
        title="Revoke invite link?"
      >
        <p className="text-sm text-ink-muted">
          This link will stop working immediately and can&apos;t be reactivated. The student won&apos;t be able to start the assessment.
        </p>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setRevokeTarget(null)}>
            Cancel
          </Button>
          <Button variant="danger" onClick={() => handleRevoke(revokeTarget)}>
            Revoke link
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default InvitesPage;
