import React from 'react';
import ReactDOM from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { StaffProvider } from './context/StaffContext';
import { AuthProvider } from './admin/auth/AuthContext';
import { router } from './router';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AuthProvider>
      <StaffProvider>
        <RouterProvider router={router} />
      </StaffProvider>
    </AuthProvider>
  </React.StrictMode>
);
