import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, X, Loader2 } from 'lucide-react';
import { toast } from 'react-toastify';
import { categoriesService, type PhotoCategory } from '../../services/categories.service';
import { Button } from '../common';
import { useTranslation } from 'react-i18next';

interface EventCategoryManagerProps {
  eventId: number;
}

export const EventCategoryManager: React.FC<EventCategoryManagerProps> = ({ eventId }) => {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const [isAdding, setIsAdding] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');

  // Fetch categories for this event
  const { data: categories = [], isLoading } = useQuery({
    queryKey: ['event-categories', eventId],
    queryFn: () => categoriesService.getEventCategories(eventId),
  });

  // Filter to show only event-specific categories
  const eventCategories = categories.filter(cat => !cat.is_global);

  // Create category mutation
  const createMutation = useMutation({
    mutationFn: (name: string) => 
      categoriesService.createCategory({ 
        name, 
        is_global: false,
        event_id: eventId 
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['event-categories', eventId] });
      toast.success(t('categories.categoryCreatedSuccess'));
      setNewCategoryName('');
      setIsAdding(false);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || t('categories.failedToCreateCategory'));
    },
  });

  // Delete category mutation
  const deleteMutation = useMutation({
    mutationFn: categoriesService.deleteCategory,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['event-categories', eventId] });
      toast.success(t('categories.categoryDeletedSuccess'));
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || t('categories.failedToDeleteCategory'));
    },
  });

  const handleCreate = () => {
    if (newCategoryName.trim()) {
      createMutation.mutate(newCategoryName.trim());
    }
  };

  const handleDelete = (category: PhotoCategory) => {
    if (window.confirm(t('categories.deleteConfirm', { name: category.name }))) {
      deleteMutation.mutate(category.id);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-4">
        <Loader2 className="w-5 h-5 animate-spin text-primary-600" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <h3 className="text-sm font-medium text-neutral-700">{t('categories.eventSpecificCategories')}</h3>
        {!isAdding && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsAdding(true)}
            leftIcon={<Plus className="w-3 h-3" />}
          >
            {t('common.add')}
          </Button>
        )}
      </div>

      {/* Add new category form */}
      {isAdding && (
        <div className="flex gap-2">
          <input
            type="text"
            value={newCategoryName}
            onChange={(e) => setNewCategoryName(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleCreate()}
            placeholder={t('categories.categoryName')}
            className="flex-1 px-3 py-1.5 text-sm border border-neutral-300 rounded-md focus:ring-2 focus:ring-primary-500"
            autoFocus
          />
          <Button
            variant="primary"
            size="sm"
            onClick={handleCreate}
            disabled={!newCategoryName.trim() || createMutation.isPending}
          >
            {createMutation.isPending ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              t('common.add')
            )}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setIsAdding(false);
              setNewCategoryName('');
            }}
          >
            {t('common.cancel')}
          </Button>
        </div>
      )}

      {/* Event categories list */}
      {eventCategories.length === 0 ? (
        <p className="text-sm text-neutral-500 italic">
          {t('categories.noEventSpecificCategories')}
        </p>
      ) : (
        <div className="space-y-1">
          {eventCategories.map((category) => (
            <div
              key={category.id}
              className="flex items-center justify-between px-3 py-2 bg-neutral-50 rounded-md"
            >
              <span className="text-sm text-neutral-700">{category.name}</span>
              <button
                onClick={() => handleDelete(category)}
                className="p-1 text-neutral-400 hover:text-red-600 transition-colors"
                title={t('categories.deleteCategoryTitle')}
                disabled={deleteMutation.isPending}
              >
                {deleteMutation.isPending ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <X className="w-3 h-3" />
                )}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Show available global categories */}
      <div className="mt-4 pt-3 border-t border-neutral-200">
        <p className="text-xs font-medium text-neutral-500 mb-2">{t('categories.globalCategoriesAlwaysAvailable')}</p>
        <div className="flex flex-wrap gap-1">
          {categories
            .filter(cat => cat.is_global)
            .map(cat => (
              <span key={cat.id} className="px-2 py-1 text-xs bg-neutral-100 text-neutral-600 rounded">
                {cat.name}
              </span>
            ))}
        </div>
      </div>
    </div>
  );
};

EventCategoryManager.displayName = 'EventCategoryManager';