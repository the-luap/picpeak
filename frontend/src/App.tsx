import { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { analyticsService } from './services/analytics.service';

import { GalleryAuthProvider, MaintenanceProvider } from './contexts';
import { ThemeProvider } from './contexts/ThemeContext';
import { GalleryPage } from './pages/GalleryPage';
import { ClientAccessPage } from './pages/ClientAccessPage';
import { PreviewPage } from './pages/gallery/PreviewPage';
import { LegalPage } from './pages/public/LegalPage';
import {
  AdminLoginPage,
  AdminDashboard,
  EventsListPage,
  CreateEventPage,
  EventDetailsPage,
  EventFeedbackPage,
  EmailConfigPage,
  ArchivesPage,
  AnalyticsPage,
  BrandingPage,
  SettingsPage,
  BackupManagement,
  CMSPage,
  UserManagementPage,
  EventTypesPage,
  WebhookDeliveriesPage
} from './pages/admin';
import { AcceptInvitePage } from './pages/public/AcceptInvitePage';
import { AdminLayout, AdminAuthWrapper } from './components/admin';
import { PageErrorBoundary, OfflineIndicator, SkipLink, DynamicFavicon, RobotsMetaTags, CMSContentBlock } from './components/common';
import { MaintenanceWrapper } from './components/MaintenanceWrapper';
import { GlobalThemeProvider } from './components/GlobalThemeProvider';
import { usePublicSettings } from './hooks/usePublicSettings';

// Create a client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

// Bootstraps Umami analytics from /public/settings. Lives inside QueryClientProvider
// so it shares the public-settings cache with every other consumer of usePublicSettings.
function AnalyticsBootstrap() {
  const { data: settings, isError } = usePublicSettings();

  useEffect(() => {
    if (!settings && !isError) return;

    const envUmamiUrl = import.meta.env.VITE_UMAMI_URL;
    const envUmamiWebsiteId = import.meta.env.VITE_UMAMI_WEBSITE_ID;

    if (settings?.umami_enabled && settings.umami_url && settings.umami_website_id) {
      analyticsService.initialize({
        websiteId: settings.umami_website_id,
        hostUrl: settings.umami_url,
        autoTrack: true,
        doNotTrack: true,
      });
      return;
    }

    if (envUmamiUrl && envUmamiWebsiteId && (isError || settings?.enable_analytics !== false)) {
      analyticsService.initialize({
        websiteId: envUmamiWebsiteId,
        hostUrl: envUmamiUrl,
        autoTrack: true,
        doNotTrack: true,
      });
    }
  }, [settings, isError]);

  return null;
}

function App() {
  // Track dark mode for toast theming
  const [toastTheme, setToastTheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    const observer = new MutationObserver(() => {
      setToastTheme(document.documentElement.classList.contains('dark') ? 'dark' : 'light');
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  return (
    <PageErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AnalyticsBootstrap />
        <MaintenanceProvider>
          <ThemeProvider>
            <GlobalThemeProvider>
              <DynamicFavicon />
              <RobotsMetaTags />
              <Router>
                <MaintenanceWrapper>
                  <SkipLink />
                  <Routes>
                  {/* Public gallery routes */}
                  <Route path="/gallery/preview" element={<PreviewPage />} />
                  <Route path="/gallery/:slug/client-access" element={
                    <GalleryAuthProvider>
                      <ClientAccessPage />
                    </GalleryAuthProvider>
                  } />
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
                      <Route path="events/:id/feedback" element={<EventFeedbackPage />} />
                      <Route path="archives" element={<ArchivesPage />} />
                      <Route path="email" element={<EmailConfigPage />} />
                      <Route path="analytics" element={<AnalyticsPage />} />
                      <Route path="branding" element={<BrandingPage />} />
                      <Route path="settings" element={<SettingsPage />} />
                      <Route path="event-types" element={<EventTypesPage />} />
                      <Route path="webhooks/:id/deliveries" element={<WebhookDeliveriesPage />} />
                      <Route path="backup" element={<BackupManagement />} />
                      <Route path="cms" element={<CMSPage />} />
                      <Route path="users" element={<UserManagementPage />} />
                      <Route index element={<Navigate to="/admin/dashboard" replace />} />
                    </Route>
                  </Route>

                  {/* Public invitation acceptance page */}
                  <Route path="/invite/:token" element={<AcceptInvitePage />} />

                  {/* Public legal pages */}
                  <Route path="/impressum" element={<LegalPage />} />
                  <Route path="/datenschutz" element={<LegalPage />} />
                  <Route path="/:slug" element={<LegalPage />} />

                  {/* Default redirect */}
                  <Route path="/" element={<Navigate to="/admin/login" replace />} />

                  {/* Customisable 404 (#324) — caught here for any path that
                      didn't match. Top-level `/:slug` is consumed above by
                      LegalPage; this picks up deeper unknown paths. */}
                  <Route path="*" element={<CMSContentBlock slug="not-found" />} />
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
              theme={toastTheme}
            />
            </GlobalThemeProvider>
          </ThemeProvider>
        </MaintenanceProvider>
      </QueryClientProvider>
    </PageErrorBoundary>
  );
}

export default App;
