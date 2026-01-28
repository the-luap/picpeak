import React, { useMemo } from 'react';
import { Download, Maximize2, Check, Heart, MessageSquare } from 'lucide-react';
// import { useTheme } from '../../../contexts/ThemeContext';
import { AuthenticatedImage } from '../../common';
import { FeedbackIdentityModal } from '../../gallery/FeedbackIdentityModal';
import { feedbackService } from '../../../services/feedback.service';
import type { BaseGalleryLayoutProps } from './BaseGalleryLayout';
import type { Photo } from '../../../types';

// Orientation types for aspect-ratio-aware layout
type Orientation = 'landscape' | 'portrait' | 'square';

interface PhotoWithIndex {
  photo: Photo;
  originalIndex: number;
  orientation: Orientation;
}

// Get photo orientation based on aspect ratio
const getOrientation = (photo: Photo): Orientation => {
  const width = photo.width || 1;
  const height = photo.height || 1;
  const ratio = width / height;

  if (ratio > 1.2) return 'landscape';
  if (ratio < 0.83) return 'portrait';
  return 'square';
};

// Pattern types that work well with different orientation combinations
type PatternType =
  | 'tall-left-2-right'      // Tall photo left, 2 stacked right (good for 1 portrait + 2 landscape)
  | 'tall-right-2-left'      // Tall photo right, 2 stacked left (good for 1 portrait + 2 landscape)
  | 'wide-top-2-bottom'      // Wide photo top, 2 below (good for 1 landscape + 2 portrait)
  | 'wide-bottom-2-top'      // Wide photo bottom, 2 above (good for 1 landscape + 2 portrait)
  | 'three-columns'          // 3 equal columns (good for similar orientations)
  | 'three-rows'             // 3 equal rows (good for landscapes)
  | 'two-portraits'          // 2 tall side by side (good for portraits)
  | 'hero-wide'              // Single wide landscape hero
  | 'hero-tall';             // Single tall portrait hero

