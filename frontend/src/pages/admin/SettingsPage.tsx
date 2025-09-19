import React, { useState } from 'react';
import { 
  Save, 
  Database,
  Globe,
  Key,
  AlertCircle,
  Image,
  Server,
  CheckCircle,
  Clock,
  HardDrive,
  Activity
} from 'lucide-react';
import { toast } from 'react-toastify';

import { Button, Card, Input, Loading } from '../../components/common';
import { CategoryManager } from '../../components/admin/CategoryManager';
import { WordFilterManager } from '../../components/admin/WordFilterManager';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { settingsService } from '../../services/settings.service';
import { useTranslation } from 'react-i18next';

const BYTES_PER_GB = 1024 * 1024 * 1024;

export const SettingsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'general' | 'status' | 'security' | 'categories' | 'analytics' | 'moderation'>('general');
  const queryClient = useQueryClient();
  const { t, i18n } = useTranslation();

  // Fetch settings
  const { data: settings, isLoading } = useQuery({
    queryKey: ['admin-settings'],
    queryFn: () => settingsService.getAllSettings(),
  });

  // Fetch storage info
  const { data: storageInfo } = useQuery({
    queryKey: ['admin-storage-info'],
    queryFn: () => settingsService.getStorageInfo(),
    enabled: activeTab === 'status'
  });

  // Fetch system status
  const { data: systemStatus } = useQuery({
    queryKey: ['system-status'],
    queryFn: () => settingsService.getSystemStatus(),
    enabled: activeTab === 'status',
    refetchInterval: 30000 // Refresh every 30 seconds
  });

  // General settings state
  const [generalSettings, setGeneralSettings] = useState({
    site_url: '',
    default_expiration_days: 30,
    max_file_size_mb: 50,
    allowed_file_types: 'jpg,jpeg,png,gif,webp',
    enable_watermark: false,
    enable_analytics: true,
    enable_registration: false,
    maintenance_mode: false,
    default_language: 'en',
    date_format: { format: 'dd/MM/yyyy', locale: 'en-GB' }
  });

  // Security settings state
  const [securitySettings, setSecuritySettings] = useState({
    require_password: true,
    password_min_length: 8,
    password_complexity: 'moderate',
    enable_2fa: false,
    session_timeout_minutes: 60,
    max_login_attempts: 5,
    enable_recaptcha: false,
    recaptcha_site_key: '',
    recaptcha_secret_key: ''
  });

  // Analytics settings state
  const [analyticsSettings, setAnalyticsSettings] = useState({
    umami_enabled: false,
    umami_url: '',
    umami_website_id: '',
    umami_share_url: ''
  });

  const [softLimitGb, setSoftLimitGb] = useState<number | ''>('');
  const [softLimitDirty, setSoftLimitDirty] = useState(false);
  const [capacityOverrideGb, setCapacityOverrideGb] = useState<number | ''>('');
  const [availableOverrideGb, setAvailableOverrideGb] = useState<number | ''>('');
  const [overrideDirty, setOverrideDirty] = useState(false);

  React.useEffect(() => {
    if (settings) {
      // Set the language if it's different from current
      if (settings.general_default_language && settings.general_default_language !== i18n.language) {
        i18n.changeLanguage(settings.general_default_language);
      }
      
      // Extract general settings
      setGeneralSettings({
        site_url: settings.general_site_url || '',
        default_expiration_days: settings.general_default_expiration_days || 30,
        max_file_size_mb: settings.general_max_file_size_mb || 50,
        allowed_file_types: settings.general_allowed_file_types || 'jpg,jpeg,png,gif,webp',
        enable_watermark: settings.general_enable_watermark || false,
        enable_analytics: settings.general_enable_analytics || true,
        enable_registration: settings.general_enable_registration || false,
        maintenance_mode: settings.general_maintenance_mode || false,
        default_language: settings.general_default_language || 'en',
        date_format: settings.general_date_format 
          ? (typeof settings.general_date_format === 'string'
              ? { format: settings.general_date_format, locale: settings.general_date_format.includes('MM/dd') ? 'en-US' : 'en-GB' }
              : settings.general_date_format)
          : { format: 'dd/MM/yyyy', locale: 'en-GB' }
      });

      // Extract security settings
      setSecuritySettings({
        require_password: settings.security_require_password ?? true,
        password_min_length: settings.security_password_min_length ?? 8,
        password_complexity: settings.security_password_complexity ?? 'moderate',
        enable_2fa: settings.security_enable_2fa ?? false,
        session_timeout_minutes: settings.security_session_timeout_minutes ?? 60,
        max_login_attempts: settings.security_max_login_attempts ?? 5,
        enable_recaptcha: settings.security_enable_recaptcha ?? false,
        recaptcha_site_key: settings.security_recaptcha_site_key ?? '',
        recaptcha_secret_key: settings.security_recaptcha_secret_key ?? ''
      });

      // Extract analytics settings
      setAnalyticsSettings({
        umami_enabled: settings.analytics_umami_enabled || false,
        umami_url: settings.analytics_umami_url || '',
        umami_website_id: settings.analytics_umami_website_id || '',
        umami_share_url: settings.analytics_umami_share_url || ''
      });
    }
  }, [settings, i18n]);

  React.useEffect(() => {
    if (!settings || overrideDirty) {
      return;
    }

    const capacityOverrideBytes = settings.general_storage_capacity_override_bytes ?? null;
    const availableOverrideBytes = settings.general_storage_available_override_bytes ?? null;

    setCapacityOverrideGb(
      capacityOverrideBytes != null
        ? Number((capacityOverrideBytes / BYTES_PER_GB).toFixed(2))
        : ''
    );

    setAvailableOverrideGb(
      availableOverrideBytes != null
        ? Number((availableOverrideBytes / BYTES_PER_GB).toFixed(2))
        : ''
    );
  }, [settings, overrideDirty]);

  React.useEffect(() => {
    if (!storageInfo) {
      return;
    }

    if (softLimitDirty) {
      return;
    }

    const currentLimit = storageInfo.configured_soft_limit ?? storageInfo.storage_soft_limit ?? null;

    if (currentLimit === null || currentLimit === undefined) {
      setSoftLimitGb('');
      return;
    }

    const limitGb = Number((currentLimit / BYTES_PER_GB).toFixed(2));
    setSoftLimitGb(limitGb);
  }, [storageInfo, softLimitDirty]);

  React.useEffect(() => {
    if (!storageInfo || overrideDirty) {
      return;
    }

    if (storageInfo.disk_override_source === 'env') {
      setCapacityOverrideGb(
        storageInfo.disk_total
          ? Number((storageInfo.disk_total / BYTES_PER_GB).toFixed(2))
          : ''
      );
      setAvailableOverrideGb(
        storageInfo.disk_available
          ? Number((storageInfo.disk_available / BYTES_PER_GB).toFixed(2))
          : ''
      );
    }
  }, [storageInfo, overrideDirty]);

  // Save mutations
  const saveGeneralMutation = useMutation({
    mutationFn: async () => {
      // Convert to the format expected by the API
      const settingsData: Record<string, any> = {};
      Object.entries(generalSettings).forEach(([key, value]) => {
        // Special handling for date_format - only send the format string
        if (key === 'date_format' && typeof value === 'object' && value.format) {
          settingsData[`general_${key}`] = value.format;
        } else {
          settingsData[`general_${key}`] = value;
        }
      });
      return settingsService.updateSettings(settingsData);
    },
    onSuccess: () => {
      toast.success(t('toast.settingsSaved'));
      queryClient.invalidateQueries({ queryKey: ['admin-settings'] });
    },
    onError: () => {
      toast.error(t('toast.saveError'));
    }
  });

  const saveSecurityMutation = useMutation({
    mutationFn: async () => {
      // Convert to the format expected by the API
      const settingsData: Record<string, any> = {};
      Object.entries(securitySettings).forEach(([key, value]) => {
        settingsData[`security_${key}`] = value;
      });
      return settingsService.updateSettings(settingsData);
    },
    onSuccess: () => {
      toast.success(t('toast.settingsSaved'));
      queryClient.invalidateQueries({ queryKey: ['admin-settings'] });
    },
    onError: () => {
      toast.error(t('toast.saveError'));
    }
  });

  const saveAnalyticsMutation = useMutation({
    mutationFn: async () => {
      // Convert to the format expected by the API
      const settingsData: Record<string, any> = {};
      Object.entries(analyticsSettings).forEach(([key, value]) => {
        settingsData[`analytics_${key}`] = value;
      });
      return settingsService.updateSettings(settingsData);
    },
    onSuccess: () => {
      toast.success(t('toast.settingsSaved'));
      queryClient.invalidateQueries({ queryKey: ['admin-settings'] });
    },
    onError: () => {
      toast.error(t('toast.saveError'));
    }
  });

  const saveSoftLimitMutation = useMutation({
    mutationFn: async (limitBytes: number | null) => {
      return settingsService.updateSettings({
        general_storage_soft_limit_bytes: limitBytes,
      });
    },
    onSuccess: () => {
      toast.success(t('toast.settingsSaved'));
      setSoftLimitDirty(false);
      queryClient.invalidateQueries({ queryKey: ['admin-settings'] });
      queryClient.invalidateQueries({ queryKey: ['admin-storage-info'] });
      queryClient.invalidateQueries({ queryKey: ['storage-info'] });
    },
    onError: () => {
      toast.error(t('toast.saveError'));
    }
  });

  const handleSaveSoftLimit = () => {
    if (saveSoftLimitMutation.isPending) {
      return;
    }

    if (softLimitGb === '') {
      saveSoftLimitMutation.mutate(null);
      return;
    }

    const numericValue = Number(softLimitGb);

    if (!Number.isFinite(numericValue) || numericValue < 0) {
      toast.error(t('settings.storage.invalidSoftLimit'));
      return;
    }

    const limitBytes = Math.max(0, Math.round(numericValue * BYTES_PER_GB));
    saveSoftLimitMutation.mutate(limitBytes);
  };

  const saveCapacityOverrideMutation = useMutation({
    mutationFn: async (payload: { capacity: number | null; available: number | null }) => {
      return settingsService.updateSettings({
        general_storage_capacity_override_bytes: payload.capacity,
        general_storage_available_override_bytes: payload.available,
      });
    },
    onSuccess: () => {
      toast.success(t('toast.settingsSaved'));
      setOverrideDirty(false);
      queryClient.invalidateQueries({ queryKey: ['admin-settings'] });
      queryClient.invalidateQueries({ queryKey: ['admin-storage-info'] });
      queryClient.invalidateQueries({ queryKey: ['storage-info'] });
    },
    onError: () => {
      toast.error(t('toast.saveError'));
    }
  });

  const handleSaveCapacityOverride = () => {
    if (saveCapacityOverrideMutation.isPending) {
      return;
    }

    if (capacityOverrideGb === '' && availableOverrideGb !== '') {
      toast.error(t('settings.storage.capacityRequiredForAvailable'));
      return;
    }

    const capacityValue = capacityOverrideGb === '' ? null : Number(capacityOverrideGb);
    const availableValue = availableOverrideGb === '' ? null : Number(availableOverrideGb);

    if ((capacityValue !== null && !Number.isFinite(capacityValue)) || (availableValue !== null && !Number.isFinite(availableValue))) {
      toast.error(t('settings.storage.invalidSoftLimit'));
      return;
    }

    if (capacityValue !== null && capacityValue < 0) {
      toast.error(t('settings.storage.invalidSoftLimit'));
      return;
    }

    if (availableValue !== null && availableValue < 0) {
      toast.error(t('settings.storage.invalidSoftLimit'));
      return;
    }

    const capacityBytes = capacityValue === null ? null : Math.max(0, Math.round(capacityValue * BYTES_PER_GB));
    const availableBytes = availableValue === null ? null : Math.max(0, Math.round(availableValue * BYTES_PER_GB));

    if (capacityBytes !== null && availableBytes !== null && availableBytes > capacityBytes) {
      toast.error(t('settings.storage.availableExceedsCapacity'));
      return;
    }

    saveCapacityOverrideMutation.mutate({ capacity: capacityBytes, available: availableBytes });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loading size="lg" text={t('settings.loadingSettings')} />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-neutral-900">{t('settings.title')}</h1>
        <p className="text-neutral-600 mt-1">{t('settings.subtitle')}</p>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-neutral-200 mb-6">
        <nav className="-mb-px flex gap-6">
          <button
            onClick={() => setActiveTab('general')}
            className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'general'
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-neutral-500 hover:text-neutral-700'
            }`}
          >
            {t('settings.general.title')}
          </button>
          <button
            onClick={() => setActiveTab('status')}
            className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'status'
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-neutral-500 hover:text-neutral-700'
            }`}
          >
            {t('settings.systemStatus.title')}
          </button>
          <button
            onClick={() => setActiveTab('security')}
            className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'security'
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-neutral-500 hover:text-neutral-700'
            }`}
          >
            {t('settings.security.title')}
          </button>
          <button
            onClick={() => setActiveTab('categories')}
            className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'categories'
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-neutral-500 hover:text-neutral-700'
            }`}
          >
            {t('settings.categories.title')}
          </button>
          <button
            onClick={() => setActiveTab('analytics')}
            className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'analytics'
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-neutral-500 hover:text-neutral-700'
            }`}
          >
            {t('settings.analytics.title')}
          </button>
          <button
            onClick={() => setActiveTab('moderation')}
            className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'moderation'
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-neutral-500 hover:text-neutral-700'
            }`}
          >
            {t('settings.moderation.title', 'Moderation')}
          </button>
        </nav>
      </div>

      {/* General Settings Tab */}
      {activeTab === 'general' && (
        <div className="space-y-6">
          <Card padding="md">
            <h2 className="text-lg font-semibold text-neutral-900 mb-4">{t('settings.general.siteConfiguration')}</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">
                  {t('settings.general.siteUrl')}
                </label>
                <Input
                  type="url"
                  value={generalSettings.site_url}
                  onChange={(e) => setGeneralSettings(prev => ({ ...prev, site_url: e.target.value }))}
                  placeholder="https://yourdomain.com"
                  leftIcon={<Globe className="w-5 h-5 text-neutral-400" />}
                />
                <p className="text-xs text-neutral-500 mt-1">
                  {t('settings.general.siteUrlHelp')}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">
                    {t('settings.general.defaultExpiration')}
                  </label>
                  <Input
                    type="number"
                    value={generalSettings.default_expiration_days}
                    onChange={(e) => setGeneralSettings(prev => ({ ...prev, default_expiration_days: parseInt(e.target.value) || 30 }))}
                    min="1"
                    max="365"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">
                    {t('settings.general.maxFileSize')}
                  </label>
                  <Input
                    type="number"
                    value={generalSettings.max_file_size_mb}
                    onChange={(e) => setGeneralSettings(prev => ({ ...prev, max_file_size_mb: parseInt(e.target.value) || 50 }))}
                    min="1"
                    max="500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">
                  {t('settings.general.allowedFileTypes')}
                </label>
                <Input
                  type="text"
                  value={generalSettings.allowed_file_types}
                  onChange={(e) => setGeneralSettings(prev => ({ ...prev, allowed_file_types: e.target.value }))}
                  placeholder="jpg,jpeg,png,gif"
                />
                <p className="text-xs text-neutral-500 mt-1">
                  {t('settings.general.allowedFileTypesHelp')}
                </p>
              </div>
            </div>
          </Card>

          <Card padding="md">
            <h2 className="text-lg font-semibold text-neutral-900 mb-4">{t('settings.general.featureToggles')}</h2>
            
            <div className="space-y-3">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={generalSettings.enable_watermark}
                  onChange={(e) => setGeneralSettings(prev => ({ ...prev, enable_watermark: e.target.checked }))}
                  className="w-4 h-4 text-primary-600 rounded focus:ring-primary-500"
                />
                <span className="ml-2 text-sm text-neutral-700">{t('settings.general.enableWatermark')}</span>
              </label>

              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={generalSettings.enable_analytics}
                  onChange={(e) => setGeneralSettings(prev => ({ ...prev, enable_analytics: e.target.checked }))}
                  className="w-4 h-4 text-primary-600 rounded focus:ring-primary-500"
                />
                <span className="ml-2 text-sm text-neutral-700">{t('settings.general.enableAnalytics')}</span>
              </label>

              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={generalSettings.enable_registration}
                  onChange={(e) => setGeneralSettings(prev => ({ ...prev, enable_registration: e.target.checked }))}
                  className="w-4 h-4 text-primary-600 rounded focus:ring-primary-500"
                />
                <span className="ml-2 text-sm text-neutral-700">{t('settings.general.enableRegistration')}</span>
              </label>

              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={generalSettings.maintenance_mode}
                  onChange={(e) => setGeneralSettings(prev => ({ ...prev, maintenance_mode: e.target.checked }))}
                  className="w-4 h-4 text-primary-600 rounded focus:ring-primary-500"
                />
                <span className="ml-2 text-sm text-neutral-700">{t('settings.general.maintenanceMode')}</span>
              </label>
            </div>
          </Card>

          <Card padding="md">
            <h2 className="text-lg font-semibold text-neutral-900 mb-4">{t('settings.general.language')}</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  {t('settings.general.language')}
                </label>
                <select
                  value={generalSettings.default_language}
                  onChange={(e) => setGeneralSettings(prev => ({ ...prev, default_language: e.target.value }))}
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                >
                  <option value="en">English</option>
                  <option value="de">Deutsch</option>
                </select>
                <p className="text-xs text-neutral-500 mt-1">
                  {t('settings.general.defaultLanguageHelp')}
                </p>
              </div>
            </div>
          </Card>

          <Card padding="md">
            <h2 className="text-lg font-semibold text-neutral-900 mb-4">{t('settings.general.dateTimeFormat')}</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  {t('settings.general.dateFormat')}
                </label>
                <select
                  value={generalSettings.date_format?.format || 'dd/MM/yyyy'}
                  onChange={(e) => {
                    const format = e.target.value;
                    const locale = format === 'MM/dd/yyyy' ? 'en-US' : 'en-GB';
                    setGeneralSettings(prev => ({ 
                      ...prev, 
                      date_format: { format, locale }
                    }));
                  }}
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                >
                  <option value="dd/MM/yyyy">DD/MM/YYYY (European)</option>
                  <option value="MM/dd/yyyy">MM/DD/YYYY (US)</option>
                  <option value="yyyy-MM-dd">YYYY-MM-DD (ISO)</option>
                  <option value="dd.MM.yyyy">DD.MM.YYYY (German)</option>
                </select>
                <p className="text-xs text-neutral-500 mt-1">
                  {t('settings.general.dateFormatHelp')}
                </p>
              </div>
            </div>

            <div className="mt-6">
              <Button
                variant="primary"
                onClick={() => saveGeneralMutation.mutate()}
                isLoading={saveGeneralMutation.isPending}
                leftIcon={<Save className="w-5 h-5" />}
              >
                {t('settings.general.saveGeneralSettings')}
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* System Status Tab */}
      {activeTab === 'status' && (
        <div className="space-y-6">
          {/* Storage Overview */}
          {storageInfo && (() => {
            const configuredSoftLimit = storageInfo.configured_soft_limit ?? null;
            const effectiveSoftLimit = storageInfo.storage_soft_limit || storageInfo.storage_limit || storageInfo.recommended_soft_limit || 1;
            const safeEffectiveSoftLimit = Math.max(effectiveSoftLimit, 1);
            const usageRatio = storageInfo.total_used / safeEffectiveSoftLimit;
            const usagePercentage = Math.round(usageRatio * 100);
            const usageWidth = Math.min(usageRatio * 100, 100);
            const overSoftLimit = configuredSoftLimit != null
              ? storageInfo.total_used >= configuredSoftLimit
              : usagePercentage >= 100;
            const limitDisplayBytes = configuredSoftLimit ?? storageInfo.storage_soft_limit ?? storageInfo.storage_limit ?? null;
            const limitDisplay = limitDisplayBytes != null
              ? settingsService.formatBytes(limitDisplayBytes)
              : t('settings.storage.unlimited');
            const diskCapacityBytes = storageInfo.disk_total ?? storageInfo.disk_total_raw ?? null;
            const diskAvailableBytes = storageInfo.disk_available ?? storageInfo.disk_available_raw ?? null;
            const diskFreeBytes = storageInfo.disk_free ?? storageInfo.disk_free_raw ?? null;

            const diskCapacityDisplay = diskCapacityBytes != null
              ? settingsService.formatBytes(diskCapacityBytes)
              : null;
            const diskAvailableDisplay = diskAvailableBytes != null
              ? settingsService.formatBytes(diskAvailableBytes)
              : null;
            const diskFreeDisplay = diskFreeBytes != null
              ? settingsService.formatBytes(diskFreeBytes)
              : null;

            const recommendedDisplay = storageInfo.recommended_soft_limit != null
              ? settingsService.formatBytes(storageInfo.recommended_soft_limit)
              : null;
            const progressColor = overSoftLimit
              ? 'bg-red-600'
              : usagePercentage >= 90
                ? 'bg-amber-500'
                : 'bg-primary-600';
            const limitCardClass = overSoftLimit ? 'bg-amber-50 border border-amber-200' : 'bg-neutral-50';
            const limitValueClass = overSoftLimit ? 'text-amber-700' : 'text-neutral-900';
            const limitDescriptorClass = overSoftLimit ? 'text-amber-700 font-semibold' : 'text-neutral-600';
            const recommendedDescriptorValue = (recommendedDisplay ?? limitDisplay);
            const diskMetricsReliable = storageInfo.disk_metrics_reliable;
            const overrideSource = storageInfo.disk_override_source;
            const overrideControlled = overrideSource === 'env';

            const diskSummaryCards: Array<{ label: string; value: string }> = [];
            if (diskCapacityDisplay && (diskMetricsReliable || overrideSource)) {
              const label = storageInfo.disk_total != null
                ? t('settings.storage.diskCapacity')
                : t('settings.storage.diskCapacityReported');
              diskSummaryCards.push({ label, value: diskCapacityDisplay });
            }
            if (diskAvailableDisplay && (diskMetricsReliable || overrideSource)) {
              const label = storageInfo.disk_available != null
                ? t('settings.storage.diskAvailable')
                : t('settings.storage.diskAvailableReported');
              diskSummaryCards.push({ label, value: diskAvailableDisplay });
            }
            if (diskFreeDisplay && storageInfo.disk_free == null && (diskMetricsReliable || overrideSource)) {
              diskSummaryCards.push({
                label: t('settings.storage.diskFreeReported'),
                value: diskFreeDisplay
              });
            }
            if (recommendedDisplay) {
              diskSummaryCards.push({
                label: t('settings.storage.recommendedSoftLimit'),
                value: recommendedDisplay
              });
            }

            return (
              <Card padding="md">
                <h2 className="text-lg font-semibold text-neutral-900 mb-4 flex items-center gap-2">
                  <HardDrive className="w-5 h-5" />
                  {t('settings.systemStatus.storageOverview')}
                </h2>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  <div className="bg-neutral-50 rounded-lg p-4">
                    <p className="text-sm text-neutral-600">{t('settings.storage.totalUsed')}</p>
                    <p className="text-2xl font-bold text-neutral-900">
                      {settingsService.formatBytes(storageInfo.total_used)}
                    </p>
                  </div>
                  <div className="bg-neutral-50 rounded-lg p-4">
                    <p className="text-sm text-neutral-600">{t('settings.storage.archiveStorage')}</p>
                    <p className="text-2xl font-bold text-neutral-900">
                      {settingsService.formatBytes(storageInfo.archive_storage)}
                    </p>
                  </div>
                  <div className={`rounded-lg p-4 ${limitCardClass}`}>
                    <p className="text-sm text-neutral-600">{t('settings.storage.storageLimit')}</p>
                    <p className={`text-2xl font-bold ${limitValueClass}`}>
                      {limitDisplay}
                    </p>
                    <p className={`text-xs mt-1 ${limitDescriptorClass}`}>
                      {storageInfo.soft_limit_configured
                        ? t('admin.storageSoftLimitConfigured', { limit: limitDisplay })
                        : t('admin.storageSoftLimitRecommended', { limit: recommendedDescriptorValue })}
                    </p>
                  </div>
                </div>

                <div className="mb-4">
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-neutral-600">{t('settings.storage.storageUsage')}</span>
                    <span className={`font-medium ${overSoftLimit ? 'text-red-600' : 'text-neutral-900'}`}>
                      {usagePercentage}%
                    </span>
                  </div>
                  <div className="w-full bg-neutral-200 rounded-full h-3">
                    <div
                      className={`${progressColor} h-3 rounded-full transition-all`}
                      style={{ width: `${usageWidth}%` }}
                    />
                  </div>
                </div>

                <div className="border-t border-neutral-200 pt-4 mt-6 space-y-4">
                  <p className="text-sm text-neutral-600">
                    {t('settings.storage.storageLimitHelper')}
                  </p>

                  {diskSummaryCards.length > 0 && (diskMetricsReliable || overrideSource) && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {diskSummaryCards.map((card) => (
                        <div key={card.label} className="bg-neutral-50 rounded-lg p-4">
                          <p className="text-xs text-neutral-500 uppercase tracking-wide">{card.label}</p>
                          <p className="text-lg font-semibold text-neutral-900 mt-1">{card.value}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {!diskMetricsReliable && !overrideSource && (
                    <p className="text-xs text-neutral-500">
                      {t('settings.storage.diskMetricsUnavailable')}
                    </p>
                  )}

                  <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr)]">
                    <Input
                      type="number"
                      inputMode="decimal"
                      min={0}
                      step="0.1"
                      value={softLimitGb === '' ? '' : softLimitGb}
                      onChange={(e) => {
                        const value = e.target.value;
                        setSoftLimitDirty(true);
                        if (value === '') {
                          setSoftLimitGb('');
                          return;
                        }
                        const numeric = Number(value);
                        if (Number.isNaN(numeric)) {
                          return;
                        }
                        setSoftLimitGb(numeric);
                      }}
                      label={t('settings.storage.softLimitInputLabel')}
                      helperText={t('settings.storage.softLimitHelper')}
                      rightIcon={<span className="text-xs font-semibold text-neutral-500 uppercase">GB</span>}
                    />
                    <p className="text-xs text-neutral-500">
                      {t('settings.storage.limitNotEnforced')}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        if (storageInfo.recommended_soft_limit != null) {
                          const value = Number((storageInfo.recommended_soft_limit / BYTES_PER_GB).toFixed(2));
                          setSoftLimitGb(value);
                          setSoftLimitDirty(true);
                        }
                      }}
                      disabled={storageInfo.recommended_soft_limit == null}
                    >
                      {t('settings.storage.applyRecommended')}
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        if (storageInfo.disk_available != null) {
                          const value = Number((storageInfo.disk_available / BYTES_PER_GB).toFixed(2));
                          setSoftLimitGb(value);
                          setSoftLimitDirty(true);
                        }
                      }}
                      disabled={storageInfo.disk_available == null}
                    >
                      {t('settings.storage.applyAvailable')}
                    </Button>
                  </div>

                  <div className="flex justify-end">
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={handleSaveSoftLimit}
                      isLoading={saveSoftLimitMutation.isPending}
                      leftIcon={<Save className="w-4 h-4" />}
                    >
                      {t('settings.storage.saveSoftLimit')}
                    </Button>
                  </div>

                  <div className="border-t border-neutral-200 pt-4 mt-6 space-y-4">
                    <div>
                      <p className="text-sm font-medium text-neutral-700">{t('settings.storage.overrideTitle')}</p>
                      {overrideControlled ? (
                        <p className="text-xs text-neutral-500 mt-1">{t('settings.storage.diskOverrideEnvNote')}</p>
                      ) : (
                        <p className="text-xs text-neutral-500 mt-1">{t('settings.storage.diskOverrideSettingsHelp')}</p>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <Input
                        type="number"
                        inputMode="decimal"
                        min={0}
                        step="0.1"
                        value={capacityOverrideGb === '' ? '' : capacityOverrideGb}
                        onChange={(e) => {
                          const value = e.target.value;
                          setOverrideDirty(true);
                          if (value === '') {
                            setCapacityOverrideGb('');
                            return;
                          }
                          const numeric = Number(value);
                          if (Number.isNaN(numeric)) {
                            return;
                          }
                          setCapacityOverrideGb(numeric);
                        }}
                        label={t('settings.storage.overrideCapacityLabel')}
                        helperText={t('settings.storage.overrideCapacityHelper')}
                        rightIcon={<span className="text-xs font-semibold text-neutral-500 uppercase">GB</span>}
                        disabled={overrideControlled}
                      />
                      <Input
                        type="number"
                        inputMode="decimal"
                        min={0}
                        step="0.1"
                        value={availableOverrideGb === '' ? '' : availableOverrideGb}
                        onChange={(e) => {
                          const value = e.target.value;
                          setOverrideDirty(true);
                          if (value === '') {
                            setAvailableOverrideGb('');
                            return;
                          }
                          const numeric = Number(value);
                          if (Number.isNaN(numeric)) {
                            return;
                          }
                          setAvailableOverrideGb(numeric);
                        }}
                        label={t('settings.storage.overrideAvailableLabel')}
                        helperText={t('settings.storage.overrideAvailableHelper')}
                        rightIcon={<span className="text-xs font-semibold text-neutral-500 uppercase">GB</span>}
                        disabled={overrideControlled}
                      />
                    </div>

                    <div className="flex justify-end">
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={handleSaveCapacityOverride}
                        isLoading={saveCapacityOverrideMutation.isPending}
                        disabled={overrideControlled}
                        leftIcon={<Save className="w-4 h-4" />}
                      >
                        {t('settings.storage.saveOverride')}
                      </Button>
                    </div>
                  </div>
                </div>
              </Card>
            );
          })()}

          {/* System Information */}
          {systemStatus && (
            <>
              <Card padding="md">
                <h2 className="text-lg font-semibold text-neutral-900 mb-4 flex items-center gap-2">
                  <Server className="w-5 h-5" />
                  {t('settings.systemStatus.systemInfo')}
                </h2>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-neutral-50 rounded-lg p-4">
                    <p className="text-sm text-neutral-600">{t('settings.systemStatus.platform')}</p>
                    <p className="font-semibold">{systemStatus.system.platform}</p>
                  </div>
                  <div className="bg-neutral-50 rounded-lg p-4">
                    <p className="text-sm text-neutral-600">{t('settings.systemStatus.nodeVersion')}</p>
                    <p className="font-semibold">{systemStatus.system.nodeVersion}</p>
                  </div>
                  <div className="bg-neutral-50 rounded-lg p-4">
                    <p className="text-sm text-neutral-600">{t('settings.systemStatus.uptime')}</p>
                    <p className="font-semibold">{Math.floor(systemStatus.system.uptime / 3600)}h {Math.floor((systemStatus.system.uptime % 3600) / 60)}m</p>
                  </div>
                  <div className="bg-neutral-50 rounded-lg p-4">
                    <p className="text-sm text-neutral-600">{t('settings.systemStatus.cpuCores')}</p>
                    <p className="font-semibold">{systemStatus.system.cpu.cores}</p>
                  </div>
                </div>

                <div className="mt-4">
                  <h3 className="text-sm font-semibold text-neutral-900 mb-2">{t('settings.systemStatus.memoryUsage')}</h3>
                  <div className="mb-2">
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-neutral-600">{t('settings.systemStatus.memoryUsed')}</span>
                      <span className="font-medium">
                        {settingsService.formatBytes(systemStatus.system.memory.used)} / {settingsService.formatBytes(systemStatus.system.memory.total)}
                      </span>
                    </div>
                    <div className="w-full bg-neutral-200 rounded-full h-2">
                      <div
                        className="bg-blue-600 h-2 rounded-full transition-all"
                        style={{ 
                          width: `${Math.round((systemStatus.system.memory.used / systemStatus.system.memory.total) * 100)}%` 
                        }}
                      />
                    </div>
                  </div>
                </div>
              </Card>

              <Card padding="md">
                <h2 className="text-lg font-semibold text-neutral-900 mb-4 flex items-center gap-2">
                  <Database className="w-5 h-5" />
                  {t('settings.systemStatus.databaseInfo')}
                </h2>
                
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                  <div className="bg-neutral-50 rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-neutral-900">{systemStatus.database.tables.events}</p>
                    <p className="text-xs text-neutral-600">{t('navigation.events')}</p>
                  </div>
                  <div className="bg-neutral-50 rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-neutral-900">{systemStatus.database.tables.photos}</p>
                    <p className="text-xs text-neutral-600">{t('settings.systemStatus.photos')}</p>
                  </div>
                  <div className="bg-neutral-50 rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-neutral-900">{systemStatus.database.tables.admins}</p>
                    <p className="text-xs text-neutral-600">{t('settings.systemStatus.admins')}</p>
                  </div>
                  <div className="bg-neutral-50 rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-neutral-900">{systemStatus.database.tables.categories}</p>
                    <p className="text-xs text-neutral-600">{t('settings.categories.title')}</p>
                  </div>
                  <div className="bg-neutral-50 rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-neutral-900">{settingsService.formatBytes(systemStatus.database.size)}</p>
                    <p className="text-xs text-neutral-600">{t('settings.systemStatus.dbSize')}</p>
                  </div>
                </div>
              </Card>

              <Card padding="md">
                <h2 className="text-lg font-semibold text-neutral-900 mb-4 flex items-center gap-2">
                  <Activity className="w-5 h-5" />
                  {t('settings.systemStatus.services')}
                </h2>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-neutral-50 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-medium text-neutral-700">{t('settings.systemStatus.fileWatcher')}</p>
                      <CheckCircle className="w-5 h-5 text-green-600" />
                    </div>
                    <p className="text-xs text-neutral-600">{t('settings.systemStatus.fileWatcherDesc')}</p>
                  </div>
                  <div className="bg-neutral-50 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-medium text-neutral-700">{t('settings.systemStatus.expirationChecker')}</p>
                      <CheckCircle className="w-5 h-5 text-green-600" />
                    </div>
                    <p className="text-xs text-neutral-600">{t('settings.systemStatus.expirationCheckerDesc')}</p>
                  </div>
                  <div className="bg-neutral-50 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-medium text-neutral-700">{t('settings.systemStatus.emailProcessor')}</p>
                      <CheckCircle className="w-5 h-5 text-green-600" />
                    </div>
                    <p className="text-xs text-neutral-600">{t('settings.systemStatus.emailProcessorDesc')}</p>
                  </div>
                </div>

                <div className="mt-4 p-4 bg-blue-50 rounded-lg">
                  <h3 className="text-sm font-semibold text-blue-900 mb-2">{t('settings.systemStatus.emailQueue')}</h3>
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <span className="text-blue-700">{t('settings.systemStatus.pending')}:</span>
                      <span className="ml-2 font-semibold text-blue-900">
                        {systemStatus.emailQueue.pending}
                        {systemStatus.emailQueue.stuck > 0 && (
                          <span className="text-orange-600 text-xs ml-1">
                            ({systemStatus.emailQueue.stuck} stuck)
                          </span>
                        )}
                      </span>
                    </div>
                    <div>
                      <span className="text-green-700">{t('settings.systemStatus.sent')}:</span>
                      <span className="ml-2 font-semibold text-green-900">{systemStatus.emailQueue.sent}</span>
                    </div>
                    <div>
                      <span className="text-red-700">{t('settings.systemStatus.failed')}:</span>
                      <span className="ml-2 font-semibold text-red-900">{systemStatus.emailQueue.failed}</span>
                    </div>
                  </div>
                  {systemStatus.emailQueue.stuck > 0 && (
                    <div className="mt-3 p-3 bg-orange-50 rounded-md">
                      <p className="text-xs text-orange-800">
                        <span className="font-semibold">⚠️ {systemStatus.emailQueue.stuck} email(s) stuck:</span> These emails have exceeded retry limits and won't be processed automatically.
                        Only {systemStatus.emailQueue.processable} of {systemStatus.emailQueue.pending} pending emails will be processed.
                      </p>
                    </div>
                  )}
                </div>
              </Card>
            </>
          )}

          {/* Last update time */}
          {systemStatus && (
            <div className="text-xs text-neutral-500 text-right flex items-center justify-end gap-1">
              <Clock className="w-3 h-3" />
              {t('settings.systemStatus.lastUpdate')}: {new Date(systemStatus.timestamp).toLocaleString()}
            </div>
          )}
        </div>
      )}

      {/* Security Tab */}
      {activeTab === 'security' && (
        <div className="space-y-6">
          <Card padding="md">
            <h2 className="text-lg font-semibold text-neutral-900 mb-4">{t('settings.security.passwordSettings')}</h2>
            
            <div className="space-y-4">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={securitySettings.require_password}
                  onChange={(e) => setSecuritySettings(prev => ({ ...prev, require_password: e.target.checked }))}
                  className="w-4 h-4 text-primary-600 rounded focus:ring-primary-500"
                />
                <span className="ml-2 text-sm text-neutral-700">{t('settings.security.requirePassword')}</span>
              </label>

              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">
                  {t('settings.security.minPasswordLength')}
                </label>
                <Input
                  type="number"
                  value={securitySettings.password_min_length}
                  onChange={(e) => setSecuritySettings(prev => ({ ...prev, password_min_length: parseInt(e.target.value) || 8 }))}
                  min="4"
                  max="32"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">
                  {t('settings.security.passwordComplexity')}
                </label>
                <select
                  value={securitySettings.password_complexity}
                  onChange={(e) => setSecuritySettings(prev => ({ ...prev, password_complexity: e.target.value }))}
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                >
                  <option value="simple">{t('settings.security.complexitySimple')}</option>
                  <option value="moderate">{t('settings.security.complexityModerate')}</option>
                  <option value="strong">{t('settings.security.complexityStrong')}</option>
                  <option value="very_strong">{t('settings.security.complexityVeryStrong')}</option>
                </select>
                <p className="mt-1 text-sm text-neutral-600">
                  {t('settings.security.passwordComplexityHelp')}
                </p>
              </div>
            </div>
          </Card>

          <Card padding="md">
            <h2 className="text-lg font-semibold text-neutral-900 mb-4">{t('settings.security.sessionAuth')}</h2>
            
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">
                    {t('settings.security.sessionTimeout')}
                  </label>
                  <Input
                    type="number"
                    value={securitySettings.session_timeout_minutes}
                    onChange={(e) => setSecuritySettings(prev => ({ ...prev, session_timeout_minutes: parseInt(e.target.value) || 60 }))}
                    min="5"
                    max="1440"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">
                    {t('settings.security.maxLoginAttempts')}
                  </label>
                  <Input
                    type="number"
                    value={securitySettings.max_login_attempts}
                    onChange={(e) => setSecuritySettings(prev => ({ ...prev, max_login_attempts: parseInt(e.target.value) || 5 }))}
                    min="3"
                    max="10"
                  />
                </div>
              </div>

              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={securitySettings.enable_2fa}
                  onChange={(e) => setSecuritySettings(prev => ({ ...prev, enable_2fa: e.target.checked }))}
                  className="w-4 h-4 text-primary-600 rounded focus:ring-primary-500"
                />
                <span className="ml-2 text-sm text-neutral-700">{t('settings.security.enable2FA')}</span>
              </label>
            </div>
          </Card>

          <Card padding="md">
            <h2 className="text-lg font-semibold text-neutral-900 mb-4">{t('settings.security.recaptchaSettings')}</h2>
            
            <div className="space-y-4">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={securitySettings.enable_recaptcha}
                  onChange={(e) => setSecuritySettings(prev => ({ ...prev, enable_recaptcha: e.target.checked }))}
                  className="w-4 h-4 text-primary-600 rounded focus:ring-primary-500"
                />
                <span className="ml-2 text-sm text-neutral-700">{t('settings.security.enableRecaptcha')}</span>
              </label>

              {securitySettings.enable_recaptcha && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-1">
                      {t('settings.security.siteKey')}
                    </label>
                    <Input
                      type="text"
                      value={securitySettings.recaptcha_site_key}
                      onChange={(e) => setSecuritySettings(prev => ({ ...prev, recaptcha_site_key: e.target.value }))}
                      placeholder={t('settings.security.siteKey')}
                      leftIcon={<Key className="w-5 h-5 text-neutral-400" />}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-1">
                      {t('settings.security.secretKey')}
                    </label>
                    <Input
                      type="password"
                      value={securitySettings.recaptcha_secret_key}
                      onChange={(e) => setSecuritySettings(prev => ({ ...prev, recaptcha_secret_key: e.target.value }))}
                      placeholder={t('settings.security.secretKey')}
                      leftIcon={<Key className="w-5 h-5 text-neutral-400" />}
                    />
                  </div>
                </>
              )}

              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0" />
                  <div className="text-sm text-blue-800">
                    <p>{t('settings.security.recaptchaHelp')} <a href="https://www.google.com/recaptcha/admin" target="_blank" rel="noopener noreferrer" className="underline">Google reCAPTCHA Admin</a></p>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6">
              <Button
                variant="primary"
                onClick={() => saveSecurityMutation.mutate()}
                isLoading={saveSecurityMutation.isPending}
                leftIcon={<Save className="w-5 h-5" />}
              >
                {t('settings.security.saveSecuritySettings')}
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Categories Tab */}
      {activeTab === 'categories' && (
        <div className="space-y-6">
          <Card padding="md">
            <CategoryManager />
          </Card>
          
          <Card padding="md">
            <div className="flex items-start gap-3">
              <Image className="w-5 h-5 text-blue-600 flex-shrink-0" />
              <div>
                <h3 className="text-sm font-semibold text-blue-900">{t('settings.categories.about')}</h3>
                <p className="text-sm text-blue-700 mt-1">
                  {t('settings.categories.aboutText')}
                </p>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Analytics Tab */}
      {activeTab === 'analytics' && (
        <div className="space-y-6">
          <Card padding="md">
            <h2 className="text-lg font-semibold text-neutral-900 mb-4">{t('settings.analytics.umamiIntegration')}</h2>
            
            <div className="space-y-4">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={analyticsSettings.umami_enabled}
                  onChange={(e) => setAnalyticsSettings(prev => ({ ...prev, umami_enabled: e.target.checked }))}
                  className="w-4 h-4 text-primary-600 rounded focus:ring-primary-500"
                />
                <span className="ml-2 text-sm text-neutral-700">{t('settings.analytics.enableUmami')}</span>
              </label>

              {analyticsSettings.umami_enabled && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-1">
                      {t('settings.analytics.umamiUrl')}
                    </label>
                    <Input
                      type="url"
                      value={analyticsSettings.umami_url}
                      onChange={(e) => setAnalyticsSettings(prev => ({ ...prev, umami_url: e.target.value }))}
                      placeholder="https://analytics.yourdomain.com"
                      leftIcon={<Globe className="w-5 h-5 text-neutral-400" />}
                    />
                    <p className="text-xs text-neutral-500 mt-1">
                      {t('settings.analytics.umamiUrlHelp')}
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-1">
                      {t('settings.analytics.websiteId')}
                    </label>
                    <Input
                      type="text"
                      value={analyticsSettings.umami_website_id}
                      onChange={(e) => setAnalyticsSettings(prev => ({ ...prev, umami_website_id: e.target.value }))}
                      placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                      leftIcon={<Key className="w-5 h-5 text-neutral-400" />}
                    />
                    <p className="text-xs text-neutral-500 mt-1">
                      {t('settings.analytics.websiteIdHelp')}
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-1">
                      {t('settings.analytics.shareUrl')}
                    </label>
                    <Input
                      type="url"
                      value={analyticsSettings.umami_share_url}
                      onChange={(e) => setAnalyticsSettings(prev => ({ ...prev, umami_share_url: e.target.value }))}
                      placeholder="https://analytics.yourdomain.com/share/..."
                      leftIcon={<Activity className="w-5 h-5 text-neutral-400" />}
                    />
                    <p className="text-xs text-neutral-500 mt-1">
                      {t('settings.analytics.shareUrlHelp')}
                    </p>
                  </div>
                </>
              )}

              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0" />
                  <div className="text-sm text-blue-800">
                    <p className="font-medium mb-1">{t('settings.analytics.umamiInfo')}</p>
                    <p>{t('settings.analytics.umamiInfoText')}</p>
                    <a href="https://umami.is" target="_blank" rel="noopener noreferrer" className="underline mt-1 inline-block">
                      {t('settings.analytics.learnMore')}
                    </a>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6">
              <Button
                variant="primary"
                onClick={() => saveAnalyticsMutation.mutate()}
                isLoading={saveAnalyticsMutation.isPending}
                leftIcon={<Save className="w-5 h-5" />}
              >
                {t('settings.analytics.saveAnalyticsSettings')}
              </Button>
            </div>
          </Card>

          {/* Backend Analytics Info */}
          <Card padding="md">
            <h2 className="text-lg font-semibold text-neutral-900 mb-4">{t('settings.analytics.backendAnalytics')}</h2>
            <p className="text-sm text-neutral-700 mb-4">{t('settings.analytics.backendAnalyticsText')}</p>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-neutral-50 rounded-lg p-4">
                <h3 className="text-sm font-medium text-neutral-900 mb-2">{t('settings.analytics.tracked')}</h3>
                <ul className="text-xs text-neutral-600 space-y-1">
                  <li>• {t('settings.analytics.galleryViews')}</li>
                  <li>• {t('settings.analytics.photoDownloads')}</li>
                  <li>• {t('settings.analytics.uniqueVisitors')}</li>
                  <li>• {t('settings.analytics.deviceTypes')}</li>
                </ul>
              </div>
              <div className="bg-neutral-50 rounded-lg p-4">
                <h3 className="text-sm font-medium text-neutral-900 mb-2">{t('settings.analytics.privacy')}</h3>
                <p className="text-xs text-neutral-600">
                  {t('settings.analytics.privacyText')}
                </p>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Moderation Tab */}
      {activeTab === 'moderation' && (
        <div className="space-y-6">
          <WordFilterManager />
        </div>
      )}
    </div>
  );
};
