/**
 * Utility functions for URL handling in production environments
 */

/**
 * Get the base API URL, preferring relative URLs for production
 * @returns The API base URL
 */
export const getApiBaseUrl = (): string => {
  // If VITE_API_URL is explicitly set, use it
  if (import.meta.env.VITE_API_URL && import.meta.env.VITE_API_URL !== '/api') {
    return import.meta.env.VITE_API_URL;
  }
  
  // In production, use relative URL
  return '/api';
};

/**
 * Build a full URL for resources (images, files, etc.)
 * In production, this will use the current origin
 * @param path - The resource path
 * @returns The full URL
 */
export const buildResourceUrl = (path: string): string => {
  // Remove leading slash if present
  const cleanPath = path.startsWith('/') ? path.slice(1) : path;
  
  // If we have an explicit API URL that's not relative, use it
  const apiUrl = import.meta.env.VITE_API_URL;
  if (apiUrl && apiUrl !== '/api' && apiUrl.startsWith('http')) {
    const baseUrl = apiUrl.replace(/\/api\/?$/, ''); // Remove /api suffix if present
    return `${baseUrl}/${cleanPath}`;
  }
  
  // In production (relative API), use current origin
  return `${window.location.origin}/${cleanPath}`;
};

/**
 * Check if we're in production mode (using relative URLs)
 * @returns True if in production mode
 */
export const isProductionMode = (): boolean => {
  return !import.meta.env.VITE_API_URL || import.meta.env.VITE_API_URL === '/api';
};