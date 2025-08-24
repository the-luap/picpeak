import React, { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { getAuthToken } from '../config/api';
import { authService } from '../services';
import type { AdminUser } from '../types';

interface AdminAuthContextType {
  isAuthenticated: boolean;
  user: AdminUser | null;
  login: (token: string, user: AdminUser) => void;
  logout: () => void;
  isLoading: boolean;
  error: string | null;
  mustChangePassword: boolean;
  updatePasswordChanged: () => void;
}

const AdminAuthContext = createContext<AdminAuthContextType | undefined>(undefined);

export const useAdminAuth = () => {
  const context = useContext(AdminAuthContext);
  if (!context) {
    throw new Error('useAdminAuth must be used within an AdminAuthProvider');
  }
  return context;
};

interface AdminAuthProviderProps {
  children: ReactNode;
}

export const AdminAuthProvider: React.FC<AdminAuthProviderProps> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<AdminUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mustChangePassword, setMustChangePassword] = useState(false);

  useEffect(() => {
    // Check if user has a valid token on mount
    const checkAuth = async () => {
      try {
        const token = getAuthToken(true);
        if (token) {
          // For now, just assume the token is valid
          // TODO: Validate token with backend and get user info
          setIsAuthenticated(true);
        }
      } catch (error) {
        // Auth check failed - user needs to login
        setError('Failed to check authentication');
      } finally {
        setIsLoading(false);
      }
    };
    
    checkAuth();
  }, []);

  const login = (_token: string, user: AdminUser) => {
    // Token is already stored in cookie by authService
    setUser(user);
    setError(null);
    setIsAuthenticated(true);
    setMustChangePassword(user.mustChangePassword || false);
  };

  const logout = () => {
    authService.adminLogout();
    setIsAuthenticated(false);
    setUser(null);
    setMustChangePassword(false);
  };

  const updatePasswordChanged = () => {
    setMustChangePassword(false);
    if (user) {
      setUser({
        ...user,
        mustChangePassword: false
      });
    }
  };

  return (
    <AdminAuthContext.Provider
      value={{
        isAuthenticated,
        user,
        login,
        logout,
        isLoading,
        error,
        mustChangePassword,
        updatePasswordChanged,
      }}
    >
      {children}
    </AdminAuthContext.Provider>
  );
};