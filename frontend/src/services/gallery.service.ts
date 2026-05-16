import { api } from '../config/api';
import type { GalleryInfo, GalleryData, GalleryStats, ResolvedGalleryIdentifier } from '../types';
import { normalizeRequirePassword } from '../utils/accessControl';
import { parseContentDispositionFilename } from '../utils/contentDisposition';

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
    const data = response.data;
    return {
      ...data,
      requires_password: normalizeRequirePassword((data as any)?.requires_password, true),
    };
  },

  // Get gallery photos (requires auth)
  async getGalleryPhotos(
    slug: string,
    filter?: 'liked' | 'favorited' | 'commented' | 'rated' | 'all',
    guestId?: string
  ): Promise<GalleryData> {
    const params: any = {};
    if (filter && filter !== 'all') {
      params.filter = filter;
      if (guestId) {
        params.guest_id = guestId;
      }
    }
    const response = await api.get<GalleryData>(`/gallery/${slug}/photos`, { params });
    const data = response.data;
    const normalizedEvent = data?.event
      ? {
          ...data.event,
          require_password: normalizeRequirePassword((data.event as any)?.require_password, true),
        }
      : data.event;
    return {
      ...data,
      event: normalizedEvent,
    };
  },

  // Download single photo
  async downloadPhoto(slug: string, photoId: number, filename: string): Promise<void> {
    // Honour the server's Content-Disposition filename so the #493
    // "use original camera filename" toggle reaches disk for single
    // downloads (it already worked for zips because those skip the
    // `<a download>` attribute). Falls back to the caller-provided
    // sanitized filename if the header is unreadable.
    const downloadFromResponse = (response: { data: Blob; headers: Record<string, string> }) => {
      const headerName =
        response.headers['content-disposition'] || response.headers['Content-Disposition'];
      const serverFilename = parseContentDispositionFilename(headerName);
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', serverFilename || filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    };

    try {
      const response = await api.get(`/gallery/${slug}/download/${photoId}`, {
        responseType: 'blob',
      });
      downloadFromResponse(response);
    } catch {
      // Fallback: use the view endpoint if direct download fails (e.g., missing original).
      // The view endpoint doesn't emit a download-oriented Content-Disposition,
      // so we expect the caller-supplied filename to win here.
      const response = await api.get(`/gallery/${slug}/photo/${photoId}`, {
        responseType: 'blob',
      });
      downloadFromResponse(response);
    }
  },

  // Download all photos as ZIP
  // When a pre-generated zip is available, use native browser download (Content-Length → progress bar).
  // Otherwise fall back to blob download.
  async downloadAllPhotos(slug: string, zipReady?: boolean): Promise<void> {
    if (zipReady) {
      // Native browser download — the server sends Content-Length so
      // the browser shows a real progress bar and mobile doesn't crash.
      const link = document.createElement('a');
      link.href = `/api/gallery/${slug}/download-all`;
      link.setAttribute('download', `${slug}.zip`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      return;
    }

    // Fallback: blob download (no Content-Length, buffered in memory)
    const response = await api.get(`/gallery/${slug}/download-all`, {
      responseType: 'blob',
    });

    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${slug}.zip`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  },

  // Download selected photos as ZIP
  async downloadSelectedPhotos(slug: string, photoIds: number[]): Promise<void> {
    const response = await api.post(`/gallery/${slug}/download-selected`, { photo_ids: photoIds }, {
      responseType: 'blob',
    });

    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${slug}-selected.zip`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  },

  // Toggle photo visibility (client-only)
  async togglePhotoVisibility(slug: string, photoId: number, visibility: 'visible' | 'hidden'): Promise<void> {
    await api.patch(`/gallery/${slug}/photos/${photoId}/visibility`, { visibility });
  },

  // Bulk toggle photo visibility (client-only)
  async bulkToggleVisibility(slug: string, photoIds: number[], visibility: 'visible' | 'hidden'): Promise<void> {
    await api.patch(`/gallery/${slug}/photos/visibility/bulk`, { photoIds, visibility });
  },

  // Get gallery statistics
  async getGalleryStats(slug: string): Promise<GalleryStats> {
    const response = await api.get<GalleryStats>(`/gallery/${slug}/stats`);
    return response.data;
  },

  async resolveIdentifier(identifier: string): Promise<ResolvedGalleryIdentifier> {
    const response = await api.get<ResolvedGalleryIdentifier>(`/gallery/resolve/${identifier}`);
    return response.data;
  },
};
