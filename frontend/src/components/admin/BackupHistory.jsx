import React, { useState } from 'react';
import {
  Download,
  Eye,
  Trash2,
  Search,
  Filter,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  FileArchive,
  Database,
  Image,
  HardDrive,
  ChevronDown,
  ChevronUp,
  Calendar,
  RefreshCw,
  Loader2
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { toast } from 'react-toastify';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button, Card, Input, Loading } from '../common';
import { api } from '../../config/api';

const statusIcons = {
  completed: { icon: CheckCircle, color: 'text-green-500' },
  failed: { icon: XCircle, color: 'text-red-500' },
  running: { icon: Loader2, color: 'text-blue-500 animate-spin' },
  partial: { icon: AlertCircle, color: 'text-amber-500' }
};

const formatBytes = (bytes) => {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
};

export const BackupHistory = () => {
  const [expandedRows, setExpandedRows] = useState(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const queryClient = useQueryClient();

  // Fetch backup history
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['backup-history', currentPage, searchTerm, filterStatus],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: currentPage,
        limit: 20,
        ...(searchTerm && { search: searchTerm }),
        ...(filterStatus !== 'all' && { status: filterStatus })
      });
      const response = await api.get(`/admin/backup/status?${params}`);
      return response.data;
    }
  });

  // Delete backup mutation
  const deleteMutation = useMutation({
    mutationFn: async (backupId) => {
      const response = await api.delete(`/admin/backup/runs/${backupId}`);
      return response.data;
    },
    onSuccess: () => {
      toast.success('Backup deleted successfully');
      queryClient.invalidateQueries({ queryKey: ['backup-history'] });
    },
    onError: (error) => {
      toast.error(error.response?.data?.error || 'Failed to delete backup');
    }
  });

  const toggleRowExpansion = (id) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedRows(newExpanded);
  };

  const handleDelete = (backup) => {
    if (window.confirm(`Are you sure you want to delete this backup from ${format(new Date(backup.created_at), 'PPP')}?`)) {
      deleteMutation.mutate(backup.id);
    }
  };

  if (isLoading) {
    return <Loading />;
  }

  const backups = data?.recentBackups || [];
  const pagination = data?.pagination || {};

  return (
    <div className="space-y-6">
      {/* Search and Filters */}
      <Card className="p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                type="text"
                placeholder={t('backup.history.searchPlaceholder')}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
          
          <div className="flex gap-2">
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary focus:border-primary"
            >
              <option value="all">All Status</option>
              <option value="completed">Completed</option>
              <option value="failed">Failed</option>
              <option value="running">Running</option>
              <option value="partial">Partial</option>
            </select>
            
            <Button
              onClick={() => refetch()}
              variant="secondary"
              size="sm"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </Card>

      {/* Backup History Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('backup.history.columns.status')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('backup.history.columns.dateTime')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('backup.history.columns.type')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('backup.history.columns.size')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('backup.history.columns.duration')}
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('backup.history.columns.actions')}
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {backups.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                    <FileArchive className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                    <p className="text-lg font-medium">No backups found</p>
                    <p className="text-sm mt-1">Backups will appear here once created</p>
                  </td>
                </tr>
              ) : (
                backups.map((backup) => {
                  const StatusIcon = statusIcons[backup.status]?.icon || AlertCircle;
                  const statusColor = statusIcons[backup.status]?.color || 'text-gray-500';
                  const isExpanded = expandedRows.has(backup.id);
                  const stats = backup.statistics || {};

                  return (
                    <React.Fragment key={backup.id}>
                      <tr className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <StatusIcon className={`h-5 w-5 ${statusColor}`} />
                            <span className="ml-2 text-sm font-medium text-gray-900 capitalize">
                              {backup.status}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div>
                            <p className="text-sm font-medium text-gray-900">
                              {format(new Date(backup.created_at), 'PPP')}
                            </p>
                            <p className="text-xs text-gray-500">
                              {format(new Date(backup.created_at), 'p')} • {formatDistanceToNow(new Date(backup.created_at), { addSuffix: true })}
                            </p>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 capitalize">
                            {backup.backup_type || 'Manual'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <p className="text-sm text-gray-900">
                            {formatBytes(stats.total_size || 0)}
                          </p>
                          <p className="text-xs text-gray-500">
                            {stats.files_processed || 0} {t('backup.dashboard.stats.files')}
                          </p>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {backup.duration_seconds 
                            ? `${Math.round(backup.duration_seconds / 60)}m ${backup.duration_seconds % 60}s`
                            : '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <div className="flex items-center justify-end space-x-2">
                            <button
                              onClick={() => toggleRowExpansion(backup.id)}
                              className="text-gray-400 hover:text-gray-600"
                              title={t('backup.actions.view')}
                            >
                              {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                            </button>
                            {backup.manifest_path && (
                              <button
                                onClick={() => window.open(`/admin/backup/download/${backup.id}`, '_blank')}
                                className="text-gray-400 hover:text-gray-600"
                                title={t('backup.actions.download')}
                              >
                                <Download size={20} />
                              </button>
                            )}
                            <button
                              onClick={() => handleDelete(backup)}
                              className="text-gray-400 hover:text-red-600"
                              title={t('backup.actions.delete')}
                              disabled={deleteMutation.isLoading}
                            >
                              <Trash2 size={20} />
                            </button>
                          </div>
                        </td>
                      </tr>
                      
                      {/* Expanded Details Row */}
                      {isExpanded && (
                        <tr>
                          <td colSpan={6} className="px-6 py-4 bg-gray-50">
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                              {/* Backup Details */}
                              <div className="space-y-2">
                                <h4 className="font-medium text-gray-900">{t('backup.history.details.backupDetails')}</h4>
                                <div className="text-sm space-y-1">
                                  <div className="flex justify-between">
                                    <span className="text-gray-500">{t('backup.history.details.destination')}:</span>
                                    <span className="text-gray-900">{backup.destination_type || 'Unknown'}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-gray-500">{t('backup.history.details.started')}:</span>
                                    <span className="text-gray-900">{format(new Date(backup.created_at), 'p')}</span>
                                  </div>
                                  {backup.completed_at && (
                                    <div className="flex justify-between">
                                      <span className="text-gray-500">{t('backup.history.details.completed')}:</span>
                                      <span className="text-gray-900">{format(new Date(backup.completed_at), 'p')}</span>
                                    </div>
                                  )}
                                </div>
                              </div>

                              {/* Content Backed Up */}
                              <div className="space-y-2">
                                <h4 className="font-medium text-gray-900">{t('backup.history.details.contentBackedUp')}</h4>
                                <div className="space-y-2">
                                  <div className="flex items-center space-x-2">
                                    <Database className={`h-4 w-4 ${stats.database_backed_up ? 'text-green-500' : 'text-gray-300'}`} />
                                    <span className="text-sm text-gray-700">{t('backup.configuration.whatToBackup.database')}</span>
                                  </div>
                                  <div className="flex items-center space-x-2">
                                    <Image className={`h-4 w-4 ${stats.photos_backed_up > 0 ? 'text-green-500' : 'text-gray-300'}`} />
                                    <span className="text-sm text-gray-700">
                                      Photos ({stats.photos_backed_up || 0} of {stats.total_photos || 0})
                                    </span>
                                  </div>
                                  <div className="flex items-center space-x-2">
                                    <FileArchive className={`h-4 w-4 ${stats.archives_backed_up > 0 ? 'text-green-500' : 'text-gray-300'}`} />
                                    <span className="text-sm text-gray-700">
                                      Archives ({stats.archives_backed_up || 0})
                                    </span>
                                  </div>
                                </div>
                              </div>

                              {/* Error Information */}
                              {backup.error_message && (
                                <div className="space-y-2">
                                  <h4 className="font-medium text-red-900">{t('backup.history.details.errorDetails')}</h4>
                                  <p className="text-sm text-red-700 bg-red-50 p-2 rounded">
                                    {backup.error_message}
                                  </p>
                                </div>
                              )}

                              {/* Manifest Path */}
                              {backup.manifest_path && (
                                <div className="space-y-2">
                                  <h4 className="font-medium text-gray-900">{t('backup.history.details.manifest')}</h4>
                                  <p className="text-sm text-gray-600 font-mono break-all">
                                    {backup.manifest_path}
                                  </p>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination.pages > 1 && (
          <div className="bg-white px-4 py-3 border-t border-gray-200 sm:px-6">
            <div className="flex items-center justify-between">
              <div className="flex-1 flex justify-between sm:hidden">
                <Button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  variant="secondary"
                  size="sm"
                >
                  {t('backup.history.pagination.previous')}
                </Button>
                <Button
                  onClick={() => setCurrentPage(p => Math.min(pagination.pages, p + 1))}
                  disabled={currentPage === pagination.pages}
                  variant="secondary"
                  size="sm"
                >
                  {t('backup.history.pagination.next')}
                </Button>
              </div>
              <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm text-gray-700">
                    {t('backup.history.pagination.showing', {
                      from: (currentPage - 1) * pagination.limit + 1,
                      to: Math.min(currentPage * pagination.limit, pagination.total),
                      total: pagination.total
                    })}
                  </p>
                </div>
                <div>
                  <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                    <button
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {t('backup.history.pagination.previous')}
                    </button>
                    
                    {[...Array(Math.min(5, pagination.pages))].map((_, i) => {
                      const pageNum = i + 1;
                      return (
                        <button
                          key={pageNum}
                          onClick={() => setCurrentPage(pageNum)}
                          className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                            currentPage === pageNum
                              ? 'z-10 bg-primary-50 border-primary text-primary'
                              : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                          }`}
                        >
                          {pageNum}
                        </button>
                      );
                    })}
                    
                    <button
                      onClick={() => setCurrentPage(p => Math.min(pagination.pages, p + 1))}
                      disabled={currentPage === pagination.pages}
                      className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {t('backup.history.pagination.next')}
                    </button>
                  </nav>
                </div>
              </div>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
};