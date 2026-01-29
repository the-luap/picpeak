import React, { useMemo } from 'react';
import { Download, Maximize2, Check, Heart, MessageSquare } from 'lucide-react';
import { AuthenticatedImage } from '../../common';
import { FeedbackIdentityModal } from '../../gallery/FeedbackIdentityModal';
import { feedbackService } from '../../../services/feedback.service';
import type { BaseGalleryLayoutProps } from './BaseGalleryLayout';
import type { Photo } from '../../../types';

/**
 * Mosaic Gallery Layout
 *
 * Uses CSS Grid with span rules based on photo aspect ratios to create
 * a visually appealing mosaic layout. Based on best practices from:
 * - https://www.30secondsofcode.org/css/s/image-mosaic/
 * - https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_grid_layout
 *
 * Portrait photos span 2 rows, wide landscape photos span 2 columns.
 */

// Determine grid span based on aspect ratio
type SpanType = 'normal' | 'tall' | 'wide';

const getSpanType = (photo: Photo): SpanType => {
  const width = photo.width || 1;
  const height = photo.height || 1;
  const ratio = width / height;

  // Very tall portrait (aspect ratio < 0.7) - span 2 rows
  if (ratio < 0.75) return 'tall';
  // Very wide landscape (aspect ratio > 1.6) - span 2 columns
  if (ratio > 1.6) return 'wide';
  // Normal aspect ratio
  return 'normal';
};

// Get CSS classes for grid item based on span type
const getGridItemClasses = (spanType: SpanType): string => {
  switch (spanType) {
    case 'tall':
      return 'row-span-2';
    case 'wide':
      return 'col-span-2';
    default:
      return '';
  }
};

interface MosaicPhotoProps {
  photo: Photo;
  spanType: SpanType;
  isSelected: boolean;
  isSelectionMode: boolean;
  onClick: (e: React.MouseEvent) => void;
  onDownload: (e: React.MouseEvent) => void;
  onToggleSelect: () => void;
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
  spanType,
  isSelected,
  isSelectionMode,
  onClick,
  onDownload,
  onToggleSelect,
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

  const gridItemClasses = getGridItemClasses(spanType);

  return (
    <>
      <div
        className={`photo-card relative group cursor-pointer overflow-hidden rounded-lg bg-neutral-100 min-h-[200px] ${gridItemClasses}`}
        onClick={(e) => {
          e.stopPropagation();
          onClick(e);
        }}
      >
        <AuthenticatedImage
          src={photo.thumbnail_url || photo.url}
          alt={photo.filename}
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          loading="lazy"
          isGallery={true}
          protectFromDownload={!allowDownloads}
        />

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
        {((photo.like_count ?? 0) > 0 || likedLocal) && (
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
  // Pre-compute photos with their span types
  const photosWithSpans = useMemo(() => {
    return photos.map((photo, index) => ({
      photo,
      originalIndex: index,
      spanType: getSpanType(photo)
    }));
  }, [photos]);

  return (
    <div
      className="photo-grid w-full"
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
        gridAutoRows: '200px',
        gap: '8px'
      }}
    >
      {photosWithSpans.map(({ photo, originalIndex, spanType }) => (
        <MosaicPhoto
          key={photo.id}
          photo={photo}
          spanType={spanType}
          isSelected={selectedPhotos.has(photo.id)}
          isSelectionMode={isSelectionMode}
          onClick={() => {
            if (isSelectionMode && onPhotoSelect) {
              onPhotoSelect(photo.id);
            } else {
              onPhotoClick(originalIndex);
            }
          }}
          onDownload={(e) => onDownload(photo, e)}
          onToggleSelect={() => onPhotoSelect && onPhotoSelect(photo.id)}
          allowDownloads={allowDownloads}
          slug={slug}
          feedbackEnabled={feedbackEnabled}
          feedbackOptions={feedbackOptions}
          onQuickComment={() => {
            if (typeof onOpenPhotoWithFeedback !== 'undefined' && onOpenPhotoWithFeedback) {
              onOpenPhotoWithFeedback(originalIndex);
            }
          }}
        />
      ))}
    </div>
  );
};
