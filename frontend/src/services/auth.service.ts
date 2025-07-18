import { api, setAuthToken, clearAuthToken } from '../config/api';
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
    
    setAuthToken(response.data.token, true);
    return response.data;
  },

  adminLogout() {
    clearAuthToken(true);
    window.location.href = '/admin/login';
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

  galleryLogout() {
    // Logout is now handled by GalleryAuthContext
  },
};