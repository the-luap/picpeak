import React, { useState, useEffect } from 'react';
import { 
  BarChart3, 
  TrendingUp, 
  Users, 
  Eye,
  Download,
  Smartphone,
  Monitor,
  Activity,
  RefreshCw,
  Tablet
} from 'lucide-react';
import { format, parseISO } from 'date-fns';

import { Button, Card, Loading } from '../../components/common';
import { useQuery } from '@tanstack/react-query';
import { adminService } from '../../services/admin.service';
import { useTranslation } from 'react-i18next';
import { api } from '../../config/api';

// Map API response to component format
interface ComponentAnalyticsData {
  pageViews: {
    total: number;
    trend: number;
    chartData: Array<{ date: string; views: number }>;
  };
  uniqueVisitors: {
    total: number;
    trend: number;
    chartData: Array<{ date: string; visitors: number }>;
  };
  downloads: {
    total: number;
    trend: number;
    topGalleries: Array<{ name: string; downloads: number }>;
  };
  devices: {
    desktop: number;
    mobile: number;
    tablet: number;
  };
  topPages: Array<{
    path: string;
    views: number;
    uniqueVisitors: number;
  }>;
}

export const AnalyticsPage: React.FC = () => {
  const { t } = useTranslation();
  const [dateRange, setDateRange] = useState<'7d' | '30d' | '90d'>('7d');
  const [isEmbedMode, setIsEmbedMode] = useState(false);
  
  // Check if Umami is configured from settings or environment
  const [umamiConfig, setUmamiConfig] = useState<{ url?: string; shareUrl?: string; enabled?: boolean }>({});

  // Fetch analytics data from backend
  const { data: apiData, isLoading, refetch } = useQuery({
    queryKey: ['admin-analytics', dateRange],
    queryFn: async () => {
      const days = dateRange === '7d' ? 7 : dateRange === '30d' ? 30 : 90;
      return adminService.getAnalytics(days);
    },
    refetchInterval: 60000 // Refresh every minute
  });

  // Fetch dashboard stats for additional metrics
  const { data: dashboardStats } = useQuery({
    queryKey: ['admin-dashboard-stats'],
    queryFn: () => adminService.getDashboardStats(),
  });

  // Fetch Umami config from admin settings since we're in admin panel
  useEffect(() => {
    const fetchUmamiConfig = async () => {
      try {
        // Use admin API endpoint with auth token since we're in admin area
        const response = await api.get('/admin/settings');
        const settings = response.data;
        
        // Transform the settings array to object
        const settingsMap = settings.reduce((acc: any, setting: any) => {
          acc[setting.key] = setting.value;
          return acc;
        }, {});
        
        // Check if Umami is enabled in admin settings
        if (settingsMap.analytics_umami_enabled && settingsMap.analytics_umami_url && settingsMap.analytics_umami_website_id) {
          setUmamiConfig({
            url: settingsMap.analytics_umami_url,
            shareUrl: settingsMap.analytics_umami_share_url,
            enabled: true
          });
        } else {
          // Fall back to environment variables if they exist
          const envUrl = import.meta.env.VITE_UMAMI_URL;
          const envWebsiteId = import.meta.env.VITE_UMAMI_WEBSITE_ID;
          
          if (envUrl && envWebsiteId) {
            setUmamiConfig({
              url: envUrl,
              shareUrl: import.meta.env.VITE_UMAMI_SHARE_URL,
              enabled: true
            });
          } else {
            setUmamiConfig({ enabled: false });
          }
        }
      } catch (error) {
        console.error('Failed to fetch Umami config:', error);
        // Fall back to environment variables if they exist
        const envUrl = import.meta.env.VITE_UMAMI_URL;
        const envWebsiteId = import.meta.env.VITE_UMAMI_WEBSITE_ID;
        
        if (envUrl && envWebsiteId) {
          setUmamiConfig({
            url: envUrl,
            shareUrl: import.meta.env.VITE_UMAMI_SHARE_URL,
            enabled: true
          });
        } else {
          setUmamiConfig({ enabled: false });
        }
      }
    };

    fetchUmamiConfig();
  }, []);

  // Calculate trends and format data
  const analytics: ComponentAnalyticsData | undefined = React.useMemo(() => {
    if (!apiData) return undefined;

    // Calculate totals from chart data
    const totalViews = apiData.chartData.reduce((sum, day) => sum + day.views, 0);
    const totalVisitors = apiData.chartData.reduce((sum, day) => sum + day.uniqueVisitors, 0);
    const totalDownloads = apiData.chartData.reduce((sum, day) => sum + day.downloads, 0);

    // Calculate trends (comparing last half to first half)
    const halfPoint = Math.floor(apiData.chartData.length / 2);
    const firstHalfViews = apiData.chartData.slice(0, halfPoint).reduce((sum, day) => sum + day.views, 0);
    const secondHalfViews = apiData.chartData.slice(halfPoint).reduce((sum, day) => sum + day.views, 0);
    const viewsTrend = firstHalfViews > 0 ? ((secondHalfViews - firstHalfViews) / firstHalfViews) * 100 : 0;

    const firstHalfVisitors = apiData.chartData.slice(0, halfPoint).reduce((sum, day) => sum + day.uniqueVisitors, 0);
    const secondHalfVisitors = apiData.chartData.slice(halfPoint).reduce((sum, day) => sum + day.uniqueVisitors, 0);
    const visitorsTrend = firstHalfVisitors > 0 ? ((secondHalfVisitors - firstHalfVisitors) / firstHalfVisitors) * 100 : 0;

    const firstHalfDownloads = apiData.chartData.slice(0, halfPoint).reduce((sum, day) => sum + day.downloads, 0);
    const secondHalfDownloads = apiData.chartData.slice(halfPoint).reduce((sum, day) => sum + day.downloads, 0);
    const downloadsTrend = firstHalfDownloads > 0 ? ((secondHalfDownloads - firstHalfDownloads) / firstHalfDownloads) * 100 : 0;

    // Get actual download data for top galleries - sort by downloads
    const topGalleriesWithDownloads = apiData.topGalleries
      .filter(gallery => gallery.downloads > 0) // Only show galleries with downloads
      .sort((a, b) => (b.downloads || 0) - (a.downloads || 0)) // Sort by downloads
      .slice(0, 5) // Take top 5
      .map(gallery => ({
        name: gallery.event_name,
        downloads: gallery.downloads || 0
      }));

    return {
      pageViews: {
        total: totalViews,
        trend: Math.round(viewsTrend * 10) / 10,
        chartData: apiData.chartData.map(d => ({ date: d.date, views: d.views }))
      },
      uniqueVisitors: {
        total: totalVisitors,
        trend: Math.round(visitorsTrend * 10) / 10,
        chartData: apiData.chartData.map(d => ({ date: d.date, visitors: d.uniqueVisitors }))
      },
      downloads: {
        total: totalDownloads,
        trend: Math.round(downloadsTrend * 10) / 10,
        topGalleries: topGalleriesWithDownloads
      },
      devices: apiData.devices,
      topPages: apiData.topGalleries.map(gallery => ({
        path: `/gallery/${gallery.slug}`,
        views: gallery.views,
        uniqueVisitors: gallery.uniqueVisitors || gallery.views // Use actual unique visitors if available
      }))
    };
  }, [apiData]);

  const renderTrendBadge = (trend: number) => {
    const isPositive = trend > 0;
    return (
      <span className={`inline-flex items-center text-xs font-medium ${
        isPositive ? 'text-green-700' : 'text-red-700'
      }`}>
        <TrendingUp className={`w-3 h-3 mr-1 ${!isPositive ? 'rotate-180' : ''}`} />
        {Math.abs(trend)}%
      </span>
    );
  };

  const renderMiniChart = (data: Array<{ date: string; value: number }>, color: string) => {
    const max = Math.max(...data.map(d => d.value));
    const height = 40;
    
    return (
      <div className="flex items-end gap-1 h-10">
        {data.map((item, index) => (
          <div
            key={index}
            className={`flex-1 ${color} rounded-t opacity-70 hover:opacity-100 transition-opacity`}
            style={{ height: `${(item.value / max) * height}px` }}
            title={`${format(parseISO(item.date), 'MMM d')}: ${item.value}`}
          />
        ))}
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loading size="lg" text={t('analytics.loadingAnalytics')} />
      </div>
    );
  }

  // If Umami is configured and embed mode is enabled, show the Umami dashboard
  if (isEmbedMode && umamiConfig.shareUrl) {
    return (
      <div>
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold text-neutral-900">{t('analytics.title')}</h1>
            <p className="text-neutral-600 mt-1">{t('analytics.detailedSubtitle')}</p>
          </div>
          <Button
            variant="outline"
            onClick={() => setIsEmbedMode(false)}
            leftIcon={<BarChart3 className="w-4 h-4" />}
          >
            {t('analytics.showSummaryView')}
          </Button>
        </div>
        
        <Card padding="none" className="overflow-hidden" style={{ height: '800px' }}>
          <iframe
            src={umamiConfig.shareUrl}
            className="w-full h-full border-0"
            title="Umami Analytics Dashboard"
          />
        </Card>
      </div>
    );
  }

  return (
    <div>
      {/* Page Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">{t('analytics.title')}</h1>
          <p className="text-neutral-600 mt-1">{t('analytics.subtitle')}</p>
        </div>
        <div className="flex items-center gap-3">
          {umamiConfig.shareUrl && (
            <Button
              variant="outline"
              onClick={() => setIsEmbedMode(true)}
              leftIcon={<Activity className="w-4 h-4" />}
            >
              {t('analytics.fullDashboard')}
            </Button>
          )}
          <Button
            variant="outline"
            onClick={() => refetch()}
            leftIcon={<RefreshCw className="w-4 h-4" />}
          >
            {t('analytics.refresh')}
          </Button>
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value as any)}
            className="px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500"
          >
            <option value="7d">{t('analytics.last7Days')}</option>
            <option value="30d">{t('analytics.last30Days')}</option>
            <option value="90d">{t('analytics.last90Days')}</option>
          </select>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <Card padding="md">
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="text-sm text-neutral-600">{t('analytics.pageViews')}</p>
              <p className="text-3xl font-bold text-neutral-900">{analytics?.pageViews.total.toLocaleString()}</p>
              <div className="mt-1">
                {renderTrendBadge(analytics?.pageViews.trend || 0)}
              </div>
            </div>
            <Eye className="w-8 h-8 text-blue-600" />
          </div>
          {analytics?.pageViews.chartData && renderMiniChart(
            analytics.pageViews.chartData.map(d => ({ date: d.date, value: d.views })),
            'bg-blue-500'
          )}
        </Card>

        <Card padding="md">
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="text-sm text-neutral-600">{t('analytics.uniqueVisitors')}</p>
              <p className="text-3xl font-bold text-neutral-900">{analytics?.uniqueVisitors.total.toLocaleString()}</p>
              <div className="mt-1">
                {renderTrendBadge(analytics?.uniqueVisitors.trend || 0)}
              </div>
            </div>
            <Users className="w-8 h-8 text-green-600" />
          </div>
          {analytics?.uniqueVisitors.chartData && renderMiniChart(
            analytics.uniqueVisitors.chartData.map(d => ({ date: d.date, value: d.visitors })),
            'bg-green-500'
          )}
        </Card>

        <Card padding="md">
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="text-sm text-neutral-600">{t('analytics.totalDownloads')}</p>
              <p className="text-3xl font-bold text-neutral-900">{analytics?.downloads.total.toLocaleString()}</p>
              <div className="mt-1">
                {renderTrendBadge(analytics?.downloads.trend || 0)}
              </div>
            </div>
            <Download className="w-8 h-8 text-purple-600" />
          </div>
          <div className="mt-4 space-y-2">
            <p className="text-xs text-neutral-500 uppercase">{t('analytics.topGallery')}</p>
            <p className="text-sm font-medium text-neutral-900 truncate">
              {analytics?.downloads.topGalleries[0]?.name}
            </p>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Top Pages */}
        <div className="lg:col-span-2">
          <Card padding="md">
            <h2 className="text-lg font-semibold text-neutral-900 mb-4">{t('analytics.topPages')}</h2>
            <div className="space-y-3">
              {analytics?.topPages.map((page, index) => (
                <div key={index} className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-neutral-900">{page.path}</p>
                    <p className="text-xs text-neutral-500">
                      {page.uniqueVisitors} {t('analytics.visitors')}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-neutral-900">{page.views}</p>
                    <p className="text-xs text-neutral-500">{t('analytics.views')}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Top Downloads */}
          <Card padding="md" className="mt-6">
            <h2 className="text-lg font-semibold text-neutral-900 mb-4">{t('analytics.topDownloadsByGallery')}</h2>
            <div className="space-y-3">
              {analytics?.downloads.topGalleries.map((gallery, index) => (
                <div key={index} className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-neutral-900">{gallery.name}</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex-1 bg-neutral-200 rounded-full h-2 max-w-[100px]">
                      <div
                        className="bg-purple-600 h-2 rounded-full"
                        style={{ 
                          width: `${(gallery.downloads / (analytics.downloads.topGalleries[0]?.downloads || 1)) * 100}%` 
                        }}
                      />
                    </div>
                    <p className="text-sm font-semibold text-neutral-900 w-12 text-right">
                      {gallery.downloads}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          {/* Device Breakdown */}
          <Card padding="md">
            <h2 className="text-lg font-semibold text-neutral-900 mb-4">{t('analytics.deviceBreakdown')}</h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Monitor className="w-5 h-5 text-neutral-600" />
                  <span className="text-sm text-neutral-700">{t('analytics.desktop')}</span>
                </div>
                <span className="text-sm font-semibold">{analytics?.devices.desktop}%</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Smartphone className="w-5 h-5 text-neutral-600" />
                  <span className="text-sm text-neutral-700">{t('analytics.mobile')}</span>
                </div>
                <span className="text-sm font-semibold">{analytics?.devices.mobile}%</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Tablet className="w-5 h-5 text-neutral-600" />
                  <span className="text-sm text-neutral-700">{t('analytics.tablet')}</span>
                </div>
                <span className="text-sm font-semibold">{analytics?.devices.tablet}%</span>
              </div>
            </div>
          </Card>

          {/* Storage Information */}
          {dashboardStats && (
            <Card padding="md">
              <h2 className="text-lg font-semibold text-neutral-900 mb-4">{t('analytics.storageUsage')}</h2>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-neutral-600">{t('analytics.used')}</span>
                    <span className="font-medium">{adminService.formatBytes(dashboardStats.storageUsed)}</span>
                  </div>
                  <div className="w-full bg-neutral-200 rounded-full h-2">
                    <div
                      className="bg-primary-600 h-2 rounded-full transition-all"
                      style={{ width: `${Math.min((dashboardStats.storageUsed / (10 * 1024 * 1024 * 1024)) * 100, 100)}%` }}
                    />
                  </div>
                  <p className="text-xs text-neutral-500 mt-1">
                    {Math.round((dashboardStats.storageUsed / (10 * 1024 * 1024 * 1024)) * 100)}% {t('analytics.of')} 10 GB
                  </p>
                </div>
                <div className="pt-2 border-t">
                  <div className="flex justify-between text-sm">
                    <span className="text-neutral-600">{t('analytics.totalPhotos')}</span>
                    <span className="font-medium">{dashboardStats.totalPhotos.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-sm mt-2">
                    <span className="text-neutral-600">{t('analytics.activeEvents')}</span>
                    <span className="font-medium">{dashboardStats.activeEvents}</span>
                  </div>
                </div>
              </div>
            </Card>
          )}
        </div>
      </div>

      {/* Configuration Notice */}
      {umamiConfig.enabled === false && (
        <Card padding="md" className="mt-6 bg-amber-50 border-amber-200">
          <div className="flex items-start gap-3">
            <Activity className="w-5 h-5 text-amber-600 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-amber-900">{t('analytics.notConfigured')}</p>
              <p className="text-sm text-amber-700 mt-1">
                {t('analytics.configureInstructions')}
              </p>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
};