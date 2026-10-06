# Backend Architecture & Integration Guide

Welcome to the backend directory of the **Railway Reservation & Management System**.

> **Current Stage Note**:
> Backend implementation is scheduled for **Phase 3** after the three frontend teams complete their interface implementations against the common mock dataset.

---

## 1. Planned Backend Architecture

The backend will serve as the RESTful API bridge between the frontends and the relational MySQL database:

```
┌────────────────────────────────────────────────────────┐
│               Frontend Portals (React / Vite)          │
│         (Passenger, Staff/TC, Admin Dashboards)        │
└──────────────────────────┬─────────────────────────────┘
                           │ HTTP / JSON (REST)
                           ▼
┌────────────────────────────────────────────────────────┐
│                  Backend API Engine                    │
│      (Express.js / Node.js OR Python FastAPI)         │
│  ├── Auth Middleware (JWT Token Verification & RBAC)   │
│  ├── Controllers matching docs/API_CONTRACT.md         │
│  ├── Business Logic (Seat Integrity, Fare Matrix)      │
│  └── Data Access Layer (Connection Pool to MySQL)      │
└──────────────────────────┬─────────────────────────────┘
                           │ SQL Queries & Stored Procedures
                           ▼
┌────────────────────────────────────────────────────────┐
│                   MySQL Relational DB                  │
│               (Normalized 3NF / BCNF)                  │
└────────────────────────────────────────────────────────┘
```

---

## 2. Core Responsibilities & Business Logic

When backend development commences, it must implement:

1. **Authentication & Authorization**:
   - `bcrypt` password hashing for user accounts.
   - Role-Based Access Control (RBAC) middleware verifying roles (`PASSENGER`, `STAFF`, `ADMIN`).
2. **Segmented Seat Integrity Verification**:
   - Enforce segment validation before seat booking:
     A seat $[s_{\text{board}}, s_{\text{dest}})$ is available only if no confirmed booking overlaps the same stop sequence on that date.
3. **Seat Hold Engine**:
   - In-memory or database-backed temporary lock with a 10-minute time-to-live (TTL).
   - Automatic expiry and seat release upon timeout or payment abandonment.
4. **Canonical Fare Calculation Engine**:
   - Dynamic calculation based on route segment distance and class rate tables:
     $$\text{Total Fare} = \text{Base} + \text{Reservation} + \text{Tatkal} + \text{Insurance} + \text{GST} - \text{Concession}$$
5. **Chart Finalization & RAC Promotion**:
   - Trigger automated promotion from `WAITING_LIST` to `RAC` and `RAC` to `CONFIRMED` upon passenger cancellation or no-show marks.

---

## 3. API Contract Adherence

The backend must match every endpoint defined in [docs/API_CONTRACT.md](file:///c:/Users/Rohan/Desktop/dbms%20pbl/docs/API_CONTRACT.md) without deviating in URL path, request body fields, or response schema.
