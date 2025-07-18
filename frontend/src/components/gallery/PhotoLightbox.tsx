import React, { useState, useEffect } from 'react';
import { X, ChevronLeft, ChevronRight, Download, ZoomIn, ZoomOut } from 'lucide-react';
import type { Photo } from '../../types';
import { useDownloadPhoto } from '../../hooks/useGallery';
import { AuthenticatedImage } from '../common';

interface PhotoLightboxProps {
  photos: Photo[];
  initialIndex: number;
  onClose: () => void;
  slug: string;
}

export const PhotoLightbox: React.FC<PhotoLightboxProps> = ({
  photos,
  initialIndex,
  onClose,
  slug,
}) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [zoom, setZoom] = useState(1);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [touchDistance, setTouchDistance] = useState<number | null>(null);
  
  const downloadPhotoMutation = useDownloadPhoto();
  const currentPhoto = photos[currentIndex];

  useEffect(() => {
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
        case '+':
        case '=':
          handleZoomIn();
          break;
        case '-':
        case '_':
          handleZoomOut();
          break;
        case 'd':
        case 'D':
          handleDownload();
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [currentIndex]);

  const goToPrevious = () => {
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : photos.length - 1));
    resetZoom();
  };

  const goToNext = () => {
    setCurrentIndex((prev) => (prev < photos.length - 1 ? prev + 1 : 0));
    resetZoom();
  };

  const resetZoom = () => {
    setZoom(1);
    setDragOffset({ x: 0, y: 0 });
  };

  const handleZoomIn = () => {
    setZoom((prev) => Math.min(prev + 0.5, 3));
  };

  const handleZoomOut = () => {
    setZoom((prev) => Math.max(prev - 0.5, 1));
    if (zoom - 0.5 <= 1) {
      setDragOffset({ x: 0, y: 0 });
    }
  };

  const handleDownload = () => {
    downloadPhotoMutation.mutate({
      slug,
      photoId: currentPhoto.id,
      filename: currentPhoto.filename,
    });
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (zoom > 1) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - dragOffset.x, y: e.clientY - dragOffset.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging && zoom > 1) {
      setDragOffset({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleImageClick = (e: React.MouseEvent) => {
    // Only close if clicking the background, not the image
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  // Touch event handlers for pinch-to-zoom
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      const distance = Math.hypot(
        touch2.clientX - touch1.clientX,
        touch2.clientY - touch1.clientY
      );
      setTouchDistance(distance);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && touchDistance !== null) {
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      const newDistance = Math.hypot(
        touch2.clientX - touch1.clientX,
        touch2.clientY - touch1.clientY
      );
      
      const scale = newDistance / touchDistance;
      const newZoom = Math.max(1, Math.min(3, zoom * scale));
      setZoom(newZoom);
      setTouchDistance(newDistance);
    }
  };

  const handleTouchEnd = () => {
    setTouchDistance(null);
  };

  return (
    <div className="fixed inset-0 bg-black z-50 flex items-center justify-center">
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors z-20"
        aria-label="Close"
      >
        <X className="w-6 h-6 text-white" />
      </button>

      {/* Navigation buttons */}
      <button
        onClick={goToPrevious}
        className="absolute left-4 top-1/2 -translate-y-1/2 p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors z-20"
        aria-label="Previous photo"
      >
        <ChevronLeft className="w-6 h-6 text-white" />
      </button>

      <button
        onClick={goToNext}
        className="absolute right-4 top-1/2 -translate-y-1/2 p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors z-20"
        aria-label="Next photo"
      >
        <ChevronRight className="w-6 h-6 text-white" />
      </button>

      {/* Bottom toolbar */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4 z-20">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="text-white">
            <p className="text-sm opacity-75">
              {currentIndex + 1} / {photos.length}
            </p>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={handleZoomOut}
              disabled={zoom <= 1}
              className="p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="Zoom out"
            >
              <ZoomOut className="w-5 h-5 text-white" />
            </button>
            <span className="text-white text-sm w-12 text-center">
              {Math.round(zoom * 100)}%
            </span>
            <button
              onClick={handleZoomIn}
              disabled={zoom >= 3}
              className="p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="Zoom in"
            >
              <ZoomIn className="w-5 h-5 text-white" />
            </button>
            
            <div className="w-px h-6 bg-white/20 mx-2" />
            
            <button
              onClick={handleDownload}
              className="p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors"
              aria-label="Download photo"
            >
              <Download className="w-5 h-5 text-white" />
            </button>
          </div>
        </div>
      </div>

      {/* Image container */}
      <div
        className="absolute inset-0 flex items-center justify-center z-0"
        onClick={handleImageClick}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{ cursor: zoom > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default' }}
      >
        <AuthenticatedImage
          src={currentPhoto.url}
          alt={currentPhoto.filename}
          className="max-w-full max-h-full object-contain select-none"
          style={{
            transform: `scale(${zoom}) translate(${dragOffset.x / zoom}px, ${dragOffset.y / zoom}px)`,
            transition: isDragging ? 'none' : 'transform 0.2s',
          }}
          draggable={false}
          useWatermark={true}
          isGallery={true}
        />
      </div>

      {/* Touch/swipe indicators for mobile */}
      <div className="absolute bottom-20 left-1/2 -translate-x-1/2 text-white text-sm opacity-50 pointer-events-none md:hidden z-20">
        Swipe to navigate
      </div>
    </div>
  );
};