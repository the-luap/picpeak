import { useEffect } from 'react';
import { usePublicSettings } from '../../hooks/usePublicSettings';
import { buildResourceUrl } from '../../utils/url';

const DEFAULT_TITLE = 'PicPeak - Photo Sharing Platform';

export const DynamicFavicon: React.FC = () => {
  const { data: settings } = usePublicSettings({ retry: false });

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

  // Update document title and OG meta tags when company name or tagline changes
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

    // Update OG meta tags
    const title = companyName || 'PicPeak';
    const description = tagline || 'Photo Sharing Platform';

    const updateMeta = (property: string, content: string) => {
      let meta = document.querySelector(`meta[property="${property}"]`) as HTMLMetaElement | null;
      if (!meta) {
        meta = document.createElement('meta');
        meta.setAttribute('property', property);
        document.head.appendChild(meta);
      }
      meta.content = content;
    };

    updateMeta('og:title', document.title);
    updateMeta('og:site_name', title);
    updateMeta('og:description', description);

    // Also update standard meta description
    let metaDesc = document.querySelector('meta[name="description"]') as HTMLMetaElement | null;
    if (!metaDesc) {
      metaDesc = document.createElement('meta');
      metaDesc.name = 'description';
      document.head.appendChild(metaDesc);
    }
    metaDesc.content = description;
  }, [settings?.branding_company_name, settings?.branding_company_tagline]);

  return null;
};
