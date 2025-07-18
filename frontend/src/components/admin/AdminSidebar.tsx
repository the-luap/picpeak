import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Calendar, 
  Mail, 
  Archive, 
  BarChart3, 
  Settings,
  X,
  Palette,
  FileText
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { settingsService } from '../../services/settings.service';
import { VersionInfo } from './VersionInfo';

interface AdminSidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

interface NavItem {
  nameKey: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

const navigation: NavItem[] = [
  { nameKey: 'navigation.dashboard', href: '/admin/dashboard', icon: LayoutDashboard },
  { nameKey: 'navigation.events', href: '/admin/events', icon: Calendar },
  { nameKey: 'navigation.archives', href: '/admin/archives', icon: Archive },
  { nameKey: 'admin.analytics', href: '/admin/analytics', icon: BarChart3 },
  { nameKey: 'navigation.emailSettings', href: '/admin/email', icon: Mail },
  { nameKey: 'navigation.branding', href: '/admin/branding', icon: Palette },
  { nameKey: 'navigation.settings', href: '/admin/settings', icon: Settings },
  { nameKey: 'navigation.cmsPages', href: '/admin/cms', icon: FileText },
];

export const AdminSidebar: React.FC<AdminSidebarProps> = ({ isOpen, onClose }) => {
  const location = useLocation();
  const { t } = useTranslation();

  return (
    <div
      className={`fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-neutral-200 transform transition-transform duration-200 ease-in-out lg:relative lg:translate-x-0 lg:h-screen ${
        isOpen ? 'translate-x-0' : '-translate-x-full'
      }`}
    >
      <div className="flex flex-col h-screen lg:h-full">
        {/* Brand */}
        <div className="flex items-center justify-between h-16 px-6 border-b border-neutral-200 flex-shrink-0">
          <div className="flex items-center">
            <span className="text-xl font-bold text-neutral-900">{t('admin.title')}</span>
          </div>
          <button
            onClick={onClose}
            className="lg:hidden text-neutral-400 hover:text-neutral-600"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-4 py-4 space-y-1 overflow-y-auto min-h-0">
          {navigation.map((item) => {
            const isActive = location.pathname === item.href || 
                           (item.href !== '/admin/dashboard' && location.pathname.startsWith(item.href));
            
            return (
              <NavLink
                key={item.nameKey}
                to={item.href}
                onClick={() => onClose()}
                className={`flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                  isActive
                    ? 'bg-primary-50 text-primary-700'
                    : 'text-neutral-700 hover:bg-neutral-100 hover:text-neutral-900'
                }`}
              >
                <item.icon className={`w-5 h-5 mr-3 ${
                  isActive ? 'text-primary-600' : 'text-neutral-400'
                }`} />
                {t(item.nameKey)}
              </NavLink>
            );
          })}
        </nav>

        {/* Bottom section - sticky to bottom */}
        <div className="flex-shrink-0">
          {/* Version Info */}
          <VersionInfo />
          
          {/* Storage Info */}
          <StorageInfo />
        </div>
      </div>
    </div>
  );
};

const StorageInfo: React.FC = () => {
  const { t } = useTranslation();
  const { data: storageInfo } = useQuery({
    queryKey: ['storage-info'],
    queryFn: () => settingsService.getStorageInfo(),
    refetchInterval: 60000 // Refresh every minute
  });

  if (!storageInfo) {
    return (
      <div className="p-4 border-t border-neutral-200">
        <div className="bg-neutral-100 rounded-lg p-3">
          <div className="h-12 animate-pulse bg-neutral-200 rounded" />
        </div>
      </div>
    );
  }

  const usagePercent = Math.round((storageInfo.total_used / storageInfo.storage_limit) * 100);

  return (
    <div className="p-4 border-t border-neutral-200">
      <div className="bg-neutral-100 rounded-lg p-3">
        <div className="flex items-center justify-between text-sm">
          <span className="text-neutral-700">{t('admin.storageUsed')}</span>
          <span className="font-medium text-neutral-900">
            {settingsService.formatBytes(storageInfo.total_used)}
          </span>
        </div>
        <div className="mt-2 w-full bg-neutral-200 rounded-full h-2">
          <div 
            className="bg-primary-600 h-2 rounded-full transition-all duration-300"
            style={{ width: `${Math.min(usagePercent, 100)}%` }}
          />
        </div>
        <p className="text-xs text-neutral-600 mt-1">
          {t('admin.storagePercent', { percent: usagePercent, limit: settingsService.formatBytes(storageInfo.storage_limit) })}
        </p>
      </div>
    </div>
  );
};