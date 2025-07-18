import React from 'react';
import { Download, X } from 'lucide-react';

interface DownloadProgressProps {
  isDownloading: boolean;
  progress?: number;
  fileName?: string;
  onCancel?: () => void;
}

export const DownloadProgress: React.FC<DownloadProgressProps> = ({
  isDownloading,
  progress = 0,
  fileName,
  onCancel,
}) => {
  if (!isDownloading) return null;

  return (
    <div className="fixed bottom-4 right-4 bg-white rounded-lg shadow-lg border border-neutral-200 p-4 min-w-[300px] z-50">
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <Download className="w-5 h-5 text-primary-600 animate-bounce" />
          <div>
            <p className="text-sm font-medium text-neutral-900">Downloading...</p>
            {fileName && (
              <p className="text-xs text-neutral-500 truncate max-w-[200px]">{fileName}</p>
            )}
          </div>
        </div>
        {onCancel && (
          <button
            onClick={onCancel}
            className="p-1 hover:bg-neutral-100 rounded transition-colors"
          >
            <X className="w-4 h-4 text-neutral-500" />
          </button>
        )}
      </div>
      
      <div className="w-full bg-neutral-200 rounded-full h-2">
        <div
          className="bg-primary-600 h-2 rounded-full transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>
      
      {progress > 0 && (
        <p className="text-xs text-neutral-500 mt-1">{Math.round(progress)}% complete</p>
      )}
    </div>
  );
};