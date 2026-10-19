# Database Seed Data & Demonstration Architecture

This directory contains the cleaned, relationally normalized, and validated dataset artifacts for the **Railway Reservation & Management System**, formatted strictly according to [docs/DATA_SCHEMA.md](../../docs/DATA_SCHEMA.md) and [docs/BUSINESS_RULES.md](../../docs/BUSINESS_RULES.md).

All data files were generated using deterministic Node.js scripts in `database/seed/` with a **fixed random seed**, guaranteeing 100% reproducibility across re-runs.

---

## 1. Directory Structure

```
database/
├── seed/                        # Generator and validation engine
│   ├── helpers.js               # Common utilities, CSV writers, Mulberry32 PRNG
│   ├── step1_clean.js           # Cleans stations, trains, routes, users, passengers
│   ├── step2_remap.js           # Remaps mock operational logs, staff, fines, incidents
│   ├── step3_generate.js        # Generates coaches, seats, schedules, inventory, bookings
│   └── validate.js              # Comprehensive integrity and business rule validator
│
└── seed-data/
    ├── demo_fill_plan.csv       # Approved 69-run fill plan spread across 7 days
    ├── mysql/                   # 37 MySQL relational CSV tables (UTF-8 with headers)
    │   ├── STATION.csv          # 158 stations with title case display names & platform counts
    │   ├── PLATFORM.csv         # 888 platform rows (1 to platform_count per station)
    │   ├── TRAIN.csv            # 60 trains with real display names and running day lists
    │   ├── ROUTE_STOP.csv       # 536 route stops with exact day_offset (0, 1, 2)
    │   ├── USER_ACCOUNT.csv     # 50,008 user accounts (50k synthetic + 8 demo/staff accounts)
    │   ├── SAVED_PASSENGER.csv  # 75,000 saved passenger master list profiles
    │   ├── SEAT_CLASS.csv       # 7 travel classes (1A, 2A, 3A, SL, CC, EC, 2S)
    │   ├── COACH.csv            # 828 coach entities mapped to trains
    │   ├── SEAT.csv             # 55,800 physical seat and berth assignments
    │   ├── FARE.csv             # 28 distance-slab fare rules per class
    │   ├── CONCESSION_RULE.csv  # 13 concession rules (DIVYAANG active, SENIOR inactive)
    │   ├── REFUND_RULE.csv      # 4 cancellation deduction slabs
    │   ├── TDR_RULE.csv         # 6 official TDR railway-fault reason codes
    │   ├── SETTING.csv          # 13 global system configuration constants
    │   ├── TRAIN_SCHEDULE.csv   # 350 calendar runs across 7 journey dates (18-24 Oct 2026)
    │   ├── RUN_COACH_STATUS.csv # 4,818 coach operational readiness rows
    │   ├── SCHEDULE_CLASS_INVENTORY.csv # 1,015 class-level quota availability trackers
    │   ├── STAFF.csv            # 3 railway operational personnel profiles
    │   ├── STAFF_ASSIGNMENT.csv # Shift rosters (TRAIN_DUTY, STATION_DUTY, COUNTER_DUTY)
    │   ├── ADMIN.csv            # 1 administrative super-user profile
    │   ├── REPORT.csv           # 2 operational reports
    │   ├── SEAT_HOLD.csv        # Active 10-minute temporary seat hold records
    │   ├── BOOKING.csv          # 14,748 PNR bookings
    │   ├── PASSENGER_BOOKING.csv# 34,282 passenger ticket lines with exact fare breakdowns
    │   ├── RESERVATION.csv      # 34,282 seat allocation and waitlist queue states
    │   ├── PAYMENT.csv          # 14,747 Razorpay TEST mode payment transactions
    │   ├── CANCELLATION.csv     # 442 voluntary cancellation records
    │   ├── TDR_FILING.csv       # 1 approved TDR claim with verification audit
    │   ├── REFUND.csv           # 443 processed refund transactions
    │   ├── CHART_SNAPSHOT.csv   # Immutable chart manifest snapshot
    │   ├── TICKET_VERIFICATION.csv # Conductor handheld ticket verification log
    │   ├── FINE.csv             # 3 on-spot penalty receipts
    │   ├── INCIDENT.csv         # 2 station and onboard incident records
    │   ├── MAINTENANCE.csv      # 2 coach and platform maintenance work orders
    │   ├── CROWD_REPORT.csv     # 3 station platform crowd telemetry logs
    │   ├── CLEANLINESS_REPORT.csv # 3 onboard and station sanitary logs
    │   └── AUDIT_LOG.csv        # 3 forensic change trail entries
    │
    └── mongodb/                 # 5 MongoDB NoSQL operational collections (JSON)
        ├── live_train_status.json   # Real-time train delay telemetry
        ├── notifications.json       # In-app passenger and staff alerts
        ├── complaints.json          # Passenger grievances with polymorphic fields
        ├── activity_logs.json       # User login, staff duty, and API audit events
        └── raw_gateway_replies.json # Raw Razorpay webhook callback payloads
```

---

## 2. Master Table Row Counts Summary

