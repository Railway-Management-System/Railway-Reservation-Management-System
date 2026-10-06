# Data Schema Specification

## 1. Introduction

This document establishes the canonical data dictionary and schema contract for the **Railway Reservation & Management System**. 

All three frontend engineering teams (Passenger, Staff/TC, Admin) and the future backend/database engineers **MUST** strictly adhere to the exact field names, data types, nullability rules, and enumeration values defined herein. **No team may alter or introduce aliases for these fields.**

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

### 2.4 Passenger Ticket Statuses
```json
["CONFIRMED", "RAC", "WAITING_LIST", "CANCELLED", "BOARDED", "NO_SHOW"]
```

### 2.5 Payment Statuses
```json
["PENDING", "SUCCESS", "FAILED"]
```

### 2.6 Quota Types
```json
["GENERAL", "LADIES", "TATKAL", "SENIOR_CITIZEN", "DIVYAANG"]
```

### 2.7 Train Classes (`classType`)
```json
["1A", "2A", "3A", "SL", "CC", "2S", "EC"]
```
- `1A`: First Class AC
- `2A`: AC 2 Tier
- `3A`: AC 3 Tier
- `SL`: Sleeper Class
- `CC`: AC Chair Car
- `2S`: Second Sitting
- `EC`: Executive Chair Car

### 2.8 Berth Types
```json
["LOWER", "MIDDLE", "UPPER", "SIDE_LOWER", "SIDE_UPPER", "WINDOW", "AISLE", "NO_BERTH"]
```

### 2.9 Seat Statuses
```json
["AVAILABLE", "BOOKED", "RESERVED", "BLOCKED"]
```

### 2.10 Train Operational Statuses
```json
["ACTIVE", "CANCELLED", "RESCHEDULED", "DIVERTED"]
```

### 2.11 Schedule Statuses
```json
["ON_TIME", "DELAYED", "CANCELLED", "RESCHEDULED"]
```

### 2.12 ID Proof Types
```json
["AADHAAR", "PAN", "PASSPORT", "VOTER_ID", "DRIVING_LICENSE", "STUDENT_ID", "GOVT_ID"]
```

### 2.13 Concession Types
```json
["NONE", "SENIOR_CITIZEN", "STUDENT", "DIVYAANG", "MEDICAL"]
```

### 2.14 Disability Types
```json
["NONE", "ORTHOPEDIC", "VISUAL", "HEARING", "MENTAL"]
```

### 2.15 TDR Statuses
```json
["FILED", "UNDER_REVIEW", "APPROVED", "REJECTED", "REFUND_PROCESSED"]
```

### 2.16 Grievance Categories & Statuses
- **Categories**: `["TICKETING", "TRAIN_CLEANLINESS", "STATION_CLEANLINESS", "STAFF_BEHAVIOUR", "SECURITY", "REFUND", "OTHER"]`
- **Statuses**: `["SUBMITTED", "IN_PROGRESS", "RESOLVED", "REJECTED"]`

### 2.17 Staff Operational Enums
- **Fine Payment Status**: `["PAID", "UNPAID"]`
- **Incident Severity**: `["LOW", "MEDIUM", "HIGH", "CRITICAL"]`
- **Crowd Level**: `["LOW", "MODERATE", "HIGH", "OVERCROWDED"]`
- **Cleanliness Issue Type**: `["TOILET_DIRTY", "LITTER", "WATER_SHORTAGE", "LINEN_SOILED", "PESTS", "SPILLAGE"]`

---

## 3. Entity Data Dictionary

### 3.1 USER
Represents all system actors with authentication credentials and assigned roles.

| Field | Type | Nullable | Key / Constraint | Description |
| :--- | :--- | :--- | :--- | :--- |
| `userId` | `Integer` | No | Primary Key | Unique user account identifier |
| `name` | `String` | No | - | Full legal name of user |
| `email` | `String` | No | Unique | Email address used for login and notifications |
| `phone` | `String` | No | Unique | 10-digit mobile phone number |
| `role` | `Enum` | No | Role Enum | `"PASSENGER" \| "STAFF" \| "ADMIN"` |
| `accountStatus`| `Enum` | No | Account Status | `"ACTIVE" \| "SUSPENDED" \| "PENDING"` |
| `createdAt` | `String` | No | ISO 8601 | Account creation timestamp (`YYYY-MM-DDTHH:mm:ssZ`) |

