import React from 'react';
import type { Photo } from '../../../types';

export interface BaseGalleryLayoutProps {
  photos: Photo[];
  slug: string;
  onPhotoClick: (index: number) => void;
  // Optional: open the lightbox with feedback panel visible
  onOpenPhotoWithFeedback?: (index: number) => void;
  // Notify parent that feedback (like/favorite/rating/comment) changed
  onFeedbackChange?: () => void;
  onDownload: (photo: Photo, e: React.MouseEvent) => void;
  selectedPhotos?: Set<number>;
  isSelectionMode?: boolean;
  onPhotoSelect?: (photoId: number) => void;
  eventName?: string;
  eventLogo?: string | null;
  eventDate?: string;
  expiresAt?: string;
  allowDownloads?: boolean;
  protectionLevel?: 'basic' | 'standard' | 'enhanced' | 'maximum';
  useEnhancedProtection?: boolean;
  feedbackEnabled?: boolean;
  feedbackOptions?: {
    allowLikes?: boolean;
    allowFavorites?: boolean;
    allowRatings?: boolean;
    allowComments?: boolean;
    requireNameEmail?: boolean;
  };
}

export abstract class BaseGalleryLayout<T extends BaseGalleryLayoutProps = BaseGalleryLayoutProps> extends React.Component<T> {
  abstract render(): React.ReactNode;
}
