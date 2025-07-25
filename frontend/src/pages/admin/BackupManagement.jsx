import React, { useState } from 'react';
import {
  HardDrive,
  Settings,
  History,
  Play,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Calendar,
  Database,
  FileArchive,
  Cloud,
  Server,
  Loader2,
  Info,
  Shield,
  Clock,
  Download,
  Upload,
  Trash2,
  Search,
  Filter
} from 'lucide-react';
import { toast } from 'react-toastify';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { useTranslation } from 'react-i18next';

import { Button, Card, Loading } from '../../components/common';
import { BackupDashboard } from '../../components/admin/BackupDashboard';
import { BackupConfiguration } from '../../components/admin/BackupConfiguration';
import { BackupHistory } from '../../components/admin/BackupHistory';
import { RestoreWizard } from '../../components/admin/RestoreWizard';
import { api } from '../../config/api';

// Tab components will be defined inside the component to use translations

export const BackupManagement = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  // Tab components with translations
  const tabs = [
    { id: 'dashboard', label: t('backup.tabs.dashboard'), icon: HardDrive },
    { id: 'configuration', label: t('backup.tabs.configuration'), icon: Settings },
    { id: 'history', label: t('backup.tabs.history'), icon: History },
    { id: 'restore', label: t('backup.tabs.restore'), icon: RefreshCw }
  ];

  // Fetch backup status
  const { data: backupStatus, isLoading: statusLoading } = useQuery({
    queryKey: ['backup-status'],
    queryFn: async () => {
      const response = await api.get('/admin/backup/status');
      return response.data;
    },
    refetchInterval: 10000 // Refresh every 10 seconds
  });

  // Fetch backup configuration
  const { data: backupConfig, isLoading: configLoading } = useQuery({
    queryKey: ['backup-config'],
    queryFn: async () => {
      const response = await api.get('/admin/backup/config');
      return response.data;
    }
  });

  // Trigger manual backup
  const manualBackupMutation = useMutation({
    mutationFn: async () => {
      const response = await api.post('/admin/backup/run');
      return response.data;
    },
    onSuccess: () => {
      toast.success(t('backup.messages.backupStarted'));
      queryClient.invalidateQueries({ queryKey: ['backup-status'] });
    },
    onError: (error) => {
      const message = error.response?.data?.error || t('backup.messages.backupFailed');
      toast.error(message);
    }
  });

  // Update configuration
  const updateConfigMutation = useMutation({
    mutationFn: async (config) => {
      const response = await api.put('/admin/backup/config', config);
      return response.data;
    },
    onSuccess: () => {
      toast.success(t('backup.messages.configUpdated'));
      queryClient.invalidateQueries({ queryKey: ['backup-config'] });
    },
    onError: (error) => {
      const message = error.response?.data?.error || t('backup.messages.configUpdateFailed');
      toast.error(message);
    }
  });

  if (statusLoading || configLoading) {
    return (
      <div className="p-8">
        <Loading />
      </div>
    );
  }

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">{t('backup.title')}</h1>
        <p className="text-gray-600">
          {t('backup.subtitle')}
        </p>
      </div>

      {/* Status Bar */}
      <Card className="mb-6 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-6">
            <div className="flex items-center space-x-2">
              {backupStatus?.isRunning ? (
                <>
                  <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />
                  <span className="text-blue-600 font-medium">{t('backup.status.inProgress')}</span>
                </>
              ) : backupStatus?.lastBackup ? (
                <>
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  <span className="text-gray-700">
                    {t('backup.status.lastBackup')}: {format(new Date(backupStatus.lastBackup.created_at), 'PPp')}
                  </span>
                </>
              ) : (
                <>
                  <AlertCircle className="h-5 w-5 text-amber-500" />
                  <span className="text-gray-700">{t('backup.status.noBackups')}</span>
                </>
              )}
            </div>
            
            {backupConfig?.backup_enabled && (
              <div className="flex items-center space-x-2">
                <Clock className="h-5 w-5 text-gray-400" />
                <span className="text-sm text-gray-600">
                  {t('backup.status.nextBackup')}: {backupStatus?.nextBackup || t('backup.status.notScheduled')}
                </span>
              </div>
            )}
          </div>

          <div className="flex items-center space-x-3">
            <Button
              onClick={() => manualBackupMutation.mutate()}
              disabled={backupStatus?.isRunning || manualBackupMutation.isLoading}
              variant="secondary"
              size="sm"
            >
              {manualBackupMutation.isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t('backup.actions.starting')}
                </>
              ) : (
                <>
                  <Play className="mr-2 h-4 w-4" />
                  {t('backup.actions.runBackupNow')}
                </>
              )}
            </Button>
            
            <div className={`flex items-center space-x-1 px-3 py-1 rounded-full text-sm font-medium ${
              backupConfig?.backup_enabled 
                ? 'bg-green-100 text-green-700' 
                : 'bg-gray-100 text-gray-700'
            }`}>
              <Shield className="h-4 w-4" />
              <span>{backupConfig?.backup_enabled ? t('backup.status.enabled') : t('backup.status.disabled')}</span>
            </div>
          </div>
        </div>
      </Card>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex space-x-8">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  py-2 px-1 border-b-2 font-medium text-sm flex items-center space-x-2
                  ${activeTab === tab.id
                    ? 'border-primary text-primary'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }
                `}
              >
                <Icon className="h-5 w-5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="mt-6">
        {activeTab === 'dashboard' && (
          <BackupDashboard 
            status={backupStatus} 
            config={backupConfig}
            onRunBackup={() => manualBackupMutation.mutate()}
            isBackupRunning={backupStatus?.isRunning || manualBackupMutation.isLoading}
          />
        )}
        
        {activeTab === 'configuration' && (
          <BackupConfiguration
            config={backupConfig}
            onSave={(newConfig) => updateConfigMutation.mutate(newConfig)}
            isSaving={updateConfigMutation.isLoading}
          />
        )}
        
        {activeTab === 'history' && (
          <BackupHistory />
        )}
        
        {activeTab === 'restore' && (
          <RestoreWizard />
        )}
      </div>
    </div>
  );
};