import { beforeEach, expect, it, vi } from 'vitest';
import { api } from '../../config/api';
import { galleryService } from '../gallery.service';
vi.mock('../../config/api', () => ({ api: { get: vi.fn() } }));
const get = vi.mocked(api.get);
beforeEach(() => get.mockReset());
it('joins bounded pages without losing filter, identity, cancellation or unique photo IDs', async () => {
  const signal = new AbortController().signal;
  get.mockResolvedValueOnce({ data: { event: { require_password: 0 }, photos: [{ id: 1 }, { id: 2 }], pagination: { page: 1, has_more: true } } })
    .mockResolvedValueOnce({ data: { photos: [{ id: 2 }, { id: 3 }], pagination: { page: 2, has_more: false } } });
  const result = await galleryService.getGalleryPhotos('wedding', 'liked', 'guest', signal);
  expect(result.photos.map(photo => photo.id)).toEqual([1, 2, 3]);
  expect(result.event.require_password).toBe(false);
  expect(get).toHaveBeenNthCalledWith(1, '/gallery/wedding/photos', { params: { limit: 250, page: 1, filter: 'liked', guest_id: 'guest' }, signal });
  expect(get).toHaveBeenNthCalledWith(2, '/gallery/wedding/photos', { params: { limit: 250, page: 2, filter: 'liked', guest_id: 'guest' }, signal });
});
it('accepts legacy unpaged responses', async () => {
  get.mockResolvedValueOnce({ data: { event: {}, photos: [{ id: 1 }] } });
  expect((await galleryService.getGalleryPhotos('legacy')).photos).toEqual([{ id: 1 }]);
  expect(get).toHaveBeenCalledOnce();
});
it('propagates a cancelled page instead of returning an incomplete gallery', async () => {
  get.mockResolvedValueOnce({ data: { event: {}, photos: [{ id: 1 }], pagination: { page: 1, has_more: true } } })
    .mockRejectedValueOnce(new DOMException('Aborted', 'AbortError'));
  await expect(galleryService.getGalleryPhotos('wedding')).rejects.toMatchObject({ name: 'AbortError' });
});
