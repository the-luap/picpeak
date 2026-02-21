import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Loading } from '../../components/common';
import {
  useSettingsState,
  GeneralTab,
  EventsTab,
  StatusTab,
  SecurityTab,
  ImageSecurityTab,
  CategoriesTab,
  AnalyticsTab,
  ModerationTab,
  StylingTab,
  SEOTab,
} from '../../features/settings';

type TabType = 'general' | 'events' | 'status' | 'security' | 'imageSecurity' | 'categories' | 'seo' | 'analytics' | 'moderation' | 'styling';

export const SettingsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('general');
  const { t } = useTranslation();

  const {
    isLoading,
    adminProfileLoading,
    generalSettings,
    setGeneralSettings,
    securitySettings,
    setSecuritySettings,
    analyticsSettings,
    setAnalyticsSettings,
    eventSettings,
    setEventSettings,
    accountForm,
    accountErrors,
    handleAccountChange,
    handleAccountSubmit,
    updateAdminProfileMutation,
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
    handleSaveSoftLimit,
    handleSaveCapacityOverride,
    saveSoftLimitMutation,
    saveCapacityOverrideMutation,
    saveGeneralMutation,
    saveSecurityMutation,
    saveAnalyticsMutation,
    saveEventSettingsMutation,
    seoSettings,
    setSeoSettings,
    saveSeoMutation,
  } = useSettingsState();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loading size="lg" text={t('settings.loadingSettings')} />
      </div>
    );
  }

  const tabs: { key: TabType; label: string }[] = [
    { key: 'general', label: t('settings.general.title') },
    { key: 'events', label: t('settings.events.title', 'Event Creation') },
    { key: 'status', label: t('settings.systemStatus.title') },
    { key: 'security', label: t('settings.security.title') },
    { key: 'imageSecurity', label: t('settings.imageSecurity.title', 'Image Protection') },
    { key: 'seo', label: t('settings.seo.title', 'SEO & Robots') },
    { key: 'categories', label: t('settings.categories.title') },
    { key: 'analytics', label: t('settings.analytics.title') },
    { key: 'moderation', label: t('settings.moderation.title', 'Moderation') },
    { key: 'styling', label: t('settings.styling.title', 'Custom CSS') },
  ];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">{t('settings.title')}</h1>
        <p className="text-neutral-600 dark:text-neutral-400 mt-1">{t('settings.subtitle')}</p>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-neutral-200 dark:border-neutral-700 mb-6">
        <nav className="-mb-px flex gap-6">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === tab.key
                  ? 'border-primary-600 text-primary-600 dark:text-primary-400'
                  : 'border-transparent text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'general' && (
        <GeneralTab
          generalSettings={generalSettings}
          setGeneralSettings={setGeneralSettings}
          saveGeneralMutation={saveGeneralMutation}
          accountForm={accountForm}
          accountErrors={accountErrors}
          handleAccountChange={handleAccountChange}
          handleAccountSubmit={handleAccountSubmit}
          updateAdminProfileMutation={updateAdminProfileMutation}
          adminProfileLoading={adminProfileLoading}
        />
      )}

      {activeTab === 'events' && (
        <EventsTab
          eventSettings={eventSettings}
          setEventSettings={setEventSettings}
          saveEventSettingsMutation={saveEventSettingsMutation}
        />
      )}

      {activeTab === 'status' && (
        <StatusTab
          isActive={activeTab === 'status'}
          handleSaveSoftLimit={handleSaveSoftLimit}
          handleSaveCapacityOverride={handleSaveCapacityOverride}
          saveSoftLimitMutation={saveSoftLimitMutation}
          saveCapacityOverrideMutation={saveCapacityOverrideMutation}
          softLimitGb={softLimitGb}
          setSoftLimitGb={setSoftLimitGb}
          softLimitDirty={softLimitDirty}
          setSoftLimitDirty={setSoftLimitDirty}
          capacityOverrideGb={capacityOverrideGb}
          setCapacityOverrideGb={setCapacityOverrideGb}
          availableOverrideGb={availableOverrideGb}
          setAvailableOverrideGb={setAvailableOverrideGb}
          overrideDirty={overrideDirty}
          setOverrideDirty={setOverrideDirty}
        />
      )}

      {activeTab === 'security' && (
        <SecurityTab
          securitySettings={securitySettings}
          setSecuritySettings={setSecuritySettings}
          saveSecurityMutation={saveSecurityMutation}
        />
      )}

      {activeTab === 'seo' && (
        <SEOTab
          seoSettings={seoSettings}
          setSeoSettings={setSeoSettings}
          saveSeoMutation={saveSeoMutation}
        />
      )}

      {activeTab === 'imageSecurity' && <ImageSecurityTab />}

      {activeTab === 'categories' && <CategoriesTab />}

      {activeTab === 'analytics' && (
        <AnalyticsTab
          analyticsSettings={analyticsSettings}
          setAnalyticsSettings={setAnalyticsSettings}
          saveAnalyticsMutation={saveAnalyticsMutation}
        />
      )}

      {activeTab === 'moderation' && <ModerationTab />}

      {activeTab === 'styling' && <StylingTab />}
    </div>
  );
};
