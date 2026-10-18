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
   │ Dashboard       │         │ Operations (TC) │         │ Dashboard       │
   └─────────────────┘         └─────────────────┘         └─────────────────┘
```

---

## 2. Public / Visitor Flow (Before Login)

Visitors accessing the application landing page can perform read-only queries and information lookups without authentication:
1. **Search Trains**:
   - Query trains by Source Station (`sourceStationId`), Destination Station (`destinationStationId`), and Journey Date (`journeyDate`) within the booking window (7 days ahead, a system setting per BR-B1).
   - **Running-Day Verification (BR-B1a)**: Each train has designated running days (`MON` through `SUN`) defining when it leaves its origin station. When a passenger selects their boarding station and boarding date, the system subtracts the stop's `day_offset` to determine the train's origin departure date. If the train does not operate on that origin date's day of week, the query returns `TRAIN_NOT_RUNNING` and the train is hidden from search results.
   - Timetable calculation: Scheduled arrival/departure date-time at any intermediate stop = origin date + `day_offset` days + stop clock time.
   - View running schedules, classes offered, and general fare estimates.
2. **Train Schedule Lookup**:
   - Enter a train number or name to view all scheduled stops, arrival/departure times, halts, day offsets, and distance from origin.
3. **PNR Enquiry**:
   - Enter a 10-digit PNR to view current ticket status (`CONFIRMED`, `RAC`, `WAITING_LIST`, `CANCELLED`). Shows both boarding date and origin departure date.
4. **Track Your Train (Live Running Status)**:
   - Check real-time train location, current station, platform number, and operational delay in minutes.
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
  - Generates a record in `USER_ACCOUNT` with `role = "PASSENGER"`, `account_status = "ACTIVE"`, and `aadhaar_verified = false` by default.
  - Users can complete Aadhaar verification to raise their monthly booking limit from 12 to 24 PNRs (BR-B15) and unlock Tatkal booking access (BR-Q3, BR-Q6).
- **Role Logins**:
  - **Passenger Login**: Validates credentials against users with `role = "PASSENGER"`.
  - **Staff / TC Login**: Validates credentials against users with `role = "STAFF"`. Staff log in using employee ID and access specific shift duties (`TRAIN_DUTY`, `STATION_DUTY`, `COUNTER_DUTY`, `MAINTENANCE_DUTY`).
  - **Admin Login**: Validates credentials against users with `role = "ADMIN"`.
  *(Frontend note: This can be implemented as a unified login page with role-detection or as clean role tabs).*
- **Shared Counter Account**:
  - Station walk-in passengers without personal user accounts are processed under the designated system account `COUNTER_WALKIN` (BR-CB3).

---

## 4. Passenger Dashboard Flow

### 4.1 Ticket Booking Flow (6-Step Lifecycle)

The ticket booking process follows a rigorous sequential state machine:

```
[1. Search Trains]
   ├── Select: From Station, To Station, Boarding Date (within 7-day window)
   ├── System applies Running-Day Check (BR-B1a): Origin Date = Boarding Date - day_offset
   └── Class Preference & Quota (GENERAL, LADIES, TATKAL, SENIOR_CITIZEN, DIVYAANG)
            │
            ▼
[2. Search Results & Quota Evaluation]
   ├── Filter: Departure time, train type, available seats only
   ├── Quota Fallback Notice with Consent (BR-Q13):
   │   └── If LADIES, SENIOR_CITIZEN, or DIVYAANG has no seats: prompt user with
   │       formal advisory; on CONTINUE, quota falls back to GENERAL (requested_quota retained)
   ├── Choose passenger count (1 to 6, or max 4 for Tatkal) together with class and quota
   ├── Verify Monthly Ticket Limit (BR-B15: 12 tickets per calendar month, or 24 if Aadhaar-verified; settings MAX_TICKETS_PER_MONTH and MAX_TICKETS_PER_MONTH_AADHAAR_VERIFIED; counted by booking date, includes cancelled, excludes FAILED; COUNTER_WALKIN exempt)
   └── Action: Select Class & Quota -> Proceed
            │  (10-minute Seat Hold starts upon entering Step 3)
            ▼
