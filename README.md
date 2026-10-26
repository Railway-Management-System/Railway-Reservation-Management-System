# Railway Reservation & Management System

> **A Comprehensive Academic DBMS Project**  
> *A three-portal railway platform (passenger, staff, admin) backed by a relational MySQL database, stored procedures, triggers, MongoDB and Razorpay test payments.*

---

## 1. Project Objective

The **Railway Reservation & Management System** is a full-featured web-based platform catering to both passenger ticketing and operational railway administration. Built to demonstrate enterprise-grade Database Management System (DBMS) concepts, the project emphasizes Third Normal Form (3NF) relational design, segmented seat integrity, role-based workflows, and standardized REST API contracts.

---

## 2. Project Status

| Stage | Status | Description |
| :--- | :--- | :--- |
| Phase 1 & 2: Foundation and Frontend | **DONE** | Common data schema, REST API contract, relational model, mock dataset, three frontends |
| Phase 3: Backend and Database | **DONE** | Express backend, MySQL 8.0 (37 tables, 5 views, 5 functions, 13 stored procedures, 6 triggers, 5 RANK reports), MongoDB, Razorpay test-mode payments, daily operations simulator |

**Data used by the live system:** 158 stations, 60 trains, 536 route stops, 50,008 users, 75,000 passengers, and 350 train runs per 7-day window. Screens now read from the backend and database. Pages with no backend table (Quotas, Notifications, Reports in the admin portal) are marked **Demo data**.

---

## 3. The Three User Roles & Dashboards

The application is architected around three role-based portals with distinct entry points:

### 3.1 Passenger / User Portal
- **Public Entry & Lookups**: Homepage train search, schedule lookup, live train tracker, and PNR status enquiry.
- **Self-Registration & Login**: Public registration for passenger accounts.
- **6-Step Ticket Booking Flow**:
  1. Train Search (From, To, Date, Class, Quota, Inclusivity)
  2. Search Results (Train listing, fares, availability filters)
  3. Passenger Details (Select from saved master list, auto-upgrade preference, insurance toggle, 10-minute seat hold timer)
  4. Booking Summary (Journey review & itemized fare breakdown)
  5. Payment (Razorpay test mode)
  6. Booking Confirmation & Printable E-Ticket
- **Passenger Account Management**: Profile, Booking History, Ticket Cancellation (with refund estimation), TDR (Ticket Deposit Receipt) filing, and Grievance tracking.

### 3.2 Staff / Ticket Collector (TC) Portal
- **Duty Dashboard**: Live duty assignment (assigned train/date/coach or station/platform).
- **Chart & Verification**: Passenger chart inspection, PNR enquiry, ID proof verification (`VALID`, `INVALID`, `MISMATCH`).
- **Boarding Tracking**: Status toggles (`BOARDED`, `NO_SHOW`). A no-show promotes the next RAC passenger automatically in the database.
- **Vacancy View**: Vacant berth tracking. Promotion is done by the database only, so the Promote button is disabled.
- **Counter Booking and Fines**: Counter tickets and on-spot penalty receipts.
- **Operations & Ground Reporting**: Train delay logging, platform updates, crowd and cleanliness reports, incident escalation.

### 3.3 Administrator Portal
- **Master Data Management**: Stations, Platforms, Trains, Routes, Schedules, Coaches, Seats, Fares.
- **User & Staff Management**: Passenger account inspection, staff and duty scheduling.
- **Reservation Oversight**: Global PNR search and administrative cancellations.
- **TDR Adjudication**: Approve or reject refund claims. Approval runs the same seat-promotion chain as a cancellation.
- **Schedules & Chart Preparation**: Chart preparation removes remaining waiting-list passengers and refunds them fully.
- **Analytics & Reports**: Five RANK reports from `06_reports.sql`.
- **Forensic Audit Logs**: Timestamped audit trail of administrative changes.

> **Scope Note**:  
> Food Ordering / Pantry Management is strictly **OUT OF SCOPE** and omitted across all data models and UI flows.

---

## 4. Repository Structure

```
/
├── README.md                    # This guide
├── docs/                        # Specifications (API_CONTRACT, BUSINESS_RULES, DATA_SCHEMA,
│                                #   DATA_RELATIONSHIPS, DEVELOPMENT_RULES, PROJECT_OVERVIEW,
│                                #   SIMULATOR, SYSTEM_FLOW)
├── datasets/                    # Source data: stations, trains, routes, users, passengers
├── database/                    # MySQL scripts (01_schema ... 07_tests), seed loaders, MongoDB loader
├── backend/                     # Express API (port 5000), scripts: demo:refresh, demo:chain
├── frontend/                    # React + Vite (port 5173); passenger portal in public/user/
└── mock-data/                   # Original mock JSON used in Phase 1 and 2
```

---

