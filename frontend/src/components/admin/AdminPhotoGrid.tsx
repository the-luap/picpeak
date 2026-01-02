import React, { useState } from 'react';
import { Check, Download, Trash2, Eye, Package, MessageSquare, Star, Video } from 'lucide-react';
import { toast } from 'react-toastify';
import { useTranslation } from 'react-i18next';

import { AdminPhoto } from '../../services/photos.service';
import { photosService } from '../../services/photos.service';
import { Button } from '../common';
import { AdminAuthenticatedImage } from './AdminAuthenticatedImage';

interface AdminPhotoGridProps {
  photos: AdminPhoto[];
  eventId: number;
  onPhotoClick: (photo: AdminPhoto, index: number) => void;
  onPhotosDeleted: () => void;
  onSelectionChange?: (selectedIds: number[]) => void;
}

export const AdminPhotoGrid: React.FC<AdminPhotoGridProps> = ({
  photos,
  eventId,
  onPhotoClick,
  onPhotosDeleted,
  onSelectionChange
}) => {
  const { t } = useTranslation();
  const [selectedPhotos, setSelectedPhotos] = useState<Set<number>>(new Set());
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deletingPhotos, setDeletingPhotos] = useState<Set<number>>(new Set());

  const handlePhotoSelect = (photoId: number, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
    }
    // Auto-enable selection mode when selecting via checkbox
    if (!isSelectionMode) {
      setIsSelectionMode(true);
    }
    const newSelected = new Set(selectedPhotos);
    if (newSelected.has(photoId)) {
      newSelected.delete(photoId);
    } else {
      newSelected.add(photoId);
    }
    setSelectedPhotos(newSelected);
    onSelectionChange?.(Array.from(newSelected));
  };

  const handleSelectAll = () => {
    let newSelected: Set<number>;
    if (selectedPhotos.size === photos.length) {
      newSelected = new Set();
    } else {
      newSelected = new Set(photos.map(p => p.id));
    }
    setSelectedPhotos(newSelected);
    onSelectionChange?.(Array.from(newSelected));
  };

  const handleDeleteSingle = async (photo: AdminPhoto, e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (!confirm(`Are you sure you want to delete "${photo.filename}"?`)) {
      return;
    }

    setDeletingPhotos(prev => new Set(prev).add(photo.id));
    try {
      await photosService.deletePhoto(eventId, photo.id);
      toast.success('Photo deleted successfully');
      onPhotosDeleted();
    } catch {
      toast.error('Failed to delete photo');
      setDeletingPhotos(prev => {
        const newSet = new Set(prev);
        newSet.delete(photo.id);
        return newSet;
      });
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedPhotos.size === 0) return;

    const count = selectedPhotos.size;
    if (!confirm(`Are you sure you want to delete ${count} photo${count > 1 ? 's' : ''}?`)) {
      return;
    }

    setIsDeleting(true);
    const selectedIds = Array.from(selectedPhotos);
    setDeletingPhotos(new Set(selectedIds));
    
    try {
      await photosService.deletePhotos(eventId, selectedIds);
      toast.success(`${count} photo${count > 1 ? 's' : ''} deleted successfully`);
      setSelectedPhotos(new Set());
      setIsSelectionMode(false);
      onSelectionChange?.([]);
      onPhotosDeleted();
    } catch {
      toast.error('Failed to delete photos');
      setDeletingPhotos(new Set());
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDownload = async (photo: AdminPhoto, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await photosService.downloadPhoto(eventId, photo.id, photo.filename);
      toast.success('Download started');
    } catch {
      toast.error('Failed to download photo');
    }
  };

  const toggleSelectionMode = () => {
    setIsSelectionMode(!isSelectionMode);
    if (isSelectionMode) {
      setSelectedPhotos(new Set());
      onSelectionChange?.([]);
    }
  };

  return (
    <div>
      {/* Action Bar */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant={isSelectionMode ? "primary" : "outline"}
            size="sm"
            onClick={toggleSelectionMode}
            leftIcon={<Package className="w-4 h-4" />}
          >
            {isSelectionMode ? t('gallery.cancelSelection', 'Cancel Selection') : t('gallery.selectPhotos', 'Select Photos')}
          </Button>
          
          {(isSelectionMode || selectedPhotos.size > 0) && (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSelectAll}
              >
                {selectedPhotos.size === photos.length ? t('gallery.deselectAll', 'Deselect All') : t('gallery.selectAll', 'Select All')}
              </Button>
              
              {selectedPhotos.size > 0 && (
                <>
                  <span className="text-sm text-neutral-600">
                    {t('gallery.photosSelected', { count: selectedPhotos.size })}
                  </span>
                  <button
                    onClick={handleDeleteSelected}
                    disabled={isDeleting}
                    className="px-3 py-1.5 text-sm font-medium text-white bg-red-600 hover:bg-red-700 disabled:bg-red-400 rounded-lg flex items-center gap-2"
                  >
                    <Trash2 className="w-4 h-4" />
                    {t('gallery.deleteSelected', 'Delete Selected')}
                  </button>
                </>
              )}
            </>
          )}
        </div>
        
        <div className="text-sm text-neutral-600">
          {t('gallery.photosCount', { count: photos.length })}
        </div>
      </div>

      {/* Photo Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {photos.map((photo, index) => {
          const isDeleting = deletingPhotos.has(photo.id);
          const commentCount = photo.comment_count ?? 0;
          const averageRating = photo.average_rating ?? 0;
          const likeCount = photo.like_count ?? 0;
          const isVideo = (photo.media_type === 'video') ||
            (photo.mime_type && photo.mime_type.startsWith('video/')) ||
            photo.type === 'video';
          return (
            <div
              key={photo.id}
              data-testid={`admin-photo-tile-${photo.id}`}
              className={`relative group cursor-pointer rounded-lg overflow-hidden bg-neutral-100 transition-opacity ${
                isSelectionMode ? 'ring-2 ring-offset-2 ' + (selectedPhotos.has(photo.id) ? 'ring-primary-500' : 'ring-transparent') : ''
              } ${isDeleting ? 'opacity-50' : ''}`}
              onClick={() => !isDeleting && onPhotoClick(photo, index)}
          >
            {/* Selection Checkbox (top-right) */}
            <button
              type="button"
              aria-label={`Select ${photo.filename}`}
              role="checkbox"
              aria-checked={selectedPhotos.has(photo.id)}
              data-testid={`admin-photo-checkbox-${photo.id}`}
              className={`absolute top-2 right-2 z-20 transition-opacity ${
                selectedPhotos.has(photo.id) ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
              }`}
              onClick={(e) => handlePhotoSelect(photo.id, e)}
            >
              <div className={`w-6 h-6 rounded border-2 flex items-center justify-center ${
                selectedPhotos.has(photo.id)
                  ? 'bg-primary-600 border-primary-600'
                  : 'bg-white/90 border-white'
              }`}>
                {selectedPhotos.has(photo.id) && <Check className="w-4 h-4 text-white" />}
              </div>
            </button>

            {/* Thumbnail */}
            <div className="aspect-square">
              {photo.thumbnail_url ? (
                <AdminAuthenticatedImage
                  src={photo.thumbnail_url}
                  alt={photo.filename}
                  className="w-full h-full object-cover"
                  loading="lazy"
                  fallback={
                    <div className="w-full h-full flex items-center justify-center text-neutral-400">
                      <Eye className="w-8 h-8" />
                    </div>
                  }
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-neutral-400">
                  <Eye className="w-8 h-8" />
                </div>
              )}
            </div>

            {/* Overlay with actions */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
              <div className="absolute bottom-0 left-0 right-0 p-3">
                <p className="text-white text-xs font-medium truncate mb-1">
                  {photo.filename}
                </p>
                <p className="text-white/80 text-xs mb-2">
                  {photosService.formatBytes(photo.size)}
                </p>
                
                {!isSelectionMode && (
                  <div className="flex gap-1">
                    <button
                      onClick={(e) => handleDownload(photo, e)}
                      className="p-1 text-white hover:bg-white/20 rounded"
                    >
                      <Download className="w-3 h-3" />
                    </button>
                    <button
                      onClick={(e) => handleDeleteSingle(photo, e)}
                      className="p-1 text-white hover:bg-white/20 rounded disabled:opacity-50"
                      disabled={isDeleting}
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Category Badge - move to top-left and prevent overlap with select checkbox */}
            {photo.category_name && (
              <div className="absolute left-2 top-2 pointer-events-none">
                <span className="px-2 py-1 text-xs font-medium bg-white/90 text-neutral-700 rounded max-w-[70%] whitespace-nowrap overflow-hidden text-ellipsis">
                  {photo.category_name}
                </span>
              </div>
            )}

            {isVideo && (
              <div className="absolute bottom-2 left-2 pointer-events-none">
                <span className="px-2 py-1 text-[11px] font-semibold bg-black/70 text-white rounded flex items-center gap-1">
                  <Video className="w-3 h-3" />
                  {t('common.video', 'Video')}
                </span>
              </div>
            )}
            
            {/* Feedback Indicators (moved to bottom-right to avoid covering category) */}
            {(commentCount > 0 || averageRating > 0 || likeCount > 0) && (
              <div className="absolute bottom-2 right-2 flex items-center gap-1 z-10">
                {averageRating > 0 && (
                  <div className="bg-white/90 backdrop-blur-sm rounded-full px-2 py-1 flex items-center gap-1" title={`Rating: ${Number(averageRating).toFixed(1)}`}>
                    <Star className="w-3.5 h-3.5 text-yellow-500" fill="currentColor" />
                    <span className="text-xs font-medium text-neutral-700">{Number(averageRating).toFixed(1)}</span>
                  </div>
                )}
                {commentCount > 0 && (
                  <div className="bg-white/90 backdrop-blur-sm rounded-full px-2 py-1 flex items-center gap-1" title={`${commentCount} comments`}>
                    <MessageSquare className="w-3.5 h-3.5 text-primary-600" fill="currentColor" />
                    <span className="text-xs font-medium text-neutral-700">{commentCount}</span>
                  </div>
                )}
              </div>
            )}
          </div>
          );
        })}
      </div>

      {photos.length === 0 && (
        <div className="text-center py-12">
          <p className="text-neutral-500">{t('gallery.noMedia', 'No media uploaded yet')}</p>
        </div>
      )}
    </div>
  );
};
