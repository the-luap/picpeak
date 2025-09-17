import React from 'react';
import { Download, Maximize2, Check, Heart, MessageSquare } from 'lucide-react';
// import { useTheme } from '../../../contexts/ThemeContext';
import { AuthenticatedImage } from '../../common';
import { FeedbackIdentityModal } from '../../gallery/FeedbackIdentityModal';
import { feedbackService } from '../../../services/feedback.service';
import type { BaseGalleryLayoutProps } from './BaseGalleryLayout';
import type { Photo } from '../../../types';

interface MosaicPhotoProps {
  photo: Photo;
  isSelected: boolean;
  isSelectionMode: boolean;
  onClick: (e: React.MouseEvent) => void;
  onDownload: (e: React.MouseEvent) => void;
  onToggleSelect: () => void;
  className?: string;
  allowDownloads?: boolean;
  slug?: string;
  feedbackEnabled?: boolean;
  feedbackOptions?: {
    allowLikes?: boolean;
    allowComments?: boolean;
    requireNameEmail?: boolean;
  };
  onQuickComment?: () => void;
}

const MosaicPhoto: React.FC<MosaicPhotoProps> = ({
  photo,
  isSelected,
  isSelectionMode,
  onClick,
  onDownload,
  onToggleSelect,
  className = '',
  allowDownloads = true,
  slug,
  feedbackEnabled = false,
  feedbackOptions,
  onQuickComment
}) => {
  const [showIdentityModal, setShowIdentityModal] = React.useState(false);
  const [pendingAction, setPendingAction] = React.useState<null | { type: 'like'; photoId: number }>(null);
  const [savedIdentity, setSavedIdentity] = React.useState<{ name: string; email: string } | null>(null);
  const [likedLocal, setLikedLocal] = React.useState(false);
  const canComment = Boolean(feedbackEnabled && feedbackOptions?.allowComments && onQuickComment);

  return (
    <>
    <div
      className={`relative group cursor-pointer overflow-hidden rounded-lg bg-neutral-100 ${className}`}
      onClick={(e) => {
        e.stopPropagation();
        onClick(e);
      }}
    >
      <div className="absolute inset-0">
        <AuthenticatedImage
          src={photo.thumbnail_url || photo.url}
          alt={photo.filename}
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
          loading="lazy"
          isGallery={true}
          protectFromDownload={!allowDownloads}
        />
      </div>
      
      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center gap-2">
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
            {feedbackOptions?.allowLikes && (
              <button
                className={`p-2 rounded-full transition-colors ${likedLocal ? 'bg-red-500/90 hover:bg-red-500' : 'bg-white/90 hover:bg-white'}`}
                onClick={async (e) => {
                  e.stopPropagation();
                  if (feedbackOptions?.requireNameEmail && !savedIdentity) {
                    setPendingAction({ type: 'like', photoId: photo.id });
                    setShowIdentityModal(true);
                    return;
                  }
                  setLikedLocal(true);
                  try {
                    await feedbackService.submitFeedback(slug!, String(photo.id), {
                      feedback_type: 'like',
                      guest_name: savedIdentity?.name,
                      guest_email: savedIdentity?.email,
                    });
                  } catch (_) {}
                }}
                aria-label="Like photo"
                aria-pressed={likedLocal}
                title="Like"
              >
                <Heart className={`w-5 h-5 ${likedLocal ? 'text-white fill-white' : 'text-neutral-800'}`} />
              </button>
            )}
            {canComment && (
              <button
                className="p-2 bg-white/90 rounded-full hover:bg-white transition-colors"
                onClick={(e) => { e.stopPropagation(); onQuickComment?.(); }}
                aria-label="Comment on photo"
                title="Comment"
              >
                <MessageSquare className="w-5 h-5 text-neutral-800" />
              </button>
            )}
          </>
        )}
      </div>

      {/* Feedback Indicators (bottom-left) */}
      {(photo.like_count > 0 || likedLocal) && (
        <div className={`absolute ${photo.type === 'collage' ? 'bottom-8' : 'bottom-2'} left-2 z-10`}>
          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-white/90 backdrop-blur-sm" title="Liked">
            <Heart className="w-3.5 h-3.5 text-red-500" fill="currentColor" />
          </span>
        </div>
      )}

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

      {photo.type === 'collage' && (
        <div className="absolute bottom-2 left-2">
          <span className="px-2 py-1 bg-black/60 text-white text-xs rounded">
            Collage
          </span>
        </div>
      )}
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

