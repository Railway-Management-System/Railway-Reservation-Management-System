# Data Schema Specification

## 1. Introduction & Source of Truth

This document establishes the canonical data dictionary and schema contract for the **Railway Reservation & Management System**. It directly matches the approved ER diagram (`database/FINALx4_Railway Reservation & Management System – ER Diagram.html`) and Section 16 of the Business Rules (`docs/BUSINESS_RULES.md`).

All entities incorporate the real column names, codes, and IDs from the five authoritative datasets in `datasets/`:
- **Stations (158)**: IDs 1 to 158 (`stations_158_final.xlsx`)
- **Trains (60)**: IDs 101 to 160 (`final_trains_60.xlsx`)
- **Routes (536)**: Route stops 1001 to 1536 (`final_routes_536.xlsx`)
- **Users (50,000)**: Accounts 1 to 50000 (`users_synthetic_2.csv`)
- **Passengers (75,000)**: Saved passenger profiles 7 to 75006 (`passengers_synthetic_2.csv`)

Columns required by the business rules that are not present in the raw dataset files are marked **`(new)`**.

---

## 2. Global Enumeration Definitions

### 2.1 User Roles
```json
["PASSENGER", "STAFF", "ADMIN"]
```

### 2.2 User Account Statuses
```json
["ACTIVE", "SUSPENDED", "PENDING"]
```

### 2.3 Booking Statuses
```json
["PAYMENT_PENDING", "CONFIRMED", "RAC", "WAITING_LIST", "CANCELLED", "FAILED"]
```

### 2.4 Passenger & Reservation Statuses
```json
["CONFIRMED", "RAC", "WAITING_LIST", "BOARDED", "NO_SHOW", "CANCELLED"]
```

### 2.5 Payment Statuses
```json
["PENDING", "SUCCESS", "FAILED"]
```

### 2.6 Payment Methods
```json
["CREDIT_CARD", "DEBIT_CARD", "UPI", "NET_BANKING", "CASH"]
```
*(Note: `CASH` is permitted strictly for station counter bookings per BR-CB4).*

### 2.7 Booking Channels
```json
["ONLINE", "COUNTER"]
```

### 2.8 Quota Types
```json
["GENERAL", "LADIES", "TATKAL", "SENIOR_CITIZEN", "DIVYAANG"]
```

### 2.9 Train Classes (`classType` / `class_id`)
```json
["1A", "2A", "3A", "SL", "CC", "EC", "2S"]
```
- `1A`: First Class AC
- `2A`: AC 2 Tier
- `3A`: AC 3 Tier
- `SL`: Sleeper Class
- `CC`: AC Chair Car
- `EC`: Executive Chair Car
- `2S`: Second Sitting *(Defined in system rules, no active train currently assigned 2S in dataset)*

### 2.10 Berth & Seat Types
```json
["LOWER", "MIDDLE", "UPPER", "SIDE_LOWER", "SIDE_UPPER", "WINDOW", "AISLE", "NO_BERTH"]
```

### 2.11 Train Types
```json
["RAJDHANI", "SHATABDI", "DURONTO", "EXPRESS", "VANDE_BHARAT"]
```

### 2.12 Days of the Week (Running Days)
```json
["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"]
```

### 2.13 Concession Categories
```json
["NONE", "DIVYAANG", "SENIOR_CITIZEN"]
```
- `NONE`: Active (Default, 0% discount).
- `DIVYAANG`: Active (75% discount in SL, 2S, 3A, CC; 50% in 1A, 2A; 25% in 3A/CC on Rajdhani, Shatabdi, Duronto; 0% in EC).
- `SENIOR_CITIZEN`: Inactive (0% discount, toggled via setting; lower-berth priority retained per BR-C8).
- **Out of Scope**: `STUDENT` and `MEDICAL` concessions are strictly omitted in version 1 (BR-C3).

### 2.14 Concession Proof Types
```json
["RAILWAY_DIVYANGJAN_ID", "UDID", "CONCESSION_CERTIFICATE"]
```

### 2.15 Disability Types
```json
["NONE", "ORTHOPEDIC", "VISUAL", "HEARING", "MENTAL"]
```

### 2.16 ID Proof Types
```json
["SYNTHETIC_TEST_ID", "AADHAAR", "PAN", "PASSPORT", "VOTER_ID", "DRIVING_LICENSE", "GOVT_ID"]
```

### 2.17 Staff Duty Types
```json
["TRAIN_DUTY", "STATION_DUTY", "COUNTER_DUTY", "MAINTENANCE_DUTY"]
```

### 2.18 Ticket Verification Results
```json
["VALID", "INVALID", "MISMATCH"]
```

### 2.19 TDR Reason Codes (Section 9)
```json
[
  "TRAIN_DELAYED_OVER_3_HOURS",
  "TRAIN_DIVERTED",
  "CLASS_DOWNGRADED",
  "AC_FAILURE",
  "COACH_NOT_ATTACHED",
  "TRAIN_TERMINATED_SHORT"
]
```

### 2.20 TDR Statuses
```json
["FILED", "UNDER_REVIEW", "APPROVED", "REJECTED", "REFUND_PROCESSED"]
```

### 2.21 Refund Reason Codes
```json
[
  "CANCELLATION",
  "TDR_APPROVED",
  "WAITLIST_PURGE",
  "PAYMENT_AFTER_EXPIRY",
  "TRAIN_CANCELLED"
]
```

### 2.22 Maintenance Task Types & Statuses
- **Types**: `["CLEANING", "REPAIR", "AC_SERVICE", "INSPECTION", "SAFETY_CHECK"]`
- **Statuses**: `["OPEN", "IN_PROGRESS", "COMPLETED", "CANCELLED"]`

### 2.23 Fine Reasons & Payment Statuses
- **Reasons**: `["TICKETLESS_TRAVEL", "UNAUTHORIZED_CLASS", "SMOKING_NUISANCE", "UNBOOKED_LUGGAGE"]`
- **Statuses**: `["PAID", "UNPAID"]`

### 2.24 Incident Severity & Statuses
- **Severity**: `["LOW", "MEDIUM", "HIGH", "CRITICAL"]`
- **Statuses**: `["REPORTED", "ACKNOWLEDGED", "RESOLVED"]`

### 2.25 Crowd Levels & Cleanliness Issues
- **Crowd Levels**: `["LOW", "MODERATE", "HIGH", "OVERCROWDED"]`
- **Cleanliness Issues**: `["TOILET_DIRTY", "LITTER", "WATER_SHORTAGE", "LINEN_SOILED", "PESTS", "SPILLAGE"]`

