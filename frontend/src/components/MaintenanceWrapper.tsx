import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { MaintenanceMode } from './MaintenanceMode';
import { useMaintenanceMode } from '../contexts/MaintenanceContext';
import { setMaintenanceModeCallback, api } from '../config/api';

interface MaintenanceWrapperProps {
  children: React.ReactNode;
}

// Maintenance detection now lives in two places:
//   1. The axios interceptor in config/api.ts flips the flag on any 503 response.
//   2. MaintenanceContext polls /public/settings every 30s and reads the explicit
//      maintenance_mode field (via the shared usePublicSettings hook).
// This wrapper only needs to gate the rendered tree on the resulting state.
export const MaintenanceWrapper: React.FC<MaintenanceWrapperProps> = ({ children }) => {
  const location = useLocation();
  const { isMaintenanceMode, setMaintenanceMode } = useMaintenanceMode();
  const [hasAdminSession, setHasAdminSession] = useState(false);

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

  useEffect(() => {
    setMaintenanceModeCallback((enabled: boolean) => {
      setMaintenanceMode(enabled);
    });
  }, [setMaintenanceMode]);

  if (isMaintenanceMode && (!isAdminRoute || !hasAdminSession)) {
    return <MaintenanceMode />;
  }

  return <>{children}</>;
};
