import { useCallback, useEffect, useState, type SetStateAction } from 'react';

/** Keep the selected photo through reordering/refetches; clamp after removal. */
export function usePhotoSelection<T extends { id: number }>(photos: T[], initialIndex = 0) {
  const [selection, setSelection] = useState(() => ({ id: photos[initialIndex]?.id, index: initialIndex }));
  const found = photos.findIndex(photo => photo.id === selection.id);
  const currentIndex = found >= 0 ? found : Math.max(0, Math.min(selection.index, photos.length - 1));
  const currentPhoto = photos[currentIndex];

  useEffect(() => {
    if (currentPhoto && (currentPhoto.id !== selection.id || currentIndex !== selection.index)) {
      setSelection({ id: currentPhoto.id, index: currentIndex });
    }
  }, [currentPhoto, currentIndex, selection.id, selection.index]);

  const setCurrentIndex = useCallback((next: SetStateAction<number>) => {
    setSelection(previous => {
      const previousIndex = photos.findIndex(photo => photo.id === previous.id);
      const index = previousIndex >= 0 ? previousIndex : Math.max(0, Math.min(previous.index, photos.length - 1));
      const requested = typeof next === 'function' ? next(index) : next;
      const clamped = Math.max(0, Math.min(requested, photos.length - 1));
      return { id: photos[clamped]?.id, index: clamped };
    });
  }, [photos]);
  return { currentPhoto, currentIndex, setCurrentIndex };
}
