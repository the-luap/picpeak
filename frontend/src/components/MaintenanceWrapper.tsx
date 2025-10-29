import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { MaintenanceMode } from './MaintenanceMode';
import { useMaintenanceMode } from '../contexts/MaintenanceContext';
import { setMaintenanceModeCallback, api } from '../config/api';

interface MaintenanceWrapperProps {
  children: React.ReactNode;
}

export const MaintenanceWrapper: React.FC<MaintenanceWrapperProps> = ({ children }) => {
  const location = useLocation();
  const { isMaintenanceMode, setMaintenanceMode } = useMaintenanceMode();
  const [hasAdminSession, setHasAdminSession] = useState(false);
  
  // Check if current route is admin route
  const isAdminRoute = location.pathname.startsWith('/admin');

  useEffect(() => {
    let isMounted = true;

    const checkAdminSession = async () => {
      if (!isAdminRoute) {
        setHasAdminSession(false);
        return;
      }

      try {
        const response = await api.get<{ valid: boolean; type: string }>('/auth/session');
        if (isMounted) {
          setHasAdminSession(Boolean(response.data?.valid && response.data.type === 'admin'));
        }
      } catch {
        if (isMounted) {
          setHasAdminSession(false);
        }
      }
    };

    checkAdminSession();

    return () => {
      isMounted = false;
    };
  }, [isAdminRoute]);

  // Register the maintenance mode callback
  useEffect(() => {
    setMaintenanceModeCallback((enabled: boolean) => {
      setMaintenanceMode(enabled);
    });
  }, [setMaintenanceMode]);

  // Check maintenance mode on mount and when location changes
  useQuery({
    queryKey: ['maintenance-check', location.pathname],
    queryFn: async () => {
      try {
        // Make a lightweight request to check maintenance status
        await api.get('/public/settings');
        // If successful, maintenance mode is off
        setMaintenanceMode(false);
        return { maintenance: false };
      } catch (error: any) {
        if (error.response?.status === 503) {
          // Only set maintenance mode for non-admin routes or unauthenticated admin routes
          if (!isAdminRoute || !hasAdminSession) {
            setMaintenanceMode(true);
            return { maintenance: true };
          }
        }
        return { maintenance: false };
      }
    },
    staleTime: 30000, // Check every 30 seconds
    retry: false, // Don't retry on failure
    enabled: (!isAdminRoute || !hasAdminSession) && !isMaintenanceMode, // Don't check if already in maintenance
  });

  // Show maintenance page if in maintenance mode and not on admin route with auth
  if (isMaintenanceMode && (!isAdminRoute || !hasAdminSession)) {
    return <MaintenanceMode />;
  }

  return <>{children}</>;
};
