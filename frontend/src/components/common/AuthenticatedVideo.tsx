import React, { useEffect, useState } from 'react';
import { buildResourceUrl } from '../../utils/url';
import {
  getActiveGallerySlug,
  getGalleryToken,
  inferGallerySlugFromLocation,
  resolveSlugFromRequestUrl,
} from '../../utils/galleryAuthStorage';

interface AuthenticatedVideoProps extends React.VideoHTMLAttributes<HTMLVideoElement> {
  src: string;
  fallbackSrc?: string;
  slug?: string;
}

/**
 * Admin draft preview (#1386). Native fetch() bypasses the axios interceptor,
 * so the intent flag has to be put on the URL here. The HttpOnly admin cookie
 * rides along on its own because these requests use credentials: 'include' —
 * only the flag is missing. Without this, a preview of an unpublished gallery
 * loads its metadata and then shows no thumbnails, hero or lightbox media.
 */
function withAdminPreview(url: string, isRelative: boolean): string {
  if (!isRelative || typeof window === 'undefined') return url;
  if (new URLSearchParams(window.location.search).get('admin_preview') !== '1') return url;
  return `${url}${url.includes('?') ? '&' : '?'}admin_preview=1`;
}

export const AuthenticatedVideo: React.FC<AuthenticatedVideoProps> = ({
  src,
  fallbackSrc,
  slug,
  ...props
}) => {
  const [videoSrc, setVideoSrc] = useState<string>('');
  const [error, setError] = useState(false);

  useEffect(() => {
    let aborted = false;
    const objectUrls: string[] = [];

    if (!src) {
      setVideoSrc('');
      setError(true);
      return;
    }

    const resolveSlug = (candidateSrc?: string): string | null => {
      if (slug) {
        return slug;
      }
      const fromUrl = candidateSrc ? resolveSlugFromRequestUrl(candidateSrc) : null;
      if (fromUrl) {
        return fromUrl;
      }
      return getActiveGallerySlug() || inferGallerySlugFromLocation();
    };

    const fetchWithAuth = async (rawUrl: string | undefined | null): Promise<string> => {
      if (!rawUrl) {
        throw new Error('No URL provided');
      }

      const fullUrl = rawUrl.startsWith('/')
        ? buildResourceUrl(rawUrl)
        : rawUrl;

      const headers: Record<string, string> = {};
      const slugForRequest = resolveSlug(rawUrl);
      const token = getGalleryToken(slugForRequest);
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      const response = await fetch(withAdminPreview(fullUrl, rawUrl.startsWith('/')), {
        credentials: 'include',
        headers: Object.keys(headers).length ? headers : undefined,
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch media: ${response.status} ${response.statusText}`);
      }

      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      objectUrls.push(objectUrl);
      return objectUrl;
    };

    const load = async () => {
      try {
        const primaryUrl = await fetchWithAuth(src);
        if (!aborted) {
          setVideoSrc(primaryUrl);
          setError(false);
        }
      } catch (err) {
        if (fallbackSrc && fallbackSrc !== src) {
          try {
            const fallbackUrl = await fetchWithAuth(fallbackSrc);
            if (!aborted) {
              setVideoSrc(fallbackUrl);
              setError(false);
            }
            return;
          } catch (_) {
            // ignore and set error below
          }
        }
        if (!aborted) {
          setError(true);
          setVideoSrc('');
        }
      }
    };

    load();

    return () => {
      aborted = true;
      objectUrls.forEach((url) => URL.revokeObjectURL(url));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src, fallbackSrc, slug]);

  if (error || !videoSrc) {
    return null;
  }

  return (
    <video
      src={videoSrc}
      controls
      preload="metadata"
      {...props}
    />
  );
};
