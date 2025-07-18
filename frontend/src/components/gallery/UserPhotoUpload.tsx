import React, { useState } from 'react';
import { Upload, X, CheckCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import { Button } from '../common';
import { api } from '../../config/api';

interface UserPhotoUploadProps {
  eventId: number;
  categoryId: number | null | undefined;
  onUploadComplete: () => void;
  onClose: () => void;
}

export const UserPhotoUpload: React.FC<UserPhotoUploadProps> = ({
  eventId,
  categoryId,
  onUploadComplete,
  onClose,
}) => {
  const { t } = useTranslation();
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ [key: string]: number }>({});

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    
    // Validate file types
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    const validFiles = selectedFiles.filter(file => {
      if (!allowedTypes.includes(file.type)) {
        toast.error(`Invalid file type: ${file.name}`);
        return false;
      }
      // Check file size (50MB max)
      if (file.size > 50 * 1024 * 1024) {
        toast.error(`File too large: ${file.name}`);
        return false;
      }
      return true;
    });

    setFiles(prev => [...prev, ...validFiles]);
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleUpload = async () => {
    if (files.length === 0) return;

    setUploading(true);
    let successCount = 0;
    let failedCount = 0;

    for (const file of files) {
      const formData = new FormData();
      formData.append('photos', file);
      if (categoryId) {
        formData.append('category_id', categoryId.toString());
      }

      try {
        await api.post(`/gallery/${eventId}/upload`, formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
          onUploadProgress: (progressEvent) => {
            if (progressEvent.total) {
              const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
              setUploadProgress(prev => ({
                ...prev,
                [file.name]: progress,
              }));
            }
          },
        });
        successCount++;
      } catch (error: any) {
        // Upload error handled - user notified via UI
        failedCount++;
        
        // Show specific error message
        const errorMessage = error.response?.data?.error || error.message || 'Upload failed';
        toast.error(`${file.name}: ${errorMessage}`);
      }
    }

    setUploading(false);

    if (successCount > 0) {
      toast.success(t('toast.uploadSuccess') + ` (${successCount} ${t('common.photos')})`);
      onUploadComplete();
    }
    
    if (failedCount > 0) {
      toast.error(`${failedCount} ${t('upload.someFilesFailed')}`);
    }

    if (failedCount === 0) {
      onClose();
    }
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
      <div className="w-full sm:max-w-2xl bg-white flex flex-col max-h-[100vh] sm:max-h-[90vh] rounded-2xl shadow-xl overflow-hidden">
        {/* Fixed Header */}
        <div className="flex items-center justify-between p-4 sm:p-6 border-b border-neutral-200 flex-shrink-0">
          <h2 className="text-lg sm:text-xl font-semibold text-neutral-900">{t('upload.uploadPhotos')}</h2>
          <button
            onClick={onClose}
            className="p-1.5 sm:p-2 hover:bg-neutral-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-neutral-500" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 p-4 sm:p-6 overflow-y-auto min-h-0">
            {/* Upload Area */}
            <div className="mb-4 sm:mb-6">
              <label className="block">
                <div className="border-2 border-dashed border-neutral-300 rounded-lg p-6 sm:p-8 text-center hover:border-primary-500 transition-colors cursor-pointer">
                  <Upload className="w-10 h-10 sm:w-12 sm:h-12 text-neutral-400 mx-auto mb-3" />
                  <p className="text-sm font-medium text-neutral-700 mb-1">
                    {t('upload.clickToUpload')}
                  </p>
                  <p className="text-xs text-neutral-500">
                    {t('upload.fileRequirements')}
                  </p>
                  <input
                    type="file"
                    className="hidden"
                    multiple
                    accept="image/jpeg,image/png,image/webp"
                    onChange={handleFileSelect}
                    disabled={uploading}
                  />
                </div>
              </label>
            </div>

            {/* Selected Files */}
            {files.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-sm font-medium text-neutral-700 mb-2">
                  {t('upload.selectedFiles')} ({files.length})
                </h3>
                {files.map((file, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-3 bg-neutral-50 rounded-lg"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-neutral-900 truncate">
                        {file.name}
                      </p>
                      <p className="text-xs text-neutral-500">
                        {formatBytes(file.size)}
                      </p>
                    </div>
                    {uploadProgress[file.name] !== undefined ? (
                      <div className="flex items-center gap-2">
                        {uploadProgress[file.name] === 100 ? (
                          <CheckCircle className="w-5 h-5 text-green-600" />
                        ) : (
                          <div className="w-20">
                            <div className="bg-neutral-200 rounded-full h-2">
                              <div
                                className="bg-primary-600 h-2 rounded-full transition-all"
                                style={{ width: `${uploadProgress[file.name]}%` }}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <button
                        onClick={() => removeFile(index)}
                        className="p-1 hover:bg-neutral-200 rounded transition-colors"
                        disabled={uploading}
                      >
                        <X className="w-4 h-4 text-neutral-500" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
        </div>

        {/* Fixed Footer */}
        <div className="flex items-center justify-end gap-2 sm:gap-3 p-4 sm:p-6 border-t border-neutral-200 bg-white flex-shrink-0">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={uploading}
            className="text-sm sm:text-base"
          >
            {t('common.cancel')}
          </Button>
          <Button
            variant="primary"
            onClick={handleUpload}
            disabled={files.length === 0 || uploading}
            isLoading={uploading}
            className="text-sm sm:text-base"
          >
            {uploading ? t('upload.uploading') : t('common.upload')} ({files.length})
          </Button>
        </div>
      </div>
    </div>
  );
};

UserPhotoUpload.displayName = 'UserPhotoUpload';