---

### 3.2 PASSENGER
Saved passenger entries belonging to a user's master list or booking record.

| Field | Type | Nullable | Key / Constraint | Description |
| :--- | :--- | :--- | :--- | :--- |
| `passengerId` | `Integer` | No | Primary Key | Unique passenger identifier |
| `userId` | `Integer` | No | Foreign Key -> `USER.userId` | User who owns this master-list profile |
| `name` | `String` | No | - | Passenger full name |
| `age` | `Integer` | No | Positive Int | Age in completed years |
| `gender` | `String` | No | - | `"MALE" \| "FEMALE" \| "OTHER"` |
| `idProofType` | `Enum` | No | ID Proof Enum | Document type used for verification |
| `idProofReference`| `String` | No | Masked / Unique | ID card reference number |
| `disabilityType` | `Enum` | No | Disability Enum | Default `"NONE"` |
| `concessionType` | `Enum` | No | Concession Enum | Applicable concession (Default `"NONE"`) |
| `berthPreference`| `Enum` | No | Berth Enum | Desired berth preference |

---

### 3.3 STAFF
Operational metadata and job profiles for railway personnel.

| Field | Type | Nullable | Key / Constraint | Description |
| :--- | :--- | :--- | :--- | :--- |
| `staffId` | `Integer` | No | Primary Key | Internal staff identifier |
| `userId` | `Integer` | No | Foreign Key -> `USER.userId` | Linked authentication user record |
| `employeeId` | `String` | No | Unique | Official railway employee code (e.g. `EMP-8821`) |
| `name` | `String` | No | - | Full name of staff member |
| `designation` | `String` | No | - | Role title (e.g. `Ticket Collector (TC)`, `Station Manager`) |
| `assignedStationId` | `Integer` | Yes | Foreign Key -> `STATION.stationId` | Base station assignment |
| `status` | `Enum` | No | - | `"ON_DUTY" \| "OFF_DUTY" \| "ON_LEAVE"` |

---

### 3.4 STATION
Physical railway stations where trains originate, halt, or terminate.

| Field | Type | Nullable | Key / Constraint | Description |
| :--- | :--- | :--- | :--- | :--- |
| `stationId` | `Integer` | No | Primary Key | Unique station ID |
| `stationCode` | `String` | No | Unique (3-4 chars) | Official IR station code (e.g., `NDLS`, `BCT`) |
| `stationName` | `String` | No | - | Complete station name (e.g., `New Delhi Railway Station`) |
| `city` | `String` | No | - | City location |
| `state` | `String` | No | - | State/Territory |

---

### 3.5 TRAIN
Master configuration for train services.

| Field | Type | Nullable | Key / Constraint | Description |
| :--- | :--- | :--- | :--- | :--- |
| `trainId` | `Integer` | No | Primary Key | Unique internal train ID |
| `trainNumber` | `String` | No | Unique (5 digits) | Official train number (e.g. `"12951"`) |
| `trainName` | `String` | No | - | Train name (e.g. `"Mumbai Tejas Rajdhani Express"`) |
| `trainType` | `String` | No | - | `"RAJDHANI" \| "SHATABDI" \| "VANDE_BHARAT" \| "EXPRESS"` |
| `sourceStationId`| `Integer`| No | Foreign Key -> `STATION.stationId` | Originating station |
| `destinationStationId` | `Integer` | No | Foreign Key -> `STATION.stationId`| Terminating station |
| `runningDays` | `Array<String>` | No | ISO Day codes | Days running (e.g. `["MON", "TUE", "WED"]`) |
| `status` | `Enum` | No | Train Status | `"ACTIVE" \| "CANCELLED" \| "RESCHEDULED"` |

---

### 3.6 ROUTE
The ordered station stop sequence and timetable for a train.

