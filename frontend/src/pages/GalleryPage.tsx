import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { AlertCircle, Clock } from 'lucide-react';
import { differenceInDays, parseISO } from 'date-fns';
import { useTranslation } from 'react-i18next';
import { useLocalizedDate } from '../hooks/useLocalizedDate';
import { useQuery } from '@tanstack/react-query';

import { Card, CardContent, Input, Button, Loading, ReCaptcha } from '../components/common';
import { useGalleryAuth, useTheme } from '../contexts';
import { useGalleryInfo } from '../hooks/useGallery';
import { GalleryView } from '../components/gallery';
import { analyticsService } from '../services/analytics.service';
import { api } from '../config/api';
import { GALLERY_THEME_PRESETS } from '../types/theme.types';
import { buildResourceUrl } from '../utils/url';

export const GalleryPage: React.FC = () => {
  const { slug, token } = useParams<{ slug: string; token?: string }>();
  const { isAuthenticated, login, event } = useGalleryAuth();
  const { t, i18n } = useTranslation();
  const { format } = useLocalizedDate();
  const { setTheme } = useTheme();
  const [password, setPassword] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [recaptchaToken, setRecaptchaToken] = useState<string | null>(null);

  // Fetch gallery info (public data)
  const { data: galleryInfo, isLoading: isLoadingInfo, error: infoError } = useGalleryInfo(slug!, token);
  
  // Fetch branding settings
  const { data: settingsData } = useQuery({
    queryKey: ['gallery-settings'],
    queryFn: async () => {
      const response = await api.get('/public/settings');
      return response.data;
    },
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });
  
  // Set language from admin settings when on login page
  React.useEffect(() => {
    if (!isAuthenticated && settingsData?.default_language) {
      i18n.changeLanguage(settingsData.default_language);
    }
  }, [settingsData, isAuthenticated, i18n]);

  // Apply theme for login page
  React.useEffect(() => {
    if (!isAuthenticated && galleryInfo && settingsData) {
      let themeToApply = null;
      
      if (galleryInfo.color_theme) {
        try {
          // Check if it's a valid JSON string
          if (galleryInfo.color_theme.startsWith('{')) {
            themeToApply = JSON.parse(galleryInfo.color_theme);
          } else {
            // Handle legacy theme names - check if it's a preset
            const preset = GALLERY_THEME_PRESETS[galleryInfo.color_theme];
            if (preset) {
              themeToApply = preset.config;
            } else {
              // Unknown theme name, fall back to global theme
              if (settingsData.theme_config) {
                themeToApply = settingsData.theme_config;
              }
            }
          }
        } catch (e) {
          console.error('Failed to parse event theme:', e);
          // Fall back to global theme
          if (settingsData.theme_config) {
            themeToApply = settingsData.theme_config;
          }
        }
      } else if (settingsData.theme_config) {
        // No event theme, use global theme
        themeToApply = settingsData.theme_config;
      }
      
      // Apply theme
      if (themeToApply) {
        setTheme(themeToApply);
      }
    }
  }, [galleryInfo, settingsData, isAuthenticated, setTheme]);

  // Calculate days until expiration
  const daysUntilExpiration = galleryInfo
    ? differenceInDays(parseISO(galleryInfo.expires_at), new Date())
    : null;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation(); // Prevent any bubbling
    
    if (!password.trim()) {
      setLoginError(t('auth.pleaseEnterPassword'));
      return;
    }

    try {
      setIsLoggingIn(true);
      setLoginError(null);
      await login(slug!, password, recaptchaToken);
      
      // Track successful password entry
      analyticsService.trackGalleryEvent('password_entry', {
        gallery: slug,
        success: true
      });
    } catch (error: any) {
      console.error('Login error:', error);
      const errorMessage = error.response?.data?.error || 'Invalid password';
      const statusCode = error.response?.status;
      
      // Map backend error messages to user-friendly translations
      if (statusCode === 401 || errorMessage.toLowerCase().includes('invalid password')) {
        setLoginError(t('auth.wrongPassword'));
      } else if (statusCode === 429 || errorMessage.toLowerCase().includes('too many')) {
        setLoginError(t('auth.tooManyAttempts'));
      } else if (statusCode === 404) {
        setLoginError(t('errors.galleryNotFound'));
      } else {
        setLoginError(t('auth.invalidPassword'));
      }
      
      // Track failed password entry
      analyticsService.trackGalleryEvent('password_entry', {
        gallery: slug,
        success: false,
        statusCode
      });
      
      // Keep the password field to allow retry
      // Do not clear the password
    } finally {
      setIsLoggingIn(false);
    }
  };

  // Show loading state
  if (isLoadingInfo) {
    return (
      <div className="min-h-screen" style={{ backgroundColor: 'var(--color-background, #fafafa)' }}>
        <div className="min-h-screen flex items-center justify-center">
          <Loading size="lg" text={t('gallery.loading')} />
        </div>
      </div>
    );
  }

  // Show error state
  if (infoError) {
    // Check if it's an archived gallery error
    const errorMessage = (infoError as any)?.response?.data?.error;
    const isArchived = errorMessage?.includes('archived');
    
    return (
      <div className="min-h-screen" style={{ backgroundColor: 'var(--color-background, #fafafa)' }}>
        <div className="min-h-screen flex flex-col">
          {/* Logo at top */}
          {settingsData?.branding_logo_url && (
            <div className="p-8 text-center">
              <img 
                src={buildResourceUrl(settingsData.branding_logo_url)} 
                alt={settingsData.branding_company_name || 'Company Logo'}
                className="h-16 w-auto object-contain mx-auto"
              />
            </div>
          )}
          
          <div className="flex-1 flex items-center justify-center">
            <Card className="max-w-md w-full mx-4">
              <CardContent className="text-center py-12">
                <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
                <h2 className="text-xl font-semibold mb-2">
                  {t(isArchived ? 'errors.galleryArchived' : 'errors.galleryNotFound')}
                </h2>
                <p className="text-neutral-600">
                  {t(isArchived ? 'errors.galleryArchivedMessage' : 'errors.galleryNotFoundMessage')}
                </p>
              </CardContent>
            </Card>
          </div>
          
          {/* Legal Links */}
          <div className="p-8 text-center">
            <div className="flex items-center justify-center gap-4">
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
            <p className="text-xs mt-2 text-neutral-500">
              Powered by <span className="font-semibold">PicPeak</span>
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Show expired state
  if (galleryInfo?.is_expired) {
    return (
      <div className="min-h-screen" style={{ backgroundColor: 'var(--color-background, #fafafa)' }}>
        <div className="min-h-screen flex flex-col">
          {/* Logo at top */}
          {settingsData?.branding_logo_url && (
            <div className="p-8 text-center">
              <img 
                src={buildResourceUrl(settingsData.branding_logo_url)} 
                alt={settingsData.branding_company_name || 'Company Logo'}
                className="h-16 w-auto object-contain mx-auto"
              />
            </div>
          )}
          
          <div className="flex-1 flex items-center justify-center">
            <Card className="max-w-md w-full mx-4">
              <CardContent className="text-center py-12">
                <Clock className="w-16 h-16 text-amber-500 mx-auto mb-4" />
                <h2 className="text-xl font-semibold mb-2">{t('gallery.expired')}</h2>
                <p className="text-neutral-600 mb-4">
                  {t('gallery.expiredOn', { date: format(parseISO(galleryInfo.expires_at), 'PP') })}
                </p>
                <p className="text-sm text-neutral-500">
                  {t('gallery.contactOrganizer')}
                </p>
              </CardContent>
            </Card>
          </div>
          
          {/* Legal Links */}
          <div className="p-8 text-center">
            <div className="flex items-center justify-center gap-4">
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
            <p className="text-xs mt-2 text-neutral-500">
              Powered by <span className="font-semibold">PicPeak</span>
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Show gallery view if authenticated
  if (isAuthenticated && event) {
    return <GalleryView slug={slug!} event={event} />;
  }

  // Show login form
  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--color-background, #fafafa)' }}>
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="w-full max-w-lg">
          {/* Logo/Header */}
          <div className="text-center mb-4 sm:mb-6">
            <img 
              src={settingsData?.branding_logo_url ? 
                buildResourceUrl(settingsData.branding_logo_url) : 
                '/picpeak-logo-transparent.png'
              } 
              alt={settingsData?.branding_company_name || 'PicPeak'}
              className="h-12 sm:h-16 lg:h-20 w-auto object-contain mx-auto mb-3 sm:mb-4"
            />
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold mb-2 px-2" style={{ color: 'var(--color-primary, #5C8762)' }}>
              {galleryInfo?.event_name}
            </h1>
          </div>

          {/* Expiration Warning */}
          {daysUntilExpiration !== null && daysUntilExpiration <= 7 && (
            <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <div className="flex items-start">
                <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5 text-amber-600 mt-0.5 mr-2 flex-shrink-0" />
                <div>
                  <p className="text-xs sm:text-sm font-medium text-amber-800">
                    {t('gallery.expiresIn', { count: daysUntilExpiration })}
                  </p>
                  <p className="text-xs text-amber-700 mt-1">
                    {t('gallery.downloadBefore')}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Login Card */}
          <Card>
            <CardContent className="p-4 sm:p-6">
              <h2 className="text-base sm:text-lg lg:text-xl font-semibold mb-4">{t('auth.enterPassword')}</h2>
              
              <form onSubmit={handleLogin} className="space-y-4">
                <Input
                  type="password"
                  label={t('auth.password')}
                  placeholder={t('auth.passwordPlaceholder')}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  error={loginError || undefined}
                  autoFocus
                  className="text-sm sm:text-base"
                />
                
                <ReCaptcha
                  onChange={setRecaptchaToken}
                  onExpired={() => setRecaptchaToken(null)}
                />
                
                <Button
                  type="submit"
                  variant="primary"
                  size="lg"
                  className="w-full text-sm sm:text-base"
                  isLoading={isLoggingIn}
                  disabled={isLoggingIn}
                >
                  {t('gallery.viewGallery')}
                </Button>
              </form>

              <p className="text-xs text-neutral-500 text-center mt-4 sm:mt-6">
                {t('auth.passwordHint')}
              </p>
            </CardContent>
          </Card>

          {/* Legal Links */}
          <div className="text-center mt-4 sm:mt-6">
            <div className="flex items-center justify-center gap-4">
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
            <p className="text-xs mt-2 text-neutral-500">
              Powered by <span className="font-semibold">PicPeak</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};