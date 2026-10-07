# Admin Contract Gaps

The following features have screens built in the admin frontend, but lack corresponding API endpoints in the shared `API_CONTRACT.md`. These features currently operate exclusively on mock data or in-memory state.

### 1. Fines Management
- **Feature Name:** Fines list and management
- **What the UI Needs:** Fetching a list of passenger fines, and updating their status (e.g. marking as paid/appealed).
- **Mock File:** `mock-data/fines.json`
- **Proposed Endpoint:** `PROPOSED — not in contract` (GET/PUT `/api/admin/fines`)
- **Current Handling:** Fully mock-only. List renders from JSON, and state updates are in-memory.

### 2. Incidents Management
- **Feature Name:** Incidents list and status update
- **What the UI Needs:** Reporting and resolving on-ground incidents like delays or emergencies.
- **Mock File:** `mock-data/incidents.json`
- **Proposed Endpoint:** `PROPOSED — not in contract` (GET/PUT `/api/admin/incidents`)
- **Current Handling:** Fully mock-only. List renders from JSON, and state updates are in-memory.

### 3. Grievances Management
- **Feature Name:** Grievances admin view and response
- **What the UI Needs:** Viewing passenger complaints and submitting admin responses to resolve them.
- **Mock File:** `mock-data/grievances.json`
- **Proposed Endpoint:** `PROPOSED — not in contract` (GET/PUT `/api/admin/grievances/:grievanceId/respond`)
- **Current Handling:** Fully mock-only. List renders from JSON, and state updates are in-memory.

### 4. Broadcast Notifications
- **Feature Name:** Broadcast notifications
- **What the UI Needs:** Ability for admins to broadcast system-wide or targeted alerts to passengers/staff.
- **Mock File:** `mock-data/notifications.json`
- **Proposed Endpoint:** `PROPOSED — not in contract` (POST `/api/admin/notifications/broadcast`)
- **Current Handling:** Read-only viewing of standard notifications works based on shared contract, but broadcasting is handled in-memory.

### 5. Ground Reports (Crowd & Cleanliness)
- **Feature Name:** Live crowd and cleanliness reports
- **What the UI Needs:** Data from station nodes regarding live crowd densities and cleanliness status.
- **Mock File:** `mock-data/crowd-reports.json`, `cleanliness-reports.json`
- **Proposed Endpoint:** `PROPOSED — not in contract` (GET `/api/admin/reports/ground`)
- **Current Handling:** Rendered read-only using mock data.

### 6. Dashboard Summary Stats
- **Feature Name:** Dashboard summary stats endpoint
- **What the UI Needs:** High-level summary metrics (active trains, total revenue, pending grievances, etc.) for the main dashboard.
- **Mock File:** N/A (Computed client-side)
- **Proposed Endpoint:** `PROPOSED — not in contract` (GET `/api/admin/dashboard/stats`)
- **Current Handling:** The UI currently aggregates this data manually on the client side by making multiple calls to various mock services.

### 7. Admin Profile Settings
- **Feature Name:** Admin profile and change-password
- **What the UI Needs:** Allowing the logged-in admin to update their own profile and credentials.
- **Mock File:** N/A (UI placeholder only)
- **Proposed Endpoint:** `PROPOSED — not in contract` (GET/PUT `/api/admin/profile`)
- **Current Handling:** Visual placeholder only; no functional state mutation.
