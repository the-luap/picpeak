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
        <h1 className="text-3xl font-bold text-neutral-900 dark:text-neutral-100 mb-2">{t('backup.title')}</h1>
        <p className="text-neutral-600 dark:text-neutral-400">
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
                  <span className="text-blue-600 dark:text-blue-400 font-medium">{t('backup.status.inProgress')}</span>
                </>
              ) : backupStatus?.lastBackup ? (
                <>
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  <span className="text-neutral-700 dark:text-neutral-300">
                    {t('backup.status.lastBackup')}: {format(new Date(backupStatus.lastBackup.created_at), 'PPp')}
                  </span>
                </>
              ) : (
                <>
                  <AlertCircle className="h-5 w-5 text-amber-500" />
                  <span className="text-neutral-700 dark:text-neutral-300">{t('backup.status.noBackups')}</span>
                </>
              )}
            </div>
            
            {backupConfig?.backup_enabled && (
              <div className="flex items-center space-x-2">
                <Clock className="h-5 w-5 text-neutral-400" />
                <span className="text-sm text-neutral-600 dark:text-neutral-400">
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
                ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300'
                : 'bg-neutral-100 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-300'
            }`}>
              <Shield className="h-4 w-4" />
              <span>{backupConfig?.backup_enabled ? t('backup.status.enabled') : t('backup.status.disabled')}</span>
            </div>
          </div>
        </div>
      </Card>

      {/* Tabs */}
      <div className="border-b border-neutral-200 dark:border-neutral-700 mb-6">
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
                    ? 'border-primary-600 dark:border-primary-400 text-primary-600 dark:text-primary-400'
                    : 'border-transparent text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-300 hover:border-neutral-300 dark:hover:border-neutral-600'
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