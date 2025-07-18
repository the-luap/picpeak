import React, { useState, useEffect } from 'react';
import { Download, Maximize2, Check, ChevronDown, Calendar, Clock } from 'lucide-react';
import { parseISO } from 'date-fns';
import { useTranslation } from 'react-i18next';
import { useLocalizedDate } from '../../../hooks/useLocalizedDate';
import { useTheme } from '../../../contexts/ThemeContext';
import { AuthenticatedImage } from '../../common';
import type { BaseGalleryLayoutProps } from './BaseGalleryLayout';
import type { Photo } from '../../../types';
import { buildResourceUrl } from '../../../utils/url';

interface HeroGalleryLayoutProps extends BaseGalleryLayoutProps {
  eventName?: string;
  eventLogo?: string | null;
  eventDate?: string;
  expiresAt?: string;
}

export const HeroGalleryLayout: React.FC<HeroGalleryLayoutProps> = ({
  photos,
  onPhotoClick,
  onDownload,
  selectedPhotos = new Set(),
  isSelectionMode = false,
  onPhotoSelect,
  eventName,
  eventLogo,
  eventDate,
  expiresAt
}) => {
  const { t } = useTranslation();
  const { format } = useLocalizedDate();
  const { theme } = useTheme();
  const [heroPhoto, setHeroPhoto] = useState<Photo | null>(null);
  const [hasInitialized, setHasInitialized] = useState(false);
  const gallerySettings = theme.gallerySettings || {};
  const overlayOpacity = gallerySettings.heroOverlayOpacity || 0.3;

  // Reset initialization when heroImageId changes
  useEffect(() => {
    if (gallerySettings.heroImageId) {
      setHasInitialized(false);
    }
  }, [gallerySettings.heroImageId]);

  // Select hero photo (admin-selected or first photo only if gallery was empty)
  useEffect(() => {
    if (photos.length > 0) {
      const heroId = gallerySettings.heroImageId;
      // Process hero layout with provided photos
      
      // If admin has selected a specific hero image, always use it
      if (heroId) {
        const adminSelectedHero = photos.find(p => p.id === heroId);
        // Hero photo selected by admin
        if (adminSelectedHero) {
          setHeroPhoto(adminSelectedHero);
          setHasInitialized(true);
          return;
        }
      }
      
      // Only auto-select first photo on initial load when gallery was empty
      // This prevents changing the hero when new photos are uploaded
      if (!hasInitialized) {
        setHeroPhoto(photos[0]);
        setHasInitialized(true);
      }
    }
  }, [photos, gallerySettings.heroImageId, hasInitialized]);

  if (!heroPhoto) return null;

  // Show all photos including the hero photo in the grid
  const remainingPhotos = photos;

  return (
    <div className="relative -mt-6">
      {/* Hero Section */}
      <div className="relative h-[60vh] sm:h-[70vh] lg:h-[80vh] -mx-4 sm:-mx-6 lg:-mx-8 mb-8">
        <AuthenticatedImage
          src={heroPhoto.url}
          alt={heroPhoto.filename}
          className="w-full h-full object-cover"
          isGallery={true}
        />
        
        {/* Overlay */}
        <div 
          className="absolute inset-0 bg-black"
          style={{ opacity: overlayOpacity }}
        />
        
        {/* Hero Content */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center px-4">
            {/* Logo - Show custom logo or fallback to PicPeak logo */}
            <div className="mb-6">
              <img 
                src={eventLogo ? 
                  buildResourceUrl(eventLogo) : 
                  '/picpeak-logo-transparent.png'
                } 
                alt="Event logo" 
                className="h-20 sm:h-24 lg:h-32 mx-auto"
                style={{ 
                  filter: 'brightness(0) invert(1) drop-shadow(0 4px 6px rgba(0, 0, 0, 0.5))'
                }}
              />
            </div>
            
            {/* Event Title */}
            {eventName && (
              <h1 className="text-3xl sm:text-4xl lg:text-5xl xl:text-6xl font-bold text-white drop-shadow-lg mb-4">
                {eventName}
              </h1>
            )}
            
            {/* Event Dates */}
            {(eventDate || expiresAt) && (
              <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6 text-white/90">
                {eventDate && (
                  <span className="flex items-center text-lg sm:text-xl">
                    <Calendar className="w-5 h-5 sm:w-6 sm:h-6 mr-2" />
                    {format(parseISO(eventDate), 'PP')}
                  </span>
                )}
                {expiresAt && (
                  <span className="flex items-center text-lg sm:text-xl">
                    <Clock className="w-5 h-5 sm:w-6 sm:h-6 mr-2" />
                    {t('gallery.expires')} {format(parseISO(expiresAt), 'PP')}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
        
        {/* Scroll Indicator */}
        <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 animate-bounce">
          <ChevronDown className="w-8 h-8 text-white drop-shadow-lg" />
        </div>
      </div>

      {/* Grid Section */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {remainingPhotos.map((photo) => {
          const actualIndex = photos.findIndex(p => p.id === photo.id);
          return (
            <div
              key={photo.id}
              className="relative group cursor-pointer aspect-square"
              onClick={() => {
                if (isSelectionMode && onPhotoSelect) {
                  onPhotoSelect(photo.id);
                } else {
                  onPhotoClick(actualIndex);
                }
              }}
            >
              <AuthenticatedImage
                src={photo.thumbnail_url || photo.url}
                alt={photo.filename}
                className="w-full h-full object-cover rounded-lg transition-transform duration-300 group-hover:scale-105"
                loading="lazy"
                isGallery={true}
              />
              
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-200 rounded-lg flex items-center justify-center gap-2">
                {!isSelectionMode && (
                  <>
                    <button
                      className="p-2 bg-white/90 rounded-full hover:bg-white transition-colors"
                      onClick={(e) => {
                        e.stopPropagation();
                        onPhotoClick(actualIndex);
                      }}
                      aria-label="View full size"
                    >
                      <Maximize2 className="w-5 h-5 text-neutral-800" />
                    </button>
                    <button
                      className="p-2 bg-white/90 rounded-full hover:bg-white transition-colors"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDownload(photo, e);
                      }}
                      aria-label="Download photo"
                    >
                      <Download className="w-5 h-5 text-neutral-800" />
                    </button>
                  </>
                )}
              </div>

              {isSelectionMode && (
                <div className={`absolute top-2 right-2 ${selectedPhotos.has(photo.id) ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} transition-opacity`}>
                  <div className={`w-6 h-6 rounded-full border-2 ${selectedPhotos.has(photo.id) ? 'bg-primary-600 border-primary-600' : 'bg-white/80 border-white'} flex items-center justify-center transition-colors`}>
                    {selectedPhotos.has(photo.id) && <Check className="w-4 h-4 text-white" />}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};