| Field | Type | Nullable | Key / Constraint | Description |
| :--- | :--- | :--- | :--- | :--- |
| `routeId` | `Integer` | No | Primary Key | Unique route step ID |
| `trainId` | `Integer` | No | Foreign Key -> `TRAIN.trainId` | Train serviced |
| `stationId` | `Integer` | No | Foreign Key -> `STATION.stationId` | Station of stop |
| `stopSequence` | `Integer` | No | Positive Int | 1-indexed order along the route |
| `arrivalTime` | `String` | No | 24-hr `HH:mm` | Scheduled arrival time |
| `departureTime`| `String` | No | 24-hr `HH:mm` | Scheduled departure time |
| `distanceFromOrigin` | `Integer` | No | Kilometers | Cumulative distance from source station |
| `platformNumber` | `Integer` | No | - | Designated platform number |

---

### 3.7 SCHEDULE
Dated physical runs of a train.

| Field | Type | Nullable | Key / Constraint | Description |
| :--- | :--- | :--- | :--- | :--- |
| `scheduleId` | `Integer` | No | Primary Key | Unique schedule run ID |
| `trainId` | `Integer` | No | Foreign Key -> `TRAIN.trainId` | Linked train |
| `journeyDate` | `String` | No | `YYYY-MM-DD` | Date of departure from source station |
| `status` | `Enum` | No | Schedule Status | `"ON_TIME" \| "DELAYED" \| "CANCELLED"` |
| `delayMinutes`| `Integer` | No | Minutes (>=0) | Current operational delay |

---

### 3.8 COACH
Physical coaches composing a train rake.

| Field | Type | Nullable | Key / Constraint | Description |
| :--- | :--- | :--- | :--- | :--- |
| `coachId` | `Integer` | No | Primary Key | Unique coach record ID |
| `trainId` | `Integer` | No | Foreign Key -> `TRAIN.trainId` | Assigned train |
| `coachNumber` | `String` | No | - | Visible coach code (e.g. `"B1"`, `"A2"`, `"S3"`) |
| `coachType` | `String` | No | - | Physical specification (e.g. `"AC_3_TIER"`) |
| `classType` | `Enum` | No | Class Enum | Service class (`"1A"`, `"2A"`, `"3A"`, `"SL"`, `"CC"`, `"EC"`, `"2S"`) |

---

### 3.9 SEAT
Individual berths or chairs within a coach.

| Field | Type | Nullable | Key / Constraint | Description |
| :--- | :--- | :--- | :--- | :--- |
| `seatId` | `Integer` | No | Primary Key | Unique seat ID |
| `coachId` | `Integer` | No | Foreign Key -> `COACH.coachId` | Containing coach |
| `seatNumber` | `Integer` | No | Positive Int | Physical seat number (e.g. `23`) |
| `berthType` | `Enum` | No | Berth Enum | `"LOWER" \| "MIDDLE" \| "UPPER" \| "SIDE_LOWER" \| "SIDE_UPPER" \| "WINDOW" \| "AISLE"` |
| `seatStatus` | `Enum` | No | Seat Status | Current master status: `"AVAILABLE" \| "BOOKED" \| "RESERVED" \| "BLOCKED"` |

---

### 3.10 AVAILABILITY
Snapshot counts of unreserved, RAC, and Waitlist tokens for a train, date, class, and quota.

| Field | Type | Nullable | Key / Constraint | Description |
| :--- | :--- | :--- | :--- | :--- |
| `trainId` | `Integer` | No | Foreign Key -> `TRAIN.trainId` | Target train |
| `journeyDate` | `String` | No | `YYYY-MM-DD` | Journey departure date |
| `classType` | `Enum` | No | Class Enum | Travel class |
| `quota` | `Enum` | No | Quota Enum | Applied quota |
| `availableSeats`| `Integer`| No | Count (>=0) | Free confirmed berths available |
| `racCount` | `Integer` | No | Count (>=0) | RAC allocations currently open |
| `waitingListCount`| `Integer`| No | Count (>=0) | Waitlist tokens currently issued |

---

### 3.11 BOOKING
Master transaction representing a ticket reservation under a single PNR.