[3. Passenger Details & Seat Hold Initiation]
   ├── Active 10-minute Seat Hold starts (BR-B2): checked again for monthly ticket limit (BR-B15, error MONTHLY_LIMIT_EXCEEDED); reserves counts as CONFIRMED, then RAC, then WL
   ├── Select Boarding Station (can differ from source if intermediate, within 30 min rule BR-B11)
   ├── Add Passengers: Select from Saved Master List OR Add New (1-6 passengers; max 4 for Tatkal)
   │   ├── Name, Age, Gender, ID Proof Type & Reference Number, Disability Type & Proof
   │   └── Mandatory Validation: At least one adult (age >= 18) per PNR (BR-Q15, else NO_ADULT_PASSENGER)
   ├── Concession: DIVYAANG active (with valid disability certificate/UDID); SENIOR inactive; no Student/Medical
   ├── Booking Preferences:
   │   ├── Auto-upgrade to higher class if vacant at chart time (BR-S6)
   │   ├── Book only if all berths are confirmed (BR-B6, else NOT_ALL_CONFIRMED)
   │   ├── Berth Condition: optional tick "Book only if preferred berth type is given" (BR-B6a, stored as berth_condition flag on booking; works in SL, 3A, 2A, 1A; if any passenger would not get preferred berth type LOWER, MIDDLE, UPPER, SIDE_LOWER, SIDE_UPPER, or would be RAC or WL, whole booking is rejected with BERTH_PREFERENCE_NOT_MET and all reserved counts are released; eligible senior citizens count as preferring LOWER)
   │   └── Preferred Berth (LOWER, MIDDLE, UPPER, SIDE_LOWER, SIDE_UPPER; seniors auto-assigned LOWER per BR-S2)
   ├── Optional Travel Insurance toggle (flat 0.45 per passenger, BR-F9)
   └── Contact Phone & Email
            │
            ▼
[4. Booking Summary & Fare Breakdown]
   ├── Review Train, Route, Passenger Roster, and Timings
   ├── Detailed Fare Breakdown per passenger line (Section 6):
   │   Base Fare (min 100 km distance slab) - Concession (on Base Fare only)
   │   + Reservation Charge + Superfast Charge (Rajdhani/Shatabdi/Duronto)
   │   + Tatkal Charge (30% AC, 10% non-AC) + Dynamic Tatkal Surcharge (if BR-F11 enabled)
   │   + GST (5% for AC classes) + Optional Insurance (0.45 flat)
   │   (Total rounded to 2 decimal places half-up per passenger line, BR-B13)
   ├── Active Seat Hold Countdown Timer (10 minutes)
   └── Action: Create Booking locks availability row and sets State to PAYMENT_PENDING with 10-digit PNR
            │
            ▼
[5. Payment Gateway Processing (Razorpay TEST Mode, BR-B7)]
   ├── Backend creates Razorpay order for exact total fare; test checkout modal opens
   ├── Modes: Credit Card, Debit Card, UPI, Net Banking (CASH reserved for counter bookings)
   ├── Backend verifies Razorpay signature cryptographically
   ├── Outcome A: SUCCESS (Signature Valid & Within Hold Timer)
   │   └── Transition to Step 6 (allocate coach/seat, queue positions, issue e-ticket)
   ├── Outcome B: FAILED / CANCELLED / TIMEOUT (Hold Expired)
   │   └── Release reserved seat counts, mark booking FAILED
   └── Outcome C: Late Payment After Hold Expiry (BR-B14)
       └── Booking remains FAILED, no seat assigned; automatic full refund (including insurance)
           created with reason PAYMENT_AFTER_EXPIRY (PENDING -> PROCESSED), STATUS_UPDATE notification
            │
            ▼
