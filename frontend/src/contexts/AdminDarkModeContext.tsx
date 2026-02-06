import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { useLocation } from 'react-router-dom';

type DarkModePreference = 'light' | 'dark' | 'system';

interface AdminDarkModeContextType {
  preference: DarkModePreference;
  isDark: boolean;
  setPreference: (pref: DarkModePreference) => void;
  toggle: () => void;
}

const AdminDarkModeContext = createContext<AdminDarkModeContextType | undefined>(undefined);

const STORAGE_KEY = 'admin-dark-mode';

function resolveIsDark(pref: DarkModePreference): boolean {
  if (pref === 'dark') return true;
  if (pref === 'light') return false;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

export const AdminDarkModeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  const isLoginPage = location.pathname === '/admin/login';

  const [preference, setPreferenceState] = useState<DarkModePreference>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'dark' || stored === 'light' || stored === 'system') return stored;
    return 'light';
  });

  const [isDark, setIsDark] = useState(() => resolveIsDark(preference));

  const applyDarkClass = useCallback((dark: boolean, forceLight = false) => {
    const root = document.documentElement;
    if (dark && !forceLight) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, []);

  const setPreference = useCallback((pref: DarkModePreference) => {
    setPreferenceState(pref);
    localStorage.setItem(STORAGE_KEY, pref);
    const dark = resolveIsDark(pref);
    setIsDark(dark);
    // Don't apply dark on login page
    applyDarkClass(dark, isLoginPage);
  }, [applyDarkClass, isLoginPage]);

  const toggle = useCallback(() => {
    setPreference(isDark ? 'light' : 'dark');
  }, [isDark, setPreference]);

  // Apply on mount and when route changes - skip dark mode on login page
  useEffect(() => {
    applyDarkClass(isDark, isLoginPage);
  }, [applyDarkClass, isDark, isLoginPage]);

  // Listen for system changes when preference is 'system'
  useEffect(() => {
    if (preference !== 'system') return;

    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => {
      setIsDark(e.matches);
      applyDarkClass(e.matches);
    };
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, [preference, applyDarkClass]);

  // Strip dark class when unmounting (navigating away from admin)
  useEffect(() => {
    return () => {
      document.documentElement.classList.remove('dark');
    };
  }, []);

  const value = useMemo(() => ({ preference, isDark, setPreference, toggle }), [preference, isDark, setPreference, toggle]);

  return (
    <AdminDarkModeContext.Provider value={value}>
      {children}
    </AdminDarkModeContext.Provider>
  );
};

export const useAdminDarkMode = () => {
  const context = useContext(AdminDarkModeContext);
  if (!context) {
    throw new Error('useAdminDarkMode must be used within AdminDarkModeProvider');
  }
  return context;
};