### 2.26 Business Rule Error Codes
```json
[
  "SEAT_NOT_AVAILABLE",
  "WAITING_LIST_FULL",
  "NOT_ALL_CONFIRMED",
  "HOLD_EXPIRED",
  "TRAIN_NOT_RUNNING",
  "QUOTA_NOT_ELIGIBLE",
  "CONCESSION_PROOF_REQUIRED",
  "NO_ADULT_PASSENGER",
  "BERTH_PREFERENCE_NOT_MET",
  "MONTHLY_LIMIT_EXCEEDED",
  "CHART_PREPARED"
]
```

---

## 3. Relational Schema Data Dictionary (MySQL Engine)

### 3.1 USER_ACCOUNT
Authentication credentials, RBAC roles, and verification status for all 50,000 users.

| Field | Type | Nullable | Key / Constraint | Description |
| :--- | :--- | :--- | :--- | :--- |
| `user_id` | `INT` | No | Primary Key | Dataset: `userId` (1 to 50000) |
| `email` | `VARCHAR(191)` | No | Unique | User login email address |
| `password_hash` | `VARCHAR(255)` | No | - | Salted SHA-256 / bcrypt password hash |
| `phone` | `VARCHAR(32)` | No | Unique | Dataset: `phoneNumber` |
| `full_name` **`(new)`** | `VARCHAR(128)` | No | - | Legal account holder name |
| `role` **`(new)`** | `ENUM` | No | Default `'PASSENGER'` | `'PASSENGER'`, `'STAFF'`, `'ADMIN'` |
| `account_status` **`(new)`** | `ENUM` | No | Default `'ACTIVE'` | `'ACTIVE'`, `'SUSPENDED'`, `'PENDING'` |
| `aadhaar_verified` **`(new)`** | `BOOLEAN` | No | Default `FALSE` | Controls monthly booking limit (12 vs 24 via settings) and Tatkal |
| `created_at` | `DATETIME` | No | - | Dataset: `createdAt` |

---

### 3.2 SAVED_PASSENGER
Pre-saved passenger profiles belonging to users (75,000 synthetic records in dataset). Concession is selected per booking on `PASSENGER_BOOKING` and not stored here (BR-C10).

| Field | Type | Nullable | Key / Constraint | Description |
| :--- | :--- | :--- | :--- | :--- |
| `passenger_id` | `INT` | No | Primary Key | Dataset: `passengerId` (7 to 75006) |
| `user_id` | `INT` | No | FK -> `USER_ACCOUNT.user_id` | Profile owner (`userId`) |
| `name` | `VARCHAR(128)` | No | - | Passenger full name |
| `age` | `INT` | No | CHECK (`age` >= 0) | Age in completed years |
| `gender` | `ENUM` | No | - | `'MALE'`, `'FEMALE'`, `'OTHER'` |
| `id_proof_type` | `ENUM` | No | ID Proof Enum | Document type (`SYNTHETIC_TEST_ID`, `AADHAAR`, etc.) |
| `id_proof_reference`| `VARCHAR(64)` | No | - | Document reference string |
| `disability_type` | `ENUM` | No | Default `'NONE'` | `'NONE'`, `'ORTHOPEDIC'`, `'VISUAL'`, `'HEARING'`, `'MENTAL'` |
| `berth_preference`| `ENUM` | No | Berth Enum | Desired berth preference (`LOWER`, `UPPER`, etc.) |

---

### 3.3 SEAT_HOLD
Temporary 10-minute hold reservation initiated upon entering Booking Step 3 (BR-B2, Section 16 item 4).

| Field | Type | Nullable | Key / Constraint | Description |
| :--- | :--- | :--- | :--- | :--- |
| `token` **`(new)`** | `VARCHAR(64)` | No | Primary Key | Unique hold token (e.g. `HOLD-982104-BCT-NDLS`) |
| `user_id` **`(new)`** | `INT` | No | FK -> `USER_ACCOUNT.user_id` | User holding seats (1 active hold per user) |
| `schedule_id` **`(new)`** | `INT` | No | FK -> `TRAIN_SCHEDULE.schedule_id` | Specific train run |
| `class_id` **`(new)`** | `INT` | No | FK -> `SEAT_CLASS.class_id` | Travel class |
| `quota` **`(new)`** | `ENUM` | No | Quota Enum | Applied quota (`GENERAL`, `LADIES`, `TATKAL`, etc.) |
| `seat_count` **`(new)`** | `INT` | No | CHECK (1 <= `seat_count` <= 6) | Seats held across CONFIRMED, RAC, WL |
| `expires_at` **`(new)`** | `DATETIME` | No | - | Expiration timestamp (created_at + 10 minutes) |

---

### 3.4 BOOKING
Master transaction entity representing an entire PNR (1 to 6 passengers).

| Field | Type | Nullable | Key / Constraint | Description |
| :--- | :--- | :--- | :--- | :--- |
| `pnr` | `VARCHAR(10)` | No | Primary Key (10 digits) | Official 10-digit Passenger Name Record identifier |
| `user_id` | `INT` | No | FK -> `USER_ACCOUNT.user_id` | Booking owner (or `COUNTER_WALKIN` account) |
| `schedule_id` | `INT` | No | FK -> `TRAIN_SCHEDULE.schedule_id` | Train run reference |
| `class_id` | `INT` | No | FK -> `SEAT_CLASS.class_id` | Booked coach class |
| `from_stop_id` | `INT` | No | FK -> `ROUTE_STOP.stop_id` | Boarding station stop along route |
| `to_stop_id` | `INT` | No | FK -> `ROUTE_STOP.stop_id` | Destination station stop along route |
| `channel` **`(new)`** | `ENUM` | No | Default `'ONLINE'` | `'ONLINE'`, `'COUNTER'` |
| `booked_by_staff_id` **`(new)`** | `INT` | Yes | FK -> `STAFF.staff_id` | Staff member who booked counter ticket (NULL if online) |
| `quota` **`(new)`** | `ENUM` | No | Quota Enum | Booked quota (`GENERAL`, `LADIES`, `TATKAL`, etc.) |
| `requested_quota` **`(new)`** | `ENUM` | Yes | Quota Enum | Original quota requested prior to BR-Q13 fallback |
| `berth_condition` **`(new)`** | `BOOLEAN` | No | Default `FALSE` | Optional tick: "Book only if preferred berth type is given" in SL/3A/2A/1A (BR-B6a, else BERTH_PREFERENCE_NOT_MET) |
| `total_fare` | `DECIMAL(10,2)`| No | - | Cumulative fare across all passengers |
| `status` | `ENUM` | No | Booking Status Enum | `'PAYMENT_PENDING'`, `'CONFIRMED'`, `'RAC'`, `'WAITING_LIST'`, `'CANCELLED'`, `'FAILED'` |
| `created_at` | `DATETIME` | No | Indexed with `user_id` | Booking creation timestamp (used for monthly limit counting by booking date, including cancelled, excluding FAILED) |

