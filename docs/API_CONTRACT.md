# REST API Contract Specification

## 1. Overview & General Standards

This API contract defines the exact interface for all communication between the frontends and the future backend.

### 1.1 HTTP Response Conventions
- All responses return JSON with standard wrapper schemas:
```json
{
  "success": true,
  "data": { ... },
  "message": "Operation completed successfully"
}
```
- In case of failure:
```json
{
  "success": false,
  "error": {
    "code": "SEAT_NOT_AVAILABLE",
    "message": "The selected berth is already reserved for the requested route segment."
  }
}
```

### 1.2 Authentication Header
Endpoints requiring authentication must expect the header:
```http
Authorization: Bearer <mock_or_jwt_token>
```

---

## 2. Authentication APIs

### 2.1 Passenger Registration
- **Method / Endpoint**: `POST /api/auth/passenger/register`
- **Role**: Public (Unauthenticated)
- **Request Body**:
```json
{
  "name": "Rahul Sharma",
  "email": "rahul.sharma@example.com",
  "phone": "9876543210",
  "password": "Password123!"
}
```
- **Response (201 Created)**:
```json
{
  "success": true,
  "data": {
    "userId": 1,
    "name": "Rahul Sharma",
    "email": "rahul.sharma@example.com",
    "phone": "9876543210",
    "role": "PASSENGER",
    "accountStatus": "ACTIVE",
    "token": "mock-token-passenger-1"
  }
}
```
- **Errors**: `400 Bad Request` (Validation failure), `409 Conflict` (Email or phone already registered).

---

### 2.2 Passenger Login
- **Method / Endpoint**: `POST /api/auth/passenger/login`
- **Role**: Public
- **Request Body**:
```json
{
  "email": "rahul.sharma@example.com",
  "password": "Password123!"
}
```
- **Response (200 OK)**:
```json
{
  "success": true,
  "data": {
    "userId": 1,
    "name": "Rahul Sharma",
    "role": "PASSENGER",
    "token": "mock-token-passenger-1"
  }
}
```

---

### 2.3 Staff / TC Login
- **Method / Endpoint**: `POST /api/auth/staff/login`
- **Role**: Public
- **Request Body**:
```json
{
  "employeeId": "EMP-TC-101",
  "password": "StaffPassword123!"
}
```
- **Response (200 OK)**:
```json
{
  "success": true,
  "data": {
    "userId": 4,
    "staffId": 1,
    "employeeId": "EMP-TC-101",
    "name": "Vikram Singh",
    "designation": "Ticket Collector (TC)",
    "role": "STAFF",
    "assignedStationId": 1,
    "token": "mock-token-staff-1"
  }
}
```

---

### 2.4 Admin Login
- **Method / Endpoint**: `POST /api/auth/admin/login`
- **Role**: Public
- **Request Body**:
```json
{
  "email": "admin@railways.gov.in",
  "password": "AdminPassword123!"
}
```
- **Response (200 OK)**:
```json
{
  "success": true,
  "data": {
    "userId": 7,
    "name": "Rajesh Gupta",
    "role": "ADMIN",
    "token": "mock-token-admin-1"
  }
}
```

---

## 3. Train & Journey Enquiry APIs

### 3.1 Search Trains
- **Method / Endpoint**: `GET /api/trains/search`
- **Role**: Public / Passenger
- **Query Parameters**:
  - `sourceStationId` (int, required) e.g. `1`
  - `destinationStationId` (int, required) e.g. `7`
  - `journeyDate` (YYYY-MM-DD, required) e.g. `2026-10-10`
  - `classType` (optional) e.g. `3A`
  - `quota` (optional, default `GENERAL`) e.g. `GENERAL`
- **Response (200 OK)**:
```json
{
  "success": true,
  "data": [
    {
      "trainId": 101,
      "trainNumber": "12951",
      "trainName": "Mumbai Tejas Rajdhani Express",
      "trainType": "RAJDHANI",
      "departureTime": "17:00",
      "arrivalTime": "08:32",
      "duration": "15h 32m",
      "availableClasses": [
        {
          "classType": "3A",
          "availableSeats": 42,
          "racCount": 10,
          "waitingListCount": 0,
          "baseFare": 1850.00
        },
        {
          "classType": "2A",
          "availableSeats": 18,
          "racCount": 4,
          "waitingListCount": 0,
          "baseFare": 2750.00
        }
      ]
    }
  ]
}
```

