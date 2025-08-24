import React from 'react';
import { Download, Maximize2, Check } from 'lucide-react';
// import { useTheme } from '../../../contexts/ThemeContext';
import { AuthenticatedImage } from '../../common';
import type { BaseGalleryLayoutProps } from './BaseGalleryLayout';
import type { Photo } from '../../../types';

interface MosaicPhotoProps {
  photo: Photo;
  isSelected: boolean;
  isSelectionMode: boolean;
  onClick: (e: React.MouseEvent) => void;
  onDownload: (e: React.MouseEvent) => void;
  className?: string;
  allowDownloads?: boolean;
}

const MosaicPhoto: React.FC<MosaicPhotoProps> = ({
  photo,
  isSelected,
  isSelectionMode,
  onClick,
  onDownload,
  className = '',
  allowDownloads = true
}) => {
  return (
    <div
      className={`relative group cursor-pointer overflow-hidden rounded-lg bg-neutral-100 ${className}`}
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
          </>
        )}
      </div>

      {isSelectionMode && (
        <div className={`absolute top-2 right-2 ${isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} transition-opacity`}>
          <div className={`w-6 h-6 rounded-full border-2 ${isSelected ? 'bg-primary-600 border-primary-600' : 'bg-white/80 border-white'} flex items-center justify-center transition-colors`}>
            {isSelected && <Check className="w-4 h-4 text-white" />}
          </div>
        </div>
      )}

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

