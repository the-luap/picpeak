import React from 'react';
import { Download, Maximize2, Check, MessageSquare, Star, Heart, Bookmark } from 'lucide-react';
import { useInView } from 'react-intersection-observer';
import { useTheme } from '../../../contexts/ThemeContext';
import { AuthenticatedImage } from '../../common';
import { FeedbackIdentityModal } from '../../gallery/FeedbackIdentityModal';
import { feedbackService } from '../../../services/feedback.service';
import type { BaseGalleryLayoutProps } from './BaseGalleryLayout';
import type { Photo } from '../../../types';

interface GridPhotoProps {
  photo: Photo;
  isSelected: boolean;
  isSelectionMode: boolean;
  onClick: (e: React.MouseEvent) => void;
  onDownload: (e: React.MouseEvent) => void;
  onToggleSelect: () => void;
  animationType?: string;
  allowDownloads?: boolean;
  slug?: string;
  protectionLevel?: 'basic' | 'standard' | 'enhanced' | 'maximum';
  useEnhancedProtection?: boolean;
  feedbackEnabled?: boolean;
  feedbackOptions?: {
    allowLikes?: boolean;
    allowFavorites?: boolean;
    allowRatings?: boolean;
    allowComments?: boolean;
    requireNameEmail?: boolean;
  };
  savedIdentity?: { name: string; email: string } | null;
  onRequireIdentity?: (action: 'like' | 'favorite', photoId: number) => void;
}

