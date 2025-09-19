import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Calendar,
  Mail,
  Lock,
  Clock,
  ArrowLeft,
  Palette,
  Eye,
  EyeOff
} from 'lucide-react';
import { addDays } from 'date-fns';
import { toast } from 'react-toastify';

import { Button, Input, Card, PasswordGenerator } from '../../components/common';
import { ThemeCustomizerEnhanced, GalleryPreview, WelcomeMessageEditor, FeedbackSettings } from '../../components/admin';
import { useMutation, useQuery } from '@tanstack/react-query';
import { eventsService } from '../../services/events.service';
import { useLocalizedDate } from '../../hooks/useLocalizedDate';
import { categoriesService } from '../../services/categories.service';
import { settingsService } from '../../services/settings.service';
import { useTranslation } from 'react-i18next';
import { ThemeConfig, GALLERY_THEME_PRESETS } from '../../types/theme.types';

interface FormData {
  event_type: string;
  event_name: string;
  event_date: string;
  host_name: string;
  host_email: string;
  admin_email: string;
  password: string;
  confirm_password: string;
  welcome_message: string;
  theme_preset: string;
  theme_config: ThemeConfig;
  expires_in_days: number;
  allow_user_uploads: boolean;
  upload_category_id: number | null;
  feedback_settings: {
    feedback_enabled: boolean;
    allow_ratings: boolean;
    allow_likes: boolean;
    allow_comments: boolean;
    allow_favorites: boolean;
    require_name_email: boolean;
    moderate_comments: boolean;
    show_feedback_to_guests: boolean;
    enable_rate_limiting: boolean;
    rate_limit_window_minutes?: number;
    rate_limit_max_requests?: number;
  };
}

const EVENT_TYPE_PRESETS: Record<string, string> = {
  wedding: 'elegantWedding',
  birthday: 'birthdayFun',
  corporate: 'corporateTimeline',
  other: 'default'
};

const EVENT_TYPES = [
  { value: 'wedding', labelKey: 'events.types.wedding', emoji: '💒' },
  { value: 'birthday', labelKey: 'events.types.birthday', emoji: '🎂' },
  { value: 'corporate', labelKey: 'events.types.corporate', emoji: '🏢' },
  { value: 'other', labelKey: 'events.types.other', emoji: '📸' },
];