export const MosaicGalleryLayout: React.FC<BaseGalleryLayoutProps> = ({
  photos,
  onPhotoClick,
  onDownload,
  selectedPhotos = new Set(),
  isSelectionMode = false,
  onPhotoSelect,
  allowDownloads = true
}) => {
  // const { theme } = useTheme();
  // const gallerySettings = theme.gallerySettings || {};
  // const pattern = gallerySettings.mosaicPattern || 'structured';

  const handlePhotoClick = (index: number, photoId: number) => {
    if (isSelectionMode && onPhotoSelect) {
      onPhotoSelect(photoId);
    } else {
      onPhotoClick(index);
    }
  };

  // Create a more structured mosaic layout
  const renderMosaicLayout = () => {
    const elements = [];
    let photoIndex = 0;
    let patternIndex = 0;
    
    while (photoIndex < photos.length) {
      const remainingPhotos = photos.length - photoIndex;
      
      // Choose pattern based on rotation and remaining photos
      if (patternIndex % 3 === 0 && remainingPhotos >= 3) {
        // Pattern 1: Large left, 2 small right
        // Capture indices immediately to avoid closure issues
        const idx0 = photoIndex;
        const idx1 = photoIndex + 1;
        const idx2 = photoIndex + 2;
        const photo0 = photos[idx0];
        const photo1 = photos[idx1];
        const photo2 = photos[idx2];
        
        elements.push(
          <div key={`pattern-${photoIndex}`} className="grid grid-cols-2 gap-2 mb-2 h-[400px]">
            {photo0 && (
              <MosaicPhoto
                photo={photo0}
                isSelected={selectedPhotos.has(photo0.id)}
                isSelectionMode={isSelectionMode}
                onClick={() => handlePhotoClick(idx0, photo0.id)}
                onDownload={(e) => onDownload(photo0, e)}
                className="col-span-1"
                allowDownloads={allowDownloads}
              />
            )}
            <div className="grid grid-rows-2 gap-2">
              {photo1 && (
                <MosaicPhoto
                  photo={photo1}
                  isSelected={selectedPhotos.has(photo1.id)}
                  isSelectionMode={isSelectionMode}
                  onClick={() => handlePhotoClick(idx1, photo1.id)}
                  onDownload={(e) => onDownload(photo1, e)}
                  className=""
                  allowDownloads={allowDownloads}
                />
              )}
              {photo2 && (
                <MosaicPhoto
                  photo={photo2}
                  isSelected={selectedPhotos.has(photo2.id)}
                  isSelectionMode={isSelectionMode}
                  onClick={() => handlePhotoClick(idx2, photo2.id)}
                  onDownload={(e) => onDownload(photo2, e)}
                  className=""
                  allowDownloads={allowDownloads}
                />
              )}
            </div>
          </div>
        );
        photoIndex += 3;
      } else if (patternIndex % 3 === 1 && remainingPhotos >= 3) {
        // Pattern 2: 3 equal columns
        elements.push(
          <div key={`pattern-${photoIndex}`} className="grid grid-cols-3 gap-2 mb-2 h-[250px]">
            {[0, 1, 2].map(offset => {
              const currentIndex = photoIndex + offset;
              const photo = photos[currentIndex];
              return photo ? (
                <MosaicPhoto
                  key={photo.id}
                  photo={photo}
                  isSelected={selectedPhotos.has(photo.id)}
                  isSelectionMode={isSelectionMode}
                  onClick={() => handlePhotoClick(currentIndex, photo.id)}
                  onDownload={(e) => onDownload(photo, e)}
                  className=""
                  allowDownloads={allowDownloads}
                />
              ) : null;
            })}
          </div>
        );
        photoIndex += 3;
      } else if (patternIndex % 3 === 2 && remainingPhotos >= 3) {
        // Pattern 3: Large span-2 with 2 small on right
        // Capture indices immediately to avoid closure issues
        const idx0 = photoIndex;
        const idx1 = photoIndex + 1;
        const idx2 = photoIndex + 2;
        const photo0 = photos[idx0];
        const photo1 = photos[idx1];
        const photo2 = photos[idx2];
        
        elements.push(
          <div key={`pattern-${photoIndex}`} className="grid grid-cols-3 gap-2 mb-2 h-[400px]">
            {photo0 && (
              <MosaicPhoto
                photo={photo0}
                isSelected={selectedPhotos.has(photo0.id)}
                isSelectionMode={isSelectionMode}
                onClick={() => handlePhotoClick(idx0, photo0.id)}
                onDownload={(e) => onDownload(photo0, e)}
                className="col-span-2"
                allowDownloads={allowDownloads}
              />
            )}
            <div className="grid grid-rows-2 gap-2">
              {photo1 && (
                <MosaicPhoto
                  photo={photo1}
                  isSelected={selectedPhotos.has(photo1.id)}
                  isSelectionMode={isSelectionMode}
                  onClick={() => handlePhotoClick(idx1, photo1.id)}
                  onDownload={(e) => onDownload(photo1, e)}
                  className=""
                  allowDownloads={allowDownloads}
                />
              )}
              {photo2 && (
                <MosaicPhoto
                  photo={photo2}
                  isSelected={selectedPhotos.has(photo2.id)}
                  isSelectionMode={isSelectionMode}
                  onClick={() => handlePhotoClick(idx2, photo2.id)}
                  onDownload={(e) => onDownload(photo2, e)}
                  className=""
                  allowDownloads={allowDownloads}
                />
              )}
            </div>
          </div>
        );
        photoIndex += 3;
      } else {
        // Handle remaining photos that don't fit patterns
        break;
      }
      
      patternIndex++;
    }
    
    // Add remaining photos in a regular grid
    if (photoIndex < photos.length) {
      const remainingPhotos = photos.slice(photoIndex);
      elements.push(
        <div key={`remaining-${photoIndex}`} className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
          {remainingPhotos.map((photo, idx) => {
            const index = photoIndex + idx;
            return (
              <MosaicPhoto
                key={photo.id}
                photo={photo}
                isSelected={selectedPhotos.has(photo.id)}
                isSelectionMode={isSelectionMode}
                onClick={() => handlePhotoClick(index, photo.id)}
                onDownload={(e) => onDownload(photo, e)}
                className="aspect-square"
                allowDownloads={allowDownloads}
              />
            );
          })}
        </div>
      );
    }
    
    return elements;
  };
  
  return (
    <div className="w-full max-w-7xl mx-auto">
      {renderMosaicLayout()}
    </div>
  );
};