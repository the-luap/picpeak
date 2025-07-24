import { api } from '../config/api';

export interface PublicSettings {
  branding_company_name: string;
  branding_company_tagline: string;
  branding_support_email: string;
  branding_footer_text: string;
  branding_watermark_enabled: boolean;
  branding_watermark_logo_url: string;
  branding_watermark_position: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left' | 'center';
  branding_watermark_opacity: number;
  branding_watermark_size: number;
  branding_favicon_url: string;
  branding_logo_url: string;
  theme_config: any;
  default_language: string;
  enable_analytics: boolean;
  general_date_format: string | { format: string; locale: string };
  enable_recaptcha: boolean;
  recaptcha_site_key: string | null;
  maintenance_mode: boolean;
  umami_enabled: boolean;
  umami_url: string | null;
  umami_website_id: string | null;
  umami_share_url: string | null;
}

export const publicSettingsService = {
  // Get public settings (no authentication required)
  async getPublicSettings(): Promise<PublicSettings> {
    const response = await api.get<PublicSettings>('/public/settings');
    return response.data;
  }
};