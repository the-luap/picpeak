import { useTranslation } from 'react-i18next';
import { format as dateFnsFormat, formatDistanceToNow as dateFnsFormatDistanceToNow } from 'date-fns';
import { de, enUS } from 'date-fns/locale';
import { useQuery } from '@tanstack/react-query';
import { settingsService } from '../services/settings.service';

export const useLocalizedDate = () => {
  const { i18n } = useTranslation();
  
  // Fetch admin settings to get the date format
  const { data: settings } = useQuery({
    queryKey: ['admin-settings-general'],
    queryFn: () => settingsService.getSettingsByType('general'),
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });
  
  const getLocale = () => {
    return i18n.language === 'de' ? de : enUS;
  };
  
  const format = (date: Date | string, formatStr?: string) => {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    // Use admin-configured date format if available and no format string provided
    const dateFormat = formatStr || settings?.general_date_format || 'PPP';
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
    dateFormat: settings?.general_date_format || 'PPP'
  };
};