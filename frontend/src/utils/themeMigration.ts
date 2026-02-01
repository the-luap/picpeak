import type { ThemeConfig, HeaderStyleType, HeroDividerStyle, GalleryLayoutType } from '../types/theme.types';

/**
 * Migrates legacy theme configurations that used 'hero' as a galleryLayout
 * to the new decoupled headerStyle + galleryLayout system.
 *
 * This ensures backward compatibility with existing events that have
 * 'hero' set as their galleryLayout.
 */
export function migrateThemeConfig(theme: ThemeConfig): ThemeConfig {
  if (!theme) return theme;

  // Check if this theme uses the legacy 'hero' layout
  if ((theme.galleryLayout as string) === 'hero') {
    return {
      ...theme,
      headerStyle: 'hero' as HeaderStyleType,
      galleryLayout: 'grid' as GalleryLayoutType,
      heroDividerStyle: (theme.heroDividerStyle || 'wave') as HeroDividerStyle,
    };
  }

  // If headerStyle is not set but galleryLayout is valid, default to 'standard'
  if (!theme.headerStyle && theme.galleryLayout) {
    return {
      ...theme,
      headerStyle: 'standard' as HeaderStyleType,
    };
  }

  return theme;
}

/**
 * Parses and migrates a color_theme JSON string from the database.
 * Handles both JSON strings and legacy preset names.
 */
export function parseAndMigrateTheme(colorTheme: string | null | undefined): ThemeConfig | null {
  if (!colorTheme) return null;

  try {
    // Check if it's a JSON string
    if (colorTheme.startsWith('{')) {
      const parsed = JSON.parse(colorTheme);
      return migrateThemeConfig(parsed);
    }

    // Legacy preset name - return null to let the caller handle preset lookup
    return null;
  } catch {
    // Invalid JSON
    return null;
  }
}

/**
 * Checks if a theme configuration needs migration from legacy hero layout.
 */
export function needsMigration(theme: ThemeConfig): boolean {
  return (theme.galleryLayout as string) === 'hero';
}
