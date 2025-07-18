import React from 'react';
import { Download, Maximize2, Check } from 'lucide-react';
import { useInView } from 'react-intersection-observer';
import { useTheme } from '../../../contexts/ThemeContext';
import { AuthenticatedImage } from '../../common';
import type { BaseGalleryLayoutProps } from './BaseGalleryLayout';
import type { Photo } from '../../../types';

interface GridPhotoProps {
  photo: Photo;
  isSelected: boolean;
  isSelectionMode: boolean;
  onClick: (e: React.MouseEvent) => void;
  onDownload: (e: React.MouseEvent) => void;
  animationType?: string;
}

const GridPhoto: React.FC<GridPhotoProps> = ({
  photo,
  isSelected,
  isSelectionMode,
  onClick,
  onDownload,
  animationType = 'fade'
}) => {
  const { ref, inView } = useInView({
    triggerOnce: true,
    threshold: 0.1,
  });

  const animationClass = animationType === 'scale' 
    ? 'transition-transform duration-300 hover:scale-105' 
    : animationType === 'fade'
    ? 'transition-opacity duration-300'
    : '';

  return (
    <div
      ref={ref}
      className={`relative group cursor-pointer aspect-square ${animationClass}`}
      onClick={onClick}
      style={{
        opacity: !inView && animationType === 'fade' ? 0 : 1
      }}
    >
      {inView ? (
        <>
          <AuthenticatedImage
            src={photo.thumbnail_url || photo.url}
            alt={photo.filename}
            className="w-full h-full object-cover rounded-lg"
            loading="lazy"
            isGallery={true}
          />
          
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
                <button
                  className="p-2 bg-white/90 rounded-full hover:bg-white transition-colors"
                  onClick={onDownload}
                  aria-label="Download photo"
                >
                  <Download className="w-5 h-5 text-neutral-800" />
                </button>
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
        </>
      ) : (
        <div className="skeleton aspect-square w-full rounded-lg" />
      )}
    </div>
  );
};

export const GridGalleryLayout: React.FC<BaseGalleryLayoutProps> = ({
  photos,
  onPhotoClick,
  onDownload,
  selectedPhotos = new Set(),
  isSelectionMode = false,
  onPhotoSelect
}) => {
  const { theme } = useTheme();
  const gallerySettings = theme.gallerySettings || {};
  const columns = gallerySettings.gridColumns || { mobile: 2, tablet: 3, desktop: 4 };
  const spacing = gallerySettings.spacing || 'normal';
  const animation = gallerySettings.photoAnimation || 'fade';

  const spacingClass = spacing === 'tight' ? 'gap-2' : spacing === 'relaxed' ? 'gap-6' : 'gap-4';
  
  const gridClass = `grid ${spacingClass} 
    grid-cols-${columns.mobile} 
    sm:grid-cols-${columns.tablet} 
    lg:grid-cols-${columns.desktop} 
    xl:grid-cols-${columns.desktop + 1}`;

  return (
    <div className={gridClass}>
      {photos.map((photo, index) => (
        <GridPhoto
          key={photo.id}
          photo={photo}
          isSelected={selectedPhotos.has(photo.id)}
          isSelectionMode={isSelectionMode}
          onClick={() => {
            if (isSelectionMode && onPhotoSelect) {
              onPhotoSelect(photo.id);
            } else {
              onPhotoClick(index);
            }
          }}
          onDownload={(e) => onDownload(photo, e)}
          animationType={animation}
        />
      ))}
    </div>
  );
};