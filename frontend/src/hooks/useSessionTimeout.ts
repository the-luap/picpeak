import { useEffect, useCallback } from 'react';
import { useAdminAuth } from '../contexts';
import { api } from '../config/api';

// Hook to handle session timeout
export const useSessionTimeout = () => {
  const { logout } = useAdminAuth();
  
  const handleSessionTimeout = useCallback((error: any) => {
    if (error?.response?.data?.code === 'SESSION_TIMEOUT') {
      // Clear local auth state
      logout();
      // Redirect to login with message
      window.location.href = '/admin/login?session=expired';
      return true;
    }
    return false;
  }, [logout]);
  
  useEffect(() => {
    // Add response interceptor to handle session timeout
    const interceptor = api.interceptors.response.use(
      response => response,
      error => {
        if (handleSessionTimeout(error)) {
          // Don't propagate the error if it was a session timeout
          return Promise.reject(new Error('Session expired'));
        }
        return Promise.reject(error);
      }
    );
    
    // Clean up interceptor on unmount
    return () => {
      api.interceptors.response.eject(interceptor);
    };
  }, [handleSessionTimeout]);
  
  return { handleSessionTimeout };
};