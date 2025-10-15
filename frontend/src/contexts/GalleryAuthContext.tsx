import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
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
  const [routeError, setRouteError] = useState<string | null>(null);
  const location = useLocation();
  const [routeInfo, setRouteInfo] = useState<{ slug: string | null; token?: string; identifier: string | null; ready: boolean }>({
    slug: null,
    token: undefined,
    identifier: null,
    ready: false,
  });
  const lastResolvedIdentifier = useRef<string | null>(null);

  useEffect(() => {
    cleanupOldGalleryAuth();
  }, []);

  useEffect(() => {
    let cancelled = false;

    const parseRoute = async () => {
      const segments = location.pathname.split('/').filter(Boolean);

      if (segments[0] !== 'gallery') {
        if (!cancelled) {
          setRouteInfo({ slug: null, token: undefined, identifier: null, ready: true });
          setRouteError(null);
        }
        return;
      }

      const identifier = segments[1] || null;
      const tokenSegment = segments[2];

      if (!identifier) {
        if (!cancelled) {
          setRouteInfo({ slug: null, token: undefined, identifier: null, ready: true });
        }
        return;
      }

      const looksLikeToken = /^[0-9a-fA-F]{32}$/.test(identifier) && !tokenSegment;

      if (looksLikeToken) {
        if (lastResolvedIdentifier.current === identifier) {
          setRouteInfo(prev => ({
            slug: prev.slug,
            token: prev.token,
            identifier,
            ready: true,
          }));
          setRouteError(null);
          return;
        }

        try {
          const resolved = await galleryService.resolveIdentifier(identifier);
          if (cancelled) return;
          lastResolvedIdentifier.current = identifier;
          setRouteInfo({
            slug: resolved.slug,
            token: resolved.token,
            identifier,
            ready: true,
          });
          setRouteError(null);
        } catch (err: any) {
          if (cancelled) return;
          lastResolvedIdentifier.current = identifier;
          setRouteInfo({
            slug: null,
            token: undefined,
            identifier,
            ready: true,
          });
          setRouteError(err?.response?.data?.error || 'Unable to resolve gallery link');
        }
      } else {
        lastResolvedIdentifier.current = null;
        setRouteInfo({
          slug: identifier,
          token: tokenSegment,
          identifier,
          ready: true,
        });
        setRouteError(null);
      }
    };

    setRouteInfo(prev => ({ ...prev, ready: false }));
    parseRoute();

    return () => {
      cancelled = true;
    };
  }, [location.pathname]);

  useEffect(() => {
    if (!routeInfo.ready) {
      return;
    }

    if (!routeInfo.slug) {
      clearActiveGallerySlug();
      setIsAuthenticated(false);
      setEvent(null);
      setIsLoading(false);
      return;
    }

    const currentSlug = routeInfo.slug;
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
      } catch {
        sessionStorage.removeItem(`gallery_event_${currentSlug}`);
      }
    }

    const initialise = async () => {
      try {
        setIsLoading(true);
        const sessionResponse = await api.get<{ valid: boolean; type: string; eventSlug?: string }>(
          '/auth/session',
          { params: { slug: currentSlug } }
        );

        if (sessionResponse.data?.valid && sessionResponse.data.type === 'gallery' && sessionResponse.data.eventSlug === currentSlug) {
          setIsAuthenticated(true);

          if (!storedEvent) {
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

        if (routeInfo.token) {
          const verify = await galleryService.verifyToken(currentSlug, routeInfo.token);
          if (verify?.valid) {
            const response = await authService.shareLinkLogin(currentSlug, routeInfo.token);
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

        setIsAuthenticated(false);
        sessionStorage.removeItem(`gallery_event_${currentSlug}`);
        setEvent(null);
        clearGalleryToken(currentSlug);
      } catch (initialiseError: any) {
        setIsAuthenticated(false);
        sessionStorage.removeItem(`gallery_event_${currentSlug}`);
        setEvent(null);
        clearGalleryToken(currentSlug);
        if (initialiseError?.response?.data?.error) {
          setError(initialiseError.response.data.error);
        }
      } finally {
        setIsLoading(false);
      }
    };

    initialise();

    return () => {
      clearActiveGallerySlug();
    };
  }, [routeInfo]);

  const login = async (slug: string, password?: string, recaptchaToken?: string | null) => {
    try {
      setRouteError(null);
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
    const currentSlug = routeInfo.slug;
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
        error: routeError ?? error,
      }}
    >
      {children}
    </GalleryAuthContext.Provider>
  );
};
