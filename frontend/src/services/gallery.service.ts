import { api } from '../config/api';
import type { GalleryInfo, GalleryData, GalleryStats } from '../types';

export const galleryService = {
  // Verify share token
  async verifyToken(slug: string, token: string): Promise<{ valid: boolean }> {
    const response = await api.get<{ valid: boolean }>(`/gallery/${slug}/verify-token/${token}`);
    return response.data;
  },

  // Get basic gallery info (no auth required)
  async getGalleryInfo(slug: string, token?: string): Promise<GalleryInfo> {
    const params = token ? { token } : {};
    const response = await api.get<GalleryInfo>(`/gallery/${slug}/info`, { params });
    return response.data;
  },

  // Get gallery photos (requires auth)
  async getGalleryPhotos(slug: string): Promise<GalleryData> {
    const response = await api.get<GalleryData>(`/gallery/${slug}/photos`);
    return response.data;
  },

  // Download single photo
  async downloadPhoto(slug: string, photoId: number, filename: string): Promise<void> {
    const response = await api.get(`/gallery/${slug}/download/${photoId}`, {
      responseType: 'blob',
    });

    // Create download link
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  },

  // Download all photos as ZIP
  async downloadAllPhotos(slug: string): Promise<void> {
    const response = await api.get(`/gallery/${slug}/download-all`, {
      responseType: 'blob',
    });

    // Create download link
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${slug}.zip`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  },

  // Get gallery statistics
  async getGalleryStats(slug: string): Promise<GalleryStats> {
    const response = await api.get<GalleryStats>(`/gallery/${slug}/stats`);
    return response.data;
  },
};