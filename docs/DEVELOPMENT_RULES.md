# Development Rules & Team Engineering Standards

## 1. Core Rule: Zero-Drift Contract Compliance

This project is partitioned among three independent frontend teams and a future backend/database team. To ensure seamless integration without painful refactoring or UI redesigns, all developers must treat the **Data Schema** and **API Contract** as immutable standards.

```
┌────────────────────────────────────────────────────────┐
│                   SINGLE SOURCE OF TRUTH               │
│      docs/DATA_SCHEMA.md  &  docs/API_CONTRACT.md      │
└──────────────────────────┬─────────────────────────────┘
                           │
         ┌─────────────────┼─────────────────┐
         ▼                 ▼                 ▼
   Frontend Team 1   Frontend Team 2   Frontend Team 3
 (Passenger Portal)  (Staff Dashboard) (Admin Dashboard)
         │                 │                 │
         └─────────────────┼─────────────────┘
                           ▼
                  Future Backend API
                & MySQL Database Engine
```

---

## 2. Naming Conventions (Strict Disallowances)

Field names must be written in canonical **camelCase** matching the exact schema definition. **No team is allowed to invent synonyms or abbreviations.**

| Canonical Name (MANDATORY) | Prohibited Variations (FORBIDDEN) | Entity |
| :--- | :--- | :--- |
| `trainNumber` | `trainNo`, `train_number`, `number`, `tNo` | `TRAIN` |
| `trainName` | `name`, `train_name`, `tName` | `TRAIN` |
| `journeyDate` | `travelDate`, `dateOfJourney`, `doj`, `date` | `SCHEDULE`, `BOOKING` |
| `pnr` | `pnrNumber`, `pnr_no`, `pnrCode`, `ticketPnr` | `BOOKING`, `TDR` |
| `bookingStatus` | `status`, `bkgStatus`, `ticketStatus` | `BOOKING` |
| `passengerStatus` | `status`, `travelStatus`, `chartStatus` | `BOOKING_PASSENGER` |
| `totalFare` | `fare`, `amount`, `ticketPrice`, `price` | `BOOKING` |
| `availableSeats` | `seatsLeft`, `availSeats`, `available` | `AVAILABILITY` |
| `coachNumber` | `coach`, `coachNo`, `coach_num` | `COACH`, `BOOKING_PASSENGER` |
| `seatNumber` | `seat`, `seatNo`, `berthNumber` | `SEAT`, `BOOKING_PASSENGER` |
| `berthType` | `berth`, `type`, `seatType` | `SEAT`, `BOOKING_PASSENGER` |
| `classType` | `class`, `travelClass`, `coachClass` | `COACH`, `BOOKING`, `AVAILABILITY` |
| `paymentStatus` | `status`, `payState`, `txnStatus` | `PAYMENT` |
| `delayMinutes` | `delay`, `delayTime`, `lateBy` | `SCHEDULE` |

---

## 3. Strict Enumeration Rules

Never use arbitrary lowercase or space-separated strings for enum fields. Always use uppercase snake-case identifiers exactly as listed below:

- **Roles**: `"PASSENGER"`, `"STAFF"`, `"ADMIN"`
- **Booking Status**: `"PAYMENT_PENDING"`, `"CONFIRMED"`, `"RAC"`, `"WAITING_LIST"`, `"CANCELLED"`, `"FAILED"`
- **Passenger Status**: `"CONFIRMED"`, `"RAC"`, `"WAITING_LIST"`, `"CANCELLED"`, `"BOARDED"`, `"NO_SHOW"`
- **Payment Status**: `"PENDING"`, `"SUCCESS"`, `"FAILED"`
- **Quota**: `"GENERAL"`, `"LADIES"`, `"TATKAL"`, `"SENIOR_CITIZEN"`, `"DIVYAANG"`
- **Classes**: `"1A"`, `"2A"`, `"3A"`, `"SL"`, `"CC"`, `"2S"`, `"EC"`
- **Berth Types**: `"LOWER"`, `"MIDDLE"`, `"UPPER"`, `"SIDE_LOWER"`, `"SIDE_UPPER"`, `"WINDOW"`, `"AISLE"`, `"NO_BERTH"`

---

## 4. Team Task Allocation & Responsibilities

