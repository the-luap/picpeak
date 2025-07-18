import React from 'react';
import type { Photo } from '../../../types';

export interface BaseGalleryLayoutProps {
  photos: Photo[];
  slug: string;
  onPhotoClick: (index: number) => void;
  onDownload: (photo: Photo, e: React.MouseEvent) => void;
  selectedPhotos?: Set<number>;
  isSelectionMode?: boolean;
  onPhotoSelect?: (photoId: number) => void;
  eventName?: string;
  eventLogo?: string | null;
  eventDate?: string;
  expiresAt?: string;
}

export abstract class BaseGalleryLayout<T extends BaseGalleryLayoutProps = BaseGalleryLayoutProps> extends React.Component<T> {
  abstract render(): React.ReactNode;
}