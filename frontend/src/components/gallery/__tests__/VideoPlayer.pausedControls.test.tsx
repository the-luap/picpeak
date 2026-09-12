/**
 * While paused, the centre play overlay must not swallow the control bar.
 *
 * The overlay is `absolute inset-0` and renders after the control bar, so it
 * sat on top of the fullscreen, mute and progress controls whenever the video
 * was paused — which is exactly when a guest reaches for fullscreen. Clicks
 * landed on the overlay's wrapper div and did nothing.
 *
 * Fullscreen also only ever tried `video.requestFullscreen()`, which iPhone
 * Safari does not implement (it only offers `webkitEnterFullscreen` on the
 * video element), so the maximize button was a no-op there.
 *
 * The auto-hide timer made it worse on desktop: it captured `isPlaying` when
 * the mouse last moved, so pausing within three seconds of a mouse move hid
 * the controls anyway, and resting the pointer on the bar to click pause let
 * the bar fade out from under the cursor.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { act } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';

import { VideoPlayer } from '../VideoPlayer';

type FullscreenTarget = HTMLElement & {
  requestFullscreen?: () => Promise<void>;
  webkitRequestFullscreen?: () => Promise<void>;
};

describe('VideoPlayer paused-state controls', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('lets clicks through the paused overlay to the control bar', () => {
    render(<VideoPlayer src="/api/gallery/e/photo/1" />);

    const [transportPlay, centrePlay] = screen.getAllByLabelText('Play');
    const overlay = centrePlay.parentElement!;

    expect(overlay.className).toContain('pointer-events-none');
    expect(centrePlay.className).toContain('pointer-events-auto');
    // The transport button lives in the control bar, not under the overlay.
    expect(overlay.contains(transportPlay)).toBe(false);
  });

  it('goes fullscreen on the container so the custom controls come along', async () => {
    const { container } = render(<VideoPlayer src="/api/gallery/e/photo/1" />);
    const root = container.firstElementChild as FullscreenTarget;
    const request = vi.fn().mockResolvedValue(undefined);
    root.requestFullscreen = request;

    fireEvent.click(screen.getByLabelText('Fullscreen'));
    await vi.waitFor(() => expect(screen.getByLabelText('Exit fullscreen')).toBeInTheDocument());
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('falls back to webkitEnterFullscreen on the video (iPhone Safari)', async () => {
    const { container } = render(<VideoPlayer src="/api/gallery/e/photo/1" />);
    const root = container.firstElementChild as FullscreenTarget;
    root.requestFullscreen = undefined;
    root.webkitRequestFullscreen = undefined;
    const video = container.querySelector('video') as HTMLVideoElement & {
      webkitEnterFullscreen?: () => void;
    };
    const enter = vi.fn();
    video.webkitEnterFullscreen = enter;

    fireEvent.click(screen.getByLabelText('Fullscreen'));
    await vi.waitFor(() => expect(enter).toHaveBeenCalledTimes(1));
    // The native player owns the state until it fires webkitendfullscreen.
    expect(screen.getByLabelText('Fullscreen')).toBeInTheDocument();
  });

  it('drops the fullscreen state when the user exits with Esc', async () => {
    const { container } = render(<VideoPlayer src="/api/gallery/e/photo/1" />);
    const root = container.firstElementChild as FullscreenTarget;
    root.requestFullscreen = vi.fn().mockResolvedValue(undefined);

    fireEvent.click(screen.getByLabelText('Fullscreen'));
    await vi.waitFor(() => expect(screen.getByLabelText('Exit fullscreen')).toBeInTheDocument());

    // jsdom never sets fullscreenElement; Esc leaves it null, as it would be.
    fireEvent(document, new Event('fullscreenchange'));
    expect(screen.getByLabelText('Fullscreen')).toBeInTheDocument();
  });

  it('keeps the controls visible after a pause, even if a hide was already scheduled', () => {
    vi.useFakeTimers();
    try {
      const { container } = render(<VideoPlayer src="/api/gallery/e/photo/1" />);
      const video = container.querySelector('video')!;
      const root = container.firstElementChild as HTMLElement;

      fireEvent.play(video);
      fireEvent.mouseMove(root); // arms the 3s hide while playing
      fireEvent.pause(video); // guest clicks the video to pause
      act(() => {
        vi.advanceTimersByTime(3500);
      });

      const bar = screen.getByLabelText('Fullscreen').closest('div.absolute')!;
      expect(bar.className).toContain('opacity-100');
      expect(screen.getAllByLabelText('Play')).toHaveLength(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it('does not hide the bar while the pointer is resting on it', () => {
    vi.useFakeTimers();
    try {
      const { container } = render(<VideoPlayer src="/api/gallery/e/photo/1" />);
      const video = container.querySelector('video')!;
      const root = container.firstElementChild as HTMLElement;
      const bar = screen.getByLabelText('Fullscreen').closest('div.absolute')!;

      fireEvent.play(video);
      fireEvent.mouseMove(root);
      fireEvent.mouseEnter(bar);
      act(() => {
        vi.advanceTimersByTime(3500);
      });
      expect(bar.className).toContain('opacity-100');

      fireEvent.mouseLeave(bar);
      act(() => {
        vi.advanceTimersByTime(3500);
      });
      expect(bar.className).toContain('opacity-0');
      // A faded bar must not intercept the click that reaches for the video.
      expect(bar.className).toContain('pointer-events-none');
    } finally {
      vi.useRealTimers();
    }
  });
});
