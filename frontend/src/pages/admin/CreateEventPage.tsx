import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Calendar,
  Mail,
  Lock,
  Clock,
  ArrowLeft,
  Info,
  Upload,
  Eye,
  EyeOff
} from 'lucide-react';
import { format, addDays } from 'date-fns';
import { toast } from 'react-toastify';

import { Button, Input, Card, PasswordGenerator } from '../../components/common';
import { useMutation, useQuery } from '@tanstack/react-query';
import { eventsService } from '../../services/events.service';
import { categoriesService } from '../../services/categories.service';
import { settingsService } from '../../services/settings.service';
import { useTranslation } from 'react-i18next';

interface FormData {
  event_type: string;
  event_name: string;
  event_date: string;
  customer_email: string;
  admin_email: string;
  require_password: boolean;
  password: string;
  confirm_password: string;
  welcome_message: string;
  color_theme: string;
  expires_in_days: number;
  allow_user_uploads: boolean;
  upload_category_id: number | null;
}

const EVENT_TYPES = [
  { value: 'wedding', labelKey: 'events.types.wedding', emoji: '💒' },
  { value: 'birthday', labelKey: 'events.types.birthday', emoji: '🎂' },
  { value: 'corporate', labelKey: 'events.types.corporate', emoji: '🏢' },
  { value: 'other', labelKey: 'events.types.other', emoji: '📸' },
];

const COLOR_THEMES = [
  { 
    value: 'default', 
    labelKey: 'events.themes.default', 
    color: 'bg-primary-600',
    theme: {
      primaryColor: '#5C8762',
      accentColor: '#22c55e',
      backgroundColor: '#fafafa',
      textColor: '#171717',
      borderRadius: 'md' as const
    }
  },
  { 
    value: 'blue', 
    labelKey: 'events.themes.oceanBlue', 
    color: 'bg-blue-600',
    theme: {
      primaryColor: '#2563eb',
      accentColor: '#3b82f6',
      backgroundColor: '#f0f9ff',
      textColor: '#0f172a',
      borderRadius: 'md' as const
    }
  },
  { 
    value: 'purple', 
    labelKey: 'events.themes.royalPurple', 
    color: 'bg-purple-600',
    theme: {
      primaryColor: '#9333ea',
      accentColor: '#a855f7',
      backgroundColor: '#faf5ff',
      textColor: '#1e1b4b',
      borderRadius: 'md' as const
    }
  },
  { 
    value: 'rose', 
    labelKey: 'events.themes.roseGold', 
    color: 'bg-rose-600',
    theme: {
      primaryColor: '#e11d48',
      accentColor: '#f43f5e',
      backgroundColor: '#fff1f2',
      textColor: '#881337',
      borderRadius: 'md' as const
    }
  },
  { 
    value: 'amber', 
    labelKey: 'events.themes.sunsetAmber', 
    color: 'bg-amber-600',
    theme: {
      primaryColor: '#d97706',
      accentColor: '#f59e0b',
      backgroundColor: '#fffbeb',
      textColor: '#451a03',
      borderRadius: 'md' as const
    }
  },
];

