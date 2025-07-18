import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getApiBaseUrl, buildResourceUrl } from '../../utils/url';

export const DynamicFavicon: React.FC = () => {
  const { data: settings } = useQuery({
    queryKey: ['public-settings'],
    queryFn: async () => {
      try {
        const response = await fetch(`${getApiBaseUrl()}/public/settings`);
        if (response.ok) {
          return response.json();
        }
        return null;
      } catch {
        return null;
      }
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  useEffect(() => {
    if (settings?.branding_favicon_url) {
      // Remove existing favicon links
      const existingFavicons = document.querySelectorAll("link[rel*='icon']");
      existingFavicons.forEach(favicon => favicon.remove());

      // Create new favicon link
      const link = document.createElement('link');
      link.rel = 'icon';
      link.type = 'image/png';
      link.href = settings.branding_favicon_url.startsWith('http') 
        ? settings.branding_favicon_url 
        : buildResourceUrl(settings.branding_favicon_url);
      
      document.head.appendChild(link);
    }
  }, [settings?.branding_favicon_url]);

  return null;
};