[6. Confirmation & E-Ticket]
   ├── PNR Generation (10-digit unique identifier)
   ├── Booking Status: CONFIRMED / RAC / WAITING_LIST (status equals weakest passenger status, BR-B10)
   ├── Assigned Coach & Seat Numbers (for CONFIRMED/RAC; queue positions for RAC/WL)
   ├── E-ticket shows both Boarding Date and Origin Departure Date
   └── Download / Print E-Ticket view and BOOKING_CONFIRMATION in-app notification
```

### 4.2 Booking Status Progression & Auto-Upgrade Outcomes
A completed payment results in one of the following official statuses:
- `CONFIRMED`: Passenger allocated confirmed coach and berth (e.g., `B1 / 23 / LOWER`).
- `RAC` (Reservation Against Cancellation): Passenger allocated shared seating space on a `SIDE_LOWER` berth (up to two RAC passengers per side-lower berth, BR-S5), eligible for promotion to full berth upon cancellations, no-shows, or chart finalization.
- `WAITING_LIST` (WL): Passenger holds a waitlist queue token (e.g., `WL-12`), not yet assigned a physical seat.
- `CANCELLED`: Passenger or administrator cancelled the booking.
- `FAILED`: Payment processing error, hold timeout, or late payment post-expiry.
- **Auto-Upgrade & Old-Class Promotion Flow (BR-S6, BR-W4)**:
  - At chart preparation (8 hours before origin departure), passengers who opted for auto-upgrade are promoted one class up (`SL` → `3A`, `3A` → `2A`, `2A` → `1A`, `CC` → `EC`) in booking order without extra charge if vacant berths exist.
  - Crucially, the vacated seat in the lower class immediately initiates promotion in that old class (`BR-W4`): lowest-numbered RAC passenger moves to CONFIRMED, and lowest-numbered WL passenger moves to RAC in the same atomic operation.

### 4.3 Passenger "My Account" Sub-modules
1. **Profile Management**: View personal details, verify Aadhaar status, update registered phone and email address.
2. **Passenger Master List**: Pre-save frequently travelling family/friends (Name, Age, Gender, ID Proof Type & Reference, Disability Type, Berth Preference) for 1-click inclusion during booking. Concessions are selected per booking and not permanently stored on passenger profiles (BR-C10).
3. **Booking History**:
   - List active and completed journeys with full PNR details.
   - **Ticket Cancellation (Section 8)**: Full cancellation or selective per-passenger cancellation. Online cancellation closes 8 hours before origin departure at chart preparation time. Refund calculated from origin departure clock (BR-R1, BR-R2):
     - More than 72 hours before origin departure: Flat minimum deduction only (1A/EC: 240, 2A: 200, 3A/CC: 180, SL: 120, 2S: 60).
     - 72 to 24 hours: 25% deduction (not less than flat minimum).
     - 24 to 8 hours: 50% deduction (not less than flat minimum).
     - Less than 8 hours: Online cancellation closed; no voluntary refund.
     - RAC/WL cancellations before chart get full refund minus clerkage (60 per passenger, BR-R5). Confirmed Tatkal tickets receive no voluntary refund (BR-R6). Insurance premium is non-refundable on voluntary cancellation.
     - Every cancellation immediately triggers the promotion pipeline (BR-W4, BR-W5, BR-W6) and creates a refund record (`PENDING` → `PROCESSED`).
   - **File TDR (Ticket Deposit Receipt - Section 9)**: Formal refund claims when the **railway is at fault**. Filed per passenger with administrative verification. Valid reason codes:
     1. `TRAIN_DELAYED_OVER_3_HOURS`: Train delayed > 180 minutes at boarding station and passenger did not travel. Filed before train actually departs. Verified automatically against schedule `delay_minutes`. Full fare refund.
     2. `TRAIN_DIVERTED`: Train diverted and passenger does not want to travel or destination/boarding station omitted. Filed before departure. Full fare refund.
     3. `CLASS_DOWNGRADED`: Passenger accommodated in lower class and chooses not to travel. Deadline: 72 hours after actual arrival, requires TC certificate. Full fare refund.
     4. `AC_FAILURE`: AC failure in AC coach. Deadline: 72 hours after actual arrival, requires TC certificate. Refund of fare difference to lower class.
     5. `COACH_NOT_ATTACHED`: Booked coach missing or detached. Deadline: 72 hours after actual arrival, requires TC certificate. Full fare refund.
     6. `TRAIN_TERMINATED_SHORT`: Train journey terminated short of destination. Deadline: 72 hours after actual arrival, requires TC certificate. Refund for unused distance.
     *(Note: Train cancellations require no TDR and are refunded in full automatically per BR-R10. Missed connections are out of scope for version 1 per BR-T9).*
4. **My Grievances**: File complaints under standard categories (`TICKETING`, `TRAIN_CLEANLINESS`, `STATION_CLEANLINESS`, `STAFF_BEHAVIOUR`, `SECURITY`, `REFUND`, `OTHER`), view official admin responses, and monitor resolution status.
5. **Support / Helpdesk**: Frequently asked questions, ticketing policies, refund rules, and grievance escalation pathways.

---

## 5. Counter Booking Flow (Station Walk-in Ticketing, Section 12)

Railway staff on `COUNTER_DUTY` can issue tickets for walk-in passengers directly at physical station booking windows:

```
[1. Walk-in Passenger Arrival]
   └── Staff verifies destination, boarding date, class, quota, and passenger count
            │
            ▼
