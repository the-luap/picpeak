import { useTranslation } from 'react-i18next';
import { format as dateFnsFormat, formatDistanceToNow as dateFnsFormatDistanceToNow } from 'date-fns';
import { de, enUS } from 'date-fns/locale';
import { useQuery } from '@tanstack/react-query';
import { publicSettingsService } from '../services/publicSettings.service';

// Convert old date format strings to new date-fns format
const convertDateFormat = (format: string): string => {
  return format
    .replace(/DD/g, 'dd')    // Days: DD -> dd
    .replace(/YYYY/g, 'yyyy') // Years: YYYY -> yyyy
    .replace(/YY/g, 'yy');    // Short years: YY -> yy
};

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
    
    // Convert old format to new format
    dateFormat = convertDateFormat(dateFormat);
    
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
      ? convertDateFormat(
          typeof settings.general_date_format === 'string' 
            ? settings.general_date_format 
            : settings.general_date_format.format || 'PPP'
        )
      : 'PPP'
  };
};