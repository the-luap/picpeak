import { api } from '../config/api';

export interface EmailConfig {
  smtp_host: string;
  smtp_port: number;
  smtp_secure: boolean;
  smtp_user: string;
  smtp_pass: string;
  from_email: string;
  from_name: string;
  tls_reject_unauthorized: boolean;
}

export interface EmailTemplate {
  id: number;
  template_key: string;
  subject: string; // For backward compatibility
  body_html: string; // For backward compatibility
  body_text?: string; // For backward compatibility
  subject_en: string;
  subject_de: string;
  body_html_en: string;
  body_html_de: string;
  body_text_en?: string;
  body_text_de?: string;
  variables: string[];
  updated_at: string;
}

export interface EmailPreview {
  subject: string;
  body_html: string;
  body_text: string;
}

export const emailService = {
  // Get email configuration
  async getConfig(): Promise<EmailConfig> {
    const response = await api.get<EmailConfig>('/admin/email/config');
    return response.data;
  },

  // Update email configuration
  async updateConfig(config: EmailConfig): Promise<void> {
    await api.post('/admin/email/config', config);
  },

  // Test email configuration
  async testEmail(testEmail: string): Promise<void> {
    await api.post('/admin/email/test', { test_email: testEmail });
  },

  // Get all email templates
  async getTemplates(): Promise<EmailTemplate[]> {
    const response = await api.get<EmailTemplate[]>('/admin/email/templates');
    return response.data;
  },

  // Get single template
  async getTemplate(key: string): Promise<EmailTemplate> {
    const response = await api.get<EmailTemplate>(`/admin/email/templates/${key}`);
    return response.data;
  },

  // Update email template
  async updateTemplate(key: string, template: Partial<EmailTemplate>): Promise<void> {
    await api.put(`/admin/email/templates/${key}`, template);
  },

  // Preview email template
  async previewTemplate(key: string, previewData: Record<string, string>, language: 'en' | 'de' = 'en'): Promise<EmailPreview> {
    const response = await api.post<EmailPreview>(
      `/admin/email/templates/${key}/preview`,
      { preview_data: previewData, language }
    );
    return response.data;
  }
};