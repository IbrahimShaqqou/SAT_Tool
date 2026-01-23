/**
 * Settings Page
 * Application settings and preferences
 * Supports dark mode
 */
import { useState, useEffect } from 'react';
import { Moon, Globe, Save, Sun, Check } from 'lucide-react';
import { Card, Button } from '../../components/ui';
import { useAuth } from '../../hooks/useAuth';
import { useTheme } from '../../contexts/ThemeContext';

const SettingsPage = () => {
  useAuth();
  const { isDarkMode, toggleDarkMode } = useTheme();

  // Load timezone from localStorage or detect from browser
  const [timezone, setTimezone] = useState(() => {
    const stored = localStorage.getItem('userTimezone');
    return stored || Intl.DateTimeFormat().resolvedOptions().timeZone;
  });
  const [isSaving, setIsSaving] = useState(false);
  const [success, setSuccess] = useState(null);

  // Persist timezone to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('userTimezone', timezone);
  }, [timezone]);

  const handleSave = async () => {
    setIsSaving(true);
    // Save to localStorage (already done via useEffect)
    localStorage.setItem('userTimezone', timezone);
    setTimeout(() => {
      setIsSaving(false);
      setSuccess('Settings saved successfully');
      setTimeout(() => setSuccess(null), 3000);
    }, 300);
  };

  const ToggleSwitch = ({ enabled, onChange }) => (
    <button
      onClick={onChange}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
        enabled ? 'bg-gray-900 dark:bg-gray-100' : 'bg-gray-200 dark:bg-gray-600'
      }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full transition-transform ${
          enabled
            ? 'translate-x-6 bg-white dark:bg-gray-900'
            : 'translate-x-1 bg-white dark:bg-gray-300'
        }`}
      />
    </button>
  );

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">Settings</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">Manage your preferences</p>
      </div>

      {success && (
        <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg text-green-700 dark:text-green-400 flex items-center gap-2">
          <Check className="h-4 w-4" />
          {success}
        </div>
      )}

      {/* Display */}
      <Card>
        <Card.Header>
          <Card.Title className="flex items-center gap-2">
            {isDarkMode ? (
              <Moon className="h-5 w-5 text-gray-500 dark:text-gray-400" />
            ) : (
              <Sun className="h-5 w-5 text-gray-500 dark:text-gray-400" />
            )}
            Display
          </Card.Title>
          <Card.Description>Customize your viewing experience</Card.Description>
        </Card.Header>
        <Card.Content>
          <div className="flex items-center justify-between py-3">
            <div>
              <p className="font-medium text-gray-900 dark:text-gray-100">Dark Mode</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {isDarkMode ? 'Currently using dark theme' : 'Currently using light theme'}
              </p>
            </div>
            <ToggleSwitch
              enabled={isDarkMode}
              onChange={toggleDarkMode}
            />
          </div>
        </Card.Content>
      </Card>

      {/* Timezone */}
      <Card>
        <Card.Header>
          <Card.Title className="flex items-center gap-2">
            <Globe className="h-5 w-5 text-gray-500 dark:text-gray-400" />
            Regional
          </Card.Title>
          <Card.Description>Location and time settings</Card.Description>
        </Card.Header>
        <Card.Content>
          <div className="py-3">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Timezone
            </label>
            <select
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-gray-900 dark:focus:ring-gray-400 focus:border-transparent"
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
