import React, { useEffect, useRef, useState } from 'react';
import { Download, Maximize2, Check, MessageSquare, Star, Heart } from 'lucide-react';
import { useTheme } from '../../../contexts/ThemeContext';
import { AuthenticatedImage } from '../../common';
import { FeedbackIdentityModal } from '../../gallery/FeedbackIdentityModal';
import { feedbackService } from '../../../services/feedback.service';
import type { BaseGalleryLayoutProps } from './BaseGalleryLayout';
import type { Photo } from '../../../types';

interface MasonryPhotoProps {
  photo: Photo;
  isSelected: boolean;
  isSelectionMode: boolean;
  onClick: (e: React.MouseEvent) => void;
  onDownload: (e: React.MouseEvent) => void;
  onToggleSelect: () => void;
  style?: React.CSSProperties;
  allowDownloads?: boolean;
  feedbackEnabled?: boolean;
  slug?: string;
  feedbackOptions?: {
    allowLikes?: boolean;
    allowComments?: boolean;
    requireNameEmail?: boolean;
  };
  onQuickComment?: () => void;
}

const MasonryPhoto: React.FC<MasonryPhotoProps> = ({
  photo,
  isSelected,
  isSelectionMode,
  onClick,
  onDownload,
  onToggleSelect,
  style,
  allowDownloads = true,
  feedbackEnabled = false,
  slug,
  feedbackOptions,
  onQuickComment
}) => {
  const [imageHeight, setImageHeight] = useState<number>(200);
  const [showIdentityModal, setShowIdentityModal] = useState(false);
  const [pendingAction, setPendingAction] = useState<null | { type: 'like'; photoId: number }>(null);
  const [savedIdentity, setSavedIdentity] = useState<{ name: string; email: string } | null>(null);

  // Generate random heights for masonry effect
  useEffect(() => {
    const heights = [200, 250, 300, 350, 400];
    const randomHeight = heights[Math.floor(Math.random() * heights.length)];
    setImageHeight(randomHeight);
  }, [photo.id]);

  return (
    <div
      className="relative group cursor-pointer transition-all duration-300 hover:scale-[1.02]"
      onClick={onClick}
      style={{
        ...style,
        height: `${imageHeight}px`,
        breakInside: 'avoid'
      }}
    >
      <AuthenticatedImage
        src={photo.thumbnail_url || photo.url}
        alt={photo.filename}
        className="w-full h-full object-cover rounded-lg"
        loading="lazy"
        isGallery={true}
        protectFromDownload={!allowDownloads}
      />
      
      {/* Feedback Indicators */}
      {feedbackEnabled && (photo.comment_count > 0 || photo.average_rating > 0 || photo.like_count > 0) && (
        <div className="absolute top-2 left-2 flex gap-1 z-10">
          {photo.comment_count > 0 && (
            <div className="bg-white/90 backdrop-blur-sm rounded-full px-2 py-1 flex items-center gap-1" title={`${photo.comment_count} comments`}>
              <MessageSquare className="w-3.5 h-3.5 text-primary-600" fill="currentColor" />
              <span className="text-xs font-medium text-neutral-700">{photo.comment_count}</span>
            </div>
          )}
          {photo.average_rating > 0 && (
            <div className="bg-white/90 backdrop-blur-sm rounded-full px-2 py-1 flex items-center gap-1" title={`Rating: ${Number(photo.average_rating).toFixed(1)}`}>
              <Star className="w-3.5 h-3.5 text-yellow-500" fill="currentColor" />
              <span className="text-xs font-medium text-neutral-700">{Number(photo.average_rating).toFixed(1)}</span>
            </div>
          )}
          {photo.like_count > 0 && (
            <div className="bg-white/90 backdrop-blur-sm rounded-full px-2 py-1 flex items-center gap-1" title={`${photo.like_count} likes`}>
              <Heart className="w-3.5 h-3.5 text-red-500" fill="currentColor" />
              <span className="text-xs font-medium text-neutral-700">{photo.like_count}</span>
            </div>
          )}
        </div>
      )}
      
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
            {onQuickComment && (
              <button
                className="p-2 bg-white/90 rounded-full hover:bg-white transition-colors"
                onClick={(e) => { e.stopPropagation(); onQuickComment(); }}
                aria-label="Comment on photo"
                title="Comment"
              >
                <MessageSquare className="w-5 h-5 text-neutral-800" />
              </button>
            )}
            {feedbackOptions?.allowLikes && (
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
          </>
        )}
      </div>

      {/* Identity Modal */}
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
  );
};

export const MasonryGalleryLayout: React.FC<BaseGalleryLayoutProps> = ({
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
  const { theme } = useTheme();
  const containerRef = useRef<HTMLDivElement>(null);
  const [columns, setColumns] = useState(3);
  const gallerySettings = theme.gallerySettings || {};
  const gutter = gallerySettings.masonryGutter || 16;

  // Calculate number of columns based on container width
  useEffect(() => {
    const updateColumns = () => {
      if (containerRef.current) {
        const width = containerRef.current.offsetWidth;
        if (width < 640) setColumns(2);
        else if (width < 1024) setColumns(3);
        else if (width < 1280) setColumns(4);
        else setColumns(5);
      }
    };

    updateColumns();
    window.addEventListener('resize', updateColumns);
    return () => window.removeEventListener('resize', updateColumns);
  }, []);

  // Distribute photos across columns
  const photoColumns: Photo[][] = Array.from({ length: columns }, () => []);
  photos.forEach((photo, index) => {
    photoColumns[index % columns].push(photo);
  });

  return (
    <div 
      ref={containerRef}
      className="flex gap-4"
      style={{ gap: `${gutter}px` }}
    >
      {photoColumns.map((column, columnIndex) => (
        <div 
          key={columnIndex} 
          className="flex-1 flex flex-col"
          style={{ gap: `${gutter}px` }}
        >
          {column.map((photo) => {
            const originalIndex = photos.findIndex(p => p.id === photo.id);
            return (
              <MasonryPhoto
                key={photo.id}
                photo={photo}
                isSelected={selectedPhotos.has(photo.id)}
                isSelectionMode={isSelectionMode}
                onClick={() => onPhotoClick(originalIndex)}
                onDownload={(e) => onDownload(photo, e)}
                onToggleSelect={() => onPhotoSelect && onPhotoSelect(photo.id)}
                allowDownloads={allowDownloads}
                feedbackEnabled={feedbackEnabled}
                slug={slug}
                feedbackOptions={feedbackOptions}
                onQuickComment={() => onOpenPhotoWithFeedback && onOpenPhotoWithFeedback(originalIndex)}
              />
            );
          })}
        </div>
      ))}
    </div>
  );
};