| Field | Type | Nullable | Key / Constraint | Description |
| :--- | :--- | :--- | :--- | :--- |
| `bookingId` | `Integer` | No | Primary Key | Unique internal booking identifier |
| `pnr` | `String` | No | Unique 10 digits | Official Passenger Name Record code |
| `userId` | `Integer` | No | Foreign Key -> `USER.userId` | Booking owner |
| `trainId` | `Integer` | No | Foreign Key -> `TRAIN.trainId` | Booked train |
| `journeyDate` | `String` | No | `YYYY-MM-DD` | Date of journey |
| `boardingStationId` | `Integer` | No | Foreign Key -> `STATION.stationId`| Passenger boarding point |
| `destinationStationId` | `Integer` | No | Foreign Key -> `STATION.stationId`| Passenger destination point |
| `classType` | `Enum` | No | Class Enum | Booked class |
| `quota` | `Enum` | No | Quota Enum | Booked quota |
| `bookingStatus` | `Enum` | No | Booking Status | `"CONFIRMED" \| "RAC" \| "WAITING_LIST" \| "CANCELLED" \| "PAYMENT_PENDING" \| "FAILED"` |
| `totalFare` | `Float` | No | Decimal (2 pl) | Total monetary fare charged |
| `createdAt` | `String` | No | ISO 8601 | Booking timestamp |

---

### 3.12 BOOKING_PASSENGER
Individual passenger line-item tied to a master booking.

| Field | Type | Nullable | Key / Constraint | Description |
| :--- | :--- | :--- | :--- | :--- |
| `bookingPassengerId` | `Integer` | No | Primary Key | Unique line-item ID |
| `bookingId` | `Integer` | No | Foreign Key -> `BOOKING.bookingId` | Parent booking |
| `passengerId` | `Integer` | No | Foreign Key -> `PASSENGER.passengerId` | Passenger identity |
| `coachNumber` | `String` | Yes | - | Allocated coach (null if Waitlisted) |
| `seatNumber` | `Integer` | Yes | - | Allocated seat number (null if Waitlisted) |
| `berthType` | `Enum` | Yes | Berth Enum | Allocated berth type |
| `passengerStatus`| `Enum` | No | Passenger Status | `"CONFIRMED" \| "RAC" \| "WAITING_LIST" \| "CANCELLED" \| "BOARDED" \| "NO_SHOW"` |

---

### 3.13 PAYMENT
Monetary settlement record tied to a booking.

| Field | Type | Nullable | Key / Constraint | Description |
| :--- | :--- | :--- | :--- | :--- |
| `paymentId` | `Integer` | No | Primary Key | Unique payment transaction ID |
| `bookingId` | `Integer` | No | Foreign Key -> `BOOKING.bookingId` | Associated booking |
| `amount` | `Float` | No | Decimal | Exact amount processed |
| `paymentMode` | `String` | No | - | `"CREDIT_CARD" \| "DEBIT_CARD" \| "UPI" \| "NET_BANKING"` |
| `paymentStatus` | `Enum` | No | Payment Status | `"PENDING" \| "SUCCESS" \| "FAILED"` |
| `gatewayTransactionId` | `String` | No | Unique | Gateway reference (Never store raw card details!) |
| `paidAt` | `String` | Yes | ISO 8601 | Timestamp of successful payment settlement |

---

### 3.14 CANCELLATION
Official cancellation record for a booking or individual passenger.

| Field | Type | Nullable | Key / Constraint | Description |
| :--- | :--- | :--- | :--- | :--- |
| `cancellationId` | `Integer` | No | Primary Key | Unique cancellation ID |
| `bookingId` | `Integer` | No | Foreign Key -> `BOOKING.bookingId` | Cancelled booking |
| `passengerId` | `Integer` | Yes | Foreign Key -> `PASSENGER.passengerId` | Null if entire PNR cancelled; set if single passenger |
| `cancellationDate` | `String` | No | ISO 8601 | Cancellation timestamp |
| `cancellationCharge`| `Float` | No | Decimal | Deducted railway cancellation penalty |
| `refundAmount` | `Float` | No | Decimal | Amount to be refunded to original payment mode |
| `status` | `Enum` | No | - | `"PROCESSED" \| "PENDING"` |

