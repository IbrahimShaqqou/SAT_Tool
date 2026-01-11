/**
 * Profile Page
 * Displays user profile information with edit capabilities
 */
import { useState } from 'react';
import { User, Mail, Calendar, Shield, Save, X } from 'lucide-react';
import { Card, Button, LoadingSpinner } from '../../components/ui';
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
  });

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);
    setSuccess(null);

    try {
      await authService.updateProfile(formData);
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
    });
    setIsEditing(false);
    setError(null);
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
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

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Profile</h1>
        <p className="text-gray-500 mt-1">Manage your account information</p>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}

      {success && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-green-700">
          {success}
        </div>
      )}

      {/* Profile Card */}
      <Card>
        <Card.Header>
          <div className="flex items-center justify-between">
            <Card.Title className="flex items-center gap-2">
              <User className="h-5 w-5 text-gray-500" />
              Personal Information
            </Card.Title>
            {!isEditing ? (
              <Button variant="secondary" size="sm" onClick={() => setIsEditing(true)}>
                Edit
              </Button>
            ) : (
              <div className="flex gap-2">
                <Button variant="secondary" size="sm" onClick={handleCancel}>
                  <X className="h-4 w-4 mr-1" />
                  Cancel
                </Button>
                <Button variant="primary" size="sm" onClick={handleSave} disabled={isSaving}>
                  <Save className="h-4 w-4 mr-1" />
                  {isSaving ? 'Saving...' : 'Save'}
                </Button>
              </div>
            )}
          </div>
        </Card.Header>
        <Card.Content>
          <div className="space-y-4">
            {isEditing ? (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      First Name
                    </label>
                    <input
                      type="text"
                      value={formData.first_name}
                      onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Last Name
                    </label>
                    <input
                      type="text"
                      value={formData.last_name}
                      onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                    />
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center gap-3 py-3 border-b border-gray-100">
                  <User className="h-5 w-5 text-gray-400" />
                  <div>
                    <p className="text-sm text-gray-500">Name</p>
                    <p className="font-medium text-gray-900">
                      {user.first_name} {user.last_name}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 py-3 border-b border-gray-100">
                  <Mail className="h-5 w-5 text-gray-400" />
                  <div>
                    <p className="text-sm text-gray-500">Email</p>
                    <p className="font-medium text-gray-900">{user.email}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 py-3 border-b border-gray-100">
                  <Shield className="h-5 w-5 text-gray-400" />
                  <div>
                    <p className="text-sm text-gray-500">Account Type</p>
                    <p className="font-medium text-gray-900 capitalize">{user.role}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 py-3">
                  <Calendar className="h-5 w-5 text-gray-400" />
                  <div>
                    <p className="text-sm text-gray-500">Member Since</p>
                    <p className="font-medium text-gray-900">{formatDate(user.created_at)}</p>
                  </div>
                </div>
              </>
            )}
          </div>
        </Card.Content>
      </Card>

      {/* Change Password Card */}
      <Card>
        <Card.Header>
          <Card.Title>Security</Card.Title>
          <Card.Description>Manage your account security settings</Card.Description>
        </Card.Header>
        <Card.Content>
          <div className="flex items-center justify-between py-3">
            <div>
              <p className="font-medium text-gray-900">Password</p>
              <p className="text-sm text-gray-500">Last changed: Unknown</p>
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => window.location.href = '/forgot-password'}
            >
              Change Password
            </Button>
          </div>
        </Card.Content>
      </Card>
    </div>
  );
};

export default ProfilePage;
