import React, { useState } from 'react';
import { Search, SortAsc, Grid } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button, Input } from '../common';

interface PhotoCategory {
  id: number;
  name: string;
  slug: string;
  is_global: boolean;
}

interface Photo {
  id: number;
  category_id?: number;
}

interface PhotoFilterBarProps {
  categories?: PhotoCategory[];
  photos: Photo[];
  selectedCategoryId: number | null;
  onCategoryChange: (categoryId: number | null) => void;
  searchTerm: string;
  onSearchChange: (term: string) => void;
  sortBy: 'date' | 'name' | 'size';
  onSortChange: (sort: 'date' | 'name' | 'size') => void;
  photoCount: number;
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
}) => {
  const { t } = useTranslation();
  const [showSortMenu, setShowSortMenu] = useState(false);

  return (
    <div className="space-y-4">
      {/* Search and Sort */}
      <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
        {/* Search Bar */}
        <div className="flex-1">
          <Input
            type="text"
            placeholder={t('gallery.searchPhotos')}
            leftIcon={<Search className="w-5 h-5 text-neutral-400" />}
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            className="text-sm sm:text-base"
          />
        </div>
        
        {/* Sort Dropdown */}
        <div className="relative">
          <Button
            variant="outline"
            size="md"
            leftIcon={<SortAsc className="w-4 h-4" />}
            onClick={() => setShowSortMenu(!showSortMenu)}
            className="w-full sm:w-auto text-sm sm:text-base"
          >
            <span className="hidden sm:inline">{t('common.sortBy')} </span>
            {sortBy === 'date' ? t('gallery.sortByDate').replace('Sort by ', '') : sortBy === 'name' ? t('gallery.sortByName').replace('Sort by ', '') : t('gallery.sortBySize').replace('Sort by ', '')}
          </Button>
          
          {showSortMenu && (
            <div className="absolute right-0 sm:right-auto sm:left-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-neutral-200 py-1 z-10">
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
            </div>
          )}
        </div>
      </div>

      {/* Category Filter */}
      {categories && categories.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-start sm:items-center justify-between flex-col sm:flex-row gap-3">
            <div className="w-full sm:w-auto overflow-x-auto pb-2 sm:pb-0">
              <div className="flex items-center gap-2 min-w-max">
                <Button
                  variant={selectedCategoryId === null ? 'primary' : 'outline'}
                  size="sm"
                  onClick={() => onCategoryChange(null)}
                  leftIcon={<Grid className="w-3 h-3 sm:w-4 sm:h-4" />}
                  className="text-xs sm:text-sm whitespace-nowrap"
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
                      className="text-xs sm:text-sm whitespace-nowrap"
                    >
                      {category.name} ({categoryPhotoCount})
                    </Button>
                  );
                })}
              </div>
            </div>

            <p className="text-xs sm:text-sm text-neutral-600 flex-shrink-0">
              {photoCount} {photoCount === 1 ? t('common.photo') : t('common.photos')}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

PhotoFilterBar.displayName = 'PhotoFilterBar';