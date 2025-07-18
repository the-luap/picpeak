import React, { useState } from 'react';
import { 
  Mail, 
  Save, 
  Send, 
  Server,
  Lock,
  User,
  AlertCircle,
  CheckCircle,
  Eye,
  EyeOff,
} from 'lucide-react';
import { toast } from 'react-toastify';

import { Button, Input, Card, Loading } from '../../components/common';
import { EmailPreviewModal } from '../../components/admin/EmailPreviewModal';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { emailService, type EmailConfig, type EmailTemplate } from '../../services/email.service';
import { useTranslation } from 'react-i18next';

const defaultTemplateKeys = [
  {
    key: 'gallery_created',
    name: 'Gallery Created',
    subject: 'Your {{event_name}} photos are ready!',
    body: `Hi there!

Your photo gallery for {{event_name}} is now ready to view.

Event: {{event_name}}
Date: {{event_date}}
Password: {{password}}

You can access your photos here: {{gallery_link}}

Your gallery will be available until {{expiration_date}}. Make sure to download your photos before they expire!

{{#if welcome_message}}
Personal message from your host:
{{welcome_message}}
{{/if}}

Best regards,
The Photo Sharing Team`,
    variables: ['event_name', 'event_date', 'password', 'gallery_link', 'expiration_date', 'welcome_message']
  },
  {
    key: 'expiration_warning',
    name: 'Expiration Warning',
    subject: 'Your {{event_name}} photos expire in {{days_remaining}} days!',
    body: `Important: Your photo gallery is expiring soon!

Your photos from {{event_name}} will no longer be available after {{expiration_date}}.

You have {{days_remaining}} days remaining to download your photos.

Access your gallery here: {{gallery_link}}

Don't forget to download all your favorite memories before they're gone!

Best regards,
The Photo Sharing Team`,
    variables: ['event_name', 'days_remaining', 'expiration_date', 'gallery_link']
  },
  {
    key: 'gallery_expired',
    name: 'Gallery Expired',
    subject: 'Your {{event_name}} photo gallery has expired',
    body: `Your photo gallery for {{event_name}} has expired and is no longer accessible.

The photos have been archived for safekeeping. If you need access to them, please contact the event administrator at {{admin_email}}.

Thank you for using our photo sharing service!

Best regards,
The Photo Sharing Team`,
    variables: ['event_name', 'admin_email']
  },
  {
    key: 'archive_complete',
    name: 'Archive Complete (Admin)',
  }
];

