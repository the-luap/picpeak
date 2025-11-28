import React, { useState, useRef } from 'react';
import { Upload, X, Image, Loader2, Video } from 'lucide-react';
import { Button } from '../common';
import { clsx } from 'clsx';
import { api } from '../../config/api';
import { toast } from 'react-toastify';
import { useQuery } from '@tanstack/react-query';
import { categoriesService } from '../../services/categories.service';
import { settingsService } from '../../services/settings.service';
import { useTranslation } from 'react-i18next';

interface PhotoUploadProps {
  eventId: number;
  onUploadComplete?: () => void;
}

const DEFAULT_MAX_FILES_PER_UPLOAD = 500;
const MAX_FILES_PER_UPLOAD_LIMIT = 2000;

export const PhotoUpload: React.FC<PhotoUploadProps> = ({ eventId, onUploadComplete }) => {
  const { t } = useTranslation();
  const [isUploading, setIsUploading] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [currentChunk, setCurrentChunk] = useState(0);
  const [totalChunks, setTotalChunks] = useState(0);
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Fetch categories for this event
  const { data: categories = [] } = useQuery({
    queryKey: ['event-categories', eventId],
    queryFn: () => categoriesService.getEventCategories(eventId),
  });

  const { data: settings } = useQuery({
    queryKey: ['admin-settings'],
    queryFn: () => settingsService.getAllSettings(),
  });

  const maxFilesPerUpload = React.useMemo(() => {
    const rawValue = settings?.general_max_files_per_upload;
    const parsed = Number(rawValue);
    if (!Number.isFinite(parsed)) {
      return DEFAULT_MAX_FILES_PER_UPLOAD;
    }
    return Math.min(MAX_FILES_PER_UPLOAD_LIMIT, Math.max(1, Math.floor(parsed)));
  }, [settings]);

  const remainingSlots = Math.max(maxFilesPerUpload - selectedFiles.length, 0);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/quicktime', 'video/webm'];
    const allowedFiles = files.filter(file => allowedTypes.includes(file.type));
    const rejectedFiles = files.filter(file => !allowedTypes.includes(file.type));

    if (rejectedFiles.length > 0) {
      toast.error(
        t('upload.unsupportedFiles', 'Some files were skipped because the format is not supported (use JPEG/PNG/WebP/MP4/MOV/WEBM).')
      );
    }
    
    // Check total file count with existing files
    const totalFiles = selectedFiles.length + allowedFiles.length;
    if (totalFiles > maxFilesPerUpload) {
      const allowedNewFiles = maxFilesPerUpload - selectedFiles.length;
      if (allowedNewFiles <= 0) {
        toast.error(
          t('upload.maxFilesReached', { limit: maxFilesPerUpload }) ||
          `Maximum ${maxFilesPerUpload} files allowed`
        );
        return;
      }
      toast.warning(
        t('upload.someFilesSkipped', { allowed: allowedNewFiles, limit: maxFilesPerUpload }) ||
        `Only ${allowedNewFiles} more files can be added (limit ${maxFilesPerUpload})`
      );
      setSelectedFiles(prev => [...prev, ...allowedFiles.slice(0, allowedNewFiles)]);
      return;
    }
    
    setSelectedFiles(prev => [...prev, ...allowedFiles]);
  };

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleUpload = async () => {
    if (selectedFiles.length === 0) return;
    
    // Validate file count
    if (selectedFiles.length > maxFilesPerUpload) {
      toast.error(
        t('upload.tooManyFiles', { limit: maxFilesPerUpload }) ||
        `Maximum ${maxFilesPerUpload} files can be uploaded at once`
      );
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);

    // For large uploads, chunk the files to prevent memory issues
    const CHUNK_SIZE = Math.max(1, Math.min(50, maxFilesPerUpload)); // Upload up to 50 (or limit) files at a time
    const chunks = [];
    
    for (let i = 0; i < selectedFiles.length; i += CHUNK_SIZE) {
      chunks.push(selectedFiles.slice(i, i + CHUNK_SIZE));
    }

    setTotalChunks(chunks.length);
    let totalUploaded = 0;
    let failedFiles = [];

    try {
      for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
        setCurrentChunk(chunkIndex + 1);
        const chunk = chunks[chunkIndex];
        const formData = new FormData();
        
        chunk.forEach((file) => {
          formData.append('photos', file);
        });
        
        if (selectedCategoryId) {
          formData.append('category_id', selectedCategoryId.toString());
        }

        try {
          await api.post(`/admin/events/${eventId}/upload`, formData, {
            onUploadProgress: (progressEvent) => {
              if (progressEvent.total) {
                // Calculate overall progress across all chunks
                const chunkProgress = progressEvent.loaded / progressEvent.total;
                const overallProgress = ((chunkIndex + chunkProgress) / chunks.length) * 100;
                setUploadProgress(Math.round(overallProgress));
              }
            },
          });

          totalUploaded += chunk.length;
        } catch (error: any) {
          console.error(`Error uploading chunk ${chunkIndex + 1}:`, error);
          failedFiles.push(...chunk.map(f => f.name));
          
          // Continue with next chunk even if one fails
          continue;
        }
      }

      // Clear selected files
      setSelectedFiles([]);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

      // Show appropriate message
      if (failedFiles.length === 0) {
        toast.success(t('upload.uploadComplete') || `Successfully uploaded ${totalUploaded} files`);
      } else {
        toast.warning(
          t('upload.someFilesFailed') || 
          `Uploaded ${totalUploaded} files. ${failedFiles.length} files failed.`
        );
      }
      
      // Call callback
      if (onUploadComplete) {
        onUploadComplete();
      }
    } catch (error: any) {
      console.error('Upload error:', error);
      toast.error(error.response?.data?.error || t('toast.uploadError'));
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
      setCurrentChunk(0);
      setTotalChunks(0);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <div className="space-y-4">
      {/* Category Selection */}
      <div>
        <label className="block text-sm font-medium text-neutral-700 mb-2">
          {t('upload.mediaCategory', 'Media category')}
        </label>
        <select
          value={selectedCategoryId || ''}
          onChange={(e) => setSelectedCategoryId(e.target.value ? Number(e.target.value) : null)}
          className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500"
        >
          <option value="">{t('upload.noCategory')}</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name} {!category.is_global && t('upload.eventSpecific')}
            </option>
          ))}
        </select>
      </div>

      {/* File Input Area */}
      <div
        className={clsx(
          "border-2 border-dashed rounded-lg p-8 text-center transition-colors",
          "hover:border-primary-400 hover:bg-primary-50/50",
          selectedFiles.length > 0 ? "border-primary-400 bg-primary-50/30" : "border-neutral-300"
        )}
        onClick={() => fileInputRef.current?.click()}
      >
        <Upload className="w-12 h-12 mx-auto text-neutral-400 mb-4" />
        <p className="text-neutral-700 font-medium mb-1">
          {t('upload.clickToUpload')}
        </p>
        <p className="text-sm text-neutral-500">
          {t('upload.fileRequirementsMedia', { limit: maxFilesPerUpload }) || t('upload.fileRequirements', { limit: maxFilesPerUpload })}
        </p>
        <p
          className={clsx(
            "text-xs mt-2",
            remainingSlots === 0 ? "text-red-600" : "text-neutral-500"
          )}
        >
          {remainingSlots === 0
            ? t('upload.limitReached', { limit: maxFilesPerUpload })
            : t('upload.limitInfo', {
                selected: selectedFiles.length,
                limit: maxFilesPerUpload,
                remaining: remainingSlots,
              })}
        </p>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime,video/x-msvideo"
          onChange={handleFileSelect}
          className="hidden"
        />
      </div>

      {/* Selected Files */}
      {selectedFiles.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-neutral-700">
            {t('upload.selectedFiles')} ({selectedFiles.length})
          </p>
          <div className="max-h-48 overflow-y-auto space-y-2">
            {selectedFiles.map((file, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-2 bg-neutral-50 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  {file.type.startsWith('video/') ? (
                    <Video className="w-5 h-5 text-neutral-400" />
                  ) : (
                    <Image className="w-5 h-5 text-neutral-400" />
                  )}
                  <div>
                    <p className="text-sm font-medium text-neutral-700 truncate max-w-xs">
                      {file.name}
                    </p>
                    <p className="text-xs text-neutral-500">
                      {formatFileSize(file.size)}
                    </p>
                  </div>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    removeFile(index);
                  }}
                  className="p-1 hover:bg-neutral-200 rounded"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Upload Button */}
      <div className="flex justify-end">
        <Button
          variant="primary"
          onClick={handleUpload}
          disabled={selectedFiles.length === 0 || isUploading}
          leftIcon={isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
        >
          {isUploading
            ? t('upload.uploading')
            : t('upload.uploadAction', { count: selectedFiles.length }) || `Upload ${selectedFiles.length} files`}
        </Button>
      </div>

      {/* Progress Bar */}
      {isUploading && (
        <div className="mt-4">
          <div className="flex justify-between text-sm text-neutral-600 mb-1">
            <span>
              {t('upload.uploading')}
              {totalChunks > 1 && ` (${t('common.chunk')} ${currentChunk}/${totalChunks})`}
            </span>
            <span>{uploadProgress}%</span>
          </div>
          <div className="w-full bg-neutral-200 rounded-full h-2">
            <div
              className="bg-primary-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
          {totalChunks > 1 && (
            <p className="text-xs text-neutral-500 mt-1">
              {t('upload.uploadingChunks', { count: selectedFiles.length, total: totalChunks })}
            </p>
          )}
        </div>
      )}
    </div>
  );
};

PhotoUpload.displayName = 'PhotoUpload';
