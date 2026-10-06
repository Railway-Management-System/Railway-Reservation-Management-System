# System Flow & Navigation Architecture

## 1. System Navigation Overview

The Railway Reservation & Management System is designed with three distinct portals governed by role-based access control (RBAC).

```
                            ┌────────────────────────┐
                            │ Public Website Landing │
                            │ (Unauthenticated View) │
                            └───────────┬────────────┘
                                        │
                         ┌──────────────┴──────────────┐
                         ▼                             ▼
                ┌──────────────────┐          ┌──────────────────┐
                │ Passenger Signup │          │ Portal Login     │
                │ (Public Access)  │          │ (Unified / Role) │
                └────────┬─────────┘          └────────┬─────────┘
                         │                             │
                         └──────────────┬──────────────┘
                                        │ Authenticated Session
            ┌───────────────────────────┼───────────────────────────┐
            ▼                           ▼                           ▼
   ┌─────────────────┐         ┌─────────────────┐         ┌─────────────────┐
   │ PASSENGER ROLE  │         │   STAFF ROLE    │         │   ADMIN ROLE    │
   │ Dashboard       │         │ Dashboard (TC)  │         │ Dashboard       │
   └─────────────────┘         └─────────────────┘         └─────────────────┘
```

---

## 2. Public / Visitor Flow (Before Login)

Visitors accessing the application landing page can perform read-only queries and information lookups without authentication:
1. **Search Trains**:
   - Query trains by Source Station (`sourceStationId`), Destination Station (`destinationStationId`), and Journey Date (`journeyDate`).
   - View running schedules, classes offered, and general fare estimates.
2. **Train Schedule Lookup**:
   - Enter a train number or name to view all scheduled stops, arrival/departure times, halts, and distance from origin.
3. **PNR Enquiry**:
   - Enter a 10-digit PNR to view the current ticket status (`CONFIRMED`, `RAC`, `WAITING_LIST`, `CANCELLED`).
4. **Track Your Train (Live Running Status)**:
   - Check real-time train location, current station, platform number, and delay in minutes.
5. **Connecting Journey Search (Search-Only)**:
   - Explore two-leg journeys between station pairs with intermediate junction transfers.
6. **Alerts & Announcements**:
   - View public advisories regarding route cancellations, platform changes, or weather delays.
7. **Registration Entry**:
   - Dedicated link to Passenger Self-Registration (Public).

---

## 3. Authentication & Entry Points

- **Passenger Registration (`POST /api/auth/passenger/register`)**:
  - Available publicly.
  - Requires: Full Name, Email, Phone Number, Password.
  - Generates a record in `USER` with `role = "PASSENGER"`.
- **Role Logins**:
  - **Passenger Login**: Validates credentials against users with `role = "PASSENGER"`.
  - **Staff / TC Login**: Validates credentials against users with `role = "STAFF"`.
  - **Admin Login**: Validates credentials against users with `role = "ADMIN"`.
  *(Frontend note: This can be implemented as a unified login page with role-detection or as clean role tabs).*

---

## 4. Passenger Dashboard Flow

### 4.1 Ticket Booking Flow (6-Step Lifecycle)

The ticket booking process follows a rigorous sequential state machine:

