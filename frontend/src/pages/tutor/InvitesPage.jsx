/**
 * Tutor Invite Links Page
 * Generate and manage assessment invite links
 */
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Copy, Link as LinkIcon, Plus, Trash2, ExternalLink, X, Check, User, BarChart3 } from 'lucide-react';
import { Card, Button, Input, Select, Modal, Badge, LoadingSpinner, Table } from '../../components/ui';
import { inviteService } from '../../services';

const InvitesPage = () => {
  const [invites, setInvites] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [generatedLink, setGeneratedLink] = useState('');
  const [copied, setCopied] = useState(false);

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
      console.log('Invites API response:', response.data);
      const items = response.data.items || [];
      console.log('Invites items:', items);
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
    if (!window.confirm('Are you sure you want to revoke this invite link?')) return;
    try {
      await inviteService.revoke(inviteId);
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

  const getStatusBadge = (status) => {
    const variants = {
      active: 'success',
      used: 'default',
      expired: 'warning',
      revoked: 'danger',
    };
    return <Badge variant={variants[status] || 'default'}>{status}</Badge>;
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString();
  };

  const columns = [
    {
      key: 'title',
      header: 'Title',
      render: (row) => row.title || 'Untitled Assessment',
    },
    {
      key: 'subject',
      header: 'Subject',
      render: (row) => row.subject_area ? row.subject_area.replace('_', '/') : 'Both',
    },
    {
      key: 'questions',
      header: 'Questions',
      render: (row) => row.question_count,
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => getStatusBadge(row.status),
    },
    {
      key: 'result',
      header: 'Result',
      render: (row) => {
        if (row.status === 'used' && row.score_percentage != null) {
          return (
            <span className={row.score_percentage >= 70 ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}>
              {row.score_percentage.toFixed(0)}%
            </span>
          );
        }
        if (row.status === 'used') {
          return <span className="text-ink-faint">Pending</span>;
        }
        return '-';
      },
    },
    {
      key: 'guest',
      header: 'Student',
      render: (row) => {
        const name = row.guest_name || row.guest_email || '-';
        // If student_id exists, link to student detail page
        if (row.student_id) {
          return (
            <Link
              to={`/tutor/students/${row.student_id}`}
              className="text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300 hover:underline flex items-center gap-1"
            >
              <User className="h-3 w-3" />
              {name}
            </Link>
          );
        }
        return name;
      },
    },
    {
      key: 'created',
      header: 'Created',
      render: (row) => formatDate(row.created_at),
    },
    {
      key: 'actions',
      header: '',
      render: (row) => (
        <div className="flex gap-2">
          {row.status === 'active' && (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  const link = `${window.location.origin}/assess/${row.token}`;
                  navigator.clipboard.writeText(link);
                }}
                title="Copy link"
              >
                <Copy className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleRevoke(row.id)}
                title="Revoke"
              >
                <Trash2 className="h-4 w-4 text-red-500 dark:text-red-400" />
              </Button>
            </>
          )}
          {row.status === 'used' && row.score_percentage != null && (
            <Link to={`/tutor/invites/${row.id}/results`} title="View Results">
              <Button variant="ghost" size="sm">
                <BarChart3 className="h-4 w-4 text-brand-500 dark:text-brand-400" />
              </Button>
            </Link>
          )}
        </div>
      ),
    },
  ];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-ink-body">Intake Assessments</h1>
          <p className="text-ink-subtle mt-1">Generate intake assessment links for new students</p>
        </div>
        <Button variant="primary" onClick={() => setShowModal(true)}>
          <Plus className="h-4 w-4 mr-2" />
          New Intake Link
        </Button>
      </div>

      {/* Auth Error Banner */}
      {authError && (
        <Card className="border-red-200 dark:border-red-800/50 bg-red-50 dark:bg-red-900/20">
          <div className="flex items-center gap-3 p-4">
            <div className="text-red-600 dark:text-red-400 font-medium">Session expired</div>
            <div className="text-red-600 dark:text-red-400 text-sm">Please refresh the page and log in again to continue.</div>
          </div>
        </Card>
      )}

      {/* Generated Link Display */}
      {generatedLink && (
        <Card className="border-emerald-200 dark:border-emerald-800/50 bg-emerald-50 dark:bg-emerald-900/20 relative">
          <button
            onClick={() => setGeneratedLink('')}
            className="absolute top-3 right-3 p-1 rounded-full hover:bg-emerald-100 dark:hover:bg-emerald-800/40 transition-colors"
            title="Dismiss"
          >
            <X className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          </button>
          <Card.Header>
            <div className="flex items-center gap-2">
              <Check className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              <Card.Title>Link Generated Successfully</Card.Title>
            </div>
            <Card.Description>Share this link with your student. It's also saved below in "Your Invite Links".</Card.Description>
          </Card.Header>
          <Card.Content>
            <div className="flex gap-2">
              <Input
                value={generatedLink}
                readOnly
                className="flex-1"
              />
              <Button variant="secondary" onClick={handleCopy}>
                <Copy className="h-4 w-4 mr-2" />
                {copied ? 'Copied!' : 'Copy'}
              </Button>
              <Button
                variant="secondary"
                onClick={() => window.open(generatedLink, '_blank')}
                title="Open in new tab"
              >
                <ExternalLink className="h-4 w-4" />
              </Button>
            </div>
          </Card.Content>
        </Card>
      )}

      {/* Info Card - show only if no invites */}
      {invites.length === 0 && (
        <Card>
          <div className="flex items-start gap-4">
            <div className="p-3 bg-brand-100 dark:bg-brand-900/30 rounded-lg">
              <LinkIcon className="h-6 w-6 text-brand-600 dark:text-brand-400" />
            </div>
            <div>
              <h3 className="font-medium text-ink-body">Intake Assessment Links</h3>
              <p className="text-sm text-ink-muted mt-1">
                The recommended way to onboard new students. Intake assessments use adaptive
                question selection to efficiently measure ability across all SAT domains.
              </p>
              <ul className="mt-3 text-sm text-ink-muted space-y-1">
                <li><strong>1.</strong> Generate an intake assessment link</li>
                <li><strong>2.</strong> Share the link with your student</li>
                <li><strong>3.</strong> Student completes 40 questions (~60 min)</li>
                <li><strong>4.</strong> View predicted SAT scores and priority areas</li>
              </ul>
            </div>
          </div>
        </Card>
      )}

      {/* Invites Table */}
      {invites.length > 0 && (
        <Card>
          <Card.Header>
            <Card.Title>Your Invite Links</Card.Title>
          </Card.Header>
          <Card.Content className="p-0">
            <Table
              columns={columns}
              data={invites}
              emptyMessage="No invite links yet"
            />
          </Card.Content>
        </Card>
      )}

      {/* Generate Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title="Generate Intake Assessment Link"
      >
        <div className="space-y-4">
          {/* Info banner for intake */}
          <div className="bg-brand-50 dark:bg-brand-900/20 border border-brand-200 dark:border-brand-800/50 rounded-lg p-3 text-sm text-brand-800 dark:text-brand-200">
            <strong>Intake Assessment:</strong> Tests each domain with adaptive difficulty to establish
            baseline ability levels. Results include predicted section scores and priority skills.
          </div>

          {/* Error message */}
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 rounded-lg p-3 text-sm text-red-800 dark:text-red-300">
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
              <div className="text-sm bg-surface-muted rounded-lg p-3 space-y-1">
                <div className="flex justify-between">
                  <span className="text-ink-muted"><strong>Questions:</strong></span>
                  <span className="text-ink-body">{questionCount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-ink-muted"><strong>Estimated time:</strong></span>
                  <span className="text-ink-body">~{estimatedTime} minutes</span>
                </div>
                {formData.assessment_type === 'intake' && (
                  <div className="text-ink-subtle text-xs pt-1 border-t border-edge mt-2">
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

    </div>
  );
};

export default InvitesPage;