[2. Availability & Quota Check]
   ├── Follows all standard online business rules: 7-day window, running days, quotas
   └── If passenger has registered account: book under their userId;
       If walk-in passenger has no account: book under shared COUNTER_WALKIN account (BR-CB3)
            │
            ▼
[3. Passenger Details Entry & 10-Minute Hold]
   ├── 10-minute hold starts; seat count reserved identically to online engine (BR-CB2)
   ├── At least one adult passenger required (BR-Q15)
   └── Tatkal at counter requires physical Aadhaar proof entry and simulated OTP (BR-CB5)
            │
            ▼
[4. Payment Collection at Counter]
   ├── Payment modes: CASH, UPI, CREDIT_CARD, DEBIT_CARD (BR-CB4)
   ├── No Razorpay gateway window; staff confirms physical collection of funds
   └── Payment record created with method = CASH/UPI/etc. and marked SUCCESS
            │
            ▼
[5. Ticket Printing & Dispatch]
   ├── PNR generated, coach and seat numbers allocated
   ├── Physical computerized paper ticket printed for passenger
   ├── No in-app notification sent for COUNTER_WALKIN bookings (printed ticket serves as receipt)
   └── Shift reconciliation: counter booking counts and cash collected logged to audit trail (BR-CB7)
```

- **Counter Ticket Cancellation (BR-CB6, BR-R11)**: Counter-booked tickets must be cancelled at station booking counters by staff of the same station (or by an admin). Cancellation refunds are disbursed immediately in `CASH`.

---

## 6. Staff / Operations Dashboard Flow

Staff members manage train operations, passenger verification, ground-level reporting, and maintenance:

1. **Dashboard Home / Today's Duty Assignment (BR-ST2)**:
   - Displays current assignment based on duty type:
     - `TRAIN_DUTY`: Assigned train, run date, assigned coaches, and passenger chart.
     - `STATION_DUTY`: Assigned station and platform coverage.
     - `COUNTER_DUTY`: Assigned counter window, booking interface, and cash collection ledger.
     - `MAINTENANCE_DUTY`: Assigned coach repair or platform maintenance inspection roster.
2. **Passenger List / Chart Verification**:
   - View coach-wise passenger manifest for the assigned train segment, populated from the immutable `CHART_SNAPSHOT` generated 8 hours prior to origin departure (BR-B12a).
   - Search passenger by PNR or seat number.
3. **PNR / Ticket Verification (BR-ST3)**:
   - Verify ticket details and physical identity proof against ticket manifest.
   - For concession passengers, inspect disability certificate/UDID.
   - Record verification outcome: `VALID`, `INVALID`, or `MISMATCH`.
4. **Boarding & No-Show Management (BR-ST4, BR-ST5)**:
   - Mark passengers as `BOARDED` or `NO_SHOW`.
   - Crucial Constraint: A passenger with an open delay TDR cannot be marked `BOARDED` (BR-ST4, BR-T6).
   - Recording a `NO_SHOW` releases the occupied berth for remaining stops and immediately triggers promotion of RAC/WL passengers in priority order (BR-W4).
5. **Vacancy Management & RAC Promotion**:
   - Inspect unoccupied berths during the run.
   - Reallocate newly vacant lower berths with priority to senior citizens, persons with disabilities, and pregnant women holding middle/upper berths (BR-ST6, BR-S3).
   - Promote eligible RAC passengers to full berths.
6. **Fine Management (On-Spot Penalties, BR-ST7)**:
   - Issue penalty receipts for offenses: `TICKETLESS_TRAVEL`, `UNAUTHORIZED_CLASS`, etc.
   - Record Passenger Name, ID Reference, Offense Reason, Amount (within admin configured min/max range), and Payment Status (`PAID` / `UNPAID`).
7. **Train & Platform Status Updates (BR-D1)**:
   - Log minute delay (`delay_minutes`) on the schedule, update live train arrival/departure timings, and record platform changes.
8. **Crowd & Cleanliness Reporting (BR-ST8)**:
   - **Crowd Reports**: Record platform head counts and crowd severity levels (`LOW`, `MODERATE`, `HIGH`, `OVERCROWDED`).
   - **Cleanliness Reports**: Log coach or platform sanitary issues (`TOILET_DIRTY`, `LITTER`, `WATER_SHORTAGE`, etc.) with real-time status tracking.
9. **Emergency & Incident Reporting (BR-ST9)**:
   - Log critical incidents (`MEDICAL_EMERGENCY`, `THEFT`, `TECHNICAL_FAULT`, `SECURITY`) with severity level (`LOW` to `CRITICAL`). `HIGH` and `CRITICAL` incidents immediately dispatch system-wide alerts to all admins.

---

## 7. Maintenance Management Flow (Section 13)

Maintenance workflows ensure coach roadworthiness and station platform safety, directly intersecting passenger booking rights:

```
[1. Maintenance Task Initiation]
   ├── Created by staff on MAINTENANCE_DUTY or Administrators (BR-M1)
   └── Scope: Targets EXACTLY ONE Coach OR EXACTLY ONE Platform
            │
            ▼
