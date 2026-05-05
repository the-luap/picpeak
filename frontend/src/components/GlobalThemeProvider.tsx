import React, { useEffect, useRef } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { usePublicSettings } from '../hooks/usePublicSettings';

interface GlobalThemeProviderProps {
  children: React.ReactNode;
}

export const GlobalThemeProvider: React.FC<GlobalThemeProviderProps> = ({ children }) => {
  const { setTheme } = useTheme();
  const themeAppliedRef = useRef(false);
  const { data: settingsData } = usePublicSettings();

  // Apply global theme when settings are loaded (but not on gallery pages)
  useEffect(() => {
    // Skip if we're on a gallery page - gallery pages handle their own themes
    const isGalleryPage = window.location.pathname.includes('/gallery/');

    if (!themeAppliedRef.current && settingsData?.theme_config && !isGalleryPage) {
      themeAppliedRef.current = true;
      // Honor instance-wide force color mode: when set, override the
      // theme's own colorMode so legacy themes can't render light against
      // a force-dark instance (or vice-versa).
      const forced = settingsData.branding_force_color_mode;
      const themeWithForce = forced
        ? { ...settingsData.theme_config, colorMode: forced }
        : settingsData.theme_config;
      setTheme(themeWithForce);
    }
  }, [settingsData, setTheme]);

  return <>{children}</>;
};