---

### 3.5 PASSENGER_BOOKING
Individual passenger line-item tied to a PNR, recording itemized fare components (BR-F, BR-R3, Section 16 item 3).

| Field | Type | Nullable | Key / Constraint | Description |
| :--- | :--- | :--- | :--- | :--- |
| `pnr` | `VARCHAR(10)` | No | Composite PK & FK | Parent booking PNR |
| `passenger_no` | `INT` | No | Composite PK (1 to 6) | Line-item sequence number within PNR |
| `saved_passenger_id` **`(new)`** | `INT` | Yes | FK -> `SAVED_PASSENGER.passenger_id` | Master list profile link (NULL if manual entry) |
| `name` | `VARCHAR(128)` | No | - | Passenger full name |
| `age` | `INT` | No | CHECK (`age` >= 0) | Age in years (at least 1 adult >= 18 per PNR) |
| `gender` | `ENUM` | No | - | `'MALE'`, `'FEMALE'`, `'OTHER'` |
| `concession_type` **`(new)`** | `ENUM` | No | Default `'NONE'` | `'NONE'`, `'DIVYAANG'`, `'SENIOR_CITIZEN'` |
| `concession_proof_type` **`(new)`** | `ENUM`| Yes | Proof Enum | `'RAILWAY_DIVYANGJAN_ID'`, `'UDID'`, `'CONCESSION_CERTIFICATE'` |
| `concession_proof_ref` **`(new)`** | `VARCHAR(64)` | Yes | - | Document reference number |
| `base_fare` **`(new)`** | `DECIMAL(8,2)` | No | - | Distance slab rate $\times$ chargeable km (min 100 km) |
| `concession_discount` **`(new)`**| `DECIMAL(8,2)` | No | Default 0.00 | Concession discount applied strictly to base fare |
| `reservation_charge` **`(new)`** | `DECIMAL(6,2)` | No | - | Flat reservation charge per class |
| `superfast_charge` **`(new)`** | `DECIMAL(6,2)` | No | Default 0.00 | Superfast surcharge (Rajdhani, Shatabdi, Duronto) |
| `tatkal_charge` **`(new)`** | `DECIMAL(8,2)` | No | Default 0.00 | Tatkal premium (30% AC, 10% non-AC) |
| `dynamic_surcharge` **`(new)`** | `DECIMAL(8,2)` | No | Default 0.00 | Optional Tatkal surge (BR-F11, 0.00 when switch off) |
| `gst` **`(new)`** | `DECIMAL(8,2)` | No | Default 0.00 | 5% GST on taxable base for AC classes (0 for non-AC) |
| `insurance` **`(new)`** | `DECIMAL(6,2)` | No | Default 0.00 | Optional insurance premium (0.45 flat) |
| `total_fare` **`(new)`** | `DECIMAL(10,2)`| No | - | Line-item total rounded to 2 decimals half-up |

---

### 3.6 RESERVATION
Real-time seat allocation and queue position tracking (0..1 record per passenger line-item).

| Field | Type | Nullable | Key / Constraint | Description |
| :--- | :--- | :--- | :--- | :--- |
| `res_id` | `INT` | No | Primary Key | Unique allocation tracking ID |
| `pnr` | `VARCHAR(10)` | No | FK -> `BOOKING.pnr` | Associated booking PNR |
| `passenger_no` | `INT` | No | FK -> `PASSENGER_BOOKING` | Passenger number |
| `schedule_id` | `INT` | No | FK -> `TRAIN_SCHEDULE.schedule_id` | Target journey run |
| `seat_id` | `INT` | Yes | FK -> `SEAT.seat_id` | Physical seat (NULL for WAITING_LIST) |
| `status` | `ENUM` | No | Status Enum | `'CONFIRMED'`, `'RAC'`, `'WAITING_LIST'`, `'BOARDED'`, `'NO_SHOW'`, `'CANCELLED'` |
| `queue_position` | `INT` | Yes | - | Waitlist or RAC numeric position (e.g., 1, 2) |

---

### 3.7 PAYMENT
Monetary settlement transactions. For online bookings, uses Razorpay in TEST mode (BR-B7); counter bookings use CASH or POS.

| Field | Type | Nullable | Key / Constraint | Description |
| :--- | :--- | :--- | :--- | :--- |
| `payment_id` | `INT` | No | Primary Key | Unique payment transaction record |
| `pnr` | `VARCHAR(10)` | Yes | FK -> `BOOKING.pnr` | Associated PNR (can be NULL for late payment refund) |
| `amount` | `DECIMAL(10,2)`| No | - | Exact payment amount collected |
| `method` | `ENUM` | No | Payment Mode Enum | `'CREDIT_CARD'`, `'DEBIT_CARD'`, `'UPI'`, `'NET_BANKING'`, `'CASH'` |
| `status` | `ENUM` | No | Payment Status Enum | `'PENDING'`, `'SUCCESS'`, `'FAILED'` |
| `gateway_payment_id` **`(new)`**| `VARCHAR(128)`| Yes| Unique | Razorpay test payment ID (ensures idempotency, BR-B14) |
| `paid_at` | `DATETIME` | Yes | - | Successful payment settlement timestamp |

---

### 3.8 CANCELLATION
Voluntary ticket cancellation audit records.

| Field | Type | Nullable | Key / Constraint | Description |
| :--- | :--- | :--- | :--- | :--- |
| `cancel_id` | `INT` | No | Primary Key | Unique cancellation record identifier |
| `pnr` | `VARCHAR(10)` | No | FK -> `BOOKING.pnr` | Cancelled booking PNR |
| `passenger_no` | `INT` | Yes | FK -> `PASSENGER_BOOKING` | Passenger number (NULL if entire PNR cancelled) |
| `reason` | `VARCHAR(255)` | Yes | - | Optional passenger cancellation remark |
| `charge` | `DECIMAL(8,2)` | No | - | Deducted cancellation penalty per origin departure slabs |
| `cancelled_at` | `DATETIME` | No | - | Cancellation timestamp |

---

### 3.9 TDR_FILING
Formal Ticket Deposit Receipt claims for railway operational failures (Section 9, Section 16 item 7).

