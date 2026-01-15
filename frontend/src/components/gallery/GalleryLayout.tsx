import React from 'react';
import { Link } from 'react-router-dom';
import { Calendar, Clock, Download, LogOut } from 'lucide-react';
import { parseISO } from 'date-fns';
import { useTranslation } from 'react-i18next';
import { useLocalizedDate } from '../../hooks/useLocalizedDate';
import { Button } from '../common';
import { DynamicFavicon } from '../common/DynamicFavicon';
import { useTheme } from '../../contexts/ThemeContext';
import { buildResourceUrl } from '../../utils/url';

interface GalleryLayoutProps {
  event: {
    event_name: string;
    event_type?: string;
    event_date?: string;
    expires_at?: string;
  };
  brandingSettings?: {
    company_name?: string;
    company_tagline?: string;
    support_email?: string;
    footer_text?: string;
    favicon_url?: string;
    logo_url?: string;
    logo_size?: 'small' | 'medium' | 'large' | 'xlarge' | 'custom';
    logo_max_height?: number;
    logo_position?: 'left' | 'center' | 'right';
    logo_display_header?: boolean;
    logo_display_hero?: boolean;
    logo_display_mode?: 'logo_only' | 'text_only' | 'logo_and_text';
    hide_powered_by?: boolean;
  };
  showLogout?: boolean;
  onLogout?: () => void;
  showDownloadAll?: boolean;
  onDownloadAll?: () => void;
  isDownloading?: boolean;
  headerExtra?: React.ReactNode;
  menuButton?: React.ReactNode;
  children: React.ReactNode;
}

