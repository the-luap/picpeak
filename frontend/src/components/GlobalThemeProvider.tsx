import React, { useEffect, useRef } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { usePublicSettings } from '../hooks/usePublicSettings';
import { applyForceColorMode } from '../utils/themeMigration';

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
      // Honor instance-wide force color mode: when set, applyForceColorMode
      // also swaps the surface/text tokens so the page actually flips
      // visually (not just the colorMode flag — see #397 follow-up).
      setTheme(applyForceColorMode(settingsData.theme_config, settingsData.branding_force_color_mode));
    }
  }, [settingsData, setTheme]);

  return <>{children}</>;
};