export const MosaicGalleryLayout: React.FC<BaseGalleryLayoutProps> = ({
  photos,
  slug,
  onPhotoClick,
  onOpenPhotoWithFeedback,
  onDownload,
  selectedPhotos = new Set(),
  isSelectionMode = false,
  onPhotoSelect,
  allowDownloads = true,
  feedbackEnabled = false,
  feedbackOptions
}) => {
  // const { theme } = useTheme();
  // const gallerySettings = theme.gallerySettings || {};
  // const pattern = gallerySettings.mosaicPattern || 'structured';

  const handlePhotoClick = (index: number, photoId: number) => {
    if (isSelectionMode && onPhotoSelect) {
      onPhotoSelect(photoId);
    } else {
      onPhotoClick(index);
    }
  };

  // Create a more structured mosaic layout
  const renderMosaicLayout = () => {
    const elements = [];
    let photoIndex = 0;
    let patternIndex = 0;
    
    while (photoIndex < photos.length) {
      const remainingPhotos = photos.length - photoIndex;
      
      // Choose pattern based on rotation and remaining photos
      if (patternIndex % 3 === 0 && remainingPhotos >= 3) {
        // Pattern 1: Large left, 2 small right
        // Capture indices immediately to avoid closure issues
        const idx0 = photoIndex;
        const idx1 = photoIndex + 1;
        const idx2 = photoIndex + 2;
        const photo0 = photos[idx0];
        const photo1 = photos[idx1];
        const photo2 = photos[idx2];
        
        elements.push(
          <div key={`pattern-${photoIndex}`} className="grid grid-cols-2 gap-2 mb-2 h-[400px]">
            {photo0 && (
              <MosaicPhoto
                photo={photo0}
                isSelected={selectedPhotos.has(photo0.id)}
                isSelectionMode={isSelectionMode}
                onClick={() => onPhotoClick(idx0)}
                onDownload={(e) => onDownload(photo0, e)}
                onToggleSelect={() => onPhotoSelect && onPhotoSelect(photo0.id)}
                className="col-span-1"
                allowDownloads={allowDownloads}
                slug={slug}
                feedbackEnabled={feedbackEnabled}
                feedbackOptions={feedbackOptions}
                onQuickComment={() => { if (typeof onOpenPhotoWithFeedback !== 'undefined' && onOpenPhotoWithFeedback) onOpenPhotoWithFeedback(idx0); }}
              />
            )}
            <div className="grid grid-rows-2 gap-2">
              {photo1 && (
                <MosaicPhoto
                  photo={photo1}
                  isSelected={selectedPhotos.has(photo1.id)}
                  isSelectionMode={isSelectionMode}
                  onClick={() => onPhotoClick(idx1)}
                  onDownload={(e) => onDownload(photo1, e)}
                  onToggleSelect={() => onPhotoSelect && onPhotoSelect(photo1.id)}
                  className=""
                  allowDownloads={allowDownloads}
                  slug={slug}
                  feedbackEnabled={feedbackEnabled}
                  feedbackOptions={feedbackOptions}
                  onQuickComment={() => { if (typeof onOpenPhotoWithFeedback !== 'undefined' && onOpenPhotoWithFeedback) onOpenPhotoWithFeedback(idx1); }}
              />
              )}
              {photo2 && (
                <MosaicPhoto
                  photo={photo2}
                  isSelected={selectedPhotos.has(photo2.id)}
                  isSelectionMode={isSelectionMode}
                  onClick={() => onPhotoClick(idx2)}
                  onDownload={(e) => onDownload(photo2, e)}
                  onToggleSelect={() => onPhotoSelect && onPhotoSelect(photo2.id)}
                  className=""
                  allowDownloads={allowDownloads}
                  slug={slug}
                  feedbackEnabled={feedbackEnabled}
                  feedbackOptions={feedbackOptions}
                  onQuickComment={() => { if (typeof onOpenPhotoWithFeedback !== 'undefined' && onOpenPhotoWithFeedback) onOpenPhotoWithFeedback(idx2); }}
              />
              )}
            </div>
          </div>
        );
        photoIndex += 3;
      } else if (patternIndex % 3 === 1 && remainingPhotos >= 3) {
        // Pattern 2: 3 equal columns
        elements.push(
          <div key={`pattern-${photoIndex}`} className="grid grid-cols-3 gap-2 mb-2 h-[250px]">
            {[0, 1, 2].map(offset => {
              const currentIndex = photoIndex + offset;
              const photo = photos[currentIndex];
              return photo ? (
                <MosaicPhoto
                  key={photo.id}
                  photo={photo}
                  isSelected={selectedPhotos.has(photo.id)}
                  isSelectionMode={isSelectionMode}
                  onClick={() => handlePhotoClick(currentIndex, photo.id)}
                  onDownload={(e) => onDownload(photo, e)}
                  className=""
                  allowDownloads={allowDownloads}
                  slug={slug}
                  feedbackEnabled={feedbackEnabled}
                  feedbackOptions={feedbackOptions}
                  onQuickComment={() => { if (typeof onOpenPhotoWithFeedback !== 'undefined' && onOpenPhotoWithFeedback) onOpenPhotoWithFeedback(currentIndex); }}
                />
              ) : null;
            })}
          </div>
        );
        photoIndex += 3;
      } else if (patternIndex % 3 === 2 && remainingPhotos >= 3) {
        // Pattern 3: Large span-2 with 2 small on right
        // Capture indices immediately to avoid closure issues
        const idx0 = photoIndex;
        const idx1 = photoIndex + 1;
        const idx2 = photoIndex + 2;
        const photo0 = photos[idx0];
        const photo1 = photos[idx1];
        const photo2 = photos[idx2];
        
        elements.push(
          <div key={`pattern-${photoIndex}`} className="grid grid-cols-3 gap-2 mb-2 h-[400px]">
            {photo0 && (
              <MosaicPhoto
                photo={photo0}
                isSelected={selectedPhotos.has(photo0.id)}
                isSelectionMode={isSelectionMode}
                onClick={() => onPhotoClick(idx0)}
                onDownload={(e) => onDownload(photo0, e)}
                onToggleSelect={() => onPhotoSelect && onPhotoSelect(photo0.id)}
                className="col-span-2"
                allowDownloads={allowDownloads}
                slug={slug}
                feedbackEnabled={feedbackEnabled}
                feedbackOptions={feedbackOptions}
                onQuickComment={() => { if (typeof onOpenPhotoWithFeedback !== 'undefined' && onOpenPhotoWithFeedback) onOpenPhotoWithFeedback(idx0); }}
              />
            )}
            <div className="grid grid-rows-2 gap-2">
              {photo1 && (
                <MosaicPhoto
                  photo={photo1}
                  isSelected={selectedPhotos.has(photo1.id)}
                  isSelectionMode={isSelectionMode}
                  onClick={() => onPhotoClick(idx1)}
                  onDownload={(e) => onDownload(photo1, e)}
                  onToggleSelect={() => onPhotoSelect && onPhotoSelect(photo1.id)}
                  className=""
                  allowDownloads={allowDownloads}
                  slug={slug}
                  feedbackEnabled={feedbackEnabled}
                  feedbackOptions={feedbackOptions}
                  onQuickComment={() => { if (typeof onOpenPhotoWithFeedback !== 'undefined' && onOpenPhotoWithFeedback) onOpenPhotoWithFeedback(idx1); }}
              />
              )}
              {photo2 && (
                <MosaicPhoto
                  photo={photo2}
                  isSelected={selectedPhotos.has(photo2.id)}
                  isSelectionMode={isSelectionMode}
                  onClick={() => onPhotoClick(idx2)}
                  onDownload={(e) => onDownload(photo2, e)}
                  onToggleSelect={() => onPhotoSelect && onPhotoSelect(photo2.id)}
                  className=""
                  allowDownloads={allowDownloads}
                  slug={slug}
                  feedbackEnabled={feedbackEnabled}
                  feedbackOptions={feedbackOptions}
                  onQuickComment={() => { if (typeof onOpenPhotoWithFeedback !== 'undefined' && onOpenPhotoWithFeedback) onOpenPhotoWithFeedback(idx2); }}
              />
              )}
            </div>
          </div>
        );
        photoIndex += 3;
      } else {
        // Handle remaining photos that don't fit patterns
        break;
      }
      
      patternIndex++;
    }
    
    // Add remaining photos in a regular grid
    if (photoIndex < photos.length) {
      const remainingPhotos = photos.slice(photoIndex);
      elements.push(
        <div key={`remaining-${photoIndex}`} className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
          {remainingPhotos.map((photo, idx) => {
            const index = photoIndex + idx;
            return (
              <MosaicPhoto
                key={photo.id}
                photo={photo}
                isSelected={selectedPhotos.has(photo.id)}
                isSelectionMode={isSelectionMode}
                onClick={() => onPhotoClick(index)}
                onDownload={(e) => onDownload(photo, e)}
                onToggleSelect={() => onPhotoSelect && onPhotoSelect(photo.id)}
                className="aspect-square"
                allowDownloads={allowDownloads}
                slug={slug}
                feedbackEnabled={feedbackEnabled}
                feedbackOptions={feedbackOptions}
                onQuickComment={() => { if (typeof onOpenPhotoWithFeedback !== 'undefined' && onOpenPhotoWithFeedback) onOpenPhotoWithFeedback(index); }}
              />
            );
          })}
        </div>
      );
    }
    
    return elements;
  };
  
  return (
    <div className="w-full max-w-7xl mx-auto">
      {renderMosaicLayout()}
    </div>
  );
};
