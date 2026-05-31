/**
 * Settings Page — Study Hall.
 * Borderless preference groups under hairline-ruled Sections. Tokens only,
 * full dark mode, accessible toggle + select. Logic/persistence preserved.
 */
import { useState, useEffect } from 'react';
import { Moon, Globe, Save, Sun, Check } from 'lucide-react';
import { Button, PageHeader, Section } from '../../components/ui';
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

  const ToggleSwitch = ({ enabled, onChange, label }) => (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      aria-label={label}
      onClick={onChange}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${
        enabled ? 'bg-brand-600' : 'bg-surface-muted'
      }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-surface-card shadow-sm transition-transform ${
          enabled ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  );

  return (
    <div className="mx-auto max-w-2xl pb-8">
      <PageHeader
        eyebrow="Your account"
        title="Settings"
        subtitle="Manage your preferences and how Study Hall looks and feels."
      />

      {success && (
        <div
          role="alert"
          className="mb-6 flex items-center gap-2 rounded-xl bg-accent-50 px-4 py-3 text-sm font-medium text-accent-700 dark:bg-accent-500/10 dark:text-accent-300"
        >
          <Check className="h-4 w-4 shrink-0" />
          {success}
        </div>
      )}

      <div className="space-y-10">
        {/* Display */}
        <Section title="Display" icon={isDarkMode ? Moon : Sun} hint="Customize your viewing experience">
          <div className="flex items-center justify-between gap-4 py-2">
            <div className="min-w-0">
              <p className="font-medium text-ink-body">Dark Mode</p>
              <p className="mt-0.5 text-sm text-ink-subtle">
                {isDarkMode ? 'Currently using dark theme' : 'Currently using light theme'}
              </p>
            </div>
            <ToggleSwitch
              enabled={isDarkMode}
              onChange={toggleDarkMode}
              label="Toggle dark mode"
            />
          </div>
        </Section>

        {/* Regional */}
        <Section title="Regional" icon={Globe} hint="Location and time settings">
          <div className="py-2">
            <label
              htmlFor="timezone-select"
              className="mb-1.5 block text-sm font-medium text-ink-muted"
            >
              Timezone
            </label>
            <select
              id="timezone-select"
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              className="w-full rounded-xl bg-surface-input px-3.5 py-2.5 text-sm text-ink-body transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
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
        </Section>

        {/* Save Button */}
        <div className="flex justify-end">
          <Button variant="primary" onClick={handleSave} disabled={isSaving}>
            <Save className="h-4 w-4" />
            {isSaving ? 'Saving...' : 'Save Settings'}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