| Field | Type | Nullable | Key / Constraint | Description |
| :--- | :--- | :--- | :--- | :--- |
| `tdr_ref_no` | `VARCHAR(32)` | No | Primary Key | Unique TDR reference number |
| `pnr` | `VARCHAR(10)` | No | FK -> `BOOKING.pnr` | PNR under dispute |
| `passenger_no` | `INT` | Yes | FK -> `PASSENGER_BOOKING` | Specific passenger (NULL if whole PNR) |
| `reason` | `ENUM` | No | TDR Reason Enum | `TRAIN_DELAYED_OVER_3_HOURS`, `TRAIN_DIVERTED`, `CLASS_DOWNGRADED`, `AC_FAILURE`, `COACH_NOT_ATTACHED`, `TRAIN_TERMINATED_SHORT` |
| `filed_at` | `DATETIME` | No | - | Timestamp claim was lodged |
| `status` | `ENUM` | No | TDR Status Enum | `'FILED'`, `'UNDER_REVIEW'`, `'APPROVED'`, `'REJECTED'`, `'REFUND_PROCESSED'` |
| `evidence_ref` | `VARCHAR(255)`| Yes| - | TC certificate reference or operational note (CSV: `evidence_ref`) |
| `refund_amount` | `DECIMAL(10,2)`| Yes| - | Approved refund amount (cannot exceed fare paid) |
| `reviewed_by` | `INT` | Yes | FK -> `USER_ACCOUNT.user_id` | Admin or staff actor reviewing the claim |
| `reviewed_at` | `DATETIME` | Yes | - | Timestamp of review decision |
| `remarks` | `TEXT` | Yes | - | Adjudication explanation / notes |

---

### 3.10 REFUND
Monetary refund ledger linking to cancellations, TDRs, waitlist purges, or late payments.

| Field | Type | Nullable | Key / Constraint | Description |
| :--- | :--- | :--- | :--- | :--- |
| `refund_id` | `INT` | No | Primary Key | Unique refund transaction identifier |
| `cancel_id` | `INT` | Yes | FK -> `CANCELLATION.cancel_id`| Source voluntary cancellation (if applicable) |
| `tdr_ref_no` | `VARCHAR(32)` | Yes | FK -> `TDR_FILING.tdr_ref_no` | Source TDR claim (if applicable) |
| `payment_id` | `INT` | No | FK -> `PAYMENT.payment_id` | Target original payment record |
| `amount` | `DECIMAL(10,2)`| No | - | Exact amount refunded to original payment mode |
| `reason` | `ENUM` | No | Refund Reason Enum | `'CANCELLATION'`, `'TDR_APPROVED'`, `'WAITLIST_PURGE'`, `'PAYMENT_AFTER_EXPIRY'`, `'TRAIN_CANCELLED'` |
| `status` | `ENUM` | No | Default `'PENDING'` | `'PENDING'`, `'PROCESSED'` |

---

### 3.11 CHART_SNAPSHOT
Immutable passenger manifest snapshot generated at chart time (8 hours before origin departure per BR-B12 / settings table, BR-B12a, Section 16 item 19).

| Field | Type | Nullable | Key / Constraint | Description |
| :--- | :--- | :--- | :--- | :--- |
| `snapshot_id` | `INT` | No | Primary Key | Unique snapshot row identifier |
| `schedule_id` | `INT` | No | FK -> `TRAIN_SCHEDULE.schedule_id` | Target train run |
| `pnr` | `VARCHAR(10)` | No | - | Passenger Name Record |
| `passenger_no` | `INT` | No | - | Passenger sequence number |
| `coach_no` | `VARCHAR(8)` | Yes | - | Final allocated coach code (CSV: `coach_no`) |
| `seat_no` | `INT` | Yes | - | Final allocated physical seat number (CSV: `seat_no`) |
| `berth_type` | `ENUM` | Yes | Berth Enum | Allocated berth type |
| `status` | `ENUM` | No | Status Enum | Chart status (`CONFIRMED` or `RAC`) |
| `from_station_id` | `INT` | No | FK -> `STATION.station_id` | Boarding station |
| `to_station_id` | `INT` | No | FK -> `STATION.station_id` | Destination station |
| `concession_flag` | `BOOLEAN` | No | Default `FALSE` | Indicates whether concession proof check is required |
| `generated_at` | `DATETIME` | No | - | Immutable creation timestamp (never updated) |

---

### 3.12 SETTING
Configurable system constants and operational knobs (Section 15, Section 16 item 5).

| Field | Type | Nullable | Key / Constraint | Description |
| :--- | :--- | :--- | :--- | :--- |
| `setting_key` | `VARCHAR(64)` | No | Primary Key | Constant identifier (e.g. `BOOKING_WINDOW_DAYS`) |
| `setting_value` | `VARCHAR(255)`| No | - | System value (e.g. `'7'`, `'10'`, `'60'`, `'false'`) |
| `description` | `VARCHAR(255)`| Yes | - | Explanation of setting purpose and associated rule |
| `updated_at` | `DATETIME` | No | - | Last modification timestamp |

---

### 3.13 STATION
Physical railway stations (exactly 158 stations in `stations_158_final.xlsx`).

| Field | Type | Nullable | Key / Constraint | Description |
| :--- | :--- | :--- | :--- | :--- |
| `station_id` | `INT` | No | Primary Key | Dataset: `stationId` (1 to 158) |
| `station_code` | `VARCHAR(8)` | No | Unique | Dataset: `stationCode` (e.g., `HBJ`, `NDLS`, `BCT`) |
| `station_name` | `VARCHAR(128)` | No | - | Dataset: `stationName` (e.g., `HABIBGANJ`) |
| `display_name` | `VARCHAR(128)` | No | - | Clean formatted title (e.g., `Habibganj`, `Bharuch Jn`) |
| `city` | `VARCHAR(64)` | No | - | Dataset: `City` |
| `state` | `VARCHAR(64)` | No | - | Dataset: `State` |
| `platform_count` | `INT` | No | CHECK (`platform_count` >= 1) | Total physical platforms (raised to min 3 where needed) |

---

### 3.14 PLATFORM
Physical track platforms belonging to a station. Rows 1 to `platform_count` are instantiated for every station (BR-A9).

| Field | Type | Nullable | Key / Constraint | Description |
| :--- | :--- | :--- | :--- | :--- |
| `platform_id` | `INT` | No | Primary Key | Unique internal platform ID |
| `station_id` | `INT` | No | FK -> `STATION.station_id` | Parent station |
| `platform_no` | `INT` | No | Unique with `station_id` | Platform number (1 through `platform_count`) |

---

### 3.15 TRAIN
Master configuration for the 60 active train services (`final_trains_60.xlsx`).

