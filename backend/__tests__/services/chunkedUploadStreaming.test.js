/**
 * A rejected chunk must not cost its own size in memory (#1403).
 *
 * The route used to drain the whole request into an array and `Buffer.concat`
 * it before calling uploadChunk, which is where every check lives — the
 * per-file cap, the chunk index, and even "does this upload id exist". So a
 * 300MB body against an unknown upload id was read in full, added ~300MB to
 * RSS, and was then answered with an error. The size cap was real but only
 * applied after the damage.
 *
 * The contract these tests pin: uploadChunk consumes NOTHING until every check
 * has passed, and once it does start reading it stops at the remaining
 * allowance rather than trusting the sender.
 */
const path = require('path');
const os = require('os');
const fs = require('fs').promises;
const { Readable } = require('stream');

process.env.STORAGE_PATH = path.join(os.tmpdir(), `picpeak-chunk-stream-test-${process.pid}`);

const chunkedUpload = require('../../src/services/chunkedUploadService');

const MB = 1024 * 1024;

const init = (overrides = {}) => chunkedUpload.initializeUpload({
  filename: 'clip.mp4',
  fileSize: 1,
  mimeType: 'video/mp4',
  eventId: 1,
  totalChunks: 2,
  maxFileSizeBytes: 1 * MB,
  ...overrides,
});

/**
 * A readable that reports how much of it was actually pulled. Bytes are
 * generated lazily, so "never read" really means the body never materialized.
 */
function countingSource(totalBytes, sliceSize = 64 * 1024) {
  let remaining = totalBytes;
  const source = new Readable({
    read() {
      if (remaining <= 0) return this.push(null);
      const n = Math.min(sliceSize, remaining);
      remaining -= n;
      source.bytesRead += n;
      this.push(Buffer.alloc(n));
    },
  });
  source.bytesRead = 0;
  return source;
}