---

### 3.15 TDR (Ticket Deposit Receipt)
Formal claim for refund filed when travel was unfulfilled due to operational failures.

| Field | Type | Nullable | Key / Constraint | Description |
| :--- | :--- | :--- | :--- | :--- |
| `tdrId` | `Integer` | No | Primary Key | Unique TDR tracking ID |
| `bookingId` | `Integer` | No | Foreign Key -> `BOOKING.bookingId` | Associated booking |
| `pnr` | `String` | No | 10 digits | PNR under claim |
| `reason` | `String` | No | - | Justification (e.g. `TRAIN_DELAYED_OVER_3_HOURS`, `AC_FAILURE`) |
| `submittedAt` | `String` | No | ISO 8601 | Submission timestamp |
| `status` | `Enum` | No | TDR Status | `"FILED" \| "UNDER_REVIEW" \| "APPROVED" \| "REJECTED" \| "REFUND_PROCESSED"` |
| `refundAmount` | `Float` | Yes | Decimal | Approved refund amount |

---

### 3.16 NOTIFICATION
Direct alerts dispatched to an individual user account.

| Field | Type | Nullable | Key / Constraint | Description |
| :--- | :--- | :--- | :--- | :--- |
| `notificationId` | `Integer` | No | Primary Key | Unique alert ID |
| `userId` | `Integer` | No | Foreign Key -> `USER.userId` | Target recipient |
| `type` | `String` | No | - | `"BOOKING_CONFIRMATION" \| "STATUS_UPDATE" \| "DELAY" \| "PLATFORM_CHANGE" \| "EMERGENCY"` |
| `title` | `String` | No | - | Brief title heading |
| `message` | `String` | No | - | Full notification message body |
| `referenceId` | `String` | Yes | - | PNR, train number, or station code reference |
| `isRead` | `Boolean` | No | Boolean | Read state toggle |
| `createdAt` | `String` | No | ISO 8601 | Generation timestamp |

---

### 3.17 GRIEVANCE
Complaints or service feedback logged by passengers.

| Field | Type | Nullable | Key / Constraint | Description |
| :--- | :--- | :--- | :--- | :--- |
| `grievanceId` | `Integer` | No | Primary Key | Unique grievance identifier |
| `userId` | `Integer` | No | Foreign Key -> `USER.userId` | Passenger author |
| `category` | `Enum` | No | Grievance Category | Category classification |
| `subject` | `String` | No | - | Short summary of issue |
| `description` | `String` | No | - | Full description |
| `status` | `Enum` | No | Grievance Status | `"SUBMITTED" \| "IN_PROGRESS" \| "RESOLVED" \| "REJECTED"` |
| `response` | `String` | Yes | - | Official resolution remarks from railway authority |
| `createdAt` | `String` | No | ISO 8601 | Timestamp filed |

---

### 3.18 FINE
On-spot monetary penalty levied by Ticket Collectors (TC).

| Field | Type | Nullable | Key / Constraint | Description |
| :--- | :--- | :--- | :--- | :--- |
| `fineId` | `Integer` | No | Primary Key | Unique penalty record ID |
| `staffId` | `Integer` | No | Foreign Key -> `STAFF.staffId` | Issuing Ticket Collector |
| `passengerName` | `String` | No | - | Name of offender |
| `idProofReference`| `String` | Yes | - | Offender ID document reference |
| `trainId` | `Integer` | Yes | Foreign Key -> `TRAIN.trainId` | Train where offense occurred |
| `amount` | `Float` | No | Decimal | Penalty amount charged |
| `reason` | `String` | No | - | Violation reason (e.g. `TICKETLESS_TRAVEL`, `UNAUTHORIZED_CLASS`) |
| `paymentStatus` | `Enum` | No | Fine Status | `"PAID" \| "UNPAID"` |
| `issuedAt` | `String` | No | ISO 8601 | Issue timestamp |

---

### 3.19 INCIDENT
Operational emergency or safety event logged by staff.

