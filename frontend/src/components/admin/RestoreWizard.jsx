import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Upload,
  HardDrive,
  Cloud,
  Server,
  Database,
  Image,
  FileArchive,
  Info,
  ChevronRight,
  ChevronLeft,
  Loader2,
  Shield,
  Download,
  Eye,
  Calendar,
  Clock,
  AlertCircle
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'react-toastify';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Button, Card, Input, Loading } from '../common';
import { api } from '../../config/api';

export const RestoreWizard = () => {
  const { t } = useTranslation();
  const [currentStep, setCurrentStep] = useState(0);
  
  const steps = [
    { id: 'source', title: t('backup.restore.steps.selectSource') },
    { id: 'backup', title: t('backup.restore.steps.chooseBackup') },
    { id: 'options', title: t('backup.restore.steps.restoreOptions') },
    { id: 'confirm', title: t('backup.restore.steps.reviewConfirm') },
    { id: 'progress', title: t('backup.restore.steps.restoreProgress') }
  ];

  const restoreTypes = [
    {
      id: 'full',
      name: t('backup.restore.restoreTypes.full.name'),
      description: t('backup.restore.restoreTypes.full.description'),
      icon: RefreshCw,
      warning: t('backup.restore.restoreTypes.full.warning')
    },
    {
      id: 'database',
      name: t('backup.restore.restoreTypes.database.name'),
      description: t('backup.restore.restoreTypes.database.description'),
      icon: Database,
      warning: t('backup.restore.restoreTypes.database.warning')
    },
    {
      id: 'files',
      name: t('backup.restore.restoreTypes.files.name'),
      description: t('backup.restore.restoreTypes.files.description'),
      icon: Image,
      warning: t('backup.restore.restoreTypes.files.warning')
    },
    {
      id: 'selective',
      name: t('backup.restore.restoreTypes.selective.name'),
      description: t('backup.restore.restoreTypes.selective.description'),
      icon: CheckCircle,
      warning: t('backup.restore.restoreTypes.selective.warning')
    }
  ];
  
  const [restoreData, setRestoreData] = useState({
    source: null,
    sourceConfig: {},
    selectedBackup: null,
    restoreType: 'full',
    selectedItems: [],
    skipPreBackup: false,
    force: false,
    encryptionPassphrase: ''
  });
  const [validationResult, setValidationResult] = useState(null);

  // Fetch restore status
  const { data: restoreStatus } = useQuery({
    queryKey: ['restore-status'],
    queryFn: async () => {
      const response = await api.get('/admin/restore/status');
      return response.data.data;
    },
    refetchInterval: currentStep === 4 ? 2000 : false // Poll during restore
  });

  // Fetch available backups
  const { data: availableBackups, isLoading: loadingBackups } = useQuery({
    queryKey: ['available-backups', restoreData.source, restoreData.sourceConfig],
    queryFn: async () => {
      const response = await api.post('/admin/restore/list-backups', {
        source: restoreData.source,
        ...restoreData.sourceConfig
      });
      return response.data.data;
    },
    enabled: currentStep === 1 && !!restoreData.source
  });

  // Validate restore
  const validateMutation = useMutation({
    mutationFn: async () => {
      const response = await api.post('/admin/restore/validate', {
        source: restoreData.source,
        manifestPath: restoreData.selectedBackup.manifest_path,
        restoreType: restoreData.restoreType,
        selectedItems: restoreData.selectedItems,
        ...restoreData.sourceConfig
      });
      return response.data.data;
    },
    onSuccess: (data) => {
      setValidationResult(data);
      setCurrentStep(3);
    },
    onError: (error) => {
      toast.error(error.response?.data?.error || 'Validation failed');
    }
  });

  // Start restore
  const restoreMutation = useMutation({
    mutationFn: async () => {
      const response = await api.post('/admin/restore/start', {
        source: restoreData.source,
        manifestPath: restoreData.selectedBackup.manifest_path,
        restoreType: restoreData.restoreType,
        selectedItems: restoreData.selectedItems,
        skipPreBackup: restoreData.skipPreBackup,
        force: restoreData.force,
        encryptionPassphrase: restoreData.encryptionPassphrase,
        ...restoreData.sourceConfig
      });
      return response.data;
    },
    onSuccess: () => {
      setCurrentStep(4);
      toast.success('Restore started successfully');
    },
    onError: (error) => {
      toast.error(error.response?.data?.error || 'Failed to start restore');
    }
  });

  const handleNext = () => {
    if (currentStep === 2) {
      // Validate before confirmation
      validateMutation.mutate();
    } else if (currentStep === 3) {
      // Start restore
      restoreMutation.mutate();
    } else {
      setCurrentStep(prev => Math.min(prev + 1, steps.length - 1));
    }
  };

  const handleBack = () => {
    setCurrentStep(prev => Math.max(prev - 1, 0));
  };

  const canProceed = () => {
    switch (currentStep) {
      case 0:
        return !!restoreData.source;
      case 1:
        return !!restoreData.selectedBackup;
      case 2:
        return !!restoreData.restoreType;
      case 3:
        return !!validationResult && !validateMutation.isLoading;
      default:
        return false;
    }
  };

  // Step Components
  const renderSourceSelection = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">{t('backup.restore.source.title')}</h3>
        <p className="text-sm text-gray-600">{t('backup.restore.source.subtitle')}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <button
          onClick={() => setRestoreData(prev => ({ ...prev, source: 'local' }))}
          className={`p-6 rounded-lg border-2 transition-all ${
            restoreData.source === 'local'
              ? 'border-primary bg-primary-50'
              : 'border-gray-200 hover:border-gray-300'
          }`}
        >
          <HardDrive className={`h-12 w-12 mb-3 mx-auto ${
            restoreData.source === 'local' ? 'text-primary' : 'text-gray-400'
          }`} />
          <h4 className="font-medium text-gray-900">{t('backup.restore.source.local.name')}</h4>
          <p className="text-xs text-gray-500 mt-1">{t('backup.restore.source.local.description')}</p>
        </button>

        <button
          onClick={() => setRestoreData(prev => ({ ...prev, source: 's3' }))}
          className={`p-6 rounded-lg border-2 transition-all ${
            restoreData.source === 's3'
              ? 'border-primary bg-primary-50'
              : 'border-gray-200 hover:border-gray-300'
          }`}
        >
          <Cloud className={`h-12 w-12 mb-3 mx-auto ${
            restoreData.source === 's3' ? 'text-primary' : 'text-gray-400'
          }`} />
          <h4 className="font-medium text-gray-900">{t('backup.restore.source.s3.name')}</h4>
          <p className="text-xs text-gray-500 mt-1">{t('backup.restore.source.s3.description')}</p>
        </button>

        <button
          onClick={() => setRestoreData(prev => ({ ...prev, source: 'upload' }))}
          className={`p-6 rounded-lg border-2 transition-all ${
            restoreData.source === 'upload'
              ? 'border-primary bg-primary-50'
              : 'border-gray-200 hover:border-gray-300'
          }`}
        >
          <Upload className={`h-12 w-12 mb-3 mx-auto ${
            restoreData.source === 'upload' ? 'text-primary' : 'text-gray-400'
          }`} />
          <h4 className="font-medium text-gray-900">{t('backup.restore.source.upload.name')}</h4>
          <p className="text-xs text-gray-500 mt-1">{t('backup.restore.source.upload.description')}</p>
        </button>
      </div>

      {/* Source-specific configuration */}
      {restoreData.source === 's3' && (
        <Card className="p-4 space-y-4">
          <h4 className="font-medium text-gray-900">{t('backup.restore.source.configuration.s3')}</h4>
          <div className="grid grid-cols-2 gap-4">
            <Input
              placeholder={t('backup.restore.source.configuration.endpoint')}
              value={restoreData.sourceConfig.s3Endpoint || ''}
              onChange={(e) => setRestoreData(prev => ({
                ...prev,
                sourceConfig: { ...prev.sourceConfig, s3Endpoint: e.target.value }
              }))}
            />
            <Input
              placeholder={t('backup.restore.source.configuration.bucket')}
              value={restoreData.sourceConfig.s3Bucket || ''}
              onChange={(e) => setRestoreData(prev => ({
                ...prev,
                sourceConfig: { ...prev.sourceConfig, s3Bucket: e.target.value }
              }))}
            />
            <Input
              placeholder={t('backup.restore.source.configuration.accessKey')}
              value={restoreData.sourceConfig.s3AccessKey || ''}
              onChange={(e) => setRestoreData(prev => ({
                ...prev,
                sourceConfig: { ...prev.sourceConfig, s3AccessKey: e.target.value }
              }))}
            />
            <Input
              type="password"
              placeholder={t('backup.restore.source.configuration.secretKey')}
              value={restoreData.sourceConfig.s3SecretKey || ''}
              onChange={(e) => setRestoreData(prev => ({
                ...prev,
                sourceConfig: { ...prev.sourceConfig, s3SecretKey: e.target.value }
              }))}
            />
          </div>
        </Card>
      )}

      {restoreData.source === 'upload' && (
        <Card className="p-4">
          <div className="text-center py-8">
            <Upload className="h-12 w-12 mx-auto mb-3 text-gray-400" />
            <p className="text-sm text-gray-600">{t('backup.restore.source.upload.comingSoon')}</p>
          </div>
        </Card>
      )}
    </div>
  );

  const renderBackupSelection = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">{t('backup.restore.backup.title')}</h3>
        <p className="text-sm text-gray-600">{t('backup.restore.backup.subtitle')}</p>
      </div>

      {loadingBackups ? (
        <Loading />
      ) : availableBackups?.length === 0 ? (
        <Card className="p-8 text-center">
          <FileArchive className="h-12 w-12 mx-auto mb-3 text-gray-300" />
          <p className="text-gray-500">{t('backup.restore.backup.noBackupsFound')}</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {availableBackups?.map((backup) => (
            <Card
              key={backup.id}
              className={`p-4 cursor-pointer transition-all ${
                restoreData.selectedBackup?.id === backup.id
                  ? 'ring-2 ring-primary bg-primary-50'
                  : 'hover:shadow-md'
              }`}
              onClick={() => setRestoreData(prev => ({ ...prev, selectedBackup: backup }))}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className={`p-2 rounded-lg ${
                    backup.status === 'completed' ? 'bg-green-100' : 'bg-amber-100'
                  }`}>
                    {backup.status === 'completed' ? (
                      <CheckCircle className="h-6 w-6 text-green-600" />
                    ) : (
                      <AlertCircle className="h-6 w-6 text-amber-600" />
                    )}
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">
                      {format(new Date(backup.created_at), 'PPP')} {t('backup.restore.backup.at')} {format(new Date(backup.created_at), 'p')}
                    </p>
                    <p className="text-sm text-gray-500">
                      {t('backup.dashboard.backupType', { type: backup.backup_type })} • {formatBytes(backup.total_size || 0)}
                    </p>
                  </div>
                </div>
                {backup.encrypted && (
                  <Shield className="h-5 w-5 text-gray-400" />
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {restoreData.selectedBackup?.encrypted && (
        <Card className="p-4 bg-amber-50 border-amber-200">
          <div className="flex items-start space-x-3">
            <Shield className="h-5 w-5 text-amber-600 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-amber-900">{t('backup.restore.backup.encrypted')}</p>
              <p className="text-sm text-amber-700 mt-1">
                {t('backup.restore.backup.encryptedMessage')}
              </p>
              <Input
                type="password"
                placeholder={t('backup.restore.backup.enterPassphrase')}
                className="mt-3"
                value={restoreData.encryptionPassphrase}
                onChange={(e) => setRestoreData(prev => ({
                  ...prev,
                  encryptionPassphrase: e.target.value
                }))}
              />
            </div>
          </div>
        </Card>
      )}
    </div>
  );

  const renderRestoreOptions = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">{t('backup.restore.options.title')}</h3>
        <p className="text-sm text-gray-600">{t('backup.restore.options.subtitle')}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {restoreTypes.map((type) => {
          const Icon = type.icon;
          return (
            <button
              key={type.id}
              onClick={() => setRestoreData(prev => ({ ...prev, restoreType: type.id }))}
              className={`p-4 rounded-lg border-2 text-left transition-all ${
                restoreData.restoreType === type.id
                  ? 'border-primary bg-primary-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="flex items-start space-x-3">
                <Icon className={`h-6 w-6 mt-1 ${
                  restoreData.restoreType === type.id ? 'text-primary' : 'text-gray-400'
                }`} />
                <div className="flex-1">
                  <h4 className="font-medium text-gray-900">{type.name}</h4>
                  <p className="text-sm text-gray-600 mt-1">{type.description}</p>
                  <p className="text-xs text-amber-600 mt-2">
                    <AlertTriangle className="inline h-3 w-3 mr-1" />
                    {type.warning}
                  </p>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Additional Options */}
      <Card className="p-4 space-y-4">
        <h4 className="font-medium text-gray-900">{t('backup.restore.options.additionalOptions.title')}</h4>
        
        <label className="flex items-start space-x-3">
          <input
            type="checkbox"
            checked={restoreData.skipPreBackup}
            onChange={(e) => setRestoreData(prev => ({
              ...prev,
              skipPreBackup: e.target.checked
            }))}
            className="mt-1 h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded"
          />
          <div>
            <p className="text-sm font-medium text-gray-700">{t('backup.restore.options.additionalOptions.skipPreBackup')}</p>
            <p className="text-xs text-gray-500">
              {t('backup.restore.options.additionalOptions.skipPreBackupHelp')}
            </p>
          </div>
        </label>

        <label className="flex items-start space-x-3">
          <input
            type="checkbox"
            checked={restoreData.force}
            onChange={(e) => setRestoreData(prev => ({
              ...prev,
              force: e.target.checked
            }))}
            className="mt-1 h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded"
          />
          <div>
            <p className="text-sm font-medium text-gray-700">{t('backup.restore.options.additionalOptions.force')}</p>
            <p className="text-xs text-gray-500">
              {t('backup.restore.options.additionalOptions.forceHelp')}
            </p>
          </div>
        </label>
      </Card>
    </div>
  );

  const renderConfirmation = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">{t('backup.restore.confirmation.title')}</h3>
        <p className="text-sm text-gray-600">{t('backup.restore.confirmation.subtitle')}</p>
      </div>

      {validationResult ? (
        <>
          {/* Validation Results */}
          <Card className={`p-4 ${
            validationResult.validation?.isValid 
              ? 'bg-green-50 border-green-200' 
              : 'bg-red-50 border-red-200'
          }`}>
            <div className="flex items-start space-x-3">
              {validationResult.validation?.isValid ? (
                <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
              ) : (
                <XCircle className="h-5 w-5 text-red-600 mt-0.5" />
              )}
              <div className="flex-1">
                <p className={`text-sm font-medium ${
                  validationResult.validation?.isValid ? 'text-green-900' : 'text-red-900'
                }`}>
                  {validationResult.validation?.isValid 
                    ? t('backup.restore.confirmation.validation.passed') 
                    : t('backup.restore.confirmation.validation.failed')}
                </p>
                {validationResult.validation?.errors?.length > 0 && (
                  <ul className="mt-2 text-sm text-red-700 list-disc list-inside">
                    {validationResult.validation.errors.map((error, idx) => (
                      <li key={idx}>{error}</li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </Card>

          {/* Space Check */}
          {validationResult.spaceCheck && (
            <Card className="p-4">
              <h4 className="font-medium text-gray-900 mb-3">{t('backup.restore.confirmation.spaceCheck.title')}</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">{t('backup.restore.confirmation.spaceCheck.required')}:</span>
                  <span className="font-medium">
                    {validationResult.spaceCheck.requiredFormatted || formatBytes(validationResult.spaceCheck.required || 0)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">{t('backup.restore.confirmation.spaceCheck.available')}:</span>
                  <span className="font-medium">
                    {validationResult.spaceCheck.availableFormatted ||
                     (validationResult.spaceCheck.available != null ? formatBytes(validationResult.spaceCheck.available) : t('common.unknown', 'Unknown'))}
                  </span>
                </div>
                {validationResult.spaceCheck.sufficient === false && (
                  <p className="text-red-600 text-xs mt-2">
                    <AlertCircle className="inline h-3 w-3 mr-1" />
                    {t('backup.restore.confirmation.spaceCheck.insufficient')}
                  </p>
                )}
              </div>
            </Card>
          )}

          {/* Summary */}
          <Card className="p-4">
            <h4 className="font-medium text-gray-900 mb-3">{t('backup.restore.confirmation.summary.title')}</h4>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-gray-600">{t('backup.restore.confirmation.summary.source')}:</dt>
                <dd className="font-medium capitalize">{restoreData.source}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-600">{t('backup.restore.confirmation.summary.backupDate')}:</dt>
                <dd className="font-medium">
                  {format(new Date(restoreData.selectedBackup.created_at), 'PPp')}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-600">{t('backup.restore.confirmation.summary.restoreType')}:</dt>
                <dd className="font-medium capitalize">{restoreData.restoreType}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-600">{t('backup.restore.confirmation.summary.preBackup')}:</dt>
                <dd className="font-medium">{restoreData.skipPreBackup ? t('backup.restore.confirmation.summary.skipped') : t('backup.restore.confirmation.summary.enabled')}</dd>
              </div>
            </dl>
          </Card>

          {/* Warning */}
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <div className="flex">
              <AlertTriangle className="h-5 w-5 text-amber-400 mt-0.5" />
              <div className="ml-3">
                <h3 className="text-sm font-medium text-amber-800">
                  {t('backup.restore.confirmation.warning.title')}
                </h3>
                <p className="mt-1 text-sm text-amber-700">
                  {t('backup.restore.confirmation.warning.message')}
                </p>
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="text-center py-8">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="mt-2 text-sm text-gray-600">{t('backup.restore.confirmation.validation.checking')}</p>
        </div>
      )}
    </div>
  );

  const renderProgress = () => {
    const progress = restoreStatus?.currentProgress || {};
    const isRunning = restoreStatus?.isRunning;

    return (
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">{t('backup.restore.progress.title')}</h3>
          <p className="text-sm text-gray-600">
            {isRunning ? t('backup.restore.progress.inProgress') : t('backup.restore.progress.completed')}
          </p>
        </div>

        {/* Progress Bar */}
        <Card className="p-6">
          <div className="space-y-4">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">{t('backup.restore.progress.overallProgress')}</span>
              <span className="font-medium">{progress.percentage || 0}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div
                className="bg-primary h-3 rounded-full transition-all duration-500"
                style={{ width: `${progress.percentage || 0}%` }}
              />
            </div>
            {progress.currentFile && (
              <p className="text-sm text-gray-600">
                {t('backup.restore.progress.current')}: {progress.currentFile}
              </p>
            )}
          </div>
        </Card>

        {/* Status Details */}
        <Card className="p-6">
          <h4 className="font-medium text-gray-900 mb-4">{t('backup.restore.progress.statusDetails')}</h4>
          <div className="space-y-3">
            {progress.steps?.map((step, idx) => (
              <div key={idx} className="flex items-center space-x-3">
                {step.status === 'completed' ? (
                  <CheckCircle className="h-5 w-5 text-green-500" />
                ) : step.status === 'running' ? (
                  <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />
                ) : step.status === 'failed' ? (
                  <XCircle className="h-5 w-5 text-red-500" />
                ) : (
                  <Clock className="h-5 w-5 text-gray-300" />
                )}
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">{step.name}</p>
                  {step.message && (
                    <p className="text-xs text-gray-500">{step.message}</p>
                  )}
                </div>
                {step.duration && (
                  <span className="text-xs text-gray-500">{step.duration}</span>
                )}
              </div>
            ))}
          </div>
        </Card>

        {/* Logs */}
        {progress.logs && progress.logs.length > 0 && (
          <Card className="p-6">
            <h4 className="font-medium text-gray-900 mb-4">{t('backup.restore.progress.restoreLogs')}</h4>
            <div className="bg-gray-900 rounded-lg p-4 max-h-64 overflow-y-auto">
              <pre className="text-xs text-gray-300 font-mono">
                {progress.logs.join('\n')}
              </pre>
            </div>
          </Card>
        )}

        {/* Completion Actions */}
        {!isRunning && progress.status === 'completed' && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex">
              <CheckCircle className="h-5 w-5 text-green-400 mt-0.5" />
              <div className="ml-3">
                <h3 className="text-sm font-medium text-green-800">
                  {t('backup.restore.progress.success.title')}
                </h3>
                <p className="mt-1 text-sm text-green-700">
                  {t('backup.restore.progress.success.message')}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  const formatBytes = (bytes) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  };

  return (
    <div className="max-w-4xl mx-auto">
      {/* Progress Steps */}
      <div className="mb-8">
        <nav aria-label="Progress">
          <ol className="flex items-center">
            {steps.map((step, stepIdx) => (
              <li key={step.id} className={`relative ${stepIdx !== steps.length - 1 ? 'pr-8 flex-1' : ''}`}>
                <div className="flex items-center">
                  <div className={`
                    relative flex h-8 w-8 items-center justify-center rounded-full
                    ${currentStep > stepIdx 
                      ? 'bg-primary' 
                      : currentStep === stepIdx 
                      ? 'bg-primary' 
                      : 'bg-gray-300'
                    }
                  `}>
                    {currentStep > stepIdx ? (
                      <CheckCircle className="h-5 w-5 text-white" />
                    ) : (
                      <span className="text-white text-sm">{stepIdx + 1}</span>
                    )}
                  </div>
                  {stepIdx !== steps.length - 1 && (
                    <div className={`
                      absolute top-4 w-full h-0.5 
                      ${currentStep > stepIdx ? 'bg-primary' : 'bg-gray-300'}
                    `} style={{ left: '2rem', right: '-2rem' }} />
                  )}
                </div>
                <span className={`
                  mt-2 text-xs font-medium
                  ${currentStep >= stepIdx ? 'text-gray-900' : 'text-gray-500'}
                `}>
                  {step.title}
                </span>
              </li>
            ))}
          </ol>
        </nav>
      </div>

      {/* Step Content */}
      <Card className="p-6">
        {currentStep === 0 && renderSourceSelection()}
        {currentStep === 1 && renderBackupSelection()}
        {currentStep === 2 && renderRestoreOptions()}
        {currentStep === 3 && renderConfirmation()}
        {currentStep === 4 && renderProgress()}
      </Card>

      {/* Navigation Buttons */}
      <div className="mt-6 flex justify-between">
        <Button
          variant="secondary"
          onClick={handleBack}
          disabled={currentStep === 0 || currentStep === 4}
        >
          <ChevronLeft className="mr-2 h-4 w-4" />
          {t('backup.restore.actions.back')}
        </Button>

        {currentStep < 4 && (
          <Button
            onClick={handleNext}
            disabled={!canProceed() || validateMutation.isLoading || restoreMutation.isLoading}
          >
            {currentStep === 3 ? (
              <>
                {restoreMutation.isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t('backup.restore.actions.starting')}
                  </>
                ) : (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    {t('backup.restore.actions.startRestore')}
                  </>
                )}
              </>
            ) : currentStep === 2 ? (
              <>
                {validateMutation.isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t('backup.restore.actions.validating')}
                  </>
                ) : (
                  <>
                    {t('backup.restore.actions.next')}
                    <ChevronRight className="ml-2 h-4 w-4" />
                  </>
                )}
              </>
            ) : (
              <>
                {t('backup.restore.actions.next')}
                <ChevronRight className="ml-2 h-4 w-4" />
              </>
            )}
          </Button>
        )}

        {currentStep === 4 && !restoreStatus?.isRunning && (
          <Button
            onClick={() => {
              setCurrentStep(0);
              setRestoreData({
                source: null,
                sourceConfig: {},
                selectedBackup: null,
                restoreType: 'full',
                selectedItems: [],
                skipPreBackup: false,
                force: false,
                encryptionPassphrase: ''
              });
              setValidationResult(null);
            }}
          >
            {t('backup.restore.actions.startNewRestore')}
          </Button>
        )}
      </div>
    </div>
  );
};