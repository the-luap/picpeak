import React from 'react';
import { Outlet } from 'react-router-dom';
import { AdminAuthProvider, PermissionsProvider } from '../../contexts';

export const AdminAuthWrapper: React.FC = () => {
  return (
    <AdminAuthProvider>
      <PermissionsProvider>
        <Outlet />
      </PermissionsProvider>
    </AdminAuthProvider>
  );
};

AdminAuthWrapper.displayName = 'AdminAuthWrapper';