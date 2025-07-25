import React, { useState } from 'react';
import { X, ChevronLeft, ChevronRight, Download, Trash2, Tag, Calendar, HardDrive, Eye, MousePointer } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'react-toastify';

import { AdminPhoto } from '../../services/photos.service';
import { photosService } from '../../services/photos.service';
import { Button } from '../common';
import { AdminAuthenticatedImage } from './AdminAuthenticatedImage';

interface AdminPhotoViewerProps {
  photos: AdminPhoto[];
  initialIndex: number;
  eventId: number;
  onClose: () => void;
  onPhotoDeleted: () => void;
  categories: Array<{ id: number; name: string; slug: string }>;
}

export const AdminPhotoViewer: React.FC<AdminPhotoViewerProps> = ({
  photos,
  initialIndex,
  eventId,
  onClose,
  onPhotoDeleted,
  categories
}) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showCategoryMenu, setShowCategoryMenu] = useState(false);
  
  const currentPhoto = photos[currentIndex];

  const goToPrevious = () => {
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : photos.length - 1));
  };

  const goToNext = () => {
    setCurrentIndex((prev) => (prev < photos.length - 1 ? prev + 1 : 0));
  };

  const handleDelete = async () => {
    if (!confirm(`Are you sure you want to delete "${currentPhoto.filename}"?`)) {
      return;
    }

    setIsDeleting(true);
    try {
      await photosService.deletePhoto(eventId, currentPhoto.id);
      toast.success('Photo deleted successfully');
      
      // Close viewer if this was the last photo
      if (photos.length === 1) {
        onClose();
      } else {
        // Move to next photo if available, otherwise previous
        if (currentIndex === photos.length - 1) {
          setCurrentIndex(currentIndex - 1);
        }
      }
      
      onPhotoDeleted();
    } catch (error) {
      toast.error('Failed to delete photo');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDownload = async () => {
    try {
      await photosService.downloadPhoto(eventId, currentPhoto.id, currentPhoto.filename);
      toast.success('Download started');
    } catch (error) {
      toast.error('Failed to download photo');
    }
  };

  const handleCategoryChange = async (categoryId: number | null) => {
    try {
      await photosService.updatePhotoCategory(eventId, currentPhoto.id, categoryId);
      toast.success('Category updated');
      setShowCategoryMenu(false);
      // Trigger refresh to update the photo data
      onPhotoDeleted(); // This will refresh the photos list
    } catch (error) {
      toast.error('Failed to update category');
    }
  };

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'Escape':
          onClose();
          break;
        case 'ArrowLeft':
          goToPrevious();
          break;
        case 'ArrowRight':
          goToNext();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIndex]);

  return (
    <div className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center">
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 text-white/80 hover:text-white p-2 rounded-lg hover:bg-white/10 transition-colors"
      >
        <X className="w-6 h-6" />
      </button>

      {/* Navigation */}
      <button
        onClick={goToPrevious}
        className="absolute left-4 top-1/2 -translate-y-1/2 text-white/80 hover:text-white p-2 rounded-lg hover:bg-white/10 transition-colors"
      >
        <ChevronLeft className="w-8 h-8" />
      </button>

      <button
        onClick={goToNext}
        className="absolute right-4 top-1/2 -translate-y-1/2 text-white/80 hover:text-white p-2 rounded-lg hover:bg-white/10 transition-colors"
      >
        <ChevronRight className="w-8 h-8" />
      </button>

      {/* Main content */}
      <div className="flex flex-col lg:flex-row gap-6 max-w-7xl mx-auto p-4 w-full h-full">
        {/* Image */}
        <div className="flex-1 flex items-center justify-center min-h-0">
          <AdminAuthenticatedImage
            src={currentPhoto.url}
            alt={currentPhoto.filename}
            className="max-w-full max-h-full object-contain"
            fallback={
              <div className="flex items-center justify-center text-neutral-400">
                <div className="text-center">
                  <Eye className="w-12 h-12 mx-auto mb-2" />
                  <p className="text-sm">Failed to load image</p>
                </div>
              </div>
            }
          />
        </div>

        {/* Sidebar */}
        <div className="lg:w-80 bg-neutral-900 rounded-lg p-6 overflow-y-auto">
          <h3 className="text-white font-medium text-lg mb-4">{currentPhoto.filename}</h3>

          {/* Actions */}
          <div className="flex gap-2 mb-6">
            <Button
              variant="primary"
              size="sm"
              onClick={handleDownload}
              leftIcon={<Download className="w-4 h-4" />}
              className="flex-1"
            >
              Download
            </Button>
            <button
              onClick={handleDelete}
              disabled={isDeleting}
              className="flex-1 px-3 py-1.5 text-sm font-medium text-white bg-red-600 hover:bg-red-700 disabled:bg-red-400 rounded-lg flex items-center justify-center gap-2"
            >
              <Trash2 className="w-4 h-4" />
              Delete
            </button>
          </div>

          {/* Category */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-neutral-400 text-sm flex items-center gap-1">
                <Tag className="w-4 h-4" />
                Category
              </span>
              <button
                onClick={() => setShowCategoryMenu(!showCategoryMenu)}
                className="text-xs text-primary-400 hover:text-primary-300"
              >
                Change
              </button>
            </div>
            <p className="text-white">
              {currentPhoto.category_name || 'Uncategorized'}
            </p>
            
            {showCategoryMenu && (
              <div className="mt-2 bg-neutral-800 rounded-lg p-2">
                <button
                  onClick={() => handleCategoryChange(null)}
                  className="w-full text-left px-3 py-2 text-sm text-white hover:bg-neutral-700 rounded"
                >
                  Uncategorized
                </button>
                {categories.map(cat => (
                  <button
                    key={cat.id}
                    onClick={() => handleCategoryChange(cat.id)}
                    className="w-full text-left px-3 py-2 text-sm text-white hover:bg-neutral-700 rounded"
                  >
                    {cat.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Metadata */}
          <div className="space-y-4 text-sm">
            <div>
              <span className="text-neutral-400 flex items-center gap-1 mb-1">
                <HardDrive className="w-4 h-4" />
                File Size
              </span>
              <p className="text-white">{photosService.formatBytes(currentPhoto.size)}</p>
            </div>

            <div>
              <span className="text-neutral-400 flex items-center gap-1 mb-1">
                <Calendar className="w-4 h-4" />
                Uploaded
              </span>
              <p className="text-white">
                {format(new Date(currentPhoto.uploaded_at), 'MMM d, yyyy h:mm a')}
              </p>
            </div>

            {currentPhoto.view_count !== undefined && (
              <div>
                <span className="text-neutral-400 flex items-center gap-1 mb-1">
                  <Eye className="w-4 h-4" />
                  Views
                </span>
                <p className="text-white">{currentPhoto.view_count}</p>
              </div>
            )}

            {currentPhoto.download_count !== undefined && (
              <div>
                <span className="text-neutral-400 flex items-center gap-1 mb-1">
                  <MousePointer className="w-4 h-4" />
                  Downloads
                </span>
                <p className="text-white">{currentPhoto.download_count}</p>
              </div>
            )}
          </div>

          {/* Navigation info */}
          <div className="mt-6 pt-6 border-t border-neutral-700">
            <p className="text-neutral-400 text-sm text-center">
              {currentIndex + 1} of {photos.length}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};