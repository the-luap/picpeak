import { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { analyticsService } from './services/analytics.service';

import { GalleryAuthProvider, MaintenanceProvider } from './contexts';
import { ThemeProvider } from './contexts/ThemeContext';
import { GalleryPage } from './pages/GalleryPage';
import { PreviewPage } from './pages/gallery/PreviewPage';
import { LegalPage } from './pages/public/LegalPage';
import { 
  AdminLoginPage, 
  AdminDashboard, 
  EventsListPage,
  CreateEventPageEnhanced as CreateEventPage,
  EventDetailsPage,
  EmailConfigPage,
  ArchivesPage,
  AnalyticsPage,
  BrandingPage,
  SettingsPage,
  CMSPage
} from './pages/admin';
import { CMSPageEnhanced } from './pages/admin/CMSPageEnhanced';
import { AdminLayout, AdminAuthWrapper } from './components/admin';
import { PageErrorBoundary, OfflineIndicator, SkipLink, DynamicFavicon } from './components/common';
import { MaintenanceWrapper } from './components/MaintenanceWrapper';
import { GlobalThemeProvider } from './components/GlobalThemeProvider';
import { getApiBaseUrl } from './utils/url';

// Create a client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

function App() {
  // Initialize Umami Analytics based on settings
  useEffect(() => {
    const initializeAnalytics = async () => {
      try {
        // Fetch public settings to get Umami configuration
        const response = await fetch(`${getApiBaseUrl()}/public/settings`);
        const settings = await response.json();
        
        // Check if Umami is enabled and configured in backend settings
        if (settings.umami_enabled && settings.umami_url && settings.umami_website_id) {
          // Use backend configuration
          analyticsService.initialize({
            websiteId: settings.umami_website_id,
            hostUrl: settings.umami_url,
            autoTrack: true,
            doNotTrack: true
          });
        } else {
          // Fall back to environment variables if backend not configured
          const umamiUrl = import.meta.env.VITE_UMAMI_URL;
          const umamiWebsiteId = import.meta.env.VITE_UMAMI_WEBSITE_ID;
          
          if (umamiUrl && umamiWebsiteId && settings.enable_analytics !== false) {
            analyticsService.initialize({
              websiteId: umamiWebsiteId,
              hostUrl: umamiUrl,
              autoTrack: true,
              doNotTrack: true
            });
          }
        }
      } catch (error) {
        console.error('Failed to fetch settings for analytics:', error);
        // Fall back to environment variables on error
        const umamiUrl = import.meta.env.VITE_UMAMI_URL;
        const umamiWebsiteId = import.meta.env.VITE_UMAMI_WEBSITE_ID;
        
        if (umamiUrl && umamiWebsiteId) {
          analyticsService.initialize({
            websiteId: umamiWebsiteId,
            hostUrl: umamiUrl,
            autoTrack: true,
            doNotTrack: true
          });
        }
      }
    };
    
    initializeAnalytics();
  }, []);

  return (
    <PageErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <MaintenanceProvider>
          <ThemeProvider>
            <GlobalThemeProvider>
              <DynamicFavicon />
              <Router>
                <MaintenanceWrapper>
                  <SkipLink />
                  <Routes>
                  {/* Public gallery routes */}
                  <Route path="/gallery/preview" element={<PreviewPage />} />
                  <Route path="/gallery/:slug/:token?" element={
                    <GalleryAuthProvider>
                      <GalleryPage />
                    </GalleryAuthProvider>
                  } />

                  {/* Admin routes - wrap with AdminAuthProvider */}
                  <Route path="/admin" element={<AdminAuthWrapper />}>
                    <Route path="login" element={<AdminLoginPage />} />
                    <Route element={<AdminLayout />}>
                      <Route path="dashboard" element={<AdminDashboard />} />
                      <Route path="events" element={<EventsListPage />} />
                      <Route path="events/new" element={<CreateEventPage />} />
                      <Route path="events/:id" element={<EventDetailsPage />} />
                      <Route path="archives" element={<ArchivesPage />} />
                      <Route path="email" element={<EmailConfigPage />} />
                      <Route path="analytics" element={<AnalyticsPage />} />
                      <Route path="branding" element={<BrandingPage />} />
                      <Route path="settings" element={<SettingsPage />} />
                      <Route path="cms" element={<CMSPageEnhanced />} />
                      <Route index element={<Navigate to="/admin/dashboard" replace />} />
                    </Route>
                  </Route>

                  {/* Public legal pages */}
                  <Route path="/impressum" element={<LegalPage />} />
                  <Route path="/datenschutz" element={<LegalPage />} />
                  <Route path="/:slug" element={<LegalPage />} />

                  {/* Default redirect */}
                  <Route path="/" element={<Navigate to="/admin/login" replace />} />
                </Routes>
              </MaintenanceWrapper>
            </Router>

            {/* Offline indicator */}
            <OfflineIndicator />

            {/* Toast notifications */}
            <ToastContainer
              position="bottom-right"
              autoClose={5000}
              hideProgressBar={false}
              newestOnTop
              closeOnClick
              rtl={false}
              pauseOnFocusLoss
              draggable
              pauseOnHover
              theme="light"
            />
            </GlobalThemeProvider>
          </ThemeProvider>
        </MaintenanceProvider>
      </QueryClientProvider>
    </PageErrorBoundary>
  );
}

export default App;
