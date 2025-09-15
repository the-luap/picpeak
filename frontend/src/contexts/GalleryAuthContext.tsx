import React, { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { authService, galleryService } from '../services';
import { cleanupOldGalleryAuth } from '../utils/cleanupGalleryAuth';

interface GalleryEvent {
  id: number;
  event_name: string;
  event_type: string;
  event_date: string;
  welcome_message?: string;
  color_theme?: string;
  expires_at: string;
}

interface GalleryAuthContextType {
  isAuthenticated: boolean;
  event: GalleryEvent | null;
  login: (slug: string, password: string, recaptchaToken?: string | null) => Promise<void>;
  logout: () => void;
  isLoading: boolean;
  error: string | null;
}

const GalleryAuthContext = createContext<GalleryAuthContextType | undefined>(undefined);

export const useGalleryAuth = () => {
  const context = useContext(GalleryAuthContext);
  if (!context) {
    throw new Error('useGalleryAuth must be used within a GalleryAuthProvider');
  }
  return context;
};

interface GalleryAuthProviderProps {
  children: ReactNode;
}

export const GalleryAuthProvider: React.FC<GalleryAuthProviderProps> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [event, setEvent] = useState<GalleryEvent | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Get current gallery slug from URL
  const getCurrentGallerySlug = () => {
    const pathParts = window.location.pathname.split('/');
    if (pathParts[1] === 'gallery' && pathParts[2]) {
      return pathParts[2];
    }
    return null;
  };

  useEffect(() => {
    // Clean up old authentication data on mount
    cleanupOldGalleryAuth();
    
    // Check if user has a valid token on mount
    const currentSlug = getCurrentGallerySlug();
    if (currentSlug) {
      // Try to restore event data from localStorage with slug-specific key
      const storedEvent = localStorage.getItem(`gallery_event_${currentSlug}`);
      const storedToken = localStorage.getItem(`gallery_token_${currentSlug}`);
      
      if (storedEvent && storedToken) {
        try {
          const eventData = JSON.parse(storedEvent);
          // Verify the stored event matches the current gallery slug
          if (eventData && eventData.id) {
            setEvent(eventData);
            setIsAuthenticated(true);
          } else {
            // Clear invalid data
            localStorage.removeItem(`gallery_event_${currentSlug}`);
            localStorage.removeItem(`gallery_token_${currentSlug}`);
          }
        } catch (error) {
          // Invalid stored data - clear it
          localStorage.removeItem(`gallery_event_${currentSlug}`);
          localStorage.removeItem(`gallery_token_${currentSlug}`);
        }
      } else {
        // No stored auth; check for token in URL and auto-authenticate
        const parts = window.location.pathname.split('/');
        const urlToken = parts.length >= 5 ? parts[4] : (parts.length >= 4 ? parts[3] : undefined);
        if (urlToken) {
          (async () => {
            try {
              setIsLoading(true);
              // Verify token against backend
              const verify = await galleryService.verifyToken(currentSlug, urlToken);
              if (verify?.valid) {
                // Store token and fetch event via photos endpoint to get full event object
                localStorage.setItem(`gallery_token_${currentSlug}`, urlToken);
                const data = await galleryService.getGalleryPhotos(currentSlug);
                if (data?.event) {
                  setEvent(data.event);
                  setIsAuthenticated(true);
                  localStorage.setItem(`gallery_event_${currentSlug}`, JSON.stringify(data.event));
                }
              }
            } catch (e) {
              // Invalid token; ensure any residual storage is cleared
              localStorage.removeItem(`gallery_token_${currentSlug}`);
              localStorage.removeItem(`gallery_event_${currentSlug}`);
            } finally {
              setIsLoading(false);
            }
          })();
        }
      }
    }
    setIsLoading(false);
  }, []);

  const login = async (slug: string, password: string, recaptchaToken?: string | null) => {
    try {
      setError(null);
      setIsLoading(true);
      const response = await authService.verifyGalleryPassword(slug, password, recaptchaToken);
      setEvent(response.event);
      setIsAuthenticated(true);
      
      // Store event data and token in localStorage with slug-specific key
      localStorage.setItem(`gallery_event_${slug}`, JSON.stringify(response.event));
      localStorage.setItem(`gallery_token_${slug}`, response.token);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Invalid password');
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    const currentSlug = getCurrentGallerySlug();
    if (currentSlug) {
      localStorage.removeItem(`gallery_event_${currentSlug}`);
      localStorage.removeItem(`gallery_token_${currentSlug}`);
    }
    authService.galleryLogout();
    setIsAuthenticated(false);
    setEvent(null);
  };

  return (
    <GalleryAuthContext.Provider
      value={{
        isAuthenticated,
        event,
        login,
        logout,
        isLoading,
        error,
      }}
    >
      {children}
    </GalleryAuthContext.Provider>
  );
};
