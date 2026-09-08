import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { galleryService } from '../../../services/gallery.service';
import { toast } from 'react-toastify';
import { useGalleryUpload } from '../hooks/useGalleryUpload';

vi.mock('../../../services/gallery.service', () => ({ galleryService: { getUploadStatus: vi.fn() } }));
vi.mock('react-toastify', () => ({ toast: { error: vi.fn(), info: vi.fn() } }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
const pending = { total: 2, pending: 1, processing: 1, complete: 0, failed: 0 };
const status = vi.mocked(galleryService.getUploadStatus);
beforeEach(() => { vi.useFakeTimers(); vi.clearAllMocks(); status.mockReset().mockResolvedValue(pending); });
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });
function setup(slug = 'wedding') {
  const refetch = vi.fn().mockResolvedValue(undefined);
  const close = vi.fn();
  return { ...renderHook(({ slug }) => useGalleryUpload(slug, refetch, close), { initialProps: { slug } }), refetch, close };
}
async function tick(ms = 2000) { await act(async () => { await vi.advanceTimersByTimeAsync(ms); }); }

describe('post-upload refresh', () => {
  it('tracks uploads, refreshes progressively and stops after completion', async () => {
    const { result, refetch, close, unmount } = setup();
    await act(async () => { result.current.handleUploadComplete(['one', 'two']); });
    expect(close).toHaveBeenCalledOnce();
    expect(status).toHaveBeenLastCalledWith('wedding', ['one', 'two']);
    expect(result.current.uploadProcessing).toEqual({ complete: 0, total: 2 });
    status.mockResolvedValue({ ...pending, pending: 0, complete: 1 });
    await tick();
    expect(refetch).toHaveBeenCalledOnce();
    expect(result.current.uploadProcessing).toEqual({ complete: 1, total: 2 });
    status.mockResolvedValue({ ...pending, pending: 0, processing: 0, complete: 2 });
    await tick();
    expect(result.current.uploadProcessing).toBeNull();
    const calls = status.mock.calls.length;
    await tick(10_000);
    expect(status).toHaveBeenCalledTimes(calls);
    expect(toast.error).not.toHaveBeenCalled();
    unmount();
  });
  it('reports failed processing after the batch settles', async () => {
    status.mockResolvedValue({ ...pending, pending: 0, processing: 0, failed: 2 });
    const { result, refetch, unmount } = setup();
    await act(async () => { result.current.handleUploadComplete(['one', 'two']); });
    expect(toast.error).toHaveBeenCalledWith('upload.processingFailed');
    expect(result.current.uploadProcessing).toBeNull();
    expect(refetch).toHaveBeenCalledOnce();
    unmount();
  });
  it('bounds a pending batch and announces ongoing processing', async () => {
    const { result, refetch, unmount } = setup();
    await act(async () => { result.current.handleUploadComplete(['one', 'two']); });
    await tick(122_000);
    expect(result.current.uploadProcessing).toBeNull();
    expect(toast.info).toHaveBeenCalledWith('upload.processingStillRunning');
    expect(refetch).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
    unmount();
  });
  it('falls back to one refresh if status cannot be read', async () => {
    status.mockRejectedValue(new Error('offline'));
    const { result, refetch, unmount } = setup();
    await act(async () => { result.current.handleUploadComplete(['one']); });
    expect(refetch).toHaveBeenCalledOnce();
    expect(result.current.uploadProcessing).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
    unmount();
  });
  it('refreshes once without polling when there are no accepted uploads', async () => {
    const { result, refetch, unmount } = setup();
    await act(async () => { result.current.handleUploadComplete([]); });
    expect(refetch).toHaveBeenCalledOnce();
    expect(status).not.toHaveBeenCalled();
    unmount();
  });
  it.each(['unmount', 'navigate', 'new batch'] as const)('ignores an old request after %s', async (action) => {
    let resolve!: (value: typeof pending) => void;
    status.mockReturnValueOnce(new Promise(done => { resolve = done; }));
    const { result, refetch, rerender, unmount } = setup();
    await act(async () => { result.current.handleUploadComplete(['old']); });
    await tick(6000);
    expect(status).toHaveBeenCalledOnce();
    if (action === 'unmount') unmount();
    else if (action === 'navigate') rerender({ slug: 'another' });
    else await act(async () => { result.current.handleUploadComplete(['new']); });
    await act(async () => { resolve({ ...pending, pending: 0, processing: 0, complete: 1, failed: 1 }); });
    expect(refetch).not.toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
    if (action !== 'unmount') unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
