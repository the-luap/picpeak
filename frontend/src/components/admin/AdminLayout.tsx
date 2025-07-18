import React, { useState } from 'react';
import { Outlet, Navigate } from 'react-router-dom';

import { useAdminAuth } from '../../contexts';
import { useSessionTimeout } from '../../hooks/useSessionTimeout';
import { AdminSidebar } from './AdminSidebar';
import { AdminHeader } from './AdminHeader';
import { MaintenanceBanner } from './MaintenanceBanner';

export const AdminLayout: React.FC = () => {
  const { isAuthenticated, isLoading } = useAdminAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  
  // Handle session timeout
  useSessionTimeout();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-neutral-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/admin/login" replace />;
  }

  return (
    <div className="h-screen bg-neutral-50 flex overflow-hidden">
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <AdminSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 h-screen">
        {/* Header */}
        <AdminHeader onMenuClick={() => setSidebarOpen(true)} />
        
        {/* Maintenance mode banner */}
        <MaintenanceBanner />

        {/* Page content */}
        <main id="main-content" className="flex-1 px-4 sm:px-6 lg:px-8 py-8 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

AdminLayout.displayName = 'AdminLayout';