import React, { useState, useEffect } from 'react';
import { Download, Maximize2, Check, ChevronDown, Calendar, Clock, Heart, MessageSquare } from 'lucide-react';
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
  // Use a static hero photo independent of current filter
  heroPhotoOverride?: Photo | null;
}

export const HeroGalleryLayout: React.FC<HeroGalleryLayoutProps> = ({
  photos,
  slug,
  onPhotoClick,
  onOpenPhotoWithFeedback,
  onDownload,
  selectedPhotos = new Set(),
  isSelectionMode = false,
  onPhotoSelect,
  eventName,
  eventLogo,
  eventDate,
  expiresAt,
  heroPhotoOverride,
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
  const [pendingAction, setPendingAction] = useState<null | { type: 'like'; photoId: number }>(null);
  const [savedIdentity, setSavedIdentity] = useState<{ name: string; email: string } | null>(null);
  const gallerySettings = theme.gallerySettings || {};
  const overlayOpacity = gallerySettings.heroOverlayOpacity || 0.3;
  const [likedIds, setLikedIds] = useState<Set<number>>(new Set());
  const canQuickComment = Boolean(feedbackEnabled && feedbackOptions?.allowComments && onOpenPhotoWithFeedback);

  // If an override is provided, always use it and skip initialization logic
  useEffect(() => {
    if (heroPhotoOverride) {
      setHeroPhoto(heroPhotoOverride);
      setHasInitialized(true);
    }
  }, [heroPhotoOverride]);

  // Reset initialization when heroImageId changes
  useEffect(() => {
    if (gallerySettings.heroImageId) {
      setHasInitialized(false);
    }
  }, [gallerySettings.heroImageId]);

  // Select hero photo (admin-selected or first photo only if gallery was empty)
  useEffect(() => {
    // When an override is provided, the effect above has already set the hero.
    if (heroPhotoOverride) return;

    if (photos.length > 0) {
      const heroId = gallerySettings.heroImageId;
      // If admin has selected a specific hero image, always use it when available
      if (heroId) {
        const adminSelectedHero = photos.find(p => p.id === heroId);
        if (adminSelectedHero) {
          setHeroPhoto(adminSelectedHero);
          setHasInitialized(true);
          return;
        }
      }

      // Only auto-select first photo on initial load
      if (!hasInitialized) {
        setHeroPhoto(photos[0]);
        setHasInitialized(true);
      }
    }
  }, [photos, gallerySettings.heroImageId, hasInitialized, heroPhotoOverride]);

  if (!heroPhoto) return null;

  // Show all photos including the hero photo in the grid
  const remainingPhotos = photos;

  return (
    <>
    <div className="relative -mt-6">
      {/* Hero Section */}
      <div className="relative h-[60vh] sm:h-[70vh] lg:h-[80vh] -mx-4 sm:-mx-6 lg:-mx-8 mb-8">
        <AuthenticatedImage
          src={heroPhoto.url}
          fallbackSrc={heroPhoto.thumbnail_url || undefined}
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
                    {feedbackOptions?.allowLikes && (
                      <button
                        className={`p-2 rounded-full transition-colors ${likedIds.has(photo.id) ? 'bg-red-500/90 hover:bg-red-500' : 'bg-white/90 hover:bg-white'}`}
                        onClick={async (e) => {
                          e.stopPropagation();
                          if (feedbackOptions?.requireNameEmail && !savedIdentity) {
                            setPendingAction({ type: 'like', photoId: photo.id });
                            setShowIdentityModal(true);
                            return;
                          }
                          setLikedIds(prev => new Set(prev).add(photo.id));
                          try {
                            await feedbackService.submitFeedback(slug!, String(photo.id), {
                              feedback_type: 'like',
                              guest_name: savedIdentity?.name,
                              guest_email: savedIdentity?.email,
                            });
                          } catch (_) {}
                        }}
                        aria-label="Like photo"
                        aria-pressed={likedIds.has(photo.id)}
                        title="Like"
                      >
                        <Heart className={`w-5 h-5 ${likedIds.has(photo.id) ? 'text-white fill-white' : 'text-neutral-800'}`} />
                      </button>
                    )}
                    {canQuickComment && (
                      <button
                        className="p-2 bg-white/90 rounded-full hover:bg-white transition-colors"
                        onClick={(e) => { e.stopPropagation(); onOpenPhotoWithFeedback?.(actualIndex); }}
                        aria-label="Comment on photo"
                        title="Comment"
                      >
                        <MessageSquare className="w-5 h-5 text-neutral-800" />
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

              {/* Feedback indicators (always visible, bottom-left). Show like immediately when liked */}
              {(photo.like_count > 0 || likedIds.has(photo.id) || (photo.average_rating || 0) > 0 || (photo.comment_count || 0) > 0) && (
                <div className={`absolute ${photo.type === 'collage' ? 'bottom-8' : 'bottom-2'} left-2 flex items-center gap-1 z-20`}>
                  {(photo.like_count > 0 || likedIds.has(photo.id)) && (
                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-white/90 backdrop-blur-sm" title="Liked">
                      <Heart className="w-3.5 h-3.5 text-red-500" fill="currentColor" />
                    </span>
                  )}
                  {(photo.average_rating || 0) > 0 && (
                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-white/90 backdrop-blur-sm" title="Rated">
                      <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 text-yellow-500 fill-current"><path d="M12 .587l3.668 7.431 8.2 1.193-5.934 5.787 1.402 8.168L12 18.897l-7.336 3.869 1.402-8.168L.132 9.211l8.2-1.193z"/></svg>
                    </span>
                  )}
                  {(photo.comment_count || 0) > 0 && (
                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-white/90 backdrop-blur-sm" title="Commented">
                      <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 text-blue-600 fill-current"><path d="M20 2H4a2 2 0 00-2 2v18l4-4h14a2 2 0 002-2V4a2 2 0 00-2-2z"/></svg>
                    </span>
                  )}
                </div>
              )}
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
        feedbackType="like"
    />
    </>
  );
};
