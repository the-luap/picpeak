import React, { useState, useEffect } from 'react';
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
  MessageSquare
} from 'lucide-react';
import { parseISO, differenceInDays } from 'date-fns';
import { toast } from 'react-toastify';
import { useLocalizedDate } from '../../hooks/useLocalizedDate';

import { Button, Input, Card, Loading } from '../../components/common';
import { EventCategoryManager, AdminPhotoGrid, AdminPhotoViewer, PhotoFilters, PasswordResetModal, ThemeCustomizerEnhanced, ThemeDisplay, HeroPhotoSelector, PhotoUploadModal, FeedbackSettings, FeedbackModerationPanel } from '../../components/admin';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { eventsService } from '../../services/events.service';
import { archiveService } from '../../services/archive.service';
import { externalMediaService } from '../../services/externalMedia.service';
import { photosService, AdminPhoto, type PhotoFilters as PhotoFilterParams } from '../../services/photos.service';
import { feedbackService, FeedbackSettings as FeedbackSettingsType } from '../../services/feedback.service';
import { ThemeConfig, GALLERY_THEME_PRESETS } from '../../types/theme.types';

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
  
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    welcome_message: '',
    color_theme: '',
    expires_at: '',
    allow_user_uploads: false,
    upload_category_id: null as number | null,
    hero_photo_id: null as number | null,
    host_name: '',
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
  const [currentTheme, setCurrentTheme] = useState<ThemeConfig | null>(null);
  const [currentPresetName, setCurrentPresetName] = useState<string>('default');
  
  // Photo filters state
  const [photoFilters, setPhotoFilters] = useState<PhotoFilterParams>({
    category_id: undefined as number | null | undefined,
    search: '',
    sort: 'date',
    order: 'desc' as 'asc' | 'desc'
  });

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

  const daysUntilExpiration = differenceInDays(parseISO(event.expires_at), new Date());
  const isExpired = daysUntilExpiration <= 0;
  const isExpiring = daysUntilExpiration > 0 && daysUntilExpiration <= 7;

  const handleStartEdit = () => {
    setEditForm({
      welcome_message: event.welcome_message || '',
      color_theme: event.color_theme || '',
      expires_at: format(parseISO(event.expires_at), 'yyyy-MM-dd'),
      allow_user_uploads: event.allow_user_uploads || false,
      upload_category_id: event.upload_category_id || null,
      hero_photo_id: event.hero_photo_id || null,
      host_name: event.host_name || '',
    });
    
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

  const handleSaveEdit = async () => {
    // Prepare color_theme - if we have a custom theme, serialize it
    let themeToSave = editForm.color_theme;
    if (currentTheme && currentPresetName === 'custom') {
      themeToSave = JSON.stringify(currentTheme);
    } else if (currentPresetName && currentPresetName !== 'custom') {
      // Use preset name for non-custom themes
      themeToSave = currentPresetName;
    }
    
    // Clean up the data - remove undefined values
    const updateData: any = {
      expires_at: editForm.expires_at,
      allow_user_uploads: editForm.allow_user_uploads,
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
    if (editForm.host_name !== undefined && editForm.host_name !== null) {
      updateData.host_name = editForm.host_name;
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
              <span className="flex items-center">
                <Calendar className="w-4 h-4 mr-1" />
                {format(parseISO(event.event_date), 'PPP')}
              </span>
              <span className="capitalize">{event.event_type}</span>
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
                href={
                  event.share_link.startsWith('http') 
                    ? event.share_link
                    : `/gallery/${event.share_link}`
                }
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
                    value={editForm.host_name}
                    onChange={(e) => setEditForm(prev => ({ ...prev, host_name: e.target.value }))}
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
                  <h3 className="text-sm font-semibold text-neutral-900 mb-3">{t('feedback.settings', 'Feedback Settings')}</h3>
                  <FeedbackSettings
                    settings={feedbackSettings}
                    onChange={setFeedbackSettings}
                  />
                </div>
              </div>
            ) : (
              <dl className="space-y-4">
                <div>
                  <dt className="text-sm font-medium text-neutral-500">Source Mode</dt>
                  <dd className="mt-1 text-sm text-neutral-900">
                    {event.source_mode === 'reference' ? 'Reference (external folder)' : 'Managed (upload)'}
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
                    {event.host_name || <span className="text-neutral-400">{t('common.notSet')}</span>}
                  </dd>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <dt className="text-sm font-medium text-neutral-500">{t('events.hostEmail')}</dt>
                    <dd className="mt-1 text-sm text-neutral-900">{event.host_email}</dd>
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
                      {format(parseISO(event.created_at), 'PP')}
                    </dd>
                  </div>
                  
                  <div>
                    <dt className="text-sm font-medium text-neutral-500">{t('events.expires')}</dt>
                    <dd className="mt-1 text-sm text-neutral-900">
                      {format(parseISO(event.expires_at), 'PP')}
                      {!event.is_archived && daysUntilExpiration > 0 && (
                        <span className="text-neutral-500 ml-1">
                          {t('events.daysLeft', { count: daysUntilExpiration })}
                        </span>
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
              {t('events.shareWithGuests')}
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
                isPreviewMode={false}
                showGalleryLayouts={true}
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
                    {event.archived_at && format(parseISO(event.archived_at), 'PPp')}
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
          />

          {/* Actions Bar */}
          <div className="mb-4 flex justify-between items-center">
            <Button
              variant="primary"
              size="sm"
              leftIcon={<Upload className="w-4 h-4" />}
              onClick={() => setShowPhotoUpload(true)}
            >
              {t('events.uploadPhotos')}
            </Button>
            {event.source_mode === 'reference' && (
              <div className="ml-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowExternalImport(true)}
                >
                  {t('events.importExternal', 'Import from External Folder')}
                </Button>
              </div>
            )}
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

    </div>
  );
};

EventDetailsPage.displayName = 'EventDetailsPage';
