import React, { useState, useEffect } from 'react';
import { Palette, RotateCcw, Check, Layout, Type, Sparkles, Grid3X3, Layers, Play, Clock, Image, LayoutGrid } from 'lucide-react';
import { Button, Card, Input } from '../common';
import { ThemeConfig, GALLERY_THEME_PRESETS, GalleryLayoutType } from '../../types/theme.types';
// import { settingsService } from '../../services/settings.service';
// import { toast } from 'react-toastify';
import { useTranslation } from 'react-i18next';

interface ThemeCustomizerEnhancedProps {
  value: ThemeConfig;
  onChange: (theme: ThemeConfig) => void;
  presetName?: string;
  onPresetChange?: (presetName: string) => void;
  isPreviewMode?: boolean;
  showGalleryLayouts?: boolean;
  hideActions?: boolean;
}

const layoutIcons: Record<GalleryLayoutType, React.ReactNode> = {
  grid: <Grid3X3 className="w-5 h-5" />,
  masonry: <Layers className="w-5 h-5" />,
  carousel: <Play className="w-5 h-5" />,
  timeline: <Clock className="w-5 h-5" />,
  hero: <Image className="w-5 h-5" />,
  mosaic: <LayoutGrid className="w-5 h-5" />
};

// Layout descriptions will use translation keys

