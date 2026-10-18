import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { authService } from '../services/authService';

/**
 * Guards the /staff route.
 * Redirects unauthenticated visitors back to the home/login page.
 */
export const StaffProtectedRoute: React.FC = () => {
  const isAuthenticated = authService.isStaffAuthenticated();

  if (!isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
};
