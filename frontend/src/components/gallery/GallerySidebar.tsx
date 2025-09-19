import React, { useEffect, useRef } from 'react';
import { X, Download, Filter, SortAsc, Search, Calendar, Type, HardDrive, Check, Upload, Star } from 'lucide-react';
import { Button } from '../common';
import { PhotoCategory } from '../../types';
import { useTranslation } from 'react-i18next';
import { GalleryFilter, type FilterType } from './GalleryFilter';

interface GallerySidebarProps {
  isOpen: boolean;
  onClose: () => void;
  categories: PhotoCategory[];
  selectedCategoryId: number | null;
  onCategoryChange: (categoryId: number | null) => void;
  searchTerm: string;
  onSearchChange: (term: string) => void;
  sortBy: 'date' | 'name' | 'size' | 'rating';
  onSortChange: (sort: 'date' | 'name' | 'size' | 'rating') => void;
  isSelectionMode: boolean;
  onToggleSelectionMode: () => void;
  selectedCount: number;
  onDownloadAll: () => void;
  onDownloadSelected: () => void;
  isDownloading: boolean;
  allowDownloads?: boolean;
  photoCounts?: Record<number, number>;
  totalPhotos: number;
  isMobile: boolean;
  galleryLayout?: string;
  allowUploads?: boolean;
  onUploadClick?: () => void;
  feedbackEnabled?: boolean;
  filterType?: FilterType;
  onFilterChange?: (filter: FilterType) => void;
  likeCount?: number;
  ratedCount?: number;
}

