import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ArrowLeft,
  ExternalLink,
  Calendar,
  Download,
  Archive,
  Edit2,
  Save,
  X,
  AlertTriangle,
  Copy,
  CheckCircle,
  Upload,
  Image,
  Key,
  Mail,
  MessageSquare,
  Lock,
  Eye,
  EyeOff,
  Type,
  Shield,
  Monitor,
  Droplets,
  MousePointer,
  Layout,
  Trash2
} from 'lucide-react';
import { parseISO, differenceInDays, isValid } from 'date-fns';

// Helper to safely parse dates that might be strings, Date objects, or timestamps
const safeParseDate = (dateValue: unknown): Date | null => {
  if (!dateValue) {
    return null;
  }
  if (dateValue instanceof Date) {
    return dateValue;
  }
  if (typeof dateValue === 'number') {
    return new Date(dateValue);
  }
  if (typeof dateValue === 'string') {
    const parsed = parseISO(dateValue);
    return isValid(parsed) ? parsed : new Date(dateValue);
  }
  return null;
};
import { toast } from 'react-toastify';
import { useLocalizedDate } from '../../hooks/useLocalizedDate';

import { Button, Input, Card, Loading } from '../../components/common';
import { EventCategoryManager, AdminPhotoGrid, AdminPhotoViewer, PhotoFilters, PasswordResetModal, ThemeCustomizerEnhanced, ThemeDisplay, HeroPhotoSelector, PhotoUploadModal, FeedbackSettings, FeedbackModerationPanel, EventRenameDialog, PhotoFilterPanel, PhotoExportMenu } from '../../components/admin';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { eventsService } from '../../services/events.service';
import { api } from '../../config/api';
import { buildResourceUrl } from '../../utils/url';
import { isGalleryPublic, normalizeRequirePassword } from '../../utils/accessControl';
import { archiveService } from '../../services/archive.service';
import { externalMediaService } from '../../services/externalMedia.service';
import { photosService, AdminPhoto, type PhotoFilters as PhotoFilterParams, type FeedbackFilters } from '../../services/photos.service';
import { feedbackService, FeedbackSettings as FeedbackSettingsType } from '../../services/feedback.service';
import { cssTemplatesService, type EnabledTemplate } from '../../services/cssTemplates.service';
import { ThemeConfig, GALLERY_THEME_PRESETS } from '../../types/theme.types';

const resolveShareLink = (link: string): string => {
  if (!link) return '#';
  if (link.startsWith('http')) return link;
  if (link.startsWith('/')) return link;
  return `/gallery/${link}`;
};

const ExternalFolderPicker: React.FC<{ value: string; onChange: (p: string) => void }> = ({ value, onChange }) => {
  const { t } = useTranslation();
  const [entries, setEntries] = useState<{ path: string; entries: any[]; canNavigateUp: boolean } | null>(null);
  const [loading, setLoading] = useState(false);
  const [currentPath, setCurrentPath] = useState<string>(value || '');

  const load = async (p: string) => {
    try {
      setLoading(true);
      const res = await externalMediaService.list(p);
      setEntries(res);
      setCurrentPath(res.path);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(currentPath || ''); }, []);

  const navigateUp = () => {
    if (!entries?.canNavigateUp) return;
    const parts = (entries.path || '').split('/').filter(Boolean);
    parts.pop();
    load(parts.join('/'));
  };

  return (
    <div className="mt-2 border rounded-lg p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm text-neutral-600">/external-media/{entries?.path || ''}</div>
        <div className="flex gap-2">
          <button className="text-sm underline" onClick={navigateUp} disabled={!entries?.canNavigateUp}>{t('common.up', 'Up')}</button>
          <button className="text-sm underline" onClick={() => onChange(entries?.path || '')}>{t('common.select', 'Select')}</button>
        </div>
      </div>
      {loading ? (
        <div className="text-sm text-neutral-500">{t('common.loading', 'Loading...')}</div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {entries?.entries?.filter((e: any) => e.type === 'dir').map((e: any) => (
            <button
              key={e.name}
              onClick={() => load([entries?.path, e.name].filter(Boolean).join('/'))}
              className="px-3 py-2 border rounded text-left hover:bg-neutral-50"
            >
              📁 {e.name}
            </button>
          ))}
        </div>
      )}
      {value && (
        <div className="mt-2 text-xs text-neutral-600">{t('common.selected', 'Selected')}: /external-media/{value}</div>
      )}
    </div>
  );
};