describe('chunked upload streams the body under a cap (#1403)', () => {
  afterAll(async () => {
    await fs.rm(process.env.STORAGE_PATH, { recursive: true, force: true }).catch(() => {});
  });

  describe('refused before the body is read', () => {
    it('reads nothing for an unknown upload id', async () => {
      const source = countingSource(8 * MB);
      await expect(chunkedUpload.uploadChunk('does-not-exist', 0, source, { declaredBytes: 8 * MB }))
        .rejects.toThrow('Upload not found or expired');
      expect(source.bytesRead).toBe(0);
    });

    it('reads nothing for an out-of-range chunk index', async () => {
      const { uploadId } = await init();
      const source = countingSource(8 * MB);
      await expect(chunkedUpload.uploadChunk(uploadId, 99, source, { declaredBytes: 8 * MB }))
        .rejects.toMatchObject({ code: 'INVALID_CHUNK', statusCode: 400 });
      expect(source.bytesRead).toBe(0);
    });

    it('reads nothing when Content-Length already exceeds the cap', async () => {
      const { uploadId } = await init();
      const source = countingSource(8 * MB);
      await expect(chunkedUpload.uploadChunk(uploadId, 0, source, { declaredBytes: 8 * MB }))
        .rejects.toMatchObject({ code: 'FILE_TOO_LARGE', statusCode: 413 });
      expect(source.bytesRead).toBe(0);
      expect(chunkedUpload.getUploadStatus(uploadId)).toBeNull();
    });

    it('counts what earlier chunks already banked when checking Content-Length', async () => {
      const { uploadId } = await init();
      await chunkedUpload.uploadChunk(uploadId, 0, Buffer.alloc(0.75 * MB));
      const source = countingSource(0.5 * MB);
      // 0.75MB banked + 0.5MB declared > the 1MB cap.
      await expect(chunkedUpload.uploadChunk(uploadId, 1, source, { declaredBytes: 0.5 * MB }))
        .rejects.toMatchObject({ code: 'FILE_TOO_LARGE', statusCode: 413 });
      expect(source.bytesRead).toBe(0);
    });
  });

  describe('a sender that lies, or says nothing', () => {
    it('stops at the allowance instead of reading the whole body', async () => {
      const { uploadId } = await init();
      // No declaredBytes at all — the Transfer-Encoding: chunked case.
      const source = countingSource(8 * MB);
      await expect(chunkedUpload.uploadChunk(uploadId, 0, source))
        .rejects.toMatchObject({ code: 'FILE_TOO_LARGE', statusCode: 413 });
      // The overshoot is whatever the readable had already buffered ahead when
      // the cap tripped — a small constant tied to highWaterMark, NOT a
      // function of the body size. That is the whole claim: 8MB offered, ~1MB
      // read. The slack is deliberately loose so this doesn't turn into a
      // Node-version canary.
      expect(source.bytesRead).toBeLessThan(2 * MB);
    });

    it('leaves no partial chunk file behind when it cuts a body off', async () => {
      const { uploadId } = await init();
      const meta = chunkedUpload.getUploadStatus(uploadId);
      await expect(chunkedUpload.uploadChunk(uploadId, 0, countingSource(8 * MB)))
        .rejects.toMatchObject({ statusCode: 413 });
      // abortUpload removes the whole directory; assert nothing survived it.
      await expect(fs.readdir(path.join(process.env.STORAGE_PATH, 'chunks', uploadId)))
        .rejects.toMatchObject({ code: 'ENOENT' });
      expect(meta).not.toBeNull();
    });
  });

  // Every case here was found by an external review of the first cut of this
  // fix. All three are regressions the buffered version did not have: the
  // async iterator it replaced rejected a dead request on its own, and never
  // opened the chunk file at all until it had the whole body in hand.
  describe('failure paths the streaming rewrite introduced', () => {
    it('rejects an already-destroyed request instead of hanging forever', async () => {
      const { uploadId } = await init();
      const source = countingSource(1024);
      source.destroy();
      // pipe() on a dead stream emits neither `end` nor `error`, so without an
      // explicit check this promise never settles and the write fd leaks.
      await expect(chunkedUpload.uploadChunk(uploadId, 0, source))
        .rejects.toMatchObject({ code: 'CHUNK_PREMATURE_CLOSE', statusCode: 400 });
    });

    it('leaves a previously banked chunk intact when a re-send fails', async () => {
      const { uploadId } = await init();
      await chunkedUpload.uploadChunk(uploadId, 0, Buffer.alloc(1000));
      const chunkPath = path.join(process.env.STORAGE_PATH, 'chunks', uploadId, 'chunk_000000');
      expect((await fs.stat(chunkPath)).size).toBe(1000);

      // Re-send the same index, then fail it mid-flight.
      const source = new Readable({ read() {} });
      const pending = chunkedUpload.uploadChunk(uploadId, 0, source);
      source.push(Buffer.alloc(10));
      source.destroy(new Error('client went away'));
      await expect(pending).rejects.toThrow();

      // The banked copy must still be there: receivedChunks/chunkSizes still
      // count it, so a truncated file here means status reports 100% and
      // completeUpload dies on ENOENT.
      expect((await fs.stat(chunkPath)).size).toBe(1000);
      // Still counted as received — which is exactly why the file has to still
      // be there and be the full 1000 bytes.
      expect(chunkedUpload.getUploadStatus(uploadId).receivedChunks).toBe(1);
    });

    it('does not destroy the request stream when it trips the cap', async () => {
      const { uploadId } = await init();
      const source = countingSource(8 * MB);
      await expect(chunkedUpload.uploadChunk(uploadId, 0, source))
        .rejects.toMatchObject({ statusCode: 413 });
      // `source` stands in for the IncomingMessage. Destroying it would take
      // the socket down before the route could send its 413 JSON, so the client
      // would see a connection reset instead of the error.
      expect(source.destroyed).toBe(false);
    });
  });

  describe('the happy path still works', () => {
    it('writes a streamed chunk and reports progress', async () => {
      const { uploadId } = await init();
      const result = await chunkedUpload.uploadChunk(uploadId, 0, countingSource(0.25 * MB), {
        declaredBytes: 0.25 * MB,
      });
      expect(result).toMatchObject({ chunkIndex: 0, received: 1, expected: 2, complete: false });

      const chunkPath = path.join(process.env.STORAGE_PATH, 'chunks', uploadId, 'chunk_000000');
      expect((await fs.stat(chunkPath)).size).toBe(0.25 * MB);
    });

    it('still accepts a Buffer, the shape the service was written for', async () => {
      const { uploadId } = await init();
      const result = await chunkedUpload.uploadChunk(uploadId, 0, Buffer.alloc(0.25 * MB));
      expect(result).toMatchObject({ chunkIndex: 0, received: 1 });
    });

    it('lets a re-sent chunk replace itself without double-counting', async () => {
      const { uploadId } = await init();
      await chunkedUpload.uploadChunk(uploadId, 0, countingSource(0.6 * MB), { declaredBytes: 0.6 * MB });
      // Same index again: the first copy's 0.6MB must not count toward the cap.
      await expect(
        chunkedUpload.uploadChunk(uploadId, 0, countingSource(0.6 * MB), { declaredBytes: 0.6 * MB }),
      ).resolves.toBeTruthy();
    });
  });
});
