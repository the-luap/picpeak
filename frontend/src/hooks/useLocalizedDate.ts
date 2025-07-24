import { useTranslation } from 'react-i18next';
import { format as dateFnsFormat, formatDistanceToNow as dateFnsFormatDistanceToNow } from 'date-fns';
import { de, enUS } from 'date-fns/locale';
import { useQuery } from '@tanstack/react-query';
import { publicSettingsService } from '../services/publicSettings.service';

export const useLocalizedDate = () => {
  const { i18n } = useTranslation();
  
  // Fetch public settings to get the date format
  const { data: settings } = useQuery({
    queryKey: ['public-settings'],
    queryFn: () => publicSettingsService.getPublicSettings(),
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    retry: 1, // Only retry once to avoid blocking the UI
  });
  
  const getLocale = () => {
    return i18n.language === 'de' ? de : enUS;
  };
  
  const format = (date: Date | string, formatStr?: string) => {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    // Use admin-configured date format if available and no format string provided
    let dateFormat = formatStr;
    if (!dateFormat && settings?.general_date_format) {
      // Handle both string and object formats
      dateFormat = typeof settings.general_date_format === 'string' 
        ? settings.general_date_format 
        : settings.general_date_format.format || 'PPP';
    }
    dateFormat = dateFormat || 'PPP';
    return dateFnsFormat(dateObj, dateFormat, { locale: getLocale() });
  };
  
  const formatDistanceToNow = (date: Date | string, options?: { addSuffix?: boolean }) => {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return dateFnsFormatDistanceToNow(dateObj, { ...options, locale: getLocale() });
  };
  
  return {
    format,
    formatDistanceToNow,
    locale: getLocale(),
    dateFormat: settings?.general_date_format 
      ? (typeof settings.general_date_format === 'string' 
          ? settings.general_date_format 
          : settings.general_date_format.format || 'PPP')
      : 'PPP'
  };
};