/**
 * Bounded, reclaimable storage reads for archiver-based downloads.
 *
 * archiver consumes the sources it is handed one at a time. Appending a
 * storage read per photo in a tight loop therefore opens N reads and drains
 * one, and every other one parks an S3 socket holding megabytes of unread
 * body. Nothing reclaims them on its own: archiver's abort() does not touch
 * its source streams, and the SDK arms its socket timeout on a 3s delay and
 * clears it the moment response headers land, so a fast response never gets
 * one at all.
 *
 * That is the shape of the incident in PR #1402 — 43 of 50 pooled sockets
 * ESTABLISHED with unread bytes, uploads and gallery reads starved behind
 * them, a process restart the only way out. #1402 fixes the cached-zip
 * builder. This is the same guard for the other three call sites, two of
 * which a gallery guest can reach with no admin credentials at all.
 *
 * Local-filesystem installs are unaffected — they take archiver's
 * `archive.file(path)` branch and open no sockets — which is most likely why
 * this went unnoticed for so long.
 */

// Two in flight: one being drained, one ready to go. Enough to keep archiver
// fed, few enough that a build cannot monopolise the agent pool.
const DEFAULT_MAX_IN_FLIGHT = 2;

function createArchiveStreamGuard({ maxInFlight = DEFAULT_MAX_IN_FLIGHT } = {}) {
  const openReads = new Set();
  let waiter = null;
  let closed = false;

  const wake = () => {
    if (!waiter) return;
    const resume = waiter;
    waiter = null;
    resume();
  };

  const release = (stream) => {
    openReads.delete(stream);
    wake();
  };

  return {
    /** Park until a read slot frees up. Returns false once destroyAll ran. */
    async acquire() {
      while (!closed && openReads.size >= maxInFlight) {
        await new Promise((resolve) => { waiter = resolve; });
      }
      return !closed;
    },

    /** Register a stream and hand it straight back, for inline use. */
    track(stream) {
      if (closed) {
        stream.destroy();
        return stream;
      }
      openReads.add(stream);
      stream.once('end', () => release(stream));
      stream.once('close', () => release(stream));
      stream.once('error', () => release(stream));
      return stream;
    },

    /**
     * Destroy every read still holding bytes. Safe to call more than once —
     * the exit paths overlap (client disconnect and an error can both fire).
     */
    destroyAll() {
      closed = true;
      for (const stream of openReads) {
        try {
          stream.destroy();
        } catch {
          // Already gone; nothing to reclaim.
        }
      }
      openReads.clear();
      wake();
    },

    get openCount() {
      return openReads.size;
    },
  };
}

module.exports = { createArchiveStreamGuard, DEFAULT_MAX_IN_FLIGHT };
