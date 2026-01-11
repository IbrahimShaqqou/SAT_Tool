/**
 * Settings Page
 * Application settings and preferences
 */
import { useState } from 'react';
import { Settings, Bell, Moon, Globe, Save } from 'lucide-react';
import { Card, Button } from '../../components/ui';
import { useAuth } from '../../hooks/useAuth';

const SettingsPage = () => {
  const { user } = useAuth();
  const [settings, setSettings] = useState({
    emailNotifications: true,
    assignmentReminders: true,
    progressUpdates: false,
    darkMode: false,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  });
  const [isSaving, setIsSaving] = useState(false);
  const [success, setSuccess] = useState(null);

  const handleToggle = (key) => {
    setSettings(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    // Settings would be saved to backend when implemented
    setTimeout(() => {
      setIsSaving(false);
      setSuccess('Settings saved successfully');
      setTimeout(() => setSuccess(null), 3000);
    }, 500);
  };

  const ToggleSwitch = ({ enabled, onChange }) => (
    <button
      onClick={onChange}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
        enabled ? 'bg-gray-900' : 'bg-gray-200'
      }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
          enabled ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  );

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Settings</h1>
        <p className="text-gray-500 mt-1">Manage your preferences</p>
      </div>

      {success && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-green-700">
          {success}
        </div>
      )}

      {/* Notifications */}
      <Card>
        <Card.Header>
          <Card.Title className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-gray-500" />
            Notifications
          </Card.Title>
          <Card.Description>Configure how you receive notifications</Card.Description>
        </Card.Header>
        <Card.Content>
          <div className="space-y-4">
            <div className="flex items-center justify-between py-3 border-b border-gray-100">
              <div>
                <p className="font-medium text-gray-900">Email Notifications</p>
                <p className="text-sm text-gray-500">Receive updates via email</p>
              </div>
              <ToggleSwitch
                enabled={settings.emailNotifications}
                onChange={() => handleToggle('emailNotifications')}
              />
            </div>

            <div className="flex items-center justify-between py-3 border-b border-gray-100">
              <div>
                <p className="font-medium text-gray-900">Assignment Reminders</p>
                <p className="text-sm text-gray-500">Get reminded about upcoming assignments</p>
              </div>
              <ToggleSwitch
                enabled={settings.assignmentReminders}
                onChange={() => handleToggle('assignmentReminders')}
              />
            </div>

            <div className="flex items-center justify-between py-3">
              <div>
                <p className="font-medium text-gray-900">Progress Updates</p>
                <p className="text-sm text-gray-500">Weekly summary of your progress</p>
              </div>
              <ToggleSwitch
                enabled={settings.progressUpdates}
                onChange={() => handleToggle('progressUpdates')}
              />
            </div>
          </div>
        </Card.Content>
      </Card>

      {/* Display */}
      <Card>
        <Card.Header>
          <Card.Title className="flex items-center gap-2">
            <Moon className="h-5 w-5 text-gray-500" />
            Display
          </Card.Title>
          <Card.Description>Customize your viewing experience</Card.Description>
        </Card.Header>
        <Card.Content>
          <div className="flex items-center justify-between py-3">
            <div>
              <p className="font-medium text-gray-900">Dark Mode</p>
              <p className="text-sm text-gray-500">Use dark theme (coming soon)</p>
            </div>
            <ToggleSwitch
              enabled={settings.darkMode}
              onChange={() => handleToggle('darkMode')}
            />
          </div>
        </Card.Content>
      </Card>

      {/* Timezone */}
      <Card>
        <Card.Header>
          <Card.Title className="flex items-center gap-2">
            <Globe className="h-5 w-5 text-gray-500" />
            Regional
          </Card.Title>
          <Card.Description>Location and time settings</Card.Description>
        </Card.Header>
        <Card.Content>
          <div className="py-3">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Timezone
            </label>
            <select
              value={settings.timezone}
              onChange={(e) => setSettings(prev => ({ ...prev, timezone: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent"
            >
              <option value="America/New_York">Eastern Time (ET)</option>
              <option value="America/Chicago">Central Time (CT)</option>
              <option value="America/Denver">Mountain Time (MT)</option>
              <option value="America/Los_Angeles">Pacific Time (PT)</option>
              <option value="America/Anchorage">Alaska Time (AKT)</option>
              <option value="Pacific/Honolulu">Hawaii Time (HT)</option>
              <option value="UTC">UTC</option>
            </select>
          </div>
        </Card.Content>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button variant="primary" onClick={handleSave} disabled={isSaving}>
          <Save className="h-4 w-4 mr-2" />
          {isSaving ? 'Saving...' : 'Save Settings'}
        </Button>
      </div>
    </div>
  );
};

export default SettingsPage;
