import React, { useState, useEffect } from 'react';
import { useDevToolsProtection } from '../../hooks/useDevToolsProtection';
import { X, ChevronLeft, ChevronRight, Download, ZoomIn, ZoomOut, MessageSquare } from 'lucide-react';
import type { Photo } from '../../types';
import { useDownloadPhoto } from '../../hooks/useGallery';
import { AuthenticatedImage } from '../common';
import { PhotoFeedback } from './PhotoFeedback';

interface PhotoLightboxProps {
  photos: Photo[];
  initialIndex: number;
  onClose: () => void;
  slug: string;
  feedbackEnabled?: boolean;
  allowDownloads?: boolean;
  protectionLevel?: 'basic' | 'standard' | 'enhanced' | 'maximum';
  useEnhancedProtection?: boolean;
}

export const PhotoLightbox: React.FC<PhotoLightboxProps> = ({
  photos,
  initialIndex,
  onClose,
  slug,
  feedbackEnabled = false,
  allowDownloads = true,
  protectionLevel = 'standard',
  useEnhancedProtection = false,
}) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [zoom, setZoom] = useState(1);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [touchDistance, setTouchDistance] = useState<number | null>(null);
  const [showFeedback, setShowFeedback] = useState(false);
  
  // Debug logging
  console.log('PhotoLightbox feedbackEnabled:', feedbackEnabled);
  
  const downloadPhotoMutation = useDownloadPhoto();
  const currentPhoto = photos[currentIndex];
  
  // DevTools protection for the lightbox when enhanced protection is enabled
  useDevToolsProtection({
    enabled: useEnhancedProtection && (protectionLevel === 'enhanced' || protectionLevel === 'maximum'),
    detectionSensitivity: protectionLevel === 'maximum' ? 'high' : 'medium',
    onDevToolsDetected: () => {
      console.warn('DevTools detected in photo lightbox');
      
      // Track analytics
      if (typeof window !== 'undefined' && (window as any).umami) {
        (window as any).umami.track('lightbox_devtools_detected', {
          photoId: currentPhoto.id,
          protectionLevel,
          zoom,
          gallery: slug
        });
      }
      
      // Close lightbox immediately for maximum protection
      if (protectionLevel === 'maximum') {
        onClose();
      }
    },
    redirectOnDetection: false, // Don't redirect, just close lightbox
  });

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
          if (allowDownloads) {
            handleDownload();
          }
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';
    
    // Add protection class to body for maximum security
    if (protectionLevel === 'maximum') {
      document.body.classList.add('protection-maximum');
    } else if (protectionLevel === 'enhanced') {
      document.body.classList.add('protection-enhanced');
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
      
      // Remove protection classes from body
      document.body.classList.remove('protection-maximum', 'protection-enhanced');
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
    if (!allowDownloads) return;
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

  // Apply protection class to the lightbox container
  const lightboxClass = useEnhancedProtection ? 
    `fixed inset-0 bg-black z-50 flex items-center justify-center protected-image protection-${protectionLevel}` :
    'fixed inset-0 bg-black z-50 flex items-center justify-center';

  return (
    <div className={lightboxClass}>
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
            
            {allowDownloads && (
              <button
                onClick={handleDownload}
                className="p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors"
                aria-label="Download photo"
              >
                <Download className="w-5 h-5 text-white" />
              </button>
            )}
            
            {/* Feedback button with indicator */}
            {feedbackEnabled && (
              <button
                onClick={() => {
                  console.log('Feedback button clicked, current feedbackEnabled:', feedbackEnabled);
                  setShowFeedback(!showFeedback);
                }}
                className="relative p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors"
                aria-label="Toggle feedback"
                title={`Photo feedback${currentPhoto.comment_count > 0 ? ` (${currentPhoto.comment_count} comments)` : ''}`}
              >
                <MessageSquare className="w-5 h-5 text-white" />
                {(currentPhoto.comment_count > 0 || currentPhoto.average_rating > 0) && (
                  <span className="absolute -top-1 -right-1 bg-primary-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                    {currentPhoto.comment_count > 0 ? currentPhoto.comment_count : '★'}
                  </span>
                )}
              </button>
            )}
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
          useWatermark={useEnhancedProtection}
          watermarkText={useEnhancedProtection ? `${currentPhoto.filename} - Protected` : undefined}
          isGallery={true}
          slug={slug}
          photoId={currentPhoto.id}
          requiresToken={currentPhoto.requires_token}
          secureUrlTemplate={currentPhoto.secure_url_template}
          protectFromDownload={!allowDownloads || useEnhancedProtection}
          protectionLevel={protectionLevel}
          useEnhancedProtection={useEnhancedProtection}
          useCanvasRendering={protectionLevel === 'maximum'}
          fragmentGrid={protectionLevel === 'enhanced' || protectionLevel === 'maximum'}
          blockKeyboardShortcuts={useEnhancedProtection}
          detectPrintScreen={useEnhancedProtection}
          detectDevTools={protectionLevel === 'enhanced' || protectionLevel === 'maximum'}
          onProtectionViolation={(violationType) => {
            console.warn(`Protection violation in lightbox for photo ${currentPhoto.id}: ${violationType}`);
            
            // Track analytics
            if (typeof window !== 'undefined' && (window as any).umami) {
              (window as any).umami.track('lightbox_protection_violation', {
                photoId: currentPhoto.id,
                violationType,
                protectionLevel,
                zoom
              });
            }
            
            // For maximum protection, close lightbox on violation
            if (protectionLevel === 'maximum' && 
                ['devtools_detected', 'print_screen_detected', 'canvas_access_blocked'].includes(violationType)) {
              onClose();
            }
          }}
        />
      </div>

      {/* Touch/swipe indicators for mobile */}
      <div className="absolute bottom-20 left-1/2 -translate-x-1/2 text-white text-sm opacity-50 pointer-events-none md:hidden z-20">
        Swipe to navigate
      </div>

      {/* Feedback Panel */}
      {showFeedback && (
        <div className="absolute right-0 top-0 bottom-0 w-full sm:w-96 lg:w-[28rem] bg-white shadow-xl z-20 overflow-y-auto">
          <div className="sticky top-0 bg-white border-b px-4 py-3 flex items-center justify-between">
            <h3 className="font-semibold text-neutral-900">Photo Feedback</h3>
            <button
              onClick={() => setShowFeedback(false)}
              className="p-1 hover:bg-neutral-100 rounded transition-colors"
              aria-label="Close feedback"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="p-4">
            <PhotoFeedback
              photoId={currentPhoto.id}
              gallerySlug={slug}
              showComments={true}
              className="space-y-4"
            />
          </div>
        </div>
      )}
    </div>
  );
};