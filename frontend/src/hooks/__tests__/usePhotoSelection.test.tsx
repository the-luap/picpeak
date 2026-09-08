import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { usePhotoSelection } from '../usePhotoSelection';
describe('photo selection through changing query results', () => {
  it('handles empty → populated → reordered → removed → empty without changing hook order', () => {
    const { result, rerender } = renderHook(({ photos }) => usePhotoSelection(photos, 1), { initialProps: { photos: [] as { id: number }[] } });
    expect(result.current.currentPhoto).toBeUndefined();
    rerender({ photos: [{ id: 1 }, { id: 2 }, { id: 3 }] }); expect(result.current.currentPhoto?.id).toBe(2);
    rerender({ photos: [{ id: 3 }, { id: 2 }, { id: 1 }] }); expect(result.current.currentPhoto?.id).toBe(2);
    act(() => result.current.setCurrentIndex(2)); expect(result.current.currentPhoto?.id).toBe(1);
    rerender({ photos: [{ id: 3 }, { id: 2 }] }); expect(result.current.currentPhoto?.id).toBe(2);
    rerender({ photos: [] }); expect(result.current.currentPhoto).toBeUndefined();
    rerender({ photos: [{ id: 2 }, { id: 4 }] }); expect(result.current.currentPhoto?.id).toBe(2);
  });
});
