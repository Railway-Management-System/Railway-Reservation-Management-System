import { createBrowserRouter, Navigate } from 'react-router-dom';
import HomePage from './admin/pages/HomePage';
import { ProtectedRoute } from './admin/routes/ProtectedRoute';
import { StaffProtectedRoute } from './admin/routes/StaffProtectedRoute';
import { AdminLayout } from './admin/layouts/AdminLayout';
import { DashboardPage } from './admin/pages/dashboard/DashboardPage';
import { UsersPage } from './admin/pages/users/UsersPage';
import { StaffPage } from './admin/pages/staff/StaffPage';
import { TrainsPage } from './admin/pages/trains/TrainsPage';
import { RoutesPage } from './admin/pages/routes/RoutesPage';
import { SchedulesPage } from './admin/pages/schedules/SchedulesPage';
import { StationsPage } from './admin/pages/stations/StationsPage';
import { PlatformsPage } from './admin/pages/platforms/PlatformsPage';
import { CoachesPage } from './admin/pages/coaches/CoachesPage';
import { SeatsPage } from './admin/pages/seats/SeatsPage';
import { FaresPage } from './admin/pages/fares/FaresPage';
import { QuotasPage } from './admin/pages/quotas/QuotasPage';
import { BookingsPage } from './admin/pages/bookings/BookingsPage';
import { TdrPage } from './admin/pages/tdr/TdrPage';
import { FinesPage } from './admin/pages/fines/FinesPage';
import { IncidentsPage } from './admin/pages/incidents/IncidentsPage';
import { GrievancesPage } from './admin/pages/grievances/GrievancesPage';
import { ReportsPage } from './admin/pages/reports/ReportsPage';
import { AuditLogsPage } from './admin/pages/auditLogs/AuditLogsPage';
import { NotificationsPage } from './admin/pages/notifications/NotificationsPage';
import { SettingsPage } from './admin/pages/settings/SettingsPage';
import { StaffPortalApp } from './StaffPortalApp';
import { PassengerPortalPage } from './pages/PassengerPortalPage';

export const router = createBrowserRouter([
  // Unified Homepage (Akash's Homepage UI with Live Multi-Role Switcher & Navigation)
  {
    path: '/',
    element: <HomePage />,
  },
  {
    path: '/admin/login',
    element: <HomePage />,
  },

  // Staff / Conductor Operations Terminal (Aditya's Branch)
  {
    path: '/staff',
    element: <StaffProtectedRoute />,
    children: [
      {
        index: true,
        element: <StaffPortalApp />,
      },
    ],
  },

  // Passenger User Portal (Chinmay's User Frontend Branch)
  {
    path: '/passenger',
    element: <PassengerPortalPage />,
  },

  // Admin Master Management Dashboard & 21 submodules (Soham's Branch)
  {
    path: '/admin',
    element: <ProtectedRoute />,
    children: [
      {
        element: <AdminLayout />,
        children: [
          {
            index: true,
            element: <DashboardPage />,
          },
          {
            path: 'users',
            element: <UsersPage />,
          },
          {
            path: 'staff',
            element: <StaffPage />,
          },
          {
            path: 'trains',
            element: <TrainsPage />,
          },
          {
            path: 'routes',
            element: <RoutesPage />,
          },
          {
            path: 'schedules',
            element: <SchedulesPage />,
          },
          {
            path: 'stations',
            element: <StationsPage />,
          },
          {
            path: 'platforms',
            element: <PlatformsPage />,
          },
          {
            path: 'coaches',
            element: <CoachesPage />,
          },
          {
            path: 'seats',
            element: <SeatsPage />,
          },
          {
            path: 'fares',
            element: <FaresPage />,
          },
          {
            path: 'quotas',
            element: <QuotasPage />,
          },
          {
            path: 'bookings',
            element: <BookingsPage />,
          },
          {
            path: 'tdr',
            element: <TdrPage />,
          },
          {
            path: 'fines',
            element: <FinesPage />,
          },
          {
            path: 'incidents',
            element: <IncidentsPage />,
          },
          {
            path: 'grievances',
            element: <GrievancesPage />,
          },
          {
            path: 'reports',
            element: <ReportsPage />,
          },
          {
            path: 'audit-logs',
            element: <AuditLogsPage />,
          },
          {
            path: 'notifications',
            element: <NotificationsPage />,
          },
          {
            path: 'settings',
            element: <SettingsPage />,
          },
        ],
      },
    ],
  },
  {
    path: '*',
    element: <Navigate to="/" replace />,
  },
]);