| Entity / Table Name | Row Count | Source / Basis |
| :--- | :--- | :--- |
| `STATION` | **158** | `stations_158_final.xlsx` (IDs 1–158; platform count raised to 3 at 8 stations) |
| `PLATFORM` | **888** | Generated platforms (rows 1 to `platform_count` per station) |
| `TRAIN` | **60** | `final_trains_60.xlsx` (IDs 101–160; 23 train types corrected; real display names) |
| `ROUTE_STOP` | **536** | `final_routes_536.xlsx` (IDs 1001–1536; `day_offset` 0, 1, 2; zero backwards time) |
| `USER_ACCOUNT` | **50,008** | `users_synthetic_2.csv` (50,000 synthetic + Rahul Sharma + 3 Staff + 1 Admin + COUNTER_WALKIN) |
| `SAVED_PASSENGER` | **75,000** | `passengers_synthetic_2.csv` (IDs 7–75006; unique ID references; realistic gender) |
| `SEAT_CLASS` | **7** | Standard classes: `1A`, `2A`, `3A`, `SL`, `CC`, `EC`, `2S` |
| `COACH` | **828** | Real layouts (Rajdhani 15 coaches, Shatabdi 11 coaches, Duronto 15 coaches) |
| `SEAT` | **55,800** | Physical seats/berths mapped to coaches (`LOWER`, `MIDDLE`, `UPPER`, `SIDE_LOWER`, etc.) |
| `FARE` | **28** | Distance-slab fare matrices across all 7 classes (Section 6) |
| `CONCESSION_RULE` | **13** | Divyangjan (active, 75%/50%/25%) and Senior Citizen (inactive, 0%) rules |
| `REFUND_RULE` | **4** | Cancellation deduction slabs (>72h, 72-24h, 24-8h, <8h) |
| `TDR_RULE` | **6** | Section 9 official TDR railway fault codes |
| `SETTING` | **13** | Global constants (`BOOKING_WINDOW_DAYS = 7`, `HOLD_MINUTES = 10`, etc.) |
| `TRAIN_SCHEDULE` | **350** | Calendar runs for 7 dates (18–24 Oct 2026) strictly on active `running_days` |
| `RUN_COACH_STATUS` | **4,818** | Coach operational readiness records |
| `SCHEDULE_CLASS_INVENTORY` | **1,015** | Quota, RAC (10%), and WL (25%) availability trackers per run and class |
| `BOOKING` | **14,748** | PNR bookings strictly conforming to `demo_fill_plan.csv` |
| `PASSENGER_BOOKING` | **34,282** | Itemized ticket lines (~30,000 target met; min 1 adult; exact fare math) |
| `RESERVATION` | **34,282** | Confirmed non-overlapping seat allocations, RAC positions, and WL positions |
| `PAYMENT` | **14,747** | Razorpay TEST mode transactions |
| `CANCELLATION` | **442** | ~3% voluntary cancellations with slab deductions |
| `REFUND` | **443** | Processed refunds for cancellations and approved TDR |
| `CHART_SNAPSHOT` | **180** | Immutable manifest snapshot for run 119 on 2026-10-19 |
| `STAFF` | **3** | TC Vikram Singh, Station Supt Sunita Rao, Platform Insp Ramesh Nair |
| `STAFF_ASSIGNMENT` | **3** | Shift assignments (`TRAIN_DUTY`, `STATION_DUTY`, `COUNTER_DUTY`) |
| `ADMIN` | **1** | Master Administrator Rajesh Gupta (`SUPER_ADMIN`) |
| `TICKET_VERIFICATION` | **1** | Sample handheld ticket validation log |
| `FINE` | **3** | Remapped mock penalty receipts |
| `INCIDENT` | **2** | Remapped emergency incident reports |
| `MAINTENANCE` | **2** | Coach and platform maintenance work orders |
| `CROWD_REPORT` | **3** | Remapped station crowd density records |
| `CLEANLINESS_REPORT` | **3** | Remapped coach/platform sanitary reports |
| `AUDIT_LOG` | **3** | Forensic audit log entries |
| `REPORT` | **2** | Revenue and occupancy operational reports |

---

## 3. How to Re-Run the Generator & Validation

From the repository root:

```bash
# Step 1: Clean raw datasets and generate baseline tables
node database/seed/step1_clean.js

# Step 2: Remap mock operational logs and staff records
node database/seed/step2_remap.js

# Step 3: Generate coaches, seats, schedules, inventory, and fill plan bookings
node database/seed/step3_generate.js

# Step 4: Validate all integrity rules, foreign keys, and constraints
node database/seed/validate.js
```

Or execute everything sequentially in one command:
```bash
node database/seed/step1_clean.js && node database/seed/step2_remap.js && node database/seed/step3_generate.js && node database/seed/validate.js
```

### Rolling the Booking Window Forward
The script `database/seed/step3_generate.js` uses dynamic date parameterization (`dates` array). To roll the 7-day window forward in the future, simply update the base date string; the deterministic random generator guarantees that identical fill plans and booking distributions are reproduced seamlessly.
