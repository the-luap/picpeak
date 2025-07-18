import { api } from '../config/api';

export interface CMSPage {
  id: number;
  slug: string;
  title_en: string;
  title_de: string;
  content_en: string;
  content_de: string;
  updated_at: string;
}

export const cmsService = {
  // Get all CMS pages
  async getPages(): Promise<CMSPage[]> {
    const response = await api.get<CMSPage[]>('/admin/cms/pages');
    return response.data;
  },

  // Get a single CMS page
  async getPage(slug: string): Promise<CMSPage> {
    const response = await api.get<CMSPage>(`/admin/cms/pages/${slug}`);
    return response.data;
  },

  // Update a CMS page
  async updatePage(slug: string, data: Partial<CMSPage>): Promise<CMSPage> {
    const response = await api.put<CMSPage>(`/admin/cms/pages/${slug}`, data);
    return response.data;
  },

  // Get public CMS page (no auth required)
  async getPublicPage(slug: string, lang: string = 'en'): Promise<{ title: string; content: string }> {
    const response = await api.get<{ title: string; content: string }>(`/public/pages/${slug}`, {
      params: { lang }
    });
    return response.data;
  }
};