export const CreateEventPage: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const isMountedRef = useRef(true);
  
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);
  
  const [formData, setFormData] = useState<FormData>({
    event_type: 'wedding',
    event_name: '',
    event_date: format(new Date(), 'yyyy-MM-dd'),
    customer_email: '',
    admin_email: '',
    require_password: true,
    password: '',
    confirm_password: '',
    welcome_message: '',
    color_theme: 'default',
    expires_in_days: 30,
    allow_user_uploads: false,
    upload_category_id: null,
  });
  
  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({});
  const [showPassword, setShowPassword] = useState(false);

  // Fetch categories for user upload selection
  const { data: categories } = useQuery({
    queryKey: ['categories', 'global'],
    queryFn: () => categoriesService.getGlobalCategories()
  });

  // Fetch password complexity settings
  const { data: passwordComplexity } = useQuery({
    queryKey: ['password-complexity'],
    queryFn: () => settingsService.getPasswordComplexitySettings(),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const createMutation = useMutation({
    mutationFn: eventsService.createEvent,
    onSuccess: (data) => {
      if (isMountedRef.current) {
        toast.success(t('toast.eventCreated'));
        // Add a small delay to ensure navigation works properly
        setTimeout(() => {
          if (isMountedRef.current && data?.id) {
            navigate(`/admin/events/${data.id}`);
          } else {
            navigate('/admin/events');
          }
        }, 100);
      }
    },
    onError: (error: any) => {
      if (!isMountedRef.current) return;
      
      if (error.code === 'ERR_NETWORK' || error.code === 'ERR_CONNECTION_RESET') {
        toast.error(t('errors.networkError'));
      } else if (error.response?.data?.errors) {
        const newErrors: Record<string, string> = {};
        error.response.data.errors.forEach((err: any) => {
          newErrors[err.path] = err.msg;
        });
        setErrors(newErrors);
      } else if (error.response?.status === 401) {
        toast.error(t('errors.sessionExpired'));
        navigate('/admin/login');
      } else {
        const errorMessage = error.response?.data?.error;
        // Check if it's the password security requirements error
        if (errorMessage === 'Password does not meet security requirements') {
          toast.error(t('validation.passwordSecurityRequirements'));
        } else {
          toast.error(errorMessage || t('errors.failedToCreateEvent'));
        }
      }
    },
  });

  const validateForm = (): boolean => {
    const newErrors: Partial<Record<keyof FormData, string>> = {};

    if (!formData.event_name.trim()) {
      newErrors.event_name = t('validation.eventNameRequired');
    }

    if (!formData.customer_email) {
      newErrors.customer_email = t('validation.hostEmailRequired');
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.customer_email)) {
      newErrors.customer_email = t('validation.invalidEmailFormat');
    }

    if (!formData.admin_email) {
      newErrors.admin_email = t('validation.adminEmailRequired');
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.admin_email)) {
      newErrors.admin_email = t('validation.invalidEmailFormat');
    }

    if (formData.require_password) {
      if (!formData.password) {
        newErrors.password = t('validation.passwordRequired');
      } else if (formData.password.length < 6) {
        newErrors.password = t('validation.passwordMinLength');
      } else if (/^\d{1,6}$/.test(formData.password)) {
        newErrors.password = t('validation.passwordTooSimple', 'Password cannot be just numbers. Consider using a date format like "04.07.2025"');
      }

      if (formData.password !== formData.confirm_password) {
        newErrors.confirm_password = t('validation.passwordsDoNotMatch');
      }
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

    const selectedTheme = COLOR_THEMES.find(t => t.value === formData.color_theme);
    
    const payload = {
      event_type: formData.event_type,
      event_name: formData.event_name,
      event_date: formData.event_date,
      customer_name: formData.customer_email.split('@')[0],
      customer_email: formData.customer_email,
      admin_email: formData.admin_email,
      require_password: formData.require_password,
      password: formData.require_password ? formData.password : undefined,
      welcome_message: formData.welcome_message || '',
      color_theme: selectedTheme ? JSON.stringify(selectedTheme.theme) : undefined,
      expiration_days: formData.expires_in_days,
      allow_user_uploads: formData.allow_user_uploads,
      upload_category_id: formData.upload_category_id,
    };

    createMutation.mutate(payload);
  };

  const handleInputChange = (field: keyof FormData) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const value = field === 'expires_in_days' ? parseInt(e.target.value) || 0 : e.target.value;
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // Clear error when user types
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
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
        password: '',
        confirm_password: '' 
      }));
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      {/* Page Header */}
      <div className="mb-6">
        <Button
          variant="outline"
          size="sm"
          leftIcon={<ArrowLeft className="w-4 h-4" />}
          onClick={() => navigate('/admin/events')}
          className="mb-4"
        >
          {t('events.backToEvents')}
        </Button>
        
        <h1 className="text-2xl font-bold text-neutral-900">{t('events.createNewEvent')}</h1>
        <p className="text-neutral-600 mt-1">{t('events.createNewEventSubtitle')}</p>
      </div>

      <form onSubmit={handleSubmit}>
        {/* Event Details */}
        <Card padding="md" className="mb-6">
          <h2 className="text-lg font-semibold text-neutral-900 mb-4">{t('events.eventDetails')}</h2>
          
          <div className="space-y-4">
            {/* Event Type */}
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">
                {t('events.eventType')}
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                {EVENT_TYPES.map(type => (
                  <button
                    key={type.value}
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, event_type: type.value }))}
                    className={`p-3 rounded-lg border-2 transition-all ${
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

            {/* Event Name */}
            <div>
              <label htmlFor="event_name" className="block text-sm font-medium text-neutral-700 mb-1">
                {t('events.eventName')}
              </label>
              <Input
                id="event_name"
                type="text"
                value={formData.event_name}
                onChange={handleInputChange('event_name')}
                error={errors.event_name}
                placeholder={t('events.eventNamePlaceholder')}
                leftIcon={<Calendar className="w-5 h-5 text-neutral-400" />}
              />
            </div>

            {/* Event Date */}
            <div>
              <label htmlFor="event_date" className="block text-sm font-medium text-neutral-700 mb-1">
                {t('events.eventDate')}
              </label>
              <Input
                id="event_date"
                type="date"
                value={formData.event_date}
                onChange={handleInputChange('event_date')}
                error={errors.event_date}
              />
            </div>

            {/* Welcome Message */}
            <div>
              <label htmlFor="welcome_message" className="block text-sm font-medium text-neutral-700 mb-1">
                {t('events.welcomeMessageOptional')}
              </label>
              <textarea
                id="welcome_message"
                value={formData.welcome_message}
                onChange={handleInputChange('welcome_message')}
                placeholder={t('events.welcomeMessagePlaceholder')}
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                rows={3}
              />
            </div>
          </div>
        </Card>

        {/* Contact Information */}
        <Card padding="md" className="mb-6">
          <h2 className="text-lg font-semibold text-neutral-900 mb-4">{t('events.contactInformation')}</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Customer Email */}
            <div>
              <label htmlFor="customer_email" className="block text-sm font-medium text-neutral-700 mb-1">
                {t('events.hostEmail')}
              </label>
              <Input
                id="customer_email"
                type="email"
                value={formData.customer_email}
                onChange={handleInputChange('customer_email')}
                error={errors.customer_email}
                placeholder={t('events.hostEmailPlaceholder')}
                leftIcon={<Mail className="w-5 h-5 text-neutral-400" />}
              />
              <p className="text-xs text-neutral-500 mt-1">
                {t('events.hostEmailHelp')}
              </p>
            </div>

            {/* Admin Email */}
            <div>
              <label htmlFor="admin_email" className="block text-sm font-medium text-neutral-700 mb-1">
                {t('events.adminNotificationEmail')}
              </label>
              <Input
                id="admin_email"
                type="email"
                value={formData.admin_email}
                onChange={handleInputChange('admin_email')}
                error={errors.admin_email}
                placeholder={t('events.adminEmailPlaceholder')}
                leftIcon={<Mail className="w-5 h-5 text-neutral-400" />}
              />
              <p className="text-xs text-neutral-500 mt-1">
                {t('events.adminEmailHelp')}
              </p>
            </div>
          </div>
        </Card>

        {/* Security & Access */}
        <Card padding="md" className="mb-6">
          <h2 className="text-lg font-semibold text-neutral-900 mb-4">{t('events.securityAndAccess')}</h2>
          
          <div className="space-y-4">
            <label className="flex items-start gap-2">
              <input
                type="checkbox"
                className="mt-1 w-4 h-4 text-primary-600 border-neutral-300 rounded focus:ring-primary-500"
                checked={formData.require_password}
                onChange={(e) => {
                  const checked = e.target.checked;
                  setFormData(prev => ({
                    ...prev,
                    require_password: checked,
                    password: checked ? prev.password : '',
                    confirm_password: checked ? prev.confirm_password : ''
                  }));
                  if (!checked) {
                    setErrors(prev => ({ ...prev, password: '', confirm_password: '' }));
                  }
                }}
              />
              <div>
                <span className="text-sm font-medium text-neutral-700">{t('events.requirePasswordToggle')}</span>
                <p className="text-xs text-neutral-500 mt-1">
                  {t('events.requirePasswordToggleHelp', 'Disable this if you want to share the gallery without a password. Anyone with the link will be able to view the photos.')}
                </p>
              </div>
            </label>

            {!formData.require_password && (
              <div className="rounded-md border border-orange-200 bg-orange-50 p-3 text-xs text-orange-800">
                {t('events.publicGalleryWarning', 'Public galleries are accessible to anyone with the link. Consider enabling download watermarks and monitoring activity.')} 
              </div>
            )}

            {formData.require_password && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-neutral-700 mb-1">
                    {t('events.galleryPassword')}
                  </label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      value={formData.password}
                      onChange={handleInputChange('password')}
                      error={errors.password}
                      placeholder={t('events.enterPassword')}
                      helperText={t('events.passwordHelperText', 'You can use dates like "04.07.2025" or any text with 6+ characters')}
                      leftIcon={<Lock className="w-5 h-5 text-neutral-400" />}
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center"
                      style={{ top: errors.password ? '0' : '0' }}
                    >
                      {showPassword ? (
                        <EyeOff className="w-5 h-5 text-neutral-400 hover:text-neutral-600" />
                      ) : (
                        <Eye className="w-5 h-5 text-neutral-400 hover:text-neutral-600" />
                      )}
                    </button>
                  </div>
                  
                  <div className="mt-2">
                    <PasswordGenerator
                      eventName={formData.event_name}
                      eventDate={formData.event_date}
                      eventType={formData.event_type}
                      onPasswordGenerated={handlePasswordGenerated}
                      passwordComplexity={passwordComplexity?.complexityLevel || 'moderate'}
                      className="w-full"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="confirm_password" className="block text-sm font-medium text-neutral-700 mb-1">
                    {t('events.confirmPassword')}
                  </label>
                  <div className="relative">
                    <Input
                      id="confirm_password"
                      type={showPassword ? 'text' : 'password'}
                      value={formData.confirm_password}
                      onChange={handleInputChange('confirm_password')}
                      error={errors.confirm_password}
                      placeholder={t('events.confirmPasswordPlaceholder')}
                      leftIcon={<Lock className="w-5 h-5 text-neutral-400" />}
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center"
                      style={{ top: errors.confirm_password ? '0' : '0' }}
                    >
                      {showPassword ? (
                        <EyeOff className="w-5 h-5 text-neutral-400 hover:text-neutral-600" />
                      ) : (
                        <Eye className="w-5 h-5 text-neutral-400 hover:text-neutral-600" />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </Card>

        {/* Gallery Settings */}
        <Card padding="md" className="mb-6">
          <h2 className="text-lg font-semibold text-neutral-900 mb-4">{t('events.gallerySettings')}</h2>
          
          <div className="space-y-4">
            {/* Color Theme */}
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">
                {t('events.colorTheme')}
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                {COLOR_THEMES.map(theme => (
                  <button
                    key={theme.value}
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, color_theme: theme.value }))}
                    className={`p-3 rounded-lg border-2 transition-all ${
                      formData.color_theme === theme.value
                        ? 'border-primary-600 ring-2 ring-primary-200'
                        : 'border-neutral-200 hover:border-neutral-300'
                    }`}
                  >
                    <div className={`w-full h-8 ${theme.color} rounded mb-2`} />
                    <div className="text-xs font-medium">{t(theme.labelKey)}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Expiration */}
            <div>
              <label htmlFor="expires_in_days" className="block text-sm font-medium text-neutral-700 mb-1">
                {t('events.galleryExpiresIn')}
              </label>
              <div className="flex items-center gap-4">
                <Input
                  id="expires_in_days"
                  type="number"
                  value={formData.expires_in_days}
                  onChange={handleInputChange('expires_in_days')}
                  error={errors.expires_in_days}
                  min="1"
                  max="365"
                  className="w-32"
                  leftIcon={<Clock className="w-5 h-5 text-neutral-400" />}
                />
                <span className="text-sm text-neutral-700">{t('common.days')}</span>
              </div>
              <div className="mt-2 p-3 bg-blue-50 rounded-lg flex items-start gap-2">
                <Info className="w-5 h-5 text-blue-600 flex-shrink-0" />
                <div className="text-sm text-blue-800">
                  <p>{t('events.galleryExpiresOn', { date: format(addDays(new Date(), formData.expires_in_days), 'MMMM d, yyyy') })}</p>
                  <p className="mt-1">{t('events.guestsWillReceiveWarning')}</p>
                </div>
              </div>
            </div>
          </div>
        </Card>

        {/* User Upload Settings */}
        <Card padding="md" className="mb-6">
          <h2 className="text-lg font-semibold text-neutral-900 mb-4">{t('events.userUploads')}</h2>
          
          <div className="space-y-4">
            {/* Allow User Uploads */}
            <div>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={formData.allow_user_uploads}
                  onChange={(e) => setFormData(prev => ({ ...prev, allow_user_uploads: e.target.checked }))}
                  className="w-4 h-4 text-primary-600 border-neutral-300 rounded focus:ring-primary-500"
                />
                <span className="ml-2 text-sm text-neutral-700">{t('events.allowUserUploads')}</span>
              </label>
              <p className="text-xs text-neutral-500 mt-1 ml-6">
                {t('events.allowUserUploadsHelp')}
              </p>
            </div>

            {/* Upload Category Selection */}
            {formData.allow_user_uploads && (
              <div>
                <label htmlFor="upload_category" className="block text-sm font-medium text-neutral-700 mb-1">
                  {t('events.uploadCategory')}
                </label>
                <select
                  id="upload_category"
                  value={formData.upload_category_id || ''}
                  onChange={(e) => setFormData(prev => ({ 
                    ...prev, 
                    upload_category_id: e.target.value ? parseInt(e.target.value) : null 
                  }))}
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                >
                  <option value="">{t('events.selectCategory')}</option>
                  {categories?.map((category: any) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-neutral-500 mt-1">
                  {t('events.uploadCategoryHelp')}
                </p>
              </div>
            )}

            {formData.allow_user_uploads && (
              <div className="mt-2 p-3 bg-amber-50 rounded-lg flex items-start gap-2">
                <Upload className="w-5 h-5 text-amber-600 flex-shrink-0" />
                <div className="text-sm text-amber-800">
                  <p>{t('events.userUploadWarning')}</p>
                </div>
              </div>
            )}
          </div>
        </Card>

        {/* Submit Buttons */}
        <div className="flex justify-end gap-3">
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
          >
            {t('events.createEvent')}
          </Button>
        </div>
      </form>
    </div>
  );
};

CreateEventPage.displayName = 'CreateEventPage';
