import { api } from '../config/api';

export interface AdminPhoto {
  id: number;
  filename: string;
  path: string;
  url: string;
  thumbnail_url: string | null;
  type: string;
  category_id: number | null;
  category_name: string | null;
  category_slug: string | null;
  size: number;
  uploaded_at: string;
  view_count?: number;
  download_count?: number;
  // Feedback fields
  has_feedback?: boolean;
  average_rating?: number;
  comment_count?: number;
  like_count?: number;
  favorite_count?: number;
}

export interface PhotoFilters {
  category_id?: number | null;
  type?: string;
  search?: string;
  sort?: 'date' | 'name' | 'size' | 'rating';
  order?: 'asc' | 'desc';
}

class PhotosService {
  async getEventPhotos(eventId: number, filters?: PhotoFilters): Promise<AdminPhoto[]> {
    const params = new URLSearchParams();
    
    if (filters) {
      if (filters.category_id !== undefined) {
        params.append('category_id', filters.category_id?.toString() || '');
      }
      if (filters.type) params.append('type', filters.type);
      if (filters.search) params.append('search', filters.search);
      if (filters.sort) params.append('sort', filters.sort);
      if (filters.order) params.append('order', filters.order);
    }
    
    const queryString = params.toString();
    // Use admin photos router for listing to ensure URL alignment with media/thumbnail endpoints
    const url = `/admin/photos/${eventId}/photos${queryString ? `?${queryString}` : ''}`;
    
    const response = await api.get(url);
    
    // Return photos as-is, URLs are already relative API paths
    return response.data.photos;
  }

  async deletePhoto(eventId: number, photoId: number): Promise<void> {
    await api.delete(`/admin/events/${eventId}/photos/${photoId}`);
  }

  async deletePhotos(eventId: number, photoIds: number[]): Promise<void> {
    await api.post(`/admin/events/${eventId}/photos/bulk-delete`, { photoIds });
  }

  async updatePhotoCategory(eventId: number, photoId: number, categoryId: number | null): Promise<void> {
    await api.patch(`/admin/events/${eventId}/photos/${photoId}`, { category_id: categoryId });
  }

  async updatePhotosCategory(eventId: number, photoIds: number[], categoryId: number | null): Promise<void> {
    await api.post(`/admin/events/${eventId}/photos/bulk-update`, { 
      photoIds, 
      updates: { category_id: categoryId }
    });
  }

  async downloadPhoto(eventId: number, photoId: number, filename: string): Promise<void> {
    const response = await api.get(`/admin/events/${eventId}/photos/${photoId}/download`, {
      responseType: 'blob'
    });
    
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  }

  formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}

export const photosService = new PhotosService();