// Analyze a group of photos and select the best pattern
const selectBestPattern = (photosWithIndex: PhotoWithIndex[]): { pattern: PatternType; arranged: PhotoWithIndex[] } => {
  const count = photosWithIndex.length;

  if (count === 1) {
    const orientation = photosWithIndex[0].orientation;
    return {
      pattern: orientation === 'portrait' ? 'hero-tall' : 'hero-wide',
      arranged: photosWithIndex
    };
  }

  if (count === 2) {
    const portraits = photosWithIndex.filter(p => p.orientation === 'portrait');
    const landscapes = photosWithIndex.filter(p => p.orientation === 'landscape');

    if (portraits.length === 2) {
      return { pattern: 'two-portraits', arranged: photosWithIndex };
    }
    // For 2 photos, treat as part of a larger pattern or use columns
    return { pattern: 'three-columns', arranged: photosWithIndex };
  }

  if (count >= 3) {
    const portraits = photosWithIndex.filter(p => p.orientation === 'portrait');
    const landscapes = photosWithIndex.filter(p => p.orientation === 'landscape');
    const squares = photosWithIndex.filter(p => p.orientation === 'square');

    // All or mostly portraits - use vertical-friendly layout
    if (portraits.length >= 2) {
      if (landscapes.length >= 1) {
        // 2 portraits + 1 landscape: landscape on top, portraits below
        const arranged = [...landscapes.slice(0, 1), ...portraits.slice(0, 2)];
        return { pattern: 'wide-top-2-bottom', arranged };
      }
      // All portraits - stack them or use 3 columns
      return { pattern: 'three-columns', arranged: photosWithIndex.slice(0, 3) };
    }

    // All or mostly landscapes - use horizontal-friendly layout
    if (landscapes.length >= 2) {
      if (portraits.length >= 1) {
        // 1 portrait + 2 landscapes: portrait on left, landscapes stacked right
        const arranged = [...portraits.slice(0, 1), ...landscapes.slice(0, 2)];
        return { pattern: 'tall-left-2-right', arranged };
      }
      // All landscapes - use rows
      return { pattern: 'three-rows', arranged: photosWithIndex.slice(0, 3) };
    }

    // Mixed or mostly squares - use standard patterns with smart placement
    if (portraits.length === 1 && landscapes.length === 1) {
      // 1 portrait + 1 landscape + 1 square
      const arranged = [...portraits, ...squares.slice(0, 1), ...landscapes];
      return { pattern: 'tall-left-2-right', arranged: arranged.slice(0, 3) };
    }

    // Default to 3 columns for mixed content
    return { pattern: 'three-columns', arranged: photosWithIndex.slice(0, 3) };
  }

  return { pattern: 'three-columns', arranged: photosWithIndex };
};

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
      className={`photo-card relative group cursor-pointer overflow-hidden rounded-lg bg-neutral-100 ${className}`}
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
  // const { theme } = useTheme();
  // const gallerySettings = theme.gallerySettings || {};
  // const pattern = gallerySettings.mosaicPattern || 'structured';

  // Pre-compute photos with their orientations
  const photosWithOrientations = useMemo(() => {
    return photos.map((photo, index) => ({
      photo,
      originalIndex: index,
      orientation: getOrientation(photo)
    }));
  }, [photos]);

  // Helper to render a MosaicPhoto with common props
  const renderMosaicPhoto = (photoWithIndex: PhotoWithIndex, className: string = '') => {
    const { photo, originalIndex } = photoWithIndex;
    return (
      <MosaicPhoto
        key={photo.id}
        photo={photo}
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
        className={className}
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
    );
  };

  // Render pattern based on type and arranged photos
  const renderPattern = (pattern: PatternType, arranged: PhotoWithIndex[], keyPrefix: string) => {
    switch (pattern) {
      case 'tall-left-2-right':
        // Portrait/tall photo on left, 2 landscape/square stacked on right
        return (
          <div key={keyPrefix} className="grid grid-cols-2 gap-2 mb-2 h-[400px]">
            {arranged[0] && renderMosaicPhoto(arranged[0], 'col-span-1')}
            <div className="grid grid-rows-2 gap-2">
              {arranged[1] && renderMosaicPhoto(arranged[1])}
              {arranged[2] && renderMosaicPhoto(arranged[2])}
            </div>
          </div>
        );

      case 'tall-right-2-left':
        // 2 landscape/square stacked on left, portrait/tall on right
        return (
          <div key={keyPrefix} className="grid grid-cols-2 gap-2 mb-2 h-[400px]">
            <div className="grid grid-rows-2 gap-2">
              {arranged[1] && renderMosaicPhoto(arranged[1])}
              {arranged[2] && renderMosaicPhoto(arranged[2])}
            </div>
            {arranged[0] && renderMosaicPhoto(arranged[0], 'col-span-1')}
          </div>
        );

      case 'wide-top-2-bottom':
        // Wide landscape on top, 2 photos below
        return (
          <div key={keyPrefix} className="grid grid-rows-2 gap-2 mb-2 h-[450px]">
            <div className="h-[250px]">
              {arranged[0] && renderMosaicPhoto(arranged[0])}
            </div>
            <div className="grid grid-cols-2 gap-2 h-[192px]">
              {arranged[1] && renderMosaicPhoto(arranged[1])}
              {arranged[2] && renderMosaicPhoto(arranged[2])}
            </div>
          </div>
        );

      case 'wide-bottom-2-top':
        // 2 photos on top, wide landscape below
        return (
          <div key={keyPrefix} className="grid grid-rows-2 gap-2 mb-2 h-[450px]">
            <div className="grid grid-cols-2 gap-2 h-[192px]">
              {arranged[1] && renderMosaicPhoto(arranged[1])}
              {arranged[2] && renderMosaicPhoto(arranged[2])}
            </div>
            <div className="h-[250px]">
              {arranged[0] && renderMosaicPhoto(arranged[0])}
            </div>
          </div>
        );

      case 'three-rows':
        // 3 horizontal rows - good for all landscapes
        return (
          <div key={keyPrefix} className="grid grid-rows-3 gap-2 mb-2 h-[500px]">
            {arranged.slice(0, 3).map((p) => renderMosaicPhoto(p))}
          </div>
        );

      case 'two-portraits':
        // 2 side-by-side tall photos
        return (
          <div key={keyPrefix} className="grid grid-cols-2 gap-2 mb-2 h-[500px]">
            {arranged.slice(0, 2).map((p) => renderMosaicPhoto(p))}
          </div>
        );

      case 'hero-wide':
        // Single wide hero image
        return (
          <div key={keyPrefix} className="mb-2 h-[350px]">
            {arranged[0] && renderMosaicPhoto(arranged[0])}
          </div>
        );

      case 'hero-tall':
        // Single tall hero image
        return (
          <div key={keyPrefix} className="mb-2 h-[500px] max-w-md mx-auto">
            {arranged[0] && renderMosaicPhoto(arranged[0])}
          </div>
        );

      case 'three-columns':
      default:
        // 3 equal columns - adaptive height based on content
        const hasPortrait = arranged.some(p => p.orientation === 'portrait');
        const height = hasPortrait ? 'h-[350px]' : 'h-[250px]';
        return (
          <div key={keyPrefix} className={`grid grid-cols-3 gap-2 mb-2 ${height}`}>
            {arranged.slice(0, 3).map((p) => renderMosaicPhoto(p))}
          </div>
        );
    }
  };

  // Create aspect-ratio-aware mosaic layout
  const renderMosaicLayout = () => {
    const elements: React.ReactNode[] = [];
    let index = 0;
    let patternCount = 0;

    while (index < photosWithOrientations.length) {
      const remaining = photosWithOrientations.length - index;

      // Determine group size based on remaining photos
      let groupSize = 3;
      if (remaining === 1) groupSize = 1;
      else if (remaining === 2) groupSize = 2;
      else if (remaining === 4) groupSize = 2; // Split 4 into 2+2 for balance
      else groupSize = 3;

      // Get the next group of photos
      const group = photosWithOrientations.slice(index, index + groupSize);

      // Select the best pattern for this group based on orientations
      const { pattern, arranged } = selectBestPattern(group);

      // Alternate some patterns for visual variety
      let finalPattern = pattern;
      if (pattern === 'tall-left-2-right' && patternCount % 2 === 1) {
        finalPattern = 'tall-right-2-left';
      } else if (pattern === 'wide-top-2-bottom' && patternCount % 2 === 1) {
        finalPattern = 'wide-bottom-2-top';
      }

      // Render the pattern
      elements.push(renderPattern(finalPattern, arranged, `pattern-${index}`));

      index += groupSize;
      patternCount++;
    }

    return elements;
  };
  
  return (
    <div className="photo-grid w-full max-w-7xl mx-auto">
      {renderMosaicLayout()}
    </div>
  );
};