---

### 3.2 Get Train Details & Route Schedule
- **Method / Endpoint**: `GET /api/trains/:trainId`
- **Role**: Public / Passenger / Staff
- **Response (200 OK)**:
```json
{
  "success": true,
  "data": {
    "trainId": 101,
    "trainNumber": "12951",
    "trainName": "Mumbai Tejas Rajdhani Express",
    "trainType": "RAJDHANI",
    "sourceStationId": 7,
    "destinationStationId": 1,
    "runningDays": ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"],
    "route": [
      {
        "routeId": 1001,
        "stationId": 7,
        "stationCode": "BCT",
        "stationName": "Mumbai Central",
        "stopSequence": 1,
        "arrivalTime": "17:00",
        "departureTime": "17:00",
        "distanceFromOrigin": 0,
        "platformNumber": 1
      },
      {
        "routeId": 1002,
        "stationId": 8,
        "stationCode": "ST",
        "stationName": "Surat",
        "stopSequence": 2,
        "arrivalTime": "19:42",
        "departureTime": "19:47",
        "distanceFromOrigin": 263,
        "platformNumber": 1
      }
    ]
  }
}
```

---

### 3.3 Get Live Class & Quota Availability
- **Method / Endpoint**: `GET /api/trains/:trainId/availability`
- **Role**: Public / Passenger
- **Query Parameters**: `journeyDate`, `classType`, `quota`
- **Response (200 OK)**:
```json
{
  "success": true,
  "data": {
    "trainId": 101,
    "journeyDate": "2026-10-10",
    "classType": "3A",
    "quota": "GENERAL",
    "availableSeats": 42,
    "racCount": 10,
    "waitingListCount": 0
  }
}
```

---

## 4. Passenger Profile & Master List APIs

### 4.1 Get Profile
- **Method / Endpoint**: `GET /api/profile`
- **Role**: Passenger
- **Response (200 OK)**:
```json
{
  "success": true,
  "data": {
    "userId": 1,
    "name": "Rahul Sharma",
    "email": "rahul.sharma@example.com",
    "phone": "9876543210",
    "role": "PASSENGER",
    "accountStatus": "ACTIVE",
    "createdAt": "2026-01-15T10:30:00Z"
  }
}
```

### 4.2 Update Profile
- **Method / Endpoint**: `PUT /api/profile`
- **Role**: Passenger
- **Request Body**:
```json
{
  "name": "Rahul K. Sharma",
  "phone": "9876543219"
}
```

### 4.3 Manage Saved Passenger Master List
- `GET /api/passengers`: List saved passengers for logged-in user.
- `POST /api/passengers`: Add passenger to master list.
- `PUT /api/passengers/:passengerId`: Update saved passenger.
- `DELETE /api/passengers/:passengerId`: Delete saved passenger.
- **Request Body for POST / PUT**:
```json
{
  "name": "Sunita Sharma",
  "age": 52,
  "gender": "FEMALE",
  "idProofType": "AADHAAR",
  "idProofReference": "XXXX-XXXX-3829",
  "disabilityType": "NONE",
  "concessionType": "SENIOR_CITIZEN",
  "berthPreference": "LOWER"
}
```

---

## 5. Booking & Ticket Lifecycle APIs

### 5.1 Temporary Seat Hold
- **Method / Endpoint**: `POST /api/bookings/hold`
- **Role**: Passenger
- **Purpose**: Initiates 10-minute temporary lock on seats when user reaches passenger details step.
- **Request Body**:
```json
{
  "trainId": 101,
  "journeyDate": "2026-10-10",
  "boardingStationId": 7,
  "destinationStationId": 1,
  "classType": "3A",
  "quota": "GENERAL",
  "passengerCount": 2
}
```
- **Response (200 OK)**:
```json
{
  "success": true,
  "data": {
    "holdToken": "HOLD-982104-BCT-NDLS",
    "expiresAt": "2026-10-06T23:25:00Z",
    "holdDurationSeconds": 600
  }
}
```

---

