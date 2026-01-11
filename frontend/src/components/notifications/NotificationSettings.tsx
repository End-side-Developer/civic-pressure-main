import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Bell,
  MessageSquare,
  ThumbsUp,
  Calendar,
  Save,
  Loader2,
  CheckCircle,
  AlertCircle,
} from 'lucide-react';
import { useNotifications, NotificationSettings as NotificationSettingsType } from '../../context/NotificationsContext';

interface NotificationSettingsProps {
  onBack: () => void;
}

interface SettingItemProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  enabled: boolean;
  onChange: (enabled: boolean) => void;
  disabled?: boolean;
}

const SettingItem: React.FC<SettingItemProps> = ({
  icon,
  title,
  description,
  enabled,
  onChange,
  disabled = false,
}) => (
  <div className={`flex items-center justify-between p-4 ${disabled ? 'opacity-50' : ''}`}>
    <div className="flex items-start gap-4">
      <div className="p-2 bg-gray-100 dark:bg-gray-700 rounded-lg">
        {icon}
      </div>
      <div>
        <h3 className="font-medium text-gray-900 dark:text-white">{title}</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{description}</p>
      </div>
    </div>
    <label className="relative inline-flex items-center cursor-pointer">
      <input
        type="checkbox"
        className="sr-only peer"
        checked={enabled}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
      />
      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-600 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
    </label>
  </div>
);

const NotificationSettings: React.FC<NotificationSettingsProps> = ({ onBack }) => {
  const { settings, loading, fetchSettings, updateSettings } = useNotifications();
  
  const [localSettings, setLocalSettings] = useState<NotificationSettingsType>({
    complaintUpdates: true,
    voteNotifications: true,
    weeklyDigest: false,
  });
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');

  // Load settings on mount
  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  // Update local settings when fetched settings change
  useEffect(() => {
    if (settings) {
      setLocalSettings(settings);
    }
  }, [settings]);

  const handleSettingChange = (key: keyof NotificationSettingsType, value: boolean) => {
    setLocalSettings((prev) => ({
      ...prev,
      [key]: value,
    }));
    setSaveStatus('idle');
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveStatus('idle');
    try {
      await updateSettings(localSettings);
      setSaveStatus('success');
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch (error) {
      console.error('Failed to save settings:', error);
      setSaveStatus('error');
    } finally {
      setSaving(false);
    }
  };

  const hasChanges = settings && (
    settings.complaintUpdates !== localSettings.complaintUpdates ||
    settings.voteNotifications !== localSettings.voteNotifications ||
    settings.weeklyDigest !== localSettings.weeklyDigest
  );

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto px-6 py-8 max-w-2xl">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <button
            onClick={onBack}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Notification Settings</h1>
            <p className="text-gray-500 dark:text-gray-400">Manage how you receive notifications</p>
          </div>
        </div>

        {loading && !settings ? (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-12 text-center">
            <div className="animate-spin w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
            <p className="text-gray-500 dark:text-gray-400">Loading settings...</p>
          </div>
        ) : (
          <>
            {/* Notification Types */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm mb-6 overflow-hidden">
              <div className="px-4 py-3 bg-gray-50 dark:bg-gray-700/50 border-b border-gray-100 dark:border-gray-700">
                <h2 className="font-semibold text-gray-900 dark:text-white">Notification Types</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">Choose what notifications you want to receive</p>
              </div>
              <div className="divide-y divide-gray-100 dark:divide-gray-700">
                <SettingItem
                  icon={<MessageSquare className="w-5 h-5 text-orange-500" />}
                  title="Complaint Updates"
                  description="Get notified when your complaints receive updates or status changes"
                  enabled={localSettings.complaintUpdates}
                  onChange={(v) => handleSettingChange('complaintUpdates', v)}
                />
                <SettingItem
                  icon={<ThumbsUp className="w-5 h-5 text-blue-500" />}
                  title="Vote Notifications"
                  description="Get notified when someone votes on your complaints"
                  enabled={localSettings.voteNotifications}
                  onChange={(v) => handleSettingChange('voteNotifications', v)}
                />
                <SettingItem
                  icon={<Calendar className="w-5 h-5 text-green-500" />}
                  title="Weekly Digest"
                  description="Receive a weekly summary of activity on your complaints"
                  enabled={localSettings.weeklyDigest}
                  onChange={(v) => handleSettingChange('weeklyDigest', v)}
                />
              </div>
            </div>

            {/* Save Button */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {saveStatus === 'success' && (
                  <>
                    <CheckCircle className="w-5 h-5 text-green-500" />
                    <span className="text-green-600 dark:text-green-400 text-sm">Settings saved successfully</span>
                  </>
                )}
                {saveStatus === 'error' && (
                  <>
                    <AlertCircle className="w-5 h-5 text-red-500" />
                    <span className="text-red-600 dark:text-red-400 text-sm">Failed to save settings</span>
                  </>
                )}
              </div>
              <button
                onClick={handleSave}
                disabled={saving || !hasChanges}
                className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-lg transition font-medium"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    Save Changes
                  </>
                )}
              </button>
            </div>

            {/* Info Box */}
            <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800">
              <div className="flex items-start gap-3">
                <Bell className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-medium text-blue-900 dark:text-blue-300">About Notifications</h3>
                  <p className="text-sm text-blue-700 dark:text-blue-400 mt-1">
                    In-app notifications appear in the notification bell when you're logged in. 
                    You can choose which types of updates you want to receive.
                  </p>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default NotificationSettings;
