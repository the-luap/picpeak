import { api } from '../config/api';

export interface BrandingSettings {
  company_name: string;
  company_tagline: string;
  support_email: string;
  footer_text: string;
  watermark_enabled: boolean;
  watermark_position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left' | 'center';
  watermark_opacity?: number;
  watermark_size?: number;
  watermark_logo_url?: string;
  logo_url?: string;
  favicon_url?: string;
}

export interface ThemeSettings {
  name?: string;
  primaryColor?: string;
  accentColor?: string;
  backgroundColor?: string;
  textColor?: string;
  fontFamily?: string;
  borderRadius?: 'none' | 'sm' | 'md' | 'lg';
  customCss?: string;
}

export interface StorageInfo {
  total_used: number;
  archive_storage: number;
  storage_by_event: Array<{
    event_name: string;
    id: number;
    size: number;
  }>;
  storage_limit: number;
}

export interface SystemStatus {
  database: {
    size: number;
    tables: {
      events: number;
      photos: number;
      admins: number;
      categories: number;
      activityLogs: number;
    };
  };
  storage: {
    totalUsed: number;
    photoStorage: number;
    archiveStorage: number;
  };
  emailQueue: {
    pending: number;
    processable: number;
    stuck: number;
    sent: number;
    failed: number;
  };
  system: {
    platform: string;
    arch: string;
    hostname: string;
    uptime: number;
    nodeVersion: string;
    memory: {
      total: number;
      free: number;
      used: number;
    };
    cpu: {
      model: string;
      cores: number;
    };
  };
  services: {
    fileWatcher: { status: string };
    expirationChecker: { status: string };
    emailProcessor: { status: string };
  };
  timestamp: string;
}

export const settingsService = {
  // Get all settings
  async getAllSettings(): Promise<Record<string, any>> {
    const response = await api.get<Record<string, any>>('/admin/settings');
    return response.data;
  },

  // Get settings by type
  async getSettingsByType(type: 'branding' | 'theme' | 'general'): Promise<Record<string, any>> {
    const response = await api.get<Record<string, any>>(`/admin/settings/${type}`);
    return response.data;
  },

  // Update branding settings
  async updateBranding(settings: BrandingSettings): Promise<void> {
    await api.put('/admin/settings/branding', settings);
  },

  // Upload logo
  async uploadLogo(file: File): Promise<string> {
    const formData = new FormData();
    formData.append('logo', file);
    
    const response = await api.post<{ logoUrl: string }>(
      '/admin/settings/logo',
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      }
    );
    
    return response.data.logoUrl;
  },

  // Upload favicon
  async uploadFavicon(file: File): Promise<string> {
    const formData = new FormData();
    formData.append('favicon', file);
    
    const response = await api.post<{ faviconUrl: string }>(
      '/admin/settings/favicon',
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      }
    );
    
    return response.data.faviconUrl;
  },

  // Upload watermark logo
  async uploadWatermarkLogo(file: File): Promise<string> {
    const formData = new FormData();
    formData.append('watermarkLogo', file);
    
    const response = await api.post<{ watermarkLogoUrl: string }>(
      '/admin/settings/branding/watermark-logo',
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      }
    );
    
    return response.data.watermarkLogoUrl;
  },

  // Update theme settings
  async updateTheme(settings: ThemeSettings): Promise<void> {
    await api.put('/admin/settings/theme', settings);
  },

  // Update multiple settings at once
  async updateSettings(settings: Record<string, any>): Promise<void> {
    // Determine the endpoint based on setting keys
    const firstKey = Object.keys(settings)[0];
    let endpoint = '/admin/settings/general';
    
    if (firstKey?.startsWith('security_')) {
      endpoint = '/admin/settings/security';
    } else if (firstKey?.startsWith('analytics_')) {
      endpoint = '/admin/settings/analytics';
    } else if (firstKey?.startsWith('branding_')) {
      endpoint = '/admin/settings/branding';
    }
    
    await api.put(endpoint, settings);
  },

  // Get storage information
  async getStorageInfo(): Promise<StorageInfo> {
    const response = await api.get<StorageInfo>('/admin/settings/storage/info');
    return response.data;
  },

  // Get system status
  async getSystemStatus(): Promise<SystemStatus> {
    const response = await api.get<SystemStatus>('/admin/system/status');
    return response.data;
  },

  // Format branding settings from raw data
  formatBrandingSettings(rawSettings: Record<string, any>): BrandingSettings {
    return {
      company_name: rawSettings.branding_company_name || '',
      company_tagline: rawSettings.branding_company_tagline || '',
      support_email: rawSettings.branding_support_email || '',
      footer_text: rawSettings.branding_footer_text || '',
      watermark_enabled: rawSettings.branding_watermark_enabled || false,
      watermark_position: rawSettings.branding_watermark_position || 'bottom-right',
      watermark_opacity: rawSettings.branding_watermark_opacity || 50,
      watermark_size: rawSettings.branding_watermark_size || 15,
      watermark_logo_url: rawSettings.branding_watermark_logo_url || undefined,
      logo_url: rawSettings.branding_logo_url || undefined,
      favicon_url: rawSettings.branding_favicon_url || undefined
    };
  },

  // Format theme settings from raw data
  formatThemeSettings(rawSettings: Record<string, any>): ThemeSettings {
    return rawSettings.theme_config || {};
  },

  // Format bytes to human readable
  formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
};