import React, { useState, useMemo, useEffect } from 'react';
import { differenceInDays, parseISO } from 'date-fns';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { Button, SkeletonGalleryGrid, Skeleton } from '../common';
import { useGalleryAuth, useTheme } from '../../contexts';
import { useGalleryPhotos, useDownloadAllPhotos } from '../../hooks/useGallery';
import { PhotoGridWithLayouts } from './PhotoGridWithLayouts';
import { ExpirationBanner } from './ExpirationBanner';
import { CountdownTimer } from './CountdownTimer';
import { GalleryLayout } from './GalleryLayout';
import { GallerySidebar } from './GallerySidebar';
import { PhotoFilterBar } from './PhotoFilterBar';
import { UserPhotoUpload } from './UserPhotoUpload';
import type { FilterType } from './GalleryFilter';
import { analyticsService } from '../../services/analytics.service';
import { useDevToolsProtection } from '../../hooks/useDevToolsProtection';
import { GALLERY_THEME_PRESETS } from '../../types/theme.types';
import { api } from '../../config/api';
import { Upload, Menu } from 'lucide-react';
import { galleryService } from '../../services/gallery.service';
import { feedbackService } from '../../services/feedback.service';
import { useWatermarkSettings } from '../../hooks/useWatermarkSettings';
import type { Photo } from '../../types';

interface GalleryViewProps {
  slug: string;
  event: {
    id: number;
    event_name: string;
    event_type: string;
    event_date: string;
    welcome_message?: string;
    color_theme?: string;
    expires_at: string;
    allow_user_uploads?: boolean;
    upload_category_id?: number | null;
    hero_photo_id?: number | null;
    allow_downloads?: boolean;
  };
}

