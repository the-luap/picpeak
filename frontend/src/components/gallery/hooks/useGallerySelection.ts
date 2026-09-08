import { useEffect, useState } from 'react';
import type { Photo } from '../../../types';
/** Selections survive a refetch but never retain deleted/restricted photo IDs. */
export function useGallerySelection(photos?: Photo[]) {
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedPhotos, setSelectedPhotos] = useState<Set<number>>(new Set());
  useEffect(() => {
    if (!photos) return;
    const ids = new Set(photos.map(photo => photo.id));
    setSelectedPhotos(previous => {
      const next = new Set([...previous].filter(id => ids.has(id)));
      return next.size === previous.size ? previous : next;
    });
  }, [photos]);
  return { isSelectionMode, setIsSelectionMode, selectedPhotos, setSelectedPhotos };
}
