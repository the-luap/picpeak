import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import { FileText, Globe, Clock, Sparkles, ShieldCheck } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { debounce } from 'lodash';
import DOMPurify from 'dompurify';

import { Button, Card, Input, Loading } from '../../components/common';
import { CMSEditor } from '../../components/admin/CMSEditor';
import { cmsService } from '../../services/cms.service';
import type { CMSPage as CMSPageType } from '../../services/cms.service';
import { settingsService, PublicSiteBranding } from '../../services/settings.service';

export const CMSPageEnhanced: React.FC = () => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [selectedPage, setSelectedPage] = useState<string>('impressum');
  const [editingLang, setEditingLang] = useState<'en' | 'de'>('en');
  const [editForm, setEditForm] = useState<Partial<CMSPageType>>({});
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [isAutoSaving, setIsAutoSaving] = useState(false);
  const [publicSiteEnabled, setPublicSiteEnabled] = useState(false);
  const [publicSiteHtml, setPublicSiteHtml] = useState('');
  const [publicSiteCss, setPublicSiteCss] = useState('');
  const [publicSiteBaseCss, setPublicSiteBaseCss] = useState('');
  const [publicSiteBranding, setPublicSiteBranding] = useState<PublicSiteBranding | undefined>(undefined);

  // Fetch CMS pages
  const { data: pages, isLoading } = useQuery({
    queryKey: ['cms-pages'],
    queryFn: cmsService.getPages,
  });

  const { data: adminSettings, isLoading: isLoadingAdminSettings } = useQuery({
    queryKey: ['admin-settings'],
    queryFn: () => settingsService.getAllSettings(),
  });

  const { data: publicSiteDefaults, isLoading: isLoadingPublicDefaults } = useQuery({
    queryKey: ['public-site-defaults'],
    queryFn: () => settingsService.getPublicSiteDefaults(),
  });

  // Update page mutation
  const updateMutation = useMutation({
    mutationFn: ({ slug, data }: { slug: string; data: Partial<CMSPageType> }) =>
      cmsService.updatePage(slug, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cms-pages'] });
      setHasUnsavedChanges(false);
      setLastSaved(new Date());
      setIsAutoSaving(false);
      if (!isAutoSaving) {
        toast.success(t('cms.pageUpdated'));
      }
    },
    onError: () => {
      setIsAutoSaving(false);
      toast.error(t('toast.saveError'));
    },
  });

  const publicSiteSaveMutation = useMutation({
    mutationFn: async () => {
      const trimmedHtml = publicSiteHtml.trim();
      if (publicSiteEnabled && !trimmedHtml) {
        throw new Error('PUBLIC_SITE_HTML_REQUIRED');
      }

      await settingsService.updatePublicSite({
        enabled: publicSiteEnabled,
        html: trimmedHtml || '',
        css: publicSiteCss,
      });
    },
    onSuccess: async () => {
      toast.success(t('settings.publicSite.saveSuccess'));
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin-settings'] }),
        queryClient.invalidateQueries({ queryKey: ['public-site-defaults'] }),
      ]);
    },
    onError: (error: any) => {
      if (error?.message === 'PUBLIC_SITE_HTML_REQUIRED') {
        toast.error(t('settings.publicSite.htmlRequired'));
        return;
      }
      toast.error(t('settings.publicSite.saveError'));
    },
  });

  const publicSiteResetMutation = useMutation({
    mutationFn: () => settingsService.resetPublicSite(),
    onSuccess: async (data) => {
      toast.success(t('settings.publicSite.resetSuccess'));
      setPublicSiteHtml(data.html || '');
      setPublicSiteCss(data.css || '');
      setPublicSiteBaseCss(data.baseCss || '');
      setPublicSiteBranding(data.branding ?? publicSiteDefaults?.branding);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin-settings'] }),
        queryClient.invalidateQueries({ queryKey: ['public-site-defaults'] }),
      ]);
    },
    onError: () => {
      toast.error(t('settings.publicSite.resetError'));
    },
  });

  // Auto-save functionality
  const autoSave = useCallback(
    debounce(() => {
      if (hasUnsavedChanges && !updateMutation.isPending) {
        setIsAutoSaving(true);
        updateMutation.mutate({
          slug: selectedPage,
          data: editForm,
        });
      }
    }, 3000),
    [hasUnsavedChanges, editForm, selectedPage]
  );

  useEffect(() => {
    if (publicSiteDefaults) {
      setPublicSiteBaseCss(publicSiteDefaults.baseCss || '');
      setPublicSiteBranding(publicSiteDefaults.branding);
    }
  }, [publicSiteDefaults]);

  useEffect(() => {
    if (!adminSettings) {
      return;
    }

    setPublicSiteEnabled(Boolean(adminSettings.general_public_site_enabled));
    setPublicSiteHtml((adminSettings.general_public_site_html as string) || '');
    setPublicSiteCss((adminSettings.general_public_site_custom_css as string) || '');
  }, [adminSettings]);

  // Trigger auto-save when content changes
  useEffect(() => {
    if (hasUnsavedChanges) {
      autoSave();
    }
    return () => {
      autoSave.cancel();
    };
  }, [hasUnsavedChanges, autoSave]);

  // Load page data when selection changes
  React.useEffect(() => {
    if (pages) {
      const page = pages.find(p => p.slug === selectedPage);
      if (page) {
        setEditForm(page);
        setHasUnsavedChanges(false);
      }
    }
  }, [pages, selectedPage]);

  const handleSave = () => {
    autoSave.cancel(); // Cancel any pending auto-save
    updateMutation.mutate({
      slug: selectedPage,
      data: editForm,
    });
  };

  const handleContentChange = (content: string) => {
    const field = editingLang === 'de' ? 'content_de' : 'content_en';
    setEditForm(prev => ({ ...prev, [field]: content }));
    setHasUnsavedChanges(true);
  };

  const handleTitleChange = (title: string) => {
    const field = editingLang === 'de' ? 'title_de' : 'title_en';
    setEditForm(prev => ({ ...prev, [field]: title }));
    setHasUnsavedChanges(true);
  };

  // Warn before leaving with unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  const currentPage = pages?.find(p => p.slug === selectedPage);
  const publicSiteSanitizedHtml = useMemo(() => DOMPurify.sanitize(publicSiteHtml || '', {
    ALLOWED_TAGS: [
      'a', 'article', 'aside', 'blockquote', 'br', 'button', 'caption', 'div', 'em',
      'figure', 'figcaption', 'footer', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'header',
      'hr', 'img', 'li', 'main', 'nav', 'ol', 'p', 'section', 'span', 'strong', 'sup',
      'sub', 'table', 'tbody', 'td', 'tfoot', 'th', 'thead', 'tr', 'ul'
    ],
    ALLOWED_ATTR: ['class', 'id', 'role', 'aria-label', 'aria-hidden', 'href', 'target', 'rel', 'src', 'alt', 'title', 'loading', 'decoding', 'width', 'height'],
    ALLOW_UNKNOWN_PROTOCOLS: false,
    ADD_ATTR: ['data-*'],
  }), [publicSiteHtml]);

  const sanitizeCss = (css: string) => {
    if (!css) {
      return '';
    }

    let sanitized = css;
    const disallowedPatterns = [
      /@import[^;]+;?/gi,
      /@charset[^;]+;?/gi,
      /expression\s*\([^)]*\)/gi,
      /url\s*\(\s*(['"])\s*javascript:[^)]*\)/gi,
      /url\s*\(\s*(['"])\s*data:text\/javascript[^)]*\)/gi
    ];

    disallowedPatterns.forEach((pattern) => {
      sanitized = sanitized.replace(pattern, '');
    });

    sanitized = sanitized.replace(/[\u0000-\u001F\u007F]/g, '');

    const MAX_LENGTH = 100 * 1024;
    if (sanitized.length > MAX_LENGTH) {
      sanitized = sanitized.slice(0, MAX_LENGTH);
    }

    return sanitized.trim();
  };

  const publicSiteSanitizedCss = useMemo(() => sanitizeCss(publicSiteCss || ''), [publicSiteCss]);

  const applyBrandTokens = (html: string, branding: PublicSiteBranding | undefined) => {
    if (!html || !branding) {
      return html;
    }

    const tokens: Record<string, string> = {
      company_name: branding.companyName || '',
      company_tagline: branding.companyTagline || '',
      support_email: branding.supportEmail || '',
    };

    return html.replace(/\{\{\s*(company_name|company_tagline|support_email)\s*\}\}/gi, (_, key: string) => tokens[key] || '');
  };

  const publicSitePreview = useMemo(() => {
    const branding = publicSiteBranding || publicSiteDefaults?.branding;
    const substitutedHtml = applyBrandTokens(publicSiteSanitizedHtml, branding);
    const inlineStyles = [
      branding ? `:root {\n  --brand-primary: ${branding.colors.primary};\n  --brand-accent: ${branding.colors.accent};\n  --brand-background: ${branding.colors.background};\n  --brand-text: ${branding.colors.text};\n}` : '',
      publicSiteBaseCss,
      publicSiteSanitizedCss ? `/* Custom styles */\n${publicSiteSanitizedCss}` : ''
    ].filter(Boolean).join('\n\n');

    const logo = branding?.logoUrl ? `<img src="${branding.logoUrl}" alt="${branding.companyName || 'Brand logo'}" class="brand-logo" loading="lazy" decoding="async" />` : '';
    const tagline = branding?.companyTagline ? `<p class="brand-tagline">${branding.companyTagline}</p>` : '';
    const support = branding?.supportEmail ? `<a href="mailto:${branding.supportEmail}">${branding.supportEmail}</a>` : '';
    const footerNote = branding?.footerText ? `<p>${branding.footerText}</p>` : '';

    const displayName = branding?.companyName || 'Celebration Stories';

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>${inlineStyles}</style>
</head>
<body>
  <div class="site-shell">
    <header class="site-header">
      <div class="header-inner">
        <div class="brand">
          ${logo}
          <div class="brand-copy">
            <p class="brand-label">${displayName}</p>
            ${tagline}
          </div>
        </div>
        <nav class="site-nav">
          <a href="#collections">Collections</a>
          <a href="#features">Features</a>
          <a href="#stories">Stories</a>
          <a href="#contact">Contact</a>
        </nav>
      </div>
    </header>
    <main class="site-main">
      ${substitutedHtml}
    </main>
    <footer class="site-footer" id="contact">
      <div class="footer-inner">
        <div>
          <h2>${displayName}</h2>
          ${footerNote}
        </div>
        <div class="footer-contact">
          <span>${support}</span>
        </div>
      </div>
    </footer>
  </div>
</body>
</html>`;
  }, [publicSiteBranding, publicSiteDefaults, publicSiteSanitizedHtml, publicSiteBaseCss, publicSiteSanitizedCss]);

  const publicSiteLoading = isLoadingAdminSettings || isLoadingPublicDefaults;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loading size="lg" text={t('cms.loadingPages')} />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-neutral-900">{t('cms.title')}</h1>
        <p className="text-neutral-600 mt-1">{t('cms.subtitle')}</p>
      </div>

      <div className="mb-8">
        <Card className="space-y-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-primary-600 mb-1">
                <Globe className="w-5 h-5" />
                <span className="text-sm font-semibold uppercase tracking-wide">{t('settings.publicSite.badge')}</span>
              </div>
              <h2 className="text-2xl font-semibold text-neutral-900">{t('settings.publicSite.title')}</h2>
              <p className="text-neutral-600 mt-1 max-w-2xl">{t('settings.publicSite.subtitle')}</p>
            </div>
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                className="sr-only"
                checked={publicSiteEnabled}
                onChange={() => setPublicSiteEnabled((prev) => !prev)}
              />
              <span
                aria-hidden="true"
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  publicSiteEnabled ? 'bg-primary-600' : 'bg-neutral-300'
                }`}
              >
                <span
                  className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${
                    publicSiteEnabled ? 'translate-x-5' : 'translate-x-1'
                  }`}
                />
              </span>
              <span className="text-sm font-medium text-neutral-700">
                {publicSiteEnabled ? t('settings.publicSite.enabled') : t('settings.publicSite.disabled')}
              </span>
            </label>
          </div>

          {publicSiteLoading ? (
            <div className="flex items-center justify-center min-h-[240px]">
              <Loading size="lg" text={t('settings.publicSite.loading')} />
            </div>
          ) : (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <label className="flex items-center gap-2 text-sm font-medium text-neutral-800 mb-2">
                    <Sparkles className="w-4 h-4 text-primary-500" />
                    {t('settings.publicSite.htmlLabel')}
                  </label>
                  <textarea
                    className="w-full h-64 font-mono text-sm rounded-lg border border-neutral-300 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 disabled:bg-neutral-100 disabled:text-neutral-500"
                    value={publicSiteHtml}
                    onChange={(event) => setPublicSiteHtml(event.target.value)}
                    disabled={!publicSiteEnabled}
                    placeholder={t('settings.publicSite.htmlPlaceholder') || ''}
                  />
                  <p className="text-xs text-neutral-500 mt-1">
                    {t('settings.publicSite.htmlHelp')}
                  </p>
                </div>

                <div>
                  <label className="flex items-center gap-2 text-sm font-medium text-neutral-800 mb-2">
                    <ShieldCheck className="w-4 h-4 text-primary-500" />
                    {t('settings.publicSite.cssLabel')}
                  </label>
                  <textarea
                    className="w-full h-48 font-mono text-sm rounded-lg border border-neutral-300 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 disabled:bg-neutral-100 disabled:text-neutral-500"
                    value={publicSiteCss}
                    onChange={(event) => setPublicSiteCss(event.target.value)}
                    disabled={!publicSiteEnabled}
                    placeholder={t('settings.publicSite.cssPlaceholder') || ''}
                  />
                  <p className="text-xs text-neutral-500 mt-1">
                    {t('settings.publicSite.cssHelp')}
                  </p>
                </div>

                <div className="flex flex-wrap gap-3">
                  <Button
                    variant="primary"
                    onClick={() => publicSiteSaveMutation.mutate()}
                    disabled={publicSiteSaveMutation.isPending}
                    isLoading={publicSiteSaveMutation.isPending}
                  >
                    {publicSiteSaveMutation.isPending ? t('settings.publicSite.saving') : t('settings.publicSite.saveCta')}
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => publicSiteResetMutation.mutate()}
                    disabled={publicSiteResetMutation.isPending}
                    isLoading={publicSiteResetMutation.isPending}
                  >
                    {publicSiteResetMutation.isPending ? t('settings.publicSite.resetting') : t('settings.publicSite.resetCta')}
                  </Button>
                </div>

                <div className="rounded-lg bg-neutral-50 border border-neutral-200 p-3 text-xs text-neutral-600 leading-relaxed">
                  <p className="font-semibold mb-1">{t('settings.publicSite.sanitizationNotice')}</p>
                  <p>{t('settings.publicSite.htmlHelp')}</p>
                </div>
              </div>

              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-neutral-800 uppercase tracking-wide">
                    {t('settings.publicSite.previewTitle')}
                  </h3>
                  <span className="text-xs text-neutral-500">{t('settings.publicSite.previewSandboxed')}</span>
                </div>
                {publicSiteEnabled ? (
                  <div className="rounded-xl border border-neutral-200 overflow-hidden shadow-sm bg-white">
                    <iframe
                      title="public-site-preview"
                      sandbox="allow-same-origin"
                      className="w-full h-[480px] bg-white"
                      srcDoc={publicSitePreview}
                    />
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-neutral-300 bg-neutral-50 p-8 text-center text-sm text-neutral-500">
                    {t('settings.publicSite.previewDisabled')}
                  </div>
                )}
              </div>
            </div>
          )}
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Page Selection */}
        <div className="lg:col-span-1">
          <Card padding="md">
            <h2 className="text-lg font-semibold text-neutral-900 mb-4">{t('cms.pages')}</h2>
            <div className="space-y-2">
              {pages?.map((page) => (
                <button
                  key={page.slug}
                  onClick={() => {
                    if (hasUnsavedChanges) {
                      if (confirm('You have unsaved changes. Do you want to save them?')) {
                        handleSave();
                      }
                    }
                    setSelectedPage(page.slug);
                  }}
                  className={`w-full text-left px-4 py-3 rounded-lg transition-colors flex items-center gap-3 ${
                    selectedPage === page.slug
                      ? 'bg-primary-100 text-primary-700 border border-primary-300'
                      : 'bg-white border border-neutral-200 hover:bg-neutral-50'
                  }`}
                >
                  <FileText className="w-5 h-5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{t(`legal.${page.slug}`)}</p>
                    <p className="text-sm text-neutral-500">/{page.slug}</p>
                  </div>
                  {selectedPage === page.slug && hasUnsavedChanges && (
                    <div className="w-2 h-2 bg-yellow-500 rounded-full flex-shrink-0" />
                  )}
                </button>
              ))}
            </div>
          </Card>

          <Card padding="md" className="mt-4">
            <h3 className="text-sm font-semibold text-neutral-900 mb-3">{t('cms.previewLinks')}</h3>
            <div className="space-y-2 text-sm">
              <a
                href={`${window.location.origin}/${selectedPage}?lang=en`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-primary-600 hover:text-primary-700"
              >
                <Globe className="w-4 h-4" />
                {t('cms.englishVersion')}
              </a>
              <a
                href={`${window.location.origin}/${selectedPage}?lang=de`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-primary-600 hover:text-primary-700"
              >
                <Globe className="w-4 h-4" />
                {t('cms.germanVersion')}
              </a>
            </div>
          </Card>

          {/* Auto-save status */}
          {(hasUnsavedChanges || lastSaved) && (
            <Card padding="md" className="mt-4">
              <div className="text-sm">
                {isAutoSaving && (
                  <div className="flex items-center gap-2 text-neutral-600">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                    Auto-saving...
                  </div>
                )}
                {!isAutoSaving && hasUnsavedChanges && (
                  <div className="flex items-center gap-2 text-yellow-600">
                    <div className="w-2 h-2 bg-yellow-500 rounded-full" />
                    Unsaved changes
                  </div>
                )}
                {!hasUnsavedChanges && lastSaved && (
                  <div className="flex items-center gap-2 text-green-600">
                    <Clock className="w-4 h-4" />
                    Saved {new Date(lastSaved).toLocaleTimeString()}
                  </div>
                )}
              </div>
            </Card>
          )}
        </div>

        {/* Editor */}
        <div className="lg:col-span-3">
          <Card padding="md">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-neutral-900">
                {t('cms.editPage', { page: t(`legal.${selectedPage}`) })}
              </h2>
              
              {/* Language Tabs */}
              <div className="flex gap-2">
                <button
                  onClick={() => setEditingLang('en')}
                  className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                    editingLang === 'en'
                      ? 'bg-primary-100 text-primary-700'
                      : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
                  }`}
                >
                  English
                </button>
                <button
                  onClick={() => setEditingLang('de')}
                  className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                    editingLang === 'de'
                      ? 'bg-primary-100 text-primary-700'
                      : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
                  }`}
                >
                  Deutsch
                </button>
              </div>
            </div>

            <div className="space-y-4">
              {/* Title */}
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">
                  {t('cms.pageTitle')} ({editingLang === 'en' ? 'English' : 'German'})
                </label>
                <Input
                  value={editingLang === 'en' ? editForm.title_en || '' : editForm.title_de || ''}
                  onChange={(e) => handleTitleChange(e.target.value)}
                  placeholder={t('cms.pageTitlePlaceholder')}
                />
              </div>

              {/* Content */}
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">
                  {t('cms.pageContent')} ({editingLang === 'en' ? 'English' : 'German'})
                </label>
                <CMSEditor
                  content={editingLang === 'en' ? editForm.content_en || '' : editForm.content_de || ''}
                  onChange={handleContentChange}
                  onSave={handleSave}
                  isSaving={updateMutation.isPending}
                />
              </div>
            </div>

            {currentPage?.updated_at && (
              <p className="text-xs text-neutral-500 mt-4">
                {t('cms.lastUpdated')} {new Date(currentPage.updated_at).toLocaleString()}
              </p>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
};
