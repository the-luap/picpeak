/**
 * A video that fails to load has to say so (#1370).
 *
 * The element carried no `error` listener, so every failure — an unplayable
 * codec, a 403, a missing file — rendered identically: the poster frame, the
 * transport stuck at "0:00 / 0:00", and a play button that did nothing. The
 * reporter could not tell us which one they had hit, and neither could we.
 *
 * MEDIA_ERR_SRC_NOT_SUPPORTED gets its own wording because it is by far the
 * most common cause in practice (HEVC/H.265 phone footage plays in Safari and
 * nowhere else) and the useful advice for it — download the file — is not the
 * advice for a transport failure.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

import { VideoPlayer } from '../VideoPlayer';

function failWith(video: HTMLVideoElement, code: number) {
  Object.defineProperty(video, 'error', { value: { code }, configurable: true });
  fireEvent.error(video);
}

describe('VideoPlayer load errors (#1370)', () => {
  beforeAll(() => {
    // jsdom implements HTMLMediaElement but not the MediaError constants.
    if (typeof MediaError === 'undefined') {
      (globalThis as unknown as { MediaError: unknown }).MediaError = {
        MEDIA_ERR_ABORTED: 1,
        MEDIA_ERR_NETWORK: 2,
        MEDIA_ERR_DECODE: 3,
        MEDIA_ERR_SRC_NOT_SUPPORTED: 4,
      };
    }
  });

  it('shows the transport controls while nothing has gone wrong', () => {
    const { container } = render(<VideoPlayer src="/api/gallery/e/photo/1" />);
    expect(container.querySelector('video')).toBeInTheDocument();
    // Two: the transport button and the centre overlay.
    expect(screen.getAllByLabelText('Play')).toHaveLength(2);
    expect(screen.getByText('0:00 / 0:00')).toBeInTheDocument();
  });

  it('names the codec case and points at the download', () => {
    const { container } = render(<VideoPlayer src="/api/gallery/e/photo/1" />);
    failWith(container.querySelector('video')!, MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED);

    expect(screen.getByText(/cannot be played in this browser/i)).toBeInTheDocument();
    expect(screen.getByText(/Download it/i)).toBeInTheDocument();
  });

  it('reports a transport failure without blaming the format', () => {
    const { container } = render(<VideoPlayer src="/api/gallery/e/photo/1" />);
    failWith(container.querySelector('video')!, MediaError.MEDIA_ERR_NETWORK);

    expect(screen.getByText(/could not be loaded/i)).toBeInTheDocument();
    expect(screen.queryByText(/cannot be played in this browser/i)).not.toBeInTheDocument();
  });

  it('hides the 0:00 transport, which only ever misled', () => {
    const { container } = render(<VideoPlayer src="/api/gallery/e/photo/1" />);
    failWith(container.querySelector('video')!, MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED);

    expect(screen.queryByText('0:00 / 0:00')).not.toBeInTheDocument();
    // Including the centre overlay, which was the dead play button in the
    // screenshots on the issue.
    expect(screen.queryAllByLabelText('Play')).toHaveLength(0);
  });

  it('clears the error when the lightbox arrows to the next video', () => {
    const { container, rerender } = render(<VideoPlayer src="/api/gallery/e/photo/1" />);
    failWith(container.querySelector('video')!, MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED);
    expect(screen.getByText(/cannot be played in this browser/i)).toBeInTheDocument();

    rerender(<VideoPlayer src="/api/gallery/e/photo/2" />);
    expect(screen.queryByText(/cannot be played in this browser/i)).not.toBeInTheDocument();
    expect(screen.getByText('0:00 / 0:00')).toBeInTheDocument();
  });
});