### 5.2 Create Booking (Initiate Payment)
- **Method / Endpoint**: `POST /api/bookings`
- **Role**: Passenger
- **Request Body**:
```json
{
  "holdToken": "HOLD-982104-BCT-NDLS",
  "trainId": 101,
  "journeyDate": "2026-10-10",
  "boardingStationId": 7,
  "destinationStationId": 1,
  "classType": "3A",
  "quota": "GENERAL",
  "passengers": [
    {
      "passengerId": 1,
      "berthPreference": "LOWER"
    },
    {
      "name": "Sunita Sharma",
      "age": 52,
      "gender": "FEMALE",
      "idProofType": "AADHAAR",
      "idProofReference": "XXXX-XXXX-3829",
      "disabilityType": "NONE",
      "concessionType": "SENIOR_CITIZEN",
      "berthPreference": "LOWER"
    }
  ],
  "preferences": {
    "autoUpgrade": true,
    "bookOnlyIfConfirmed": false,
    "preferredCoach": "B1",
    "travelInsurance": true
  }
}
```
- **Response (201 Created)**:
```json
{
  "success": true,
  "data": {
    "bookingId": 1001,
    "pnr": "2849102841",
    "bookingStatus": "PAYMENT_PENDING",
    "totalFare": 3840.50,
    "fareBreakdown": {
      "baseFare": 3700.00,
      "reservationCharge": 80.00,
      "tatkalCharge": 0.00,
      "insurancePremium": 1.50,
      "gst": 185.00,
      "concessionDiscount": 126.00
    }
  }
}
```

---

### 5.3 Settle Payment
- **Method / Endpoint**: `POST /api/payments`
- **Role**: Passenger
- **Request Body**:
```json
{
  "bookingId": 1001,
  "paymentMode": "UPI",
  "amount": 3840.50
}
```
- **Response (200 OK)**:
```json
{
  "success": true,
  "data": {
    "paymentId": 501,
    "bookingId": 1001,
    "paymentStatus": "SUCCESS",
    "gatewayTransactionId": "TXN_IRCTC_8829104",
    "paidAt": "2026-10-06T23:18:22Z",
    "booking": {
      "pnr": "2849102841",
      "bookingStatus": "CONFIRMED",
      "passengers": [
        {
          "bookingPassengerId": 2001,
          "name": "Rahul Sharma",
          "coachNumber": "B1",
          "seatNumber": 23,
          "berthType": "LOWER",
          "passengerStatus": "CONFIRMED"
        },
        {
          "bookingPassengerId": 2002,
          "name": "Sunita Sharma",
          "coachNumber": "B1",
          "seatNumber": 24,
          "berthType": "MIDDLE",
          "passengerStatus": "CONFIRMED"
        }
      ]
    }
  }
}
```

---

### 5.4 Get User Bookings & PNR Details
- **`GET /api/bookings`**: List bookings for authenticated user.
- **`GET /api/bookings/:pnr`**: View complete ticket itinerary, passenger statuses, fare, and e-ticket data.

---

### 5.5 Cancel Booking
- **Method / Endpoint**: `POST /api/bookings/:pnr/cancel`
- **Role**: Passenger / Admin
- **Request Body**:
```json
{
  "passengerIds": [1]
}
```
*(Empty or omitted `passengerIds` cancels entire PNR)*
- **Response (200 OK)**:
```json
{
  "success": true,
  "data": {
    "cancellationId": 401,
    "pnr": "2849102841",
    "cancellationCharge": 120.00,
    "refundAmount": 1800.25,
    "status": "PROCESSED"
  }
}
```

---

### 5.6 File TDR & View TDR Status
- **`POST /api/tdr`**:
  - Request: `{ "bookingId": 1001, "pnr": "2849102841", "reason": "TRAIN_DELAYED_OVER_3_HOURS" }`
  - Response: `{ "tdrId": 701, "status": "FILED" }`
- **`GET /api/tdr`**: List TDRs filed by user with review updates.

---

## 6. Notifications & Grievances APIs

### 6.1 Notifications
- **`GET /api/notifications`**: List user alerts (filter by `isRead` query param).
- **`PUT /api/notifications/:notificationId/read`**: Mark notification as read.

