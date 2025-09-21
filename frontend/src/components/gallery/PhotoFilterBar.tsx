import React, { useState } from 'react';
import { Search, SortAsc, Grid, Heart, Star, MessageSquare, Bookmark } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button, Input } from '../common';
import type { FilterType } from './GalleryFilter';

interface PhotoCategory {
  id: number;
  name: string;
  slug: string;
  is_global: boolean;
}

interface Photo {
  id: number;
  category_id?: number;
  like_count?: number;
  favorite_count?: number;
}

interface PhotoFilterBarProps {
  categories?: PhotoCategory[];
  photos: Photo[];
  selectedCategoryId: number | null;
  onCategoryChange: (categoryId: number | null) => void;
  searchTerm: string;
  onSearchChange: (term: string) => void;
  sortBy: 'date' | 'name' | 'size' | 'rating';
  onSortChange: (sort: 'date' | 'name' | 'size' | 'rating') => void;
  photoCount: number;
  // Feedback filter props
  feedbackEnabled?: boolean;
  currentFilter?: FilterType;
  onFilterChange?: (filter: FilterType) => void;
}

export const PhotoFilterBar: React.FC<PhotoFilterBarProps> = ({
  categories = [],
  photos,
  selectedCategoryId,
  onCategoryChange,
  searchTerm,
  onSearchChange,
  sortBy,
  onSortChange,
  photoCount,
  feedbackEnabled = false,
  currentFilter = 'all',
  onFilterChange,
}) => {
  const { t } = useTranslation();
  const [showSortMenu, setShowSortMenu] = useState(false);
  return (
    <div className="space-y-4">
      {/* Search and Sort */}
      <div className="flex flex-col md:flex-row gap-3 md:gap-4">
        {/* Search Bar */}
        <div className="flex-1">
          <Input
            type="text"
            placeholder={t('gallery.searchPhotos')}
            leftIcon={<Search className="w-5 h-5 text-neutral-400" />}
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            className="text-sm md:text-base"
          />
        </div>
        
        {/* Sort Dropdown */}
        <div className="relative">
          <Button
            variant="outline"
            size="md"
            leftIcon={<SortAsc className="w-4 h-4" />}
            onClick={() => setShowSortMenu(!showSortMenu)}
            className="w-full md:w-auto text-sm md:text-base"
          >
            <span className="hidden md:inline">{t('common.sortBy')} </span>
            {sortBy === 'date' ? t('gallery.sortByDate').replace('Sort by ', '') : 
             sortBy === 'name' ? t('gallery.sortByName').replace('Sort by ', '') : 
             sortBy === 'size' ? t('gallery.sortBySize').replace('Sort by ', '') :
             t('gallery.sortByRating', 'Rating')}
          </Button>
          
          {showSortMenu && (
            <div className="absolute right-0 md:right-auto md:left-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-neutral-200 py-1 z-10">
              <button
                onClick={() => {
                  onSortChange('date');
                  setShowSortMenu(false);
                }}
                className={`w-full text-left px-4 py-2 text-sm hover:bg-neutral-50 ${
                  sortBy === 'date' ? 'text-primary-600 bg-primary-50' : 'text-neutral-700'
                }`}
              >
                {t('gallery.sortByDate')}
              </button>
              <button
                onClick={() => {
                  onSortChange('name');
                  setShowSortMenu(false);
                }}
                className={`w-full text-left px-4 py-2 text-sm hover:bg-neutral-50 ${
                  sortBy === 'name' ? 'text-primary-600 bg-primary-50' : 'text-neutral-700'
                }`}
              >
                {t('gallery.sortByName')}
              </button>
              <button
                onClick={() => {
                  onSortChange('size');
                  setShowSortMenu(false);
                }}
                className={`w-full text-left px-4 py-2 text-sm hover:bg-neutral-50 ${
                  sortBy === 'size' ? 'text-primary-600 bg-primary-50' : 'text-neutral-700'
                }`}
              >
                {t('gallery.sortBySize')}
              </button>
              <button
                onClick={() => {
                  onSortChange('rating');
                  setShowSortMenu(false);
                }}
                className={`w-full text-left px-4 py-2 text-sm hover:bg-neutral-50 ${
                  sortBy === 'rating' ? 'text-primary-600 bg-primary-50' : 'text-neutral-700'
                }`}
              >
                {t('gallery.sortByRating', 'Sort by Rating')}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Category and Feedback Filters */}
      <div className="space-y-3">
        {/* Categories Row */}
        {categories && categories.length > 0 && (
          <div className="flex items-start lg:items-center justify-between flex-col lg:flex-row gap-3">
            {/* Categories: keep in a horizontal scroll container */}
            <div className="w-full overflow-x-auto pb-2 lg:pb-0">
              <div className="flex items-center gap-2 min-w-max">
                <Button
                  variant={selectedCategoryId === null ? 'primary' : 'outline'}
                  size="sm"
                  onClick={() => onCategoryChange(null)}
                  leftIcon={<Grid className="w-3 h-3 md:w-4 md:h-4" />}
                  className="text-xs md:text-sm whitespace-nowrap flex-shrink-0"
                >
                  {t('gallery.allPhotos')} ({photos.length})
                </Button>
                {categories.map((category) => {
                  const categoryPhotoCount = photos.filter(p => p.category_id === category.id).length;
                  if (categoryPhotoCount === 0) return null;
                  
                  return (
                    <Button
                      key={category.id}
                      variant={selectedCategoryId === category.id ? 'primary' : 'outline'}
                      size="sm"
                      onClick={() => onCategoryChange(category.id)}
                      className="text-xs md:text-sm whitespace-nowrap flex-shrink-0"
                    >
                      {category.name} ({categoryPhotoCount})
                    </Button>
                  );
                })}
              </div>
            </div>

            {/* Desktop: compact horizontal feedback filter with headline (icons only) */}
            {feedbackEnabled && onFilterChange && (
              <div className="hidden lg:flex items-center gap-2 mx-2 flex-shrink-0">
                <span className="text-sm text-neutral-600 whitespace-nowrap">
                  {t('gallery.feedbackFilter', 'Feedback Filter')}
                </span>
                <div className="flex items-center gap-1">
                  <Button
                    variant={currentFilter === 'all' ? 'primary' : 'outline'}
                    size="sm"
                    onClick={() => onFilterChange('all')}
                    className="p-1 w-8 h-8 flex items-center justify-center"
                    aria-label={t('gallery.all', 'All')}
                  >
                    <Grid className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    variant={currentFilter === 'liked' ? 'primary' : 'outline'}
                    size="sm"
                    onClick={() => onFilterChange('liked')}
                    className="p-1 w-8 h-8 flex items-center justify-center"
                    aria-label={t('feedback.likes', 'Likes')}
                  >
                    <Heart className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    variant={currentFilter === 'favorited' ? 'primary' : 'outline'}
                    size="sm"
                    onClick={() => onFilterChange('favorited')}
                    className="p-1 w-8 h-8 flex items-center justify-center"
                    aria-label={t('gallery.favorited', 'Saved')}
                  >
                    <Bookmark className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    variant={currentFilter === 'rated' ? 'primary' : 'outline'}
                    size="sm"
                    onClick={() => onFilterChange('rated')}
                    className="p-1 w-8 h-8 flex items-center justify-center"
                    aria-label={t('gallery.rated', 'Rated')}
                  >
                    <Star className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    variant={currentFilter === 'commented' ? 'primary' : 'outline'}
                    size="sm"
                    onClick={() => onFilterChange('commented')}
                    className="p-1 w-8 h-8 flex items-center justify-center"
                    aria-label={t('gallery.commented', 'Commented')}
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            )}

            <p className="text-xs md:text-sm text-neutral-600 flex-shrink-0 ml-auto">
              {photoCount} {photoCount === 1 ? t('common.photo') : t('common.photos')}
            </p>
          </div>
        )}
        
        {/* Mobile/Tablet: compact horizontal icons with headline below categories */}
        {feedbackEnabled && onFilterChange && (
          <div className="flex lg:hidden items-center gap-2">
            <span className="text-xs text-neutral-600 whitespace-nowrap">
              {t('gallery.feedbackFilter', 'Feedback Filter')}
            </span>
            <div className="flex items-center gap-1">
              <Button
                variant={currentFilter === 'all' ? 'primary' : 'outline'}
                size="sm"
                onClick={() => onFilterChange('all')}
                className="p-1 w-8 h-8 flex items-center justify-center"
                aria-label={t('gallery.all', 'All')}
              >
                <Grid className="w-3.5 h-3.5" />
              </Button>
              <Button
                variant={currentFilter === 'liked' ? 'primary' : 'outline'}
                size="sm"
                onClick={() => onFilterChange('liked')}
                className="p-1 w-8 h-8 flex items-center justify-center"
                aria-label={t('feedback.likes', 'Likes')}
              >
                <Heart className="w-3.5 h-3.5" />
              </Button>
              <Button
                variant={currentFilter === 'favorited' ? 'primary' : 'outline'}
                size="sm"
                onClick={() => onFilterChange('favorited')}
                className="p-1 w-8 h-8 flex items-center justify-center"
                aria-label={t('gallery.favorited', 'Saved')}
              >
                <Bookmark className="w-3.5 h-3.5" />
              </Button>
              <Button
                variant={currentFilter === 'rated' ? 'primary' : 'outline'}
                size="sm"
                onClick={() => onFilterChange('rated')}
                className="p-1 w-8 h-8 flex items-center justify-center"
                aria-label={t('gallery.rated', 'Rated')}
              >
                <Star className="w-3.5 h-3.5" />
              </Button>
              <Button
                variant={currentFilter === 'commented' ? 'primary' : 'outline'}
                size="sm"
                onClick={() => onFilterChange('commented')}
                className="p-1 w-8 h-8 flex items-center justify-center"
                aria-label={t('gallery.commented', 'Commented')}
              >
                <MessageSquare className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

PhotoFilterBar.displayName = 'PhotoFilterBar';
