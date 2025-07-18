import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { setMaintenanceModeCallback } from '../config/api';
import { getApiBaseUrl } from '../utils/url';

interface MaintenanceContextType {
  isMaintenanceMode: boolean;
  setMaintenanceMode: (enabled: boolean) => void;
}

const MaintenanceContext = createContext<MaintenanceContextType | undefined>(undefined);

export const useMaintenanceMode = () => {
  const context = useContext(MaintenanceContext);
  if (!context) {
    throw new Error('useMaintenanceMode must be used within MaintenanceProvider');
  }
  return context;
};

interface MaintenanceProviderProps {
  children: ReactNode;
}

export const MaintenanceProvider: React.FC<MaintenanceProviderProps> = ({ children }) => {
  const [isMaintenanceMode, setIsMaintenanceMode] = useState(false);

  // Check maintenance mode status on mount
  const { data: settings } = useQuery({
    queryKey: ['public-settings-maintenance'],
    queryFn: async () => {
      try {
        const response = await fetch(`${getApiBaseUrl()}/public/settings`);
        if (response.status === 503) {
          setIsMaintenanceMode(true);
          return null;
        }
        return response.json();
      } catch (error) {
        // If we can't reach the server, don't assume maintenance mode
        return null;
      }
    },
    staleTime: 30 * 1000, // Check every 30 seconds
    refetchInterval: 30 * 1000,
  });

  // Update maintenance mode based on settings
  useEffect(() => {
    if (settings?.maintenance_mode !== undefined) {
      setIsMaintenanceMode(settings.maintenance_mode);
    }
  }, [settings]);

  // Set up the callback for API interceptor
  useEffect(() => {
    setMaintenanceModeCallback((enabled: boolean) => {
      setIsMaintenanceMode(enabled);
    });

    return () => {
      setMaintenanceModeCallback(null as any);
    };
  }, []);

  const setMaintenanceMode = (enabled: boolean) => {
    setIsMaintenanceMode(enabled);
  };

  return (
    <MaintenanceContext.Provider value={{ isMaintenanceMode, setMaintenanceMode }}>
      {children}
    </MaintenanceContext.Provider>
  );
};