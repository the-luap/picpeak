import { api } from '../config/api';

export interface PhotoCategory {
  id: number;
  name: string;
  slug: string;
  is_global: boolean;
  event_id: number | null;
  created_at: string;
}

export interface CreateCategoryData {
  name: string;
  slug?: string;
  is_global?: boolean;
  event_id?: number;
}

export const categoriesService = {
  // Get all global categories
  async getGlobalCategories(): Promise<PhotoCategory[]> {
    const response = await api.get<PhotoCategory[]>('/admin/categories/global');
    return response.data;
  },

  // Get categories for a specific event (global + event-specific)
  async getEventCategories(eventId: number): Promise<PhotoCategory[]> {
    const response = await api.get<PhotoCategory[]>(`/admin/categories/event/${eventId}`);
    return response.data;
  },

  // Create a new category
  async createCategory(data: CreateCategoryData): Promise<PhotoCategory> {
    const response = await api.post<PhotoCategory>('/admin/categories', data);
    return response.data;
  },

  // Update a category
  async updateCategory(id: number, name: string): Promise<PhotoCategory> {
    const response = await api.put<PhotoCategory>(`/admin/categories/${id}`, { name });
    return response.data;
  },

  // Delete a category
  async deleteCategory(id: number): Promise<void> {
    await api.delete(`/admin/categories/${id}`);
  }
};