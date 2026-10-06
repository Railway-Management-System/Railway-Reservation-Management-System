# Railway Reservation & Management System

> **A Comprehensive Academic DBMS Project**  
> *Designed for scalable, multi-team frontend development backed by a robust relational database foundation.*

---

## 1. Project Objective

The **Railway Reservation & Management System** is a full-featured web-based platform catering to both passenger ticketing and operational railway administration. Built to demonstrate enterprise-grade Database Management System (DBMS) concepts, the project emphasizes Third Normal Form (3NF) relational design, segmented seat integrity, role-based workflows, and standardized REST API contracts.

---

## 2. Project Status & Roadmap

| Stage | Status | Description |
| :--- | :--- | :--- |
| **CURRENT STAGE: Phase 1 & 2** | **ACTIVE** | **Project Foundation & Frontend Development**: Common data schema, REST API contract, relational model, and relationally consistent mock dataset. Three frontend teams develop independently. |
| **FUTURE STAGE: Phase 3** | **PLANNED** | **Backend & MySQL Database Integration**: Express / Node.js or Python backend server, MySQL 3NF database schema, DDL migrations, ACID transactions, stored procedures, and triggers. |

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
  5. Mock Payment Gateway (Card, UPI, Netbanking simulation)
  6. Booking Confirmation & Printable E-Ticket
- **Passenger Account Management**: Profile editing, Saved Passenger Master List (CRUD), Booking History, Ticket Cancellation (with refund estimation), TDR (Ticket Deposit Receipt) filing, and Grievance redressal tracking.

### 3.2 Staff / Ticket Collector (TC) Portal
- **Duty Dashboard**: Live duty assignment (assigned train/date/coach or station/platform).
- **Chart & Verification**: Real-time passenger chart inspection, PNR enquiry, ID proof verification (`VALID`, `INVALID`, `MISMATCH`).
- **Boarding Tracking**: Real-time status toggles (`BOARDED`, `NO_SHOW`).
- **Vacancy & Promotion**: Real-time vacant berth tracking and triggering RAC / Waiting List promotions.
- **On-Spot Fine Management**: Issuing penalty receipts for ticketless or unauthorized travel.
- **Operations & Ground Reporting**: Train delay logging, platform number updates, crowd density reporting, coach cleanliness logs, and incident/emergency escalation.

### 3.3 Administrator Portal
- **Master Data Management (MDM)**: Full CRUD interfaces for Stations, Platforms, Trains, Routes (ordered stop sequences), Dated Schedules, Coaches, Seats, Fares, and Quotas.
- **User & Staff Management**: Passenger account inspection (suspend/activate), staff onboarding, and duty scheduling.
- **Reservation Oversight**: Global PNR search, ticket overrides, and administrative cancellations.
- **TDR Adjudication**: Review passenger refund claims, approve/reject, and process refunds.
- **Analytics & Reports**: Interactive revenue summaries, route occupancy %, cancellation trends, fine collections, train punctuality, and complaint turnaround times.
- **Forensic Audit Logs**: Timestamped audit trails documenting administrative changes (`oldValue` vs `newValue`).

> **Scope Note**:  
> Food Ordering / Pantry Management is strictly **OUT OF SCOPE** and omitted across all data models, mock data, and UI flows.

---

## 4. Repository Structure

```
/
├── README.md                              # Main project documentation & guide
│
├── docs/                                  # Canonical specifications (Single Source of Truth)
│   ├── PROJECT_OVERVIEW.md                # System concept, scope, and college DBMS context
│   ├── SYSTEM_FLOW.md                     # Flowcharts and 6-step booking lifecycle
│   ├── DATA_SCHEMA.md                     # Data dictionary, field types, enums, nullability
│   ├── DATA_RELATIONSHIPS.md              # ER diagram, foreign keys, seat integrity rule
│   ├── API_CONTRACT.md                    # REST endpoints, request/response structures
│   └── DEVELOPMENT_RULES.md               # Strict team rules, naming standards, zero-drift policy
│
├── mock-data/                             # Relationally consistent JSON development dataset
│   ├── users.json                         # 7 users across PASSENGER, STAFF, ADMIN
│   ├── passengers.json                    # Saved passenger master list records
│   ├── staff.json                         # Staff profiles, designations, station assignments
│   ├── stations.json                      # 12 major railway stations (NDLS, BCT, HWH, etc.)
│   ├── trains.json                        # 10 trains (Rajdhani, Shatabdi, Vande Bharat, etc.)
│   ├── routes.json                        # Ordered route stops with timings and distances
│   ├── schedules.json                     # Dated train runs with delay status
│   ├── coaches.json                       # Train coaches (1A, 2A, 3A, SL, CC, EC)
│   ├── seats.json                         # Coach seats with berth types
│   ├── availability.json                  # Class and quota availability counts
│   ├── bookings.json                      # Sample bookings across all test states
│   ├── booking-passengers.json            # Line-item passenger tickets
│   ├── payments.json                      # Payment records with gateway references
│   ├── cancellations.json                 # Processed cancellations with charges & refunds
│   ├── tdr.json                           # TDR refund claims
│   ├── notifications.json                 # Per-user alert logs
│   ├── grievances.json                    # Passenger complaints and resolutions
│   ├── fines.json                         # Staff-issued penalty records
│   ├── incidents.json                     # Safety and operational incident reports
│   ├── crowd-reports.json                 # Platform crowd density metrics
│   ├── cleanliness-reports.json           # Coach and station hygiene tickets
│   └── audit-logs.json                    # Admin forensic action audit trail
│
├── frontend/                              # Frontend workspaces for the 3 engineering teams
│   └── README.md                          # Frontend setup and service layer guidelines
│
├── backend/                               # Reserved for Phase 3 REST API implementation
│   └── README.md                          # Backend architecture guidelines
│
└── database/                              # Reserved for Phase 3 MySQL schema & migrations
    └── README.md                          # Relational DB design and SQL migration plan
```

---

## 5. Development Workflow for Frontend Teams

The three frontend teams develop their respective dashboards independently by consuming mock data from `mock-data/`:

```
Frontend Team Workspace ──> Centralized Service Layer ──> mock-data/*.json
                                        │
                                        ▼ (Phase 3 Drop-in)
                                   Backend REST API
```

### Golden Development Rules:
1. **Never Rename Fields**: Always use exact camelCase property names defined in [docs/DATA_SCHEMA.md](file:///c:/Users/Rohan/Desktop/dbms%20pbl/docs/DATA_SCHEMA.md) (e.g. `trainNumber`, `journeyDate`, `pnr`).
2. **Never Change Enums**: Use exact uppercase enum values (`CONFIRMED`, `WAITING_LIST`, `ACTIVE`, `GENERAL`, etc.).
3. **Use Centralized Service Layers**: Isolate mock JSON imports inside `services/` wrappers so switching to the live REST API requires changing only one toggle variable.
4. **Enforce Seat Integrity**: A seat is legally bookable more than once on the same date only if the travel stop sequence segments do not overlap:
   $$\max(\text{Start}_A, \text{Start}_B) < \min(\text{End}_A, \text{End}_B)$$
5. **Enforce the Canonical Fare Formula**:
   $$\text{Total Fare} = \text{Base Fare} + \text{Reservation Charge} + \text{Tatkal Charge} + \text{Insurance} + \text{GST} - \text{Concession}$$
