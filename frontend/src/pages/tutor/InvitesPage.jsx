/**
 * Tutor Invite Links Page
 * Generate and manage assessment invite links
 */
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Copy, Link as LinkIcon, Plus, Trash2, ExternalLink, X, Check, Eye, User, BarChart3 } from 'lucide-react';
import { Card, Button, Input, Select, Modal, Badge, LoadingSpinner, Table, ProgressBar } from '../../components/ui';
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
  const [showResultsModal, setShowResultsModal] = useState(false);
  const [selectedResults, setSelectedResults] = useState(null);
  const [loadingResults, setLoadingResults] = useState(false);

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

  const handleViewResults = async (inviteId) => {
    setLoadingResults(true);
    setShowResultsModal(true);
    try {
      const response = await inviteService.getResults(inviteId);
      setSelectedResults(response.data);
    } catch (error) {
      console.error('Failed to fetch results:', error);
      setSelectedResults({ error: 'Failed to load results' });
    } finally {
      setLoadingResults(false);
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
            <span className={row.score_percentage >= 70 ? 'text-green-600' : 'text-amber-600'}>
              {row.score_percentage.toFixed(0)}%
            </span>
          );
        }
        if (row.status === 'used') {
          return <span className="text-gray-400">Pending</span>;
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
              className="text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1"
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
                <Trash2 className="h-4 w-4 text-red-500" />
              </Button>
            </>
          )}
          {row.status === 'used' && row.score_percentage != null && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleViewResults(row.id)}
              title="View Results"
            >
              <BarChart3 className="h-4 w-4 text-blue-500" />
            </Button>
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
          <h1 className="text-2xl font-semibold text-gray-900">Intake Assessments</h1>
          <p className="text-gray-500 mt-1">Generate intake assessment links for new students</p>
        </div>
        <Button variant="primary" onClick={() => setShowModal(true)}>
          <Plus className="h-4 w-4 mr-2" />
          New Intake Link
        </Button>
      </div>

      {/* Auth Error Banner */}
      {authError && (
        <Card className="border-red-200 bg-red-50">
          <div className="flex items-center gap-3 p-4">
            <div className="text-red-600 font-medium">Session expired</div>
            <div className="text-red-600 text-sm">Please refresh the page and log in again to continue.</div>
          </div>
        </Card>
      )}

      {/* Generated Link Display */}
      {generatedLink && (
        <Card className="border-green-200 bg-green-50 relative">
          <button
            onClick={() => setGeneratedLink('')}
            className="absolute top-3 right-3 p-1 rounded-full hover:bg-green-100 transition-colors"
            title="Dismiss"
          >
            <X className="h-4 w-4 text-green-600" />
          </button>
          <Card.Header>
            <div className="flex items-center gap-2">
              <Check className="h-5 w-5 text-green-600" />
              <Card.Title>Link Generated Successfully</Card.Title>
            </div>
            <Card.Description>Share this link with your student. It's also saved below in "Your Invite Links".</Card.Description>
          </Card.Header>
          <Card.Content>
            <div className="flex gap-2">
              <Input
                value={generatedLink}
                readOnly
                className="flex-1 bg-white"
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
            <div className="p-3 bg-blue-100 rounded-lg">
              <LinkIcon className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <h3 className="font-medium text-gray-900">Intake Assessment Links</h3>
              <p className="text-sm text-gray-600 mt-1">
                The recommended way to onboard new students. Intake assessments use adaptive
                question selection to efficiently measure ability across all SAT domains.
              </p>
              <ul className="mt-3 text-sm text-gray-600 space-y-1">
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
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
            <strong>Intake Assessment:</strong> Tests each domain with adaptive difficulty to establish
            baseline ability levels. Results include predicted section scores and priority skills.
          </div>

          {/* Error message */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-800">
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
              <div className="text-sm bg-gray-50 rounded-lg p-3 space-y-1">
                <div className="flex justify-between">
                  <span className="text-gray-600"><strong>Questions:</strong></span>
                  <span className="text-gray-900">{questionCount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600"><strong>Estimated time:</strong></span>
                  <span className="text-gray-900">~{estimatedTime} minutes</span>
                </div>
                {formData.assessment_type === 'intake' && (
                  <div className="text-gray-500 text-xs pt-1 border-t border-gray-200 mt-2">
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

      {/* Results Modal */}
      <Modal
        isOpen={showResultsModal}
        onClose={() => {
          setShowResultsModal(false);
          setSelectedResults(null);
        }}
        title="Assessment Results"
        size="lg"
      >
        {loadingResults ? (
          <div className="flex items-center justify-center py-12">
            <LoadingSpinner size="lg" />
          </div>
        ) : selectedResults?.error ? (
          <div className="text-center py-8 text-red-500">
            {selectedResults.error}
          </div>
        ) : selectedResults ? (
          <div className="space-y-6">
            {/* Student Info */}
            <div className="flex items-center justify-between pb-4 border-b">
              <div>
                <h3 className="font-semibold text-gray-900">{selectedResults.student_name}</h3>
                <p className="text-sm text-gray-500">{selectedResults.student_email}</p>
              </div>
              <div className="text-right">
                <p className={`text-3xl font-bold ${
                  selectedResults.score_percentage >= 70 ? 'text-green-600' :
                  selectedResults.score_percentage >= 50 ? 'text-amber-600' : 'text-red-600'
                }`}>
                  {selectedResults.score_percentage?.toFixed(0)}%
                </p>
                <p className="text-sm text-gray-500">
                  {selectedResults.overall?.correct} / {selectedResults.overall?.total} correct
                </p>
              </div>
            </div>

            {/* Section Scores */}
            {selectedResults.section_abilities?.length > 0 && (
              <div>
                <h4 className="font-medium text-gray-900 mb-3">Section Scores</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {selectedResults.section_abilities.map((section) => (
                    <div key={section.section} className="p-4 bg-gray-50 rounded-lg">
                      <div className="flex justify-between items-start mb-2">
                        <span className="font-medium capitalize">
                          {section.section.replace('_', ' & ')}
                        </span>
                        <span className="text-lg font-bold text-blue-600">
                          {section.predicted_score_mid}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mb-2">
                        Predicted: {section.predicted_score_low} - {section.predicted_score_high}
                      </p>
                      <ProgressBar value={section.accuracy} variant="auto" size="sm" />
                      <p className="text-xs text-gray-500 mt-1">
                        {section.correct}/{section.total} correct ({section.accuracy}%)
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Domain Breakdown */}
            {selectedResults.domain_abilities?.length > 0 && (
              <div>
                <h4 className="font-medium text-gray-900 mb-3">Domain Breakdown</h4>
                <div className="space-y-3">
                  {selectedResults.domain_abilities.map((domain) => (
                    <div key={domain.domain_id} className="p-3 border rounded-lg">
                      <div className="flex justify-between items-center mb-2">
                        <div>
                          <span className="font-medium text-gray-900">{domain.domain_name}</span>
                          <span className="text-xs text-gray-500 ml-2">({domain.domain_code})</span>
                        </div>
                        <span className={`font-bold ${
                          domain.accuracy >= 70 ? 'text-green-600' :
                          domain.accuracy >= 50 ? 'text-amber-600' : 'text-red-600'
                        }`}>
                          {domain.accuracy}%
                        </span>
                      </div>
                      <ProgressBar value={domain.accuracy} variant="auto" size="sm" />
                      <p className="text-xs text-gray-500 mt-1">
                        {domain.correct}/{domain.total} correct • Ability: {domain.theta > 0 ? '+' : ''}{domain.theta}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Priority Areas */}
            {selectedResults.priority_areas?.length > 0 && (
              <div>
                <h4 className="font-medium text-gray-900 mb-3">Priority Areas for Improvement</h4>
                <div className="space-y-2">
                  {selectedResults.priority_areas.map((area, idx) => (
                    <div key={idx} className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                      <div className="flex justify-between items-start">
                        <span className="font-medium text-amber-900">{area.domain_name}</span>
                        <Badge variant="warning">{area.current_level}</Badge>
                      </div>
                      <p className="text-sm text-amber-700 mt-1">{area.recommendation}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Link to Student Profile */}
            {selectedResults.student_id && (
              <div className="pt-4 border-t">
                <Link to={`/tutor/students/${selectedResults.student_id}`}>
                  <Button variant="primary" className="w-full">
                    <User className="h-4 w-4 mr-2" />
                    View Full Student Profile
                  </Button>
                </Link>
              </div>
            )}
          </div>
        ) : null}

        <Modal.Footer>
          <Button
            variant="secondary"
            onClick={() => {
              setShowResultsModal(false);
              setSelectedResults(null);
            }}
          >
            Close
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default InvitesPage;
