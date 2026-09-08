import type { LucideIcon } from 'lucide-react';
import { ShieldOff, Users, MessageSquare } from 'lucide-react';
import { useTranslation } from 'react-i18next';

// Shared between the setup wizard's opt-in step and the one-time post-update
// prompt (#1360) so the two surfaces never drift apart. Kept deliberately
// short — most people reflexively decline "send us data" prompts, so this
// leads with what makes PicPeak's reporting different from typical analytics
// rather than repeating the full disclosure the Settings → Product usage tab
// already shows in detail.
export const USAGE_REPORTING_POINTS: { key: string; icon: LucideIcon }[] = [
  { key: 'oneWay', icon: ShieldOff },
  { key: 'mutual', icon: Users },
  { key: 'feedback', icon: MessageSquare },
];

export const UsageReportingPoints: React.FC = () => {
  const { t } = useTranslation();
  return (
    <div className="space-y-2">
      {USAGE_REPORTING_POINTS.map(({ key, icon: Icon }) => (
        <div key={key} className="flex items-start gap-3 rounded-lg border border-neutral-200 p-3">
          <Icon className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: 'var(--color-primary, #5C8762)' }} />
          <span className="min-w-0">
            <span className="block text-sm font-medium text-neutral-800">
              {t(`setup.usageReporting.${key}Title`)}
            </span>
            <span className="block text-xs text-neutral-500">
              {t(`setup.usageReporting.${key}Desc`)}
            </span>
          </span>
        </div>
      ))}
    </div>
  );
};
