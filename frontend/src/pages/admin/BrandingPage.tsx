import React, { useState, useEffect, useRef } from 'react';
import { Save, Eye, Palette, Upload } from 'lucide-react';
import { toast } from 'react-toastify';
import { Button, Card, Input, ErrorBoundary, Loading } from '../../components/common';
import { ThemeCustomizerEnhanced, GalleryPreview } from '../../components/admin';
import { useTheme, type ThemeConfig, GALLERY_THEME_PRESETS } from '../../contexts/ThemeContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { settingsService, type BrandingSettings } from '../../services/settings.service';
import { useTranslation } from 'react-i18next';
import { buildResourceUrl } from '../../utils/url';

export const BrandingPage: React.FC = () => {
  const { t } = useTranslation();
  const { theme, setTheme } = useTheme();
  const [brandingSettings, setBrandingSettings] = useState<BrandingSettings>({
    company_name: '',
    company_tagline: '',
    footer_text: '© 2024 Your Company. All rights reserved.',
    support_email: '',
    watermark_enabled: false,
    watermark_position: 'bottom-right',
    watermark_opacity: 50,
    watermark_size: 15,
    watermark_logo_url: '',
    favicon_url: '',
  });

  const [currentTheme, setCurrentTheme] = useState<ThemeConfig>(theme);
  const [currentThemeName, setCurrentThemeName] = useState('default');
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const faviconInputRef = useRef<HTMLInputElement>(null);

  // Fetch current settings
  const { data: settings, isLoading } = useQuery({
    queryKey: ['admin-settings', 'branding'],
    queryFn: () => settingsService.getSettingsByType('branding'),
  });

  // Fetch theme settings
  const { data: themeSettings } = useQuery({
    queryKey: ['admin-settings', 'theme'],
    queryFn: () => settingsService.getSettingsByType('theme'),
  });

  // Update branding mutation
  const queryClient = useQueryClient();
  
  const brandingMutation = useMutation({
    mutationFn: settingsService.updateBranding,
    onSuccess: () => {
      toast.success(t('toast.brandingUpdated'));
      // Invalidate all settings queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['admin-settings'] });
      queryClient.invalidateQueries({ queryKey: ['public-settings'] });
    },
    onError: () => {
      toast.error(t('toast.saveError'));
    },
  });

  // Update theme mutation
  const themeMutation = useMutation({
    mutationFn: settingsService.updateTheme,
    onSuccess: () => {
      toast.success(t('toast.themeUpdated'));
    },
    onError: () => {
      toast.error(t('toast.saveError'));
    },
  });

  // Initialize settings from database
  useEffect(() => {
    if (settings) {
      const formatted = settingsService.formatBrandingSettings(settings);
      // Don't set logo_url here - it will be synced from theme
      const { logo_url, ...brandingWithoutLogo } = formatted;
      setBrandingSettings(prev => ({ ...prev, ...brandingWithoutLogo }));
    }
  }, [settings]);

  // Initialize theme from database
  useEffect(() => {
    if (themeSettings) {
      const formatted = settingsService.formatThemeSettings(themeSettings) as ThemeConfig;
      
      if (formatted && Object.keys(formatted).length > 0) {
        // Use the theme's logo URL as stored in the theme config
        setCurrentTheme(formatted);
        setTheme(formatted);
        
        // Always sync the logo URL from theme to branding settings - theme is source of truth
        setBrandingSettings(prev => ({ ...prev, logo_url: formatted.logoUrl || '' }));
        
        // Try to identify which preset this matches
        for (const [key, preset] of Object.entries(GALLERY_THEME_PRESETS)) {
          if (JSON.stringify(preset.config) === JSON.stringify(formatted)) {
            setCurrentThemeName(key);
            break;
          }
        }
      }
    }
  }, [themeSettings, setTheme]);

  const handleBrandingChange = (key: string, value: any) => {
    setBrandingSettings(prev => ({ ...prev, [key]: value }));
  };

  const handleThemeChange = (newTheme: ThemeConfig) => {
    setCurrentTheme(newTheme);
    // Also update logo URL in branding settings if it changed
    if (newTheme.logoUrl !== currentTheme.logoUrl) {
      setBrandingSettings(prev => ({ ...prev, logo_url: newTheme.logoUrl || '' }));
    }
    if (isPreviewMode) {
      setTheme(newTheme);
    }
  };

  const handlePresetChange = (presetName: string) => {
    setCurrentThemeName(presetName);
    // Get the preset theme config
    const preset = GALLERY_THEME_PRESETS[presetName];
    if (preset) {
      setCurrentTheme(preset.config);
      if (isPreviewMode) {
        setTheme(preset.config);
      }
    }
  };

  const handleFaviconUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const faviconUrl = await settingsService.uploadFavicon(file);
        setBrandingSettings(prev => ({ ...prev, favicon_url: faviconUrl }));
        toast.success(t('toast.uploadSuccess'));
      } catch (error) {
        console.error('Failed to upload favicon:', error);
        toast.error(t('toast.uploadError'));
      }
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const logoUrl = await settingsService.uploadLogo(file);
        setBrandingSettings(prev => ({ ...prev, logo_url: logoUrl }));
        setCurrentTheme(prev => {
          const updated = { ...prev, logoUrl };
          if (isPreviewMode) {
            setTheme(updated);
          }
          return updated;
        });
        toast.success(t('toast.uploadSuccess'));
      } catch (error) {
        console.error('Failed to upload logo:', error);
        toast.error(t('toast.uploadError'));
      }
    }
  };

  const handleRemoveLogo = () => {
    setBrandingSettings(prev => ({ ...prev, logo_url: '' }));
    setCurrentTheme(prev => {
      const updated = { ...prev, logoUrl: '' };
      if (isPreviewMode) {
        setTheme(updated);
      }
      return updated;
    });
  };

  const handleWatermarkLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const watermarkLogoUrl = await settingsService.uploadWatermarkLogo(file);
        setBrandingSettings(prev => ({ ...prev, watermark_logo_url: watermarkLogoUrl }));
        toast.success(t('toast.uploadSuccess'));
      } catch (error) {
        console.error('Failed to upload watermark logo:', error);
        toast.error(t('toast.uploadError'));
      }
    }
  };

  const handleSave = async () => {
    try {
      // Sync logo URL from theme to branding settings
      const updatedBrandingSettings = {
        ...brandingSettings,
        logo_url: currentTheme.logoUrl || ''
      };
      
      // Save branding settings to database
      await brandingMutation.mutateAsync(updatedBrandingSettings);
      
      // Save theme settings to database
      await themeMutation.mutateAsync(currentTheme);
      
      // Apply theme globally
      setTheme(currentTheme);
      
      // Update local state to reflect saved values
      setBrandingSettings(updatedBrandingSettings);
    } catch (error) {
      console.error('Failed to save settings:', error);
    }
  };

  const handlePreview = () => {
    const previewWindow = window.open('/gallery/preview', '_blank');
    if (previewWindow) {
      // Send theme data to preview window
      setTimeout(() => {
        previewWindow.postMessage({
          type: 'THEME_PREVIEW',
          theme: currentTheme,
          branding: brandingSettings
        }, window.location.origin);
      }, 1000);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loading size="lg" text={t('branding.loadingBranding')} />
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div>
        {/* Page Header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold text-neutral-900">{t('branding.title')}</h1>
            <p className="text-neutral-600 mt-1">{t('branding.subtitle')}</p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              leftIcon={<Eye className="w-4 h-4" />}
              onClick={handlePreview}
            >
              {t('branding.preview')}
            </Button>
            <Button
              variant="primary"
              leftIcon={<Save className="w-4 h-4" />}
              onClick={handleSave}
            >
              {t('branding.saveChanges')}
            </Button>
          </div>
        </div>

        {/* Company Branding */}
        <Card padding="md" className="mb-6">
          <h2 className="text-lg font-semibold text-neutral-900 mb-4">{t('branding.companyInfo')}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Input
              label={t('branding.companyName')}
              value={brandingSettings.company_name}
              onChange={(e) => handleBrandingChange('company_name', e.target.value)}
              placeholder={t('branding.companyName')}
              helperText={t('branding.companyNameHelp')}
            />
            <Input
              label={t('branding.companyTagline')}
              value={brandingSettings.company_tagline}
              onChange={(e) => handleBrandingChange('company_tagline', e.target.value)}
              placeholder={t('branding.companyTagline')}
              helperText={t('branding.companyTaglineHelp')}
            />
            <Input
              label={t('branding.supportEmail')}
              type="email"
              value={brandingSettings.support_email}
              onChange={(e) => handleBrandingChange('support_email', e.target.value)}
              placeholder="support@yourcompany.com"
              helperText={t('branding.supportEmailHelp')}
            />
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                {t('branding.footerText')}
              </label>
              <textarea
                value={brandingSettings.footer_text}
                onChange={(e) => handleBrandingChange('footer_text', e.target.value)}
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                rows={2}
                placeholder="© 2024 Your Company. All rights reserved."
              />
            </div>
          </div>

          <div className="mt-6 pt-6 border-t border-neutral-200">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                {t('branding.favicon')}
              </label>
              <div className="space-y-2">
                {brandingSettings.favicon_url && (
                  <div className="flex items-center gap-2">
                    <img 
                      src={brandingSettings.favicon_url.startsWith('http') ? brandingSettings.favicon_url : buildResourceUrl(brandingSettings.favicon_url)} 
                      alt="Current favicon" 
                      className="w-8 h-8"
                    />
                    <span className="text-sm text-neutral-600">{t('branding.currentFavicon')}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleBrandingChange('favicon_url', '')}
                    >
                      {t('branding.removeFavicon')}
                    </Button>
                  </div>
                )}
                <div>
                  <input
                    ref={faviconInputRef}
                    type="file"
                    accept="image/png,image/x-icon"
                    onChange={handleFaviconUpload}
                    className="hidden"
                  />
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => faviconInputRef.current?.click()}
                    leftIcon={<Upload className="w-4 h-4" />}
                  >
                    {t('branding.uploadFavicon')}
                  </Button>
                  <p className="text-xs text-neutral-600 mt-1">{t('branding.faviconHelp')}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Logo Customization Settings */}
          <div className="mt-6 pt-6 border-t border-neutral-200">
            <h3 className="text-md font-semibold text-neutral-900 mb-4">{t('branding.logoCustomization', 'Logo Customization')}</h3>
            
            <div className="space-y-4">
              {/* Logo Upload */}
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  {t('branding.logo', 'Logo')}
                </label>
                <div className="flex items-center gap-4">
                  {brandingSettings.logo_url && (
                    <div className="relative">
                      <img 
                        src={brandingSettings.logo_url.startsWith('http') ? brandingSettings.logo_url : buildResourceUrl(brandingSettings.logo_url)} 
                        alt="Logo"
                        className="h-16 object-contain bg-neutral-100 rounded p-2"
                      />
                      <button
                        type="button"
                        onClick={handleRemoveLogo}
                        className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center hover:bg-red-600"
                      >
                        ×
                      </button>
                    </div>
                  )}
                  <label className="cursor-pointer">
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/svg+xml"
                      onChange={handleLogoUpload}
                      className="hidden"
                    />
                    <span className="btn-secondary inline-flex items-center">
                      <Upload className="w-4 h-4 mr-2" />
                      {brandingSettings.logo_url ? t('branding.changeLogo', 'Change Logo') : t('branding.uploadLogo', 'Upload Logo')}
                    </span>
                  </label>
                </div>
                <p className="text-xs text-neutral-600 mt-1">
                  {t('branding.logoHelp', 'PNG, JPG or SVG format, recommended width: 200px')}
                </p>
              </div>
              {/* Logo Size */}
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  {t('branding.logoSize', 'Logo Size')}
                </label>
                <select
                  value={brandingSettings.logo_size || 'medium'}
                  onChange={(e) => handleBrandingChange('logo_size', e.target.value)}
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                >
                  <option value="small">{t('branding.logoSizeSmall', 'Small (32px)')}</option>
                  <option value="medium">{t('branding.logoSizeMedium', 'Medium (48px)')}</option>
                  <option value="large">{t('branding.logoSizeLarge', 'Large (64px)')}</option>
                  <option value="xlarge">{t('branding.logoSizeXLarge', 'Extra Large (96px)')}</option>
                  <option value="custom">{t('branding.logoSizeCustom', 'Custom')}</option>
                </select>
              </div>

              {/* Custom Height (only shown when size is custom) */}
              {brandingSettings.logo_size === 'custom' && (
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-2">
                    {t('branding.logoMaxHeight', 'Maximum Height (pixels)')}
                  </label>
                  <input
                    type="number"
                    min="20"
                    max="200"
                    value={brandingSettings.logo_max_height || 48}
                    onChange={(e) => handleBrandingChange('logo_max_height', parseInt(e.target.value))}
                    className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                  />
                  <p className="text-xs text-neutral-600 mt-1">
                    {t('branding.logoMaxHeightHelp', 'Set a custom maximum height for the logo (20-200 pixels)')}
                  </p>
                </div>
              )}

              {/* Logo Position */}
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  {t('branding.logoPosition', 'Logo Position in Header')}
                </label>
                <div className="flex gap-2">
                  {(['left', 'center', 'right'] as const).map((position) => (
                    <button
                      key={position}
                      type="button"
                      onClick={() => handleBrandingChange('logo_position', position)}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                        brandingSettings.logo_position === position
                          ? 'bg-primary-600 text-white'
                          : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
                      }`}
                    >
                      {t(`branding.position${position.charAt(0).toUpperCase() + position.slice(1)}`, position.charAt(0).toUpperCase() + position.slice(1))}
                    </button>
                  ))}
                </div>
              </div>

              {/* Display Mode */}
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  {t('branding.logoDisplayMode', 'Display Mode')}
                </label>
                <select
                  value={brandingSettings.logo_display_mode || 'logo_and_text'}
                  onChange={(e) => handleBrandingChange('logo_display_mode', e.target.value)}
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                >
                  <option value="logo_only">{t('branding.logoOnly', 'Logo Only')}</option>
                  <option value="text_only">{t('branding.textOnly', 'Company Name Only')}</option>
                  <option value="logo_and_text">{t('branding.logoAndText', 'Logo and Company Name')}</option>
                </select>
              </div>

              {/* Display Options */}
              <div className="space-y-3">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={brandingSettings.logo_display_header !== false}
                    onChange={(e) => handleBrandingChange('logo_display_header', e.target.checked)}
                    className="rounded border-neutral-300 text-primary-600 focus:ring-primary-500"
                  />
                  <div>
                    <span className="text-sm font-medium text-neutral-900">
                      {t('branding.showLogoInHeader', 'Show logo in gallery header')}
                    </span>
                    <p className="text-xs text-neutral-600">
                      {t('branding.showLogoInHeaderHelp', 'Display the logo in the main header bar')}
                    </p>
                  </div>
                </label>

                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={brandingSettings.logo_display_hero !== false}
                    onChange={(e) => handleBrandingChange('logo_display_hero', e.target.checked)}
                    className="rounded border-neutral-300 text-primary-600 focus:ring-primary-500"
                  />
                  <div>
                    <span className="text-sm font-medium text-neutral-900">
                      {t('branding.showLogoInHero', 'Show logo in hero section')}
                    </span>
                    <p className="text-xs text-neutral-600">
                      {t('branding.showLogoInHeroHelp', 'Display the logo in hero sections (for non-grid layouts)')}
                    </p>
                  </div>
                </label>
              </div>
            </div>
          </div>

          <div className="mt-6 pt-6 border-t border-neutral-200">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={brandingSettings.watermark_enabled}
                onChange={(e) => handleBrandingChange('watermark_enabled', e.target.checked)}
                className="rounded border-neutral-300 text-primary-600 focus:ring-primary-500"
              />
              <div>
                <span className="text-sm font-medium text-neutral-900">{t('branding.enableWatermarks')}</span>
                <p className="text-xs text-neutral-600">{t('branding.watermarkHelp')}</p>
              </div>
            </label>
          </div>

          {/* Watermark Settings */}
          {brandingSettings.watermark_enabled && (
            <div className="mt-6 space-y-6 border-t border-neutral-200 pt-6">
              <h3 className="text-md font-semibold text-neutral-900">{t('branding.watermarkSettings')}</h3>
              
              {/* Watermark Logo Upload */}
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  {t('branding.watermarkLogo')}
                </label>
                <div className="space-y-2">
                  {brandingSettings.watermark_logo_url && (
                    <div className="flex items-center gap-2">
                      <img 
                        src={brandingSettings.watermark_logo_url.startsWith('http') ? brandingSettings.watermark_logo_url : buildResourceUrl(brandingSettings.watermark_logo_url)} 
                        alt="Current watermark" 
                        className="h-16 w-auto object-contain bg-neutral-100 p-2 rounded"
                      />
                      <span className="text-sm text-neutral-600">{t('branding.currentWatermark')}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleBrandingChange('watermark_logo_url', '')}
                      >
                        {t('common.delete')}
                      </Button>
                    </div>
                  )}
                  <div>
                    <input
                      type="file"
                      accept="image/png"
                      onChange={handleWatermarkLogoUpload}
                      className="hidden"
                      id="watermark-upload"
                    />
                    <label htmlFor="watermark-upload">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => document.getElementById('watermark-upload')?.click()}
                        leftIcon={<Upload className="w-4 h-4" />}
                      >
                        {t('branding.uploadWatermarkLogo')}
                      </Button>
                    </label>
                    <p className="text-xs text-neutral-600 mt-1">{t('branding.watermarkHelp')}</p>
                  </div>
                </div>
              </div>

              {/* Position Selector */}
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  {t('branding.watermarkPosition')}
                </label>
                <div className="grid grid-cols-3 gap-2 max-w-xs">
                  {[
                    { value: 'top-left', label: t('branding.topLeft') },
                    { value: 'top-right', label: t('branding.topRight') },
                    { value: 'center', label: t('branding.center') },
                    { value: 'bottom-left', label: t('branding.bottomLeft') },
                    { value: 'bottom-right', label: t('branding.bottomRight') }
                  ].map((position) => (
                    <button
                      key={position.value}
                      type="button"
                      onClick={() => handleBrandingChange('watermark_position', position.value)}
                      className={`px-3 py-2 text-sm rounded-lg border transition-colors ${
                        brandingSettings.watermark_position === position.value
                          ? 'bg-primary-600 text-white border-primary-600'
                          : 'bg-white text-neutral-700 border-neutral-300 hover:bg-neutral-50'
                      }`}
                    >
                      {position.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Opacity Slider */}
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  {t('branding.watermarkOpacity')}: {brandingSettings.watermark_opacity || 50}%
                </label>
                <input
                  type="range"
                  min="10"
                  max="100"
                  step="10"
                  value={brandingSettings.watermark_opacity || 50}
                  onChange={(e) => handleBrandingChange('watermark_opacity', parseInt(e.target.value))}
                  className="w-full slider"
                  style={{
                    WebkitAppearance: 'none',
                    appearance: 'none',
                    height: '8px',
                    background: '#d4d4d4',
                    borderRadius: '4px',
                    outline: 'none'
                  }}
                />
                <div className="flex justify-between text-xs text-neutral-500 mt-1">
                  <span>10%</span>
                  <span>50%</span>
                  <span>100%</span>
                </div>
              </div>

              {/* Size Slider */}
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  {t('branding.watermarkSize')}: {brandingSettings.watermark_size || 15}%
                </label>
                <input
                  type="range"
                  min="5"
                  max="30"
                  step="5"
                  value={brandingSettings.watermark_size || 15}
                  onChange={(e) => handleBrandingChange('watermark_size', parseInt(e.target.value))}
                  className="w-full slider"
                  style={{
                    WebkitAppearance: 'none',
                    appearance: 'none',
                    height: '8px',
                    background: '#d4d4d4',
                    borderRadius: '4px',
                    outline: 'none'
                  }}
                />
                <div className="flex justify-between text-xs text-neutral-500 mt-1">
                  <span>5%</span>
                  <span>15%</span>
                  <span>30%</span>
                </div>
              </div>
            </div>
          )}
        </Card>

        {/* Theme Customization */}
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-neutral-900 mb-4 flex items-center gap-2">
            <Palette className="w-5 h-5" />
            {t('branding.galleryTheme')}
          </h2>
          <div className="mb-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isPreviewMode}
                onChange={(e) => setIsPreviewMode(e.target.checked)}
                className="rounded border-neutral-300 text-primary-600 focus:ring-primary-500"
              />
              <span className="text-sm text-neutral-700">{t('branding.applyLivePreview')}</span>
            </label>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left side - Theme Customizer */}
            <div>
              <ThemeCustomizerEnhanced
                value={currentTheme}
                onChange={handleThemeChange}
                presetName={currentThemeName}
                onPresetChange={handlePresetChange}
                isPreviewMode={isPreviewMode}
                showGalleryLayouts={true}
                hideActions={true}
              />
            </div>
            
            {/* Right side - Gallery Preview */}
            <div className="lg:sticky lg:top-4 lg:h-fit">
              <Card className="p-4">
                <h3 className="text-sm font-medium text-neutral-700 mb-3">
                  {t('branding.livePreview')}
                </h3>
                <GalleryPreview 
                  theme={currentTheme}
                  branding={brandingSettings}
                  className="shadow-lg" 
                />
              </Card>
            </div>
          </div>
        </div>

        {/* Event-Specific Themes Info */}
        <Card padding="md" className="bg-blue-50 border-blue-200">
          <div className="flex items-start gap-3">
            <Palette className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-medium text-blue-900">{t('branding.eventSpecificThemes')}</h3>
              <p className="text-sm text-blue-700 mt-1">
                {t('branding.eventThemesInfo')}
              </p>
            </div>
          </div>
        </Card>
      </div>
    </ErrorBoundary>
  );
};
