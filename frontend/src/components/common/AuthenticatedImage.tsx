import React, { useState, useEffect } from 'react';
import { getAuthToken } from '../../config/api';
import { buildResourceUrl } from '../../utils/url';

interface AuthenticatedImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  fallbackSrc?: string;
  useWatermark?: boolean;
  isGallery?: boolean;
}

export const AuthenticatedImage: React.FC<AuthenticatedImageProps> = ({
  src,
  fallbackSrc,
  alt,
  useWatermark = false,
  isGallery = false,
  ...props
}) => {
  const [imageSrc, setImageSrc] = useState<string>('');
  const [error, setError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let objectUrl: string | null = null;

    // Determine which token to use based on context
    let token: string | undefined;
    
    if (isGallery) {
      // For gallery images, get the gallery-specific token
      const pathParts = window.location.pathname.split('/');
      if (pathParts[1] === 'gallery' && pathParts[2]) {
        const gallerySlug = pathParts[2];
        token = localStorage.getItem(`gallery_token_${gallerySlug}`) || undefined;
      }
    } else {
      // For admin images, use the admin token
      token = getAuthToken(true);
    }
    
    if (!src) {
      setImageSrc(fallbackSrc || '');
      setIsLoading(false);
      return;
    }

    if (!token) {
      // No auth token - use fallback
      setImageSrc(fallbackSrc || '');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(false);

    // Create a new URL with auth header
    const fetchImage = async () => {
      try {
        // Use the src as-is since it should already be the correct endpoint
        let imageUrl = src;
        
        // Build full URL for the image
        // For API paths that start with /admin, we need to prepend /api
        const fullImageUrl = imageUrl.startsWith('/admin') 
          ? buildResourceUrl(`/api${imageUrl}`)
          : imageUrl.startsWith('/') 
          ? buildResourceUrl(imageUrl) 
          : imageUrl;
        
        // Fetch authenticated image
        const response = await fetch(fullImageUrl, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`);
        }

        const blob = await response.blob();
        objectUrl = URL.createObjectURL(blob);
        setImageSrc(objectUrl);
        setIsLoading(false);
      } catch (err) {
        // Image loading failed - use fallback
        setError(true);
        setImageSrc(fallbackSrc || '');
        setIsLoading(false);
      }
    };

    fetchImage();

    // Cleanup function
    return () => {
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [src, fallbackSrc, useWatermark, isGallery]);

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