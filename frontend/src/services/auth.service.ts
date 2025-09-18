import { api } from '../config/api';
import type { LoginResponse, GalleryAuthResponse } from '../types';

export const authService = {
  // Admin authentication
  async adminLogin(credentials: { email: string; password: string; recaptchaToken?: string | null }): Promise<LoginResponse> {
    // Backend expects 'username' field, but we accept email
    const response = await api.post<LoginResponse>('/auth/admin/login', {
      username: credentials.email,
      password: credentials.password,
      recaptchaToken: credentials.recaptchaToken
    });
    return response.data;
  },

  async adminLogout() {
    try {
      await api.post('/auth/logout');
    } catch (err) {
      // Ignore logout errors; fallback to redirect
    } finally {
      window.location.href = '/admin/login';
    }
  },

  // Gallery authentication
  async verifyGalleryPassword(slug: string, password: string, recaptchaToken?: string | null): Promise<GalleryAuthResponse> {
    const response = await api.post<GalleryAuthResponse>('/auth/gallery/verify', {
      slug,
      password,
      recaptchaToken
    });
    
    // Token is now handled by GalleryAuthContext with slug-specific storage
    return response.data;
  },

  async shareLinkLogin(slug: string, token: string): Promise<GalleryAuthResponse> {
    const response = await api.post<GalleryAuthResponse>('/auth/gallery/share-login', {
      slug,
      token,
    });
    return response.data;
  },

  async galleryLogout(slug?: string | null) {
    try {
      await api.post('/auth/gallery/logout', { slug });
    } catch (err) {
      // Ignore; cookie will naturally expire if removal fails
    }
  },
};
