import { createBrowserRouter, Navigate } from 'react-router-dom';
import { ProtectedRoute } from './ProtectedRoute';
import { AdminLayout } from '../layouts/AdminLayout';
import { LoginPage } from '../pages/auth/LoginPage';
import { DashboardPage } from '../pages/dashboard/DashboardPage';
import { UsersPage } from '../pages/users/UsersPage';
import { StaffPage } from '../pages/staff/StaffPage';
import { TrainsPage } from '../pages/trains/TrainsPage';
import { RoutesPage } from '../pages/routes/RoutesPage';
import { SchedulesPage } from '../pages/schedules/SchedulesPage';
import { StationsPage } from '../pages/stations/StationsPage';
import { PlatformsPage } from '../pages/platforms/PlatformsPage';
import { CoachesPage } from '../pages/coaches/CoachesPage';
import { SeatsPage } from '../pages/seats/SeatsPage';
import { FaresPage } from '../pages/fares/FaresPage';
import { QuotasPage } from '../pages/quotas/QuotasPage';
import { BookingsPage } from '../pages/bookings/BookingsPage';
import { TdrPage } from '../pages/tdr/TdrPage';
import { FinesPage } from '../pages/fines/FinesPage';
import { IncidentsPage } from '../pages/incidents/IncidentsPage';
import { GrievancesPage } from '../pages/grievances/GrievancesPage';
import { ReportsPage } from '../pages/reports/ReportsPage';
import { AuditLogsPage } from '../pages/auditLogs/AuditLogsPage';
import { NotificationsPage } from '../pages/notifications/NotificationsPage';
import { SettingsPage } from '../pages/settings/SettingsPage';

export const router = createBrowserRouter([
  {
    path: '/admin/login',
    element: <LoginPage />,
  },
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
    element: <Navigate to="/admin" replace />,
  },
]);
