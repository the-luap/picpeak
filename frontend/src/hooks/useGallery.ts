import { useQuery, useMutation } from '@tanstack/react-query';
import { galleryService } from '../services';
import { toast } from 'react-toastify';

export const useGalleryInfo = (slug: string, token?: string) => {
  return useQuery({
    queryKey: ['gallery-info', slug, token],
    queryFn: () => galleryService.getGalleryInfo(slug, token),
    retry: 1,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

export const useGalleryPhotos = (
  slug: string,
  filter?: 'liked' | 'commented' | 'rated' | 'all',
  guestId?: string,
  enabled: boolean = true
) => {
  return useQuery({
    queryKey: ['gallery-photos', slug, filter, guestId],
    // Pass guestId so backend can filter per-guest views when needed
    queryFn: () => galleryService.getGalleryPhotos(slug, filter, guestId),
    enabled,
    retry: 1,
    staleTime: 5 * 60 * 1000, // 5 minutes
    // Add a small delay to ensure auth token is properly set
    retryDelay: 100,
  });
};

export const useGalleryStats = (slug: string, enabled: boolean = true) => {
  return useQuery({
    queryKey: ['gallery-stats', slug],
    queryFn: () => galleryService.getGalleryStats(slug),
    enabled,
    retry: 1,
    staleTime: 60 * 1000, // 1 minute
  });
};

export const useDownloadPhoto = () => {
  return useMutation({
    mutationFn: ({
      slug,
      photoId,
      filename,
    }: {
      slug: string;
      photoId: number;
      filename: string;
    }) => galleryService.downloadPhoto(slug, photoId, filename),
    onSuccess: () => {
      toast.success('Photo downloaded successfully');
    },
    onError: () => {
      toast.error('Failed to download photo');
    },
  });
};

export const useDownloadAllPhotos = () => {
  return useMutation({
    mutationFn: (slug: string) => galleryService.downloadAllPhotos(slug),
    onSuccess: () => {
      toast.success('Download started');
    },
    onError: () => {
      toast.error('Failed to download photos');
    },
  });
};