export const CreateEventPageEnhanced: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { format } = useLocalizedDate();
  const isMountedRef = useRef(true);
  const [showThemeCustomizer, setShowThemeCustomizer] = useState(false);
  // const [showPreview, setShowPreview] = useState(false);
  
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);
  
  const [formData, setFormData] = useState<FormData>({
    event_type: 'wedding',
    event_name: '',
    event_date: new Date().toISOString().split('T')[0], // Initialize with ISO date format
    host_name: '',
    host_email: '',
    admin_email: '',
    password: '',
    confirm_password: '',
    welcome_message: '',
    theme_preset: 'elegantWedding',
    theme_config: GALLERY_THEME_PRESETS.elegantWedding.config,
    expires_in_days: 30,
    allow_user_uploads: false,
    upload_category_id: null,
    feedback_settings: {
      feedback_enabled: false,
      allow_ratings: true,
      allow_likes: true,
      allow_comments: true,
      allow_favorites: true,
      require_name_email: false,
      moderate_comments: true,
      show_feedback_to_guests: true,
      enable_rate_limiting: true,
      rate_limit_window_minutes: 15,
      rate_limit_max_requests: 10,
    },
  });
  
  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({});
  const [showPassword, setShowPassword] = useState(false);

  // Fetch categories for user upload selection
  const { data: categories } = useQuery({
    queryKey: ['categories', 'global'],
    queryFn: () => categoriesService.getGlobalCategories()
  });

  // Fetch default settings
  const { data: settings } = useQuery({
    queryKey: ['admin-settings'],
    queryFn: () => settingsService.getAllSettings()
  });

  // Update default expiration days when settings are loaded
  useEffect(() => {
    if (settings?.general_default_expiration_days) {
      setFormData(prev => ({
        ...prev,
        expires_in_days: settings.general_default_expiration_days
      }));
    }
  }, [settings]);

  // Update theme when event type changes
  useEffect(() => {
    const recommendedPreset = EVENT_TYPE_PRESETS[formData.event_type];
    if (recommendedPreset && GALLERY_THEME_PRESETS[recommendedPreset]) {
      setFormData(prev => ({
        ...prev,
        theme_preset: recommendedPreset,
        theme_config: GALLERY_THEME_PRESETS[recommendedPreset].config
      }));
    }
  }, [formData.event_type]);

  const createMutation = useMutation({
    mutationFn: eventsService.createEvent,
    onSuccess: (data) => {
      if (isMountedRef.current) {
        toast.success(t('toast.eventCreated'));
        navigate(`/admin/events/${data.id}`);
      }
    },
    onError: (error: any) => {
      const errorMessage = error.response?.data?.error || error.message || t('errors.eventCreationFailed');
      
      // If validation errors exist, show them
      if (error.response?.data?.errors) {
        const validationErrors = error.response.data.errors;
        validationErrors.forEach((err: any) => {
          toast.error(`${err.param}: ${err.msg}`);
        });
      } else {
        toast.error(errorMessage);
      }
    },
  });

  const validateForm = (): boolean => {
    const newErrors: Partial<Record<keyof FormData, string>> = {};

    if (!formData.event_name) {
      newErrors.event_name = t('validation.eventNameRequired');
    }

    if (!formData.event_date) {
      newErrors.event_date = t('validation.eventDateRequired');
    }

    if (!formData.host_name) {
      newErrors.host_name = t('validation.hostNameRequired');
    }

    if (!formData.host_email) {
      newErrors.host_email = t('validation.hostEmailRequired');
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.host_email)) {
      newErrors.host_email = t('validation.invalidEmailFormat');
    }

    if (!formData.admin_email) {
      newErrors.admin_email = t('validation.adminEmailRequired');
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.admin_email)) {
      newErrors.admin_email = t('validation.invalidEmailFormat');
    }

    if (!formData.password) {
      newErrors.password = t('validation.passwordRequired');
    } else if (formData.password.length < 6) {
      newErrors.password = t('validation.passwordMinLength');
    } else if (/^\d{1,6}$/.test(formData.password)) {
      // Prevent simple numeric passwords like "123456"
      newErrors.password = t('validation.passwordTooSimple', 'Password cannot be just numbers. Consider using a date format like "04.07.2025"');
    }

    if (formData.password !== formData.confirm_password) {
      newErrors.confirm_password = t('validation.passwordsDoNotMatch');
    }

    if (formData.expires_in_days < 1 || formData.expires_in_days > 365) {
      newErrors.expires_in_days = t('validation.expirationRange');
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }
    
    const payload = {
      event_type: formData.event_type,
      event_name: formData.event_name,
      event_date: formData.event_date,
      host_name: formData.host_name,
      host_email: formData.host_email,
      admin_email: formData.admin_email,
      password: formData.password,
      welcome_message: formData.welcome_message || '',
      color_theme: JSON.stringify(formData.theme_config),
      expiration_days: formData.expires_in_days,
      allow_user_uploads: formData.allow_user_uploads,
      upload_category_id: formData.upload_category_id,
      feedback_settings: formData.feedback_settings,
    };
    
    createMutation.mutate(payload);
  };

  const handleInputChange = (field: keyof FormData) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    setFormData({ ...formData, [field]: e.target.value });
    setErrors({ ...errors, [field]: undefined });
  };

  const handleThemeChange = (newTheme: ThemeConfig) => {
    setFormData(prev => ({
      ...prev,
      theme_config: newTheme
    }));
  };

  const handlePresetChange = (presetName: string) => {
    const preset = GALLERY_THEME_PRESETS[presetName];
    if (preset) {
      setFormData(prev => ({
        ...prev,
        theme_preset: presetName,
        theme_config: preset.config
      }));
    }
  };

  const handlePasswordGenerated = (password: string) => {
    setFormData(prev => ({ 
      ...prev, 
      password: password,
      confirm_password: password 
    }));
    
    // Clear password errors since we generated a valid one
    if (errors.password || errors.confirm_password) {
      setErrors(prev => ({ 
        ...prev, 
        password: undefined,
        confirm_password: undefined 
      }));
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            leftIcon={<ArrowLeft className="w-4 h-4" />}
            onClick={() => navigate('/admin/events')}
          >
            {t('common.back')}
          </Button>
          <h1 className="text-2xl font-bold text-neutral-900">{t('events.create')}</h1>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Event Details */}
        <Card>
          <div className="p-6 space-y-6">
            <h2 className="text-lg font-semibold text-neutral-900 flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              {t('events.eventDetails')}
            </h2>

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                {t('events.eventType')}
              </label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {EVENT_TYPES.map((type) => (
                  <button
                    key={type.value}
                    type="button"
                    onClick={() => setFormData({ ...formData, event_type: type.value })}
                    className={`p-4 rounded-lg border-2 transition-all ${
                      formData.event_type === type.value
                        ? 'border-primary-600 bg-primary-50'
                        : 'border-neutral-200 hover:border-neutral-300'
                    }`}
                  >
                    <div className="text-2xl mb-1">{type.emoji}</div>
                    <div className="text-sm font-medium">{t(type.labelKey)}</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label={t('events.eventName')}
                placeholder={t('events.eventNamePlaceholder')}
                value={formData.event_name}
                onChange={handleInputChange('event_name')}
                error={errors.event_name}
                leftIcon={<Calendar className="w-5 h-5" />}
              />

              <Input
                type="date"
                label={t('events.eventDate')}
                value={formData.event_date}
                onChange={handleInputChange('event_date')}
                error={errors.event_date}
                leftIcon={<Calendar className="w-5 h-5" />}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                {t('events.welcomeMessage')}
              </label>
              <WelcomeMessageEditor
                value={formData.welcome_message}
                onChange={(value) => setFormData(prev => ({ ...prev, welcome_message: value }))}
                placeholder={t('events.welcomeMessagePlaceholder')}
                rows={4}
              />
            </div>
          </div>
        </Card>

        {/* Theme Selection */}
        <Card>
          <div className="p-6 space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-neutral-900 flex items-center gap-2">
                <Palette className="w-5 h-5" />
                {t('events.themeAndStyle')}
              </h2>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowThemeCustomizer(!showThemeCustomizer)}
                leftIcon={showThemeCustomizer ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              >
                {showThemeCustomizer ? t('common.hide') : t('common.customize')}
              </Button>
            </div>

            {/* Quick Theme Preview */}
            {!showThemeCustomizer && (
              <div className="p-4 rounded-lg border border-neutral-200" 
                style={{
                  backgroundColor: formData.theme_config.backgroundColor,
                  color: formData.theme_config.textColor
                }}
              >
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold" style={{ fontFamily: formData.theme_config.fontFamily }}>
                    {GALLERY_THEME_PRESETS[formData.theme_preset]?.name || 'Custom Theme'}
                  </h3>
                  <div className="flex gap-2">
                    <div 
                      className="w-6 h-6 rounded-full border-2 border-white shadow-sm"
                      style={{ backgroundColor: formData.theme_config.primaryColor }}
                    />
                    <div 
                      className="w-6 h-6 rounded-full border-2 border-white shadow-sm"
                      style={{ backgroundColor: formData.theme_config.accentColor }}
                    />
                  </div>
                </div>
                <p className="text-sm opacity-80">
                  Gallery Layout: <span className="font-medium capitalize">{formData.theme_config.galleryLayout || 'grid'}</span>
                </p>
              </div>
            )}

            {/* Theme Customizer */}
            {showThemeCustomizer && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Theme Customizer */}
                  <ThemeCustomizerEnhanced
                    value={formData.theme_config}
                    onChange={handleThemeChange}
                    presetName={formData.theme_preset}
                    onPresetChange={handlePresetChange}
                    isPreviewMode={true}
                    showGalleryLayouts={true}
                    hideActions={true}
                  />
                  
                  {/* Gallery Preview */}
                  <div className="lg:sticky lg:top-4 lg:h-fit">
                    <GalleryPreview 
                      theme={formData.theme_config} 
                      className="shadow-lg" 
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </Card>

        {/* Access & Security */}
        <Card>
          <div className="p-6 space-y-6">
            <h2 className="text-lg font-semibold text-neutral-900 flex items-center gap-2">
              <Lock className="w-5 h-5" />
              {t('events.accessAndSecurity')}
            </h2>

            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label={t('events.hostName')}
                  placeholder={t('events.hostNamePlaceholder')}
                  value={formData.host_name}
                  onChange={handleInputChange('host_name')}
                  error={errors.host_name}
                  leftIcon={<Calendar className="w-5 h-5" />}
                />

                <Input
                  type="email"
                  label={t('events.hostEmail')}
                  placeholder={t('events.hostEmailPlaceholder')}
                  value={formData.host_email}
                  onChange={handleInputChange('host_email')}
                  error={errors.host_email}
                  leftIcon={<Mail className="w-5 h-5" />}
                />
              </div>

              <Input
                type="email"
                label={t('events.adminEmail')}
                placeholder={t('events.adminEmailPlaceholder')}
                value={formData.admin_email}
                onChange={handleInputChange('admin_email')}
                error={errors.admin_email}
                leftIcon={<Mail className="w-5 h-5" />}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Input
                  type={showPassword ? 'text' : 'password'}
                  label={t('events.galleryPassword')}
                  placeholder={t('events.passwordPlaceholder')}
                  value={formData.password}
                  onChange={handleInputChange('password')}
                  error={errors.password}
                  helperText={t('events.passwordHelperText', 'You can use dates like "04.07.2025" or any text with 6+ characters')}
                  leftIcon={<Lock className="w-5 h-5" />}
                  rightIcon={
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="p-1"
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  }
                />
                
                {/* Password Generator */}
                <div className="mt-2">
                  <PasswordGenerator
                    eventName={formData.event_name}
                    eventDate={formData.event_date}
                    eventType={formData.event_type}
                    onPasswordGenerated={handlePasswordGenerated}
                    passwordComplexity="moderate"
                    className="w-full"
                  />
                </div>
              </div>

              <Input
                type={showPassword ? 'text' : 'password'}
                label={t('events.confirmPassword')}
                placeholder={t('events.confirmPasswordPlaceholder')}
                value={formData.confirm_password}
                onChange={handleInputChange('confirm_password')}
                error={errors.confirm_password}
                leftIcon={<Lock className="w-5 h-5" />}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                {t('events.galleryExpiration')}
              </label>
              <div className="flex items-center gap-2">
                <div className="w-32">
                  <Input
                    type="number"
                    value={formData.expires_in_days}
                    onChange={handleInputChange('expires_in_days')}
                    error={errors.expires_in_days}
                    min={1}
                    max={365}
                    leftIcon={<Clock className="w-5 h-5" />}
                  />
                </div>
                <span className="text-sm text-neutral-600">{t('events.daysAfterEvent')}</span>
              </div>
              {formData.event_date && (
                <p className="mt-2 text-sm text-neutral-500">
                  {t('events.expiresOn')}: {format(addDays(new Date(formData.event_date), formData.expires_in_days))}
                </p>
              )}
            </div>

            {/* User Upload Settings */}
            <div className="pt-4 border-t border-neutral-200">
              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={formData.allow_user_uploads}
                  onChange={(e) => setFormData({ ...formData, allow_user_uploads: e.target.checked })}
                  className="rounded border-neutral-300 text-primary-600 focus:ring-primary-500"
                />
                <div>
                  <span className="text-sm font-medium text-neutral-700">
                    {t('events.allowUserUploads')}
                  </span>
                  <p className="text-xs text-neutral-500 mt-0.5">
                    {t('events.allowUserUploadsDescription')}
                  </p>
                </div>
              </label>

              {formData.allow_user_uploads && categories && categories.length > 0 && (
                <div className="mt-4 ml-7">
                  <label className="block text-sm font-medium text-neutral-700 mb-2">
                    {t('events.uploadCategory')}
                  </label>
                  <select
                    value={formData.upload_category_id || ''}
                    onChange={(e) => setFormData({ 
                      ...formData, 
                      upload_category_id: e.target.value ? Number(e.target.value) : null 
                    })}
                    className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="">{t('events.selectCategory')}</option>
                    {categories.map(category => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-xs text-neutral-500">
                    {t('events.uploadCategoryHelp')}
                  </p>
                </div>
              )}
            </div>
          </div>
        </Card>

        {/* Feedback Settings */}
        <FeedbackSettings
          settings={formData.feedback_settings}
          onChange={(settings) => setFormData(prev => ({ ...prev, feedback_settings: settings }))}
        />

        {/* Form Actions */}
        <div className="flex items-center justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate('/admin/events')}
          >
            {t('common.cancel')}
          </Button>
          <Button
            type="submit"
            variant="primary"
            isLoading={createMutation.isPending}
            disabled={createMutation.isPending}
          >
            {t('events.createEvent')}
          </Button>
        </div>
      </form>
    </div>
  );
};
