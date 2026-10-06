# Project Overview: Railway Reservation & Management System

## 1. Executive Summary

The **Railway Reservation & Management System** is an end-to-end web-based software platform engineered for both **passenger ticketing** and **railway operational management**. Developed as a comprehensive college Database Management System (DBMS) project, it balances a realistic enterprise architectural pattern with clear, maintainable modular boundaries suited for multi-team collaborative engineering.

The system is organized into three distinct role-based environments:
1. **Passenger / User Portal**: Public-facing ticketing, journey planning, profile management, cancellations, TDRs, and grievance tracking.
2. **Staff / TC Portal**: Operational duties, PNR/ticket verification, coach boarding & no-show processing, vacancy/RAC promotion, delay reporting, on-spot fine management, crowd assessment, cleanliness tracking, and incident escalation.
3. **Admin Portal**: Complete master data management (trains, routes, stations, platforms, coaches, seats, quotas, fare structures), system-wide reservation inspection, revenue/occupancy analytics, audit logs, and notification dispatch.

> **Important Scope Boundary**:
> Food Ordering / Pantry Management is strictly **OUT OF SCOPE** for this project per project leadership direction. No food-ordering tables, APIs, or mock fixtures are part of this system.

---

## 2. Project Architecture & Build Order

To enable seamless parallel development across multiple student engineering teams, the project follows a strict three-phase build methodology:

```
┌────────────────────────────────────────────────────────┐
│ Phase 1: Foundation & Contracts (CURRENT STAGE)        │
│ - Common Data Schema & Naming Conventions              │
│ - REST API Contract Specifications                     │
│ - Normalized Relational Data Mapping                   │
│ - Shared Consistent Mock Datasets                      │
└──────────────────────────┬─────────────────────────────┘
                           │
                           ▼
┌────────────────────────────────────────────────────────┐
│ Phase 2: Frontend Engineering (3 Independent Teams)   │
│ - Team 1: Passenger / Public Website                   │
│ - Team 2: Staff / Ticket Collector (TC) Dashboard     │
│ - Team 3: Administrator Dashboard                      │
│ * Built 100% against common mock-data fixtures         │
└──────────────────────────┬─────────────────────────────┘
                           │
                           ▼
┌────────────────────────────────────────────────────────┐
│ Phase 3: Backend & Database Integration                │
│ - Normalized MySQL Schema (3NF/BCNF)                   │
│ - Express/Node or Python/Django/FastAPI Backend API   │
│ - Drop-in replacement: Mock JSON ──> Backend REST API  │
└────────────────────────────────────────────────────────┘
```

By decoupling the frontend from the database via strict **Data Contracts** and **API Specifications**, all three frontend teams can work simultaneously without blocking on backend development or creating incompatible schemas.

---

## 3. The Three User Roles

| Role | Access Entry Point | Account Creation Method | Primary Responsibilities |
| :--- | :--- | :--- | :--- |
| **PASSENGER** | Public Web Portal / Login Screen | Self-registration via public signup form | Search trains, check seat availability, reserve tickets across quotas, make payments, download e-tickets, cancel tickets, file TDRs, manage saved passenger lists, log grievances, track train delays. |
| **STAFF** (TC / Station Staff) | Dedicated Staff Login | Created & assigned by Administrator | Train/station duty assignments, passenger chart verification, scan/verify PNR & ID proofs, mark boarded/no-show, report vacant berths for RAC promotion, collect fines, report crowd/cleanliness, log emergency incidents. |
| **ADMIN** | Dedicated Admin Login | Pre-seeded / Master Administrator | Manage all master entities (stations, trains, routes, schedules, coaches, seats, fares, quotas), oversee user accounts, inspect any reservation, process TDR refunds, analyze operational reports, review audit logs. |

---

## 4. Key Architectural & Business Principles

1. **Zero Schema Drift**: Every frontend team uses the exact property names (e.g., `trainNumber`, `journeyDate`, `pnr`) defined in [DATA_SCHEMA.md](file:///c:/Users/Rohan/Desktop/dbms%20pbl/docs/DATA_SCHEMA.md). No arbitrary property renaming is allowed.
2. **Segmented Seat Integrity**: In railway systems, a seat can be booked multiple times on the same date **only if the journey segments do not overlap**. Any overlapping allocation of the same physical seat must be strictly rejected.
3. **Single Canonical Fare Formula**:
   $$\text{Total Fare} = \text{Base Fare} + \text{Reservation Charge} + \text{Tatkal Charge} + \text{Insurance} + \text{GST} - \text{Concession}$$
   where $\text{Base Fare} = \text{Segment Distance} \times \text{Class Base Rate}$.
4. **Stateless Payment Tracking**: Sensitive credit card or banking information is never handled or stored. The system records only payment mode, amount, gateway transaction ID, and strict payment states (`PENDING`, `SUCCESS`, `FAILED`).
5. **Two-Phase Booking with Temporary Hold**: Seats are held temporarily upon entering passenger details with a timer (e.g., 10 minutes). A booking transitions to `PAYMENT_PENDING` and confirms only on gateway `SUCCESS`. Expired or failed sessions automatically release the seat hold.
6. **Per-Passenger Notification Log**: Critical events (ticket confirmation, RAC/WL progression, train delays, platform shifts, emergency alerts) generate durable individual notification records for target passengers.

---

## 5. College DBMS Pedagogy & Scope

This project is tailored for academic evaluation in a Database Management Systems course:
- Emphasizes **relational normalization** (Third Normal Form / BCNF), composite foreign keys, referential integrity, indexing, views, and stored procedures/triggers for ticket allocations.
- Avoids over-engineered enterprise bloat (e.g., unnecessary microservice distributed meshes, heavy Kubernetes configs, complex third-party SaaS dependencies).
- Prioritizes clarity, consistency, and standard REST principles that 20 engineering students can master and present with confidence.
