import React, { useState } from 'react';
import { Check, Download, Trash2, Eye, Package, MessageSquare, Star } from 'lucide-react';
import { toast } from 'react-toastify';

import { AdminPhoto } from '../../services/photos.service';
import { photosService } from '../../services/photos.service';
import { Button } from '../common';
import { AdminAuthenticatedImage } from './AdminAuthenticatedImage';

interface AdminPhotoGridProps {
  photos: AdminPhoto[];
  eventId: number;
  onPhotoClick: (photo: AdminPhoto, index: number) => void;
  onPhotosDeleted: () => void;
}

export const AdminPhotoGrid: React.FC<AdminPhotoGridProps> = ({
  photos,
  eventId,
  onPhotoClick,
  onPhotosDeleted
}) => {
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
  };

  const handleSelectAll = () => {
    if (selectedPhotos.size === photos.length) {
      setSelectedPhotos(new Set());
    } else {
      setSelectedPhotos(new Set(photos.map(p => p.id)));
    }
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
    } catch (error) {
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
      onPhotosDeleted();
    } catch (error) {
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
    } catch (error) {
      toast.error('Failed to download photo');
    }
  };

  const toggleSelectionMode = () => {
    setIsSelectionMode(!isSelectionMode);
    if (isSelectionMode) {
      setSelectedPhotos(new Set());
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
            {isSelectionMode ? 'Cancel Selection' : 'Select Photos'}
          </Button>
          
          {(isSelectionMode || selectedPhotos.size > 0) && (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSelectAll}
              >
                {selectedPhotos.size === photos.length ? 'Deselect All' : 'Select All'}
              </Button>
              
              {selectedPhotos.size > 0 && (
                <>
                  <span className="text-sm text-neutral-600">
                    {selectedPhotos.size} selected
                  </span>
                  <button
                    onClick={handleDeleteSelected}
                    disabled={isDeleting}
                    className="px-3 py-1.5 text-sm font-medium text-white bg-red-600 hover:bg-red-700 disabled:bg-red-400 rounded-lg flex items-center gap-2"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete Selected
                  </button>
                </>
              )}
            </>
          )}
        </div>
        
        <div className="text-sm text-neutral-600">
          {photos.length} photo{photos.length !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Photo Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {photos.map((photo, index) => {
          const isDeleting = deletingPhotos.has(photo.id);
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
            
            {/* Feedback Indicators (moved to bottom-right to avoid covering category) */}
            {(photo.comment_count > 0 || photo.average_rating > 0 || photo.like_count > 0) && (
              <div className="absolute bottom-2 right-2 flex items-center gap-1 z-10">
                {photo.average_rating > 0 && (
                  <div className="bg-white/90 backdrop-blur-sm rounded-full px-2 py-1 flex items-center gap-1" title={`Rating: ${Number(photo.average_rating).toFixed(1)}`}>
                    <Star className="w-3.5 h-3.5 text-yellow-500" fill="currentColor" />
                    <span className="text-xs font-medium text-neutral-700">{Number(photo.average_rating).toFixed(1)}</span>
                  </div>
                )}
                {photo.comment_count > 0 && (
                  <div className="bg-white/90 backdrop-blur-sm rounded-full px-2 py-1 flex items-center gap-1" title={`${photo.comment_count} comments`}>
                    <MessageSquare className="w-3.5 h-3.5 text-primary-600" fill="currentColor" />
                    <span className="text-xs font-medium text-neutral-700">{photo.comment_count}</span>
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
          <p className="text-neutral-500">No photos uploaded yet</p>
        </div>
      )}
    </div>
  );
};
