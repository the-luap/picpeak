import { api } from '../config/api';
import type { Event } from '../types';

interface CreateEventData {
  event_type: string;
  event_name: string;
  event_date: string;
  host_email: string;
  admin_email: string;
  password: string;
  welcome_message?: string;
  color_theme?: string;
  expiration_days: number;
  allow_user_uploads?: boolean;
  upload_category_id?: number | null;
}

interface UpdateEventData {
  event_name?: string;
  event_date?: string;
  host_email?: string;
  admin_email?: string;
  password?: string;
  welcome_message?: string;
  color_theme?: string;
  expires_at?: string;
  is_active?: boolean;
  allow_user_uploads?: boolean;
  upload_category_id?: number | null;
  hero_photo_id?: number | null;
  source_mode?: 'managed' | 'reference';
  external_path?: string | null;
}

interface EventsListResponse {
  events: Event[];
  total: number;
  page: number;
  limit: number;
}

export const eventsService = {
  // Get all events (admin)
  async getEvents(
    page: number = 1,
    limit: number = 20,
    status?: 'active' | 'inactive' | 'archived'
  ): Promise<EventsListResponse> {
    const params = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
    });
    
    if (status) {
      params.append('status', status);
    }

    const response = await api.get<EventsListResponse>(`/admin/events?${params}`);
    return response.data;
  },

  // Get single event details (admin)
  async getEvent(id: number): Promise<Event> {
    const response = await api.get<Event>(`/admin/events/${id}`);
    return response.data;
  },

  // Create new event (admin)
  async createEvent(data: CreateEventData): Promise<Event> {
    const response = await api.post<Event>('/admin/events', data);
    return response.data;
  },

  // Update event (admin)
  async updateEvent(id: number, data: UpdateEventData): Promise<Event> {
    const response = await api.put<Event>(`/admin/events/${id}`, data);
    return response.data;
  },

  // Delete/deactivate event (admin)
  async deleteEvent(id: number): Promise<void> {
    await api.delete(`/admin/events/${id}`);
  },

  // Force archive event (admin)
  async archiveEvent(id: number): Promise<void> {
    await api.post(`/admin/events/${id}/archive`);
  },

  // Bulk archive events (admin)
  async bulkArchiveEvents(eventIds: number[]): Promise<{
    message: string;
    results: {
      successful: Array<{ id: number; name: string }>;
      failed: Array<{ id: number; name: string; error: string }>;
    };
  }> {
    const response = await api.post('/admin/events/bulk-archive', {
      eventIds,
    });
    return response.data;
  },

  // Extend event expiration (admin)
  async extendExpiration(id: number, days: number): Promise<Event> {
    const response = await api.post<Event>(`/events/${id}/extend`, {
      days,
    });
    return response.data;
  },

  // Get event categories
  async getEventCategories(eventId: number): Promise<Array<{ id: number; name: string; slug: string }>> {
    const response = await api.get(`/admin/categories/event/${eventId}`);
    return response.data || [];
  },

  // Reset event password
  async resetPassword(eventId: number, sendEmail: boolean = true): Promise<{ message: string; newPassword: string; emailSent: boolean }> {
    const response = await api.post(`/admin/events/${eventId}/reset-password`, { sendEmail });
    return response.data;
  },

  // Resend creation email
  async resendCreationEmail(eventId: number): Promise<{ success: boolean; message: string }> {
    const response = await api.post(`/admin/events/${eventId}/resend-email`);
    return response.data;
  },
};
