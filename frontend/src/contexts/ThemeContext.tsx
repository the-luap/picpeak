import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import type { ReactNode } from 'react';
import { ThemeConfig, EventTheme, GALLERY_THEME_PRESETS } from '../types/theme.types';

function resolveColorMode(mode: 'light' | 'dark' | 'auto' | undefined): 'light' | 'dark' {
  if (mode === 'dark') return 'dark';
  if (mode === 'auto') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return 'light';
}

interface ThemeContextType {
  theme: ThemeConfig;
  themeName: string;
  resolvedColorMode: 'light' | 'dark';
  setTheme: (theme: ThemeConfig) => void;
  setThemeByName: (themeName: string) => void;
  applyTheme: (theme: ThemeConfig) => void;
  resetTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

interface ThemeProviderProps {
  children: ReactNode;
  initialTheme?: ThemeConfig;
  initialThemeName?: string;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ 
  children, 
  initialTheme = GALLERY_THEME_PRESETS.default.config,
  initialThemeName = 'default'
}) => {
  const [theme, setTheme] = useState<ThemeConfig>(initialTheme);
  const [themeName, setThemeName] = useState(initialThemeName);
  const [resolvedColorMode, setResolvedColorMode] = useState<'light' | 'dark'>(() => resolveColorMode(initialTheme.colorMode));

  const applyTheme = useCallback((themeConfig: ThemeConfig) => {
    const root = document.documentElement;
    
    // Apply CSS variables
    if (themeConfig.primaryColor) {
      root.style.setProperty('--color-primary', themeConfig.primaryColor);
      // Generate primary color shades
      root.style.setProperty('--color-primary-light', lightenColor(themeConfig.primaryColor, 20));
      root.style.setProperty('--color-primary-dark', darkenColor(themeConfig.primaryColor, 20));
    }
    
    if (themeConfig.accentColor) {
      root.style.setProperty('--color-accent', themeConfig.accentColor);
    }
    
    if (themeConfig.backgroundColor) {
      root.style.setProperty('--color-background', themeConfig.backgroundColor);
    }
    
    if (themeConfig.textColor) {
      root.style.setProperty('--color-text', themeConfig.textColor);
    }
    
    if (themeConfig.fontFamily) {
      root.style.setProperty('--font-family', themeConfig.fontFamily);
    }
    
    if (themeConfig.headingFontFamily) {
      root.style.setProperty('--heading-font-family', themeConfig.headingFontFamily);
    }
    
    if (themeConfig.borderRadius) {
      const radiusMap = {
        none: '0',
        sm: '0.25rem',
        md: '0.5rem',
        lg: '1rem',
      };
      root.style.setProperty('--border-radius', radiusMap[themeConfig.borderRadius]);
    }
    
    // Apply font size
    if (themeConfig.fontSize) {
      const sizeMap = {
        small: '14px',
        normal: '16px',
        large: '18px',
      };
      root.style.setProperty('--font-size-base', sizeMap[themeConfig.fontSize]);
    }
    
    // Apply shadow style
    if (themeConfig.shadowStyle) {
      const shadowMap = {
        none: 'none',
        subtle: '0 1px 3px rgba(0,0,0,0.12)',
        normal: '0 4px 6px rgba(0,0,0,0.1)',
        dramatic: '0 10px 25px rgba(0,0,0,0.15)',
      };
      root.style.setProperty('--shadow-default', shadowMap[themeConfig.shadowStyle]);
    }
    
    // Apply surface colors
    const effectiveMode = resolveColorMode(themeConfig.colorMode);
    setResolvedColorMode(effectiveMode);

    if (themeConfig.surfaceColor) {
      root.style.setProperty('--color-surface', themeConfig.surfaceColor);
    } else if (effectiveMode === 'dark') {
      // Auto-derive dark surface if not explicitly set
      root.style.setProperty('--color-surface', '#1a1a1a');
    } else {
      root.style.setProperty('--color-surface', '#ffffff');
    }

    if (themeConfig.surfaceBorderColor) {
      root.style.setProperty('--color-surface-border', themeConfig.surfaceBorderColor);
    } else if (effectiveMode === 'dark') {
      root.style.setProperty('--color-surface-border', '#2e2e2e');
    } else {
      root.style.setProperty('--color-surface-border', '#e5e5e5');
    }

    if (themeConfig.mutedTextColor) {
      root.style.setProperty('--color-muted-text', themeConfig.mutedTextColor);
    } else if (effectiveMode === 'dark') {
      root.style.setProperty('--color-muted-text', '#a3a3a3');
    } else {
      root.style.setProperty('--color-muted-text', '#737373');
    }

    // Adjust shadow intensity for dark mode
    if (themeConfig.shadowStyle) {
      const lightShadowMap = {
        none: 'none',
        subtle: '0 1px 3px rgba(0,0,0,0.12)',
        normal: '0 4px 6px rgba(0,0,0,0.1)',
        dramatic: '0 10px 25px rgba(0,0,0,0.15)',
      };
      const darkShadowMap = {
        none: 'none',
        subtle: '0 1px 3px rgba(0,0,0,0.4)',
        normal: '0 4px 6px rgba(0,0,0,0.35)',
        dramatic: '0 10px 25px rgba(0,0,0,0.5)',
      };
      const map = effectiveMode === 'dark' ? darkShadowMap : lightShadowMap;
      root.style.setProperty('--shadow-default', map[themeConfig.shadowStyle]);
    }

    // Apply background pattern
    if (themeConfig.backgroundPattern && themeConfig.backgroundPattern !== 'none') {
      const patternMap = {
        dots: `radial-gradient(circle, ${themeConfig.textColor}20 1px, transparent 1px)`,
        grid: `linear-gradient(${themeConfig.textColor}10 1px, transparent 1px), linear-gradient(90deg, ${themeConfig.textColor}10 1px, transparent 1px)`,
        waves: `url("data:image/svg+xml,%3Csvg width='100' height='20' viewBox='0 0 100 20' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M21.184 20c.357-.13.72-.264 1.088-.402l1.768-.661C33.64 15.347 39.647 14 50 14c10.271 0 15.362 1.222 24.629 4.928.955.383 1.869.74 2.75 1.072h6.225c-2.51-.73-5.139-1.691-8.233-2.928C65.888 13.278 60.562 12 50 12c-10.626 0-16.855 1.397-26.66 5.063l-1.767.662c-2.475.923-4.66 1.674-6.724 2.275h6.335zm0-20C13.258 2.892 8.077 4 0 4V2c5.744 0 9.951-.574 14.85-2h6.334zM77.38 0C85.239 2.966 90.502 4 100 4V2c-6.842 0-11.386-.542-16.396-2h-6.225zM0 14c8.44 0 13.718-1.21 22.272-4.402l1.768-.661C33.64 5.347 39.647 4 50 4c10.271 0 15.362 1.222 24.629 4.928C84.112 12.722 89.438 14 100 14v-2c-10.271 0-15.362-1.222-24.629-4.928C65.888 3.278 60.562 2 50 2 39.374 2 33.145 3.397 23.34 7.063l-1.767.662C13.223 10.84 8.163 12 0 12v2z' fill='${themeConfig.textColor}' fill-opacity='0.05'/%3E%3C/svg%3E")`,
      };
      root.style.setProperty('--background-pattern', patternMap[themeConfig.backgroundPattern]);
      root.style.setProperty('--background-pattern-size', themeConfig.backgroundPattern === 'dots' ? '20px 20px' : themeConfig.backgroundPattern === 'grid' ? '20px 20px' : '100px 20px');
    } else {
      root.style.removeProperty('--background-pattern');
      root.style.removeProperty('--background-pattern-size');
    }
    
    // Apply custom CSS if provided
    if (themeConfig.customCss) {
      let styleElement = document.getElementById('custom-theme-styles');
      if (!styleElement) {
        styleElement = document.createElement('style');
        styleElement.id = 'custom-theme-styles';
        document.head.appendChild(styleElement);
      }
      styleElement.textContent = themeConfig.customCss;
    }
  }, []);

  const setThemeConfig = useCallback((newTheme: ThemeConfig) => {
    setTheme(newTheme);
    applyTheme(newTheme);
  }, [applyTheme]);

  const setThemeByName = useCallback((name: string) => {
    const presetTheme = GALLERY_THEME_PRESETS[name];
    if (presetTheme) {
      setThemeName(name);
      setTheme(presetTheme.config);
      applyTheme(presetTheme.config);
    }
  }, [applyTheme]);

  const resetTheme = useCallback(() => {
    setThemeByName('default');
  }, [setThemeByName]);

  // Apply theme when it changes, but skip if it's the same
  useEffect(() => {
    const root = document.documentElement;
    const currentPrimary = root.style.getPropertyValue('--color-primary');
    
    // Only apply if the theme has actually changed
    if (currentPrimary !== theme.primaryColor) {
      applyTheme(theme);
    }
  }, [theme, applyTheme]);

  // Load theme from localStorage on mount (skip if in gallery view)
  useEffect(() => {
    // Check if we're in a gallery view by looking at the URL
    const isGalleryView = window.location.pathname.includes('/gallery/');
    if (!isGalleryView) {
      const savedTheme = localStorage.getItem('gallery-theme');
      if (savedTheme) {
        try {
          const parsed = JSON.parse(savedTheme);
          setTheme(parsed.config);
          setThemeName(parsed.name);
        } catch (e) {
          console.error('Failed to load saved theme:', e);
        }
      }
    }
  }, []);

  // Save theme to localStorage when it changes (but not in gallery views)
  useEffect(() => {
    // Don't save theme in gallery views to avoid conflicts
    const isGalleryView = window.location.pathname.includes('/gallery/');
    if (!isGalleryView) {
      // Only save if theme has actually changed
      const currentSaved = localStorage.getItem('gallery-theme');
      const newValue = JSON.stringify({ name: themeName, config: theme });
      if (currentSaved !== newValue) {
        localStorage.setItem('gallery-theme', newValue);
      }
    }
  }, [theme, themeName]);

  // Listen for system color scheme changes when colorMode is 'auto'
  useEffect(() => {
    if (theme.colorMode !== 'auto') return;

    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => applyTheme(theme);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, [theme, applyTheme]);

  const contextValue = useMemo(() => ({
    theme,
    themeName,
    resolvedColorMode,
    setTheme: setThemeConfig,
    setThemeByName,
    applyTheme,
    resetTheme
  }), [theme, themeName, resolvedColorMode, setThemeConfig, setThemeByName, applyTheme, resetTheme]);

  return (
    <ThemeContext.Provider value={contextValue}>
      {children}
    </ThemeContext.Provider>
  );
};

// Utility functions for color manipulation
function lightenColor(color: string, percent: number): string {
  const num = parseInt(color.replace('#', ''), 16);
  const amt = Math.round(2.55 * percent);
  const R = (num >> 16) + amt;
  const G = (num >> 8 & 0x00FF) + amt;
  const B = (num & 0x0000FF) + amt;
  return '#' + (0x1000000 + (R < 255 ? R < 1 ? 0 : R : 255) * 0x10000 +
    (G < 255 ? G < 1 ? 0 : G : 255) * 0x100 +
    (B < 255 ? B < 1 ? 0 : B : 255)).toString(16).slice(1);
}

function darkenColor(color: string, percent: number): string {
  const num = parseInt(color.replace('#', ''), 16);
  const amt = Math.round(2.55 * percent);
  const R = (num >> 16) - amt;
  const G = (num >> 8 & 0x00FF) - amt;
  const B = (num & 0x0000FF) - amt;
  return '#' + (0x1000000 + (R > 0 ? R : 0) * 0x10000 +
    (G > 0 ? G : 0) * 0x100 +
    (B > 0 ? B : 0)).toString(16).slice(1);
}

// Re-export types
export type { ThemeConfig, EventTheme };
export { GALLERY_THEME_PRESETS };