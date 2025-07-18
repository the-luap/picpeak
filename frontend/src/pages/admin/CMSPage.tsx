import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import { Save, FileText, Globe } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Button, Card, Input, Loading } from '../../components/common';
import { CMSEditor } from '../../components/admin/CMSEditor';
import { cmsService } from '../../services/cms.service';
import type { CMSPage as CMSPageType } from '../../services/cms.service';

export const CMSPage: React.FC = () => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [selectedPage, setSelectedPage] = useState<string>('impressum');
  const [editingLang, setEditingLang] = useState<'en' | 'de'>('en');
  const [editForm, setEditForm] = useState<Partial<CMSPageType>>({});

  // Fetch CMS pages
  const { data: pages, isLoading } = useQuery({
    queryKey: ['cms-pages'],
    queryFn: cmsService.getPages,
  });

  // Update page mutation
  const updateMutation = useMutation({
    mutationFn: ({ slug, data }: { slug: string; data: Partial<CMSPageType> }) =>
      cmsService.updatePage(slug, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cms-pages'] });
      toast.success(t('cms.pageUpdated'));
    },
    onError: () => {
      toast.error(t('toast.saveError'));
    },
  });

  // Load page data when selection changes
  React.useEffect(() => {
    if (pages) {
      const page = pages.find(p => p.slug === selectedPage);
      if (page) {
        setEditForm(page);
      }
    }
  }, [pages, selectedPage]);

  const handleSave = () => {
    updateMutation.mutate({
      slug: selectedPage,
      data: editForm,
    });
  };

  const handleContentChange = (content: string) => {
    const field = editingLang === 'de' ? 'content_de' : 'content_en';
    setEditForm(prev => ({ ...prev, [field]: content }));
  };

  const handleTitleChange = (title: string) => {
    const field = editingLang === 'de' ? 'title_de' : 'title_en';
    setEditForm(prev => ({ ...prev, [field]: title }));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loading size="lg" text={t('cms.loadingPages')} />
      </div>
    );
  }

  const currentPage = pages?.find(p => p.slug === selectedPage);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-neutral-900">{t('cms.title')}</h1>
        <p className="text-neutral-600 mt-1">{t('cms.subtitle')}</p>
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
                  onClick={() => setSelectedPage(page.slug)}
                  className={`w-full text-left px-4 py-3 rounded-lg transition-colors flex items-center gap-3 ${
                    selectedPage === page.slug
                      ? 'bg-primary-100 text-primary-700 border border-primary-300'
                      : 'bg-white border border-neutral-200 hover:bg-neutral-50'
                  }`}
                >
                  <FileText className="w-5 h-5" />
                  <div>
                    <p className="font-medium">{t(`legal.${page.slug}`)}</p>
                    <p className="text-sm text-neutral-500">/{page.slug}</p>
                  </div>
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
                  🇬🇧 English
                </button>
                <button
                  onClick={() => setEditingLang('de')}
                  className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                    editingLang === 'de'
                      ? 'bg-primary-100 text-primary-700'
                      : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
                  }`}
                >
                  🇩🇪 Deutsch
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