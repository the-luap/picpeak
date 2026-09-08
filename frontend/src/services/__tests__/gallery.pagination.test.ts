import { beforeEach, expect, it, vi } from 'vitest';
import { api } from '../../config/api';
import { galleryService } from '../gallery.service';
vi.mock('../../config/api', () => ({ api: { get: vi.fn() } }));
const get = vi.mocked(api.get);
// Braces matter: a returned mock would be treated as a cleanup hook and called.
beforeEach(() => { get.mockReset(); });
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
it('fetches the remaining known pages concurrently and keeps server order', async () => {
  const page = (n: number, total = 750) => ({ data: { event: {}, photos: [{ id: n * 10 }, { id: n * 10 + 1 }], pagination: { page: n, limit: 250, total, has_more: n < 3 } } });
  get.mockImplementation(async (_url, config) => page(Number((config as { params: { page: number } }).params.page)));
  const result = await galleryService.getGalleryPhotos('wedding');
  expect(result.photos.map(photo => photo.id)).toEqual([10, 11, 20, 21, 30, 31]);
  expect(get).toHaveBeenCalledTimes(3);
  // Pages 2 and 3 are requested before either resolves.
  expect(get.mock.calls.map(call => (call[1] as { params: { page: number } }).params.page)).toEqual([1, 2, 3]);
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