### 6.2 Grievances
- **`GET /api/grievances`**: List grievances logged by user.
- **`POST /api/grievances`**: File a new complaint:
```json
{
  "category": "TRAIN_CLEANLINESS",
  "subject": "Unhygienic washrooms in coach B1",
  "description": "Washrooms in coach B1 of train 12951 were not sanitized prior to departure."
}
```

---

## 7. Staff & TC Operational APIs

### 7.1 Duty & Manifest
- **`GET /api/staff/assignments`**: Get current duty assignment (train, coach, shift).
- **`GET /api/staff/assignments/:assignmentId/passengers`**: Get verified passenger chart for assigned coach/train.
- **`GET /api/staff/pnr/:pnr`**: TC instant lookup of a passenger ticket and allocated berth.

### 7.2 On-Train Verifications & Boarding
- **`POST /api/staff/verification`**:
  - Body: `{ "bookingPassengerId": 2001, "idProofVerified": true, "result": "VALID" }`
- **`POST /api/staff/boarding`**:
  - Body: `{ "bookingPassengerId": 2001, "passengerStatus": "BOARDED" }`
- **`POST /api/staff/vacancy`**:
  - Body: `{ "trainId": 101, "coachId": 301, "seatId": 401, "seatStatus": "AVAILABLE", "vacatedByNoShow": true }`

### 7.3 Fines & Penalties
- **`POST /api/staff/fines`**:
  - Body:
```json
{
  "passengerName": "Ajay Kumar",
  "idProofReference": "VOTER-88491",
  "trainId": 101,
  "amount": 550.00,
  "reason": "TICKETLESS_TRAVEL",
  "paymentStatus": "PAID"
}
```

### 7.4 Live Operations, Crowds & Incidents
- **`POST /api/staff/train-status`**: Update operational status (`ON_TIME`, `DELAYED`).
- **`POST /api/staff/delays`**: Log minute delay (`{ "trainId": 101, "delayMinutes": 25 }`).
- **`POST /api/staff/platform-status`**: Update platform assignments.
- **`POST /api/staff/crowd-reports`**: Report platform crowd density and head count.
- **`POST /api/staff/cleanliness-reports`**: Report coach/platform hygiene issues.
- **`POST /api/staff/incidents`**: Escalate security/medical emergencies (`severity`: `"HIGH"` | `"CRITICAL"`).

---

## 8. Admin Master Data & Reporting APIs

### 8.1 User & Staff Administration
- `GET /api/admin/users`: Search and list passenger accounts.
- `PUT /api/admin/users/:userId/status`: Block or unblock passenger (`accountStatus: "SUSPENDED"`).
- `GET /api/admin/staff`: List railway personnel.
- `POST /api/admin/staff`: Create new staff profile.
- `PUT /api/admin/staff/:staffId`: Update designation or assigned station.

### 8.2 Master Data CRUD
Standard CRUD endpoints with `GET`, `POST`, `PUT`, `DELETE` patterns:
- `/api/admin/trains`
- `/api/admin/stations`
- `/api/admin/routes`
- `/api/admin/schedules`
- `/api/admin/coaches`
- `/api/admin/seats`
- `/api/admin/platforms`
- `/api/admin/fares`
- `/api/admin/quotas`

### 8.3 Reservation Oversight & TDR Adjudication
- `GET /api/admin/bookings`: System-wide PNR search with filters.
- `PUT /api/admin/bookings/:pnr`: Administrative ticket override.
- `POST /api/admin/bookings/:pnr/cancel`: Administrative cancellation.
- `GET /api/admin/tdr`: View all pending TDR claims.
- `PUT /api/admin/tdr/:tdrId`: Approve/Reject TDR and specify `refundAmount`.

### 8.4 Operational Reports & Analytics
- `GET /api/admin/reports/revenue`: Aggregate ticket revenues by train/class/period.
- `GET /api/admin/reports/bookings`: Booking volume trends.
- `GET /api/admin/reports/cancellations`: Cancellation rate and refunds issued.
- `GET /api/admin/reports/occupancy`: Route seat utilization percentages.
- `GET /api/admin/reports/fines`: Fine collection summaries.
- `GET /api/admin/reports/delays`: Punctuality metrics and delay causes.
- `GET /api/admin/reports/complaints`: Grievance resolution turnaround times.
- `GET /api/admin/audit-logs`: Forensic audit trail of system activities.
