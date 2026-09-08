import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import { usePermissions } from '../../contexts/PermissionsContext';
import { productUsageService } from '../../services/productUsage.service';
import { Button, Card } from '../common';
import { UsageReportingPoints } from './UsageReportingPitch';

/**
 * One-time opt-in prompt for an admin who already had PicPeak installed
 * before this feature existed (#1360). A brand-new install gets the same
 * choice inside the setup wizard instead — both paths call
 * POST /admin/usage/prompt-seen on either outcome, so whichever one an
 * installation went through, this never shows a second time and never shows
 * once participation is already active.
 */
export default function UsageReportingPrompt() {
  const { t } = useTranslation();
  const { hasPermission } = usePermissions();
  const queryClient = useQueryClient();
  const [hidden, setHidden] = useState(false);
  const [consent, setConsent] = useState(false);
  const [isEnabling, setIsEnabling] = useState(false);

  const { data } = useQuery({
    queryKey: ['productUsage'],
    queryFn: productUsageService.status,
    enabled: hasPermission('settings.edit'),
  });

  const dismiss = async () => {
    setHidden(true);
    try {
      queryClient.setQueryData(['productUsage'], await productUsageService.promptSeen());
    } catch {
      /* Worst case the query refetches stale data and this shows once more. */
    }
  };

  const enable = async () => {
    setIsEnabling(true);
    try {
      queryClient.setQueryData(['productUsage'], await productUsageService.enable());
      toast.success(t('setup.usageReporting.enabled'));
      setHidden(true);
    } catch {
      toast.warn(t('setup.usageReporting.enableFailed'));
    } finally {
      setIsEnabling(false);
    }
  };

  if (!hasPermission('settings.edit') || !data || hidden) return null;
  if (data.status !== 'disabled' || data.prompt_shown) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <Card className="w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="p-6 space-y-6">
          <div>
            <h2 className="text-lg font-semibold text-neutral-900 mb-1">
              {t('productUsagePrompt.title')}
            </h2>
            <p className="text-sm text-neutral-600">{t('productUsagePrompt.intro')}</p>
          </div>

          <UsageReportingPoints />

          <label className="flex items-start gap-3 rounded-lg border border-neutral-200 p-3 cursor-pointer hover:bg-neutral-50 transition-colors">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 rounded border-neutral-300"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
            />
            <span className="text-xs text-neutral-600">{t('setup.usageReporting.consentCheck')}</span>
          </label>

          <div className="space-y-3">
            <Button
              type="button"
              variant="primary"
              size="lg"
              className="w-full"
              isLoading={isEnabling}
              disabled={!consent}
              onClick={enable}
            >
              {t('setup.usageReporting.enable')}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="lg"
              className="w-full"
              disabled={isEnabling}
              onClick={dismiss}
            >
              {t('setup.usageReporting.skip')}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