export const ThemeCustomizerEnhanced: React.FC<ThemeCustomizerEnhancedProps> = ({
  value,
  onChange,
  presetName = 'default',
  onPresetChange,
  isPreviewMode = false,
  showGalleryLayouts = true,
  hideActions = false
}) => {
  const { t } = useTranslation();
  const [localTheme, setLocalTheme] = useState<ThemeConfig>(value);
  const [selectedPreset, setSelectedPreset] = useState(presetName);
  const [customCss, setCustomCss] = useState(value.customCss || '');
  // const logoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setLocalTheme(value);
    setCustomCss(value.customCss || '');
  }, [value]);

  useEffect(() => {
    setSelectedPreset(presetName);
  }, [presetName]);

  const handleChange = (key: keyof ThemeConfig, newValue: any) => {
    const updated = { ...localTheme, [key]: newValue };
    setLocalTheme(updated);
    
    // When any change is made, mark it as custom
    if (selectedPreset !== 'custom' && onPresetChange) {
      setSelectedPreset('custom');
      onPresetChange('custom');
    }
    
    if (isPreviewMode) {
      onChange(updated);
    }
  };

  const handlePresetSelect = (presetKey: string) => {
    const preset = GALLERY_THEME_PRESETS[presetKey];
    if (preset) {
      setSelectedPreset(presetKey);
      setLocalTheme(preset.config);
      if (onPresetChange) {
        onPresetChange(presetKey);
      }
      if (isPreviewMode) {
        onChange(preset.config);
      }
    }
  };

  const handleApply = () => {
    onChange({ ...localTheme, customCss });
  };

  const handleReset = () => {
    const defaultPreset = GALLERY_THEME_PRESETS['default'];
    if (defaultPreset) {
      setSelectedPreset('default');
      setLocalTheme(defaultPreset.config);
      setCustomCss('');
      onChange(defaultPreset.config);
      if (onPresetChange) {
        onPresetChange('default');
      }
    }
  };

  // const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
  //   const file = e.target.files?.[0];
  //   if (file) {
  //     try {
  //       const logoUrl = await settingsService.uploadLogo(file);
  //       handleChange('logoUrl', logoUrl);
  //       toast.success('Logo uploaded successfully');
  //     } catch (error) {
  //       console.error('Failed to upload logo:', error);
  //       toast.error('Failed to upload logo');
  //     }
  //   }
  // };

  const updateGallerySettings = (key: string, value: any) => {
    const updatedSettings = {
      ...localTheme.gallerySettings,
      [key]: value
    };
    handleChange('gallerySettings', updatedSettings);
  };

  return (
    <div className="space-y-6">
      {/* Preset Themes */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold text-neutral-900 mb-4 flex items-center gap-2">
          <Sparkles className="w-5 h-5" />
          {t('branding.themePresets')}
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Object.entries(GALLERY_THEME_PRESETS).map(([key, theme]) => (
            <button
              key={key}
              onClick={() => handlePresetSelect(key)}
              className={`relative p-4 rounded-lg border-2 transition-all text-left ${
                selectedPreset === key
                  ? 'border-primary-600 bg-primary-50'
                  : 'border-neutral-200 hover:border-neutral-300'
              }`}
            >
              <div className="flex items-start justify-between mb-2">
                <div>
                  <span className="font-medium text-sm block">{theme.name}</span>
                  {theme.description && (
                    <span className="text-xs text-neutral-600 mt-1 block">{theme.description}</span>
                  )}
                </div>
                {selectedPreset === key && (
                  <Check className="w-4 h-4 text-primary-600 flex-shrink-0" />
                )}
              </div>
              <div className="flex items-center gap-2 mt-3">
                <div className="flex gap-1">
                  <div
                    className="w-5 h-5 rounded-full border border-neutral-200"
                    style={{ backgroundColor: theme.config.primaryColor }}
                  />
                  <div
                    className="w-5 h-5 rounded-full border border-neutral-200"
                    style={{ backgroundColor: theme.config.accentColor }}
                  />
                  <div
                    className="w-5 h-5 rounded-full border border-neutral-200"
                    style={{ backgroundColor: theme.config.backgroundColor }}
                  />
                </div>
                {theme.config.galleryLayout && layoutIcons[theme.config.galleryLayout] && (
                  <div className="ml-auto text-neutral-400">
                    {layoutIcons[theme.config.galleryLayout]}
                  </div>
                )}
              </div>
            </button>
          ))}
        </div>
      </Card>

      {/* Gallery Layout */}
      {showGalleryLayouts && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-neutral-900 mb-4 flex items-center gap-2">
            <Layout className="w-5 h-5" />
            {t('branding.galleryLayout')}
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {(Object.keys(layoutIcons) as GalleryLayoutType[]).map((layout) => (
              <button
                key={layout}
                onClick={() => handleChange('galleryLayout', layout)}
                className={`relative p-4 rounded-lg border-2 transition-all ${
                  localTheme.galleryLayout === layout
                    ? 'border-primary-600 bg-primary-50'
                    : 'border-neutral-200 hover:border-neutral-300'
                }`}
              >
                <div className="flex flex-col items-center text-center">
                  <div className="mb-2 text-neutral-700">
                    {layoutIcons[layout]}
                  </div>
                  <span className="font-medium text-sm capitalize">{layout}</span>
                  <span className="text-xs text-neutral-600 mt-1">
                    {t(`branding.layoutDescriptions.${layout}`)}
                  </span>
                </div>
                {localTheme.galleryLayout === layout && (
                  <Check className="absolute top-2 right-2 w-4 h-4 text-primary-600" />
                )}
              </button>
            ))}
          </div>

          {/* Layout-specific settings */}
          {localTheme.galleryLayout && (
            <div className="mt-6 space-y-4 pt-6 border-t border-neutral-200">
              <h4 className="font-medium text-sm text-neutral-700">{t('branding.layoutSettings')}</h4>
              
              {/* Common settings */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-2">
                    {t('branding.photoSpacing')}
                  </label>
                  <select
                    value={localTheme.gallerySettings?.spacing || 'normal'}
                    onChange={(e) => updateGallerySettings('spacing', e.target.value)}
                    className="w-full px-3 py-2 border border-neutral-300 rounded-lg"
                  >
                    <option value="tight">{t('branding.spacing.tight')}</option>
                    <option value="normal">{t('branding.spacing.normal')}</option>
                    <option value="relaxed">{t('branding.spacing.relaxed')}</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-2">
                    {t('branding.photoAnimation')}
                  </label>
                  <select
                    value={localTheme.gallerySettings?.photoAnimation || 'fade'}
                    onChange={(e) => updateGallerySettings('photoAnimation', e.target.value)}
                    className="w-full px-3 py-2 border border-neutral-300 rounded-lg"
                  >
                    <option value="none">{t('branding.animation.none')}</option>
                    <option value="fade">{t('branding.animation.fade')}</option>
                    <option value="scale">{t('branding.animation.scale')}</option>
                    <option value="slide">{t('branding.animation.slide')}</option>
                  </select>
                </div>
              </div>

              {/* Grid specific */}
              {localTheme.galleryLayout === 'grid' && (
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-2">
                    {t('branding.columns')}
                  </label>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="text-xs text-neutral-600">{t('branding.mobile')}</label>
                      <Input
                        type="number"
                        min="1"
                        max="4"
                        value={localTheme.gallerySettings?.gridColumns?.mobile || 2}
                        onChange={(e) => updateGallerySettings('gridColumns', {
                          ...localTheme.gallerySettings?.gridColumns,
                          mobile: parseInt(e.target.value)
                        })}
                      />
                    </div>
                    <div>
                      <label className="text-xs text-neutral-600">{t('branding.tablet')}</label>
                      <Input
                        type="number"
                        min="2"
                        max="6"
                        value={localTheme.gallerySettings?.gridColumns?.tablet || 3}
                        onChange={(e) => updateGallerySettings('gridColumns', {
                          ...localTheme.gallerySettings?.gridColumns,
                          tablet: parseInt(e.target.value)
                        })}
                      />
                    </div>
                    <div>
                      <label className="text-xs text-neutral-600">{t('branding.desktop')}</label>
                      <Input
                        type="number"
                        min="3"
                        max="8"
                        value={localTheme.gallerySettings?.gridColumns?.desktop || 4}
                        onChange={(e) => updateGallerySettings('gridColumns', {
                          ...localTheme.gallerySettings?.gridColumns,
                          desktop: parseInt(e.target.value)
                        })}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Carousel specific */}
              {localTheme.galleryLayout === 'carousel' && (
                <>
                  <div>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={localTheme.gallerySettings?.carouselAutoplay || false}
                        onChange={(e) => updateGallerySettings('carouselAutoplay', e.target.checked)}
                        className="rounded"
                      />
                      <span className="text-sm font-medium text-neutral-700">{t('branding.enableAutoplay')}</span>
                    </label>
                  </div>
                  {localTheme.gallerySettings?.carouselAutoplay && (
                    <div>
                      <label className="block text-sm font-medium text-neutral-700 mb-2">
                        {t('branding.autoplayInterval')}
                      </label>
                      <Input
                        type="number"
                        min="2"
                        max="10"
                        value={(localTheme.gallerySettings?.carouselInterval || 5000) / 1000}
                        onChange={(e) => updateGallerySettings('carouselInterval', parseInt(e.target.value) * 1000)}
                      />
                    </div>
                  )}
                </>
              )}

              {/* Timeline specific */}
              {localTheme.galleryLayout === 'timeline' && (
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-2">
                    {t('branding.groupPhotosBy')}
                  </label>
                  <select
                    value={localTheme.gallerySettings?.timelineGrouping || 'day'}
                    onChange={(e) => updateGallerySettings('timelineGrouping', e.target.value)}
                    className="w-full px-3 py-2 border border-neutral-300 rounded-lg"
                  >
                    <option value="day">{t('branding.grouping.day')}</option>
                    <option value="week">{t('branding.grouping.week')}</option>
                    <option value="month">{t('branding.grouping.month')}</option>
                  </select>
                </div>
              )}
            </div>
          )}
        </Card>
      )}

      {/* Color Customization */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold text-neutral-900 mb-4 flex items-center gap-2">
          <Palette className="w-5 h-5" />
          {t('branding.colors')}
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-2">
              {t('branding.primaryColor')}
            </label>
            <div className="flex gap-2">
              <input
                type="color"
                value={localTheme.primaryColor || '#5C8762'}
                onChange={(e) => handleChange('primaryColor', e.target.value)}
                className="h-10 w-20 rounded border border-neutral-300 cursor-pointer"
              />
              <Input
                value={localTheme.primaryColor || '#5C8762'}
                onChange={(e) => handleChange('primaryColor', e.target.value)}
                placeholder="#5C8762"
                className="flex-1"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-2">
              {t('branding.accentColor')}
            </label>
            <div className="flex gap-2">
              <input
                type="color"
                value={localTheme.accentColor || '#22c55e'}
                onChange={(e) => handleChange('accentColor', e.target.value)}
                className="h-10 w-20 rounded border border-neutral-300 cursor-pointer"
              />
              <Input
                value={localTheme.accentColor || '#22c55e'}
                onChange={(e) => handleChange('accentColor', e.target.value)}
                placeholder="#22c55e"
                className="flex-1"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-2">
              {t('branding.backgroundColor')}
            </label>
            <div className="flex gap-2">
              <input
                type="color"
                value={localTheme.backgroundColor || '#fafafa'}
                onChange={(e) => handleChange('backgroundColor', e.target.value)}
                className="h-10 w-20 rounded border border-neutral-300 cursor-pointer"
              />
              <Input
                value={localTheme.backgroundColor || '#fafafa'}
                onChange={(e) => handleChange('backgroundColor', e.target.value)}
                placeholder="#fafafa"
                className="flex-1"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-2">
              {t('branding.textColor')}
            </label>
            <div className="flex gap-2">
              <input
                type="color"
                value={localTheme.textColor || '#171717'}
                onChange={(e) => handleChange('textColor', e.target.value)}
                className="h-10 w-20 rounded border border-neutral-300 cursor-pointer"
              />
              <Input
                value={localTheme.textColor || '#171717'}
                onChange={(e) => handleChange('textColor', e.target.value)}
                placeholder="#171717"
                className="flex-1"
              />
            </div>
          </div>
        </div>
      </Card>

      {/* Typography & Style */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold text-neutral-900 mb-4 flex items-center gap-2">
          <Type className="w-5 h-5" />
          {t('branding.typographyAndStyle')}
        </h3>
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                {t('branding.bodyFont')}
              </label>
              <select
                value={localTheme.fontFamily || 'Inter, sans-serif'}
                onChange={(e) => handleChange('fontFamily', e.target.value)}
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg"
              >
                <option value="Inter, sans-serif">Inter</option>
                <option value="system-ui, sans-serif">System UI</option>
                <option value="Georgia, serif">Georgia</option>
                <option value="'Playfair Display', serif">Playfair Display</option>
                <option value="'Montserrat', sans-serif">Montserrat</option>
                <option value="'IBM Plex Sans', sans-serif">IBM Plex Sans</option>
                <option value="'Comic Neue', cursive">Comic Neue</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                {t('branding.headingFont')}
              </label>
              <select
                value={localTheme.headingFontFamily || localTheme.fontFamily || 'Inter, sans-serif'}
                onChange={(e) => handleChange('headingFontFamily', e.target.value)}
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg"
              >
                <option value="">{t('branding.sameAsBody')}</option>
                <option value="'Playfair Display', serif">Playfair Display</option>
                <option value="'Montserrat', sans-serif">Montserrat</option>
                <option value="Georgia, serif">Georgia</option>
                <option value="'IBM Plex Sans', sans-serif">IBM Plex Sans</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                {t('branding.fontSize')}
              </label>
              <select
                value={localTheme.fontSize || 'normal'}
                onChange={(e) => handleChange('fontSize', e.target.value)}
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg"
              >
                <option value="small">{t('branding.fontSizes.small')}</option>
                <option value="normal">{t('branding.fontSizes.normal')}</option>
                <option value="large">{t('branding.fontSizes.large')}</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                {t('branding.borderRadius')}
              </label>
              <select
                value={localTheme.borderRadius || 'md'}
                onChange={(e) => handleChange('borderRadius', e.target.value)}
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg"
              >
                <option value="none">{t('branding.borderRadiusOptions.none')}</option>
                <option value="sm">{t('branding.borderRadiusOptions.small')}</option>
                <option value="md">{t('branding.borderRadiusOptions.medium')}</option>
                <option value="lg">{t('branding.borderRadiusOptions.large')}</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                {t('branding.shadowStyle')}
              </label>
              <select
                value={localTheme.shadowStyle || 'normal'}
                onChange={(e) => handleChange('shadowStyle', e.target.value)}
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg"
              >
                <option value="none">{t('branding.shadowOptions.none')}</option>
                <option value="subtle">{t('branding.shadowOptions.subtle')}</option>
                <option value="normal">{t('branding.shadowOptions.normal')}</option>
                <option value="dramatic">{t('branding.shadowOptions.dramatic')}</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                {t('branding.backgroundPattern')}
              </label>
              <select
                value={localTheme.backgroundPattern || 'none'}
                onChange={(e) => handleChange('backgroundPattern', e.target.value)}
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg"
              >
                <option value="none">{t('branding.backgroundOptions.none')}</option>
                <option value="dots">{t('branding.backgroundOptions.dots')}</option>
                <option value="grid">{t('branding.backgroundOptions.grid')}</option>
                <option value="waves">{t('branding.backgroundOptions.waves')}</option>
              </select>
            </div>
          </div>
        </div>
      </Card>

      {/* Custom CSS */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold text-neutral-900 mb-4">{t('branding.customCSS')}</h3>
        <textarea
          value={customCss}
          onChange={(e) => {
            setCustomCss(e.target.value);
            // Mark as custom when CSS is added
            if (e.target.value && selectedPreset !== 'custom' && onPresetChange) {
              setSelectedPreset('custom');
              onPresetChange('custom');
            }
          }}
          placeholder="/* Add custom CSS here */"
          className="w-full h-32 px-3 py-2 font-mono text-sm border border-neutral-300 rounded-lg"
        />
        <p className="mt-2 text-sm text-neutral-600">
          {t('branding.customCSSHelp')}
        </p>
      </Card>

      {/* Actions */}
      {!hideActions && (
        <div className="flex items-center justify-end gap-3">
          <Button
            variant="outline"
            leftIcon={<RotateCcw className="w-4 h-4" />}
            onClick={handleReset}
          >
            {t('branding.resetToDefault')}
          </Button>
          <Button
            variant="primary"
            leftIcon={<Palette className="w-4 h-4" />}
            onClick={handleApply}
          >
            {t('branding.applyTheme')}
          </Button>
        </div>
      )}
    </div>
  );
};