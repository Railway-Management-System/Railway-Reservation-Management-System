# Railway Reservation System - Admin Dashboard

## Overview
This is the Admin Dashboard frontend for the Railway Reservation Management System, built by Team 3 for our DBMS college project. It provides an interface to manage users, staff, trains, routes, schedules, fares, bookings, tdr, fines, incidents, and more.

## Tech Stack
- React 18
- Vite
- TypeScript
- Tailwind CSS
- React Router v6
- Lucide React
- Vitest

## Getting Started

### Installation
```bash
npm install
```

### Running in Development
```bash
npm run dev
```
This starts the dev server (usually at http://localhost:5174 or 5173).

### Building for Production
```bash
npm run build
```

### Running Tests
```bash
npm run test
```

## Environment Variables
Create a `.env` file in the root of the `frontend/admin` folder:
- `VITE_USE_MOCK=true` (Set to `true` to use mock data/in-memory API, or `false` to connect to the live backend)
- `VITE_API_BASE_URL=http://localhost:5000` (The URL of the backend API)

To toggle between mock data and the live API, simply change `VITE_USE_MOCK` in your `.env` file.

## Login Credentials (Mock)
When using mock mode, you can log in with:
- **Email:** admin@rrms.com
- **Password:** admin123

## Folder Structure
- `src/auth/` — Auth context
- `src/components/` — Shared UI components
- `src/config/` — API configuration (USE_MOCK toggle)
- `src/constants/` — Enums (`enums.ts`) and route mappings (`routes.ts`)
- `src/layouts/` — AdminLayout (sidebar + topbar)
- `src/pages/` — One folder per feature module
- `src/routes/` — Router configuration + ProtectedRoute component
- `src/services/` — Contains `mock.client.ts`, `http.client.ts` + all service files
- `src/types/` — TypeScript types mirroring DATA_SCHEMA.md
- `src/utils/` — Utility functions (`seatOverlap.ts`, `fareCalculator.ts`, `format.ts`)

## Routes Map
- `/admin/login`
- `/admin` (Dashboard)
- `/admin/users`
- `/admin/staff`
- `/admin/trains`
- `/admin/routes`
- `/admin/schedules`
- `/admin/stations`
- `/admin/platforms`
- `/admin/coaches`
- `/admin/seats`
- `/admin/fares`
- `/admin/quotas`
- `/admin/bookings`
- `/admin/tdr`
- `/admin/fines`
- `/admin/incidents`
- `/admin/grievances`
- `/admin/reports`
- `/admin/audit-logs`
- `/admin/notifications`
- `/admin/settings`

## Known Contract Gaps
Certain features do not currently have corresponding API endpoints defined in the shared API contract:
- Fines
- Incidents
- Grievances
- Broadcast Notifications
- Dashboard Summary Stats
- Admin Profile

For these features, screens have been built to be read-only or rely exclusively on in-memory mock data. Refer to `ADMIN_CONTRACT_GAPS.md` for a detailed breakdown.

## Note on Scope
No shared project files outside of `frontend/admin/` were modified to deliver these features. All routes are prefixed with `/admin/*`, and storage keys are namespaced.
