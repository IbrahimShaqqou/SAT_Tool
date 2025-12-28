/**
 * Tutor Invite Links Page
 * Generate and manage assessment invite links
 */
import { useState, useEffect } from 'react';
import { Copy, Link as LinkIcon, Plus, Trash2, ExternalLink } from 'lucide-react';
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
    subject_area: '',
    question_count: 20,
    time_limit_minutes: '',
    expires_in_days: '',
  });

  useEffect(() => {
    fetchInvites();
  }, []);

  const fetchInvites = async () => {
    try {
      const response = await inviteService.list();
      setInvites(response.data.items || []);
    } catch (error) {
      console.error('Failed to fetch invites:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleGenerate = async () => {
    setIsCreating(true);
    try {
      const payload = {
        title: formData.title || null,
        subject_area: formData.subject_area || null,
        question_count: parseInt(formData.question_count) || 20,
        time_limit_minutes: formData.time_limit_minutes ? parseInt(formData.time_limit_minutes) : null,
        expires_in_days: formData.expires_in_days ? parseInt(formData.expires_in_days) : null,
      };
      const response = await inviteService.create(payload);
      const link = `${window.location.origin}${response.data.link}`;
      setGeneratedLink(link);
      setShowModal(false);
      fetchInvites();
      // Reset form
      setFormData({
        title: '',
        subject_area: '',
        question_count: 20,
        time_limit_minutes: '',
        expires_in_days: '',
      });
    } catch (error) {
      console.error('Failed to create invite:', error);
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

  const subjectOptions = [
    { value: '', label: 'Math & Reading/Writing' },
    { value: 'math', label: 'Math Only' },
    { value: 'reading_writing', label: 'Reading/Writing Only' },
  ];

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
      render: (row) => row.guest_name || row.guest_email || '-',
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
          <h1 className="text-2xl font-semibold text-gray-900">Invite Links</h1>
          <p className="text-gray-500 mt-1">Generate assessment links for new students</p>
        </div>
        <Button variant="primary" onClick={() => setShowModal(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Generate Link
        </Button>
      </div>

      {/* Generated Link Display */}
      {generatedLink && (
        <Card className="border-green-200 bg-green-50">
          <Card.Header>
            <Card.Title>Your Assessment Link</Card.Title>
            <Card.Description>Share this link with your student</Card.Description>
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
                {copied ? 'Copied' : 'Copy'}
              </Button>
              <Button
                variant="secondary"
                onClick={() => window.open(generatedLink, '_blank')}
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
            <div className="p-3 bg-gray-100 rounded-lg">
              <LinkIcon className="h-6 w-6 text-gray-600" />
            </div>
            <div>
              <h3 className="font-medium text-gray-900">How invite links work</h3>
              <ul className="mt-2 text-sm text-gray-600 space-y-1">
                <li>1. Generate a unique assessment link with your settings</li>
                <li>2. Share the link with your student</li>
                <li>3. Student completes the assessment (account optional)</li>
                <li>4. View their results in your dashboard</li>
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
        title="Generate Assessment Link"
      >
        <div className="space-y-4">
          <Input
            label="Title (optional)"
            name="title"
            value={formData.title}
            onChange={handleChange}
            placeholder="e.g., Initial Assessment"
          />

          <Select
            label="Subject Area"
            name="subject_area"
            value={formData.subject_area}
            onChange={handleChange}
            options={subjectOptions}
          />

          <Input
            label="Number of Questions"
            name="question_count"
            type="number"
            min="5"
            max="50"
            value={formData.question_count}
            onChange={handleChange}
          />

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
