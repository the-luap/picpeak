import { useTranslation } from 'react-i18next';
import { format as dateFnsFormat, formatDistanceToNow as dateFnsFormatDistanceToNow } from 'date-fns';
import { de, enUS } from 'date-fns/locale';

export const useLocalizedDate = () => {
  const { i18n } = useTranslation();
  
  const getLocale = () => {
    return i18n.language === 'de' ? de : enUS;
  };
  
  const format = (date: Date | string, formatStr: string) => {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return dateFnsFormat(dateObj, formatStr, { locale: getLocale() });
  };
  
  const formatDistanceToNow = (date: Date | string, options?: { addSuffix?: boolean }) => {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return dateFnsFormatDistanceToNow(dateObj, { ...options, locale: getLocale() });
  };
  
  return {
    format,
    formatDistanceToNow,
    locale: getLocale()
  };
};