import React, { useMemo } from 'react';
import { Download, Maximize2, Check, Calendar } from 'lucide-react';
import { format, parseISO, startOfDay, startOfWeek, startOfMonth } from 'date-fns';
import { useTheme } from '../../../contexts/ThemeContext';
import { AuthenticatedImage } from '../../common';
import type { BaseGalleryLayoutProps } from './BaseGalleryLayout';
import type { Photo } from '../../../types';

export const TimelineGalleryLayout: React.FC<BaseGalleryLayoutProps> = ({
  photos,
  onPhotoClick,
  onDownload,
  selectedPhotos = new Set(),
  isSelectionMode = false,
  onPhotoSelect,
  allowDownloads = true
}) => {
  const { theme } = useTheme();
  const gallerySettings = theme.gallerySettings || {};
  const grouping = gallerySettings.timelineGrouping || 'day';
  const showDates = gallerySettings.timelineShowDates !== false;

  // Group photos by date
  const groupedPhotos = useMemo(() => {
    const groups = new Map<string, Photo[]>();
    
    photos.forEach(photo => {
      const date = parseISO(photo.uploaded_at);
      let groupKey: string;
      
      switch (grouping) {
        case 'week':
          const weekStart = startOfWeek(date);
          groupKey = format(weekStart, 'yyyy-MM-dd');
          // groupLabel = `Week of ${format(weekStart, 'MMM d, yyyy')}`;
          break;
        case 'month':
          const monthStart = startOfMonth(date);
          groupKey = format(monthStart, 'yyyy-MM');
          // groupLabel = format(monthStart, 'MMMM yyyy');
          break;
        default: // day
          const dayStart = startOfDay(date);
          groupKey = format(dayStart, 'yyyy-MM-dd');
          // groupLabel = format(dayStart, 'EEEE, MMMM d, yyyy');
      }
      
      if (!groups.has(groupKey)) {
        groups.set(groupKey, []);
      }
      groups.get(groupKey)!.push(photo);
    });
    
    // Convert to array and sort by date
    return Array.from(groups.entries())
      .map(([date, photos]) => ({
        date,
        label: photos[0] ? format(parseISO(photos[0].uploaded_at), grouping === 'month' ? 'MMMM yyyy' : grouping === 'week' ? "'Week of' MMM d, yyyy" : 'EEEE, MMMM d, yyyy') : date,
        photos: photos.sort((a, b) => new Date(b.uploaded_at).getTime() - new Date(a.uploaded_at).getTime())
      }))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [photos, grouping]);

  return (
    <div className="relative">
      {/* Timeline line */}
      <div className="absolute left-8 top-0 bottom-0 w-0.5 bg-neutral-300 hidden lg:block" />
      
      {/* Timeline groups */}
      <div className="space-y-12">
        {groupedPhotos.map((group) => (
          <div key={group.date} className="relative">
            {/* Date marker */}
            {showDates && (
              <div className="flex items-center gap-4 mb-6">
                <div className="hidden lg:flex items-center justify-center w-16 h-16 bg-white border-4 border-primary-600 rounded-full z-10">
                  <Calendar className="w-6 h-6 text-primary-600" />
                </div>
                <h3 className="text-xl font-semibold text-neutral-800">
                  {group.label}
                </h3>
              </div>
            )}
            
            {/* Photos grid for this date */}
            <div className="lg:ml-24 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {group.photos.map((photo) => {
                const actualIndex = photos.findIndex(p => p.id === photo.id);
                return (
                  <div
                    key={photo.id}
                    className="relative group cursor-pointer aspect-square"
                    onClick={() => onPhotoClick(actualIndex)}
                  >
                    <AuthenticatedImage
                      src={photo.thumbnail_url || photo.url}
                      alt={photo.filename}
                      className="w-full h-full object-cover rounded-lg"
                      loading="lazy"
                      isGallery={true}
                      protectFromDownload={!allowDownloads}
                    />
                    
                    {/* Time label */}
                    <div className="absolute bottom-2 left-2 px-2 py-1 bg-black/60 text-white text-xs rounded">
                      {format(parseISO(photo.uploaded_at), 'h:mm a')}
                    </div>
                    
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-200 rounded-lg flex items-center justify-center gap-2">
                      {!isSelectionMode && (
                        <>
                          <button
                            className="p-2 bg-white/90 rounded-full hover:bg-white transition-colors"
                            onClick={(e) => {
                              e.stopPropagation();
                              onPhotoClick(actualIndex);
                            }}
                            aria-label="View full size"
                          >
                            <Maximize2 className="w-5 h-5 text-neutral-800" />
                          </button>
                          {allowDownloads && (
                            <button
                              className="p-2 bg-white/90 rounded-full hover:bg-white transition-colors"
                              onClick={(e) => {
                                e.stopPropagation();
                                onDownload(photo, e);
                              }}
                              aria-label="Download photo"
                            >
                              <Download className="w-5 h-5 text-neutral-800" />
                            </button>
                          )}
                        </>
                      )}
                    </div>

                    {/* Selection Checkbox (visible on hover or when selected) */}
                    <button
                      type="button"
                      aria-label={`Select ${photo.filename}`}
                      role="checkbox"
                      aria-checked={selectedPhotos.has(photo.id)}
                      data-testid={`gallery-photo-checkbox-${photo.id}`}
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
          </div>
        ))}
      </div>
    </div>
  );
};