| Field | Type | Nullable | Key / Constraint | Description |
| :--- | :--- | :--- | :--- | :--- |
| `incidentId` | `Integer` | No | Primary Key | Unique incident tracking ID |
| `reportedBy` | `Integer` | No | Foreign Key -> `STAFF.staffId` | Reporting staff member |
| `type` | `String` | No | - | `"MEDICAL_EMERGENCY" \| "SECURITY" \| "TECHNICAL_FAILURE" \| "ACCIDENT"` |
| `severity` | `Enum` | No | Severity Enum | `"LOW" \| "MEDIUM" \| "HIGH" \| "CRITICAL"` |
| `locationType` | `String` | No | - | `"TRAIN" \| "STATION"` |
| `stationId` | `Integer` | Yes | Foreign Key -> `STATION.stationId` | Associated station if applicable |
| `trainId` | `Integer` | Yes | Foreign Key -> `TRAIN.trainId` | Associated train if applicable |
| `description` | `String` | No | - | Details and symptoms of incident |
| `status` | `Enum` | No | - | `"REPORTED" \| "ACKNOWLEDGED" \| "RESOLVED"` |
| `createdAt` | `String` | No | ISO 8601 | Incident timestamp |

---

### 3.20 CROWD_REPORT
Live assessment of station platform density.

| Field | Type | Nullable | Key / Constraint | Description |
| :--- | :--- | :--- | :--- | :--- |
| `crowdReportId` | `Integer` | No | Primary Key | Unique crowd log ID |
| `stationId` | `Integer` | No | Foreign Key -> `STATION.stationId` | Target station |
| `platformNumber`| `Integer` | No | Positive Int | Station platform number |
| `crowdLevel` | `Enum` | No | Crowd Level Enum | `"LOW" \| "MODERATE" \| "HIGH" \| "OVERCROWDED"` |
| `headCount` | `Integer` | Yes | Estimate | Estimated passenger head count |
| `recordedBy` | `Integer` | No | Foreign Key -> `STAFF.staffId` | Reporting staff member |
| `recordedAt` | `String` | No | ISO 8601 | Observation timestamp |

---

### 3.21 CLEANLINESS_REPORT
Hygiene and maintenance issue reports on coaches or platforms.

| Field | Type | Nullable | Key / Constraint | Description |
| :--- | :--- | :--- | :--- | :--- |
| `reportId` | `Integer` | No | Primary Key | Unique cleanliness report ID |
| `reportedBy` | `Integer` | No | Foreign Key -> `STAFF.staffId` | Reporting staff member |
| `trainId` | `Integer` | Yes | Foreign Key -> `TRAIN.trainId` | Affected train (null if on platform) |
| `coachId` | `Integer` | Yes | Foreign Key -> `COACH.coachId` | Affected coach (null if on platform) |
| `stationId` | `Integer` | Yes | Foreign Key -> `STATION.stationId` | Affected station (null if on train) |
| `platformNumber`| `Integer` | Yes | Positive Int | Affected platform |
| `issueType` | `Enum` | No | Issue Type Enum | Classification of issue |
| `description` | `String` | No | - | Specific issue notes |
| `status` | `Enum` | No | - | `"REPORTED" \| "ATTENDING" \| "RESOLVED"` |
| `createdAt` | `String` | No | ISO 8601 | Log timestamp |

---

### 3.22 AUDIT_LOG
Immutable forensic trace of administrative operations.

| Field | Type | Nullable | Key / Constraint | Description |
| :--- | :--- | :--- | :--- | :--- |
| `auditId` | `Integer` | No | Primary Key | Unique audit event identifier |
| `userId` | `Integer` | No | Foreign Key -> `USER.userId` | Admin actor executing the change |
| `action` | `String` | No | - | Operation verb (`"CREATE" \| "UPDATE" \| "DELETE" \| "OVERRIDE"`) |
| `entityType` | `String` | No | - | Entity modified (e.g. `"TRAIN"`, `"FARE"`, `"BOOKING"`) |
| `entityId` | `String` | No | - | Identifier of affected target record |
| `oldValue` | `String / Object`| Yes | - | JSON representation of state before modification |
| `newValue` | `String / Object`| Yes | - | JSON representation of state after modification |
| `createdAt` | `String` | No | ISO 8601 | Log timestamp |
