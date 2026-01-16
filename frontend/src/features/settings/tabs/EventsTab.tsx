import React from 'react';
import { Save, AlertCircle } from 'lucide-react';
import { Button, Card } from '../../../components/common';
import { useTranslation } from 'react-i18next';
import type { EventSettings } from '../hooks/useSettingsState';

interface EventsTabProps {
  eventSettings: EventSettings;
  setEventSettings: React.Dispatch<React.SetStateAction<EventSettings>>;
  saveEventSettingsMutation: {
    mutate: () => void;
    isPending: boolean;
  };
}

export const EventsTab: React.FC<EventsTabProps> = ({
  eventSettings,
  setEventSettings,
  saveEventSettingsMutation,
}) => {
  const { t } = useTranslation();

  return (
    <div className="space-y-6">
      <Card padding="md">
        <h2 className="text-lg font-semibold text-neutral-900 mb-4">
          {t('settings.events.requiredFields', 'Required Fields')}
        </h2>
        <p className="text-sm text-neutral-600 mb-4">
          {t('settings.events.requiredFieldsDescription', 'Configure which contact fields are required when creating new events.')}
        </p>

        <div className="space-y-4">
          <div>
            <label className="flex items-start gap-3">
              <input
                type="checkbox"
                checked={eventSettings.event_require_customer_name}
                onChange={(e) => setEventSettings(prev => ({ ...prev, event_require_customer_name: e.target.checked }))}
                className="mt-1 w-4 h-4 text-primary-600 rounded focus:ring-primary-500"
              />
              <div>
                <span className="text-sm font-medium text-neutral-700">
                  {t('settings.events.requireCustomerName', 'Require customer name')}
                </span>
                <p className="text-xs text-neutral-500 mt-1">
                  {t('settings.events.requireCustomerNameHelp', 'Customer name must be provided for new events')}
                </p>
              </div>
            </label>
          </div>

          <div>
            <label className="flex items-start gap-3">
              <input
                type="checkbox"
                checked={eventSettings.event_require_customer_email}
                onChange={(e) => setEventSettings(prev => ({ ...prev, event_require_customer_email: e.target.checked }))}
                className="mt-1 w-4 h-4 text-primary-600 rounded focus:ring-primary-500"
              />
              <div>
                <span className="text-sm font-medium text-neutral-700">
                  {t('settings.events.requireCustomerEmail', 'Require customer email')}
                </span>
                <p className="text-xs text-neutral-500 mt-1">
                  {t('settings.events.requireCustomerEmailHelp', 'Customer email must be provided for new events')}
                </p>
                {!eventSettings.event_require_customer_email && (
                  <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    {t('settings.events.customerEmailWarning', 'Required for sending gallery invitations')}
                  </p>
                )}
              </div>
            </label>
          </div>

          <div>
            <label className="flex items-start gap-3">
              <input
                type="checkbox"
                checked={eventSettings.event_require_admin_email}
                onChange={(e) => setEventSettings(prev => ({ ...prev, event_require_admin_email: e.target.checked }))}
                className="mt-1 w-4 h-4 text-primary-600 rounded focus:ring-primary-500"
              />
              <div>
                <span className="text-sm font-medium text-neutral-700">
                  {t('settings.events.requireAdminEmail', 'Require admin email')}
                </span>
                <p className="text-xs text-neutral-500 mt-1">
                  {t('settings.events.requireAdminEmailHelp', 'Admin email must be provided for new events')}
                </p>
                {!eventSettings.event_require_admin_email && (
                  <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    {t('settings.events.adminEmailWarning', 'Required for receiving event notifications')}
                  </p>
                )}
              </div>
            </label>
          </div>

          <div>
            <label className="flex items-start gap-3">
              <input
                type="checkbox"
                checked={eventSettings.event_require_event_date}
                onChange={(e) => setEventSettings(prev => ({ ...prev, event_require_event_date: e.target.checked }))}
                className="mt-1 w-4 h-4 text-primary-600 rounded focus:ring-primary-500"
              />
              <div>
                <span className="text-sm font-medium text-neutral-700">
                  {t('settings.events.requireEventDate', 'Require event date')}
                </span>
                <p className="text-xs text-neutral-500 mt-1">
                  {t('settings.events.requireEventDateHelp', 'Event date must be provided when creating events')}
                </p>
                {!eventSettings.event_require_event_date && (
                  <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    {t('settings.events.eventDateWarning', 'Gallery URLs will use random identifiers instead of dates')}
                  </p>
                )}
              </div>
            </label>
          </div>

          <div>
            <label className="flex items-start gap-3">
              <input
                type="checkbox"
                checked={eventSettings.event_require_expiration}
                onChange={(e) => setEventSettings(prev => ({ ...prev, event_require_expiration: e.target.checked }))}
                className="mt-1 w-4 h-4 text-primary-600 rounded focus:ring-primary-500"
              />
              <div>
                <span className="text-sm font-medium text-neutral-700">
                  {t('settings.events.requireExpiration', 'Require expiration date')}
                </span>
                <p className="text-xs text-neutral-500 mt-1">
                  {t('settings.events.requireExpirationHelp', 'Galleries must have an expiration date')}
                </p>
                {!eventSettings.event_require_expiration && (
                  <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    {t('settings.events.expirationWarning', 'Galleries without expiration will remain active until manually archived')}
                  </p>
                )}
              </div>
            </label>
          </div>
        </div>

        <div className="mt-6">
          <Button
            variant="primary"
            onClick={() => saveEventSettingsMutation.mutate()}
            isLoading={saveEventSettingsMutation.isPending}
            leftIcon={<Save className="w-5 h-5" />}
          >
            {t('settings.events.saveSettings', 'Save Event Settings')}
          </Button>
        </div>
      </Card>

      <Card padding="md">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0" />
          <div className="text-sm text-blue-800">
            <p className="font-medium mb-1">{t('settings.events.noteTitle', 'Note')}</p>
            <p>
              {t('settings.events.noteText', 'These settings only affect new event creation. Existing events are not affected. Default behavior requires all fields.')}
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
};