export const EmailConfigPage: React.FC = () => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<'smtp' | 'templates'>('smtp');
  const [selectedTemplateKey, setSelectedTemplateKey] = useState<string>('gallery_created');
  const [editedTemplate, setEditedTemplate] = useState<Partial<EmailTemplate>>({});
  const [editingLang, setEditingLang] = useState<'en' | 'de'>('en');
  const [showPassword, setShowPassword] = useState(false);
  const [testEmail, setTestEmail] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [previewData, setPreviewData] = useState<{ subject: string; htmlContent: string; textContent?: string }>({
    subject: '',
    htmlContent: '',
    textContent: ''
  });
  const queryClient = useQueryClient();
  
  // SMTP Configuration state
  const [smtpConfig, setSmtpConfig] = useState<EmailConfig>({
    smtp_host: '',
    smtp_port: 587,
    smtp_secure: false,
    smtp_user: '',
    smtp_pass: '',
    from_email: '',
    from_name: 'Photo Sharing'
  });

  // Fetch SMTP config
  const { isLoading: configLoading } = useQuery({
    queryKey: ['email-config'],
    queryFn: () => emailService.getConfig(),
  });

  // Fetch email templates
  const { data: templates = [], isLoading: templatesLoading } = useQuery({
    queryKey: ['email-templates'],
    queryFn: () => emailService.getTemplates()
  });

  // Fetch selected template details
  const { data: selectedTemplate } = useQuery({
    queryKey: ['email-template', selectedTemplateKey],
    queryFn: () => emailService.getTemplate(selectedTemplateKey),
    enabled: !!selectedTemplateKey && activeTab === 'templates',
  });

  // Update local state when data is fetched
  React.useEffect(() => {
    const fetchConfig = async () => {
      try {
        const config = await emailService.getConfig();
        setSmtpConfig(config);
      } catch (error) {
        // Config might not exist yet
      }
    };
    fetchConfig();
  }, []);

  React.useEffect(() => {
    if (selectedTemplate) {
      setEditedTemplate(selectedTemplate);
    }
  }, [selectedTemplate]);

  // Mutations
  const saveConfigMutation = useMutation({
    mutationFn: (config: EmailConfig) => emailService.updateConfig(config),
    onSuccess: () => {
      toast.success(t('toast.emailConfigSaved'));
      queryClient.invalidateQueries({ queryKey: ['email-config'] });
    },
    onError: () => {
      toast.error(t('toast.saveError'));
    }
  });

  const testEmailMutation = useMutation({
    mutationFn: (email: string) => emailService.testEmail(email),
    onSuccess: () => {
      toast.success(t('email.testEmailSuccess'));
    },
    onError: () => {
      toast.error(t('toast.saveError'));
    }
  });

  const saveTemplateMutation = useMutation({
    mutationFn: ({ key, template }: { key: string; template: Partial<EmailTemplate> }) => 
      emailService.updateTemplate(key, template),
    onSuccess: () => {
      toast.success(t('toast.saveSuccess'));
      queryClient.invalidateQueries({ queryKey: ['email-templates'] });
      queryClient.invalidateQueries({ queryKey: ['email-template', selectedTemplateKey] });
    },
    onError: () => {
      toast.error(t('toast.saveError'));
    }
  });

  const handleSaveSmtp = () => {
    // Validate SMTP config
    if (!smtpConfig.smtp_host || !smtpConfig.smtp_port || !smtpConfig.from_email) {
      toast.error(t('errors.requiredFields'));
      return;
    }

    saveConfigMutation.mutate(smtpConfig);
  };

  const handleTestEmail = () => {
    if (!testEmail) {
      toast.error(t('errors.enterTestEmail'));
      return;
    }

    testEmailMutation.mutate(testEmail);
  };

  const handleSaveTemplate = () => {
    if (selectedTemplateKey && editedTemplate) {
      const templateData: Partial<EmailTemplate> = {};
      
      // Include both language versions
      if (editedTemplate.subject_en !== undefined) templateData.subject_en = editedTemplate.subject_en;
      if (editedTemplate.subject_de !== undefined) templateData.subject_de = editedTemplate.subject_de;
      if (editedTemplate.body_html_en !== undefined) templateData.body_html_en = editedTemplate.body_html_en;
      if (editedTemplate.body_html_de !== undefined) templateData.body_html_de = editedTemplate.body_html_de;
      if (editedTemplate.body_text_en !== undefined) templateData.body_text_en = editedTemplate.body_text_en;
      if (editedTemplate.body_text_de !== undefined) templateData.body_text_de = editedTemplate.body_text_de;
      
      saveTemplateMutation.mutate({ 
        key: selectedTemplateKey, 
        template: templateData
      });
    }
  };

  const handlePreviewTemplate = async () => {
    if (!selectedTemplateKey || !editedTemplate) return;

    // Generate sample data based on the template
    const sampleData: Record<string, string> = {
      event_name: 'John & Jane Wedding',
      event_date: 'December 25, 2024',
      password: 'wedding2024',
      gallery_link: 'https://photos.example.com/gallery/john-jane-wedding',
      expiration_date: 'January 25, 2025',
      welcome_message: 'Thank you for celebrating our special day with us!',
      days_remaining: '30',
      admin_email: 'admin@example.com',
      host_email: 'host@example.com'
    };

    try {
      const preview = await emailService.previewTemplate(selectedTemplateKey, sampleData, editingLang);
      setPreviewData({
        subject: preview.subject,
        htmlContent: preview.body_html,
        textContent: preview.body_text
      });
      setShowPreview(true);
    } catch (error) {
      toast.error(t('toast.saveError'));
    }
  };

  const renderVariableHelp = () => {
    const variables = editedTemplate.variables || [];
    return (
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="text-sm font-semibold text-blue-900 mb-2">{t('email.templateVariables')}</h4>
        <div className="grid grid-cols-2 gap-2 text-sm">
          {variables.map(variable => (
            <code key={variable} className="text-blue-700 bg-blue-100 px-2 py-1 rounded">
              {`{{${variable}}}`}
            </code>
          ))}
        </div>
        <p className="text-xs text-blue-700 mt-2">
          {t('email.variableHelp')}
        </p>
      </div>
    );
  };

  if (configLoading || templatesLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loading size="lg" text={t('email.loadingSettings')} />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-neutral-900">{t('email.title')}</h1>
        <p className="text-neutral-600 mt-1">{t('email.subtitle')}</p>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-neutral-200 mb-6">
        <nav className="-mb-px flex gap-6">
          <button
            onClick={() => setActiveTab('smtp')}
            className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'smtp'
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-neutral-500 hover:text-neutral-700'
            }`}
          >
            {t('email.smtpSettings')}
          </button>
          <button
            onClick={() => setActiveTab('templates')}
            className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'templates'
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-neutral-500 hover:text-neutral-700'
            }`}
          >
            {t('email.emailTemplates')}
          </button>
        </nav>
      </div>

      {/* SMTP Settings Tab */}
      {activeTab === 'smtp' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card padding="md">
            <h2 className="text-lg font-semibold text-neutral-900 mb-4">{t('email.smtpConfiguration')}</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">
                  {t('email.smtpHost')} <span className="text-red-500">*</span>
                </label>
                <Input
                  type="text"
                  value={smtpConfig.smtp_host}
                  onChange={(e) => setSmtpConfig(prev => ({ ...prev, smtp_host: e.target.value }))}
                  placeholder="smtp.gmail.com"
                  leftIcon={<Server className="w-5 h-5 text-neutral-400" />}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">
                    {t('email.port')} <span className="text-red-500">*</span>
                  </label>
                  <Input
                    type="number"
                    value={smtpConfig.smtp_port}
                    onChange={(e) => setSmtpConfig(prev => ({ ...prev, smtp_port: parseInt(e.target.value) || 587 }))}
                    placeholder="587"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">
                    {t('email.security')}
                  </label>
                  <select
                    value={smtpConfig.smtp_secure ? 'ssl' : 'tls'}
                    onChange={(e) => setSmtpConfig(prev => ({ ...prev, smtp_secure: e.target.value === 'ssl' }))}
                    className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  >
                    <option value="tls">TLS</option>
                    <option value="ssl">SSL</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">
                  {t('email.username')}
                </label>
                <Input
                  type="text"
                  value={smtpConfig.smtp_user}
                  onChange={(e) => setSmtpConfig(prev => ({ ...prev, smtp_user: e.target.value }))}
                  placeholder="your-email@gmail.com"
                  leftIcon={<User className="w-5 h-5 text-neutral-400" />}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">
                  {t('email.password')}
                </label>
                <div className="relative">
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    value={smtpConfig.smtp_pass}
                    onChange={(e) => setSmtpConfig(prev => ({ ...prev, smtp_pass: e.target.value }))}
                    placeholder={t('email.enterPassword')}
                    leftIcon={<Lock className="w-5 h-5 text-neutral-400" />}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-3 text-neutral-400 hover:text-neutral-600"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">
                  {t('email.fromEmail')} <span className="text-red-500">*</span>
                </label>
                <Input
                  type="email"
                  value={smtpConfig.from_email}
                  onChange={(e) => setSmtpConfig(prev => ({ ...prev, from_email: e.target.value }))}
                  placeholder="noreply@yourdomain.com"
                  leftIcon={<Mail className="w-5 h-5 text-neutral-400" />}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">
                  {t('email.fromName')}
                </label>
                <Input
                  type="text"
                  value={smtpConfig.from_name}
                  onChange={(e) => setSmtpConfig(prev => ({ ...prev, from_name: e.target.value }))}
                  placeholder="Photo Sharing"
                />
              </div>

              <Button
                variant="primary"
                onClick={handleSaveSmtp}
                isLoading={saveConfigMutation.isPending}
                leftIcon={<Save className="w-5 h-5" />}
                className="w-full"
              >
                {t('email.saveSmtpSettings')}
              </Button>
            </div>
          </Card>

          <Card padding="md">
            <h2 className="text-lg font-semibold text-neutral-900 mb-4">{t('email.testEmailSection')}</h2>
            
            <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0" />
                <div className="text-sm text-amber-800">
                  <p className="font-medium">{t('email.beforeTesting')}</p>
                  <ul className="list-disc list-inside mt-1">
                    <li>{t('email.saveSmtpFirst')}</li>
                    <li>{t('email.ensureFirewall')}</li>
                    <li>{t('email.gmailAppPassword')}</li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">
                  {t('email.testEmailAddressLabel')}
                </label>
                <Input
                  type="email"
                  value={testEmail}
                  onChange={(e) => setTestEmail(e.target.value)}
                  placeholder="test@example.com"
                  leftIcon={<Mail className="w-5 h-5 text-neutral-400" />}
                />
              </div>

              <Button
                variant="outline"
                onClick={handleTestEmail}
                isLoading={testEmailMutation.isPending}
                leftIcon={<Send className="w-5 h-5" />}
                className="w-full"
              >
                {t('email.sendTestEmailButton')}
              </Button>
            </div>

            <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
                <div className="text-sm text-green-800">
                  <p className="font-medium">{t('email.commonSmtpSettings')}</p>
                  <ul className="mt-2 space-y-1">
                    <li><strong>Gmail:</strong> smtp.gmail.com:587 (TLS)</li>
                    <li><strong>Outlook:</strong> smtp-mail.outlook.com:587 (TLS)</li>
                    <li><strong>SendGrid:</strong> smtp.sendgrid.net:587 (TLS)</li>
                  </ul>
                </div>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Email Templates Tab */}
      {activeTab === 'templates' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card padding="sm">
            <h3 className="text-lg font-semibold text-neutral-900 mb-4">{t('email.templates')}</h3>
            <div className="space-y-2">
              {templates.map(template => {
                const templateInfo = defaultTemplateKeys.find(t => t.key === template.template_key);
                return (
                  <button
                    key={template.template_key}
                    onClick={() => {
                      setSelectedTemplateKey(template.template_key);
                      setEditedTemplate(template);
                    }}
                    className={`w-full text-left p-3 rounded-lg transition-colors ${
                      selectedTemplateKey === template.template_key
                        ? 'bg-primary-50 border-2 border-primary-600'
                        : 'bg-neutral-50 border-2 border-transparent hover:bg-neutral-100'
                    }`}
                  >
                    <p className="font-medium text-neutral-900">
                      {templateInfo?.name || template.template_key}
                    </p>
                    <p className="text-sm text-neutral-500 mt-1 truncate">
                      {template.subject_en || template.subject}
                    </p>
                  </button>
                );
              })}
            </div>
          </Card>

          <div className="lg:col-span-2">
            <Card padding="md">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-neutral-900">{t('email.editTemplate')}</h3>
                <div className="flex gap-2">
                  <div className="flex gap-1 mr-4">
                    <button
                      onClick={() => setEditingLang('en')}
                      className={`px-3 py-1 text-sm font-medium rounded-lg transition-colors ${
                        editingLang === 'en'
                          ? 'bg-primary-100 text-primary-700'
                          : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
                      }`}
                    >
                      🇬🇧 English
                    </button>
                    <button
                      onClick={() => setEditingLang('de')}
                      className={`px-3 py-1 text-sm font-medium rounded-lg transition-colors ${
                        editingLang === 'de'
                          ? 'bg-primary-100 text-primary-700'
                          : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
                      }`}
                    >
                      🇩🇪 Deutsch
                    </button>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handlePreviewTemplate}
                    leftIcon={<Eye className="w-4 h-4" />}
                  >
                    {t('email.preview')}
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={handleSaveTemplate}
                    isLoading={saveTemplateMutation.isPending}
                    leftIcon={<Save className="w-4 h-4" />}
                  >
                    {t('email.saveChanges')}
                  </Button>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">
                    {t('email.templateName')}
                  </label>
                  <Input
                    type="text"
                    value={defaultTemplateKeys.find(t => t.key === selectedTemplateKey)?.name || selectedTemplateKey}
                    disabled
                    className="bg-neutral-50"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">
                    {t('email.subjectLine')} ({editingLang === 'en' ? 'English' : 'German'})
                  </label>
                  <Input
                    type="text"
                    value={
                      editingLang === 'en' 
                        ? (editedTemplate.subject_en || editedTemplate.subject || '')
                        : (editedTemplate.subject_de || '')
                    }
                    onChange={(e) => setEditedTemplate(prev => ({ 
                      ...prev, 
                      [editingLang === 'en' ? 'subject_en' : 'subject_de']: e.target.value 
                    }))}
                    placeholder="Email subject"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">
                    {t('email.emailBody')} ({editingLang === 'en' ? 'English' : 'German'})
                  </label>
                  <textarea
                    value={
                      editingLang === 'en' 
                        ? (editedTemplate.body_html_en || editedTemplate.body_html || '')
                        : (editedTemplate.body_html_de || '')
                    }
                    onChange={(e) => setEditedTemplate(prev => ({ 
                      ...prev, 
                      [editingLang === 'en' ? 'body_html_en' : 'body_html_de']: e.target.value 
                    }))}
                    rows={15}
                    className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 font-mono text-sm"
                  />
                </div>

                {renderVariableHelp()}
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* Email Preview Modal */}
      <EmailPreviewModal
        isOpen={showPreview}
        onClose={() => setShowPreview(false)}
        subject={previewData.subject}
        htmlContent={previewData.htmlContent}
        textContent={previewData.textContent}
      />
    </div>
  );
};