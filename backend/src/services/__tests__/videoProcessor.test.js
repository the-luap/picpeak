jest.mock('../../utils/logger');
jest.mock('fluent-ffmpeg');
jest.mock('../storage', () => ({
  getStorage: jest.fn()
}));

const ffmpeg = require('fluent-ffmpeg');
const { getStorage } = require('../storage');
const {
  extractVideoMetadata,
  processUploadedVideo
} = require('../videoProcessor');

describe('extractVideoMetadata (#1370)', () => {
  afterEach(() => jest.clearAllMocks());

  it('returns null duration rather than 0 when ffprobe has none, so "unknown" and "a real 0s clip" stay distinguishable', async () => {
    ffmpeg.ffprobe = jest.fn((videoPath, cb) => {
      cb(null, {
        streams: [{ codec_type: 'video', width: 1920, height: 1080, codec_name: 'hevc' }],
        format: {} // no duration field at all
      });
    });

    const metadata = await extractVideoMetadata('/tmp/video.mp4');

    expect(metadata.duration).toBeNull();
    expect(metadata.width).toBe(1920);
    expect(metadata.videoCodec).toBe('hevc');
  });

  it('floors a real duration', async () => {
    ffmpeg.ffprobe = jest.fn((videoPath, cb) => {
      cb(null, { streams: [], format: { duration: 12.9 } });
    });

    const metadata = await extractVideoMetadata('/tmp/video.mp4');

    expect(metadata.duration).toBe(12);
  });
});

describe('processUploadedVideo degrades gracefully instead of rejecting the whole video (#1370)', () => {
  let storage;

  beforeEach(() => {
    storage = { putFromFile: jest.fn().mockResolvedValue(undefined), exists: jest.fn().mockResolvedValue(true) };
    getStorage.mockReturnValue(storage);
  });

  afterEach(() => jest.clearAllMocks());

  it('keeps the thumbnail when only metadata extraction fails', async () => {
    ffmpeg.ffprobe = jest.fn((videoPath, cb) => cb(new Error('moov atom not found')));
    ffmpeg.mockImplementation(() => ({
      screenshots: jest.fn(function screenshots({ filename, folder }) {
        require('fs').writeFileSync(require('path').join(folder, filename), 'jpeg-bytes');
        return this;
      }),
      on(event, handler) {
        if (event === 'end') setImmediate(handler);
        return this;
      }
    }));

    const result = await processUploadedVideo('/tmp/video.mp4', 'thumbnails/thumb_video.jpg');

    expect(result.success).toBe(true);
    expect(result.metadata).toBeNull();
    expect(result.thumbnailKey).toBe('thumbnails/thumb_video.jpg');
  });

  it('keeps the metadata when only thumbnail generation fails', async () => {
    ffmpeg.ffprobe = jest.fn((videoPath, cb) => {
      cb(null, {
        streams: [{ codec_type: 'video', width: 1080, height: 1920, codec_name: 'h264' }],
        format: { duration: 5.4 }
      });
    });
    ffmpeg.mockImplementation(() => ({
      screenshots() { return this; },
      on(event, handler) {
        if (event === 'error') setImmediate(() => handler(new Error('ffmpeg seek failed')));
        return this;
      }
    }));

    const result = await processUploadedVideo('/tmp/video.mp4', 'thumbnails/thumb_video.jpg');

    expect(result.success).toBe(true);
    expect(result.metadata).toEqual(expect.objectContaining({ duration: 5, videoCodec: 'h264' }));
    expect(result.thumbnailKey).toBeNull();
    expect(storage.putFromFile).not.toHaveBeenCalled();
  });

  it('still succeeds with both null when metadata AND thumbnail fail — never throws, never blocks the upload', async () => {
    ffmpeg.ffprobe = jest.fn((videoPath, cb) => cb(new Error('Invalid data found when processing input')));
    ffmpeg.mockImplementation(() => ({
      screenshots() { return this; },
      on(event, handler) {
        if (event === 'error') setImmediate(() => handler(new Error('ffmpeg seek failed')));
        return this;
      }
    }));

    const result = await processUploadedVideo('/tmp/corrupt.mp4', 'thumbnails/thumb_corrupt.jpg');

    expect(result).toEqual({ success: true, metadata: null, thumbnailKey: null });
  });
});