[2. Task Classification & Scheduling]
   ├── Task Types: CLEANING, REPAIR, AC_SERVICE, INSPECTION, SAFETY_CHECK (BR-M2)
   ├── Status Progression: OPEN ──> IN_PROGRESS ──> COMPLETED (or CANCELLED)
   └── Every state change is stamped with staffId, timestamp, and audit trail
            │
            ▼
[3. Operational Impact & Passenger Safeguards]
   ├── Coach Out of Service (BR-M3):
   │   ├── Admin marks coach OUT_OF_SERVICE for a specific run
   │   ├── Passengers notified via STATUS_UPDATE notification
   │   └── Passengers may file TDR (reason: COACH_NOT_ATTACHED) for full refund,
   │       OR Admin reallocates them to vacant seats in the same class via booking override
   ├── Return to Service Gate (BR-M4):
   │   └── Coach cannot return to service until REPAIR or AC_SERVICE task is COMPLETED
   └── Platform Unavailability (BR-M5):
       └── Platform with open maintenance task is flagged unavailable; warning raised on route assignment
```

---

## 8. Chart Preparation Architecture & Lifecycle (BR-B12a, BR-B16)

There is ONE chart time per run, and version 1 has no current booking window. At chart time (8 hours before origin departure per BR-B12 / settings table), the system works on each run in this exact order as one all-or-nothing step:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         CHART PREPARATION SEQUENCE                          │
│                   (At Chart Time: One All-or-Nothing Step)                  │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
                                       ▼
 (1) LOCK NEW BOOKINGS & CANCEL RUNNING HOLDS (BR-B12a)
     - Lock run against new bookings (error CHART_PREPARED)
     - Online cancellation closes
     - Cancel all running holds for this run; any late payment follows BR-B14 full refund
                                       │
                                       ▼
 (2) MOVE UNSOLD QUOTA SEATS TO GENERAL & PROMOTE (BR-Q11)
     - Move unsold LADIES, TATKAL, SENIOR_CITIZEN, and DIVYAANG seats to GENERAL
     - Run GENERAL promotion on them (section 5)
                                       │
                                       ▼
 (3) AUTO-UPGRADE IN BOOKING ORDER (BR-S6, BR-W4)
     - Auto-upgrade ticked passengers in booking order (SL->3A, 3A->2A, 2A->1A, CC->EC)
     - Each freed seat in the old class immediately promotes in its old class (BR-S6, BR-W4)
                                       │
                                       ▼
 (4) CANCEL & FULLY REFUND WAITLISTED PASSENGERS (BR-W8)
     - Cancel and fully refund passengers still waitlisted (excluding insurance) to original payment
     - Passengers still on RAC may travel and share a berth (BR-S5)
                                       │
                                       ▼
 (5) SAVE THE CHART SNAPSHOT (BR-B12a)
     - Save chart snapshot: one row per passenger into CHART_SNAPSHOT:
       PNR, passenger number, coach, seat, berth, status, boarding and destination stops, concession flag
     - Snapshot is written once and never changed; ticket collectors and chart screens read it
```