const GridPhoto: React.FC<GridPhotoProps> = ({
  photo,
  isSelected,
  isSelectionMode,
  onClick,
  onDownload,
  onToggleSelect,
  animationType = 'fade',
  allowDownloads = true,
  slug,
  protectionLevel = 'standard',
  useEnhancedProtection = false,
  feedbackEnabled = false,
  feedbackOptions
}) => {
  // handled by parent layout; kept here for type completeness but not used
  const { ref, inView } = useInView({
    triggerOnce: true,
    threshold: 0.1,
  });

  const animationClass = animationType === 'scale' 
    ? 'transition-transform duration-300 hover:scale-105' 
    : animationType === 'fade'
    ? 'transition-opacity duration-300'
    : '';

  return (
    <div
      ref={ref}
      className={`relative group cursor-pointer aspect-square ${animationClass}`}
      onClick={onClick}
      style={{
        opacity: !inView && animationType === 'fade' ? 0 : 1
      }}
    >
      {inView ? (
        <>
          <AuthenticatedImage
            src={photo.thumbnail_url || photo.url}
            alt={photo.filename}
            className="w-full h-full object-cover rounded-lg"
            loading="lazy"
            isGallery={true}
            slug={slug}
            photoId={photo.id}
            requiresToken={photo.requires_token}
            secureUrlTemplate={photo.secure_url_template}
            protectFromDownload={!allowDownloads || useEnhancedProtection}
            protectionLevel={protectionLevel}
            useEnhancedProtection={useEnhancedProtection}
            useCanvasRendering={protectionLevel === 'maximum'}
            fragmentGrid={protectionLevel === 'enhanced' || protectionLevel === 'maximum'}
            blockKeyboardShortcuts={useEnhancedProtection}
            detectPrintScreen={useEnhancedProtection}
            detectDevTools={protectionLevel === 'maximum'}
            watermarkText={useEnhancedProtection ? 'Protected' : undefined}
            onProtectionViolation={(violationType) => {
              console.warn(`Protection violation on grid photo ${photo.id}: ${violationType}`);
            }}
          />
          
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-200 rounded-lg flex items-center justify-center gap-2">
            {!isSelectionMode && (
              <>
                <button
                  className="p-2 bg-white/90 rounded-full hover:bg-white transition-colors"
                  onClick={(e) => {
                    e.stopPropagation();
                    onClick(e);
                  }}
                  aria-label="View full size"
                >
                  <Maximize2 className="w-5 h-5 text-neutral-800" />
                </button>
                {allowDownloads && (
                  <button
                    className="p-2 bg-white/90 rounded-full hover:bg-white transition-colors"
                    onClick={onDownload}
                    aria-label="Download photo"
                  >
                    <Download className="w-5 h-5 text-neutral-800" />
                  </button>
                )}
                {/* Quick feedback actions */}
                {feedbackOptions?.allowLikes && (
                  <button
                    className="p-2 bg-white/90 rounded-full hover:bg-white transition-colors"
                    onClick={async (e) => {
                      e.stopPropagation();
                      if (feedbackOptions?.requireNameEmail && !savedIdentity && onRequireIdentity) {
                        onRequireIdentity('like', photo.id);
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
                {feedbackOptions?.allowFavorites && (
                  <button
                    className="p-2 bg-white/90 rounded-full hover:bg-white transition-colors"
                    onClick={async (e) => {
                      e.stopPropagation();
                      if (feedbackOptions?.requireNameEmail && !savedIdentity && onRequireIdentity) {
                        onRequireIdentity('favorite', photo.id);
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
            aria-checked={isSelected}
            data-testid={`gallery-photo-checkbox-${photo.id}`}
            className={`absolute top-2 right-2 z-20 transition-opacity ${
              isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
            }`}
            onClick={(e) => { e.stopPropagation(); onToggleSelect(); }}
          >
            <div className={`w-6 h-6 rounded-full border-2 ${isSelected ? 'bg-primary-600 border-primary-600' : 'bg-white/90 border-white'} flex items-center justify-center transition-colors`}>
              {isSelected && <Check className="w-4 h-4 text-white" />}
            </div>
          </button>

          {/* Feedback Indicators (always visible, bottom-left) */}
          {feedbackEnabled && (photo.comment_count > 0 || photo.average_rating > 0 || photo.like_count > 0) && (
            <div className={`absolute ${photo.type === 'collage' ? 'bottom-8' : 'bottom-2'} left-2 flex items-center gap-1 z-10`}>
              {photo.like_count > 0 && (
                <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-white/90 backdrop-blur-sm" title="Liked">
                  <Heart className="w-3.5 h-3.5 text-red-500" fill="currentColor" />
                </span>
              )}
              {photo.average_rating > 0 && (
                <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-white/90 backdrop-blur-sm" title="Rated">
                  <Star className="w-3.5 h-3.5 text-yellow-500" fill="currentColor" />
                </span>
              )}
              {photo.comment_count > 0 && (
                <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-white/90 backdrop-blur-sm" title="Commented">
                  <MessageSquare className="w-3.5 h-3.5 text-primary-600" fill="currentColor" />
                </span>
              )}
            </div>
          )}

          {photo.type === 'collage' && (
            <div className="absolute bottom-2 right-2">
              <span className="px-2 py-1 bg-black/60 text-white text-xs rounded">
                Collage
              </span>
            </div>
          )}
        </>
      ) : (
        <div className="skeleton aspect-square w-full rounded-lg" />
      )}
    </div>
  );
};

export const GridGalleryLayout: React.FC<BaseGalleryLayoutProps> = ({
  photos,
  slug,
  onPhotoClick,
  onDownload,
  selectedPhotos = new Set(),
  isSelectionMode = false,
  onPhotoSelect,
  allowDownloads = true,
  protectionLevel = 'standard',
  useEnhancedProtection = false,
  feedbackEnabled = false,
  feedbackOptions
}) => {
  const { theme } = useTheme();
  const gallerySettings = theme.gallerySettings || {};
  const columns = gallerySettings.gridColumns || { mobile: 2, tablet: 3, desktop: 4 };
  const spacing = gallerySettings.spacing || 'normal';
  const animation = gallerySettings.photoAnimation || 'fade';

  const [showIdentityModal, setShowIdentityModal] = React.useState(false);
  const [pendingAction, setPendingAction] = React.useState<null | { type: 'like' | 'favorite'; photoId: number }>(null);
  const [savedIdentity, setSavedIdentity] = React.useState<{ name: string; email: string } | null>(null);

  const spacingClass = spacing === 'tight' ? 'gap-2' : spacing === 'relaxed' ? 'gap-6' : 'gap-4';
  
  const gridClass = `grid ${spacingClass} 
    grid-cols-${columns.mobile} 
    sm:grid-cols-${columns.tablet} 
    lg:grid-cols-${columns.desktop} 
    xl:grid-cols-${columns.desktop + 1}`;

  return (
    <div className={gridClass}>
      {photos.map((photo, index) => (
        <GridPhoto
          key={photo.id}
          photo={photo}
          isSelected={selectedPhotos.has(photo.id)}
          isSelectionMode={isSelectionMode}
          onClick={() => onPhotoClick(index)}
          onToggleSelect={() => onPhotoSelect && onPhotoSelect(photo.id)}
          onDownload={(e) => onDownload(photo, e)}
          animationType={animation}
          allowDownloads={allowDownloads}
          slug={slug}
          protectionLevel={protectionLevel}
          useEnhancedProtection={useEnhancedProtection}
          feedbackEnabled={feedbackEnabled}
          feedbackOptions={feedbackOptions}
          savedIdentity={savedIdentity}
          onRequireIdentity={(action, photoId) => {
            setPendingAction({ type: action, photoId });
            setShowIdentityModal(true);
          }}
        />
      ))}
      <FeedbackIdentityModal
        isOpen={showIdentityModal}
        onClose={() => { setShowIdentityModal(false); setPendingAction(null); }}
        onSubmit={async (name, email) => {
          setSavedIdentity({ name, email });
          setShowIdentityModal(false);
          if (pendingAction) {
            await feedbackService.submitFeedback(slug, String(pendingAction.photoId), {
              feedback_type: pendingAction.type,
              guest_name: name,
              guest_email: email,
            });
            setPendingAction(null);
          }
        }}
        feedbackType={pendingAction?.type === 'favorite' ? 'favorite' : 'like'}
      />
    </div>
  );
};
