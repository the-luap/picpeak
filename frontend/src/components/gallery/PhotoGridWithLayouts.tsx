import React, { useState, useEffect } from 'react';
import { Package } from 'lucide-react';
import { toast as toastify } from 'react-toastify';
import { useTranslation } from 'react-i18next';

import type { Photo } from '../../types';
import { useDownloadPhoto } from '../../hooks/useGallery';
import { PhotoLightbox } from './PhotoLightbox';
import { Button } from '../common';
import { galleryService } from '../../services/gallery.service';
import { analyticsService } from '../../services/analytics.service';
import { useTheme } from '../../contexts/ThemeContext';

// Import all layouts
import {
  GridGalleryLayout,
  MasonryGalleryLayout,
  CarouselGalleryLayout,
  TimelineGalleryLayout,
  HeroGalleryLayout,
  MosaicGalleryLayout,
} from './layouts';

interface PhotoGridWithLayoutsProps {
  photos: Photo[];
  slug: string;
  categoryId?: number | null;
  isSelectionMode?: boolean;
  selectedPhotos?: Set<number>;
  onSelectionChange?: (photos: Set<number>) => void;
  onToggleSelectionMode?: () => void;
  showSelectionControls?: boolean;
  eventName?: string;
  eventLogo?: string | null;
  eventDate?: string;
  expiresAt?: string;
  feedbackEnabled?: boolean;
  allowDownloads?: boolean;
  protectionLevel?: 'basic' | 'standard' | 'enhanced' | 'maximum';
  useEnhancedProtection?: boolean;
  feedbackOptions?: {
    allowLikes?: boolean;
    allowFavorites?: boolean;
    allowRatings?: boolean;
    allowComments?: boolean;
    requireNameEmail?: boolean;
  };
}

