import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Shield, Eye, Lock, AlertTriangle, Info } from 'lucide-react';
import { Button, Card, Toggle, Select, Input, Textarea } from '../common';
import { settingsService } from '../../services/settings.service';
import { toast } from 'react-toastify';

interface ProtectionSettings {
  default_protection_level: 'basic' | 'standard' | 'enhanced' | 'maximum';
  default_image_quality: number;
  enable_devtools_protection: boolean;
  max_image_requests_per_minute: number;
  suspicious_activity_threshold: number;
  enable_canvas_rendering: boolean;
  default_fragmentation_level: number;
  enable_overlay_protection: boolean;
  protection_warning_message: string;
}

export const ImageProtectionSettings: React.FC = () => {
  const { t } = useTranslation();
  const [settings, setSettings] = useState<ProtectionSettings>({
    default_protection_level: 'standard',
    default_image_quality: 85,
    enable_devtools_protection: true,
    max_image_requests_per_minute: 30,
    suspicious_activity_threshold: 10,
    enable_canvas_rendering: false,
    default_fragmentation_level: 3,
    enable_overlay_protection: true,
    protection_warning_message: 'Images in this gallery are protected from unauthorized download.'
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setIsLoading(true);
      const response = await settingsService.getSettings();
      
      // Map settings from API response
      const protectionSettings: ProtectionSettings = {
        default_protection_level: response.default_protection_level || 'standard',
        default_image_quality: parseInt(response.default_image_quality) || 85,
        enable_devtools_protection: response.enable_devtools_protection !== false,
        max_image_requests_per_minute: parseInt(response.max_image_requests_per_minute) || 30,
        suspicious_activity_threshold: parseInt(response.suspicious_activity_threshold) || 10,
        enable_canvas_rendering: response.enable_canvas_rendering === true,
        default_fragmentation_level: parseInt(response.default_fragmentation_level) || 3,
        enable_overlay_protection: response.enable_overlay_protection !== false,
        protection_warning_message: response.protection_warning_message || settings.protection_warning_message
      };
      
      setSettings(protectionSettings);
    } catch (error) {
      console.error('Failed to load protection settings:', error);
      toast.error('Failed to load protection settings');
    } finally {
      setIsLoading(false);
    }
  };

  const saveSettings = async () => {
    try {
      setIsSaving(true);
      
      // Convert settings to API format
      const apiSettings = Object.entries(settings).reduce((acc, [key, value]) => {
        acc[key] = typeof value === 'boolean' ? value : value.toString();
        return acc;
      }, {} as Record<string, string | boolean>);
      
      await settingsService.updateSettings(apiSettings);
      toast.success('Protection settings saved successfully');
    } catch (error) {
      console.error('Failed to save protection settings:', error);
      toast.error('Failed to save protection settings');
    } finally {
      setIsSaving(false);
    }
  };

  const updateSetting = (key: keyof ProtectionSettings, value: any) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const protectionLevels = [
    { value: 'basic', label: 'Basic - Minimal protection, best performance' },
    { value: 'standard', label: 'Standard - Balanced protection and performance' },
    { value: 'enhanced', label: 'Enhanced - Strong protection with good performance' },
    { value: 'maximum', label: 'Maximum - Strongest protection, may impact performance' }
  ];

  const getProtectionLevelIcon = (level: string) => {
    switch (level) {
      case 'basic': return <Eye className="w-4 h-4 text-green-500" />;
      case 'standard': return <Shield className="w-4 h-4 text-blue-500" />;
      case 'enhanced': return <Lock className="w-4 h-4 text-orange-500" />;
      case 'maximum': return <AlertTriangle className="w-4 h-4 text-red-500" />;
      default: return <Shield className="w-4 h-4 text-gray-500" />;
    }
  };

  const getProtectionLevelDescription = (level: string) => {
    switch (level) {
      case 'basic':
        return 'Prevents drag/drop and basic right-click. Good for public galleries.';
      case 'standard':
        return 'Adds keyboard shortcut blocking and user selection prevention.';
      case 'enhanced':
        return 'Includes DevTools detection, rate limiting, and overlay protection.';
      case 'maximum':
        return 'Canvas rendering, image fragmentation, and comprehensive monitoring.';
      default:
        return '';
    }
  };

  if (isLoading) {
    return (
      <Card className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded"></div>
          <div className="space-y-3">
            <div className="h-4 bg-gray-200 rounded"></div>
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <div className="flex items-center gap-3 mb-6">
          <Shield className="w-6 h-6 text-blue-500" />
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Image Protection Settings</h2>
            <p className="text-sm text-gray-600">Configure security measures for photo galleries</p>
          </div>
        </div>

        <div className="space-y-6">
          {/* Protection Level */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Default Protection Level
            </label>
            <Select
              value={settings.default_protection_level}
              onChange={(value) => updateSetting('default_protection_level', value as any)}
              options={protectionLevels}
              className="w-full"
            />
            <div className="mt-2 p-3 bg-gray-50 rounded-lg border border-gray-200">
              <div className="flex items-center gap-2 mb-1">
                {getProtectionLevelIcon(settings.default_protection_level)}
                <span className="font-medium text-sm capitalize">
                  {settings.default_protection_level} Protection
                </span>
              </div>
              <p className="text-sm text-gray-600">
                {getProtectionLevelDescription(settings.default_protection_level)}
              </p>
            </div>
          </div>

          {/* Image Quality */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Default Image Quality ({settings.default_image_quality}%)
            </label>
            <input
              type="range"
              min="30"
              max="100"
              step="5"
              value={settings.default_image_quality}
              onChange={(e) => updateSetting('default_image_quality', parseInt(e.target.value))}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>Lower quality = Better protection</span>
              <span>Higher quality = Better image</span>
            </div>
          </div>

          {/* DevTools Protection */}
          <div className="flex items-center justify-between">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                DevTools Protection
              </label>
              <p className="text-xs text-gray-500">
                Detect and respond to browser developer tools
              </p>
            </div>
            <Toggle
              checked={settings.enable_devtools_protection}
              onChange={(checked) => updateSetting('enable_devtools_protection', checked)}
            />
          </div>

          {/* Canvas Rendering */}
          <div className="flex items-center justify-between">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Canvas Rendering
              </label>
              <p className="text-xs text-gray-500">
                Render images on canvas instead of img tags (stronger protection)
              </p>
            </div>
            <Toggle
              checked={settings.enable_canvas_rendering}
              onChange={(checked) => updateSetting('enable_canvas_rendering', checked)}
            />
          </div>

          {/* Fragmentation Level */}
          {settings.enable_canvas_rendering && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Image Fragmentation Level ({settings.default_fragmentation_level})
              </label>
              <input
                type="range"
                min="1"
                max="5"
                step="1"
                value={settings.default_fragmentation_level}
                onChange={(e) => updateSetting('default_fragmentation_level', parseInt(e.target.value))}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>Low fragmentation</span>
                <span>High fragmentation</span>
              </div>
            </div>
          )}

          {/* Rate Limiting */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Max Requests Per Minute
              </label>
              <Input
                type="number"
                min="5"
                max="100"
                value={settings.max_image_requests_per_minute}
                onChange={(e) => updateSetting('max_image_requests_per_minute', parseInt(e.target.value))}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Suspicious Activity Threshold
              </label>
              <Input
                type="number"
                min="3"
                max="50"
                value={settings.suspicious_activity_threshold}
                onChange={(e) => updateSetting('suspicious_activity_threshold', parseInt(e.target.value))}
              />
            </div>
          </div>

          {/* Overlay Protection */}
          <div className="flex items-center justify-between">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Overlay Protection
              </label>
              <p className="text-xs text-gray-500">
                Add transparent overlays to prevent easy screenshot extraction
              </p>
            </div>
            <Toggle
              checked={settings.enable_overlay_protection}
              onChange={(checked) => updateSetting('enable_overlay_protection', checked)}
            />
          </div>

          {/* Warning Message */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Protection Warning Message
            </label>
            <Textarea
              value={settings.protection_warning_message}
              onChange={(e) => updateSetting('protection_warning_message', e.target.value)}
              placeholder="Message shown when protection is triggered"
              rows={3}
            />
          </div>
        </div>

        {/* Warning Box */}
        <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-amber-600 mt-0.5" />
            <div>
              <h4 className="font-medium text-amber-800 mb-1">Important Notes</h4>
              <ul className="text-sm text-amber-700 space-y-1">
                <li>• Higher protection levels may impact page performance</li>
                <li>• Canvas rendering disables browser image caching</li>
                <li>• Maximum protection may cause accessibility issues</li>
                <li>• Test thoroughly with your target browsers</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mt-6 flex justify-end gap-3">
          <Button
            variant="outline"
            onClick={loadSettings}
            disabled={isSaving}
          >
            Reset
          </Button>
          <Button
            variant="primary"
            onClick={saveSettings}
            loading={isSaving}
          >
            Save Settings
          </Button>
        </div>
      </Card>
    </div>
  );
};