| Field | Type | Nullable | Key / Constraint | Description |
| :--- | :--- | :--- | :--- | :--- |
| `train_id` | `INT` | No | Primary Key | Dataset: `trainId` (101 to 160) |
| `train_number` | `VARCHAR(8)` | No | Unique | Dataset: `trainNumber` (e.g. `"12221"`, `"12951"`) |
| `short_name` | `VARCHAR(64)` | No | - | Dataset: `trainName` (e.g. `"PA-HWH DURAN"`) |
| `display_name` | `VARCHAR(128)` | No | - | Descriptive title (e.g. `"Pune – Howrah Duronto Express"`) |
| `train_type` | `ENUM` | No | Train Type Enum | Dataset: `trainType` (`RAJDHANI`, `SHATABDI`, `DURONTO`, `EXPRESS`, `VANDE_BHARAT`) |
| `source_station_id` | `INT` | No | FK -> `STATION.station_id` | Dataset: `sourceStationId` |
| `destination_station_id`| `INT`| No | FK -> `STATION.station_id` | Dataset: `destinationStationId` |
| `running_days` | `JSON` / `VARCHAR(64)`| No | Days list | Dataset: `runningDays` (e.g. `["MON", "TUE", ...]`) |
| `status` | `ENUM` | No | Default `'ACTIVE'` | Dataset: `status` (`'ACTIVE'`, `'CANCELLED'`, `'RESCHEDULED'`) |

---

### 3.16 ROUTE_STOP
Ordered stop sequence and timetable for trains (536 records in `final_routes_536.xlsx`).

| Field | Type | Nullable | Key / Constraint | Description |
| :--- | :--- | :--- | :--- | :--- |
| `stop_id` | `INT` | No | Primary Key | Dataset: `routeId` (1001 to 1536) |
| `train_id` | `INT` | No | FK -> `TRAIN.train_id` | Dataset: `trainId` |
| `station_id` | `INT` | No | FK -> `STATION.station_id` | Dataset: `stationId` |
| `stop_sequence` | `INT` | No | Unique with `train_id` | Dataset: `stopSequence` (1, 2, 3...) |
| `arrival_time` | `TIME` | No | - | Dataset: `arrivalTime` (`HH:mm`) |
| `departure_time` | `TIME` | No | - | Dataset: `departureTime` (`HH:mm`) |
| `day_offset` | `INT` | No | Default 0 | Days elapsed from origin station departure (0, 1, or 2) |
| `distance_from_origin`| `INT`| No | - | Dataset / CSV: `distance_from_origin` (cumulative km) |
| `platform_number` | `INT` | No | - | Dataset / CSV: `platform_number` (must not exceed station count) |

---

### 3.17 TRAIN_SCHEDULE
Specific calendar runs of trains governed by origin departure dates.

| Field | Type | Nullable | Key / Constraint | Description |
| :--- | :--- | :--- | :--- | :--- |
| `schedule_id` | `INT` | No | Primary Key | Unique schedule run ID |
| `train_id` | `INT` | No | FK -> `TRAIN.train_id` | Train service |
| `journey_date` | `DATE` | No | Origin departure date | Scheduled departure date from origin station (BR-B1a) |
| `departure_time`| `TIME` | No | - | Origin departure time |
| `delay_minutes` | `INT`| No | Default 0 | Operational delay at source/en-route |
| `chart_prepared_at`| `DATETIME`| Yes | - | Timestamp when chart prepared (at chart time per BR-B12 / settings table) |
| `status` | `ENUM` | No | Default `'ON_TIME'` | `'ON_TIME'`, `'DELAYED'`, `'CANCELLED'`, `'RESCHEDULED'` |

---

### 3.18 RUN_COACH_STATUS
Tracks coach operational readiness per train run, supporting out-of-service maintenance flagging (BR-M3, Section 16 item 8).

| Field | Type | Nullable | Key / Constraint | Description |
| :--- | :--- | :--- | :--- | :--- |
| `status_id` | `INT` | No | Primary Key | Unique status tracking record (CSV: `status_id`) |
| `schedule_id` | `INT` | No | FK -> `TRAIN_SCHEDULE.schedule_id` | Train run |
| `coach_id` | `INT` | No | FK -> `COACH.coach_id` | Physical coach |
| `status` | `ENUM` | No | Default `'IN_SERVICE'` | `'IN_SERVICE'`, `'OUT_OF_SERVICE'` |

---

### 3.19 SEAT_CLASS
Master catalog of passenger accommodation classes.

| Field | Type | Nullable | Key / Constraint | Description |
| :--- | :--- | :--- | :--- | :--- |
| `class_id` | `INT` | No | Primary Key | Unique class ID |
| `class_code` | `VARCHAR(10)` | No | Unique | CSV: `class_code` (`'1A'`, `'2A'`, `'3A'`, `'SL'`, `'CC'`, `'EC'`, `'2S'`) |
| `class_name` | `VARCHAR(50)` | No | - | CSV: `class_name` (e.g. `'AC 3 Tier'`, `'Sleeper'`) |
| `coach_type` | `ENUM('AC', 'NON_AC')` | No | - | CSV: `coach_type` |
| `has_berths` | `TINYINT(1)` | No | Default 1 | CSV: `has_berths` |
| `base_multiplier` | `DECIMAL(5,2)` | No | Default 1.00 | CSV: `base_multiplier` |

---

### 3.20 COACH
Physical coach compositions per train layout (BR-S1a).

| Field | Type | Nullable | Key / Constraint | Description |
| :--- | :--- | :--- | :--- | :--- |
| `coach_id` | `INT` | No | Primary Key | Unique coach record ID |
| `train_id` | `INT` | No | FK -> `TRAIN.train_id` | Assigned train rake |
| `class_id` | `INT` | No | FK -> `SEAT_CLASS.class_id` | Travel class |
| `coach_code` | `VARCHAR(10)` | No | - | Visible identifier (CSV: `coach_code`, e.g. `'B1'`, `'A1'`, `'S1'`) |
| `sequence_number` | `INT` | No | - | Position along rake (CSV: `sequence_number`) |
| `total_seats` | `INT` | No | - | Seat capacity (SL 72, 3A 64, 2A 48, 1A 24, CC 78, EC 56) |

---

### 3.21 SEAT
Physical berths or chairs within a coach.

| Field | Type | Nullable | Key / Constraint | Description |
| :--- | :--- | :--- | :--- | :--- |
| `seat_id` | `INT` | No | Primary Key | Unique seat ID |
| `coach_id` | `INT` | No | FK -> `COACH.coach_id` | Parent coach |
| `seat_number` | `INT` | No | Unique with `coach_id` | Physical number (CSV: `seat_number`, 1 to `total_seats`) |
| `berth_type` | `ENUM` | No | Berth Enum | `'LOWER'`, `'MIDDLE'`, `'UPPER'`, `'SIDE_LOWER'`, `'SIDE_UPPER'`, `'WINDOW'`, `'AISLE'`, `'NO_BERTH'` |