export const PhotoGridWithLayouts: React.FC<PhotoGridWithLayoutsProps> = ({ 
  photos, 
  slug, 
  categoryId,
  isSelectionMode: parentSelectionMode,
  selectedPhotos: parentSelectedPhotos,
  feedbackEnabled,
  feedbackOptions,
  allowDownloads = true,
  protectionLevel = 'standard',
  useEnhancedProtection = false,
  onSelectionChange,
  onToggleSelectionMode: parentToggleSelectionMode,
  showSelectionControls = true,
  eventName,
  eventLogo,
  eventDate,
  expiresAt
}) => {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState<number | null>(null);
  const [localSelectedPhotos, setLocalSelectedPhotos] = useState<Set<number>>(new Set());
  const [localSelectionMode, setLocalSelectionMode] = useState(false);
  const downloadPhotoMutation = useDownloadPhoto();
  
  // Use parent state if provided, otherwise use local state
  const selectedPhotos = parentSelectedPhotos ?? localSelectedPhotos;
  const isSelectionMode = parentSelectionMode ?? localSelectionMode;
  const setSelectedPhotos = onSelectionChange ?? setLocalSelectedPhotos;
  const toggleSelectionMode = parentToggleSelectionMode ?? (() => setLocalSelectionMode(!localSelectionMode));

  // Clear selection when category changes
  useEffect(() => {
    setSelectedPhotos(new Set());
  }, [categoryId]);

  const handlePhotoClick = (index: number) => {
    setSelectedPhotoIndex(index);
  };

  const handlePhotoSelect = (photoId: number) => {
    // Auto-enable selection mode when selecting via checkbox
    if (!isSelectionMode) {
      if (parentToggleSelectionMode) {
        parentToggleSelectionMode();
      } else {
        setLocalSelectionMode(true);
      }
    }
    const newSelected = new Set(selectedPhotos);
    if (newSelected.has(photoId)) {
      newSelected.delete(photoId);
    } else {
      newSelected.add(photoId);
    }
    setSelectedPhotos(newSelected);
  };

  const handleDownload = (photo: Photo, e: React.MouseEvent) => {
    e.stopPropagation();
    
    // Track individual photo download
    analyticsService.trackDownload(photo.id, slug, false);
    
    downloadPhotoMutation.mutate({
      slug,
      photoId: photo.id,
      filename: photo.filename,
    });
  };


  const selectAll = () => {
    setSelectedPhotos(new Set(photos.map(p => p.id)));
  };

  const deselectAll = () => {
    setSelectedPhotos(new Set());
  };

  const handleDownloadSelected = async () => {
    if (selectedPhotos.size === 0) return;
    
    const selectedPhotosList = photos.filter(p => selectedPhotos.has(p.id));
    
    toastify.info(t('gallery.downloading', { count: selectedPhotos.size }));
    
    // Download each selected photo
    const downloadPromises = selectedPhotosList.map(photo => 
      galleryService.downloadPhoto(slug, photo.id, photo.filename)
        .catch(err => {
          // Download failed - error handled by UI
          return null;
        })
    );
    
    try {
      await Promise.all(downloadPromises);
      toastify.success(t('gallery.downloadedPhotos', { count: selectedPhotos.size }));
      
      // Track bulk download
      analyticsService.trackGalleryEvent('bulk_download', {
        gallery: slug,
        photo_count: selectedPhotos.size
      });
      
      // Clear selection after download
      setSelectedPhotos(new Set());
      if (parentToggleSelectionMode) {
        parentToggleSelectionMode();
      } else {
        setLocalSelectionMode(false);
      }
    } catch (error) {
      toastify.error(t('gallery.downloadError'));
    }
  };

  if (photos.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-neutral-600">{t('gallery.noPhotosFound')}</p>
      </div>
    );
  }

  // Get the current layout from theme
  const galleryLayout = theme.galleryLayout || 'grid';
  
  // Select the appropriate layout component
  const layoutProps = {
    photos,
    slug,
    onPhotoClick: handlePhotoClick,
    onDownload: handleDownload,
    selectedPhotos,
    allowDownloads,
    protectionLevel,
    useEnhancedProtection,
    isSelectionMode,
    onPhotoSelect: handlePhotoSelect,
    eventName,
    eventLogo,
    eventDate,
    expiresAt,
    feedbackEnabled,
    feedbackOptions,
  };

  let LayoutComponent;
  switch (galleryLayout) {
    case 'masonry':
      LayoutComponent = MasonryGalleryLayout;
      break;
    case 'carousel':
      LayoutComponent = CarouselGalleryLayout;
      break;
    case 'timeline':
      LayoutComponent = TimelineGalleryLayout;
      break;
    case 'hero':
      LayoutComponent = HeroGalleryLayout;
      break;
    case 'mosaic':
      LayoutComponent = MosaicGalleryLayout;
      break;
    default:
      LayoutComponent = GridGalleryLayout;
  }

  return (
    <>
      {/* Selection Mode Controls - Not shown for carousel layout or when controls are hidden */}
      {showSelectionControls && photos.length > 1 && galleryLayout !== 'carousel' && (
        <div className="mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={toggleSelectionMode}
              title={t('gallery.selectPhotosHint')}
              className="text-xs sm:text-sm"
            >
              {isSelectionMode ? t('gallery.cancelSelection') : t('gallery.selectPhotos')}
            </Button>
            {!isSelectionMode && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  toggleSelectionMode();
                  selectAll();
                }}
                className="text-xs sm:text-sm"
              >
                {t('gallery.selectAll')}
              </Button>
            )}
          </div>
          
          {isSelectionMode && (
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3">
              <span className="text-xs sm:text-sm text-neutral-600">
                {t('gallery.photosSelected', { count: selectedPhotos.size })}
              </span>
              <div className="flex items-center gap-2 flex-wrap">
                <Button variant="ghost" size="sm" onClick={selectAll} className="text-xs sm:text-sm">
                  {t('gallery.selectAll')}
                </Button>
                <Button variant="ghost" size="sm" onClick={deselectAll} className="text-xs sm:text-sm">
                  {t('gallery.deselectAll')}
                </Button>
                {selectedPhotos.size > 0 && (
                  <Button
                    variant="primary"
                    size="sm"
                    leftIcon={<Package className="w-4 h-4" />}
                    onClick={handleDownloadSelected}
                    className="text-xs sm:text-sm"
                  >
                    <span className="hidden sm:inline">{t('gallery.downloadSelected', { count: selectedPhotos.size })}</span>
                    <span className="sm:hidden">{t('common.download')} ({selectedPhotos.size})</span>
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Render the selected layout */}
      <LayoutComponent {...layoutProps} />

      {/* Lightbox */}
      {selectedPhotoIndex !== null && (
        <PhotoLightbox
          photos={photos}
          initialIndex={selectedPhotoIndex}
          onClose={() => setSelectedPhotoIndex(null)}
          slug={slug}
          feedbackEnabled={feedbackEnabled || false}
          allowDownloads={allowDownloads}
          protectionLevel={protectionLevel}
          useEnhancedProtection={useEnhancedProtection}
        />
      )}
    </>
  );
};
