import React, { useEffect } from 'react';
import {
  Save,
  Database,
  Server,
  CheckCircle,
  Clock,
  HardDrive,
  Activity,
} from 'lucide-react';
import { Button, Card, Input } from '../../../components/common';
import { useTranslation } from 'react-i18next';
import { settingsService } from '../../../services/settings.service';
import { useStatusTab } from '../hooks/useStatusTab';

const BYTES_PER_GB = 1024 * 1024 * 1024;

interface StatusTabProps {
  isActive: boolean;
  handleSaveSoftLimit: () => void;
  handleSaveCapacityOverride: () => void;
  saveSoftLimitMutation: { isPending: boolean };
  saveCapacityOverrideMutation: { isPending: boolean };
  softLimitGb: number | '';
  setSoftLimitGb: (value: number | '') => void;
  softLimitDirty: boolean;
  setSoftLimitDirty: (dirty: boolean) => void;
  capacityOverrideGb: number | '';
  setCapacityOverrideGb: (value: number | '') => void;
  availableOverrideGb: number | '';
  setAvailableOverrideGb: (value: number | '') => void;
  overrideDirty: boolean;
  setOverrideDirty: (dirty: boolean) => void;
}

export const StatusTab: React.FC<StatusTabProps> = ({
  isActive,
  handleSaveSoftLimit,
  handleSaveCapacityOverride,
  saveSoftLimitMutation,
  saveCapacityOverrideMutation,
  softLimitGb,
  setSoftLimitGb,
  softLimitDirty,
  setSoftLimitDirty,
  capacityOverrideGb,
  setCapacityOverrideGb,
  availableOverrideGb,
  setAvailableOverrideGb,
  overrideDirty,
  setOverrideDirty,
}) => {
  const { t } = useTranslation();
  const { storageInfo, systemStatus } = useStatusTab(isActive);

  // Sync soft limit from storage info
  useEffect(() => {
    if (!storageInfo || softLimitDirty) return;

    const currentLimit = storageInfo.configured_soft_limit ?? storageInfo.storage_soft_limit ?? null;

    if (currentLimit === null || currentLimit === undefined) {
      setSoftLimitGb('');
      return;
    }

    const limitGb = Number((currentLimit / BYTES_PER_GB).toFixed(2));
    setSoftLimitGb(limitGb);
  }, [storageInfo, softLimitDirty, setSoftLimitGb]);

  // Sync capacity override from storage info
  useEffect(() => {
    if (!storageInfo || overrideDirty) return;

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
  }, [storageInfo, overrideDirty, setCapacityOverrideGb, setAvailableOverrideGb]);

  return (
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
                    <span className="font-semibold">Warning: {systemStatus.emailQueue.stuck} email(s) stuck:</span> These emails have exceeded retry limits and won&apos;t be processed automatically.
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
  );
};