```
[1. Search Trains]
   ├── Select: From Station, To Station, Date, Class Preference, Quota
   └── Inclusivity: Option for Divyaang / Concession
            │
            ▼
[2. Search Results]
   ├── Filter: Departure time, train type, available seats only
   ├── Sort: Duration, fare, departure time
   └── Action: Select Class & Quota -> Proceed
            │  (Temporary Seat Hold starts here)
            ▼
[3. Passenger Details]
   ├── Select Boarding Station (can differ from source if intermediate)
   ├── Add Passengers: Select from Saved Master List OR Add New
   │   (Name, Age, Gender, ID Proof Type/Number, Disability Type, Berth Preference)
   ├── Booking Preferences:
   │   ├── Auto-upgrade to higher class if vacant
   │   ├── Book only if all berths are confirmed
   │   └── Preferred Coach ID
   ├── Optional Travel Insurance toggle
   └── Contact Phone & Email
            │
            ▼
[4. Booking Summary & Fare Breakdown]
   ├── Review Train, Route, Passenger Roster, and Timings
   ├── Detailed Fare Breakdown:
   │   Base Fare + Resv Charge + Tatkal Surcharge + Insurance + GST - Concession
   ├── Active Seat Hold Countdown Timer (e.g., 10 minutes)
   └── Booking State changes to: PAYMENT_PENDING
            │
            ▼
[5. Payment Gateway Simulation]
   ├── Choose Mode: Credit Card, Debit Card, UPI, Net Banking
   ├── Outcome A: SUCCESS ──> Transition to Step 6
   └── Outcome B: FAILED / TIMEOUT ──> Release Seat Hold, mark status FAILED
            │
            ▼
[6. Confirmation & E-Ticket]
   ├── PNR Generation (10-digit unique identifier)
   ├── Booking Status: CONFIRMED / RAC / WAITING_LIST
   ├── Assigned Coach & Seat Numbers (for CONFIRMED/RAC)
   └── Download / Print E-Ticket view
```

### 4.2 Booking Status Progression Outcomes
A completed payment results in one of the following official statuses:
- `CONFIRMED`: Passenger allocated confirmed coach and berth (e.g., `B1 / 23 / LOWER`).
- `RAC` (Reservation Against Cancellation): Passenger allocated seating space in an RAC coach, eligible for promotion to full berth upon cancellations or TC chart finalization.
- `WAITING_LIST` (WL): Passenger holds a waitlist token (e.g., `WL-12`), not yet assigned a seat.
- `CANCELLED`: Passenger or administrator cancelled the booking.
- `FAILED`: Payment processing error or hold timeout.

### 4.3 Passenger "My Account" Sub-modules
1. **Profile Management**: View personal details, update registered phone and email address.
2. **Passenger Master List**: Pre-save frequently travelling family/friends (Name, Age, Gender, ID Proof, Berth Preference) for 1-click inclusion during booking.
3. **Booking History**:
   - List active and completed journeys with full PNR details.
   - **Ticket Cancellation**: Full cancellation or selective per-passenger cancellation. Displays cancellation charges and computed refund amount prior to confirmation.
   - **File TDR (Ticket Deposit Receipt)**: For passengers unable to travel due to train cancellation, extreme delay (>3 hrs), coach AC failure, or missed connection. Tracks TDR review and refund status.
4. **My Grievances**: File complaints under standard categories (`TICKETING`, `TRAIN_CLEANLINESS`, `STATION_CLEANLINESS`, `STAFF_BEHAVIOUR`, `SECURITY`, `REFUND`), view official admin responses, and monitor resolution status.
5. **Support / Helpdesk**: Frequently asked questions, ticketing policies, refund rules, and grievance escalation pathways.

---

## 5. Staff / Ticket Collector (TC) Dashboard Flow

Staff members manage train operations, passenger verification, and ground-level reporting:

1. **Dashboard Home / Today's Duty**:
   - Displays current assignment: Assigned Train, Date, Assigned Coaches, or Station Platform Duty with shift timings.
2. **Passenger List / Chart Verification**:
   - View coach-wise passenger manifest for the assigned train segment.
   - Search passenger by PNR or seat number.
3. **PNR / Ticket Verification**:
   - Verify physical ticket or digital QR against Passenger ID proof (`AADHAAR`, `PAN`, `PASSPORT`, etc.).
   - Record verification status: `VALID`, `INVALID`, or `MISMATCH`.
4. **Boarding & No-Show Management**:
   - Mark passengers as `BOARDED` or `NO_SHOW`.
   - Recording a `NO_SHOW` releases the occupied berth back to the operational vacancy pool.
5. **Vacancy Management & RAC Promotion**:
   - Inspect unoccupied berths during the run.
   - Reallocate newly vacant berths to eligible `RAC` or `WAITING_LIST` passengers in priority sequence.
