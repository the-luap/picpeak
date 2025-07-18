import React, { useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTheme } from '../contexts/ThemeContext';
import { api } from '../config/api';

interface GlobalThemeProviderProps {
  children: React.ReactNode;
}

export const GlobalThemeProvider: React.FC<GlobalThemeProviderProps> = ({ children }) => {
  const { setTheme } = useTheme();
  const themeAppliedRef = useRef(false);

  // Fetch public settings including theme config
  const { data: settingsData } = useQuery({
    queryKey: ['global-theme-settings'],
    queryFn: async () => {
      const response = await api.get('/public/settings');
      return response.data;
    },
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  // Apply global theme when settings are loaded (but not on gallery pages)
  useEffect(() => {
    // Skip if we're on a gallery page - gallery pages handle their own themes
    const isGalleryPage = window.location.pathname.includes('/gallery/');
    
    if (!themeAppliedRef.current && settingsData?.theme_config && !isGalleryPage) {
      themeAppliedRef.current = true;
      setTheme(settingsData.theme_config);
    }
  }, [settingsData, setTheme]);

  return <>{children}</>;
};