---

### 3.22 SCHEDULE_CLASS_INVENTORY
Real-time seat counters partitioned by run and class (BR-Q10, Section 16 item 1).

| Field | Type | Nullable | Key / Constraint | Description |
| :--- | :--- | :--- | :--- | :--- |
| `inventory_id` | `INT` | No | Primary Key | Surrogate inventory ID (CSV: `inventory_id`) |
| `schedule_id` | `INT` | No | FK -> `TRAIN_SCHEDULE.schedule_id` | Train run |
| `class_id` | `INT` | No | FK -> `SEAT_CLASS.class_id` | Coach class |
| `total_seats` | `INT` | No | - | Total capacity allocated to this class |
| `available_seats`| `INT` | No | CHECK (`available_seats` >= 0) | Remaining free confirmed berths |
| `rac_capacity` | `INT` | No | Default 0 | Maximum RAC capacity |
| `rac_count` | `INT` | No | Default 0 | Active RAC tokens issued |
| `wl_capacity` | `INT` | No | Default 0 | Maximum waitlist capacity |
| `wl_count` | `INT` | No | Default 0 | Active waitlist tokens issued |

---

### 3.23 FARE
Distance-slab pricing table per class (Section 6, BR-F2a, Section 16 item 6).

| Field | Type | Nullable | Key / Constraint | Description |
| :--- | :--- | :--- | :--- | :--- |
| `fare_id` | `INT` | No | Primary Key | Unique fare rule ID |
| `class_id` | `INT` | No | FK -> `SEAT_CLASS.class_id` | Travel class |
| `min_distance_km` | `INT` | No | - | Distance slab start (CSV: `min_distance_km`, e.g. 0, 301, 701, 1301) |
| `max_distance_km` | `INT` | No | - | Distance slab end (CSV: `max_distance_km`, e.g. 300, 700, 1300, 10000) |
| `rate_per_km` | `DECIMAL(6,2)`| No | - | Base rate per kilometer for distance slab (CSV: `rate_per_km`) |

---

### 3.24 CONCESSION_RULE
Eligibility criteria and concession discount percentages (Section 7, Section 16 item 6).

| Field | Type | Nullable | Key / Constraint | Description |
| :--- | :--- | :--- | :--- | :--- |
| `rule_id` | `INT` | No | Primary Key | Unique concession rule ID (CSV: `rule_id`) |
| `concession_type` | `ENUM` | No | - | `'DIVYAANG'`, `'SENIOR_CITIZEN'` |
| `class_id` | `INT` | Yes | FK -> `SEAT_CLASS.class_id` | Class limitation (NULL if all) |
| `train_group` | `VARCHAR(64)`| Yes | - | e.g. `'SUPERFAST_PREMIUM'`, `'EXPRESS'` (CSV: `train_group`) |
| `discount_pct` | `DECIMAL(5,2)`| No | - | Base fare discount percentage (e.g. 75.00, 50.00, 25.00) |
| `proof_types` | `JSON` / `VARCHAR(255)` | No | - | Allowed proof documents (`UDID`, `CONCESSION_CERTIFICATE`) |
| `is_active` | `BOOLEAN` | No | Default `TRUE` | `TRUE` for Divyaang, `FALSE` for Senior Citizen |

---

### 3.25 REFUND_RULE
Cancellation penalty percentages and flat deductions per origin departure time slabs (Section 8, Section 16 item 6).

| Field | Type | Nullable | Key / Constraint | Description |
| :--- | :--- | :--- | :--- | :--- |
| `rule_id` | `INT` | No | Primary Key | Unique refund rule identifier |
| `min_hours` | `INT` | No | - | Hours before origin departure (lower bound: 72, 24, 8) |
| `max_hours` | `INT` | Yes | - | Hours before origin departure (upper bound: NULL, 72, 24) |
| `deduction_pct` | `DECIMAL(5,2)`| No | - | Percentage deducted from taxable fare (0%, 25%, 50%, 100%) |
| `flat_min_charge` | `DECIMAL(6,2)`| No | - | Minimum deduction (1A/EC 240, 2A 200, 3A/CC 180, SL 120, 2S 60) |
| `clerkage` | `DECIMAL(6,2)`| No | Default 60.00 | Fee retained for RAC/WL cancellation before chart (CSV: `clerkage`) |

---

### 3.26 TDR_RULE
Operational policy parameters for Ticket Deposit Receipt (TDR) review and approvals.

| Field | Type | Nullable | Key / Constraint | Description |
| :--- | :--- | :--- | :--- | :--- |
| `rule_id` | `INT` | No | Primary Key | Unique rule identifier |
| `reason_code` | `VARCHAR(64)` | No | Unique | E.g. `TRAIN_DELAYED_OVER_3_HOURS`, `AC_FAILURE`, etc. |
| `description` | `VARCHAR(255)` | No | - | Formal description of operational condition |
| `deadline_hours` | `INT` | No | - | Filing window limit in hours |
| `requires_verification` | `TINYINT(1)` | No | Default 0 | Indicates if physical ticket collector verification is needed |
| `refund_pct` | `DECIMAL(5,2)` | No | - | Refund percentage entitlement |

---

### 3.27 STAFF
Operational job profiles for railway personnel.

| Field | Type | Nullable | Key / Constraint | Description |
| :--- | :--- | :--- | :--- | :--- |
| `staff_id` | `INT` | No | Primary Key | Unique staff ID |
| `user_id` | `INT` | No | FK -> `USER_ACCOUNT.user_id` | Linked authentication profile |
| `employee_no` | `VARCHAR(32)` | No | Unique | Official railway employee code (e.g. `EMP-TC-101`) |
| `designation` | `VARCHAR(64)` | No | - | Operational designation |
| `status` | `ENUM` | No | Default `'ACTIVE'` | `'ACTIVE'`, `'INACTIVE'`, `'ON_LEAVE'` |

---

### 3.28 STAFF_ASSIGNMENT
Shift rosters linking staff to duty stations, trains, counters, or maintenance (Section 11, Section 12, Section 13).

| Field | Type | Nullable | Key / Constraint | Description |
| :--- | :--- | :--- | :--- | :--- |
| `assign_id` | `INT` | No | Primary Key | Unique assignment ID |
| `staff_id` | `INT` | No | FK -> `STAFF.staff_id` | Assigned personnel |
| `schedule_id` | `INT` | Yes | FK -> `TRAIN_SCHEDULE.schedule_id` | Assigned train run (if `TRAIN_DUTY`) |
| `station_id` | `INT` | Yes | FK -> `STATION.station_id` | Assigned station (if `STATION_DUTY` or `COUNTER_DUTY`) |
| `duty_type` | `ENUM` | No | Duty Enum | `'TRAIN_DUTY'`, `'STATION_DUTY'`, `'COUNTER_DUTY'`, `'MAINTENANCE_DUTY'` |
| `shift_start` | `DATETIME` | No | - | Shift start timestamp |
| `shift_end` | `DATETIME` | No | - | Shift end timestamp |

