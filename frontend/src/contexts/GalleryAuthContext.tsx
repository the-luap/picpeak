import React, { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { api } from '../config/api';
import { authService, galleryService } from '../services';
import { cleanupOldGalleryAuth } from '../utils/cleanupGalleryAuth';
import { normalizeRequirePassword } from '../utils/accessControl';
import {
  clearActiveGallerySlug,
  clearGalleryToken,
  setActiveGallerySlug,
  storeGalleryToken,
} from '../utils/galleryAuthStorage';

interface GalleryEvent {
  id: number;
  event_name: string;
  event_type: string;
  event_date: string;
  welcome_message?: string;
  color_theme?: string;
  expires_at: string;
  require_password?: boolean;
}

const normalizeEvent = (incoming: GalleryEvent | null | undefined): GalleryEvent | null => {
  if (!incoming) {
    return null;
  }

  return {
    ...incoming,
    require_password: normalizeRequirePassword(incoming.require_password, true),
  };
};

interface GalleryAuthContextType {
  isAuthenticated: boolean;
  event: GalleryEvent | null;
  login: (slug: string, password?: string, recaptchaToken?: string | null) => Promise<void>;
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
    cleanupOldGalleryAuth();

    const slugAtMount = getCurrentGallerySlug();
    if (slugAtMount) {
      setActiveGallerySlug(slugAtMount);
    } else {
      clearActiveGallerySlug();
    }

    const initialise = async () => {
      const currentSlug = getCurrentGallerySlug();

      if (!currentSlug) {
        setIsLoading(false);
        return;
      }

      setActiveGallerySlug(currentSlug);

      const storedEvent = sessionStorage.getItem(`gallery_event_${currentSlug}`);
      if (storedEvent) {
        try {
          const parsed = JSON.parse(storedEvent);
          if (parsed && parsed.id) {
            const normalizedStored = normalizeEvent(parsed);
            setEvent(normalizedStored);
            if (normalizedStored) {
              sessionStorage.setItem(`gallery_event_${currentSlug}`, JSON.stringify(normalizedStored));
            }
          }
        } catch (err) {
          sessionStorage.removeItem(`gallery_event_${currentSlug}`);
        }
      }

      try {
        setIsLoading(true);
        const sessionResponse = await api.get<{ valid: boolean; type: string; eventSlug?: string }>(
          '/auth/session',
          { params: { slug: currentSlug } }
        );

        if (sessionResponse.data?.valid && sessionResponse.data.type === 'gallery' && sessionResponse.data.eventSlug === currentSlug) {
          setIsAuthenticated(true);

          if (!storedEvent) {
            // Fetch gallery details to hydrate context
            const galleryData = await galleryService.getGalleryPhotos(currentSlug);
            if (galleryData?.event) {
              const normalizedEvent = normalizeEvent(galleryData.event);
              setEvent(normalizedEvent);
              if (normalizedEvent) {
                sessionStorage.setItem(`gallery_event_${currentSlug}`, JSON.stringify(normalizedEvent));
              }
            }
          }

          return;
        }

        // If no active session, check for share token in URL
        const parts = window.location.pathname.split('/');
        const urlToken = parts.length >= 5 ? parts[4] : (parts.length >= 4 ? parts[3] : undefined);

        if (urlToken) {
          const verify = await galleryService.verifyToken(currentSlug, urlToken);
          if (verify?.valid) {
            const response = await authService.shareLinkLogin(currentSlug, urlToken);
            if (response?.event) {
              const normalizedEvent = normalizeEvent(response.event);
              setEvent(normalizedEvent);
              setIsAuthenticated(true);
              if (normalizedEvent) {
                sessionStorage.setItem(`gallery_event_${currentSlug}`, JSON.stringify(normalizedEvent));
              }
              if (response.token) {
                storeGalleryToken(currentSlug, response.token);
              }
              setActiveGallerySlug(currentSlug);
              return;
            }
          }
        }

        // No valid session found
        setIsAuthenticated(false);
        sessionStorage.removeItem(`gallery_event_${currentSlug}`);
        setEvent(null);
        clearGalleryToken(currentSlug);
      } catch (error) {
        setIsAuthenticated(false);
        sessionStorage.removeItem(`gallery_event_${currentSlug}`);
        setEvent(null);
        clearGalleryToken(currentSlug);
      } finally {
        setIsLoading(false);
      }
    };

    initialise();
    return () => {
      clearActiveGallerySlug();
    };
  }, []);

  const login = async (slug: string, password?: string, recaptchaToken?: string | null) => {
    try {
      setError(null);
      setIsLoading(true);
      const response = await authService.verifyGalleryPassword(slug, password, recaptchaToken);
      const normalizedEvent = normalizeEvent(response.event);
      setEvent(normalizedEvent);
      setIsAuthenticated(true);
      if (response.token) {
        storeGalleryToken(slug, response.token);
      }
      setActiveGallerySlug(slug);

      // Store event data for quick reloads (non-sensitive)
      if (normalizedEvent) {
        sessionStorage.setItem(`gallery_event_${slug}`, JSON.stringify(normalizedEvent));
      }
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
      sessionStorage.removeItem(`gallery_event_${currentSlug}`);
      clearGalleryToken(currentSlug);
    }
    authService.galleryLogout(currentSlug || undefined);
    setIsAuthenticated(false);
    setEvent(null);
    clearActiveGallerySlug();
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