export const GalleryLayout: React.FC<GalleryLayoutProps> = ({
  event,
  brandingSettings,
  showLogout = false,
  onLogout,
  showDownloadAll = false,
  onDownloadAll,
  isDownloading = false,
  headerExtra,
  menuButton,
  children,
}) => {
  const { t } = useTranslation();
  const { format } = useLocalizedDate();
  const { theme } = useTheme();
  
  const isNonGridLayout = theme.galleryLayout && theme.galleryLayout !== 'grid' && theme.galleryLayout !== 'hero';
  const fontFamily = theme.fontFamily || 'Inter, sans-serif';
  const headingFontFamily = theme.headingFontFamily || fontFamily;
  
  // Calculate logo size classes based on settings
  const getLogoDimensions = (context: 'header' | 'hero'): { className: string; style?: React.CSSProperties } => {
    const size = brandingSettings?.logo_size || 'medium';
    const maxHeight = brandingSettings?.logo_max_height || 48;

    if (size === 'custom') {
      return {
        className: '',
        style: { maxHeight: `${maxHeight}px`, height: 'auto' }
      };
    }

    const sizeMap: Record<'small' | 'medium' | 'large' | 'xlarge', string> = {
      small: context === 'header' ? 'h-6 sm:h-8' : 'h-12 sm:h-14 lg:h-16',
      medium: context === 'header' ? 'h-8 sm:h-10 lg:h-12' : 'h-16 sm:h-20 lg:h-24',
      large: context === 'header' ? 'h-10 sm:h-12 lg:h-16' : 'h-20 sm:h-24 lg:h-32',
      xlarge: context === 'header' ? 'h-12 sm:h-16 lg:h-20' : 'h-24 sm:h-32 lg:h-40'
    };

    return {
      className: sizeMap[size as keyof typeof sizeMap] || sizeMap.medium,
      style: undefined
    };
  };
  
  // Determine logo position classes
  const getLogoPositionClass = () => {
    const position = brandingSettings?.logo_position || 'left';
    return {
      left: 'justify-start',
      center: 'justify-center',
      right: 'justify-end'
    }[position];
  };
  
  // Check if logo should be displayed
  const shouldShowLogo = (context: 'header' | 'hero') => {
    const displayMode = brandingSettings?.logo_display_mode || 'logo_and_text';
    if (displayMode === 'text_only') return false;
    
    if (context === 'header') {
      return brandingSettings?.logo_display_header !== false;
    } else {
      return brandingSettings?.logo_display_hero !== false;
    }
  };
  
  // Check if company name should be displayed
  const shouldShowCompanyName = () => {
    const displayMode = brandingSettings?.logo_display_mode || 'logo_and_text';
    return displayMode !== 'logo_only';
  };

  const headerLogoSize = getLogoDimensions('header');
  const heroLogoSize = getLogoDimensions('hero');
  
  return (
    <div className="gallery-page min-h-screen bg-neutral-50">
      {/* Dynamic Favicon */}
      <DynamicFavicon />

      {/* Header structure */}
      <header className={`gallery-header bg-white border-b border-neutral-200 sticky top-0 z-40 ${isNonGridLayout || theme.galleryLayout === 'hero' ? 'shadow-sm' : ''}`}>
        {/* For non-grid layouts (excluding hero) - keep the current structure */}
        {isNonGridLayout && (
          <div className="bg-neutral-50 border-b border-neutral-200">
            <div className="container py-2">
              <div className="flex items-center justify-between">
                {/* Left side - Menu button and other header extras */}
                <div className="flex items-center gap-3">
                  {menuButton}
                  {headerExtra}
                </div>
                
                {/* Right side - Download and Logout */}
                <div className="flex items-center gap-3">
                  {/* Download all button */}
                  {showDownloadAll && onDownloadAll && (
                    <Button
                      variant="primary"
                      size="sm"
                      leftIcon={<Download className="w-4 h-4" />}
                      onClick={onDownloadAll}
                      isLoading={isDownloading}
                      className="gallery-btn gallery-btn-download"
                    >
                      <span className="hidden sm:inline">{t('gallery.downloadAll')}</span>
                      <span className="sm:hidden">{t('common.download')}</span>
                    </Button>
                  )}

                  {/* Logout button */}
                  {showLogout && onLogout && (
                    <Button
                      variant="outline"
                      size="sm"
                      leftIcon={<LogOut className="w-4 h-4" />}
                      onClick={onLogout}
                      className="gallery-btn gallery-btn-logout sm:min-w-0"
                    >
                      <span className="hidden sm:inline">{t('common.logout')}</span>
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* For grid layout - everything in one bar */}
        {!isNonGridLayout && theme.galleryLayout !== 'hero' && (
          <div className="container py-3">
            <div className="flex items-center justify-between gap-2 sm:gap-4">
              {/* Left side - Menu button, Logo */}
              <div className="flex items-center gap-2 sm:gap-4 flex-shrink-0">
                {/* Menu button */}
                {menuButton && (
                  <div className="flex-shrink-0">
                    {menuButton}
                  </div>
                )}
                
                {/* Logo - Show custom logo or fallback to PicPeak logo */}
                {shouldShowLogo('header') && (
                  <div className={`gallery-logo-wrapper flex-shrink-0 flex items-center gap-2 ${brandingSettings?.logo_position === 'center' ? 'flex-1' : ''} ${getLogoPositionClass()}`}>
                    <img
                      src={brandingSettings?.logo_url ?
                        buildResourceUrl(brandingSettings.logo_url) :
                        '/picpeak-logo-transparent.png'
                      }
                      alt={brandingSettings?.company_name || 'PicPeak'}
                      className={`gallery-logo ${headerLogoSize.className} w-auto object-contain`}
                      style={headerLogoSize.style}
                    />
                    {shouldShowCompanyName() && brandingSettings?.company_name && (
                      <span className="hidden sm:inline text-lg font-semibold text-neutral-900">
                        {brandingSettings.company_name}
                      </span>
                    )}
                  </div>
                )}
                {!shouldShowLogo('header') && shouldShowCompanyName() && brandingSettings?.company_name && (
                  <div className={`flex-shrink-0 ${brandingSettings?.logo_position === 'center' ? 'flex-1' : ''} ${getLogoPositionClass()}`}>
                    <span className="text-lg font-semibold text-neutral-900">
                      {brandingSettings.company_name || 'PicPeak'}
                    </span>
                  </div>
                )}
              </div>
              
              {/* Center - Event info */}
              <div className="flex-1 min-w-0 text-center sm:text-left">
                <h1 
                  className="text-base sm:text-lg lg:text-xl font-bold text-neutral-900 leading-tight truncate"
                  style={{ fontFamily: headingFontFamily }}
                >
                  {event.event_name}
                </h1>
                {(event.event_date || event.expires_at) && (
                  <div className="hidden sm:flex flex-wrap gap-x-3 gap-y-1 mt-1 text-xs sm:text-sm text-neutral-600">
                    {event.event_date && (
                      <span className="flex items-center">
                        <Calendar className="w-3 h-3 sm:w-4 sm:h-4 mr-1 flex-shrink-0" />
                        <span>{format(parseISO(event.event_date), 'PP')}</span>
                      </span>
                    )}
                    {event.expires_at && (
                      <span className="flex items-center">
                        <Clock className="w-3 h-3 sm:w-4 sm:h-4 mr-1 flex-shrink-0" />
                        <span>{t('gallery.expires')} {format(parseISO(event.expires_at), 'PP')}</span>
                      </span>
                    )}
                  </div>
                )}
              </div>
              
              {/* Right side - Action buttons */}
              <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
                {/* Extra header items (upload button, etc.) */}
                {headerExtra && (
                  <div className="hidden sm:block">
                    {headerExtra}
                  </div>
                )}
                
                {/* Download all button - hidden on mobile when sidebar is shown */}
                {showDownloadAll && onDownloadAll && (
                  <Button
                    variant="primary"
                    size="sm"
                    leftIcon={<Download className="w-4 h-4" />}
                    onClick={onDownloadAll}
                    isLoading={isDownloading}
                    className="gallery-btn gallery-btn-download hidden sm:flex"
                  >
                    <span className="hidden sm:inline">{t('gallery.downloadAll')}</span>
                    <span className="sm:hidden">{t('common.download')}</span>
                  </Button>
                )}

                {/* Logout button */}
                {showLogout && onLogout && (
                  <Button
                    variant="outline"
                    size="sm"
                    leftIcon={<LogOut className="w-4 h-4" />}
                    onClick={onLogout}
                    className="gallery-btn gallery-btn-logout sm:min-w-0"
                  >
                    <span className="hidden sm:inline">{t('common.logout')}</span>
                  </Button>
                )}
              </div>
            </div>
            
            {/* Mobile dates row */}
            {(event.event_date || event.expires_at) && (
              <div className="flex sm:hidden justify-center gap-x-3 mt-2 text-xs text-neutral-600">
                {event.event_date && (
                  <span className="flex items-center">
                    <Calendar className="w-3 h-3 mr-1 flex-shrink-0" />
                    <span>{format(parseISO(event.event_date), 'PP')}</span>
                  </span>
                )}
                {event.expires_at && (
                  <span className="flex items-center">
                    <Clock className="w-3 h-3 mr-1 flex-shrink-0" />
                    <span>{t('gallery.expires')} {format(parseISO(event.expires_at), 'PP')}</span>
                  </span>
                )}
              </div>
            )}
          </div>
        )}

        {/* For hero layout - minimal header with just menu and logout */}
        {theme.galleryLayout === 'hero' && (
          <div className="container py-3">
            <div className="flex items-center justify-between">
              {/* Left side - Menu button */}
              <div className="flex items-center gap-3">
                {menuButton}
                {headerExtra}
              </div>

              {/* Right side - Action buttons */}
              <div className="flex items-center gap-3 flex-shrink-0">
                {/* Download all button */}
                {showDownloadAll && onDownloadAll && (
                  <Button
                    variant="primary"
                    size="sm"
                    leftIcon={<Download className="w-4 h-4" />}
                    onClick={onDownloadAll}
                    isLoading={isDownloading}
                    className="gallery-btn gallery-btn-download"
                  >
                    <span className="hidden sm:inline">{t('gallery.downloadAll')}</span>
                    <span className="sm:hidden">{t('common.download')}</span>
                  </Button>
                )}

                {/* Logout button */}
                {showLogout && onLogout && (
                  <Button
                    variant="outline"
                    size="sm"
                    leftIcon={<LogOut className="w-4 h-4" />}
                    onClick={onLogout}
                    className="gallery-btn gallery-btn-logout sm:min-w-0"
                  >
                    <span className="hidden sm:inline">{t('common.logout')}</span>
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}
      </header>

      {/* Hero Header for non-grid layouts (excluding hero layout which has its own) */}
      {isNonGridLayout && (
        <div
          className="gallery-hero relative text-white overflow-hidden"
          style={{
            backgroundColor: theme.accentColor || '#22c55e',
            backgroundImage: theme.backgroundPattern !== 'none' 
              ? `url("data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%23ffffff' fill-opacity='0.03'%3E%3Cpath d='M0 40L40 0H20L0 20M40 40V20L20 40'/%3E%3C/g%3E%3C/svg%3E")`
              : undefined
          }}
        >
          <div className="container py-12 sm:py-16 lg:py-20 relative z-10">
            <div className="text-center max-w-4xl mx-auto">
              {/* Logo - Show custom logo or fallback to PicPeak logo */}
              {shouldShowLogo('hero') && (
                <div className="mb-6">
                  <img 
                    src={brandingSettings?.logo_url ? 
                      buildResourceUrl(brandingSettings.logo_url) : 
                      '/picpeak-logo-transparent.png'
                    } 
                    alt={brandingSettings?.company_name || 'PicPeak'}
                    className={`${heroLogoSize.className} w-auto object-contain mx-auto`}
                    style={{
                      ...(heroLogoSize.style || {}),
                      // Only apply brightness/invert filter to default logo; custom logos display as-is
                      filter: brandingSettings?.logo_url
                        ? 'drop-shadow(0 2px 4px rgba(0, 0, 0, 0.3))'
                        : 'brightness(0) invert(1) drop-shadow(0 2px 4px rgba(0, 0, 0, 0.3))'
                    }}
                  />
                  {shouldShowCompanyName() && brandingSettings?.company_name && (
                    <div className="mt-3 text-xl sm:text-2xl font-semibold text-white/90" style={{ textShadow: '0 2px 4px rgba(0, 0, 0, 0.3)' }}>
                      {brandingSettings.company_name}
                    </div>
                  )}
                </div>
              )}
              {!shouldShowLogo('hero') && shouldShowCompanyName() && brandingSettings?.company_name && (
                <div className="mb-6 text-2xl sm:text-3xl font-bold text-white" style={{ textShadow: '0 2px 4px rgba(0, 0, 0, 0.3)' }}>
                  {brandingSettings.company_name || 'PicPeak'}
                </div>
              )}
              
              {/* Event Name */}
              <h1 
                className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-4"
                style={{ 
                  fontFamily: headingFontFamily,
                  textShadow: '0 2px 4px rgba(0, 0, 0, 0.3)'
                }}
              >
                {event.event_name}
              </h1>
              
              {/* Event Details */}
              {(event.event_date || event.expires_at) && (
                <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6 text-white/80" style={{ textShadow: '0 1px 3px rgba(0, 0, 0, 0.3)' }}>
                  {event.event_date && (
                    <span className="flex items-center text-lg">
                      <Calendar className="w-5 h-5 mr-2" />
                      {format(parseISO(event.event_date), 'PP')}
                    </span>
                  )}
                  {event.expires_at && (
                    <span className="flex items-center text-lg">
                      <Clock className="w-5 h-5 mr-2" />
                      {t('gallery.expires')} {format(parseISO(event.expires_at), 'PP')}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
          
          {/* Decorative bottom wave */}
          <div className="absolute bottom-0 left-0 right-0">
            <svg className="w-full h-12 sm:h-16" viewBox="0 0 1200 120" preserveAspectRatio="none">
              <path d="M0,60 C150,90 350,30 600,60 C850,90 1050,30 1200,60 L1200,120 L0,120 Z" 
                fill="var(--color-background, #fafafa)" />
            </svg>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="container">{children}</main>

      {/* Footer */}
      <footer className="gallery-footer mt-8 sm:mt-12 py-6 sm:py-8 border-t border-neutral-200">
        <div className="container text-center px-4">
          {brandingSettings?.support_email && (
            <p className="text-xs sm:text-sm text-neutral-600 mb-2">
              {t('gallery.needHelp')}{' '}
              <a 
                href={`mailto:${brandingSettings.support_email}`}
                className="text-primary-600 hover:text-primary-700 break-all"
              >
                {brandingSettings.support_email}
              </a>
            </p>
          )}
          <p className="text-xs sm:text-sm text-neutral-500">
            {brandingSettings?.footer_text || '© 2024 Your Company. All rights reserved.'}
            {!brandingSettings?.hide_powered_by && (
              <> | Powered by <span className="font-semibold">PicPeak</span></>
            )}
          </p>
          {brandingSettings?.company_name && brandingSettings?.company_tagline && (
            <p className="text-xs text-neutral-400 mt-2">
              {brandingSettings.company_name} - {brandingSettings.company_tagline}
            </p>
          )}
          {/* Legal Links */}
          <div className="mt-4 flex items-center justify-center gap-4">
            <Link 
              to="/impressum" 
              className="text-xs text-neutral-500 hover:text-neutral-700 transition-colors"
            >
              {t('legal.impressum')}
            </Link>
            <span className="text-xs text-neutral-400">|</span>
            <Link 
              to="/datenschutz" 
              className="text-xs text-neutral-500 hover:text-neutral-700 transition-colors"
            >
              {t('legal.datenschutz')}
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
};

GalleryLayout.displayName = 'GalleryLayout';
