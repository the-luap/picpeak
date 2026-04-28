import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Sliders,
  CalendarPlus,
  Activity,
  Lock,
  Shield,
  Image as ImageIcon,
  Search,
  Tags,
  BarChart3,
  Flag,
  Code,
  KeyRound,
  Webhook,
  type LucideIcon,
} from 'lucide-react';
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
  ThumbnailsTab,
  ApiTokensTab,
  WebhooksTab,
} from '../../features/settings';

type TabType = 'general' | 'events' | 'status' | 'security' | 'imageSecurity' | 'thumbnails' | 'categories' | 'seo' | 'analytics' | 'moderation' | 'styling' | 'apiTokens' | 'webhooks';

interface NavItem {
  key: TabType;
  label: string;
  icon: LucideIcon;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

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

  // Grouped nav: replaces the previous flat 13-tab horizontal bar that
  // overflowed even on 1440px viewports. Categories follow the macOS
  // System Settings / Stripe / GitHub pattern — scales to N tabs without
  // horizontal scroll, gives visual taxonomy, and surfaces every option.
  const navGroups: NavGroup[] = [
    {
      label: t('settings.groups.general', 'General'),
      items: [
        { key: 'general', label: t('settings.general.title'), icon: Sliders },
        { key: 'events', label: t('settings.events.title', 'Event Creation'), icon: CalendarPlus },
      ],
    },
    {
      label: t('settings.groups.display', 'Display'),
      items: [
        { key: 'categories', label: t('settings.categories.title'), icon: Tags },
        { key: 'thumbnails', label: t('settings.thumbnails.title', 'Thumbnails'), icon: ImageIcon },
        { key: 'styling', label: t('settings.styling.title', 'Custom CSS'), icon: Code },
      ],
    },
    {
      label: t('settings.groups.privacySecurity', 'Privacy & Security'),
      items: [
        { key: 'security', label: t('settings.security.title'), icon: Lock },
        { key: 'imageSecurity', label: t('settings.imageSecurity.title', 'Image Protection'), icon: Shield },
        { key: 'seo', label: t('settings.seo.title', 'SEO & Robots'), icon: Search },
        { key: 'moderation', label: t('settings.moderation.title', 'Moderation'), icon: Flag },
      ],
    },
    {
      label: t('settings.groups.integrations', 'Integrations'),
      items: [
        { key: 'apiTokens', label: t('settings.apiTokens.title', 'API Tokens'), icon: KeyRound },
        { key: 'webhooks', label: t('settings.webhooks.title', 'Webhooks'), icon: Webhook },
      ],
    },
    {
      label: t('settings.groups.system', 'System'),
      items: [
        { key: 'status', label: t('settings.systemStatus.title'), icon: Activity },
        { key: 'analytics', label: t('settings.analytics.title'), icon: BarChart3 },
      ],
    },
  ];

  const allItems = navGroups.flatMap((g) => g.items);
  const activeItem = allItems.find((i) => i.key === activeTab) ?? allItems[0];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">{t('settings.title')}</h1>
        <p className="text-neutral-600 dark:text-neutral-400 mt-1">{t('settings.subtitle')}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-6 lg:gap-8">
        {/* Mobile: native select dropdown — keeps every option reachable
           in one tap on touch devices, no horizontal scroll. */}
        <div className="lg:hidden">
          <label htmlFor="settings-section" className="sr-only">
            {t('settings.sectionLabel', 'Settings section')}
          </label>
          <select
            id="settings-section"
            value={activeTab}
            onChange={(e) => setActiveTab(e.target.value as TabType)}
            className="w-full rounded-md border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2 text-sm font-medium text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            {navGroups.map((group) => (
              <optgroup key={group.label} label={group.label}>
                {group.items.map((item) => (
                  <option key={item.key} value={item.key}>
                    {item.label}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>

        {/* Desktop: grouped left rail. Sticky so the nav stays visible
           while the right pane scrolls through long forms. */}
        <aside className="hidden lg:block">
          <nav
            aria-label={t('settings.navAriaLabel', 'Settings navigation')}
            className="sticky top-6 space-y-6"
          >
            {navGroups.map((group) => (
              <div key={group.label}>
                <h3 className="px-3 mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                  {group.label}
                </h3>
                <ul className="space-y-0.5">
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    const isActive = activeTab === item.key;
                    return (
                      <li key={item.key}>
                        <button
                          type="button"
                          onClick={() => setActiveTab(item.key)}
                          aria-current={isActive ? 'page' : undefined}
                          className={`group w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                            isActive
                              ? 'bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300'
                              : 'text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800'
                          }`}
                        >
                          <Icon
                            className={`w-4 h-4 flex-shrink-0 ${
                              isActive
                                ? 'text-primary-600 dark:text-primary-400'
                                : 'text-neutral-500 dark:text-neutral-400 group-hover:text-neutral-700 dark:group-hover:text-neutral-200'
                            }`}
                          />
                          <span className="truncate">{item.label}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </nav>
        </aside>

        <div className="min-w-0">
          {/* Section heading echoes the active nav item — anchors the user
             after they switch, especially after a mobile select change. */}
          <div className="mb-4 lg:mb-6 pb-3 border-b border-neutral-200 dark:border-neutral-700">
            <div className="flex items-center gap-2">
              <activeItem.icon className="w-5 h-5 text-primary-600 dark:text-primary-400" />
              <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
                {activeItem.label}
              </h2>
            </div>
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

      {activeTab === 'thumbnails' && <ThumbnailsTab />}

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

      {activeTab === 'apiTokens' && <ApiTokensTab />}
      {activeTab === 'webhooks' && <WebhooksTab />}
        </div>
      </div>
    </div>
  );
};
