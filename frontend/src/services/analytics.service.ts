// Umami Analytics Service
// Provides integration with Umami for tracking page views and events

interface UmamiConfig {
  websiteId?: string;
  hostUrl?: string;
  autoTrack?: boolean;
  doNotTrack?: boolean;
  domains?: string[];
}

declare global {
  interface Window {
    umami?: {
      track: (eventName: string, eventData?: any) => void;
      trackView: (url?: string, referrer?: string, websiteId?: string) => void;
      trackEvent: (
        eventValue: string,
        eventType: string,
        url?: string,
        websiteId?: string
      ) => void;
    };
  }
}

class AnalyticsService {
  private initialized = false;
  private websiteId: string | null = null;
  // private hostUrl: string | null = null;

  initialize(config: UmamiConfig) {
    if (this.initialized) return;

    const { websiteId, hostUrl, autoTrack = true, doNotTrack = true } = config;

    if (!websiteId || !hostUrl) {
      console.warn('Umami Analytics: Missing websiteId or hostUrl');
      return;
    }

    this.websiteId = websiteId;
    // this.hostUrl = hostUrl;

    // Create and inject Umami script
    const script = document.createElement('script');
    script.async = true;
    script.defer = true;
    script.src = `${hostUrl}/script.js`;
    script.setAttribute('data-website-id', websiteId);
    
    if (!autoTrack) {
      script.setAttribute('data-auto-track', 'false');
    }
    
    if (doNotTrack) {
      script.setAttribute('data-do-not-track', 'true');
    }

    if (config.domains && config.domains.length > 0) {
      script.setAttribute('data-domains', config.domains.join(','));
    }

    document.head.appendChild(script);
    this.initialized = true;
  }

  // Check if analytics is initialized
  isInitialized() {
    return this.initialized;
  }

  // Track custom events
  track(eventName: string, eventData?: Record<string, any>) {
    if (!this.initialized || !window.umami) {
      // Silently ignore if not initialized
      return;
    }

    // Umami expects flat event data
    window.umami.track(eventName, eventData);
  }

  // Track page views manually
  trackPageView(url?: string, referrer?: string) {
    if (!this.initialized || !window.umami) {
      // Silently ignore if not initialized
      return;
    }

    window.umami.trackView(url, referrer, this.websiteId || undefined);
  }

  // Gallery-specific tracking events
  trackGalleryEvent(eventType: 'password_entry' | 'photo_view' | 'photo_download' | 'gallery_expired' | 'bulk_download', data?: any) {
    this.track(`gallery_${eventType}`, data);
  }

  // Admin-specific tracking events
  trackAdminEvent(eventType: 'login' | 'event_created' | 'event_archived' | 'event_deleted' | 'settings_updated', data?: any) {
    this.track(`admin_${eventType}`, data);
  }

  // Track download events with more context
  trackDownload(photoId: string | number, gallerySlug: string, isBulk: boolean = false) {
    this.track('photo_download', {
      photo_id: photoId,
      gallery: gallerySlug,
      bulk: isBulk,
      timestamp: new Date().toISOString()
    });
  }

  // Track expiration warning views
  trackExpirationWarning(gallerySlug: string, daysRemaining: number) {
    this.track('expiration_warning_viewed', {
      gallery: gallerySlug,
      days_remaining: daysRemaining,
      timestamp: new Date().toISOString()
    });
  }

  // Track search usage
  trackSearch(query: string, resultsCount: number, context: 'gallery' | 'admin') {
    this.track('search_performed', {
      query_length: query.length,
      results_count: resultsCount,
      context,
      timestamp: new Date().toISOString()
    });
  }
}

export const analyticsService = new AnalyticsService();

// Helper hook for React components
import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

export const useAnalytics = () => {
  const location = useLocation();

  useEffect(() => {
    // Track page views on route change
    analyticsService.trackPageView(location.pathname + location.search);
  }, [location]);

  return analyticsService;
};