## 5. How the System Works (short version)

- **Booking:** the passenger searches a train. The backend asks MySQL. The stored procedure `sp_create_booking` checks quota and rules and holds seats for 10 minutes.
- **Payment (Razorpay, test mode):** the backend reads the fare from the database, never from the browser, and creates a Razorpay order for exactly that amount. After payment, the backend verifies Razorpay's signature. Only then does the database confirm the ticket (`sp_confirm_payment` rejects zero, negative and wrong amounts).
- **Cancellation:** a procedure frees the seat and works out the refund. A trigger then runs `sp_promote_passenger`: first RAC becomes CONFIRMED, first waiting-list passenger becomes RAC.
- **TDR:** the passenger files it, the admin reviews it, and approval refunds and promotes through the same chain.
- **Staff:** a no-show is marked in the database and promotes the next RAC passenger. Chart preparation removes remaining waiting-list passengers and refunds them.
- **Where the rules live:** quota, promotion and refund logic are in SQL (procedures and triggers), not in Node or React.
- **Mock data replaced:** screens used to show made-up data from `mock-data/`. They now call the backend, so they show what is stored in the database.

Rules used everywhere: all date-times are India time strings (`YYYY-MM-DD HH:MM:SS`, never a `Z`), and the API follows `docs/API_CONTRACT.md` exactly.

---

## 6. Development Rules

1. **Never rename fields.** Use the property names in [docs/DATA_SCHEMA.md](docs/DATA_SCHEMA.md) and [docs/API_CONTRACT.md](docs/API_CONTRACT.md).
2. **Never change enums.** Use exact uppercase values (`CONFIRMED`, `WAITING_LIST`, `ACTIVE`, `GENERAL`, etc.).
3. **Keep API calls in service files** so screens never talk to the network directly.
4. **Seat integrity:** a seat can be booked twice on the same date only if the travel segments do not overlap: max(StartA, StartB) < min(EndA, EndB).
5. **Fare formula (per passenger):**
   - Base Fare = Segment Distance (min 100 km) x Class Slab Rate
   - Taxable Amount = (Base Fare - Concession) + Reservation + Superfast + Tatkal + Dynamic Surcharge
   - Total Fare = Taxable Amount + GST + Insurance
   - GST: 5% for AC classes, 0% for non-AC. Insurance: optional flat 0.45 per passenger. Rounded to 2 decimals, half-up.

---

## 7. Running the Project (Local Setup)

**Requirements:** Windows, Node v24, MySQL 8.0 (service `MySQL80`, port 3306), MongoDB (port 27017), and `.env` files in `backend/` and `database/` (never commit them).

### 7.1 Start order (every time)

1. **Check the databases are running** (PowerShell):
   ```
   Get-Service MySQL80
   Get-Service *mongo*
   ```
   Both must say `Running`. If not: `Start-Service <name>` (as administrator).
2. **Stop old servers:**
   ```
   Get-Process node | Stop-Process -Force
   ```
3. **Refresh the demo data** (dates move to today + 6 days):
   ```
   cd backend
   npm run demo:refresh
   npm run demo:chain
   ```
   `demo:chain` builds one train run with a full RAC and waiting-list chain for the cancellation demo and prints the train, date and PNRs. **Write them down.**
4. **Start the backend** (leave the window open; it should say "Server started on port 5000"):
   ```
   cd backend
   npm start
   ```
5. **Start the frontend** (second window):
   ```
   cd frontend
   npm run dev -- --port 5173 --strictPort
   ```
6. Open **http://localhost:5173**.

> Do **not** run `npm run test:all` or `node database/load/run-all.js` after step 3. Both reset the data to the plain seed. If you do, repeat steps 1 to 3.

### 7.2 Troubleshooting

| Problem | Fix |
| :--- | :--- |
| "Cannot reach the server" / "Failed to fetch" | Backend not running, or frontend not on port 5173. Redo steps 2, 4, 5. |
| `EADDRINUSE port 5000` | `Get-Process node \| Stop-Process -Force`, then start the backend again. |
| "No trains found" | Use a date from today to +6 days. Try BCT to NDLS or HWH to NDLS. |
| Page looks old after a code change | Hard refresh: Ctrl+Shift+R. |
| Booking or cancellation says `CHART_PREPARED` | That run departs within 8 hours. Choose a train 2 or more days ahead. |

### 7.3 Demo Logins

| Portal | Login | Password |
| :--- | :--- | :--- |
| Passenger | `rahul.sharma@example.com` | prefilled on the login box |
| Staff / TC | `EMP-TC-101` (prefilled in the ID box) | `StaffPassword123!` |
| Admin | `admin@railways.gov.in` | prefilled on the login box |
| Passenger for the cancellation demo | `user69_4747@example.com` | same as the passenger password **[CHECK]** |