---

### 3.29 TICKET_VERIFICATION
On-train ID checks conducted by Ticket Collectors (BR-ST3).

| Field | Type | Nullable | Key / Constraint | Description |
| :--- | :--- | :--- | :--- | :--- |
| `verify_id` | `INT` | No | Primary Key | Unique verification log ID |
| `staff_id` | `INT` | No | FK -> `STAFF.staff_id` | Ticket Collector conducting check |
| `pnr` | `VARCHAR(10)` | No | FK -> `BOOKING.pnr` | Ticket PNR inspected |
| `passenger_no` | `INT` | No | FK -> `PASSENGER_BOOKING` | Specific passenger inspected |
| `id_proof_match` | `ENUM` | No | Valid Enum | Physical ID document inspected (`'VALID'`, `'INVALID'`, `'MISMATCH'`) |
| `concession_match` | `ENUM` | No | Valid Enum | Disability certificate inspected (`'VALID'`, `'INVALID'`, `'MISMATCH'`, `'NOT_APPLICABLE'`) |
| `result` | `ENUM` | No | Verification Enum | Overall check verdict (`'VALID'`, `'INVALID'`, `'MISMATCH'`) per BR-ST3 |
| `remarks` | `VARCHAR(255)` | Yes | - | Collector inspection notes / status |
| `verified_at` | `DATETIME` | No | - | Timestamp check recorded |

---

### 3.29 FINE
Penalty charges issued on-the-spot by staff (BR-ST7).

| Field | Type | Nullable | Key / Constraint | Description |
| :--- | :--- | :--- | :--- | :--- |
| `fine_id` | `INT` | No | Primary Key | Unique fine receipt ID |
| `verify_id` | `INT` | Yes | FK -> `TICKET_VERIFICATION.verify_id`| Associated verification log (if applicable) |
| `staff_id` | `INT` | No | FK -> `STAFF.staff_id` | Issuing staff member |
| `passenger_name` | `VARCHAR(128)` | No | - | Offender name |
| `id_proof_reference`| `VARCHAR(64)` | Yes | - | Document reference |
| `train_id` | `INT` | Yes | FK -> `TRAIN.train_id` | Train location of offense |
| `amount` | `DECIMAL(8,2)` | No | - | Monetary fine assessed (within admin bounds) |
| `reason` | `ENUM` | No | Fine Reason Enum | `'TICKETLESS_TRAVEL'`, `'UNAUTHORIZED_CLASS'`, etc. |
| `payment_status` | `ENUM` | No | Default `'UNPAID'` | `'PAID'`, `'UNPAID'` |
| `issued_at` | `DATETIME` | No | - | Timestamp fine issued |

---

### 3.30 INCIDENT
Operational emergencies or security incidents (BR-ST8, BR-ST9).

| Field | Type | Nullable | Key / Constraint | Description |
| :--- | :--- | :--- | :--- | :--- |
| `incident_id` | `INT` | No | Primary Key | Unique incident tracking ID |
| `staff_id` | `INT` | No | FK -> `STAFF.staff_id` | Reporting employee |
| `station_id` | `INT` | Yes | FK -> `STATION.station_id` | Station location (if applicable) |
| `schedule_id` | `INT` | Yes | FK -> `TRAIN_SCHEDULE.schedule_id` | Train run (if applicable) |
| `type` | `VARCHAR(64)` | No | - | Incident type (e.g. `'SECURITY'`, `'MEDICAL_EMERGENCY'`) |
| `severity` | `ENUM` | No | Severity Enum | `'LOW'`, `'MEDIUM'`, `'HIGH'`, `'CRITICAL'` |
| `status` | `ENUM` | No | Default `'REPORTED'`| `'REPORTED'`, `'ACKNOWLEDGED'`, `'RESOLVED'` |
| `reported_at` | `DATETIME` | No | - | Incident report timestamp |

---

### 3.31 MAINTENANCE
Coach and platform maintenance tasks (Section 13, Section 16 item 14).

| Field | Type | Nullable | Key / Constraint | Description |
| :--- | :--- | :--- | :--- | :--- |
| `maint_id` | `INT` | No | Primary Key | Unique maintenance work order |
| `staff_id` | `INT` | No | FK -> `STAFF.staff_id` | Assigned maintenance personnel or creator |
| `coach_id` | `INT` | Yes | FK -> `COACH.coach_id` | Target coach (CHECK: exactly one of coach_id/platform_id is filled) |
| `platform_id` | `INT` | Yes | FK -> `PLATFORM.platform_id` | Target platform (CHECK: exactly one of coach_id/platform_id is filled) |
| `type` | `ENUM` | No | Maintenance Type Enum | `'CLEANING'`, `'REPAIR'`, `'AC_SERVICE'`, `'INSPECTION'`, `'SAFETY_CHECK'` |
| `status` | `ENUM` | No | Default `'OPEN'` | `'OPEN'`, `'IN_PROGRESS'`, `'COMPLETED'`, `'CANCELLED'` |
| `created_at` | `DATETIME` | No | - | Work order logged timestamp |
| `completed_at` **`(new)`**| `DATETIME` | Yes | - | Completion timestamp (required before returning to service) |

---

### 3.32 CROWD_REPORT
Live platform head-count and density reports (BR-ST8, Section 16 item 11).

| Field | Type | Nullable | Key / Constraint | Description |
| :--- | :--- | :--- | :--- | :--- |
| `crowd_report_id` | `INT` | No | Primary Key | Unique crowd log ID |
| `station_id` | `INT` | No | FK -> `STATION.station_id` | Surveyed station |
| `platform_no` | `INT` | No | - | Surveyed platform number |
| `crowd_level` | `ENUM` | No | Crowd Level Enum | `'LOW'`, `'MODERATE'`, `'HIGH'`, `'OVERCROWDED'` |
| `head_count` | `INT` | Yes | - | Estimated passenger head count |
| `staff_id` | `INT` | No | FK -> `STAFF.staff_id` | Reporting staff member |
| `recorded_at` | `DATETIME` | No | - | Observation timestamp |

---

### 3.33 CLEANLINESS_REPORT
Coach and station sanitary maintenance logs (BR-ST8, Section 16 item 11).

