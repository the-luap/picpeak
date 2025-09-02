import React from 'react';
import { Heart, Star } from 'lucide-react';
import { Button } from '../common';
import { useTranslation } from 'react-i18next';

export type FilterType = 'all' | 'liked' | 'favorited';

interface GalleryFilterProps {
  currentFilter: FilterType;
  onFilterChange: (filter: FilterType) => void;
  feedbackEnabled: boolean;
  likeCount?: number;
  favoriteCount?: number;
  className?: string;
  isMobile?: boolean;
}

export const GalleryFilter: React.FC<GalleryFilterProps> = ({
  currentFilter,
  onFilterChange,
  feedbackEnabled,
  likeCount = 0,
  favoriteCount = 0,
  className = '',
  isMobile = false
}) => {
  const { t } = useTranslation();

  if (!feedbackEnabled) {
    return null;
  }

  return (
    <div className={`${className}`}>
      {/* Mobile-optimized vertical layout */}
      {isMobile ? (
        <div className="space-y-2">
          <div className="text-xs text-neutral-600 font-medium">
            {t('gallery.feedbackFilter', 'Feedback Filter')}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant={currentFilter === 'all' ? 'primary' : 'outline'}
              size="sm"
              onClick={() => onFilterChange('all')}
              className="text-xs flex-1 min-w-[80px]"
            >
              {t('gallery.all', 'All')}
            </Button>
            
            <Button
              variant={currentFilter === 'liked' ? 'primary' : 'outline'}
              size="sm"
              onClick={() => onFilterChange('liked')}
              className="text-xs flex-1 min-w-[80px] flex items-center justify-center gap-1"
            >
              <Heart className="w-3 h-3" />
              <span>{likeCount > 0 ? likeCount : t('gallery.liked', 'Liked')}</span>
            </Button>
            
            <Button
              variant={currentFilter === 'favorited' ? 'primary' : 'outline'}
              size="sm"
              onClick={() => onFilterChange('favorited')}
              className="text-xs flex-1 min-w-[80px] flex items-center justify-center gap-1"
            >
              <Star className="w-3 h-3" />
              <span>{favoriteCount > 0 ? favoriteCount : t('gallery.favorites', 'Favorites')}</span>
            </Button>
          </div>
        </div>
      ) : (
        /* Desktop layout - inline with categories */
        <div className="flex items-center gap-3">
          <span className="text-sm text-neutral-600 font-medium whitespace-nowrap">
            {t('gallery.feedbackFilter', 'Feedback Filter')}:
          </span>
          <div className="flex gap-2">
            <Button
              variant={currentFilter === 'all' ? 'primary' : 'outline'}
              size="sm"
              onClick={() => onFilterChange('all')}
              className="text-xs sm:text-sm"
            >
              {t('gallery.all', 'All')}
            </Button>
            
            <Button
              variant={currentFilter === 'liked' ? 'primary' : 'outline'}
              size="sm"
              onClick={() => onFilterChange('liked')}
              className="text-xs sm:text-sm flex items-center gap-1"
            >
              <Heart className="w-3 h-3 sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">{t('gallery.liked', 'Liked')}</span>
              {likeCount > 0 && (
                <span className="bg-primary-100 text-primary-700 px-1.5 rounded">
                  {likeCount}
                </span>
              )}
            </Button>
            
            <Button
              variant={currentFilter === 'favorited' ? 'primary' : 'outline'}
              size="sm"
              onClick={() => onFilterChange('favorited')}
              className="text-xs sm:text-sm flex items-center gap-1"
            >
              <Star className="w-3 h-3 sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">{t('gallery.favorited', 'Favorites')}</span>
              {favoriteCount > 0 && (
                <span className="bg-primary-100 text-primary-700 px-1.5 rounded">
                  {favoriteCount}
                </span>
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};