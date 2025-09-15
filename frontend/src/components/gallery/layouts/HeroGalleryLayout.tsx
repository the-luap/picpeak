import React, { useState, useEffect } from 'react';
import { Download, Maximize2, Check, ChevronDown, Calendar, Clock, Heart, Bookmark } from 'lucide-react';
import { parseISO } from 'date-fns';
import { useTranslation } from 'react-i18next';
import { useLocalizedDate } from '../../../hooks/useLocalizedDate';
import { useTheme } from '../../../contexts/ThemeContext';
import { AuthenticatedImage } from '../../common';
import type { BaseGalleryLayoutProps } from './BaseGalleryLayout';
import type { Photo } from '../../../types';
import { buildResourceUrl } from '../../../utils/url';
import { FeedbackIdentityModal } from '../../gallery/FeedbackIdentityModal';
import { feedbackService } from '../../../services/feedback.service';

interface HeroGalleryLayoutProps extends BaseGalleryLayoutProps {
  eventName?: string;
  eventLogo?: string | null;
  eventDate?: string;
  expiresAt?: string;
}

export const HeroGalleryLayout: React.FC<HeroGalleryLayoutProps> = ({
  photos,
  slug,
  onPhotoClick,
  onDownload,
  selectedPhotos = new Set(),
  isSelectionMode = false,
  onPhotoSelect,
  eventName,
  eventLogo,
  eventDate,
  expiresAt,
  allowDownloads = true,
  feedbackEnabled = false,
  feedbackOptions
}) => {
  const { t } = useTranslation();
  const { format } = useLocalizedDate();
  const { theme } = useTheme();
  const [heroPhoto, setHeroPhoto] = useState<Photo | null>(null);
  const [hasInitialized, setHasInitialized] = useState(false);
  const [showIdentityModal, setShowIdentityModal] = useState(false);
  const [pendingAction, setPendingAction] = useState<null | { type: 'like' | 'favorite'; photoId: number }>(null);
  const [savedIdentity, setSavedIdentity] = useState<{ name: string; email: string } | null>(null);
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
          protectFromDownload={!allowDownloads}
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
              onClick={() => onPhotoClick(actualIndex)}
            >
              <AuthenticatedImage
                src={photo.thumbnail_url || photo.url}
                alt={photo.filename}
                className="w-full h-full object-cover rounded-lg transition-transform duration-300 group-hover:scale-105"
                loading="lazy"
                isGallery={true}
                protectFromDownload={!allowDownloads}
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
                    {allowDownloads && (
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
                    )}
                    {feedbackEnabled && feedbackOptions?.allowLikes && (
                      <button
                        className="p-2 bg-white/90 rounded-full hover:bg-white transition-colors"
                        onClick={async (e) => {
                          e.stopPropagation();
                          if (feedbackOptions?.requireNameEmail && !savedIdentity) {
                            setPendingAction({ type: 'like', photoId: photo.id });
                            setShowIdentityModal(true);
                            return;
                          }
                          await feedbackService.submitFeedback(slug!, String(photo.id), {
                            feedback_type: 'like',
                            guest_name: savedIdentity?.name,
                            guest_email: savedIdentity?.email,
                          });
                        }}
                        aria-label="Like photo"
                        title="Like"
                      >
                        <Heart className="w-5 h-5 text-neutral-800" />
                      </button>
                    )}
                    {feedbackEnabled && feedbackOptions?.allowFavorites && (
                      <button
                        className="p-2 bg-white/90 rounded-full hover:bg-white transition-colors"
                        onClick={async (e) => {
                          e.stopPropagation();
                          if (feedbackOptions?.requireNameEmail && !savedIdentity) {
                            setPendingAction({ type: 'favorite', photoId: photo.id });
                            setShowIdentityModal(true);
                            return;
                          }
                          await feedbackService.submitFeedback(slug!, String(photo.id), {
                            feedback_type: 'favorite',
                            guest_name: savedIdentity?.name,
                            guest_email: savedIdentity?.email,
                          });
                        }}
                        aria-label="Favorite photo"
                        title="Favorite"
                      >
                        <Bookmark className="w-5 h-5 text-neutral-800" />
                      </button>
                    )}
                  </>
                )}
              </div>

              {/* Selection Checkbox (visible on hover or when selected) */}
              <button
                type="button"
                aria-label={`Select ${photo.filename}`}
                role="checkbox"
                aria-checked={selectedPhotos.has(photo.id)}
                data-testid={`gallery-photo-checkbox-${photo.id}`}
                className={`absolute top-2 right-2 z-20 transition-opacity ${
                  selectedPhotos.has(photo.id) ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                }`}
                onClick={(e) => { e.stopPropagation(); onPhotoSelect && onPhotoSelect(photo.id); }}
              >
                <div className={`w-6 h-6 rounded-full border-2 ${selectedPhotos.has(photo.id) ? 'bg-primary-600 border-primary-600' : 'bg-white/90 border-white'} flex items-center justify-center transition-colors`}>
                  {selectedPhotos.has(photo.id) && <Check className="w-4 h-4 text-white" />}
                </div>
              </button>
            </div>
          );
        })}
      </div>
    </div>
    <FeedbackIdentityModal
      isOpen={showIdentityModal}
      onClose={() => { setShowIdentityModal(false); setPendingAction(null); }}
      onSubmit={async (name, email) => {
        setSavedIdentity({ name, email });
        setShowIdentityModal(false);
        if (pendingAction) {
          await feedbackService.submitFeedback(slug!, String(pendingAction.photoId), {
            feedback_type: pendingAction.type,
            guest_name: name,
            guest_email: email,
          });
          setPendingAction(null);
        }
      }}
      feedbackType={pendingAction?.type === 'favorite' ? 'favorite' : 'like'}
    />
  );
};
