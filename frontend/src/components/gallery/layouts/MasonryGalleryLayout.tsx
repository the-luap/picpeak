import React, { useEffect, useRef, useState } from 'react';
import { Download, Maximize2, Check } from 'lucide-react';
import { useTheme } from '../../../contexts/ThemeContext';
import { AuthenticatedImage } from '../../common';
import type { BaseGalleryLayoutProps } from './BaseGalleryLayout';
import type { Photo } from '../../../types';

interface MasonryPhotoProps {
  photo: Photo;
  isSelected: boolean;
  isSelectionMode: boolean;
  onClick: (e: React.MouseEvent) => void;
  onDownload: (e: React.MouseEvent) => void;
  style?: React.CSSProperties;
}

const MasonryPhoto: React.FC<MasonryPhotoProps> = ({
  photo,
  isSelected,
  isSelectionMode,
  onClick,
  onDownload,
  style
}) => {
  const [imageHeight, setImageHeight] = useState<number>(200);

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
    </div>
  );
};

export const MasonryGalleryLayout: React.FC<BaseGalleryLayoutProps> = ({
  photos,
  onPhotoClick,
  onDownload,
  selectedPhotos = new Set(),
  isSelectionMode = false,
  onPhotoSelect
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
                onClick={() => {
                  if (isSelectionMode && onPhotoSelect) {
                    onPhotoSelect(photo.id);
                  } else {
                    onPhotoClick(originalIndex);
                  }
                }}
                onDownload={(e) => onDownload(photo, e)}
              />
            );
          })}
        </div>
      ))}
    </div>
  );
};