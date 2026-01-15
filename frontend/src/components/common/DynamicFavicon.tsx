import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getApiBaseUrl, buildResourceUrl } from '../../utils/url';

const DEFAULT_TITLE = 'PicPeak - Photo Sharing Platform';

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

  // Update favicon when branding settings change
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

  // Update document title when company name or tagline changes
  useEffect(() => {
    const companyName = settings?.branding_company_name?.trim();
    const tagline = settings?.branding_company_tagline?.trim();

    if (companyName && tagline) {
      document.title = `${companyName} - ${tagline}`;
    } else if (companyName) {
      document.title = companyName;
    } else {
      document.title = DEFAULT_TITLE;
    }
  }, [settings?.branding_company_name, settings?.branding_company_tagline]);

  return null;
};