# Frontend Engineering Guide

Welcome to the frontend directory of the **Railway Reservation & Management System**.

## 1. Frontend Team Assignments

Frontend development is divided among three independent engineering tracks:

```
frontend/
├── passenger/    # Team 1: Public Website & Passenger Portal
├── staff/        # Team 2: Staff / Ticket Collector (TC) Operations
└── admin/        # Team 3: Administrator Dashboard & Master Data Management
```

---

## 2. Team Scope & Deliverables

### Track 1: Passenger / Public Portal (`frontend/passenger`)
- **Public Entry**: Landing page, Train Search widget, Timetable lookup, Live train tracker, PNR enquiry.
- **Authentication**: Passenger Self-Registration and Passenger Login.
- **6-Step Booking Lifecycle**:
  1. Train Search & Filters
  2. Search Results & Class/Quota Selection
  3. Passenger Details (Saved master list integration + 10-minute hold timer)
  4. Booking Summary & Dynamic Fare Breakdown
  5. Mock Payment Gateway (Card, UPI, Netbanking simulation)
  6. Confirmation & Printable E-Ticket
- **My Account**: Profile settings, Passenger Master List (CRUD), Booking History, Ticket Cancellation with penalty preview, TDR Filing, Grievances ticket tracker, Support page.

### Track 2: Staff / TC Dashboard (`frontend/staff`)
- **Authentication**: Staff / TC Login.
- **Duty Dashboard**: Current roster (assigned train/date/coach or station/platform).
- **Chart & Verification**: Real-time passenger manifest, PNR lookup, ID proof validation (`VALID`, `INVALID`, `MISMATCH`).
- **Boarding Tracking**: Toggle passenger status (`BOARDED`, `NO_SHOW`).
- **Vacancy & Promotions**: Identify unoccupied berths and trigger RAC/WL promotion.
- **On-Spot Fine Management**: Issue penalties for ticketless travel, unbooked luggage, etc.
- **Operations & Reporting**: Log train delays, update platform numbers, report crowd densities, submit cleanliness tickets, and escalate safety incidents.

### Track 3: Administrator Dashboard (`frontend/admin`)
- **Authentication**: Dedicated Admin Login.
- **System Overview**: Live operational metrics, active trains, revenue summary, system alerts.
- **User & Staff Management**: View passengers, block/unblock accounts, register railway staff, assign duty shifts.
- **Master Data Management (MDM)**: Complete CRUD screens for Stations, Platforms, Trains, Routes (stop sequences), Schedules, Coaches, Seats, Base Fares, and Quota allocations.
- **Reservation Oversight**: Global PNR search, ticket overrides, and administrative cancellations.
- **TDR Adjudication**: Review passenger refund claims, approve/reject with refund amount.
- **Analytics & Reports**: Interactive charts and data tables for Revenue, Occupancy %, Cancellation Trends, Fine Collections, Punctuality/Delays, and Grievance metrics.
- **Audit Logs**: Forensic timeline of all administrative system edits.

---

## 3. How to Consume Mock Data

All teams **MUST** read from `/mock-data/*.json`. To ensure future compatibility when the backend REST API is introduced:

### Central Service Wrapper Pattern
Create a dedicated `services/` directory within your portal. Wrap all data access inside async functions:

```javascript
// Example: src/services/trainService.js
import trainsData from '../../../mock-data/trains.json';
import stationsData from '../../../mock-data/stations.json';

const USE_MOCK = true; // Toggle to false when backend API is live

export async function searchTrains(sourceStationId, destinationStationId) {
  if (USE_MOCK) {
    // Simulate network delay
    await new Promise(r => setTimeout(r, 200));
    return trainsData.filter(
      t => t.sourceStationId === Number(sourceStationId) && 
           t.destinationStationId === Number(destinationStationId)
    );
  }

  const response = await fetch(`/api/trains/search?sourceStationId=${sourceStationId}&destinationStationId=${destinationStationId}`);
  const json = await response.json();
  return json.data;
}
```

---

## 4. Mandatory Development Rules

1. **Exact Field Names**: Use only the field names documented in `docs/DATA_SCHEMA.md` (e.g. `trainNumber`, `journeyDate`, `pnr`). Do not rename or create aliases.
2. **Uppercase Enums**: Values like `CONFIRMED`, `WAITING_LIST`, `ACTIVE`, `GENERAL` must remain exact uppercase strings.
3. **No Food Ordering**: Do NOT create any UI elements, tabs, or screens for Food Ordering.
4. **Standard Fare Formula**:
   $$\text{Total} = \text{Base} + \text{Reservation} + \text{Tatkal} + \text{Insurance} + \text{GST} - \text{Concession}$$
5. **Hold Timer**: Implement the 10-minute hold countdown on the booking summary screen.
