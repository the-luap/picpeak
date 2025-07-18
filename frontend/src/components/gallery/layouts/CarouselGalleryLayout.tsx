import React, { useState, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, Download, Maximize2, Play, Pause } from 'lucide-react';
import { useTheme } from '../../../contexts/ThemeContext';
import { AuthenticatedImage, Button } from '../../common';
import type { BaseGalleryLayoutProps } from './BaseGalleryLayout';

export const CarouselGalleryLayout: React.FC<BaseGalleryLayoutProps> = ({
  photos,
  onPhotoClick,
  onDownload,
  // selectedPhotos = new Set(),
  // isSelectionMode = false
}) => {
  const { theme } = useTheme();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  
  const gallerySettings = theme.gallerySettings || {};
  const autoplay = gallerySettings.carouselAutoplay || false;
  const interval = gallerySettings.carouselInterval || 5000;
  const showThumbnails = gallerySettings.carouselShowThumbnails !== false;

  // Auto-play functionality
  useEffect(() => {
    if (isPlaying && photos.length > 1) {
      intervalRef.current = setInterval(() => {
        setCurrentIndex((prev) => (prev + 1) % photos.length);
      }, interval);
    } else if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isPlaying, photos.length, interval]);

  // Start autoplay if enabled
  useEffect(() => {
    if (autoplay) {
      setIsPlaying(true);
    }
  }, [autoplay]);

  const goToPrevious = () => {
    setCurrentIndex((prev) => (prev - 1 + photos.length) % photos.length);
  };

  const goToNext = () => {
    setCurrentIndex((prev) => (prev + 1) % photos.length);
  };

  const togglePlayPause = () => {
    setIsPlaying(!isPlaying);
  };

  if (photos.length === 0) return null;

  const currentPhoto = photos[currentIndex];

  return (
    <div className="relative">
      {/* Main Carousel */}
      <div className="relative h-[50vh] sm:h-[60vh] lg:h-[70vh] bg-black rounded-lg overflow-hidden">
        <AuthenticatedImage
          src={currentPhoto.url}
          alt={currentPhoto.filename}
          className="w-full h-full object-contain"
          isGallery={true}
        />
        
        {/* Navigation Controls */}
        <div className="absolute inset-0 flex items-center justify-between p-4">
          <button
            onClick={goToPrevious}
            className="p-2 bg-black/50 text-white rounded-full hover:bg-black/70 transition-colors"
            aria-label="Previous photo"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          
          <button
            onClick={goToNext}
            className="p-2 bg-black/50 text-white rounded-full hover:bg-black/70 transition-colors"
            aria-label="Next photo"
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        </div>
        
        {/* Top Controls */}
        <div className="absolute top-4 left-4 right-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 bg-black/50 text-white rounded-full text-sm">
              {currentIndex + 1} / {photos.length}
            </span>
            {currentPhoto.category_name && (
              <span className="px-3 py-1 bg-black/50 text-white rounded-full text-sm">
                {currentPhoto.category_name}
              </span>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={togglePlayPause}
              className="text-white hover:bg-white/20"
              title={isPlaying ? 'Pause slideshow' : 'Play slideshow'}
            >
              {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
            </Button>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onPhotoClick(currentIndex)}
              className="text-white hover:bg-white/20"
              title="View fullscreen"
            >
              <Maximize2 className="w-5 h-5" />
            </Button>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => onDownload(currentPhoto, e)}
              className="text-white hover:bg-white/20"
              title="Download photo"
            >
              <Download className="w-5 h-5" />
            </Button>
          </div>
        </div>
        
        {/* Progress Bar */}
        {isPlaying && (
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/20">
            <div 
              className="h-full bg-white transition-all duration-1000 ease-linear"
              style={{
                width: '100%',
                animation: `progress ${interval}ms linear infinite`
              }}
            />
          </div>
        )}
      </div>
      
      {/* Thumbnails */}
      {showThumbnails && photos.length > 1 && (
        <div className="mt-4 relative">
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-neutral-400">
            {photos.map((photo, index) => (
              <button
                key={photo.id}
                onClick={() => setCurrentIndex(index)}
                className={`relative flex-shrink-0 w-20 h-20 rounded overflow-hidden transition-all ${
                  index === currentIndex 
                    ? 'ring-2 ring-primary-600 scale-110' 
                    : 'opacity-70 hover:opacity-100'
                }`}
              >
                <AuthenticatedImage
                  src={photo.thumbnail_url || photo.url}
                  alt={photo.filename}
                  className="w-full h-full object-cover"
                  loading="lazy"
                  isGallery={true}
                />
              </button>
            ))}
          </div>
        </div>
      )}
      
      <style>{`
        @keyframes progress {
          from { width: 0%; }
          to { width: 100%; }
        }
      `}</style>
    </div>
  );
};