---

## 9. Admin Dashboard Flow

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
   - View/search registered passengers, verify Aadhaar flags, toggle account status (`ACTIVE` / `SUSPENDED`).
   - Create new Staff/TC accounts, update employee details, assign duty shifts (`TRAIN_DUTY`, `STATION_DUTY`, `COUNTER_DUTY`, `MAINTENANCE_DUTY`).
2. **Train, Route & Station Management**:
   - Master setup of Stations (codes, names, cities, states, `platform_count` with platform rows 1 to count, BR-A9).
   - Train configuration: Train number, short name, display name, type (`RAJDHANI`, `SHATABDI`, `DURONTO`, `EXPRESS`, `VANDE_BHARAT`), source, destination, running days (`MON` through `SUN`).
   - Route Stop Sequence: Ordered stops with arrival, departure, `day_offset` (0, 1, 2), distance from origin (km), and platform number.
   - Dated Schedule Generation: Train running schedules with status, chart preparation timestamps, and delay overrides.
3. **Coach, Seat, Fare & Quota Management**:
   - Define coaches per train according to standardized train layouts (`RAJDHANI`, `SHATABDI`, `DURONTO`, `EXPRESS`).
   - Configure distance-based fare slabs per class, reservation flat charges, superfast charges, Tatkal percentages, GST %, and Divyangjan concession rates.
   - Admin control over Settings table (booking window, hold timer, clerkage, monthly limits, dynamic fare switch).
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

## 10. Scope Boundaries (Strict Exclusions)

To ensure clarity for all development teams:
- ❌ **Food Ordering / Pantry Services**: Strictly omitted from all dashboards, data models, and API endpoints per project decisions (BR-1, section 16 item 13).
- ❌ **Third-Party Real Payment Gateways**: Uses Razorpay in TEST mode only (BR-B7); no real money is ever processed.
- ❌ **External SMS/Email Gateways**: Notifications are rendered directly within the in-app notification center via MongoDB.
