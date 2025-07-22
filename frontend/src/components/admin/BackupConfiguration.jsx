import React, { useState, useEffect } from 'react';
import {
  Save,
  Server,
  Cloud,
  HardDrive,
  Clock,
  Calendar,
  Shield,
  AlertCircle,
  Info,
  Eye,
  EyeOff,
  TestTube,
  CheckCircle,
  XCircle,
  Loader2,
  FolderOpen,
  Database,
  Image,
  FileArchive
} from 'lucide-react';
import { toast } from 'react-toastify';
import { Button, Card, Input } from '../common';

const destinationTypes = [
  {
    id: 'local',
    name: 'Local Storage',
    icon: HardDrive,
    description: 'Store backups on the local server filesystem',
    fields: ['backup_destination_path']
  },
  {
    id: 'rsync',
    name: 'Remote Server (Rsync)',
    icon: Server,
    description: 'Sync backups to a remote server via SSH/Rsync',
    fields: ['backup_rsync_host', 'backup_rsync_user', 'backup_rsync_path', 'backup_rsync_ssh_key']
  },
  {
    id: 's3',
    name: 'S3 Compatible Storage',
    icon: Cloud,
    description: 'Store backups in Amazon S3 or compatible object storage',
    fields: ['backup_s3_endpoint', 'backup_s3_bucket', 'backup_s3_access_key', 'backup_s3_secret_key', 'backup_s3_region']
  }
];

const scheduleOptions = [
  { value: 'hourly', label: 'Every hour' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'custom', label: 'Custom cron expression' }
];

