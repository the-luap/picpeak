const S3StorageAdapter = require('../s3Storage');
const { S3Client } = require('@aws-sdk/client-s3');
const { Upload } = require('@aws-sdk/lib-storage');
const fs = require('fs');
const stream = require('stream');

// Mock AWS SDK
jest.mock('@aws-sdk/client-s3');
jest.mock('@aws-sdk/lib-storage');
jest.mock('@aws-sdk/s3-request-presigner');

describe('S3StorageAdapter', () => {
  let mockS3Client;
  let mockSend;
  let s3Storage;
  
  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Mock S3Client
    mockSend = jest.fn();
    mockS3Client = {
      send: mockSend
    };
    S3Client.mockImplementation(() => mockS3Client);
    
    // Create adapter instance
    s3Storage = new S3StorageAdapter({
      bucket: 'test-bucket',
      region: 'us-east-1',
      accessKeyId: 'test-key',
      secretAccessKey: 'test-secret'
    });
  });
  
  describe('constructor', () => {
    it('should initialize with required config', () => {
      expect(s3Storage.bucket).toBe('test-bucket');
      expect(s3Storage.config.region).toBe('us-east-1');
    });
    
    it('should throw error if bucket is not provided', () => {
      expect(() => {
        new S3StorageAdapter({ region: 'us-east-1' });
      }).toThrow('S3 bucket name is required');
    });
    
    it('should configure for MinIO with path style', () => {
      const minioStorage = new S3StorageAdapter({
        bucket: 'test-bucket',
        endpoint: 'http://localhost:9000',
        forcePathStyle: true,
        sslEnabled: false
      });
      
      expect(S3Client).toHaveBeenCalledWith(
        expect.objectContaining({
          endpoint: 'http://localhost:9000',
          forcePathStyle: true
        })
      );
    });
  });
  
  describe('testConnection', () => {
    it('should successfully test connection', async () => {
      mockSend.mockResolvedValueOnce({});
      
      const result = await s3Storage.testConnection();
      
      expect(result).toBe(true);
      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          input: { Bucket: 'test-bucket' }
        })
      );
    });
    
    it('should throw error on connection failure', async () => {
      mockSend.mockRejectedValueOnce(new Error('Access Denied'));
      
      await expect(s3Storage.testConnection()).rejects.toThrow('S3 connection test failed');
    });
  });
  
  describe('upload', () => {
    let mockUpload;
    let mockDone;
    
    beforeEach(() => {
      mockDone = jest.fn().mockResolvedValue({
        Location: 'https://test-bucket.s3.amazonaws.com/test-key',
        ETag: '"test-etag"'
      });
      
      mockUpload = {
        on: jest.fn().mockReturnThis(),
        done: mockDone
      };
      
      Upload.mockImplementation(() => mockUpload);
      
      // Mock fs.stat
      jest.spyOn(fs.promises, 'stat').mockResolvedValue({
        size: 1024
      });
      
      // Mock fs.createReadStream
      jest.spyOn(fs, 'createReadStream').mockReturnValue(new stream.Readable());
    });
    
    afterEach(() => {
      jest.restoreAllMocks();
    });
    
    it('should upload file successfully', async () => {
      const result = await s3Storage.upload('/path/to/file.jpg', 'test-key');
      
      expect(result.Location).toBe('https://test-bucket.s3.amazonaws.com/test-key');
      expect(Upload).toHaveBeenCalledWith(
        expect.objectContaining({
          client: mockS3Client,
          params: expect.objectContaining({
            Bucket: 'test-bucket',
            Key: 'test-key',
            ContentType: 'application/octet-stream'
          })
        })
      );
    });
    
    it('should track upload progress', async () => {
      const onProgress = jest.fn();
      let progressCallback;
      
      mockUpload.on.mockImplementation((event, callback) => {
        if (event === 'httpUploadProgress') {
          progressCallback = callback;
        }
        return mockUpload;
      });
      
      const uploadPromise = s3Storage.upload('/path/to/file.jpg', 'test-key', {
        onProgress
      });
      
      // Simulate progress
      progressCallback({ loaded: 512, total: 1024 });
      
      await uploadPromise;
      
      expect(onProgress).toHaveBeenCalledWith(512, 1024);
    });
    
    it('should emit upload events', async () => {
      const uploadStartSpy = jest.fn();
      const uploadCompleteSpy = jest.fn();
      
      s3Storage.on('uploadStart', uploadStartSpy);
      s3Storage.on('uploadComplete', uploadCompleteSpy);
      
      await s3Storage.upload('/path/to/file.jpg', 'test-key');
      
      expect(uploadStartSpy).toHaveBeenCalledWith({ key: 'test-key', size: 1024 });
      expect(uploadCompleteSpy).toHaveBeenCalledWith({
        key: 'test-key',
        location: 'https://test-bucket.s3.amazonaws.com/test-key'
      });
    });
  });
  
  describe('exists', () => {
    it('should return true if object exists', async () => {
      mockSend.mockResolvedValueOnce({});
      
      const result = await s3Storage.exists('test-key');
      
      expect(result).toBe(true);
      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          input: { Bucket: 'test-bucket', Key: 'test-key' }
        })
      );
    });
    
    it('should return false if object does not exist', async () => {
      const error = new Error('Not Found');
      error.name = 'NotFound';
      error.$metadata = { httpStatusCode: 404 };
      mockSend.mockRejectedValueOnce(error);
      
      const result = await s3Storage.exists('test-key');
      
      expect(result).toBe(false);
    });
  });
  
  describe('generateKey', () => {
    it('should generate unique key with timestamp and random string', () => {
      const key = s3Storage.generateKey('photo.jpg');
      
      expect(key).toMatch(/^\d+_[a-f0-9]{16}_photo\.jpg$/);
    });
    
    it('should add prefix if provided', () => {
      const key = s3Storage.generateKey('photo.jpg', 'events/wedding');
      
      expect(key).toMatch(/^events\/wedding\/\d+_[a-f0-9]{16}_photo\.jpg$/);
    });
    
    it('should sanitize filename', () => {
      const key = s3Storage.generateKey('my photo (1).jpg');
      
      expect(key).toMatch(/^\d+_[a-f0-9]{16}_my_photo__1_\.jpg$/);
    });
  });
  
  describe('retry logic', () => {
    it('should retry on retryable errors', async () => {
      const retryableError = new Error('Connection reset');
      retryableError.code = 'ECONNRESET';
      
      // First attempt fails, second succeeds
      mockSend
        .mockRejectedValueOnce(retryableError)
        .mockResolvedValueOnce({});
      
      // Mock setTimeout to speed up test
      jest.useFakeTimers();
      
      const promise = s3Storage.exists('test-key');
      
      // Advance timers
      jest.runAllTimers();
      
      const result = await promise;
      
      expect(result).toBe(true);
      expect(mockSend).toHaveBeenCalledTimes(2);
      
      jest.useRealTimers();
    });
    
    it('should not retry on non-retryable errors', async () => {
      const nonRetryableError = new Error('Invalid credentials');
      nonRetryableError.code = 'InvalidCredentials';
      
      mockSend.mockRejectedValueOnce(nonRetryableError);
      
      await expect(s3Storage.exists('test-key')).rejects.toThrow('Invalid credentials');
      expect(mockSend).toHaveBeenCalledTimes(1);
    });
    
    it('should stop retrying after max attempts', async () => {
      const retryableError = new Error('Service unavailable');
      retryableError.code = 'ServiceUnavailable';
      
      mockSend.mockRejectedValue(retryableError);
      
      // Mock setTimeout to speed up test
      jest.useFakeTimers();
      
      const promise = s3Storage.exists('test-key');
      
      // Advance timers for all retries
      for (let i = 0; i < 4; i++) {
        jest.runAllTimers();
      }
      
      await expect(promise).rejects.toThrow('Service unavailable');
      expect(mockSend).toHaveBeenCalledTimes(4); // Initial + 3 retries
      
      jest.useRealTimers();
    });
  });
  
  describe('getStats', () => {
    it('should calculate storage statistics', async () => {
      mockSend.mockResolvedValueOnce({
        Contents: [
          { Key: 'file1.jpg', Size: 1024 },
          { Key: 'file2.jpg', Size: 2048 }
        ],
        NextContinuationToken: 'token123'
      }).mockResolvedValueOnce({
        Contents: [
          { Key: 'file3.jpg', Size: 3072 }
        ]
      });
      
      const stats = await s3Storage.getStats('events/');
      
      expect(stats).toEqual({
        totalSize: 6144,
        totalCount: 3,
        totalSizeFormatted: '6 KB'
      });
    });
  });
  
  describe('_formatBytes', () => {
    it('should format bytes correctly', () => {
      expect(s3Storage._formatBytes(0)).toBe('0 Bytes');
      expect(s3Storage._formatBytes(1024)).toBe('1 KB');
      expect(s3Storage._formatBytes(1048576)).toBe('1 MB');
      expect(s3Storage._formatBytes(1073741824)).toBe('1 GB');
      expect(s3Storage._formatBytes(1536, 1)).toBe('1.5 KB');
    });
  });
});