export const GalleryView: React.FC<GalleryViewProps> = ({ slug, event }) => {
  const { t } = useTranslation();
  const { logout } = useGalleryAuth();
  const { setTheme, theme } = useTheme();
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'date' | 'name' | 'size' | 'rating'>('date');
  const [brandingSettings, setBrandingSettings] = useState<any>(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedPhotos, setSelectedPhotos] = useState<Set<number>>(new Set());
  const [feedbackEnabled, setFeedbackEnabled] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const { watermarkEnabled } = useWatermarkSettings();
  const [protectionLevel, setProtectionLevel] = useState<'basic' | 'standard' | 'enhanced' | 'maximum'>('standard');
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [guestId, setGuestId] = useState<string>('');
  const [staticHeroPhoto, setStaticHeroPhoto] = useState<Photo | null>(null);
  
  // Generate a unique guest ID for this session
  useEffect(() => {
    // Use existing guest ID from localStorage or generate new one
    let storedGuestId = localStorage.getItem('gallery_guest_id');
    if (!storedGuestId) {
      storedGuestId = `guest_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      localStorage.setItem('gallery_guest_id', storedGuestId);
    }
    setGuestId(storedGuestId);
  }, []);
  
  // Fetch photos with filter support
  const { data, isLoading, error, refetch } = useGalleryPhotos(slug, filterType, guestId);
  
  // Set protection level when data is available
  useEffect(() => {
    if (data?.event?.protection_level) {
      setProtectionLevel(data.event.protection_level);
    }
  }, [data?.event?.protection_level]);
  
  // DevTools protection for enhanced and maximum levels
  useDevToolsProtection({
    enabled: protectionLevel === 'enhanced' || protectionLevel === 'maximum',
    detectionSensitivity: protectionLevel === 'maximum' ? 'high' : 'medium',
    onDevToolsDetected: () => {
      console.warn('DevTools detected in gallery view');
      
      // Track analytics
      if (typeof window !== 'undefined' && (window as any).umami) {
        (window as any).umami.track('gallery_devtools_detected', {
          gallery: slug,
          protectionLevel,
          eventId: data?.event?.id
        });
      }
      
      // For maximum protection, redirect away from gallery
      if (protectionLevel === 'maximum') {
        setTimeout(() => {
          window.location.href = '/';
        }, 100);
      }
    },
    redirectOnDetection: protectionLevel === 'maximum',
    redirectUrl: '/'
  });
  
  // Data updates are handled by React Query
  const downloadAllMutation = useDownloadAllPhotos();

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Fetch branding settings
  const { data: settingsData } = useQuery({
    queryKey: ['gallery-settings'],
    queryFn: async () => {
      const response = await api.get('/public/settings');
      return response.data;
    },
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  // Fetch feedback settings
  const { data: feedbackSettings } = useQuery({
    queryKey: ['gallery-feedback-settings', event.id],
    queryFn: async () => {
      try {
        // Use public endpoint to get feedback settings
        const response = await api.get(`/gallery/${slug}/feedback-settings`);
        return response.data;
      } catch (error) {
        console.error('Error fetching feedback settings:', error);
        // If endpoint doesn't exist or returns error, default to disabled
        return { feedback_enabled: false };
      }
    },
    enabled: !!event.id,
  });

  // Update feedbackEnabled when settings change
  useEffect(() => {
    if (feedbackSettings) {
      setFeedbackEnabled(feedbackSettings.feedback_enabled || false);
    }
  }, [feedbackSettings]);

  // Apply branding settings
  useEffect(() => {
    if (settingsData) {
      setBrandingSettings({
        company_name: settingsData.branding_company_name || '',
        company_tagline: settingsData.branding_company_tagline || '',
        support_email: settingsData.branding_support_email || '',
        footer_text: settingsData.branding_footer_text || '© 2024 Your Company. All rights reserved.',
        watermark_enabled: settingsData.branding_watermark_enabled || false,
        logo_url: settingsData.branding_logo_url || null,
      });
    }
  }, [settingsData]);

  // Determine a stable hero photo from the initial (unfiltered) load
  useEffect(() => {
    if (!staticHeroPhoto && data?.photos && filterType === 'all') {
      let hero: Photo | null = null;
      const heroId = data?.event?.hero_photo_id || null;
      if (heroId) {
        hero = data.photos.find(p => p.id === heroId) || null;
      }
      if (!hero && data.photos.length > 0) {
        hero = data.photos[0];
      }
      if (hero) {
        setStaticHeroPhoto(hero);
      }
    }
  }, [data?.photos, data?.event?.hero_photo_id, filterType, staticHeroPhoto]);

  // Apply theme when settings are loaded
  useEffect(() => {
    if (settingsData && data?.event) {
      let themeToApply = null;
      const fullEvent = data.event; // Use the full event data from API
      
      if (fullEvent.color_theme) {
        try {
          // Check if it's a valid JSON string
          if (fullEvent.color_theme.startsWith('{')) {
            const eventTheme = JSON.parse(fullEvent.color_theme);
            themeToApply = eventTheme;
          } else {
            // Handle legacy theme names - check if it's a preset
            const preset = GALLERY_THEME_PRESETS[fullEvent.color_theme];
            if (preset) {
              themeToApply = preset.config;
            } else {
              // Unknown theme name, fall back to global theme
              if (settingsData.theme_config) {
                themeToApply = settingsData.theme_config;
              }
            }
          }
        } catch (e) {
          // Invalid theme format - use default
          // Fall back to global theme
          if (settingsData.theme_config) {
            themeToApply = settingsData.theme_config;
          }
        }
      } else if (settingsData.theme_config) {
        // No event theme, use global theme
        themeToApply = settingsData.theme_config;
      }
      
      // Apply theme with a small delay to ensure it overrides any global theme
      if (themeToApply) {
        // Use setTimeout to ensure this runs after any global theme application
        const timer = setTimeout(() => {
          // If there's a hero photo, add it to gallery settings
          if (fullEvent.hero_photo_id && themeToApply.gallerySettings) {
            themeToApply.gallerySettings.heroImageId = fullEvent.hero_photo_id;
            // Apply hero photo ID to existing gallery settings
          } else if (fullEvent.hero_photo_id) {
            themeToApply.gallerySettings = { heroImageId: fullEvent.hero_photo_id };
            // Create gallery settings with hero photo ID
          }
          setTheme(themeToApply);
        }, 0);
        
        return () => clearTimeout(timer);
      }
    }
  }, [settingsData, data, setTheme]); // Use data instead of event prop

  // Calculate days until expiration
  const daysUntilExpiration = differenceInDays(parseISO(event.expires_at), new Date());
  const showUrgentWarning = daysUntilExpiration <= 7;
  const isExpired = daysUntilExpiration < 0;

  // Filter and sort photos
  const filteredPhotos = useMemo(() => {
    if (!data?.photos) return [];
    
    let photos = [...data.photos];
    
    // Apply category filter
    if (selectedCategoryId) {
      photos = photos.filter(photo => photo.category_id === selectedCategoryId);
    }
    
    // Apply search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      photos = photos.filter(photo => 
        photo.filename.toLowerCase().includes(term)
      );
    }
    
    // Apply feedback filter
    switch (filterType) {
      case 'liked':
        photos = photos.filter(photo => (photo.like_count || 0) > 0);
        break;
      case 'rated':
        photos = photos.filter(photo => (photo.average_rating || 0) > 0 || (photo.total_ratings || 0) > 0);
        break;
      case 'commented':
        photos = photos.filter(photo => (photo.comment_count || 0) > 0);
        break;
      default:
        break;
    }
    
    // Apply sorting
    photos.sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.filename.localeCompare(b.filename);
        case 'size':
          return b.size - a.size;
        case 'rating':
          // Sort by rating (highest first), then by comment count
          const ratingA = a.average_rating || 0;
          const ratingB = b.average_rating || 0;
          if (ratingA !== ratingB) {
            return ratingB - ratingA;
          }
          // If ratings are equal, sort by comment count
          return (b.comment_count || 0) - (a.comment_count || 0);
        case 'date':
        default:
          return new Date(b.uploaded_at).getTime() - new Date(a.uploaded_at).getTime();
      }
    });
    
    // Transform URLs for watermarks if enabled
    if (watermarkEnabled) {
      photos = photos.map(photo => ({
        ...photo,
        url: `/gallery/${slug}/photo/${photo.id}`,
        thumbnail_url: `/gallery/${slug}/photo/${photo.id}` // Use watermarked version for thumbnails too
      }));
    }
    
    return photos;
  }, [data?.photos, selectedCategoryId, searchTerm, sortBy, watermarkEnabled, slug, filterType]);

  // Check if downloads are allowed (both event setting and not expired)
  const allowDownloads = !isExpired && (data?.event?.allow_downloads === true);

  const handleDownloadAll = () => {
    // Prevent downloads if gallery is expired or downloads disabled
    if (!allowDownloads) {
      return;
    }
    
    downloadAllMutation.mutate(slug);
    
    // Track download all action
    analyticsService.trackGalleryEvent('bulk_download', {
      gallery: slug,
      photo_count: data?.photos.length || 0,
      is_download_all: true
    });
  };

  const handleDownloadSelected = async () => {
    if (selectedPhotos.size === 0) return;
    
    // Prevent downloads if gallery is expired or downloads disabled
    if (!allowDownloads) {
      return;
    }
    
    const selectedPhotosList = filteredPhotos.filter(p => selectedPhotos.has(p.id));
    
    // Track bulk download
    analyticsService.trackGalleryEvent('bulk_download', {
      gallery: slug,
      photo_count: selectedPhotos.size
    });
    
    // Download each selected photo
    for (const photo of selectedPhotosList) {
      await galleryService.downloadPhoto(slug, photo.id, photo.filename);
    }
    
    // Clear selection after download
    setSelectedPhotos(new Set());
    setIsSelectionMode(false);
  };

  // Calculate photo counts per category
  const photoCounts = useMemo(() => {
    if (!data?.photos) return {};
    const counts: Record<number, number> = {};
    data.photos.forEach(photo => {
      if (photo.category_id) {
        counts[photo.category_id] = (counts[photo.category_id] || 0) + 1;
      }
    });
    return counts;
  }, [data?.photos]);

  // Track search usage with debouncing
  useEffect(() => {
    if (searchTerm.length > 0) {
      const timer = setTimeout(() => {
        analyticsService.trackSearch(searchTerm, filteredPhotos.length, 'gallery');
      }, 1000); // Debounce for 1 second

      return () => clearTimeout(timer);
    }
  }, [searchTerm, filteredPhotos.length]);

  // Track expiration warning views
  useEffect(() => {
    if (showUrgentWarning && daysUntilExpiration > 0) {
      analyticsService.trackExpirationWarning(slug, daysUntilExpiration);
    }
  }, [showUrgentWarning, daysUntilExpiration, slug]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-neutral-50">
        {/* Header Skeleton */}
        <header className="bg-white border-b border-neutral-200 sticky top-0 z-40">
          <div className="container py-4">
            <div className="flex items-center justify-between">
              <div>
                <Skeleton height={32} width={200} className="mb-2" />
                <Skeleton height={20} width={300} />
              </div>
              <div className="flex items-center gap-2">
                <Skeleton height={40} width={120} />
                <Skeleton height={40} width={100} />
              </div>
            </div>
          </div>
        </header>
        
        {/* Content Skeleton */}
        <div className="container mt-6">
          <Skeleton height={80} className="mb-6" />
          <SkeletonGalleryGrid count={12} />
        </div>
      </div>
    );
  }

  if (error || !data) {
    // Check if it's an authentication error (401)
    const is401Error = (error as any)?.response?.status === 401;
    
    if (is401Error) {
      // Authentication failed - logout and let the parent component handle re-authentication
      logout();
      return null;
    }
    
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-lg text-neutral-600">{t('gallery.failedToLoad')}</p>
          <Button onClick={() => refetch()} className="mt-4">
            {t('gallery.tryAgain')}
          </Button>
        </div>
      </div>
    );
  }

  const showSidebar = theme.galleryLayout !== 'grid';

  return (
    <>
      {/* Sidebar for non-grid layouts */}
      {showSidebar ? (
        <GallerySidebar
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(!sidebarOpen)}
          categories={(data?.categories || []).filter(cat => photoCounts[cat.id] > 0)}
          selectedCategoryId={selectedCategoryId}
          onCategoryChange={setSelectedCategoryId}
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          sortBy={sortBy}
          onSortChange={setSortBy}
          isSelectionMode={isSelectionMode}
          onToggleSelectionMode={() => setIsSelectionMode(!isSelectionMode)}
          selectedCount={selectedPhotos.size}
          onDownloadAll={handleDownloadAll}
          onDownloadSelected={handleDownloadSelected}
          isDownloading={downloadAllMutation.isPending}
          isExpired={isExpired}
          allowDownloads={allowDownloads}
          photoCounts={photoCounts}
          totalPhotos={data?.photos.length || 0}
          isMobile={isMobile}
          galleryLayout={theme.galleryLayout}
          allowUploads={data?.event?.allow_user_uploads || event?.allow_user_uploads || false}
          onUploadClick={() => setShowUploadModal(true)}
          feedbackEnabled={feedbackEnabled}
          filterType={filterType}
          onFilterChange={setFilterType}
          likeCount={data?.photos?.filter(p => p.like_count > 0).length || 0}
          ratedCount={data?.photos?.filter(p => (p.total_ratings || 0) > 0).length || 0}
        />
      ) : null}

      <GalleryLayout
        event={event}
        brandingSettings={brandingSettings}
        showLogout={true}
        onLogout={logout}
        showDownloadAll={!showSidebar && allowDownloads}
        onDownloadAll={handleDownloadAll}
        isDownloading={downloadAllMutation.isPending}
        isExpired={isExpired}
        menuButton={showSidebar ? (
          <Button
            variant="ghost"
            size="sm"
            leftIcon={<Menu className="w-4 h-4" />}
            onClick={() => setSidebarOpen(!sidebarOpen)}
            aria-label={t('gallery.toggleMenu')}
          >
            <span className="hidden sm:inline">{t('common.menu')}</span>
          </Button>
        ) : undefined}
        headerExtra={(() => {
          const items = [];
          
          if (daysUntilExpiration <= 1 && daysUntilExpiration > 0) {
            items.push(
              <CountdownTimer key="countdown" expiresAt={event.expires_at} className="mr-2" />
            );
          }
          
          // Upload button only on desktop when sidebar is shown
          const allowUploads = data?.event?.allow_user_uploads || event?.allow_user_uploads;
          if (allowUploads && showSidebar && !isMobile) {
            items.push(
              <Button
                key="upload-button"
                variant="outline"
                size="sm"
                leftIcon={<Upload className="w-4 h-4" />}
                onClick={() => setShowUploadModal(true)}
              >
                {t('upload.uploadPhotos')}
              </Button>
            );
          }
          
          // Upload button for non-sidebar layouts
          if (allowUploads && !showSidebar) {
            items.push(
              <Button
                key="upload-button"
                variant="outline"
                size="sm"
                leftIcon={<Upload className="w-4 h-4" />}
                onClick={() => setShowUploadModal(true)}
                className="flex-1 sm:flex-initial"
              >
                <span className="hidden sm:inline">{t('upload.uploadPhotos')}</span>
                <span className="sm:hidden">{t('common.upload')}</span>
              </Button>
            );
          }
          
          return items.length > 0 ? <>{items}</> : null;
        })()}
      >
        {/* Expiration Banner */}
        {showUrgentWarning && (
          <ExpirationBanner daysRemaining={daysUntilExpiration} expiresAt={event.expires_at} />
        )}

        {/* Search and Filters - Only for grid layout */}
        {!showSidebar ? (
          <div className="mt-6">
            <PhotoFilterBar
              categories={data.categories}
              photos={data.photos}
              selectedCategoryId={selectedCategoryId}
              onCategoryChange={setSelectedCategoryId}
              searchTerm={searchTerm}
              onSearchChange={setSearchTerm}
              sortBy={sortBy}
              onSortChange={setSortBy}
              photoCount={filteredPhotos.length}
              // Feedback filter props
              feedbackEnabled={feedbackEnabled}
              currentFilter={filterType}
              onFilterChange={setFilterType}
            />
          </div>
        ) : null}

        {/* Photo Grid */}
        <div className={showSidebar ? "mt-6" : "mt-6"}>
          <PhotoGridWithLayouts 
            photos={filteredPhotos} 
            slug={slug} 
            categoryId={selectedCategoryId}
            onFeedbackChange={() => refetch()}
            heroPhotoOverride={staticHeroPhoto}
            feedbackEnabled={feedbackEnabled}
            feedbackOptions={{
              allowLikes: !!feedbackSettings?.allow_likes,
              allowFavorites: !!feedbackSettings?.allow_favorites,
              allowRatings: !!feedbackSettings?.allow_ratings,
              allowComments: !!feedbackSettings?.allow_comments,
              requireNameEmail: !!feedbackSettings?.require_name_email,
            }}
            isSelectionMode={isSelectionMode}
            selectedPhotos={selectedPhotos}
            onSelectionChange={setSelectedPhotos}
            onToggleSelectionMode={() => setIsSelectionMode(!isSelectionMode)}
            showSelectionControls={!showSidebar}
            eventName={event.event_name}
            eventLogo={brandingSettings?.logo_url}
            eventDate={event.event_date}
            expiresAt={event.expires_at}
            allowDownloads={allowDownloads}
            protectionLevel={protectionLevel}
            useEnhancedProtection={protectionLevel !== 'basic'}
          />
        </div>

        {/* Upload Modal */}
        {showUploadModal && (data?.event?.allow_user_uploads || event?.allow_user_uploads) && (
          <UserPhotoUpload
            eventId={data?.event?.id || event?.id}
            categoryId={data?.event?.upload_category_id || event?.upload_category_id}
            onUploadComplete={() => {
              setShowUploadModal(false);
              // Refetch photos after upload
              window.location.reload(); // Simple reload for now
            }}
            onClose={() => setShowUploadModal(false)}
          />
        )}
      </GalleryLayout>
    </>
  );
};