6. **Fine Management (On-Spot Penalties)**:
   - Issue fines for ticketless travel, travel in unauthorized class, smoking/nuisance, or unbooked excess luggage.
   - Record Passenger Name, ID Reference, Offense Reason, Amount, and Payment Status (`PAID` / `UNPAID`).
7. **Train & Platform Status Updates**:
   - Update live train arrival/departure timings, report delays in minutes, and confirm platform allocations.
8. **Crowd & Cleanliness Reporting**:
   - **Crowd Reports**: Record platform head counts and crowd severity levels (`LOW`, `MODERATE`, `HIGH`, `OVERCROWDED`).
   - **Cleanliness Reports**: Log coach or platform sanitary issues (`TOILET_DIRTY`, `LITTER`, `WATER_SHORTAGE`, etc.) with real-time status tracking.
9. **Emergency & Incident Reporting**:
   - Log critical incidents (`MEDICAL_EMERGENCY`, `THEFT`, `TECHNICAL_FAULT`, `SECURITY`) with severity level (`LOW` to `CRITICAL`) to notify the central control room.

---

## 6. Admin Dashboard Flow

The Admin Dashboard provides full operational oversight and Master Data Management (MDM):

```
                                  Admin Dashboard
                                         │
    ┌────────────────┬───────────────────┼───────────────────┬────────────────┐
    ▼                ▼                   ▼                   ▼                ▼
[User & Staff] [Trains & Routes]  [Coaches & Seats]  [Reservations]    [Reports & Logs]
 ├── Passenger  ├── Station MDM    ├── Coach Types    ├── PNR Search    ├── Revenue
 │   Accounts   ├── Train MDM      ├── Berth Layouts  ├── Mod/Cancel    ├── Occupancy
 └── Staff/TC   ├── Route Stops    ├── Quota Rules    ├── TDR Audits    ├── PNR Trends
     Duties     └── Schedules      └── Fare Matrices  └── Refunds       └── Audit Logs
```

1. **User & Staff Management**:
   - View/search registered passengers, toggle account status (`ACTIVE` / `SUSPENDED`).
   - Create new Staff/TC accounts, update employee details, assign duty shifts and stations.
2. **Train, Route & Station Management**:
   - Master setup of Stations (codes, names, cities, states) and Platforms.
   - Train configuration: Train number, name, type (`RAJDHANI`, `SHATABDI`, `VANDE_BHARAT`, `EXPRESS`), source, destination, running days.
   - Route Stop Sequence: Ordered stops with arrival, departure, distance (km), and platform.
   - Dated Schedule Generation: Train running schedules with status and delay overrides.
3. **Coach, Seat, Fare & Quota Management**:
   - Define coaches per train (`1A`, `2A`, `3A`, `SL`, `CC`, `EC`, `2S`).
   - Seat configurations per coach with berth types (`LOWER`, `UPPER`, `MIDDLE`, `SIDE_LOWER`, etc.).
   - Configure distance-based fare rates per class, reservation surcharges, Tatkal premiums, GST %, and concession percentages.
4. **Reservation & Availability Monitoring**:
   - System-wide search across any PNR.
   - Override ticket states or execute admin cancellations with refund triggers.
   - Live view of seat availability, RAC, and WL counters across trains and dates.
5. **Operational Reports & Analytics**:
   - Revenue analytics grouped by train, class, and time period.
   - Occupancy rates per train route.
   - Fine collection reports and breakdown of passenger complaints.
6. **Audit Logs & System Notifications**:
   - Immutable audit trail of administrative modifications (`action`, `entityType`, `oldValue`, `newValue`, `timestamp`).
   - Broadcast system notifications and critical alerts to users or staff.

---

## 7. Scope Boundaries (Strict Exclusions)

To ensure clarity for all development teams:
- ❌ **Food Ordering / Pantry Services**: Strictly omitted from all dashboards, data models, and API endpoints.
- ❌ **Third-Party Real Payment Gateways**: Replaced by a mock gateway endpoint with predictable `SUCCESS` and `FAILED` responses.
- ❌ **External SMS/Email Gateways**: Notifications are rendered directly within the in-app notification center via `mock-data/notifications.json`.