export const GallerySidebar: React.FC<GallerySidebarProps> = ({
  isOpen,
  onClose,
  categories,
  selectedCategoryId,
  onCategoryChange,
  searchTerm,
  onSearchChange,
  sortBy,
  onSortChange,
  isSelectionMode,
  onToggleSelectionMode,
  selectedCount,
  onDownloadAll,
  onDownloadSelected,
  isDownloading,
  allowDownloads = true,
  photoCounts = {},
  totalPhotos,
  isMobile,
  galleryLayout,
  allowUploads,
  onUploadClick,
  feedbackEnabled = false,
  filterType = 'all',
  onFilterChange,
  likeCount = 0,
  ratedCount = 0
}) => {
  const { t } = useTranslation();
  const sidebarRef = useRef<HTMLDivElement>(null);

  // Close sidebar when clicking outside on mobile
  useEffect(() => {
    if (isMobile && isOpen) {
      const handleClickOutside = (event: MouseEvent) => {
        if (sidebarRef.current && !sidebarRef.current.contains(event.target as Node)) {
          onClose();
        }
      };

      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isMobile, isOpen, onClose]);

  // Prevent body scroll when sidebar is open on mobile
  useEffect(() => {
    if (isMobile && isOpen) {
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = 'unset';
      };
    }
  }, [isMobile, isOpen]);

  const sortOptions = [
    { value: 'date', label: t('gallery.sortByDate'), icon: Calendar },
    { value: 'name', label: t('gallery.sortByName'), icon: Type },
    { value: 'size', label: t('gallery.sortBySize'), icon: HardDrive },
    { value: 'rating', label: t('gallery.sortByRating', 'Rating'), icon: Star }
  ];

  return (
    <>
      {/* Backdrop for mobile */}
      {isMobile && isOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40 transition-opacity"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <div
        ref={sidebarRef}
        className={`
          fixed top-0 left-0 h-full bg-white shadow-xl z-50 transition-transform duration-300 ease-in-out flex flex-col
          ${isMobile ? 'w-full max-w-sm' : 'w-80'}
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-neutral-200">
          <h2 className="text-lg font-semibold text-neutral-900">{t('gallery.filters')}</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-neutral-100 rounded-lg transition-colors"
            aria-label={t('common.close')}
          >
            <X className="w-5 h-5 text-neutral-600" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {/* Upload Section - Only show on mobile when uploads are allowed */}
          {isMobile && allowUploads && onUploadClick && (
            <div className="p-4 border-b border-neutral-200">
              <Button
                variant="outline"
                size="sm"
                leftIcon={<Upload className="w-4 h-4" />}
                onClick={() => {
                  onUploadClick();
                  onClose();
                }}
                className="w-full"
              >
                {t('upload.uploadPhotos')}
              </Button>
            </div>
          )}

          {/* Search Section - Hidden for carousel layout */}
          {galleryLayout !== 'carousel' && (
            <div className="p-4 border-b border-neutral-200">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-neutral-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => onSearchChange(e.target.value)}
                  placeholder={t('gallery.searchPlaceholder')}
                  className="w-full pl-10 pr-4 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
            </div>
          )}

          {/* Download Section - Hidden if gallery is expired or downloads disabled */}
          {allowDownloads && (
            <div className="p-4 border-b border-neutral-200">
              <h3 className="text-sm font-semibold text-neutral-700 mb-3 flex items-center gap-2">
                <Download className="w-4 h-4" />
                {t('gallery.download')}
              </h3>
              
              <div className="space-y-2">
                <Button
                  variant="primary"
                  size="sm"
                  leftIcon={<Download className="w-4 h-4" />}
                  onClick={onDownloadAll}
                  disabled={isDownloading || totalPhotos === 0}
                  className="w-full"
                >
                  {t('gallery.downloadAll')} ({totalPhotos})
                </Button>

                <Button
                  variant={isSelectionMode ? 'secondary' : 'outline'}
                  size="sm"
                  onClick={onToggleSelectionMode}
                  className="w-full"
                >
                  {isSelectionMode ? t('gallery.cancelSelection') : t('gallery.selectPhotos')}
                </Button>

                {isSelectionMode && selectedCount > 0 && (
                  <Button
                    variant="primary"
                    size="sm"
                    leftIcon={<Download className="w-4 h-4" />}
                    onClick={onDownloadSelected}
                    disabled={isDownloading}
                    className="w-full"
                  >
                    {t('gallery.downloadSelected', { count: selectedCount })} ({selectedCount})
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* Feedback Filter Section */}
          {feedbackEnabled && onFilterChange && (
            <div className="p-4 border-b border-neutral-200">
              <GalleryFilter
                currentFilter={filterType}
                onFilterChange={(filter) => {
                  onFilterChange(filter);
                  if (isMobile) onClose();
                }}
                feedbackEnabled={feedbackEnabled}
                likeCount={likeCount}
                ratedCount={ratedCount}
                className="w-full"
                variant="compact"
              />
            </div>
          )}

          {/* Categories Section - Hidden for carousel layout */}
          {galleryLayout !== 'carousel' && categories.length > 0 && (
            <div className="p-4 border-b border-neutral-200">
              <h3 className="text-sm font-semibold text-neutral-700 mb-3 flex items-center gap-2">
                <Filter className="w-4 h-4" />
                {t('gallery.categories')}
              </h3>
              
              <div className="space-y-1">
                <button
                  onClick={() => {
                    onCategoryChange(null);
                    if (isMobile) onClose();
                  }}
                  className={`
                    w-full text-left px-3 py-2 rounded-lg transition-colors flex items-center justify-between
                    ${selectedCategoryId === null
                      ? 'bg-primary-50 text-primary-700'
                      : 'hover:bg-neutral-50 text-neutral-700'
                    }
                  `}
                >
                  <span>{t('gallery.allCategories')}</span>
                  <span className="text-sm text-neutral-500">{totalPhotos}</span>
                </button>

                {categories.map((category) => {
                  const count = photoCounts[category.id] || 0;
                  const isSelected = selectedCategoryId === category.id;
                  
                  return (
                    <button
                      key={category.id}
                      onClick={() => {
                        onCategoryChange(category.id);
                        if (isMobile) onClose();
                      }}
                      className={`
                        w-full text-left px-3 py-2 rounded-lg transition-colors flex items-center justify-between
                        ${isSelected
                          ? 'bg-primary-50 text-primary-700'
                          : 'hover:bg-neutral-50 text-neutral-700'
                        }
                      `}
                    >
                      <span className="flex items-center gap-2">
                        {isSelected && <Check className="w-4 h-4" />}
                        {category.name}
                      </span>
                      <span className="text-sm text-neutral-500">{count}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Sort Section - Hidden for carousel and timeline layouts */}
          {galleryLayout !== 'carousel' && galleryLayout !== 'timeline' && (
            <div className="p-4">
              <h3 className="text-sm font-semibold text-neutral-700 mb-3 flex items-center gap-2">
                <SortAsc className="w-4 h-4" />
                {t('gallery.sortBy')}
              </h3>
              
              <div className="space-y-1">
                {sortOptions.map((option) => {
                  const Icon = option.icon;
                  const isSelected = sortBy === option.value;
                  
                  return (
                    <button
                      key={option.value}
                      onClick={() => {
                        onSortChange(option.value as 'date' | 'name' | 'size' | 'rating');
                        if (isMobile) onClose();
                      }}
                      className={`
                        w-full text-left px-3 py-2 rounded-lg transition-colors flex items-center gap-3
                        ${isSelected
                          ? 'bg-primary-50 text-primary-700'
                          : 'hover:bg-neutral-50 text-neutral-700'
                        }
                      `}
                    >
                      <Icon className="w-4 h-4" />
                      <span>{option.label}</span>
                      {isSelected && <Check className="w-4 h-4 ml-auto" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

    </>
  );
};
