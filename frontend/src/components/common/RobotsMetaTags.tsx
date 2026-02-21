import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getApiBaseUrl } from '../../utils/url';

export const RobotsMetaTags: React.FC = () => {
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
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    // Remove any existing robots meta tags we previously injected
    document.querySelectorAll('meta[name="robots"][data-picpeak]').forEach(el => el.remove());

    const directives: string[] = [];
    if (settings?.seo_meta_noindex) directives.push('noindex');
    if (settings?.seo_meta_nofollow) directives.push('nofollow');

    if (directives.length > 0) {
      const meta = document.createElement('meta');
      meta.name = 'robots';
      meta.content = directives.join(', ');
      meta.setAttribute('data-picpeak', 'true');
      document.head.appendChild(meta);
    }

    if (settings?.seo_meta_noai) {
      const metaAi = document.createElement('meta');
      metaAi.name = 'robots';
      metaAi.content = 'noai, noimageai';
      metaAi.setAttribute('data-picpeak', 'true');
      document.head.appendChild(metaAi);
    }

    return () => {
      document.querySelectorAll('meta[name="robots"][data-picpeak]').forEach(el => el.remove());
    };
  }, [settings?.seo_meta_noindex, settings?.seo_meta_nofollow, settings?.seo_meta_noai]);

  return null;
};
