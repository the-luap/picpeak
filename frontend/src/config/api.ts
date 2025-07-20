import axios from 'axios';
import Cookies from 'js-cookie';

// Cookie keys
export const ADMIN_TOKEN_KEY = 'admin_token';
export const GALLERY_TOKEN_KEY = 'gallery_token';

// Maintenance mode callback
let maintenanceModeCallback: ((enabled: boolean) => void) | null = null;

export const setMaintenanceModeCallback = (callback: (enabled: boolean) => void) => {
  maintenanceModeCallback = callback;
};

// Create axios instance
export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    // Check if it's an admin route or gallery route
    const isAdminRoute = config.url?.includes('/admin');
    
    if (isAdminRoute) {
      const token = Cookies.get(ADMIN_TOKEN_KEY);
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } else {
      // For gallery routes, try to extract slug from the request URL first
      const galleryMatch = config.url?.match(/\/gallery\/([^\/]+)/);
      if (galleryMatch && galleryMatch[1]) {
        const gallerySlug = galleryMatch[1];
        const token = localStorage.getItem(`gallery_token_${gallerySlug}`);
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
      } else {
        // Fallback to getting slug from the current page URL
        const pathParts = window.location.pathname.split('/');
        if (pathParts[1] === 'gallery' && pathParts[2]) {
          const gallerySlug = pathParts[2];
          const token = localStorage.getItem(`gallery_token_${gallerySlug}`);
          if (token) {
            config.headers.Authorization = `Bearer ${token}`;
          }
        }
      }
    }

    // Don't set Content-Type for FormData - let browser set it with boundary
    if (config.data instanceof FormData) {
      delete config.headers['Content-Type'];
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Handle maintenance mode (503)
    if (error.response?.status === 503) {
      const isAdminRoute = error.config?.url?.includes('/admin');
      const hasAdminAuth = error.config?.headers?.Authorization?.startsWith('Bearer ');
      
      // Only trigger maintenance mode for non-admin routes or unauthenticated admin routes
      if (!isAdminRoute || !hasAdminAuth) {
        if (maintenanceModeCallback) {
          maintenanceModeCallback(true);
        }
      }
    }
    
    if (error.response?.status === 401) {
      // Check if it's an admin route
      const isAdminRoute = error.config?.url?.includes('/admin');
      const currentPath = window.location.pathname;
      
      if (isAdminRoute) {
        // Clear admin token on unauthorized
        Cookies.remove(ADMIN_TOKEN_KEY);
        // Only redirect if we're not already on the admin login page
        if (!currentPath.includes('/admin/login')) {
          window.location.href = '/admin/login';
        }
      } else {
        // For gallery routes, check if the error is from a gallery API call
        const galleryMatch = error.config?.url?.match(/\/gallery\/([^\/]+)/);
        
        // Don't redirect if we're on any gallery page (to avoid redirect loops during login)
        if (currentPath.startsWith('/gallery/')) {
          // If we have a gallery match from the API URL, clear that specific gallery's token
          if (galleryMatch && galleryMatch[1]) {
            const gallerySlug = galleryMatch[1];
            localStorage.removeItem(`gallery_token_${gallerySlug}`);
            localStorage.removeItem(`gallery_event_${gallerySlug}`);
          }
          // Don't redirect - let the component handle the auth state
        } else if (galleryMatch) {
          // We're not on a gallery page but got a 401 from a gallery API
          // This shouldn't happen in normal flow, but if it does, redirect to homepage
          window.location.href = '/';
        }
      }
    }

    return Promise.reject(error);
  }
);

// Helper to set auth tokens
export const setAuthToken = (token: string, isAdmin: boolean = false) => {
  const key = isAdmin ? ADMIN_TOKEN_KEY : GALLERY_TOKEN_KEY;
  Cookies.set(key, token, { expires: 1 }); // 1 day expiry
};

// Helper to clear auth tokens
export const clearAuthToken = (isAdmin: boolean = false) => {
  const key = isAdmin ? ADMIN_TOKEN_KEY : GALLERY_TOKEN_KEY;
  Cookies.remove(key);
};

// Helper to get auth tokens
export const getAuthToken = (isAdmin: boolean = false) => {
  const key = isAdmin ? ADMIN_TOKEN_KEY : GALLERY_TOKEN_KEY;
  return Cookies.get(key);
};