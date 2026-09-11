/**
 * Bounded, reclaimable storage reads for archiver downloads (#1399 follow-up).
 *
 * archiver drains the sources it is handed one at a time, so appending a
 * storage read per photo opens N and drains one. Every other read parks its
 * socket holding unread bytes, and nothing reclaims them: archiver's abort()
 * does not touch source streams, and the S3 SDK clears its socket timeout as
 * soon as response headers land. That is the mechanism behind the incident in
 * PR #1402 — 43 of 50 pooled sockets held, uploads starved, restart required.
 *
 * #1402 fixes the cached-zip builder. These are the guarantees the same guard
 * has to give the three remaining call sites, two of which need no admin
 * credentials to reach.
 */
const { Readable } = require('stream');
const { createArchiveStreamGuard } = require('../../src/utils/archiveStreamGuard');

const makeStream = () => new Readable({ read() {} });

describe('archiveStreamGuard (#1399 follow-up)', () => {
  it('lets the configured number of reads run at once', async () => {
    const guard = createArchiveStreamGuard({ maxInFlight: 2 });
    expect(await guard.acquire()).toBe(true);
    guard.track(makeStream());
    expect(await guard.acquire()).toBe(true);
    guard.track(makeStream());
    expect(guard.openCount).toBe(2);
  });

  it('parks the next acquire until a read finishes', async () => {
    const guard = createArchiveStreamGuard({ maxInFlight: 1 });
    await guard.acquire();
    const first = guard.track(makeStream());

    let resumed = false;
    const pending = guard.acquire().then((ok) => { resumed = ok; });

    await new Promise((r) => setImmediate(r));
    expect(resumed).toBe(false); // still parked — this is the cap doing its job

    first.push(null);
    first.resume();
    await pending;
    expect(resumed).toBe(true);
  });

  it('releases a slot when a read errors, not just when it ends', async () => {
    const guard = createArchiveStreamGuard({ maxInFlight: 1 });
    await guard.acquire();
    const stream = guard.track(makeStream());
    stream.on('error', () => {});
    stream.destroy(new Error('socket died'));
    // Without the error listener the slot would never come back and the next
    // photo would park forever.
    expect(await guard.acquire()).toBe(true);
  });

  it('reports a failed read so the caller can abort the archive', async () => {
    // A stream that errors while still QUEUED has no archiver listener on it
    // yet. Releasing its slot and saying nothing leaves a dead stream in the
    // queue, and the archive hangs when it reaches it.
    const seen = [];
    const guard = createArchiveStreamGuard({ maxInFlight: 2, onFatalError: (e) => seen.push(e) });
    await guard.acquire();
    const queued = guard.track(makeStream());
    queued.on('error', () => {});
    queued.destroy(new Error('socket died'));
    await new Promise((r) => setImmediate(r)); // 'error' lands on the next tick
    expect(seen).toHaveLength(1);
    expect(seen[0].message).toBe('socket died');
  });

  it('stays quiet about reads it destroyed itself', async () => {
    // destroyAll is the caller's own teardown; reporting those back as fatal
    // would re-enter the abort path it is already running.
    const seen = [];
    const guard = createArchiveStreamGuard({ onFatalError: (e) => seen.push(e) });
    await guard.acquire();
    const s1 = guard.track(makeStream());
    s1.on('error', () => {});
    guard.destroyAll();
    await new Promise((r) => setImmediate(r));
    expect(seen).toHaveLength(0);
  });

  it('destroys every read still holding bytes', async () => {
    const guard = createArchiveStreamGuard({ maxInFlight: 5 });
    const streams = [makeStream(), makeStream(), makeStream()];
    for (const s of streams) { await guard.acquire(); guard.track(s); }
    expect(guard.openCount).toBe(3);

    guard.destroyAll();
    expect(streams.every((s) => s.destroyed)).toBe(true);
    expect(guard.openCount).toBe(0);
  });

  it('wakes a parked acquire on destroyAll so the loop can exit', async () => {
    const guard = createArchiveStreamGuard({ maxInFlight: 1 });
    await guard.acquire();
    guard.track(makeStream());

    const pending = guard.acquire();
    guard.destroyAll();
    // false, so the caller breaks out instead of appending to a dead archive.
    expect(await pending).toBe(false);
  });

  it('destroys a stream tracked after shutdown rather than leaking it', () => {
    const guard = createArchiveStreamGuard();
    guard.destroyAll();
    const late = guard.track(makeStream());
    expect(late.destroyed).toBe(true);
    expect(guard.openCount).toBe(0);
  });

  it('tolerates destroyAll twice — exit paths overlap', () => {
    const guard = createArchiveStreamGuard();
    guard.track(makeStream());
    guard.destroyAll();
    expect(() => guard.destroyAll()).not.toThrow();
  });
});