export const EventDetailsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const { format } = useLocalizedDate();
  
  // Validate ID parameter
  React.useEffect(() => {
    if (!id || isNaN(parseInt(id))) {
      navigate('/admin/events');
    }
  }, [id, navigate]);
  
  type EditFormState = {
    welcome_message: string;
    color_theme: string;
    css_template_id: number | null;
    expires_at: string;
    allow_user_uploads: boolean;
    upload_category_id: number | null;
    hero_photo_id: number | null;
    customer_name: string;
    source_mode: 'managed' | 'reference';
    external_path: string;
    require_password: boolean;
    new_password: string;
    confirm_new_password: string;
    // Download protection settings
    protection_level: 'basic' | 'standard' | 'enhanced' | 'maximum';
    disable_right_click: boolean;
    allow_downloads: boolean;
    watermark_downloads: boolean;
    enable_devtools_protection: boolean;
    use_canvas_rendering: boolean;
    // Hero logo settings
    hero_logo_visible: boolean;
    hero_logo_size: 'small' | 'medium' | 'large' | 'xlarge';
    hero_logo_position: 'top' | 'center' | 'bottom';
  };

  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<EditFormState>({
    welcome_message: '',
    color_theme: '',
    css_template_id: null,
    expires_at: '',
    allow_user_uploads: false,
    upload_category_id: null,
    hero_photo_id: null,
    customer_name: '',
    source_mode: 'managed',
    external_path: '',
    require_password: true,
    new_password: '',
    confirm_new_password: '',
    // Download protection settings
    protection_level: 'standard',
    disable_right_click: true,
    allow_downloads: true,
    watermark_downloads: false,
    enable_devtools_protection: true,
    use_canvas_rendering: false,
    // Hero logo settings
    hero_logo_visible: true,
    hero_logo_size: 'medium',
    hero_logo_position: 'top',
  });
  const [feedbackSettings, setFeedbackSettings] = useState<FeedbackSettingsType>({
    feedback_enabled: false,
    allow_ratings: true,
    allow_likes: true,
    allow_comments: true,
    allow_favorites: true,
    require_name_email: false,
    moderate_comments: true,
    show_feedback_to_guests: true,
    enable_rate_limiting: false,
    rate_limit_window_minutes: 15,
    rate_limit_max_requests: 10,
  });
  const [copiedLink, setCopiedLink] = useState(false);
  const [showPhotoUpload, setShowPhotoUpload] = useState(false);
  const [showExternalImport, setShowExternalImport] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'photos' | 'categories'>('overview');
  const [externalPath, setExternalPath] = useState<string>('');
  const [importing, setImporting] = useState<boolean>(false);
  const [selectedPhoto, setSelectedPhoto] = useState<{ photo: AdminPhoto; index: number } | null>(null);
  const [showPasswordReset, setShowPasswordReset] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showRenameDialog, setShowRenameDialog] = useState(false);
  const [logoUploading, setLogoUploading] = useState(false);
  const [currentTheme, setCurrentTheme] = useState<ThemeConfig | null>(null);
  const [currentPresetName, setCurrentPresetName] = useState<string>('default');
  const [cssTemplates, setCssTemplates] = useState<EnabledTemplate[]>([]);

  // Fetch CSS templates when component mounts or editing starts
  useEffect(() => {
    if (isEditing) {
      cssTemplatesService.getEnabledTemplates()
        .then(setCssTemplates)
        .catch(err => console.error('Failed to load CSS templates:', err));
    }
  }, [isEditing]);

  // Photo filters state
  const [photoFilters, setPhotoFilters] = useState<PhotoFilterParams>({
    category_id: undefined as number | null | undefined,
    search: '',
    sort: 'date',
    order: 'desc' as 'asc' | 'desc'
  });

  // Feedback filters state for export
  const [feedbackFilters, setFeedbackFilters] = useState<FeedbackFilters>({
    minRating: null,
    hasLikes: false,
    hasFavorites: false,
    hasComments: false,
    logic: 'AND'
  });
  const [selectedPhotoIds, setSelectedPhotoIds] = useState<number[]>([]);

  // Fetch event details
  const { data: event, isLoading: eventLoading } = useQuery({
    queryKey: ['admin-event', id],
    queryFn: () => eventsService.getEvent(parseInt(id!)),
    enabled: !!id,
  });

  // Fetch feedback settings
  const { data: eventFeedbackSettings } = useQuery({
    queryKey: ['admin-event-feedback-settings', id],
    queryFn: () => feedbackService.getEventFeedbackSettings(id!),
    enabled: !!id,
  });

  // Update local feedback settings when fetched from server
  useEffect(() => {
    if (eventFeedbackSettings) {
      setFeedbackSettings(eventFeedbackSettings);
    }
  }, [eventFeedbackSettings]);

  // Statistics are now fetched with the event details from the admin API

  // Fetch photos (needed for both photos tab and hero photo selector)
  const { data: photos = [], isLoading: photosLoading, refetch: refetchPhotos } = useQuery({
    queryKey: ['admin-event-photos', id, photoFilters],
    queryFn: () => photosService.getEventPhotos(parseInt(id!), photoFilters),
    enabled: !!id && (activeTab === 'photos' || isEditing),
  });

  // Fetch filter summary for feedback filters
  const { data: filterSummary } = useQuery({
    queryKey: ['admin-event-filter-summary', id],
    queryFn: () => photosService.getFilterSummary(parseInt(id!)),
    enabled: !!id && activeTab === 'photos',
  });

  const mediaTypes = useMemo(() => {
    const types = new Set<'photo' | 'video'>();
    photos.forEach((p: any) => {
      const mediaType = (p.media_type as 'photo' | 'video' | undefined)
        || ((p.mime_type && String(p.mime_type).startsWith('video/')) || p.type === 'video' ? 'video' : 'photo');
      if (mediaType === 'video' || mediaType === 'photo') {
        types.add(mediaType);
      }
    });
    return types;
  }, [photos]);

  const showMediaFilter = mediaTypes.has('photo') && mediaTypes.has('video');

  useEffect(() => {
    if (!showMediaFilter && photoFilters.media_type) {
      setPhotoFilters(prev => ({ ...prev, media_type: undefined }));
    }
  }, [showMediaFilter, photoFilters.media_type]);

  // Fetch categories for the event
  const { data: categories = [] } = useQuery({
    queryKey: ['admin-event-categories', id],
    queryFn: async () => {
      const response = await eventsService.getEventCategories(parseInt(id!));
      return response || [];
    },
    enabled: !!id,
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: (data: any) => eventsService.updateEvent(parseInt(id!), data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-event', id] });
      toast.success(t('toast.eventUpdated'));
      setIsEditing(false);
    },
    onError: (error: any) => {
      if (error.response?.data?.errors) {
        const errorMessage = error.response.data.errors[0].msg + ' (field: ' + error.response.data.errors[0].path + ')';
        toast.error(errorMessage);
      } else {
        toast.error(error.response?.data?.error || t('toast.saveError'));
      }
    },
  });

  // Archive mutation
  const archiveMutation = useMutation({
    mutationFn: () => eventsService.archiveEvent(parseInt(id!)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-event', id] });
      toast.success(t('toast.eventArchived'));
    },
    onError: () => {
      toast.error(t('errors.somethingWentWrong'));
    },
  });

  // Extend expiration mutation
  const extendMutation = useMutation({
    mutationFn: (days: number) => {
      return eventsService.extendExpiration(parseInt(id!), days);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-event', id] });
      toast.success(t('toast.saveSuccess'));
    },
    onError: () => {
      toast.error(t('toast.saveError'));
    },
  });

  if (eventLoading || !event) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loading size="lg" text={t('events.loadingEventDetails')} />
      </div>
    );
  }

  const expiresAtDate = safeParseDate(event.expires_at);
  const daysUntilExpiration = expiresAtDate ? differenceInDays(expiresAtDate, new Date()) : null;
  const isExpired = daysUntilExpiration !== null && daysUntilExpiration <= 0;
  const isExpiring = daysUntilExpiration !== null && daysUntilExpiration > 0 && daysUntilExpiration <= 7;

  const handleStartEdit = () => {
    setEditForm({
      welcome_message: event.welcome_message || '',
      color_theme: event.color_theme || '',
      css_template_id: event.css_template_id || null,
      expires_at: expiresAtDate ? format(expiresAtDate, 'yyyy-MM-dd') : '',
      allow_user_uploads: event.allow_user_uploads || false,
      upload_category_id: event.upload_category_id || null,
      hero_photo_id: event.hero_photo_id || null,
      customer_name: event.customer_name || '',
      source_mode: event.source_mode === 'reference' ? 'reference' : 'managed',
      external_path: event.external_path || '',
      require_password: normalizeRequirePassword(event.require_password),
      new_password: '',
      confirm_new_password: '',
      // Load protection settings from event
      protection_level: event.protection_level || 'standard',
      disable_right_click: event.disable_right_click ?? true,
      allow_downloads: event.allow_downloads ?? true,
      watermark_downloads: event.watermark_downloads ?? false,
      enable_devtools_protection: event.enable_devtools_protection ?? true,
      use_canvas_rendering: event.use_canvas_rendering ?? false,
      // Load hero logo settings from event
      hero_logo_visible: event.hero_logo_visible ?? true,
      hero_logo_size: event.hero_logo_size || 'medium',
      hero_logo_position: event.hero_logo_position || 'top',
    });

    setShowNewPassword(false);
    
    // Set feedback settings if available
    if (eventFeedbackSettings) {
      setFeedbackSettings(eventFeedbackSettings);
    }
    
    // Parse theme configuration
    if (event.color_theme) {
      try {
        if (event.color_theme.startsWith('{')) {
          const parsedTheme = JSON.parse(event.color_theme);
          setCurrentTheme(parsedTheme);
          // Try to find matching preset
          const matchingPreset = Object.entries(GALLERY_THEME_PRESETS).find(
            ([_, preset]) => JSON.stringify(preset.config) === JSON.stringify(parsedTheme)
          );
          setCurrentPresetName(matchingPreset ? matchingPreset[0] : 'custom');
        } else {
          // Legacy theme name
          const preset = GALLERY_THEME_PRESETS[event.color_theme];
          if (preset) {
            setCurrentTheme(preset.config);
            setCurrentPresetName(event.color_theme);
          }
        }
      } catch (e) {
        setCurrentTheme(GALLERY_THEME_PRESETS.default.config);
        setCurrentPresetName('default');
      }
    } else {
      setCurrentTheme(GALLERY_THEME_PRESETS.default.config);
      setCurrentPresetName('default');
    }
    
    setIsEditing(true);
  };

  const handleEventLogoUpload = async (file: File) => {
    if (!id) return;
    setLogoUploading(true);
    try {
      const formData = new FormData();
      formData.append('logo', file);
      await api.post(`/admin/events/${id}/logo`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      toast.success(t('events.eventLogoUploaded', 'Event logo uploaded successfully'));
      queryClient.invalidateQueries({ queryKey: ['event', id] });
    } catch (error: any) {
      toast.error(error?.response?.data?.error || t('events.eventLogoUploadFailed', 'Failed to upload event logo'));
    } finally {
      setLogoUploading(false);
    }
  };

  const handleEventLogoRemove = async () => {
    if (!id) return;
    setLogoUploading(true);
    try {
      await api.delete(`/admin/events/${id}/logo`);
      toast.success(t('events.eventLogoRemoved', 'Event logo removed successfully'));
      queryClient.invalidateQueries({ queryKey: ['event', id] });
    } catch (error: any) {
      toast.error(error?.response?.data?.error || t('events.eventLogoRemoveFailed', 'Failed to remove event logo'));
    } finally {
      setLogoUploading(false);
    }
  };

  const handleSaveEdit = async () => {
    // Prepare color_theme - if we have a custom theme, serialize it
    let themeToSave = editForm.color_theme;
    if (currentTheme && currentPresetName === 'custom') {
      themeToSave = JSON.stringify(currentTheme);
    } else if (currentPresetName && currentPresetName !== 'custom') {
      // Use preset name for non-custom themes
      themeToSave = currentPresetName;
    }

    const externalPathToSave = editForm.external_path?.trim() || '';

    const currentRequirePassword = normalizeRequirePassword(event.require_password);
    const requirePasswordChanged = editForm.require_password !== currentRequirePassword;

    if (editForm.require_password) {
      if (requirePasswordChanged && !editForm.new_password) {
        toast.error(t('events.newPasswordRequired', 'Please set a password before enabling protection.'));
        return;
      }
      if (editForm.new_password) {
        if (editForm.new_password.length < 6) {
          toast.error(t('validation.passwordMinLength'));
          return;
        }
        if (editForm.new_password !== editForm.confirm_new_password) {
          toast.error(t('validation.passwordsDoNotMatch'));
          return;
        }
      }
    }

    if (editForm.source_mode === 'reference' && !externalPathToSave) {
      toast.error(t('events.externalFolderRequired', 'Please select an external folder before saving.'));
      return;
    }
    
    // Clean up the data - remove undefined values
    const updateData: any = {
      expires_at: editForm.expires_at,
      allow_user_uploads: editForm.allow_user_uploads,
      require_password: editForm.require_password,
      css_template_id: editForm.css_template_id,
      // Download protection settings
      protection_level: editForm.protection_level,
      disable_right_click: editForm.disable_right_click,
      allow_downloads: editForm.allow_downloads,
      watermark_downloads: editForm.watermark_downloads,
      enable_devtools_protection: editForm.enable_devtools_protection,
      use_canvas_rendering: editForm.use_canvas_rendering,
      // Hero logo settings
      hero_logo_visible: editForm.hero_logo_visible,
      hero_logo_size: editForm.hero_logo_size,
      hero_logo_position: editForm.hero_logo_position,
    };
    
    // Only include fields that have defined values
    if (editForm.welcome_message !== undefined && editForm.welcome_message !== null) {
      updateData.welcome_message = editForm.welcome_message;
    }
    if (themeToSave) {
      updateData.color_theme = themeToSave;
    }
    if (editForm.upload_category_id !== undefined) {
      updateData.upload_category_id = editForm.upload_category_id;
    }
    if (editForm.hero_photo_id !== undefined) {
      updateData.hero_photo_id = editForm.hero_photo_id;
    }
    updateData.source_mode = editForm.source_mode;
    updateData.external_path = editForm.source_mode === 'reference'
      ? externalPathToSave
      : null;
    if (editForm.customer_name !== undefined && editForm.customer_name !== null) {
      updateData.customer_name = editForm.customer_name;
    }

    if (editForm.new_password) {
      updateData.password = editForm.new_password;
    }
    
    // Remove any keys with undefined values
    Object.keys(updateData).forEach(key => {
      if (updateData[key] === undefined) {
        delete updateData[key];
      }
    });
    
    // Event update with validation
    
    // Update event details
    updateMutation.mutate(updateData);
    
    // Update feedback settings separately
    try {
      await feedbackService.updateEventFeedbackSettings(id!, feedbackSettings);
    } catch (error) {
      // Error already handled by mutation
    }
  };

  const handleCopyLink = async () => {
    try {
      // Check if share_link exists
      if (!event.share_link) {
        toast.error(t('errors.noShareLink', 'No share link available'));
        return;
      }

      // Try modern clipboard API first
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(event.share_link);
      } else {
        // Fallback for non-HTTPS contexts or older browsers
        const textArea = document.createElement('textarea');
        textArea.value = event.share_link;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        const successful = document.execCommand('copy');
        document.body.removeChild(textArea);
        if (!successful) {
          throw new Error('Copy failed');
        }
      }
      
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
      toast.success(t('toast.linkCopied'));
    } catch (err) {
      console.error('Copy failed:', err);
      toast.error(t('errors.copyFailed', 'Failed to copy link. Please copy manually.'));
    }
  };


  return (
    <div>
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
        
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-neutral-900">{event.event_name}</h1>
            <div className="flex items-center gap-4 mt-2 text-sm text-neutral-600">
              {event.event_date && (
                <span className="flex items-center">
                  <Calendar className="w-4 h-4 mr-1" />
                  {format(safeParseDate(event.event_date)!, 'PPP')}
                </span>
              )}
              <span className="capitalize">{event.event_type}</span>
              <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                  isGalleryPublic(event.require_password)
                    ? 'bg-green-100 text-green-700'
                    : 'bg-neutral-100 text-neutral-700'
                }`}
              >
                {isGalleryPublic(event.require_password) ? t('events.publicAccess', 'Public access') : t('events.passwordProtected', 'Password protected')}
              </span>
              {event.is_archived ? (
                <span className="text-neutral-500 flex items-center">
                  <Archive className="w-4 h-4 mr-1" />
                  {t('events.archived')}
                </span>
              ) : null}
            </div>
          </div>
          
          <div className="flex gap-2 items-center">
            {!event.is_archived && (
              <>
                {isEditing ? (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      leftIcon={<X className="w-4 h-4" />}
                      onClick={() => setIsEditing(false)}
                    >
                      {t('common.cancel')}
                    </Button>
                    <Button
                      variant="primary"
                      size="sm"
                      leftIcon={<Save className="w-4 h-4" />}
                      onClick={handleSaveEdit}
                      isLoading={updateMutation.isPending}
                    >
                      {t('events.saveChanges')}
                    </Button>
                  </>
                ) : (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      leftIcon={<Edit2 className="w-4 h-4" />}
                      onClick={handleStartEdit}
                    >
                      {t('common.edit')}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      leftIcon={<Type className="w-4 h-4" />}
                      onClick={() => setShowRenameDialog(true)}
                    >
                      {t('events.rename.button', 'Rename')}
                    </Button>
                    {feedbackSettings?.feedback_enabled && (
                      <Button
                        variant="outline"
                        size="sm"
                        leftIcon={<MessageSquare className="w-4 h-4" />}
                        onClick={() => navigate(`/admin/events/${id}/feedback`)}
                      >
                        {t('feedback.manage', 'Manage Feedback')}
                      </Button>
                    )}
                  </>
                )}
              </>
            )}
            {event.share_link && !isEditing && (
              <a
                href={resolveShareLink(event.share_link)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-primary-600 hover:text-primary-700 border border-primary-600 rounded-lg hover:bg-primary-50 transition-colors"
              >
                <ExternalLink className="w-4 h-4" />
                {t('events.viewGallery')}
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Expiration Warning */}
      {!event.is_archived && (isExpired || isExpiring) && (
        <Card className={`p-4 mb-6 border-2 ${isExpired ? 'border-red-500 bg-red-50' : 'border-orange-500 bg-orange-50'}`}>
          <div className="flex items-start gap-3">
            <AlertTriangle className={`w-5 h-5 flex-shrink-0 ${isExpired ? 'text-red-600' : 'text-orange-600'}`} />
            <div className="flex-1">
              <p className={`font-medium ${isExpired ? 'text-red-900' : 'text-orange-900'}`}>
                {isExpired 
                  ? t('events.eventExpiredMessage')
                  : t('events.eventExpiresIn', { days: daysUntilExpiration })
                }
              </p>
              <p className={`text-sm mt-1 ${isExpired ? 'text-red-700' : 'text-orange-700'}`}>
                {isExpired
                  ? t('events.guestsCannotAccessGallery')
                  : t('events.warningEmailsHaveBeenSent')}
              </p>
            </div>
            {!isExpired && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (confirm(t('events.extendExpiration', { days: 7 }) + '?')) {
                    extendMutation.mutate(7);
                  }
                }}
              >
                {t('events.extendSevenDays')}
              </Button>
            )}
          </div>
        </Card>
      )}

      {/* Tabs */}
      <div className="mb-6 border-b border-neutral-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('overview')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'overview'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-neutral-500 hover:text-neutral-700 hover:border-neutral-300'
            }`}
          >
            {t('events.overview')}
          </button>
          <button
            onClick={() => setActiveTab('photos')}
            className={`py-2 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${
              activeTab === 'photos'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-neutral-500 hover:text-neutral-700 hover:border-neutral-300'
            }`}
          >
            <Image className="w-4 h-4" />
            <span>{t('events.photos')}</span>
            {event.photo_count !== undefined && event.photo_count > 0 && (
              <span className="ml-1 px-2 py-0.5 text-xs font-medium bg-neutral-100 text-neutral-700 rounded-full">
                {event.photo_count}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('categories')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'categories'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-neutral-500 hover:text-neutral-700 hover:border-neutral-300'
            }`}
          >
            {t('events.categories')}
          </button>
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Left Column - Main Details */}
        <div className="space-y-6">
          {/* Event Information */}
          <Card padding="md">
            <h2 className="text-lg font-semibold text-neutral-900 mb-4">{t('events.eventInformation')}</h2>
            
            {isEditing ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">
                    {t('events.welcomeMessageLabel')}
                  </label>
                  <textarea
                    value={editForm.welcome_message}
                    onChange={(e) => setEditForm(prev => ({ ...prev, welcome_message: e.target.value }))}
                    className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    rows={3}
                    placeholder={t('events.welcomeMessage')}
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">
                    {t('events.hostName')}
                  </label>
                  <Input
                    type="text"
                    value={editForm.customer_name}
                    onChange={(e) => setEditForm(prev => ({ ...prev, customer_name: e.target.value }))}
                    placeholder={t('events.hostNamePlaceholder')}
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">
                    {t('events.expirationDate')}
                  </label>
                  <Input
                    type="date"
                    value={editForm.expires_at}
                    onChange={(e) => setEditForm(prev => ({ ...prev, expires_at: e.target.value }))}
                    min={format(new Date(), 'yyyy-MM-dd')}
                  />
                </div>
                
                {/* Hero Photo Selection */}
                <HeroPhotoSelector
                  photos={photos || []}
                  currentHeroPhotoId={editForm.hero_photo_id}
                  onSelect={(photoId) => setEditForm(prev => ({ ...prev, hero_photo_id: photoId }))}
                  isEditing={isEditing}
                />

                <div>
                  <label className="flex items-start gap-2">
                    <input
                      type="checkbox"
                      className="mt-1 w-4 h-4 text-primary-600 border-neutral-300 rounded focus:ring-primary-500"
                      checked={editForm.require_password}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setEditForm(prev => ({
                          ...prev,
                          require_password: checked,
                          new_password: checked ? prev.new_password : '',
                          confirm_new_password: checked ? prev.confirm_new_password : '',
                        }));
                        if (!checked) {
                          setShowNewPassword(false);
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

                  {!editForm.require_password && (
                    <div className="mt-2 rounded-md border border-orange-200 bg-orange-50 p-3 text-xs text-orange-800">
                      {t('events.publicGalleryWarning', 'Public galleries are accessible to anyone with the link. Consider enabling download watermarks and monitoring activity.')} 
                    </div>
                  )}
                </div>

                {editForm.require_password && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-neutral-700 mb-1">
                        {t('events.newPasswordLabel', 'New gallery password')}
                      </label>
                      <div className="relative">
                        <Input
                          type={showNewPassword ? 'text' : 'password'}
                          value={editForm.new_password}
                          onChange={(e) => setEditForm(prev => ({ ...prev, new_password: e.target.value }))}
                          placeholder={t('events.enterPassword')}
                          leftIcon={<Lock className="w-5 h-5 text-neutral-400" />}
                          className="pr-10"
                        />
                        <button
                          type="button"
                          onClick={() => setShowNewPassword(!showNewPassword)}
                          className="absolute inset-y-0 right-0 pr-3 flex items-center"
                        >
                          {showNewPassword ? (
                            <EyeOff className="w-5 h-5 text-neutral-400 hover:text-neutral-600" />
                          ) : (
                            <Eye className="w-5 h-5 text-neutral-400 hover:text-neutral-600" />
                          )}
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-neutral-700 mb-1">
                        {t('events.confirmPassword')}
                      </label>
                      <Input
                        type={showNewPassword ? 'text' : 'password'}
                        value={editForm.confirm_new_password}
                        onChange={(e) => setEditForm(prev => ({ ...prev, confirm_new_password: e.target.value }))}
                        placeholder={t('events.confirmPasswordPlaceholder')}
                        leftIcon={<Lock className="w-5 h-5 text-neutral-400" />}
                      />
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">
                    {t('events.sourceMode', 'Source Mode')}
                  </label>
                  <select
                    value={editForm.source_mode}
                    onChange={(e) => {
                      const mode = e.target.value as 'managed' | 'reference';
                      setEditForm(prev => ({
                        ...prev,
                        source_mode: mode,
                        external_path: mode === 'reference'
                          ? (prev.external_path || event.external_path || '')
                          : ''
                      }));
                    }}
                    className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  >
                    <option value="managed">{t('events.sourceModeManaged', 'Managed (upload to PicPeak)')}</option>
                    <option value="reference">{t('events.sourceModeReference', 'Reference external folder')}</option>
                  </select>
                  <p className="text-xs text-neutral-500 mt-1">
                    {t('events.sourceModeHelp', 'Use managed mode for direct uploads or reference an external folder that is mounted at /external-media in Docker.')}
                  </p>
                </div>

                {editForm.source_mode === 'reference' && (
                  <div className="mt-3">
                    <label className="block text-sm font-medium text-neutral-700 mb-2">
                      {t('events.externalFolder', 'External Folder')}
                    </label>
                    <ExternalFolderPicker
                      value={editForm.external_path || ''}
                      onChange={(folder) => setEditForm(prev => ({ ...prev, external_path: folder }))}
                    />
                    <p className="text-xs text-neutral-500 mt-1">
                      {t('events.externalFolderHint', 'These folders come from the /external-media mount inside the container. Ensure it is accessible to the backend process.')}
                    </p>
                  </div>
                )}
                
                <div>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={editForm.allow_user_uploads}
                      onChange={(e) => setEditForm(prev => ({ ...prev, allow_user_uploads: e.target.checked }))}
                      className="w-4 h-4 text-primary-600 border-neutral-300 rounded focus:ring-primary-500"
                    />
                    <span className="ml-2 text-sm text-neutral-700">{t('events.allowUserUploads')}</span>
                  </label>
                  <p className="text-xs text-neutral-500 mt-1 ml-6">
                    {t('events.allowUserUploadsHelp')}
                  </p>
                </div>
                
                {editForm.allow_user_uploads && (
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-1">
                      {t('events.uploadCategory')}
                    </label>
                    <select
                      value={editForm.upload_category_id || ''}
                      onChange={(e) => setEditForm(prev => ({ 
                        ...prev, 
                        upload_category_id: e.target.value ? parseInt(e.target.value) : null 
                      }))}
                      className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    >
                      <option value="">{t('events.selectCategory')}</option>
                      {categories?.map(category => (
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
                
                {/* Feedback Settings */}
                <div className="mt-4 pt-4 border-t border-neutral-200">
                  <h3 className="text-sm font-semibold text-neutral-900 mb-3">{t('feedback.settings.title', 'Guest Feedback Settings')}</h3>
                  <FeedbackSettings
                    settings={feedbackSettings}
                    onChange={setFeedbackSettings}
                  />
                </div>

                {/* Download Protection Settings */}
                <div className="mt-4 pt-4 border-t border-neutral-200">
                  <h3 className="text-sm font-semibold text-neutral-900 mb-3 flex items-center gap-2">
                    <Shield className="w-4 h-4 text-primary-600" />
                    {t('events.downloadProtection', 'Download Protection')}
                  </h3>

                  <div className="space-y-3">
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={editForm.allow_downloads}
                        onChange={(e) => setEditForm(prev => ({ ...prev, allow_downloads: e.target.checked }))}
                        className="w-4 h-4 text-primary-600 border-neutral-300 rounded focus:ring-primary-500"
                      />
                      <Download className="w-4 h-4 ml-2 mr-1 text-neutral-500" />
                      <span className="text-sm text-neutral-700">{t('events.allowDownloads', 'Allow photo downloads')}</span>
                    </label>

                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={editForm.disable_right_click}
                        onChange={(e) => setEditForm(prev => ({ ...prev, disable_right_click: e.target.checked }))}
                        className="w-4 h-4 text-primary-600 border-neutral-300 rounded focus:ring-primary-500"
                      />
                      <MousePointer className="w-4 h-4 ml-2 mr-1 text-neutral-500" />
                      <span className="text-sm text-neutral-700">{t('events.disableRightClick', 'Block right-click menu')}</span>
                    </label>

                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={editForm.watermark_downloads}
                        onChange={(e) => setEditForm(prev => ({ ...prev, watermark_downloads: e.target.checked }))}
                        className="w-4 h-4 text-primary-600 border-neutral-300 rounded focus:ring-primary-500"
                      />
                      <Droplets className="w-4 h-4 ml-2 mr-1 text-neutral-500" />
                      <span className="text-sm text-neutral-700">{t('events.watermarkDownloads', 'Add watermark to downloads')}</span>
                    </label>

                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={editForm.enable_devtools_protection}
                        onChange={(e) => setEditForm(prev => ({ ...prev, enable_devtools_protection: e.target.checked }))}
                        className="w-4 h-4 text-primary-600 border-neutral-300 rounded focus:ring-primary-500"
                      />
                      <Monitor className="w-4 h-4 ml-2 mr-1 text-neutral-500" />
                      <span className="text-sm text-neutral-700">{t('events.enableDevtoolsProtection', 'Detect developer tools')}</span>
                    </label>

                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={editForm.use_canvas_rendering}
                        onChange={(e) => setEditForm(prev => ({ ...prev, use_canvas_rendering: e.target.checked }))}
                        className="w-4 h-4 text-primary-600 border-neutral-300 rounded focus:ring-primary-500"
                      />
                      <Image className="w-4 h-4 ml-2 mr-1 text-neutral-500" />
                      <span className="text-sm text-neutral-700">{t('events.useCanvasRendering', 'Canvas rendering (advanced protection)')}</span>
                    </label>

                    <p className="text-xs text-neutral-500 mt-2">
                      {t('events.protectionInfo', 'Protection features help prevent unauthorized downloads but cannot block all methods.')}
                    </p>
                  </div>
                </div>

                {/* Hero Logo Settings */}
                <div className="mt-4 pt-4 border-t border-neutral-200">
                  <h3 className="text-sm font-semibold text-neutral-900 mb-3 flex items-center gap-2">
                    <Layout className="w-4 h-4 text-primary-600" />
                    {t('events.heroLogoSettings', 'Hero Logo Settings')}
                  </h3>

                  <div className="space-y-3">
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={editForm.hero_logo_visible}
                        onChange={(e) => setEditForm(prev => ({ ...prev, hero_logo_visible: e.target.checked }))}
                        className="w-4 h-4 text-primary-600 border-neutral-300 rounded focus:ring-primary-500"
                      />
                      <Image className="w-4 h-4 ml-2 mr-1 text-neutral-500" />
                      <span className="text-sm text-neutral-700">{t('events.heroLogoVisible', 'Display logo in hero section')}</span>
                    </label>

                    {editForm.hero_logo_visible && (
                      <>
                        <div className="ml-6">
                          <label className="block text-sm font-medium text-neutral-700 mb-1">
                            {t('events.heroLogoSize', 'Logo Size')}
                          </label>
                          <select
                            value={editForm.hero_logo_size}
                            onChange={(e) => setEditForm(prev => ({ ...prev, hero_logo_size: e.target.value as 'small' | 'medium' | 'large' | 'xlarge' }))}
                            className="w-full sm:w-48 px-3 py-2 border border-neutral-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 text-sm"
                          >
                            <option value="small">{t('events.heroLogoSizeSmall', 'Small')}</option>
                            <option value="medium">{t('events.heroLogoSizeMedium', 'Medium')}</option>
                            <option value="large">{t('events.heroLogoSizeLarge', 'Large')}</option>
                            <option value="xlarge">{t('events.heroLogoSizeXLarge', 'Extra Large')}</option>
                          </select>
                        </div>

                        <div className="ml-6">
                          <label className="block text-sm font-medium text-neutral-700 mb-1">
                            {t('events.heroLogoPosition', 'Logo Position')}
                          </label>
                          <select
                            value={editForm.hero_logo_position}
                            onChange={(e) => setEditForm(prev => ({ ...prev, hero_logo_position: e.target.value as 'top' | 'center' | 'bottom' }))}
                            className="w-full sm:w-48 px-3 py-2 border border-neutral-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 text-sm"
                          >
                            <option value="top">{t('events.heroLogoPositionTop', 'Top (above title)')}</option>
                            <option value="center">{t('events.heroLogoPositionCenter', 'Center (between title and dates)')}</option>
                            <option value="bottom">{t('events.heroLogoPositionBottom', 'Bottom (below dates)')}</option>
                          </select>
                        </div>

                        {/* Custom Event Logo Upload */}
                        <div className="ml-6 mt-3 pt-3 border-t border-neutral-100">
                          <label className="block text-sm font-medium text-neutral-700 mb-2">
                            {t('events.eventCustomLogo', 'Custom Event Logo')}
                          </label>
                          <p className="text-xs text-neutral-500 mb-2">
                            {t('events.eventCustomLogoDescription', 'Upload a custom logo for this event. This overrides the global branding logo for this gallery only.')}
                          </p>

                          {event.hero_logo_url ? (
                            <div className="flex items-center gap-3">
                              <div className="w-16 h-16 border border-neutral-200 rounded-md flex items-center justify-center bg-neutral-50 overflow-hidden">
                                <img
                                  src={buildResourceUrl(event.hero_logo_url)}
                                  alt={t('events.eventCustomLogo', 'Custom Event Logo')}
                                  className="max-w-full max-h-full object-contain"
                                />
                              </div>
                              <div className="flex flex-col gap-1">
                                <label className="cursor-pointer inline-flex items-center gap-1 text-xs text-primary-600 hover:text-primary-700">
                                  <Upload className="w-3 h-3" />
                                  {t('events.replaceLogo', 'Replace')}
                                  <input
                                    type="file"
                                    className="hidden"
                                    accept="image/png,image/jpeg,image/gif,image/svg+xml"
                                    disabled={logoUploading}
                                    onChange={(e) => {
                                      const file = e.target.files?.[0];
                                      if (file) handleEventLogoUpload(file);
                                      e.target.value = '';
                                    }}
                                  />
                                </label>
                                <button
                                  type="button"
                                  onClick={handleEventLogoRemove}
                                  disabled={logoUploading}
                                  className="inline-flex items-center gap-1 text-xs text-red-600 hover:text-red-700"
                                >
                                  <Trash2 className="w-3 h-3" />
                                  {t('events.removeLogo', 'Remove')}
                                </button>
                              </div>
                              {logoUploading && <Loading size="sm" />}
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <label className={`cursor-pointer inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium border border-neutral-300 rounded-md hover:bg-neutral-50 ${logoUploading ? 'opacity-50 pointer-events-none' : ''}`}>
                                <Upload className="w-3.5 h-3.5" />
                                {t('events.uploadEventLogo', 'Upload Logo')}
                                <input
                                  type="file"
                                  className="hidden"
                                  accept="image/png,image/jpeg,image/gif,image/svg+xml"
                                  disabled={logoUploading}
                                  onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) handleEventLogoUpload(file);
                                    e.target.value = '';
                                  }}
                                />
                              </label>
                              {logoUploading && <Loading size="sm" />}
                            </div>
                          )}
                        </div>
                      </>
                    )}

                    <p className="text-xs text-neutral-500 mt-2">
                      {t('events.heroLogoInfo', 'These settings apply when the gallery uses the Hero layout. You can hide the logo or customize its size and position.')}
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <dl className="space-y-4">
                <div>
                  <dt className="text-sm font-medium text-neutral-500">{t('events.sourceMode', 'Source Mode')}</dt>
                  <dd className="mt-1 text-sm text-neutral-900">
                    {event.source_mode === 'reference' ? t('events.sourceModeReference', 'Reference external folder') : t('events.sourceModeManaged', 'Managed (upload to PicPeak)')}
                    {event.source_mode === 'reference' && event.external_path ? (
                      <span className="text-neutral-500 ml-2">/external-media/{event.external_path}</span>
                    ) : null}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-neutral-500">{t('events.welcomeMessage')}</dt>
                  <dd className="mt-1 text-sm text-neutral-900">
                    {event.welcome_message || <span className="text-neutral-400">{t('events.noWelcomeMessageSet')}</span>}
                  </dd>
                </div>
                
                <div>
                  <dt className="text-sm font-medium text-neutral-500">{t('events.hostName')}</dt>
                  <dd className="mt-1 text-sm text-neutral-900">
                    {event.customer_name || <span className="text-neutral-400">{t('common.notSet')}</span>}
                  </dd>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <dt className="text-sm font-medium text-neutral-500">{t('events.hostEmail')}</dt>
                  <dd className="mt-1 text-sm text-neutral-900">{event.customer_email}</dd>
                  </div>
                  
                  <div>
                    <dt className="text-sm font-medium text-neutral-500">{t('events.adminEmail')}</dt>
                    <dd className="mt-1 text-sm text-neutral-900">{event.admin_email}</dd>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <dt className="text-sm font-medium text-neutral-500">{t('events.created')}</dt>
                    <dd className="mt-1 text-sm text-neutral-900">
                      {event.created_at && format(safeParseDate(event.created_at)!, 'PP')}
                    </dd>
                  </div>
                  
                  <div>
                    <dt className="text-sm font-medium text-neutral-500">{t('events.expires')}</dt>
                    <dd className="mt-1 text-sm text-neutral-900">
                      {event.expires_at ? (
                        <>
                          {format(safeParseDate(event.expires_at)!, 'PP')}
                          {!event.is_archived && daysUntilExpiration !== null && daysUntilExpiration > 0 && (
                            <span className="text-neutral-500 ml-1">
                              {t('events.daysLeft', { count: daysUntilExpiration })}
                            </span>
                          )}
                        </>
                      ) : (
                        <span className="text-neutral-500">{t('events.neverExpires', 'Never')}</span>
                      )}
                    </dd>
                  </div>
                </div>
                
                <div>
                  <dt className="text-sm font-medium text-neutral-500">{t('events.heroPhoto')}</dt>
                  <dd className="mt-1 text-sm text-neutral-900">
                    {event.hero_photo_id ? (
                      <span className="text-primary-600">{t('events.heroPhotoSelected')}</span>
                    ) : (
                      <span className="text-neutral-400">{t('events.noHeroPhotoSelected')}</span>
                    )}
                  </dd>
                </div>
                
                <div>
                  <dt className="text-sm font-medium text-neutral-500">{t('events.userUploads')}</dt>
                  <dd className="mt-1 text-sm text-neutral-900">
                    {event.allow_user_uploads ? (
                      <div className="space-y-1">
                        <span className="inline-flex items-center px-2 py-1 text-xs font-medium text-green-700 bg-green-100 rounded">
                          {t('common.yes')}
                        </span>
                        {event.upload_category_id && (
                          <p className="text-xs text-neutral-600">
                            {t('events.uploadCategory')}: {categories.find(c => c.id === event.upload_category_id)?.name || 'N/A'}
                          </p>
                        )}
                      </div>
                    ) : (
                      <span className="inline-flex items-center px-2 py-1 text-xs font-medium text-neutral-700 bg-neutral-100 rounded">
                        {t('common.no')}
                      </span>
                    )}
                  </dd>
                </div>

                {/* Download Protection Display */}
                <div className="pt-3 mt-3 border-t border-neutral-200">
                  <dt className="text-sm font-medium text-neutral-500 flex items-center gap-2">
                    <Shield className="w-4 h-4" />
                    {t('events.downloadProtection', 'Download Protection')}
                  </dt>
                  <dd className="mt-2 text-sm text-neutral-900">
                    <div className="flex flex-wrap gap-2">
                      <span className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded ${
                        event.protection_level === 'maximum' ? 'bg-red-100 text-red-700' :
                        event.protection_level === 'enhanced' ? 'bg-orange-100 text-orange-700' :
                        event.protection_level === 'standard' ? 'bg-blue-100 text-blue-700' :
                        'bg-neutral-100 text-neutral-700'
                      }`}>
                        {event.protection_level || 'standard'}
                      </span>
                      {event.disable_right_click && (
                        <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-neutral-100 text-neutral-700 rounded">
                          <MousePointer className="w-3 h-3 mr-1" />
                          {t('events.rightClickBlocked', 'Right-click blocked')}
                        </span>
                      )}
                      {event.enable_devtools_protection && (
                        <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-neutral-100 text-neutral-700 rounded">
                          <Monitor className="w-3 h-3 mr-1" />
                          {t('events.devtoolsDetection', 'DevTools detection')}
                        </span>
                      )}
                      {!event.allow_downloads && (
                        <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-red-100 text-red-700 rounded">
                          <Download className="w-3 h-3 mr-1" />
                          {t('events.downloadsDisabled', 'Downloads disabled')}
                        </span>
                      )}
                      {event.watermark_downloads && (
                        <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-neutral-100 text-neutral-700 rounded">
                          <Droplets className="w-3 h-3 mr-1" />
                          {t('events.watermarked', 'Watermarked')}
                        </span>
                      )}
                    </div>
                  </dd>
                </div>

                {/* Hero Logo Settings Display */}
                <div className="pt-3 mt-3 border-t border-neutral-200">
                  <dt className="text-sm font-medium text-neutral-500 flex items-center gap-2">
                    <Layout className="w-4 h-4" />
                    {t('events.heroLogoSettings', 'Hero Logo Settings')}
                  </dt>
                  <dd className="mt-2 text-sm text-neutral-900">
                    <div className="flex flex-wrap gap-2">
                      {event.hero_logo_visible !== false ? (
                        <>
                          <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-green-100 text-green-700 rounded">
                            <Image className="w-3 h-3 mr-1" />
                            {t('events.heroLogoVisibleLabel', 'Logo visible')}
                          </span>
                          <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-neutral-100 text-neutral-700 rounded">
                            {t('events.heroLogoSizeLabel', 'Size')}: {event.hero_logo_size || 'medium'}
                          </span>
                          <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-neutral-100 text-neutral-700 rounded">
                            {t('events.heroLogoPositionLabel', 'Position')}: {event.hero_logo_position || 'top'}
                          </span>
                        </>
                      ) : (
                        <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-neutral-100 text-neutral-700 rounded">
                          <Image className="w-3 h-3 mr-1" />
                          {t('events.heroLogoHidden', 'Logo hidden')}
                        </span>
                      )}
                    </div>
                  </dd>
                </div>
              </dl>
            )}
          </Card>

          {/* Share Link */}
          <Card padding="md">
            <h2 className="text-lg font-semibold text-neutral-900 mb-4">{t('events.shareLink')}</h2>
            
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={event.share_link}
                readOnly
                className="flex-1 px-3 py-2 bg-neutral-50 border border-neutral-300 rounded-lg text-sm"
              />
              <Button
                variant="outline"
                size="md"
                leftIcon={copiedLink ? <CheckCircle className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                onClick={handleCopyLink}
              >
                {copiedLink ? t('events.copied') : t('events.copy')}
              </Button>
            </div>
            
            <p className="text-sm text-neutral-600 mt-2">
              {isGalleryPublic(event.require_password)
                ? t('events.shareWithGuestsPublic', 'Anyone with this link can view the gallery. No password is required.')
                : t('events.shareWithGuests')}
            </p>
            
            {!event.is_archived && (
              <div className="mt-4 pt-4 border-t border-neutral-200 space-y-2">
                <Button
                  variant="outline"
                  size="sm"
                  leftIcon={<Key className="w-4 h-4" />}
                  onClick={() => setShowPasswordReset(true)}
                  className="w-full justify-center"
                >
                  {t('events.resetGalleryPassword')}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  leftIcon={<Mail className="w-4 h-4" />}
                  onClick={async () => {
                    try {
                      await eventsService.resendCreationEmail(event.id);
                      toast.success(t('events.creationEmailResent'));
                    } catch (error) {
                      toast.error(t('events.failedToResendEmail'));
                    }
                  }}
                  className="w-full justify-center"
                >
                  {t('events.resendCreationEmail')}
                </Button>
              </div>
            )}
          </Card>



          {/* Actions */}
          {!event.is_archived && (
            <Card padding="md">
              <h2 className="text-lg font-semibold text-neutral-900 mb-4">{t('events.actions')}</h2>
              
              <div className="space-y-3">
                <Button
                  variant="outline"
                  leftIcon={<Archive className="w-4 h-4" />}
                  onClick={() => {
                    if (confirm(t('events.archiveConfirm'))) {
                      archiveMutation.mutate();
                    }
                  }}
                  isLoading={archiveMutation.isPending}
                  className="w-full justify-center"
                >
                  {t('events.archiveEvent')}
                </Button>
                
                <p className="text-xs text-neutral-500 text-center">
                  {t('events.archivingInfo')}
                </p>
              </div>
            </Card>
          )}
        </div>

        {/* Right Column - Statistics, Theme, and Actions */}
        <div className="space-y-6">
          {/* Photo Statistics */}
          <Card padding="md">
            <h2 className="text-lg font-semibold text-neutral-900 mb-4">{t('events.photoStatistics')}</h2>
            
            <div className="space-y-3">
              <div className="flex items-center justify-between py-2 px-3 bg-neutral-50 rounded-lg">
                <span className="text-sm text-neutral-600">{t('events.totalPhotos')}</span>
                <span className="text-sm font-medium">{event.photo_count || 0}</span>
              </div>
              
              <div className="flex items-center justify-between py-2 px-3 bg-neutral-50 rounded-lg">
                <span className="text-sm text-neutral-600">{t('events.totalSize')}</span>
                <span className="text-sm font-medium">
                  {event.total_size ? `${(event.total_size / (1024 * 1024)).toFixed(1)} MB` : '0 MB'}
                </span>
              </div>
              
              <div className="flex items-center justify-between py-2 px-3 bg-neutral-50 rounded-lg">
                <span className="text-sm text-neutral-600">{t('events.categories')}</span>
                <span className="text-sm font-medium">{categories.length}</span>
              </div>
              
              {event.total_views !== undefined && (
                <div className="flex items-center justify-between py-2 px-3 bg-neutral-50 rounded-lg">
                  <span className="text-sm text-neutral-600">{t('events.totalViews')}</span>
                  <span className="text-sm font-medium">{event.total_views || 0}</span>
                </div>
              )}
              
              {event.total_downloads !== undefined && (
                <div className="flex items-center justify-between py-2 px-3 bg-neutral-50 rounded-lg">
                  <span className="text-sm text-neutral-600">{t('events.totalDownloads')}</span>
                  <span className="text-sm font-medium">{event.total_downloads || 0}</span>
                </div>
              )}
              
              {event.unique_visitors !== undefined && (
                <div className="flex items-center justify-between py-2 px-3 bg-neutral-50 rounded-lg">
                  <span className="text-sm text-neutral-600">{t('events.uniqueVisitors')}</span>
                  <span className="text-sm font-medium">{event.unique_visitors || 0}</span>
                </div>
              )}
            </div>
            
            <div className="mt-4">
              <Button
                variant="outline"
                size="sm"
                leftIcon={<Image className="w-4 h-4" />}
                onClick={() => setActiveTab('photos')}
                className="w-full justify-center"
              >
                {t('events.managePhotos')}
              </Button>
            </div>
          </Card>

          {/* Theme & Style */}
          {isEditing && !event.is_archived && (
            <Card padding="md">
              <h2 className="text-lg font-semibold text-neutral-900 mb-4">{t('branding.themeAndStyle')}</h2>
              <ThemeCustomizerEnhanced
                value={currentTheme || GALLERY_THEME_PRESETS.default.config}
                onChange={(theme) => {
                  setCurrentTheme(theme);
                  setEditForm(prev => ({ ...prev, color_theme: JSON.stringify(theme) }));
                }}
                presetName={currentPresetName}
                onPresetChange={(presetName) => {
                  setCurrentPresetName(presetName);
                  if (presetName !== 'custom') {
                    const preset = GALLERY_THEME_PRESETS[presetName];
                    if (preset) {
                      setCurrentTheme(preset.config);
                      setEditForm(prev => ({ ...prev, color_theme: presetName }));
                    }
                  }
                }}
                isPreviewMode={true}
                showGalleryLayouts={true}
                hideActions={true}
                cssTemplates={cssTemplates}
                cssTemplateId={editForm.css_template_id}
                onCssTemplateChange={(templateId) => setEditForm(prev => ({ ...prev, css_template_id: templateId }))}
              />
            </Card>
          )}

          {/* Theme Display (when not editing) */}
          {!isEditing && !event.is_archived && (
            <Card padding="md">
              <h2 className="text-lg font-semibold text-neutral-900 mb-4">{t('events.galleryTheme')}</h2>
              <ThemeDisplay 
                theme={event.color_theme || GALLERY_THEME_PRESETS.default.config} 
                presetName={event.color_theme && !event.color_theme.startsWith('{') ? event.color_theme : undefined}
                showDetails={true}
              />
            </Card>
          )}

          {/* Feedback Moderation Panel */}
          {!event.is_archived && feedbackSettings?.feedback_enabled && (
            <FeedbackModerationPanel 
              eventId={parseInt(id!)} 
              compact={true}
              maxItems={3}
            />
          )}

          {/* Archive Status */}
          {event.is_archived ? (
            <Card padding="md">
              <h2 className="text-lg font-semibold text-neutral-900 mb-4">{t('events.archiveStatusTitle')}</h2>
              
              <div className="space-y-3">
                <div>
                  <p className="text-sm font-medium text-neutral-500">{t('events.archivedOn')}</p>
                  <p className="text-sm text-neutral-900">
                    {event.archived_at && format(safeParseDate(event.archived_at)!, 'PPp')}
                  </p>
                </div>
                
                {event.archive_path && (
                  <Button
                    variant="outline"
                    size="sm"
                    leftIcon={<Download className="w-4 h-4" />}
                    onClick={async () => {
                      try {
                        toast.info(t('events.downloadingArchive', { name: event.event_name }));
                        await archiveService.downloadArchive(Number(id), `${event.slug}-archive.zip`);
                        toast.success(t('events.downloadStarted'));
                      } catch (error) {
                        toast.error(t('events.failedToDownloadArchive'));
                      }
                    }}
                    className="w-full justify-center"
                  >
                    {t('events.downloadArchive')}
                  </Button>
                )}
              </div>
            </Card>
          ) : null}
        </div>
      </div>
      )}

      {/* Photos Tab */}
      {activeTab === 'photos' && (
        <div>
          {/* Photo Upload Modal */}
          <PhotoUploadModal
            isOpen={showPhotoUpload}
            onClose={() => setShowPhotoUpload(false)}
            eventId={parseInt(id!)}
            onUploadComplete={() => {
              queryClient.invalidateQueries({ queryKey: ['admin-event', id] });
              queryClient.invalidateQueries({ queryKey: ['admin-event-photos', id] });
              toast.success(t('toast.uploadSuccess'));
              refetchPhotos();
            }}
          />

          {/* Photo Filters */}
          <PhotoFilters
            categories={categories}
            selectedCategory={photoFilters.category_id}
            searchTerm={photoFilters.search ?? ''}
            sortBy={photoFilters.sort ?? 'date'}
            sortOrder={photoFilters.order ?? 'desc'}
            onCategoryChange={(categoryId) => setPhotoFilters(prev => ({ ...prev, category_id: categoryId }))}
            onSearchChange={(search) => setPhotoFilters(prev => ({ ...prev, search }))}
            onSortChange={(sort, order) => setPhotoFilters(prev => ({ ...prev, sort, order }))}
            mediaType={photoFilters.media_type || 'all'}
            onMediaTypeChange={(mediaType) => setPhotoFilters(prev => ({
              ...prev,
              media_type: mediaType === 'all' ? undefined : mediaType
            }))}
            showMediaFilter={showMediaFilter}
          />

          {/* Feedback Filter Panel for Export */}
          <PhotoFilterPanel
            filters={feedbackFilters}
            onChange={setFeedbackFilters}
            summary={filterSummary || null}
            isLoading={photosLoading}
          />

          {/* Actions Bar */}
          <div className="mb-4 flex flex-wrap justify-between items-center gap-4">
            <div className="flex items-center gap-3">
              <Button
                variant="primary"
                size="sm"
                leftIcon={<Upload className="w-4 h-4" />}
                onClick={() => setShowPhotoUpload(true)}
              >
                {t('events.uploadPhotos')}
              </Button>
              {event.source_mode === 'reference' && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowExternalImport(true)}
                >
                  {t('events.importExternal', 'Import from External Folder')}
                </Button>
              )}
            </div>
            <PhotoExportMenu
              eventId={parseInt(id!)}
              selectedPhotoIds={selectedPhotoIds}
              filters={feedbackFilters}
            />
          </div>

          {/* Photo Grid */}
          {photosLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loading size="lg" text={t('events.loadingPhotos')} />
            </div>
          ) : (
            <AdminPhotoGrid
              photos={photos}
              eventId={parseInt(id!)}
              onPhotoClick={(photo, index) => setSelectedPhoto({ photo, index })}
              onPhotosDeleted={() => {
                refetchPhotos();
                queryClient.invalidateQueries({ queryKey: ['admin-event', id] });
              }}
              onSelectionChange={setSelectedPhotoIds}
              categories={categories}
            />
          )}

          {/* Photo Viewer */}
          {selectedPhoto && (
            <AdminPhotoViewer
              photos={photos}
              initialIndex={selectedPhoto.index}
              eventId={parseInt(id!)}
              onClose={() => setSelectedPhoto(null)}
              onPhotoDeleted={() => {
                refetchPhotos();
                queryClient.invalidateQueries({ queryKey: ['admin-event', id] });
                setSelectedPhoto(null);
              }}
              categories={categories}
            />
          )}
        </div>
      )}

      {/* Categories Tab */}
      {activeTab === 'categories' && (
        <div>
          <Card padding="md">
            <div className="mb-6">
              <h2 className="text-lg font-semibold text-neutral-900 mb-2">{t('events.photoCategories')}</h2>
              <p className="text-sm text-neutral-600">
                {t('events.organizeCategoriesInfo')}
              </p>
            </div>
            
            <EventCategoryManager 
              eventId={parseInt(id!)} 
            />
            
            <div className="mt-6 p-4 bg-blue-50 rounded-lg">
              <p className="text-sm text-blue-800">
                {t('events.categoriesTip')}
              </p>
            </div>
          </Card>
        </div>
      )}

      {/* Password Reset Modal */}
      {showPasswordReset && (
        <PasswordResetModal
          eventName={event.event_name}
          onConfirm={async (sendEmail) => {
            const result = await eventsService.resetPassword(event.id, sendEmail);
            return result;
          }}
          onClose={() => setShowPasswordReset(false)}
        />
      )}

      {/* External Import Modal */}
      {showExternalImport && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="max-w-2xl w-full">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-neutral-900">{t('events.importExternal', 'Import from External Folder')}</h2>
              <button onClick={() => setShowExternalImport(false)} className="text-neutral-400 hover:text-neutral-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mb-3 text-sm text-neutral-700">
              {t('events.externalImportInfo', 'All pictures from the selected folder will be imported.')}
            </div>
            <div className="mb-2 text-sm text-neutral-700">
              {t('events.selectExternalFolder', 'Select external folder under /external-media')}
            </div>
            <ExternalFolderPicker value={externalPath || event.external_path || ''} onChange={setExternalPath} />

            <div className="mt-4 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowExternalImport(false)}>
                {t('common.cancel')}
              </Button>
              <Button
                variant="primary"
                isLoading={importing}
                onClick={async () => {
                  try {
                    setImporting(true);
                    const selected = externalPath || event.external_path || '';
                    if (!selected) {
                      toast.error(t('errors.somethingWentWrong', 'Something went wrong'));
                      return;
                    }
                    await externalMediaService.importEvent(parseInt(id!), selected, { recursive: true });
                    toast.success(t('toast.saveSuccess'));
                    queryClient.invalidateQueries({ queryKey: ['admin-event', id] });
                    queryClient.invalidateQueries({ queryKey: ['admin-event-photos', id] });
                    setShowExternalImport(false);
                  } catch (e: any) {
                    toast.error(e?.response?.data?.error || 'Import failed');
                  } finally {
                    setImporting(false);
                  }
                }}
              >
                {t('events.importFromSelectedFolder', 'Import from selected folder')}
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Event Rename Dialog */}
      <EventRenameDialog
        isOpen={showRenameDialog}
        eventName={event.event_name}
        eventId={event.id}
        customerEmail={event.customer_email}
        onClose={() => setShowRenameDialog(false)}
        onRename={async (newName, resendEmail) => {
          const result = await eventsService.renameEvent(event.id, newName, resendEmail);
          if (result.success) {
            queryClient.invalidateQueries({ queryKey: ['admin-event', id] });
            queryClient.invalidateQueries({ queryKey: ['admin-events'] });
            toast.success(t('events.rename.success', 'Event renamed successfully!'));
          }
          return result;
        }}
        onValidate={(newName) => eventsService.validateRename(event.id, newName)}
      />

    </div>
  );
};

EventDetailsPage.displayName = 'EventDetailsPage';
