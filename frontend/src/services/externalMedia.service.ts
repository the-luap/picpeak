import { api } from '../config/api';

export interface ExternalEntry { name: string; type: 'dir' | 'file'; size?: number; mtime?: string }

export const externalMediaService = {
  async list(pathRel: string = ''): Promise<{ path: string; entries: ExternalEntry[]; canNavigateUp: boolean }> {
    const params = new URLSearchParams();
    if (pathRel) params.set('path', pathRel);
    const res = await api.get(`/admin/external-media/list?${params.toString()}`);
    return res.data;
  },

  async importEvent(eventId: number, externalPath: string, options?: { recursive?: boolean; map?: { individual?: string; collages?: string } }): Promise<{ imported: number; skipped: number; thumbnailsQueued: number }> {
    const res = await api.post(`/admin/external-media/events/${eventId}/import-external`, {
      external_path: externalPath,
      recursive: options?.recursive ?? true,
      map: options?.map
    });
    return res.data;
  }
}

