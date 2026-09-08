import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import { galleryService } from '../../../services/gallery.service';
export function useGalleryUpload(slug: string, refetch: (options?: { cancelRefetch?: boolean }) => Promise<unknown>, onClose: () => void) {
  const { t } = useTranslation();
  const uploadRefreshTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [uploadProcessing, setUploadProcessing] = useState<{ complete: number; total: number } | null>(null);
  const generation = useRef(0);
  const stopUploadRefresh = () => {
    generation.current++;
    if (uploadRefreshTimerRef.current) {
      clearInterval(uploadRefreshTimerRef.current);
      uploadRefreshTimerRef.current = null;
    }
  };
  useEffect(() => stopUploadRefresh, [slug]);

  const handleUploadComplete = (uploadIds: string[] = []) => {
    onClose();
    stopUploadRefresh();

    // Nothing to follow (no id came back, e.g. every file failed on the wire).
    // Refetch once rather than polling something unknowable.
    if (uploadIds.length === 0) {
      void refetch();
      return;
    }

    setUploadProcessing({ complete: 0, total: uploadIds.length });
    const batch = generation.current;
    const deadline = Date.now() + 120_000;
    let lastComplete = 0;
    let inFlight = false;

    const finish = async (announce?: () => void) => {
      stopUploadRefresh();
      setUploadProcessing(null);
      await refetch();
      if (generation.current === batch + 1) announce?.();
    };

    const poll = async () => {
      // The interval keeps firing while a slow request is open; without this
      // the requests stack up for the whole deadline.
      if (inFlight) return;
      inFlight = true;
      try {
        const status = await galleryService.getUploadStatus(slug, uploadIds);
        if (batch !== generation.current) return;
        setUploadProcessing({
          complete: status.complete + status.failed,
          total: status.total || uploadIds.length,
        });

        // Refetch as each photo lands, not only once the batch settles, so a
        // large upload fills the grid progressively.
        if (status.complete > lastComplete) {
          lastComplete = status.complete;
          // Default cancelRefetch aborts the multi-page fetch still in flight
          // from the previous poll, so a large gallery would never fill in.
          void refetch({ cancelRefetch: false });
        }

        if (status.pending === 0 && status.processing === 0) {
          await finish(() => {
            if (status.failed > 0) {
              toast.error(t('upload.processingFailed', { count: status.failed }));
            }
          });
        } else if (Date.now() > deadline) {
          // Bounded. The worker is genuinely still running, so say that rather
          // than leaving the guest with a grid that quietly never updated.
          await finish(() => toast.info(t('upload.processingStillRunning')));
        }
      } catch {
        if (batch !== generation.current) return;
        // The status signal is a convenience — the photos are stored either
        // way — so a failing status call degrades to the plain refetch.
        await finish();
      } finally {
        inFlight = false;
      }
    };

    uploadRefreshTimerRef.current = setInterval(poll, 2000);
    void poll();
  };

  return { uploadProcessing, handleUploadComplete };
}
