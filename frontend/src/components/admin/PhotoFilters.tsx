import React from 'react';
import { Search, Filter, SortAsc, SortDesc } from 'lucide-react';
import { Input } from '../common';

interface PhotoFiltersProps {
  categories: Array<{ id: number; name: string; slug: string }>;
  selectedCategory: number | null | undefined;
  searchTerm: string;
  sortBy: 'date' | 'name' | 'size' | 'rating';
  sortOrder: 'asc' | 'desc';
  onCategoryChange: (categoryId: number | null | undefined) => void;
  onSearchChange: (search: string) => void;
  onSortChange: (sort: 'date' | 'name' | 'size' | 'rating', order: 'asc' | 'desc') => void;
}

export const PhotoFilters: React.FC<PhotoFiltersProps> = ({
  categories,
  selectedCategory,
  searchTerm,
  sortBy,
  sortOrder,
  onCategoryChange,
  onSearchChange,
  onSortChange
}) => {
  const handleSortToggle = () => {
    onSortChange(sortBy, sortOrder === 'asc' ? 'desc' : 'asc');
  };

  return (
    <div className="bg-white border border-neutral-200 rounded-lg p-4 mb-6">
      <div className="flex flex-col lg:flex-row gap-4">
        {/* Search */}
        <div className="flex-1">
          <Input
            type="text"
            placeholder="Search by filename..."
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            leftIcon={<Search className="w-5 h-5 text-neutral-400" />}
          />
        </div>

        {/* Category Filter */}
        <div className="flex items-center gap-2">
          <Filter className="w-5 h-5 text-neutral-400" />
          <select
            value={selectedCategory === null ? '' : selectedCategory || ''}
            onChange={(e) => onCategoryChange(e.target.value === '' ? null : Number(e.target.value) || undefined)}
            className="px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          >
            <option value="">All Categories</option>
            <option value="0">Uncategorized</option>
            {categories.map(cat => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>
        </div>

        {/* Sort Options */}
        <div className="flex items-center gap-2">
          <select
            value={sortBy}
            onChange={(e) => onSortChange(e.target.value as 'date' | 'name' | 'size' | 'rating', sortOrder)}
            className="px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          >
            <option value="date">Sort by Date</option>
            <option value="name">Sort by Name</option>
            <option value="size">Sort by Size</option>
            <option value="rating">Sort by Rating</option>
          </select>
          
          <button
            onClick={handleSortToggle}
            className="p-2 border border-neutral-300 rounded-lg hover:bg-neutral-50 transition-colors"
            aria-label={sortOrder === 'asc' ? 'Sort descending' : 'Sort ascending'}
          >
            {sortOrder === 'asc' ? (
              <SortAsc className="w-5 h-5 text-neutral-600" />
            ) : (
              <SortDesc className="w-5 h-5 text-neutral-600" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
};