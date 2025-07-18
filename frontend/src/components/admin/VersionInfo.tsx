import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Info } from 'lucide-react';
import { api } from '../../config/api';
import packageJson from '../../../package.json';

// Frontend version from package.json
const FRONTEND_VERSION = packageJson.version;

interface SystemVersion {
  backend: string;
  frontend: string;
  node: string;
  environment: string;
}

async function fetchSystemVersion(): Promise<SystemVersion> {
  const response = await api.get<SystemVersion>('/admin/system/version');
  return response.data;
}

export const VersionInfo: React.FC = () => {
  const { t } = useTranslation();
  const { data: versionInfo } = useQuery({
    queryKey: ['system-version'],
    queryFn: fetchSystemVersion,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  return (
    <div className="px-4 py-3 border-t border-neutral-200">
      <div className="flex items-center gap-2 text-xs text-neutral-600">
        <Info className="w-3 h-3" />
        <span className="font-medium">{t('admin.version')}</span>
      </div>
      <div className="mt-1 space-y-0.5 text-xs text-neutral-500">
        <div>Frontend: v{FRONTEND_VERSION}</div>
        {versionInfo && (
          <div>Backend: v{versionInfo.backend}</div>
        )}
      </div>
    </div>
  );
};