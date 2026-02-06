import React from 'react';
import { Save, Globe, Key, Activity, AlertCircle } from 'lucide-react';
import { Button, Card, Input } from '../../../components/common';
import { useTranslation } from 'react-i18next';
import type { AnalyticsSettings } from '../hooks/useSettingsState';

interface AnalyticsTabProps {
  analyticsSettings: AnalyticsSettings;
  setAnalyticsSettings: React.Dispatch<React.SetStateAction<AnalyticsSettings>>;
  saveAnalyticsMutation: {
    mutate: () => void;
    isPending: boolean;
  };
}

export const AnalyticsTab: React.FC<AnalyticsTabProps> = ({
  analyticsSettings,
  setAnalyticsSettings,
  saveAnalyticsMutation,
}) => {
  const { t } = useTranslation();

  return (
    <div className="space-y-6">
      <Card padding="md">
        <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100 mb-4">{t('settings.analytics.umamiIntegration')}</h2>

        <div className="space-y-4">
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={analyticsSettings.umami_enabled}
              onChange={(e) => setAnalyticsSettings(prev => ({ ...prev, umami_enabled: e.target.checked }))}
              className="w-4 h-4 text-primary-600 rounded focus:ring-primary-500"
            />
            <span className="ml-2 text-sm text-neutral-700 dark:text-neutral-300">{t('settings.analytics.enableUmami')}</span>
          </label>

          {analyticsSettings.umami_enabled && (
            <>
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                  {t('settings.analytics.umamiUrl')}
                </label>
                <Input
                  type="url"
                  value={analyticsSettings.umami_url}
                  onChange={(e) => setAnalyticsSettings(prev => ({ ...prev, umami_url: e.target.value }))}
                  placeholder="https://analytics.yourdomain.com"
                  leftIcon={<Globe className="w-5 h-5 text-neutral-400" />}
                />
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                  {t('settings.analytics.umamiUrlHelp')}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                  {t('settings.analytics.websiteId')}
                </label>
                <Input
                  type="text"
                  value={analyticsSettings.umami_website_id}
                  onChange={(e) => setAnalyticsSettings(prev => ({ ...prev, umami_website_id: e.target.value }))}
                  placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                  leftIcon={<Key className="w-5 h-5 text-neutral-400" />}
                />
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                  {t('settings.analytics.websiteIdHelp')}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                  {t('settings.analytics.shareUrl')}
                </label>
                <Input
                  type="url"
                  value={analyticsSettings.umami_share_url}
                  onChange={(e) => setAnalyticsSettings(prev => ({ ...prev, umami_share_url: e.target.value }))}
                  placeholder="https://analytics.yourdomain.com/share/..."
                  leftIcon={<Activity className="w-5 h-5 text-neutral-400" />}
                />
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                  {t('settings.analytics.shareUrlHelp')}
                </p>
              </div>
            </>
          )}

          <div className="p-4 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0" />
              <div className="text-sm text-blue-800 dark:text-blue-200">
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
        <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100 mb-4">{t('settings.analytics.backendAnalytics')}</h2>
        <p className="text-sm text-neutral-700 dark:text-neutral-300 mb-4">{t('settings.analytics.backendAnalyticsText')}</p>

        <div className="grid grid-cols-2 gap-4">
          <div className="bg-neutral-50 dark:bg-neutral-800 rounded-lg p-4">
            <h3 className="text-sm font-medium text-neutral-900 dark:text-neutral-100 mb-2">{t('settings.analytics.tracked')}</h3>
            <ul className="text-xs text-neutral-600 dark:text-neutral-400 space-y-1">
              <li>• {t('settings.analytics.galleryViews')}</li>
              <li>• {t('settings.analytics.photoDownloads')}</li>
              <li>• {t('settings.analytics.uniqueVisitors')}</li>
              <li>• {t('settings.analytics.deviceTypes')}</li>
            </ul>
          </div>
          <div className="bg-neutral-50 dark:bg-neutral-800 rounded-lg p-4">
            <h3 className="text-sm font-medium text-neutral-900 dark:text-neutral-100 mb-2">{t('settings.analytics.privacy')}</h3>
            <p className="text-xs text-neutral-600 dark:text-neutral-400">
              {t('settings.analytics.privacyText')}
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
};