### Team 1: Passenger / Public Website
- Public Landing Page (Train search, Schedule timetable, Live track, PNR enquiry).
- Passenger Registration & Login.
- 6-Step Ticket Booking Flow with Seat Hold timer.
- E-Ticket View & Print / Download layout.
- My Account: Profile, Saved Passenger Master List, Booking History, Ticket Cancellation, TDR Filing, and Grievances.

### Team 2: Staff / TC Operations Dashboard
- Staff Login & Duty Overview (Assigned train/date/coach or station).
- Passenger Chart & Manifest inspection.
- PNR Verification with ID proof validation (`VALID`, `INVALID`, `MISMATCH`).
- Real-time Boarding tracking (`BOARDED`, `NO_SHOW`).
- Vacancy Management & RAC Promotion trigger.
- On-Spot Fine issuance (`TICKETLESS_TRAVEL`, etc.) with payment logging.
- Train Delay logging, Platform updates, Crowd reports, Cleanliness tickets, and Incident escalation.

### Team 3: Administrator Dashboard
- Admin Login & System Overview metrics.
- User & Staff Account Management (Create staff, suspend abusive passenger accounts).
- Master Data Management (CRUD on Trains, Stations, Routes, Schedules, Coaches, Seats, Platforms, Fares, Quotas).
- System-Wide Reservation Oversight (Search any PNR, manual override/cancel).
- TDR Claim Review and Refund Approval.
- Analytical Reports (Revenue breakdown, Occupancy %, Delay analysis, Complaints log, Audit trail).

---

## 5. How Frontend Teams Must Consume Mock Data

### Phase 2 Architecture (Mock Layer)
In the current phase, frontends consume data directly from `/mock-data/*.json`. To prepare for seamless backend integration:

1. **Centralized Service Wrapper Pattern**:
   Do **NOT** hardcode `require('../../../mock-data/trains.json')` deep inside UI components. Instead, create service abstraction modules in your frontend:
   ```javascript
   // services/trainService.js
   import trainsMock from '../../mock-data/trains.json';

   const USE_MOCK = true; // Set to false when backend API is live

   export const searchTrains = async (sourceId, destId, date) => {
     if (USE_MOCK) {
       // Filter mock data locally simulating API response
       return trainsMock.filter(t => t.sourceStationId === sourceId && t.destinationStationId === destId);
     }
     const res = await fetch(`/api/trains/search?sourceStationId=${sourceId}&destinationStationId=${destId}&journeyDate=${date}`);
     const body = await res.json();
     return body.data;
   };
   ```

2. **No Custom Incompatible Fields**:
   If a UI view requires computed data (e.g. `formattedTime = "05:30 PM"`), compute it inside the component or view-helper. Do **NOT** modify the underlying JSON file to add non-standard fields.

---

## 6. Business Logic Rules to Enforce in Frontend Simulation

### 6.1 Canonical Fare Computation
When computing fares during Booking Step 4, follow this formula strictly:
$$\text{Base Fare} = \text{Route Distance (km)} \times \text{Class Base Rate}$$
$$\text{Subtotal} = \text{Base Fare} + \text{Reservation Charge} + \text{Tatkal Charge (if quota is TATKAL)} + \text{Insurance Premium (if selected)}$$
$$\text{Total Fare} = \text{Subtotal} + \text{GST (5% for AC classes)} - \text{Concession Discount (if applied)}$$

### 6.2 Seat Hold Expiry
- When a user enters Passenger Details, trigger a 10-minute countdown timer.
- If the countdown reaches `00:00` without payment completion, redirect to a timeout screen and release the temporary booking state.

### 6.3 Payment Security Simulation
- Never prompt or accept real bank card numbers or CVVs.
- Accept mock inputs and emit only a mock `gatewayTransactionId` upon successful checkout.

### 6.4 Segmented Seat Integrity Rule
- A seat is occupied if another passenger's stop range intersects with the current booking's stop sequence range. Always respect non-overlapping allocations.

---

## 7. Change Management Procedure

If a team identifies an unaddressed requirement or a missing data attribute:
1. **Do NOT unilaterally alter mock JSON files.**
2. Raise the proposed schema change with the Project Leader.
3. Once approved, the change is updated in [DATA_SCHEMA.md](file:///c:/Users/Rohan/Desktop/dbms%20pbl/docs/DATA_SCHEMA.md), [API_CONTRACT.md](file:///c:/Users/Rohan/Desktop/dbms%20pbl/docs/API_CONTRACT.md), and the shared mock files.
4. All three teams pull the updated contract simultaneously.
