import React, { useState } from 'react';
import { Download, FileText, FileSpreadsheet, Archive, FileJson, ChevronDown, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import { photosService, ExportOptions, FeedbackFilters } from '../../services/photos.service';

interface PhotoExportMenuProps {
  eventId: number;
  selectedPhotoIds: number[];
  filters?: FeedbackFilters;
  disabled?: boolean;
}

const EXPORT_FORMATS = [
  {
    value: 'txt',
    label: 'Filename List (TXT)',
    description: 'Simple text list for Lightroom search',
    icon: FileText
  },
  {
    value: 'csv',
    label: 'Filename List (CSV)',
    description: 'Spreadsheet with metadata',
    icon: FileSpreadsheet
  },
  {
    value: 'xmp',
    label: 'XMP Sidecar Files (ZIP)',
    description: 'Import ratings into Lightroom/Bridge',
    icon: Archive
  },
  {
    value: 'json',
    label: 'Metadata (JSON)',
    description: 'Structured data for automation',
    icon: FileJson
  },
];

export const PhotoExportMenu: React.FC<PhotoExportMenuProps> = ({
  eventId,
  selectedPhotoIds,
  filters,
  disabled = false
}) => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);

  const exportMutation = useMutation({
    mutationFn: (options: ExportOptions) => photosService.exportPhotos(eventId, options),
    onSuccess: () => {
      toast.success(t('export.success', 'Export downloaded successfully'));
      setIsOpen(false);
    },
    onError: (error: Error) => {
      toast.error(t('export.error', 'Export failed: ') + error.message);
    }
  });

  const handleExport = (format: 'txt' | 'csv' | 'xmp' | 'json') => {
    const options: ExportOptions = {
      format,
      options: {
        filename_format: 'original',
        include_rating: true,
        include_label: true,
        include_description: true,
        include_keywords: true
      }
    };

    // Use selected photos if any, otherwise use filters
    if (selectedPhotoIds.length > 0) {
      options.photo_ids = selectedPhotoIds;
    } else if (filters) {
      options.filter = filters;
    }

    exportMutation.mutate(options);
  };

  const hasSelection = selectedPhotoIds.length > 0;
  const hasFilters = filters && (
    filters.minRating !== null ||
    filters.hasLikes ||
    filters.hasFavorites ||
    filters.hasComments
  );

  const isDisabled = disabled || (!hasSelection && !hasFilters);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        disabled={isDisabled || exportMutation.isPending}
        className={`
          inline-flex items-center gap-2 px-4 py-2 rounded-lg border font-medium text-sm
          transition-colors
          ${isDisabled
            ? 'bg-neutral-100 text-neutral-400 border-neutral-200 cursor-not-allowed'
            : 'bg-white text-neutral-700 border-neutral-300 hover:bg-neutral-50'
          }
        `}
      >
        {exportMutation.isPending ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Download className="w-4 h-4" />
        )}
        {t('export.button', 'Export')}
        {hasSelection && (
          <span className="bg-primary-100 text-primary-700 text-xs px-2 py-0.5 rounded-full">
            {selectedPhotoIds.length}
          </span>
        )}
        <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && !isDisabled && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />

          {/* Dropdown Menu */}
          <div className="absolute right-0 mt-2 w-72 bg-white rounded-lg shadow-lg border border-neutral-200 z-20">
            <div className="p-2">
              <p className="px-3 py-2 text-xs font-medium text-neutral-500 uppercase tracking-wider">
                {hasSelection
                  ? t('export.exportSelected', 'Export {{count}} selected', { count: selectedPhotoIds.length })
                  : t('export.exportFiltered', 'Export filtered photos')
                }
              </p>

              {EXPORT_FORMATS.map((format) => {
                const Icon = format.icon;
                return (
                  <button
                    key={format.value}
                    onClick={() => handleExport(format.value as 'txt' | 'csv' | 'xmp' | 'json')}
                    disabled={exportMutation.isPending}
                    className="w-full flex items-start gap-3 px-3 py-2 rounded-md hover:bg-neutral-50 text-left transition-colors"
                  >
                    <Icon className="w-5 h-5 text-neutral-500 mt-0.5" />
                    <div>
                      <div className="text-sm font-medium text-neutral-900">
                        {format.label}
                      </div>
                      <div className="text-xs text-neutral-500">
                        {format.description}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}

      {!hasSelection && !hasFilters && (
        <p className="mt-1 text-xs text-neutral-500">
          {t('export.hint', 'Select photos or apply filters to export')}
        </p>
      )}
    </div>
  );
};

export default PhotoExportMenu;