| Field | Type | Nullable | Key / Constraint | Description |
| :--- | :--- | :--- | :--- | :--- |
| `cleanliness_report_id`| `INT` | No | Primary Key | Unique cleanliness report ID |
| `staff_id` | `INT` | No | FK -> `STAFF.staff_id` | Reporting employee |
| `train_id` | `INT` | Yes | FK -> `TRAIN.train_id` | Affected train (NULL if on platform) |
| `coach_id` | `INT` | Yes | FK -> `COACH.coach_id` | Affected coach (NULL if on platform) |
| `station_id` | `INT` | Yes | FK -> `STATION.station_id` | Affected station (NULL if on coach) |
| `platform_no` | `INT` | Yes | - | Affected platform number |
| `issue_type` | `ENUM` | No | Cleanliness Issue Enum | `'TOILET_DIRTY'`, `'LITTER'`, `'WATER_SHORTAGE'`, etc. |
| `description` | `TEXT` | Yes | - | Detailed description |
| `status` | `ENUM` | No | Default `'REPORTED'`| `'REPORTED'`, `'ATTENDING'`, `'RESOLVED'` |
| `recorded_at` | `DATETIME` | No | - | Report timestamp |

---

### 3.34 ADMIN
Administrator metadata and access permissions.

| Field | Type | Nullable | Key / Constraint | Description |
| :--- | :--- | :--- | :--- | :--- |
| `admin_id` | `INT` | No | Primary Key | Internal admin ID |
| `user_id` | `INT` | No | FK -> `USER_ACCOUNT.user_id` | Authentication user reference |
| `employee_no` | `VARCHAR(32)` | No | Unique | Official railway administrative employee ID |
| `access_level` | `VARCHAR(32)` | No | Default `'SUPER_ADMIN'` | Access tier |

---

### 3.35 AUDIT_LOG
Immutable forensic audit trail populated via database triggers (BR-A7, BR-A8).

| Field | Type | Nullable | Key / Constraint | Description |
| :--- | :--- | :--- | :--- | :--- |
| `log_id` | `INT` | No | Primary Key | Unique audit log ID |
| `user_id` | `INT` | No | FK -> `USER_ACCOUNT.user_id` | Actor performing the modification |
| `action` | `VARCHAR(32)` | No | - | Verb (`'CREATE'`, `'UPDATE'`, `'DELETE'`, `'OVERRIDE'`) |
| `table_name` | `VARCHAR(64)` | No | - | Name of modified MySQL table |
| `record_id` | `VARCHAR(64)` | No | - | Identifier of modified target record |
| `old_value` | `JSON` / `TEXT`| Yes | - | Pre-modification state |
| `new_value` | `JSON` / `TEXT`| Yes | - | Post-modification state |
| `logged_at` | `DATETIME` | No | Default CURRENT_TIMESTAMP | Event timestamp |

---

### 3.36 REPORT
Persisted metadata for generated administrative operational reports.

| Field | Type | Nullable | Key / Constraint | Description |
| :--- | :--- | :--- | :--- | :--- |
| `report_id` | `INT` | No | Primary Key | Unique report identifier |
| `admin_id` | `INT` | No | FK -> `ADMIN.admin_id` | Admin who generated report |
| `report_type` | `VARCHAR(64)` | No | - | e.g. `'REVENUE'`, `'OCCUPANCY'`, `'CANCELLATIONS'` |
| `generated_at` | `DATETIME` | No | - | Generation timestamp |

---

---

### 3.37 SETTING
Global system configuration key-value store (Section 15, Section 16 item 22).

| Field | Type | Nullable | Key / Constraint | Description |
| :--- | :--- | :--- | :--- | :--- |
| `setting_key` | `VARCHAR(64)` | No | Primary Key | Configuration parameter key (e.g. `MAX_TICKETS_PER_MONTH`) |
| `setting_value` | `VARCHAR(255)`| No | - | Configuration parameter value (e.g. `12`, `24`, `7`, `8`) |
| `description` | `TEXT` | Yes | - | Explanation of system setting |
| `updated_at` | `DATETIME` | No | Default CURRENT_TIMESTAMP | Timestamp last updated |

## 4. NoSQL Data Collections (MongoDB Storage Layer)

Per Section 5 of the ER diagram and Section 16 of the rules, operational logs, high-velocity feeds, and varied-schema feedback are maintained in MongoDB:

### 4.1 live_train_status (`LTS`)
Live running updates (replicated copy of schedule delays for real-time tracking):
```json
{
  "_id": "ObjectId",
  "schedule_id": 1001,
  "station_id": 10,
  "delay_min": 25,
  "status": "DELAYED",
  "current_platform": 3,
  "updated_at": "2026-10-18T15:30:00Z"
}
```

### 4.2 notifications (`NTF`)
In-app notification records dispatched to passengers and staff:
```json
{
  "_id": "ObjectId",
  "user_id": 1042,
  "message": "Your booking for PNR 2849102841 is CONFIRMED in Coach B1, Berth 23.",
  "type": "BOOKING_CONFIRMATION",
  "reference_id": "2849102841",
  "sent_at": "2026-10-18T15:32:00Z",
  "is_read": false
}
```
*(Types: `BOOKING_CONFIRMATION`, `STATUS_UPDATE`, `DELAY`, `PLATFORM_CHANGE`, `EMERGENCY`).*

### 4.3 complaints (`CMP`)
Passenger feedback and grievances with polymorphic schema:
```json
{
  "_id": "ObjectId",
  "user_id": 1042,
  "type": "TRAIN_CLEANLINESS",
  "message": "Washrooms in coach B1 of train 12951 were unhygienic.",
  "rating": 2,
  "status": "SUBMITTED",
  "extra_fields": {
    "coach": "B1",
    "train_number": "12951"
  },
  "created_at": "2026-10-18T15:35:00Z"
}
```

### 4.4 activity_logs (`ACT`)
High-velocity user session and API audit trail:
```json
{
  "_id": "ObjectId",
  "user_id": 1042,
  "event": "USER_LOGIN",
  "ip": "103.21.144.12",
  "user_agent": "Mozilla/5.0 ...",
  "meta": { "channel": "WEB" },
  "at": "2026-10-18T15:20:00Z"
}
```

### 4.5 raw_gateway_replies
Raw callback and webhook payloads from Razorpay TEST gateway (Section 16 item 20):
```json
{
  "_id": "ObjectId",
  "gateway_payment_id": "pay_test_8829104",
  "payload": {
    "razorpay_order_id": "order_test_9921",
    "razorpay_payment_id": "pay_test_8829104",
    "razorpay_signature": "9a38f...b2"
  },
  "received_at": "2026-10-18T15:31:00Z"
}
```
