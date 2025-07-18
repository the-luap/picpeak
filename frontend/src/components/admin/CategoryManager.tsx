import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Edit2, Trash2, Loader2 } from 'lucide-react';
import { toast } from 'react-toastify';
import { categoriesService, type PhotoCategory } from '../../services/categories.service';
import { Button } from '../common';

export const CategoryManager: React.FC = () => {
  const queryClient = useQueryClient();
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [editingName, setEditingName] = useState('');

  // Fetch global categories
  const { data: categories = [], isLoading } = useQuery({
    queryKey: ['global-categories'],
    queryFn: categoriesService.getGlobalCategories,
  });

  // Create category mutation
  const createMutation = useMutation({
    mutationFn: (name: string) => 
      categoriesService.createCategory({ name, is_global: true }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['global-categories'] });
      toast.success('Category created successfully');
      setNewCategoryName('');
      setIsAdding(false);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to create category');
    },
  });

  // Update category mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, name }: { id: number; name: string }) => 
      categoriesService.updateCategory(id, name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['global-categories'] });
      toast.success('Category updated successfully');
      setEditingId(null);
      setEditingName('');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to update category');
    },
  });

  // Delete category mutation
  const deleteMutation = useMutation({
    mutationFn: categoriesService.deleteCategory,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['global-categories'] });
      toast.success('Category deleted successfully');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to delete category');
    },
  });

  const handleCreate = () => {
    if (newCategoryName.trim()) {
      createMutation.mutate(newCategoryName.trim());
    }
  };

  const handleUpdate = (id: number) => {
    if (editingName.trim()) {
      updateMutation.mutate({ id, name: editingName.trim() });
    }
  };

  const handleDelete = (category: PhotoCategory) => {
    if (window.confirm(`Are you sure you want to delete "${category.name}"?`)) {
      deleteMutation.mutate(category.id);
    }
  };

  const startEdit = (category: PhotoCategory) => {
    setEditingId(category.id);
    setEditingName(category.name);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditingName('');
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-primary-600" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold text-neutral-900">Photo Categories</h3>
        {!isAdding && (
          <Button
            variant="primary"
            size="sm"
            onClick={() => setIsAdding(true)}
            leftIcon={<Plus className="w-4 h-4" />}
          >
            Add Category
          </Button>
        )}
      </div>

      {/* Add new category form */}
      {isAdding && (
        <div className="flex gap-2 p-3 bg-neutral-50 rounded-lg">
          <input
            type="text"
            value={newCategoryName}
            onChange={(e) => setNewCategoryName(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleCreate()}
            placeholder="Category name"
            className="flex-1 px-3 py-2 border border-neutral-300 rounded-md focus:ring-2 focus:ring-primary-500"
            autoFocus
          />
          <Button
            variant="primary"
            size="sm"
            onClick={handleCreate}
            disabled={!newCategoryName.trim() || createMutation.isPending}
          >
            {createMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              'Create'
            )}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              setIsAdding(false);
              setNewCategoryName('');
            }}
          >
            Cancel
          </Button>
        </div>
      )}

      {/* Categories list */}
      <div className="space-y-2">
        {categories.length === 0 ? (
          <p className="text-neutral-500 text-center py-8">
            No categories yet. Create your first category to organize photos.
          </p>
        ) : (
          categories.map((category) => (
            <div
              key={category.id}
              className="flex items-center justify-between p-3 bg-white rounded-lg border border-neutral-200 hover:border-neutral-300 transition-colors"
            >
              {editingId === category.id ? (
                <div className="flex gap-2 flex-1">
                  <input
                    type="text"
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') handleUpdate(category.id);
                      if (e.key === 'Escape') cancelEdit();
                    }}
                    className="flex-1 px-3 py-1 border border-neutral-300 rounded-md focus:ring-2 focus:ring-primary-500"
                    autoFocus
                  />
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => handleUpdate(category.id)}
                    disabled={!editingName.trim() || updateMutation.isPending}
                  >
                    {updateMutation.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      'Save'
                    )}
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={cancelEdit}
                  >
                    Cancel
                  </Button>
                </div>
              ) : (
                <>
                  <div>
                    <p className="font-medium text-neutral-900">{category.name}</p>
                    <p className="text-sm text-neutral-500">/{category.slug}</p>
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => startEdit(category)}
                      className="p-1.5 text-neutral-600 hover:text-primary-600 hover:bg-primary-50 rounded transition-colors"
                      title="Edit category"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(category)}
                      className="p-1.5 text-neutral-600 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                      title="Delete category"
                      disabled={deleteMutation.isPending}
                    >
                      {deleteMutation.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

CategoryManager.displayName = 'CategoryManager';