import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { Download, Maximize2, Check, MessageSquare, Star, Heart } from 'lucide-react';
import { useTheme } from '../../../contexts/ThemeContext';
import { AuthenticatedImage } from '../../common';
import { FeedbackIdentityModal } from '../../gallery/FeedbackIdentityModal';
import { feedbackService } from '../../../services/feedback.service';
import {
  calculateJustifiedLayout,
  createJustifiedPhotos,
  type JustifiedLayoutItem,
} from '../../../utils/justifiedLayoutCalculator';
// Flickr's justified-layout library
import justifiedLayout from 'justified-layout';
// React Photo Album for Google Photos-style layout
import { RowsPhotoAlbum, RenderPhotoContext } from 'react-photo-album';
import 'react-photo-album/rows.css';
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
      className="photo-card relative group cursor-pointer transition-all duration-300 hover:scale-[1.02]"
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
      {feedbackEnabled && ((photo.comment_count ?? 0) > 0 || (photo.average_rating ?? 0) > 0 || (photo.like_count ?? 0) > 0) && (
        <div className="absolute top-2 left-2 flex gap-1 z-10">
          {(photo.comment_count ?? 0) > 0 && (
            <div className="bg-white/90 backdrop-blur-sm rounded-full px-2 py-1 flex items-center gap-1" title={`${photo.comment_count ?? 0} comments`}>
              <MessageSquare className="w-3.5 h-3.5 text-primary-600" fill="currentColor" />
              <span className="text-xs font-medium text-neutral-700">{photo.comment_count ?? 0}</span>
            </div>
          )}
          {(photo.average_rating ?? 0) > 0 && (
            <div className="bg-white/90 backdrop-blur-sm rounded-full px-2 py-1 flex items-center gap-1" title={`Rating: ${Number(photo.average_rating ?? 0).toFixed(1)}`}>
              <Star className="w-3.5 h-3.5 text-yellow-500" fill="currentColor" />
              <span className="text-xs font-medium text-neutral-700">{Number(photo.average_rating ?? 0).toFixed(1)}</span>
            </div>
          )}
          {(photo.like_count ?? 0) > 0 && (
            <div className="bg-white/90 backdrop-blur-sm rounded-full px-2 py-1 flex items-center gap-1" title={`${photo.like_count ?? 0} likes`}>
              <Heart className="w-3.5 h-3.5 text-red-500" fill="currentColor" />
              <span className="text-xs font-medium text-neutral-700">{photo.like_count ?? 0}</span>
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
            {feedbackEnabled && feedbackOptions?.allowComments && onQuickComment && (
              <button
                className="p-2 bg-white/90 rounded-full hover:bg-white transition-colors"
                onClick={(e) => { e.stopPropagation(); onQuickComment(); }}
                aria-label="Comment on photo"
                title="Comment"
              >
                <MessageSquare className="w-5 h-5 text-neutral-800" />
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
  const [containerWidth, setContainerWidth] = useState(0);
  const gallerySettings = theme.gallerySettings || {};
  const gutter = gallerySettings.masonryGutter || 16;
  const mode = gallerySettings.masonryMode || 'columns';
  const targetRowHeight = gallerySettings.masonryRowHeight || 250;
  const lastRowBehavior = gallerySettings.masonryLastRowBehavior || 'left';

  // Calculate number of columns based on container width (for columns mode)
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const width = containerRef.current.offsetWidth;
        setContainerWidth(width);
        if (width < 640) setColumns(2);
        else if (width < 1024) setColumns(3);
        else if (width < 1280) setColumns(4);
        else setColumns(5);
      }
    };

    updateDimensions();

    // Use ResizeObserver for better performance
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect.width > 0) {
          setContainerWidth(entry.contentRect.width);
          const width = entry.contentRect.width;
          if (width < 640) setColumns(2);
          else if (width < 1024) setColumns(3);
          else if (width < 1280) setColumns(4);
          else setColumns(5);
        }
      }
    });

    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => resizeObserver.disconnect();
  }, []);

  // Calculate justified layout for rows mode
  const rowsLayout = useMemo(() => {
    if (mode !== 'rows' || containerWidth <= 0 || photos.length === 0) {
      return { items: [], containerHeight: 0, rowCount: 0 };
    }

    const justifiedPhotos = createJustifiedPhotos(
      photos.map((p) => ({
        id: p.id,
        width: p.width,
        height: p.height,
      }))
    );

    return calculateJustifiedLayout(justifiedPhotos, {
      containerWidth,
      targetRowHeight,
      spacing: gutter,
      lastRowBehavior,
    });
  }, [mode, photos, containerWidth, targetRowHeight, gutter, lastRowBehavior]);

  // Create a map for quick lookup of layout items by photo ID (rows mode)
  const layoutItemMap = useMemo(() => {
    const map = new Map<number, JustifiedLayoutItem>();
    for (const item of rowsLayout.items) {
      map.set(item.photoId, item);
    }
    return map;
  }, [rowsLayout.items]);

  // Calculate Flickr justified layout
  const flickrLayout = useMemo(() => {
    if (mode !== 'flickr' || containerWidth <= 0 || photos.length === 0) {
      return { containerHeight: 0, boxes: [] };
    }

    // Convert photos to aspect ratios array
    const aspectRatios = photos.map((p) => {
      if (p.width && p.height && p.width > 0 && p.height > 0) {
        return p.width / p.height;
      }
      return 1; // Default to square if no dimensions
    });

    const result = justifiedLayout(aspectRatios, {
      containerWidth,
      targetRowHeight,
      boxSpacing: gutter,
      containerPadding: 0,
      targetRowHeightTolerance: 0.25,
    });

    return result;
  }, [mode, photos, containerWidth, targetRowHeight, gutter]);

  // Prepare photos for react-photo-album (justified mode)
  const albumPhotos = useMemo(() => {
    if (mode !== 'justified' || photos.length === 0) {
      return [];
    }

    return photos.map((photo, index) => ({
      src: photo.thumbnail_url || photo.url,
      width: photo.width || 800,
      height: photo.height || 600,
      key: `photo-${photo.id}`,
      // Store original data for click handling
      originalIndex: index,
      photoData: photo,
    }));
  }, [mode, photos]);

  // Distribute photos across columns (for columns mode)
  const photoColumns: Photo[][] = Array.from({ length: columns }, () => []);
  if (mode === 'columns') {
    photos.forEach((photo, index) => {
      photoColumns[index % columns].push(photo);
    });
  }

  // ROWS MODE - Google Photos style justified layout
  if (mode === 'rows') {
    // Show loading state while measuring container width
    const isCalculating = containerWidth <= 0 || rowsLayout.items.length === 0;

    return (
      <div
        ref={containerRef}
        className="photo-grid relative"
        style={{
          height: isCalculating ? 'auto' : rowsLayout.containerHeight,
          minHeight: isCalculating ? 200 : undefined
        }}
      >
        {isCalculating ? (
          // Render a simple grid while calculating to get container width
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {photos.slice(0, 8).map((photo) => (
              <div key={photo.id} className="aspect-square bg-neutral-200 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : photos.map((photo, index) => {
          const layoutItem = layoutItemMap.get(photo.id);
          if (!layoutItem) return null;

          return (
            <div
              key={photo.id}
              className="photo-card absolute group cursor-pointer transition-all duration-300 hover:z-10"
              style={{
                left: layoutItem.x,
                top: layoutItem.y,
                width: layoutItem.width,
                height: layoutItem.height,
              }}
              onClick={() => onPhotoClick(index)}
            >
              <AuthenticatedImage
                src={photo.thumbnail_url || photo.url}
                alt={photo.filename}
                className="w-full h-full object-cover rounded-lg transition-transform duration-300 group-hover:scale-[1.02]"
                loading="lazy"
                isGallery={true}
                protectFromDownload={!allowDownloads}
              />

              {/* Feedback Indicators */}
              {feedbackEnabled && ((photo.comment_count ?? 0) > 0 || (photo.average_rating ?? 0) > 0 || (photo.like_count ?? 0) > 0) && (
                <div className="absolute top-2 left-2 flex gap-1 z-10">
                  {(photo.comment_count ?? 0) > 0 && (
                    <div className="bg-white/90 backdrop-blur-sm rounded-full px-2 py-1 flex items-center gap-1">
                      <MessageSquare className="w-3.5 h-3.5 text-primary-600" fill="currentColor" />
                      <span className="text-xs font-medium text-neutral-700">{photo.comment_count ?? 0}</span>
                    </div>
                  )}
                  {(photo.average_rating ?? 0) > 0 && (
                    <div className="bg-white/90 backdrop-blur-sm rounded-full px-2 py-1 flex items-center gap-1">
                      <Star className="w-3.5 h-3.5 text-yellow-500" fill="currentColor" />
                      <span className="text-xs font-medium text-neutral-700">{Number(photo.average_rating ?? 0).toFixed(1)}</span>
                    </div>
                  )}
                  {(photo.like_count ?? 0) > 0 && (
                    <div className="bg-white/90 backdrop-blur-sm rounded-full px-2 py-1 flex items-center gap-1">
                      <Heart className="w-3.5 h-3.5 text-red-500" fill="currentColor" />
                      <span className="text-xs font-medium text-neutral-700">{photo.like_count ?? 0}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Hover overlay with actions */}
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-200 rounded-lg flex items-center justify-center gap-2">
                {!isSelectionMode && (
                  <>
                    <button
                      type="button"
                      aria-label="View full size"
                      className="p-2 bg-white/20 hover:bg-white/40 rounded-full transition-colors"
                      onClick={(e) => { e.stopPropagation(); onPhotoClick(index); }}
                    >
                      <Maximize2 className="w-5 h-5 text-white" />
                    </button>
                    {allowDownloads && (
                      <button
                        type="button"
                        aria-label="Download photo"
                        className="p-2 bg-white/20 hover:bg-white/40 rounded-full transition-colors"
                        onClick={(e) => { e.stopPropagation(); onDownload(photo, e); }}
                      >
                        <Download className="w-5 h-5 text-white" />
                      </button>
                    )}
                  </>
                )}
              </div>

              {/* Selection Checkbox */}
              <button
                type="button"
                aria-label={`Select ${photo.filename}`}
                role="checkbox"
                aria-checked={selectedPhotos.has(photo.id)}
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
    );
  }

  // FLICKR MODE - Flickr's justified-layout algorithm
  if (mode === 'flickr') {
    const isCalculating = containerWidth <= 0 || flickrLayout.boxes.length === 0;

    return (
      <div
        ref={containerRef}
        className="photo-grid relative"
        style={{
          height: isCalculating ? 'auto' : flickrLayout.containerHeight,
          minHeight: isCalculating ? 200 : undefined
        }}
      >
        {isCalculating ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {photos.slice(0, 8).map((photo) => (
              <div key={photo.id} className="aspect-square bg-neutral-200 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : photos.map((photo, index) => {
          const box = flickrLayout.boxes[index];
          if (!box) return null;

          return (
            <div
              key={photo.id}
              className="photo-card absolute group cursor-pointer transition-all duration-300 hover:z-10"
              style={{
                left: box.left,
                top: box.top,
                width: box.width,
                height: box.height,
              }}
              onClick={() => onPhotoClick(index)}
            >
              <AuthenticatedImage
                src={photo.thumbnail_url || photo.url}
                alt={photo.filename}
                className="w-full h-full object-cover rounded-lg transition-transform duration-300 group-hover:scale-[1.02]"
                loading="lazy"
                isGallery={true}
                protectFromDownload={!allowDownloads}
              />

              {/* Feedback Indicators */}
              {feedbackEnabled && ((photo.comment_count ?? 0) > 0 || (photo.average_rating ?? 0) > 0 || (photo.like_count ?? 0) > 0) && (
                <div className="absolute top-2 left-2 flex gap-1 z-10">
                  {(photo.comment_count ?? 0) > 0 && (
                    <div className="bg-white/90 backdrop-blur-sm rounded-full px-2 py-1 flex items-center gap-1">
                      <MessageSquare className="w-3.5 h-3.5 text-primary-600" fill="currentColor" />
                      <span className="text-xs font-medium text-neutral-700">{photo.comment_count ?? 0}</span>
                    </div>
                  )}
                  {(photo.average_rating ?? 0) > 0 && (
                    <div className="bg-white/90 backdrop-blur-sm rounded-full px-2 py-1 flex items-center gap-1">
                      <Star className="w-3.5 h-3.5 text-yellow-500" fill="currentColor" />
                      <span className="text-xs font-medium text-neutral-700">{Number(photo.average_rating ?? 0).toFixed(1)}</span>
                    </div>
                  )}
                  {(photo.like_count ?? 0) > 0 && (
                    <div className="bg-white/90 backdrop-blur-sm rounded-full px-2 py-1 flex items-center gap-1">
                      <Heart className="w-3.5 h-3.5 text-red-500" fill="currentColor" />
                      <span className="text-xs font-medium text-neutral-700">{photo.like_count ?? 0}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Hover overlay with actions */}
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-200 rounded-lg flex items-center justify-center gap-2">
                {!isSelectionMode && (
                  <>
                    <button
                      type="button"
                      aria-label="View full size"
                      className="p-2 bg-white/20 hover:bg-white/40 rounded-full transition-colors"
                      onClick={(e) => { e.stopPropagation(); onPhotoClick(index); }}
                    >
                      <Maximize2 className="w-5 h-5 text-white" />
                    </button>
                    {allowDownloads && (
                      <button
                        type="button"
                        aria-label="Download photo"
                        className="p-2 bg-white/20 hover:bg-white/40 rounded-full transition-colors"
                        onClick={(e) => { e.stopPropagation(); onDownload(photo, e); }}
                      >
                        <Download className="w-5 h-5 text-white" />
                      </button>
                    )}
                  </>
                )}
              </div>

              {/* Selection Checkbox */}
              <button
                type="button"
                aria-label={`Select ${photo.filename}`}
                role="checkbox"
                aria-checked={selectedPhotos.has(photo.id)}
                className={`absolute top-2 right-2 z-20 transition-opacity ${
                  selectedPhotos.has(photo.id) ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                }`}
                onClick={(e) => { e.stopPropagation(); onPhotoSelect && onPhotoSelect(photo.id); }}
              >
                <div className={`w-6 h-6 rounded-full border-2 ${selectedPhotos.has(photo.id) ? 'bg-primary-600 border-primary-600' : 'bg-white/90 border-white'} flex items-center justify-center transition-colors`}>
                  {selectedPhotos.has(photo.id) && <Check className="w-4 h-4 text-white" />}
                </div>
              </button>

              {photo.type === 'collage' && (
                <div className="absolute bottom-2 left-2">
                  <span className="px-2 py-1 bg-black/60 text-white text-xs rounded">Collage</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  // JUSTIFIED MODE - React Photo Album (Google Photos style with Knuth-Plass algorithm)
  if (mode === 'justified') {
    // Custom render function for photos in react-photo-album
    // The render function receives (props, context) where context contains photo, index, width, height
    const renderPhoto = useCallback((_props: { onClick?: React.MouseEventHandler }, context: RenderPhotoContext<typeof albumPhotos[0]>) => {
      const { photo, width, height } = context;
      const photoData = photo.photoData;
      const originalIndex = photo.originalIndex;

      return (
        <div
          style={{ width, height }}
          className="photo-card group cursor-pointer transition-all duration-300 hover:z-10 relative"
          onClick={() => onPhotoClick(originalIndex)}
        >
          <AuthenticatedImage
            src={photoData.thumbnail_url || photoData.url}
            alt={photoData.filename}
            className="w-full h-full object-cover rounded-lg transition-transform duration-300 group-hover:scale-[1.02]"
            style={{ width: '100%', height: '100%' }}
            loading="lazy"
            isGallery={true}
            protectFromDownload={!allowDownloads}
          />

          {/* Feedback Indicators */}
          {feedbackEnabled && ((photoData.comment_count ?? 0) > 0 || (photoData.average_rating ?? 0) > 0 || (photoData.like_count ?? 0) > 0) && (
            <div className="absolute top-2 left-2 flex gap-1 z-10">
              {(photoData.comment_count ?? 0) > 0 && (
                <div className="bg-white/90 backdrop-blur-sm rounded-full px-2 py-1 flex items-center gap-1">
                  <MessageSquare className="w-3.5 h-3.5 text-primary-600" fill="currentColor" />
                  <span className="text-xs font-medium text-neutral-700">{photoData.comment_count ?? 0}</span>
                </div>
              )}
              {(photoData.average_rating ?? 0) > 0 && (
                <div className="bg-white/90 backdrop-blur-sm rounded-full px-2 py-1 flex items-center gap-1">
                  <Star className="w-3.5 h-3.5 text-yellow-500" fill="currentColor" />
                  <span className="text-xs font-medium text-neutral-700">{Number(photoData.average_rating ?? 0).toFixed(1)}</span>
                </div>
              )}
              {(photoData.like_count ?? 0) > 0 && (
                <div className="bg-white/90 backdrop-blur-sm rounded-full px-2 py-1 flex items-center gap-1">
                  <Heart className="w-3.5 h-3.5 text-red-500" fill="currentColor" />
                  <span className="text-xs font-medium text-neutral-700">{photoData.like_count ?? 0}</span>
                </div>
              )}
            </div>
          )}

          {/* Hover overlay with actions */}
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-200 rounded-lg flex items-center justify-center gap-2">
            {!isSelectionMode && (
              <>
                <button
                  type="button"
                  aria-label="View full size"
                  className="p-2 bg-white/20 hover:bg-white/40 rounded-full transition-colors"
                  onClick={(e) => { e.stopPropagation(); onPhotoClick(originalIndex); }}
                >
                  <Maximize2 className="w-5 h-5 text-white" />
                </button>
                {allowDownloads && (
                  <button
                    type="button"
                    aria-label="Download photo"
                    className="p-2 bg-white/20 hover:bg-white/40 rounded-full transition-colors"
                    onClick={(e) => { e.stopPropagation(); onDownload(photoData, e); }}
                  >
                    <Download className="w-5 h-5 text-white" />
                  </button>
                )}
              </>
            )}
          </div>

          {/* Selection Checkbox */}
          <button
            type="button"
            aria-label={`Select ${photoData.filename}`}
            role="checkbox"
            aria-checked={selectedPhotos.has(photoData.id)}
            className={`absolute top-2 right-2 z-20 transition-opacity ${
              selectedPhotos.has(photoData.id) ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
            }`}
            onClick={(e) => { e.stopPropagation(); onPhotoSelect && onPhotoSelect(photoData.id); }}
          >
            <div className={`w-6 h-6 rounded-full border-2 ${selectedPhotos.has(photoData.id) ? 'bg-primary-600 border-primary-600' : 'bg-white/90 border-white'} flex items-center justify-center transition-colors`}>
              {selectedPhotos.has(photoData.id) && <Check className="w-4 h-4 text-white" />}
            </div>
          </button>

          {photoData.type === 'collage' && (
            <div className="absolute bottom-2 left-2">
              <span className="px-2 py-1 bg-black/60 text-white text-xs rounded">Collage</span>
            </div>
          )}
        </div>
      );
    }, [onPhotoClick, onDownload, allowDownloads, feedbackEnabled, isSelectionMode, selectedPhotos, onPhotoSelect]);

    if (albumPhotos.length === 0) {
      return (
        <div ref={containerRef} className="photo-grid">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {photos.slice(0, 8).map((photo) => (
              <div key={photo.id} className="aspect-square bg-neutral-200 rounded-lg animate-pulse" />
            ))}
          </div>
        </div>
      );
    }

    return (
      <div ref={containerRef} className="photo-grid">
        <RowsPhotoAlbum
          photos={albumPhotos}
          targetRowHeight={targetRowHeight}
          rowConstraints={{ minPhotos: 1, maxPhotos: 6 }}
          spacing={gutter}
          render={{ photo: renderPhoto }}
        />
      </div>
    );
  }

  // COLUMNS MODE - Pinterest style masonry (default)
  return (
    <div
      ref={containerRef}
      className="photo-grid flex gap-4"
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
