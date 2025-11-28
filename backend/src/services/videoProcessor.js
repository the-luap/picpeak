const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
const path = require('path');
const fs = require('fs').promises;
const logger = require('../utils/logger');

// Set FFmpeg path
ffmpeg.setFfmpegPath(ffmpegPath);

/**
 * Extract video metadata using FFmpeg
 * @param {string} videoPath - Path to the video file
 * @returns {Promise<Object>} - Video metadata
 */
async function extractVideoMetadata(videoPath) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(videoPath, (err, metadata) => {
      if (err) {
        logger.error('Error extracting video metadata', { error: err.message, videoPath });
        return reject(err);
      }

      try {
        const videoStream = metadata.streams.find(s => s.codec_type === 'video');
        const audioStream = metadata.streams.find(s => s.codec_type === 'audio');

        const result = {
          duration: Math.floor(metadata.format.duration || 0),
          width: videoStream?.width || null,
          height: videoStream?.height || null,
          videoCodec: videoStream?.codec_name || null,
          audioCodec: audioStream?.codec_name || null,
          size: metadata.format.size || 0,
          bitrate: metadata.format.bit_rate || null,
          format: metadata.format.format_name || null
        };

        resolve(result);
      } catch (parseErr) {
        logger.error('Error parsing video metadata', { error: parseErr.message });
        reject(parseErr);
      }
    });
  });
}

/**
 * Generate thumbnail from video
 * @param {string} videoPath - Path to the video file
 * @param {string} outputPath - Path for the output thumbnail
 * @param {Object} options - Thumbnail options
 * @returns {Promise<string>} - Path to generated thumbnail
 */
async function generateVideoThumbnail(videoPath, outputPath, options = {}) {
  const {
    timeOffset = '00:00:01', // Take screenshot at 1 second
    size = '300x300',
    quality = 2 // 1-31, lower is better quality
  } = options;

  return new Promise((resolve, reject) => {
    ffmpeg(videoPath)
      .screenshots({
        timestamps: [timeOffset],
        filename: path.basename(outputPath),
        folder: path.dirname(outputPath),
        size: size
      })
      .on('end', () => {
        logger.info('Video thumbnail generated', { videoPath, outputPath });
        resolve(outputPath);
      })
      .on('error', (err) => {
        logger.error('Error generating video thumbnail', { error: err.message, videoPath });
        reject(err);
      });
  });
}

/**
 * Validate that a file is a valid video
 * @param {string} videoPath - Path to the video file
 * @returns {Promise<boolean>} - True if valid video
 */
async function isValidVideo(videoPath) {
  try {
    const metadata = await extractVideoMetadata(videoPath);
    return metadata.duration > 0 && metadata.width > 0 && metadata.height > 0;
  } catch (error) {
    logger.error('Video validation failed', { error: error.message, videoPath });
    return false;
  }
}

/**
 * Get video duration in seconds
 * @param {string} videoPath - Path to the video file
 * @returns {Promise<number>} - Duration in seconds
 */
async function getVideoDuration(videoPath) {
  try {
    const metadata = await extractVideoMetadata(videoPath);
    return metadata.duration;
  } catch (error) {
    logger.error('Error getting video duration', { error: error.message });
    return 0;
  }
}

/**
 * Process uploaded video - extract metadata and generate thumbnail
 * @param {string} videoPath - Path to the video file
 * @param {string} thumbnailPath - Path for the thumbnail
 * @param {Object} options - Processing options
 * @returns {Promise<Object>} - Video metadata and processing result
 */
async function processUploadedVideo(videoPath, thumbnailPath, options = {}) {
  try {
    // Validate video
    const isValid = await isValidVideo(videoPath);
    if (!isValid) {
      throw new Error('Invalid video file');
    }

    // Extract metadata
    const metadata = await extractVideoMetadata(videoPath);

    // Generate thumbnail
    await generateVideoThumbnail(videoPath, thumbnailPath, options);

    // Verify thumbnail was created
    try {
      await fs.access(thumbnailPath);
    } catch (err) {
      throw new Error('Thumbnail generation failed');
    }

    return {
      success: true,
      metadata,
      thumbnailPath
    };
  } catch (error) {
    logger.error('Error processing video', { error: error.message, videoPath });
    throw error;
  }
}

/**
 * Get video thumbnail at specific time
 * @param {string} videoPath - Path to video file
 * @param {string} outputPath - Output path for thumbnail
 * @param {number} timeInSeconds - Time in seconds to capture thumbnail
 * @returns {Promise<string>} - Path to thumbnail
 */
async function getThumbnailAtTime(videoPath, outputPath, timeInSeconds = 1) {
  const hours = Math.floor(timeInSeconds / 3600);
  const minutes = Math.floor((timeInSeconds % 3600) / 60);
  const seconds = Math.floor(timeInSeconds % 60);
  const timeOffset = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  return generateVideoThumbnail(videoPath, outputPath, { timeOffset });
}

/**
 * Check if file is a video based on MIME type
 * @param {string} mimeType - MIME type of the file
 * @returns {boolean} - True if video MIME type
 */
function isVideoMimeType(mimeType) {
  return mimeType && mimeType.startsWith('video/');
}

module.exports = {
  extractVideoMetadata,
  generateVideoThumbnail,
  isValidVideo,
  getVideoDuration,
  processUploadedVideo,
  getThumbnailAtTime,
  isVideoMimeType
};
