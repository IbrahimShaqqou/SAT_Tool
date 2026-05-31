/**
 * Profile Page — Study Hall.
 * Borderless account groups under hairline-ruled Sections, inline edit form,
 * token-driven feedback. Logic, data fetching, and routes preserved.
 */
import { useState } from 'react';
import { User, Mail, Calendar, Shield, Save, X, Target } from 'lucide-react';
import { Button, PageHeader, Section, Skeleton } from '../../components/ui';
import { useAuth } from '../../hooks/useAuth';
import { authService } from '../../services';

const ProfilePage = () => {
  const { user, refreshUser } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [formData, setFormData] = useState({
    first_name: user?.first_name || '',
    last_name: user?.last_name || '',
    target_score: user?.target_score || '',
    test_date: user?.test_date || '',
  });

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const payload = {
        first_name: formData.first_name,
        last_name: formData.last_name,
      };
      if (formData.target_score) payload.target_score = parseInt(formData.target_score, 10);
      if (formData.test_date) payload.test_date = formData.test_date;

      await authService.updateProfile(payload);
      if (refreshUser) {
        await refreshUser();
      }
      setSuccess('Profile updated successfully');
      setIsEditing(false);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to update profile');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setFormData({
      first_name: user?.first_name || '',
      last_name: user?.last_name || '',
      target_score: user?.target_score || '',
      test_date: user?.test_date || '',
    });
    setIsEditing(false);
    setError(null);
  };

  if (!user) {
    return (
      <div className="mx-auto max-w-2xl pb-8">
        <div className="space-y-3 py-10">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-64" />
          <div className="space-y-4 pt-6">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-14 w-full" rounded="rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const isStudent = user.role === 'student';

  const fieldClasses =
    'w-full rounded-xl bg-surface-input px-3.5 py-2.5 text-sm text-ink-body placeholder-ink-faint transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500';
  const labelClasses = 'mb-1.5 block text-sm font-medium text-ink-muted';

  return (
    <div className="mx-auto max-w-2xl pb-8">
      <PageHeader
        eyebrow="Your account"
        title="Profile"
        subtitle="Manage your account information and study goals."
      />

      {error && (
        <div
          role="alert"
          className="mb-6 rounded-xl bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700 dark:bg-rose-500/10 dark:text-rose-300"
        >
          {error}
        </div>
      )}

      {success && (
        <div
          role="alert"
          className="mb-6 rounded-xl bg-accent-50 px-4 py-3 text-sm font-medium text-accent-700 dark:bg-accent-500/10 dark:text-accent-300"
        >
          {success}
        </div>
      )}

      <div className="space-y-10">
        {/* Personal Information */}
        <Section
          title="Personal Information"
          icon={User}
          action={
            !isEditing ? (
              <Button variant="secondary" size="sm" onClick={() => setIsEditing(true)}>
                Edit
              </Button>
            ) : (
              <div className="flex gap-2">
                <Button variant="secondary" size="sm" onClick={handleCancel}>
                  <X className="h-4 w-4" />
                  Cancel
                </Button>
                <Button variant="primary" size="sm" onClick={handleSave} disabled={isSaving}>
                  <Save className="h-4 w-4" />
                  {isSaving ? 'Saving...' : 'Save'}
                </Button>
              </div>
            )
          }
        >
          {isEditing ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="first_name" className={labelClasses}>
                    First Name
                  </label>
                  <input
                    id="first_name"
                    type="text"
                    value={formData.first_name}
                    onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                    className={fieldClasses}
                  />
                </div>
                <div>
                  <label htmlFor="last_name" className={labelClasses}>
                    Last Name
                  </label>
                  <input
                    id="last_name"
                    type="text"
                    value={formData.last_name}
                    onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                    className={fieldClasses}
                  />
                </div>
              </div>
              {isStudent && (
                <div className="grid grid-cols-1 gap-4 border-t border-edge-subtle pt-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor="target_score" className={labelClasses}>
                      Target SAT Score
                    </label>
                    <input
                      id="target_score"
                      type="number"
                      min="400"
                      max="1600"
                      step="10"
                      placeholder="e.g. 1400"
                      value={formData.target_score}
                      onChange={(e) => setFormData({ ...formData, target_score: e.target.value })}
                      className={fieldClasses}
                    />
                  </div>
                  <div>
                    <label htmlFor="test_date" className={labelClasses}>
                      Test Date
                    </label>
                    <input
                      id="test_date"
                      type="date"
                      value={formData.test_date}
                      onChange={(e) => setFormData({ ...formData, test_date: e.target.value })}
                      className={fieldClasses}
                    />
                  </div>
                </div>
              )}
            </div>
          ) : (
            <dl className="divide-y divide-edge-subtle">
              <div className="flex items-center gap-3 py-3">
                <User className="h-5 w-5 shrink-0 text-ink-faint" />
                <div>
                  <dt className="text-sm text-ink-subtle">Name</dt>
                  <dd className="font-medium text-ink-body">
                    {user.first_name} {user.last_name}
                  </dd>
                </div>
              </div>

              <div className="flex items-center gap-3 py-3">
                <Mail className="h-5 w-5 shrink-0 text-ink-faint" />
                <div>
                  <dt className="text-sm text-ink-subtle">Email</dt>
                  <dd className="font-medium text-ink-body">{user.email}</dd>
                </div>
              </div>

              <div className="flex items-center gap-3 py-3">
                <Shield className="h-5 w-5 shrink-0 text-ink-faint" />
                <div>
                  <dt className="text-sm text-ink-subtle">Account Type</dt>
                  <dd className="font-medium capitalize text-ink-body">{user.role}</dd>
                </div>
              </div>

              {isStudent && (
                <div className="flex items-center gap-3 py-3">
                  <Target className="h-5 w-5 shrink-0 text-ink-faint" />
                  <div>
                    <dt className="text-sm text-ink-subtle">SAT Goal</dt>
                    <dd className="font-medium text-ink-body">
                      {user.target_score
                        ? `${user.target_score}${user.test_date ? ` by ${formatDate(user.test_date)}` : ''}`
                        : 'Not set'}
                    </dd>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-3 py-3">
                <Calendar className="h-5 w-5 shrink-0 text-ink-faint" />
                <div>
                  <dt className="text-sm text-ink-subtle">Member Since</dt>
                  <dd className="font-medium text-ink-body">{formatDate(user.created_at)}</dd>
                </div>
              </div>
            </dl>
          )}
        </Section>

        {/* Security */}
        <Section title="Security" hint="Manage your account security settings">
          <div className="flex items-center justify-between gap-4 py-2">
            <div className="min-w-0">
              <p className="font-medium text-ink-body">Password</p>
              <p className="mt-0.5 text-sm text-ink-subtle">Last changed: Unknown</p>
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => (window.location.href = '/forgot-password')}
            >
              Change Password
            </Button>
          </div>
        </Section>
      </div>
    </div>
  );
};

export default ProfilePage;