Switching portal: **Sign Out**, open `http://localhost:5173`, click **Sign In**, pick the **Passenger / Staff / Admin** tile.

---

## 8. Live Demo Walkthrough (about 8 to 10 minutes)

**Say first:** *"All three portals use one backend and one MySQL database. The rules (quota, promotion, refund) live in stored procedures and triggers, not in the website code."*

### Step 1: Passenger books a ticket (2 min)
1. Sign in as the passenger. Click **Book Tickets**.
2. Search **BCT to NDLS**, a date 2 or more days ahead, then pick a train and class.
3. Add a passenger, **Reserve & Hold Seats (10 min)**, then **Pay Securely Now** (Razorpay test mode, no real money).
4. Say: *"The backend reads the fare from the database, creates the Razorpay order for exactly that amount, verifies the signature, and only then the database confirms the ticket."*
5. Click **My Bookings** and show the new PNR as CONFIRMED.

### Step 2: Cancellation with RAC and waiting-list chain (2 min)

Prepared by `npm run demo:chain`: Pune-Howrah Duronto Express, train 12221, schedule 1449, travel date 29 Oct 2026, class AC 2 Tier. The class is full: 96 seats confirmed, RAC 10/10, waiting list 24/24.

| What | PNR | Before | After cancelling the CONFIRMED PNR |
| :--- | :--- | :--- | :--- |
| Passenger to cancel (owner `user69_4747@example.com`) | **1293484175** | CONFIRMED | CANCELLED, refund calculated |
| First RAC passenger | **8771225758** | RAC/1 | CONFIRMED |
| First waiting-list passenger | **5888689716** | WL/1 | RAC |

1. Sign in as `user69_4747@example.com`. **My Bookings**, open PNR 1293484175, **Cancel Ticket**, **Confirm Cancellation**. Show the refund estimate. **[CHECK: this PNR must appear in My Bookings. If not, show this step in Workbench with the Group 3 queries.]**
2. Say: *"A stored procedure frees the seat and calculates the refund. A trigger then calls `sp_promote_passenger`: the first RAC passenger becomes CONFIRMED and the first waiting-list passenger becomes RAC. The website only displays the result."*
3. Open **PNR Enquiry** and enter 8771225758, then 5888689716. Show the new statuses (CONFIRMED and RAC).
4. In Workbench, run the inventory check to show 0 mismatches after the promotion.

### Step 3: TDR (1 min)
1. Passenger: **TDR / Refunds**, **+ File TDR**, **Submit TDR**.
2. Admin: **Operations, TDR Adjudication**, Approve. Say: *"Approval releases the seat and runs the same promotion chain."*

### Step 4: Staff portal (2 min)
1. Sign in as staff (`EMP-TC-101`). **Overview**, **Go On Duty**.
2. **Passenger Manifest**: show **Board Passenger** and **Mark No-Show**. Say: *"A no-show is marked in the database and the next RAC passenger is promoted automatically."*
3. **Ticket Scanner**, **Counter Booking**, **Fines & Penalties**: one line each.
4. **Vacancies & RAC**: the Promote button is disabled on purpose, because only the database promotes passengers.

### Step 5: Admin portal (2 min)
1. **Dashboard**: the 5 RANK reports (from `06_reports.sql`).
2. **Operations, Reservations & PNR**: search a PNR.
3. **Trains & Routes, Schedules**: find schedule 1449 and click **Prepare Chart**. Say: *"Chart preparation removes the remaining waiting-list passengers and refunds them fully."* Show the purged count and refund total. Do this **after** Step 2, because it ends the chain.
4. Pages marked **Demo data** (Quotas, Notifications, Reports) have no backend table. Say so honestly if asked.

### Stories to show in MySQL Workbench (clean seed)
The website cannot set the test clock (`@as_of_time`), so show these with the per-group Workbench query files:
- **No-show on boarding**, **approved TDR with the same chain**, and **ladies quota full with GENERAL fallback** (train 146, schedule 1254).
- If a Workbench query fails after `demo:refresh`, run `node database/load/run-all.js`, rerun the query, then run `demo:refresh` and `demo:chain` again and update the PNRs in Step 2.

### Checklist before presenting
- [ ] MySQL80 and MongoDB running
- [ ] `demo:refresh` and `demo:chain` done today, PNRs in Step 2 match the printout
- [ ] Backend says "Server started on port 5000"
- [ ] Frontend open on `localhost:5173`; passenger, staff (`EMP-TC-101`) and admin logins tested
- [ ] PNR 1293484175 visible in My Bookings for `user69_4747@example.com`
- [ ] Schedule 1449 (train 12221, 29 Oct) shows RAC 10/10 and WL 24/24 in the admin Schedules page
- [ ] Workbench open with `USE railway_db;` run
- [ ] Screenshots ready as a backup if the live demo fails