export const BackupConfiguration = ({ config, onSave, isSaving }) => {
  const [formData, setFormData] = useState({
    backup_enabled: false,
    backup_destination_type: 'local',
    backup_destination_path: '',
    backup_rsync_host: '',
    backup_rsync_user: '',
    backup_rsync_path: '',
    backup_rsync_ssh_key: '',
    backup_s3_endpoint: '',
    backup_s3_bucket: '',
    backup_s3_access_key: '',
    backup_s3_secret_key: '',
    backup_s3_region: '',
    backup_schedule: 'daily',
    backup_schedule_cron: '0 3 * * *',
    backup_retention_days: 30,
    backup_include_database: true,
    backup_include_photos: true,
    backup_include_archives: true,
    backup_include_thumbnails: false,
    backup_include_temp: false,
    backup_compression: true,
    backup_encryption: false,
    backup_encryption_passphrase: ''
  });

  const [showSecrets, setShowSecrets] = useState({
    s3_secret_key: false,
    ssh_key: false,
    encryption_passphrase: false
  });

  const [testingConnection, setTestingConnection] = useState(false);

  useEffect(() => {
    if (config) {
      setFormData(prev => ({
        ...prev,
        ...config
      }));
    }
  }, [config]);

  const handleChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    // Validate required fields
    const destinationType = destinationTypes.find(t => t.id === formData.backup_destination_type);
    const missingFields = [];
    
    if (formData.backup_enabled && destinationType) {
      destinationType.fields.forEach(field => {
        if (!formData[field] && !field.includes('optional')) {
          missingFields.push(field);
        }
      });
    }
    
    if (missingFields.length > 0) {
      toast.error('Please fill in all required fields');
      return;
    }
    
    onSave(formData);
  };

  const testConnection = async () => {
    setTestingConnection(true);
    try {
      // TODO: Implement connection test endpoint
      await new Promise(resolve => setTimeout(resolve, 2000));
      toast.success('Connection test successful!');
    } catch (error) {
      toast.error('Connection test failed: ' + error.message);
    } finally {
      setTestingConnection(false);
    }
  };

  const selectedDestination = destinationTypes.find(t => t.id === formData.backup_destination_type);

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Enable/Disable Toggle */}
      <Card className="p-6">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-900">Backup Service</h3>
            <p className="mt-1 text-sm text-gray-600">
              Enable automatic backups to protect your data
            </p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={formData.backup_enabled}
              onChange={(e) => handleChange('backup_enabled', e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
          </label>
        </div>
      </Card>

      {/* Destination Configuration */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Backup Destination</h3>
        
        {/* Destination Type Selection */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {destinationTypes.map((type) => {
            const Icon = type.icon;
            return (
              <button
                key={type.id}
                type="button"
                onClick={() => handleChange('backup_destination_type', type.id)}
                className={`p-4 rounded-lg border-2 transition-all ${
                  formData.backup_destination_type === type.id
                    ? 'border-primary bg-primary-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <Icon className={`h-8 w-8 mb-2 mx-auto ${
                  formData.backup_destination_type === type.id
                    ? 'text-primary'
                    : 'text-gray-400'
                }`} />
                <h4 className="font-medium text-gray-900">{type.name}</h4>
                <p className="text-xs text-gray-500 mt-1">{type.description}</p>
              </button>
            );
          })}
        </div>

        {/* Destination-specific fields */}
        <div className="space-y-4">
          {formData.backup_destination_type === 'local' && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Backup Directory Path
                </label>
                <Input
                  type="text"
                  value={formData.backup_destination_path}
                  onChange={(e) => handleChange('backup_destination_path', e.target.value)}
                  placeholder="/path/to/backup/directory"
                  required
                />
                <p className="mt-1 text-xs text-gray-500">
                  Absolute path where backups will be stored
                </p>
              </div>
            </>
          )}

          {formData.backup_destination_type === 'rsync' && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    SSH Host
                  </label>
                  <Input
                    type="text"
                    value={formData.backup_rsync_host}
                    onChange={(e) => handleChange('backup_rsync_host', e.target.value)}
                    placeholder="backup.example.com"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    SSH User
                  </label>
                  <Input
                    type="text"
                    value={formData.backup_rsync_user}
                    onChange={(e) => handleChange('backup_rsync_user', e.target.value)}
                    placeholder="backup-user"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Remote Path
                </label>
                <Input
                  type="text"
                  value={formData.backup_rsync_path}
                  onChange={(e) => handleChange('backup_rsync_path', e.target.value)}
                  placeholder="/home/backup/photo-sharing"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  SSH Private Key (optional)
                </label>
                <div className="relative">
                  <textarea
                    value={formData.backup_rsync_ssh_key}
                    onChange={(e) => handleChange('backup_rsync_ssh_key', e.target.value)}
                    placeholder="-----BEGIN RSA PRIVATE KEY-----"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary focus:border-primary font-mono text-sm"
                    rows={4}
                  />
                  <button
                    type="button"
                    onClick={() => setShowSecrets(prev => ({ ...prev, ssh_key: !prev.ssh_key }))}
                    className="absolute top-2 right-2 text-gray-400 hover:text-gray-600"
                  >
                    {showSecrets.ssh_key ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  Leave empty to use system SSH keys
                </p>
              </div>
            </>
          )}

          {formData.backup_destination_type === 's3' && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  S3 Endpoint URL
                </label>
                <Input
                  type="text"
                  value={formData.backup_s3_endpoint}
                  onChange={(e) => handleChange('backup_s3_endpoint', e.target.value)}
                  placeholder="https://s3.amazonaws.com"
                  required
                />
                <p className="mt-1 text-xs text-gray-500">
                  Use default for AWS S3, or your provider's endpoint
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Bucket Name
                  </label>
                  <Input
                    type="text"
                    value={formData.backup_s3_bucket}
                    onChange={(e) => handleChange('backup_s3_bucket', e.target.value)}
                    placeholder="my-backup-bucket"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Region
                  </label>
                  <Input
                    type="text"
                    value={formData.backup_s3_region}
                    onChange={(e) => handleChange('backup_s3_region', e.target.value)}
                    placeholder="us-east-1"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Access Key ID
                  </label>
                  <Input
                    type="text"
                    value={formData.backup_s3_access_key}
                    onChange={(e) => handleChange('backup_s3_access_key', e.target.value)}
                    placeholder="AKIAIOSFODNN7EXAMPLE"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Secret Access Key
                  </label>
                  <div className="relative">
                    <Input
                      type={showSecrets.s3_secret_key ? 'text' : 'password'}
                      value={formData.backup_s3_secret_key}
                      onChange={(e) => handleChange('backup_s3_secret_key', e.target.value)}
                      placeholder="wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowSecrets(prev => ({ ...prev, s3_secret_key: !prev.s3_secret_key }))}
                      className="absolute top-1/2 -translate-y-1/2 right-2 text-gray-400 hover:text-gray-600"
                    >
                      {showSecrets.s3_secret_key ? <EyeOff size={20} /> : <Eye size={20} />}
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Test Connection Button */}
          {formData.backup_destination_type && (
            <div className="pt-2">
              <Button
                type="button"
                onClick={testConnection}
                disabled={testingConnection}
                variant="secondary"
                size="sm"
              >
                {testingConnection ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Testing...
                  </>
                ) : (
                  <>
                    <TestTube className="mr-2 h-4 w-4" />
                    Test Connection
                  </>
                )}
              </Button>
            </div>
          )}
        </div>
      </Card>

      {/* Schedule Configuration */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Backup Schedule</h3>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Schedule
            </label>
            <select
              value={formData.backup_schedule}
              onChange={(e) => handleChange('backup_schedule', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary focus:border-primary"
            >
              {scheduleOptions.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {formData.backup_schedule === 'custom' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Cron Expression
              </label>
              <Input
                type="text"
                value={formData.backup_schedule_cron}
                onChange={(e) => handleChange('backup_schedule_cron', e.target.value)}
                placeholder="0 3 * * *"
              />
              <p className="mt-1 text-xs text-gray-500">
                Use standard cron syntax (minute hour day month weekday)
              </p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Retention Period (days)
            </label>
            <Input
              type="number"
              value={formData.backup_retention_days}
              onChange={(e) => handleChange('backup_retention_days', parseInt(e.target.value))}
              min="1"
              max="365"
            />
            <p className="mt-1 text-xs text-gray-500">
              Backups older than this will be automatically deleted
            </p>
          </div>
        </div>
      </Card>

      {/* Backup Content Selection */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Backup Content</h3>
        
        <div className="space-y-3">
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={formData.backup_include_database}
              onChange={(e) => handleChange('backup_include_database', e.target.checked)}
              className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded"
            />
            <div className="ml-3">
              <div className="flex items-center space-x-2">
                <Database className="h-4 w-4 text-gray-400" />
                <span className="text-sm font-medium text-gray-700">Database</span>
              </div>
              <p className="text-xs text-gray-500">All application data and settings</p>
            </div>
          </label>

          <label className="flex items-center">
            <input
              type="checkbox"
              checked={formData.backup_include_photos}
              onChange={(e) => handleChange('backup_include_photos', e.target.checked)}
              className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded"
            />
            <div className="ml-3">
              <div className="flex items-center space-x-2">
                <Image className="h-4 w-4 text-gray-400" />
                <span className="text-sm font-medium text-gray-700">Photos</span>
              </div>
              <p className="text-xs text-gray-500">All uploaded photos and galleries</p>
            </div>
          </label>

          <label className="flex items-center">
            <input
              type="checkbox"
              checked={formData.backup_include_archives}
              onChange={(e) => handleChange('backup_include_archives', e.target.checked)}
              className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded"
            />
            <div className="ml-3">
              <div className="flex items-center space-x-2">
                <FileArchive className="h-4 w-4 text-gray-400" />
                <span className="text-sm font-medium text-gray-700">Archives</span>
              </div>
              <p className="text-xs text-gray-500">Expired gallery archives</p>
            </div>
          </label>

          <label className="flex items-center">
            <input
              type="checkbox"
              checked={formData.backup_include_thumbnails}
              onChange={(e) => handleChange('backup_include_thumbnails', e.target.checked)}
              className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded"
            />
            <div className="ml-3">
              <div className="flex items-center space-x-2">
                <Image className="h-4 w-4 text-gray-400" />
                <span className="text-sm font-medium text-gray-700">Thumbnails</span>
              </div>
              <p className="text-xs text-gray-500">Generated thumbnail images (can be regenerated)</p>
            </div>
          </label>
        </div>
      </Card>

      {/* Advanced Options */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Advanced Options</h3>
        
        <div className="space-y-4">
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={formData.backup_compression}
              onChange={(e) => handleChange('backup_compression', e.target.checked)}
              className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded"
            />
            <div className="ml-3">
              <span className="text-sm font-medium text-gray-700">Enable Compression</span>
              <p className="text-xs text-gray-500">Reduce backup size with gzip compression</p>
            </div>
          </label>

          <div>
            <label className="flex items-center mb-3">
              <input
                type="checkbox"
                checked={formData.backup_encryption}
                onChange={(e) => handleChange('backup_encryption', e.target.checked)}
                className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded"
              />
              <div className="ml-3">
                <span className="text-sm font-medium text-gray-700">Enable Encryption</span>
                <p className="text-xs text-gray-500">Encrypt backups with AES-256</p>
              </div>
            </label>

            {formData.backup_encryption && (
              <div className="ml-7">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Encryption Passphrase
                </label>
                <div className="relative">
                  <Input
                    type={showSecrets.encryption_passphrase ? 'text' : 'password'}
                    value={formData.backup_encryption_passphrase}
                    onChange={(e) => handleChange('backup_encryption_passphrase', e.target.value)}
                    placeholder="Enter a strong passphrase"
                    required={formData.backup_encryption}
                  />
                  <button
                    type="button"
                    onClick={() => setShowSecrets(prev => ({ ...prev, encryption_passphrase: !prev.encryption_passphrase }))}
                    className="absolute top-1/2 -translate-y-1/2 right-2 text-gray-400 hover:text-gray-600"
                  >
                    {showSecrets.encryption_passphrase ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
                <p className="mt-1 text-xs text-red-600">
                  <AlertCircle className="inline h-3 w-3 mr-1" />
                  Store this passphrase securely! You'll need it to restore encrypted backups.
                </p>
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button
          type="submit"
          disabled={isSaving}
        >
          {isSaving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              Save Configuration
            </>
          )}
        </Button>
      </div>
    </form>
  );
};