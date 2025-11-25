import React, { useState, useEffect } from 'react';
import { buildResourceUrl } from '../../utils/url';
import {
  getActiveGallerySlug,
  getGalleryToken,
  inferGallerySlugFromLocation,
  resolveSlugFromRequestUrl,
} from '../../utils/galleryAuthStorage';

interface AuthenticatedImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  fallbackSrc?: string;
  useWatermark?: boolean;
  isGallery?: boolean;
  protectFromDownload?: boolean;
  slug?: string;
  photoId?: number;
  requiresToken?: boolean;
  secureUrlTemplate?: string;
  downloadUrlTemplate?: string;
  onProtectionViolation?: (violationType: string) => void;
  watermarkText?: string;
  overlayProtection?: boolean;
  fragmentGrid?: boolean;
  scrambleFragments?: boolean;
  useCanvasRendering?: boolean;
  blockKeyboardShortcuts?: boolean;
  detectPrintScreen?: boolean;
  detectDevTools?: boolean;
  protectionLevel?: 'basic' | 'standard' | 'enhanced' | 'maximum';
  useEnhancedProtection?: boolean;
}

export const AuthenticatedImage: React.FC<AuthenticatedImageProps> = ({
  src,
  fallbackSrc,
  alt,
  useWatermark = false,
  isGallery = false,
  protectFromDownload,
  slug,
  photoId,
  requiresToken,
  secureUrlTemplate,
  downloadUrlTemplate,
  onProtectionViolation,
  watermarkText,
  overlayProtection,
  fragmentGrid,
  scrambleFragments,
  useCanvasRendering,
  blockKeyboardShortcuts,
  detectPrintScreen,
  detectDevTools,
  protectionLevel,
  useEnhancedProtection,
  ...props
}) => {
  const unusedProps = {
    protectFromDownload,
    photoId,
    requiresToken,
    secureUrlTemplate,
    downloadUrlTemplate,
    onProtectionViolation,
    watermarkText,
    overlayProtection,
    fragmentGrid,
    scrambleFragments,
    useCanvasRendering,
    blockKeyboardShortcuts,
    detectPrintScreen,
    detectDevTools,
    protectionLevel,
    useEnhancedProtection
  };
  void unusedProps;

  const [imageSrc, setImageSrc] = useState<string>('');
  const [error, setError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let aborted = false;
    const objectUrls: string[] = [];

    // Determine which token to use based on context
    if (!src) {
      setImageSrc(fallbackSrc || '');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(false);

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

      // Build full URL for the image
      const fullImageUrl = rawUrl.startsWith('/admin')
        ? buildResourceUrl(`/api${rawUrl}`)
        : rawUrl.startsWith('/')
          ? buildResourceUrl(rawUrl)
          : rawUrl;

      const headers: Record<string, string> = {};
      const slugForRequest = resolveSlug(rawUrl);
      const token = getGalleryToken(slugForRequest);
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      const response = await fetch(fullImageUrl, {
        credentials: 'include',
        headers: Object.keys(headers).length ? headers : undefined,
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`);
      }

      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      objectUrls.push(objectUrl);
      return objectUrl;
    };

    const fetchImage = async () => {
      try {
        const primaryUrl = await fetchWithAuth(src);
        if (!aborted) {
          setImageSrc(primaryUrl);
          setError(false);
        }
      } catch (err) {
        setIsLoading(false);
        if (fallbackSrc && fallbackSrc !== src) {
          try {
            const fallbackUrl = await fetchWithAuth(fallbackSrc);
            if (!aborted) {
              setImageSrc(fallbackUrl);
              setError(false);
            }
            return;
          } catch (fallbackError) {
            // Swallow and mark error below
          }
        }
        if (!aborted) {
          setError(true);
          setImageSrc('');
        }
        return;
      }
      if (!aborted) {
        setIsLoading(false);
      }
    };

    fetchImage();

    // Cleanup function
    return () => {
      aborted = true;
      objectUrls.forEach((url) => URL.revokeObjectURL(url));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src, fallbackSrc, slug]);

  if (isLoading) {
    return (
      <div className={props.className} style={{ backgroundColor: '#f3f4f6', ...props.style }}>
        {/* Show a placeholder while loading */}
      </div>
    );
  }

  if (error && fallbackSrc) {
    return <img src={fallbackSrc} alt={alt} {...props} />;
  }

  if (!imageSrc) {
    return null;
  }

  return <img src={imageSrc} alt={alt} {...props} />;
};
