import React from 'react';
import { Outlet } from 'react-router-dom';
import { AdminAuthProvider } from '../../contexts';

export const AdminAuthWrapper: React.FC = () => {
  return (
    <AdminAuthProvider>
      <Outlet />
    </AdminAuthProvider>
  );
};

AdminAuthWrapper.displayName = 'AdminAuthWrapper';