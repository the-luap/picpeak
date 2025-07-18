import { api } from '../config/api';

export interface DashboardStats {
  activeEvents: number;
  expiringEvents: number;
  totalPhotos: number;
  storageUsed: number;
  totalViews: number;
  totalDownloads: number;
  viewsTrend: number;
  downloadsTrend: number;
  archivedEvents: number;
}

export interface SystemHealth {
  overall: 'healthy' | 'warning' | 'error';
  services: {
    database: 'healthy' | 'warning' | 'error';
    email: 'healthy' | 'warning' | 'error';
    storage: 'healthy' | 'warning' | 'error';
    memory: 'healthy' | 'warning' | 'error';
  };
  details: {
    emailQueue: {
      pending: number;
      processable: number;
      stuck: number;
      sent: number;
      failed: number;
    };
    memory: {
      total: number;
      free: number;
      used: number;
      percentage: number;
    };
  };
}

export interface Activity {
  id: number;
  type: string;
  actorType: string;
  actorName: string;
  eventName?: string;
  metadata: Record<string, any>;
  createdAt: string;
}

export interface AnalyticsData {
  chartData: Array<{
    date: string;
    views: number;
    downloads: number;
    uniqueVisitors: number;
  }>;
  topGalleries: Array<{
    event_name: string;
    slug: string;
    views: number;
  }>;
  devices: {
    desktop: number;
    mobile: number;
    tablet: number;
  };
}

export const adminService = {
  // Dashboard statistics
  async getDashboardStats(): Promise<DashboardStats> {
    const response = await api.get<DashboardStats>('/admin/dashboard/stats');
    return response.data;
  },

  // Recent activity
  async getRecentActivity(limit: number = 10): Promise<Activity[]> {
    const response = await api.get<Activity[]>('/admin/dashboard/activity', {
      params: { limit }
    });
    return response.data;
  },

  // Analytics data
  async getAnalytics(days: number = 7): Promise<AnalyticsData> {
    const response = await api.get<AnalyticsData>('/admin/dashboard/analytics', {
      params: { days }
    });
    return response.data;
  },

  // System health check
  async getSystemHealth(): Promise<SystemHealth> {
    const response = await api.get<SystemHealth>('/admin/dashboard/health');
    return response.data;
  },

  // Format activity message
  formatActivityMessage(activity: Activity): string {
    const messages: Record<string, string> = {
      'event_created': `New event created: ${activity.eventName || 'Unknown'}`,
      'photos_uploaded': `${activity.metadata.count || 0} photos uploaded to ${activity.eventName || 'Unknown'}`,
      'event_archived': `Event archived: ${activity.eventName || 'Unknown'}`,
      'archive_restored': `Archive restored: ${activity.eventName || 'Unknown'}`,
      'archive_deleted': `Archive deleted: ${activity.metadata.event_name || 'Unknown'}`,
      'archive_downloaded': `Archive downloaded: ${activity.eventName || 'Unknown'}`,
      'email_config_updated': 'Email configuration updated',
      'email_template_updated': `Email template updated: ${activity.metadata.template_key || ''}`,
      'branding_updated': 'Branding settings updated',
      'theme_updated': 'Theme settings updated',
      'bulk_download': `${activity.metadata.photo_count || 0} photos downloaded from ${activity.eventName || 'Unknown'}`,
      'gallery_password_entry': `Password entered for ${activity.eventName || 'Unknown'}`,
      'expiration_warning_viewed': `Expiration warning viewed for ${activity.eventName || 'Unknown'}`
    };

    return messages[activity.type] || activity.type;
  },

  // Format bytes to human readable
  formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  },

  // Change password
  async changePassword(data: { currentPassword: string; newPassword: string }): Promise<void> {
    await api.post('/admin/auth/change-password', data);
  }
};