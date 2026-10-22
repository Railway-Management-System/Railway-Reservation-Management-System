# REST API Contract Specification

## 1. Overview & General Standards

This API contract defines the exact interface for all communication between the frontends and the backend for the **Railway Reservation & Management System**. It aligns with the Business Rules (`docs/BUSINESS_RULES.md`), the Relational Schema (`docs/DATA_SCHEMA.md`), and the approved ER diagram.

### 1.1 HTTP Response Conventions
- All successful responses return JSON with standard wrapper schemas:
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
    "code": "BERTH_PREFERENCE_NOT_MET",
    "message": "The requested berth preference could not be satisfied for all passengers in the selected class."
  }
}
```

### 1.2 Canonical Business Error Codes (BR-B5)
All error responses return one of the official system error codes:
- `SEAT_NOT_AVAILABLE`: No seats remain in the requested quota or segment.
- `WAITING_LIST_FULL`: Waitlist capacity (25% of quota confirmed seats) is exhausted.
- `NOT_ALL_CONFIRMED`: User opted "book only if confirmed" and at least one passenger would be RAC or WL.
- `HOLD_EXPIRED`: The seat hold timer (HOLD_MINUTES) lapsed before payment completion.
- `TRAIN_NOT_RUNNING`: The train does not operate on the origin departure date corresponding to the boarding date (BR-B1a).
- `QUOTA_NOT_ELIGIBLE`: Passenger roster does not satisfy quota criteria (e.g., non-female in LADIES, non-senior in SENIOR_CITIZEN).
- `CONCESSION_PROOF_REQUIRED`: Concession selected without valid proof type or certificate reference.
- `NO_ADULT_PASSENGER`: Booking attempt contains no passenger aged 18 or older (BR-Q15).
- `BERTH_PREFERENCE_NOT_MET`: "Book only if preferred berth type is given" ticked (works in SL/3A/2A/1A) and preferred berth type could not be given or passenger would be RAC/WL (BR-B6a).
- `MONTHLY_LIMIT_EXCEEDED`: User exceeded monthly limit (12 tickets/PNRs per calendar month, or 24 if Aadhaar-verified; settings MAX_TICKETS_PER_MONTH and MAX_TICKETS_PER_MONTH_AADHAAR_VERIFIED; counted by booking date, includes cancelled, excludes FAILED; shared COUNTER_WALKIN exempt) (BR-B15).
- `CHART_PREPARED`: Booking or online cancellation attempted at or after chart time (BR-B12a, BR-B16).

### 1.3 Authentication Header
Endpoints requiring authentication expect the standard Bearer header:
```http
Authorization: Bearer <jwt_or_mock_token>
```

---

## 2. Authentication & User Account APIs

### 2.1 Passenger Registration
- **Method / Endpoint**: `POST /api/auth/passenger/register`
- **Role**: Public (Unauthenticated)
- **Request Body**:
```json
{
  "name": "Rahul Sharma",
  "email": "rahul.sharma@example.com",
  "phone": "+91-9876543210",
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
    "phone": "+91-9876543210",
    "role": "PASSENGER",
    "accountStatus": "ACTIVE",
    "aadhaarVerified": false,
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
    "aadhaarVerified": false,
    "monthlyBookingsUsed": 3,
    "monthlyBookingsAllowed": 12,
    "token": "mock-token-passenger-1"
  }
}
```

---

### 2.3 Staff Login
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
    "currentDuty": "TRAIN_DUTY",
    "assignedStationId": 10,
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
    "adminId": 1,
    "name": "Rajesh Gupta",
    "role": "ADMIN",
    "accessLevel": "SUPER_ADMIN",
    "token": "mock-token-admin-1"
  }
}
```

---

## 3. Train Enquiry & Availability APIs

### 3.1 Search Trains with Running-Day Check (BR-B1a)
- **Method / Endpoint**: `GET /api/trains/search`
- **Role**: Public / Passenger
- **Query Parameters**:
  - `sourceStationId` (int, required) e.g. `21` (BCT - Mumbai Central)
  - `destinationStationId` (int, required) e.g. `10` (NDLS - New Delhi)
  - `journeyDate` (YYYY-MM-DD, required) - Passenger boarding date (within 7-day window, BR-B1)
  - `classType` (string, optional) e.g. `3A`
  - `quota` (string, optional, default `GENERAL`) e.g. `GENERAL`
- **Business Logic (BR-B1a)**:
  - System locates the boarding stop along the train's route and retrieves `day_offset`.
  - Calculates `originDate = journeyDate - day_offset`.
  - Checks if the train operates on `originDate`'s day-of-week (`MON`–`SUN`).
  - If train does not run on that weekday, the train is omitted from search results.
- **Response (200 OK)**:
```json
{
  "success": true,
  "data": [
    {
      "trainId": 129,
      "trainNumber": "12951",
      "shortName": "TEJAS RAJDHANI",
      "displayName": "Mumbai Tejas Rajdhani Express (12951)",
      "trainType": "RAJDHANI",
      "boardingStation": {
        "stationId": 21,
        "stationCode": "BCT",
        "stationName": "MUMBAI CENTRAL",
        "departureTime": "17:00",
        "boardingDate": "2026-10-20",
        "dayOffset": 0
      },
      "destinationStation": {
        "stationId": 10,
        "stationCode": "NDLS",
        "stationName": "NEW DELHI",
        "arrivalTime": "08:32",
        "arrivalDate": "2026-10-21",
        "dayOffset": 1
      },
      "originDate": "2026-10-20",
      "duration": "15h 32m",
      "distanceKm": 1386,
      "runningDays": ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"],
      "availableClasses": [
        {
          "classType": "3A",
          "availableSeats": 42,
          "racCount": 10,
          "waitingListCount": 0,
          "baseFare": 1857.24,
          "superfastCharge": 45.00,
          "reservationCharge": 40.00,
          "gst": 97.11,
          "estimatedTotalFare": 2039.35
        },
        {
          "classType": "2A",
          "availableSeats": 18,
          "racCount": 4,
          "waitingListCount": 0,
          "baseFare": 2702.70,
          "superfastCharge": 45.00,
          "reservationCharge": 50.00,
          "gst": 139.89,
          "estimatedTotalFare": 2937.59
        }
      ]
    }
  ]
}
```

---

### 3.2 Get Train Route & Timetable
- **Method / Endpoint**: `GET /api/trains/:trainId`
- **Role**: Public / Passenger / Staff
- **Response (200 OK)**:
```json
{
  "success": true,
  "data": {
    "trainId": 129,
    "trainNumber": "12951",
    "shortName": "TEJAS RAJDHANI",
    "displayName": "Mumbai Tejas Rajdhani Express (12951)",
    "trainType": "RAJDHANI",
    "sourceStationId": 21,
    "destinationStationId": 10,
    "runningDays": ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"],
    "route": [
      {
        "stopId": 1142,
        "stationId": 21,
        "stationCode": "BCT",
        "stationName": "MUMBAI CENTRAL",
        "stopSequence": 1,
        "arrivalTime": "17:00",
        "departureTime": "17:00",
        "dayOffset": 0,
        "distanceFromOriginKm": 0,
        "platformNo": 1
      },
      {
        "stopId": 1143,
        "stationId": 24,
        "stationCode": "ST",
        "stationName": "SURAT",
        "stopSequence": 2,
        "arrivalTime": "19:42",
        "departureTime": "19:47",
        "dayOffset": 0,
        "distanceFromOriginKm": 263,
        "platformNo": 1
      },
      {
        "stopId": 1144,
        "stationId": 26,
        "stationCode": "BRC",
        "stationName": "VADODARA JN",
        "stopSequence": 3,
        "arrivalTime": "21:05",
        "departureTime": "21:15",
        "dayOffset": 0,
        "distanceFromOriginKm": 392,
        "platformNo": 2
      },
      {
        "stopId": 1145,
        "stationId": 10,
        "stationCode": "NDLS",
        "stationName": "NEW DELHI",
        "stopSequence": 4,
        "arrivalTime": "08:32",
        "departureTime": "08:32",
        "dayOffset": 1,
        "distanceFromOriginKm": 1386,
        "platformNo": 3
      }
    ]
  }
}
```

---

### 3.3 Quota Availability & Fallback Advisory (BR-Q13)
- **Method / Endpoint**: `GET /api/trains/:trainId/availability`
- **Role**: Public / Passenger
- **Query Parameters**: `journeyDate`, `classType`, `quota`, `passengerCount`
- **Response (200 OK - Direct Availability)**:
```json
{
  "success": true,
  "data": {
    "trainId": 129,
    "journeyDate": "2026-10-20",
    "classType": "3A",
    "quota": "GENERAL",
    "availableSeats": 42,
    "racCount": 10,
    "waitingListCount": 0,
    "fallbackOffered": false
  }
}
```
- **Response (200 OK - Fallback Triggered per BR-Q13)**:
```json
{
  "success": true,
  "data": {
    "trainId": 129,
    "journeyDate": "2026-10-20",
    "classType": "3A",
    "requestedQuota": "LADIES",
    "availableSeats": 0,
    "fallbackOffered": true,
    "fallbackNotice": "No seats are left in the LADIES quota for this train and date. We can book you in the General quota instead. Your seat may not be your preferred one (for example an upper berth or a different coach), and General seats go first-come-first-served, so you may get RAC or Waiting List instead of a confirmed seat. Fare, refund and cancellation rules stay the same.",
    "generalQuotaStatus": {
      "availableSeats": 12,
      "projectedStatus": "CONFIRMED"
    }
  }
}
```

---

## 4. Booking & Ticket Lifecycle APIs

### 4.1 Temporary Seat Hold (Step 3 Entry, BR-B2)
- **Method / Endpoint**: `POST /api/bookings/hold`
- **Role**: Passenger / Staff
- **Purpose**: Seat hold window (HOLD_MINUTES, default 10 minutes) keeps seats, RAC or WL reserved for a PAYMENT_PENDING booking from creation until payment confirmation.
- **Request Body**:
```json
{
  "trainId": 129,
  "boardingStationId": 21,
  "destinationStationId": 10,
  "journeyDate": "2026-10-20",
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
    "holdToken": "HOLD-882104-BCT-NDLS",
    "expiresAt": "2026-10-18T16:10:00Z",
    "holdDurationSeconds": 600,
    "quota": "GENERAL",
    "seatsHeld": 2
  }
}
```
- **Errors**: `400 Bad Request` (`MONTHLY_LIMIT_EXCEEDED`, `NO_ADULT_PASSENGER`, `SEAT_NOT_AVAILABLE`, `CHART_PREPARED`). Checked on Create Booking (BR-B15).

---

### 4.2 Create Booking (Initiate Payment Pending State)
- **Method / Endpoint**: `POST /api/bookings`
- **Role**: Passenger / Staff
- **Request Body**:
```json
{
  "holdToken": "HOLD-882104-BCT-NDLS",
  "trainId": 129,
  "journeyDate": "2026-10-20",
  "boardingStationId": 21,
  "destinationStationId": 10,
  "classType": "3A",
  "quota": "GENERAL",
  "requestedQuota": "LADIES",
  "continueWithGeneralQuota": true,
  "passengers": [
    {
      "name": "Sunita Sharma",
      "age": 48,
      "gender": "FEMALE",
      "idProofType": "AADHAAR",
      "idProofReference": "XXXX-XXXX-3829",
      "disabilityType": "NONE",
      "concessionType": "NONE",
      "berthPreference": "LOWER"
    },
    {
      "name": "Ananya Sharma",
      "age": 19,
      "gender": "FEMALE",
      "idProofType": "AADHAAR",
      "idProofReference": "XXXX-XXXX-9912",
      "disabilityType": "NONE",
      "concessionType": "NONE",
      "berthPreference": "MIDDLE"
    }
  ],
  "preferences": {
    "autoUpgrade": true,
    "bookOnlyIfConfirmed": false,
    "berthCondition": true,
    "travelInsurance": true
  }
}
```
- **Response (201 Created)**:
```json
{
  "success": true,
  "data": {
    "pnr": "2849102841",
    "bookingStatus": "PAYMENT_PENDING",
    "totalFare": 4079.60,
    "fareBreakdown": [
      {
        "passengerNo": 1,
        "name": "Sunita Sharma",
        "baseFare": 1857.24,
        "concessionDiscount": 0.00,
        "reservationCharge": 40.00,
        "superfastCharge": 45.00,
        "tatkalCharge": 0.00,
        "dynamicSurcharge": 0.00,
        "gst": 97.11,
        "insurance": 0.45,
        "totalFare": 2039.80
      },
      {
        "passengerNo": 2,
        "name": "Ananya Sharma",
        "baseFare": 1857.24,
        "concessionDiscount": 0.00,
        "reservationCharge": 40.00,
        "superfastCharge": 45.00,
        "tatkalCharge": 0.00,
        "dynamicSurcharge": 0.00,
        "gst": 97.11,
        "insurance": 0.45,
        "totalFare": 2039.80
      }
    ],
    "expiresAt": "2026-10-18T16:10:00Z"
  }
}
```
- **Errors**: `BERTH_PREFERENCE_NOT_MET`, `NOT_ALL_CONFIRMED`, `HOLD_EXPIRED`, `CHART_PREPARED`, `MONTHLY_LIMIT_EXCEEDED`.

---

### 4.3 Razorpay TEST Mode Payment Endpoints (BR-B7)

#### 4.3.1 Create Gateway Order
- **Method / Endpoint**: `POST /api/payments/razorpay/order`
- **Role**: Passenger
- **Request Body**:
```json
{
  "pnr": "2849102841"
}
```
- **Response (200 OK)**:
```json
{
  "success": true,
  "data": {
    "orderId": "order_test_9921048",
    "amount": 407960,
    "currency": "INR",
    "keyId": "rzp_test_51Abc9921",
    "pnr": "2849102841"
  }
}
```

#### 4.3.2 Verify Gateway Payment Signature & Issue Ticket
- **Method / Endpoint**: `POST /api/payments/razorpay/verify`
- **Role**: Passenger
- **Request Body**:
```json
{
  "pnr": "2849102841",
  "razorpayOrderId": "order_test_9921048",
  "razorpayPaymentId": "pay_test_8829104",
  "razorpaySignature": "9a38f420b923184..."
}
```
- **Response (200 OK - Successful Payment within Hold Timer)**:
```json
{
  "success": true,
  "data": {
    "paymentId": 501,
    "pnr": "2849102841",
    "paymentStatus": "SUCCESS",
    "gatewayPaymentId": "pay_test_8829104",
    "paidAt": "2026-10-18T16:05:22Z",
    "bookingStatus": "CONFIRMED",
    "passengers": [
      {
        "passengerNo": 1,
        "name": "Sunita Sharma",
        "coachNumber": "B1",
        "seatNumber": 23,
        "berthType": "LOWER",
        "status": "CONFIRMED"
      },
      {
        "passengerNo": 2,
        "name": "Ananya Sharma",
        "coachNumber": "B1",
        "seatNumber": 25,
        "berthType": "MIDDLE",
        "status": "CONFIRMED"
      }
    ]
  }
}
```
- **Response (200 OK - Late Payment After Hold Expiry, BR-B14)**:
```json
{
  "success": false,
  "error": {
    "code": "HOLD_EXPIRED",
    "message": "Payment arrived after the seat hold expired (HOLD_MINUTES). No seats were assigned. Your payment has been refunded in full automatically."
  },
  "data": {
    "bookingStatus": "FAILED",
    "refund": {
      "refundId": 301,
      "amount": 4079.60,
      "reason": "PAYMENT_AFTER_EXPIRY",
      "status": "PROCESSED",
      "gatewayPaymentId": "pay_test_8829104"
    }
  }
}
```

---

### 4.4 Station Counter Booking API (Section 12, BR-CB1 to BR-CB8)
- **Method / Endpoint**: `POST /api/counter/bookings`
- **Role**: Staff (with active `COUNTER_DUTY` shift)
- **Request Body**:
```json
{
  "trainId": 129,
  "journeyDate": "2026-10-20",
  "boardingStationId": 21,
  "destinationStationId": 10,
  "classType": "3A",
  "quota": "GENERAL",
  "isWalkin": true,
  "registeredUserId": null,
  "passengers": [
    {
      "name": "Kishore Kumar",
      "age": 62,
      "gender": "MALE",
      "idProofType": "AADHAAR",
      "idProofReference": "XXXX-XXXX-4811",
      "disabilityType": "NONE",
      "concessionType": "NONE",
      "berthPreference": "LOWER"
    }
  ],
  "payment": {
    "method": "CASH",
    "amountCollected": 2039.80
  }
}
```
- **Response (201 Created)**:
```json
{
  "success": true,
  "data": {
    "pnr": "6810294819",
    "channel": "COUNTER",
    "bookedByStaffId": 1,
    "userAccount": "COUNTER_WALKIN",
    "bookingStatus": "CONFIRMED",
    "totalFare": 2039.80,
    "payment": {
      "method": "CASH",
      "status": "SUCCESS"
    },
    "passengers": [
      {
        "passengerNo": 1,
        "name": "Kishore Kumar",
        "coachNumber": "B2",
        "seatNumber": 12,
        "berthType": "LOWER",
        "status": "CONFIRMED"
      }
    ],
    "printableTicketText": "INDIAN RAILWAYS / PNR: 6810294819 / BCT -> NDLS / COACH: B2 SEAT: 12 (LOWER) / FARE: Rs 2039.80 (CASH PAID)"
  }
}
```

---

### 4.5 Ticket Cancellation & Refund Estimation (Section 8)
- **Method / Endpoint**: `POST /api/bookings/:pnr/cancel`
- **Role**: Passenger / Staff / Admin
- **Request Body**:
```json
{
  "passengerNos": [2]
}
```
*(Empty or omitted `passengerNos` cancels entire PNR)*
- **Response (200 OK)**:
```json
{
  "success": true,
  "data": {
    "cancelId": 401,
    "pnr": "2849102841",
    "cancelledPassengers": [2],
    "hoursBeforeOriginDeparture": 46.5,
    "deductionPercentage": 25.0,
    "cancellationCharge": 509.84,
    "refundAmount": 1529.51,
    "refund": {
      "refundId": 302,
      "reason": "CANCELLATION",
      "status": "PROCESSED"
    },
    "promotionTriggered": true
  }
}
```
- **Errors**: `CHART_PREPARED` (if $< 8$ hours before origin departure).

#### 4.5.1 Refund Estimate Preview (Section 8)
- **Method / Endpoint**: `GET /api/bookings/:pnr/refund-estimate`
- **Role**: Passenger (own PNR only) / Staff / Admin
- **Query Parameters**:
  - `passengerNos` (optional): Comma-separated passenger numbers to preview (e.g., `?passengerNos=1,2`). If omitted or empty, estimates refund for all active passengers on the PNR.
- **Behavior**: Strictly read-only preview using database function `fn_calculate_cancellation_refund(pnr, passenger_no, NULL)`. Modifies no database rows and records no charges or refunds.
- **Response (200 OK)**:
```json
{
  "success": true,
  "data": {
    "pnr": "2849102841",
    "hoursBeforeOriginDeparture": 46.5,
    "passengers": [
      {
        "passengerNo": 1,
        "name": "Sunita Sharma",
        "reservationStatus": "CONFIRMED",
        "fare": 1400.00,
        "charge": 350.00,
        "refundAmount": 1050.00
      }
    ],
    "totalCancellationCharge": 350.00,
    "totalRefundAmount": 1050.00
  }
}
```
- **Errors**: `404 Not Found` (Booking not found), `403 Forbidden` (Not booking owner and not staff/admin), `400 Bad Request` (Invalid passenger numbers or non-CONFIRMED booking).

---

### 4.6 File TDR (Ticket Deposit Receipt, Section 9)
- **Method / Endpoint**: `POST /api/tdr`
- **Role**: Passenger
- **Request Body**:
```json
{
  "pnr": "2849102841",
  "passengerNos": [1],
  "reason": "TRAIN_DELAYED_OVER_3_HOURS",
  "evidenceReference": "DELAY_LOG_STATION_BCT"
}
```
- **Response (201 Created)**:
```json
{
  "success": true,
  "data": {
    "tdrRefNo": 701,
    "pnr": "2849102841",
    "reason": "TRAIN_DELAYED_OVER_3_HOURS",
    "status": "FILED",
    "filedAt": "2026-10-18T16:15:00Z"
  }
}
```
- **Errors**: `400 Bad Request` (Invalid reason code, deadline exceeded, or passenger already marked `BOARDED`).

---

## 5. Staff & Operations APIs

### 5.1 Staff Duty & Passenger Chart Manifest
- **`GET /api/staff/assignments/current`**: Get active duty assignment (train, coaches, station platform, or counter window).
- **`GET /api/staff/schedules/:scheduleId/chart`**: Retrieve the immutable `CHART_SNAPSHOT` generated 8 hours prior to departure.
- **`GET /api/staff/pnr/:pnr`**: Instant lookup of passenger status and allocated berth.

### 5.2 Ticket Verification & Boarding (BR-ST3, BR-ST4)
- **`POST /api/staff/verification`**:
  - Request: `{ "pnr": "2849102841", "passengerNo": 1, "idChecked": true, "concessionChecked": false, "result": "VALID" }`
  - Response: `{ "verifyId": 801, "result": "VALID" }`
- **`POST /api/staff/boarding`**:
  - Request: `{ "pnr": "2849102841", "passengerNo": 1, "status": "BOARDED" }`
  - Errors: `400 Bad Request` if passenger has an open delay TDR (BR-ST4, BR-T6).
- **`POST /api/staff/no-show`**:
  - Request: `{ "pnr": "2849102841", "passengerNo": 1 }`
  - Purpose: Marks `NO_SHOW`, releases the berth for downstream segments, and triggers promotion pipeline (BR-ST5, BR-W4).

### 5.3 On-Spot Fines & Incident Reports
- **`POST /api/staff/fines`**:
  - Request: `{ "passengerName": "Ajay Kumar", "idProofReference": "VOTER-88491", "trainId": 129, "amount": 550.00, "reason": "TICKETLESS_TRAVEL", "paymentStatus": "PAID" }`
- **`POST /api/staff/incidents`**:
  - Request: `{ "scheduleId": 1001, "type": "MEDICAL_EMERGENCY", "severity": "HIGH", "description": "Passenger in coach B1 required immediate medical assistance." }`

### 5.4 Live Operations, Crowds & Cleanliness
- **`POST /api/staff/delays`**: Log schedule delay in minutes (`{ "scheduleId": 1001, "delayMinutes": 35 }`).
- **`POST /api/staff/crowd-reports`**: Report platform crowd density (`LOW`, `MODERATE`, `HIGH`, `OVERCROWDED`).
- **`POST /api/staff/cleanliness-reports`**: Report coach or platform hygiene defects (`TOILET_DIRTY`, `LITTER`, etc.).

---

## 6. Maintenance Management APIs (Section 13)

### 6.1 Create Maintenance Task (BR-M1, BR-M2)
- **Method / Endpoint**: `POST /api/maintenance/tasks`
- **Role**: Staff (`MAINTENANCE_DUTY`) / Admin
- **Request Body**:
```json
{
  "coachId": 301,
  "platformId": null,
  "type": "AC_SERVICE",
  "description": "AC compressor unit in Coach B1 experiencing intermittent trip."
}
```
*(Enforces CHECK: exactly one of `coachId` or `platformId` must be non-null)*
- **Response (201 Created)**:
```json
{
  "success": true,
  "data": {
    "maintId": 901,
    "coachId": 301,
    "type": "AC_SERVICE",
    "status": "OPEN",
    "createdAt": "2026-10-18T16:20:00Z"
  }
}
```

### 6.2 Update Maintenance Task Status (BR-M4)
- **Method / Endpoint**: `PUT /api/maintenance/tasks/:maintId/status`
- **Role**: Staff / Admin
- **Request Body**:
```json
{
  "status": "COMPLETED",
  "completionRemarks": "Compressor motor serviced and refrigerant refilled. Tested functional."
}
```
- **Response (200 OK)**:
```json
{
  "success": true,
  "data": {
    "maintId": 901,
    "status": "COMPLETED",
    "completedAt": "2026-10-18T18:00:00Z"
  }
}
```

---

## 7. Administrator Master Data & Settings APIs

### 7.1 System Settings Management (Section 15)
- **`GET /api/admin/settings`**: List all system settings and configurable constants.
- **`PUT /api/admin/settings/:key`**:
  - Request: `{ "value": "7" }`
  - Response: `{ "settingKey": "BOOKING_WINDOW_DAYS", "settingValue": "7", "updatedAt": "2026-10-18T16:22:00Z" }`

### 7.2 Chart Preparation Execution (BR-B12a, BR-B16)
- **Method / Endpoint**: `POST /api/admin/schedules/:scheduleId/chart-preparation`
- **Role**: Admin (or scheduled job at chart time: 8 hours prior to origin departure per BR-B12 / settings table)
- **Response (200 OK)**:
```json
{
  "success": true,
  "data": {
    "scheduleId": 1001,
    "trainNumber": "12951",
    "journeyDate": "2026-10-20",
    "chartPreparedAt": "2026-10-20T09:00:00Z",
    "summary": {
      "activeHoldsCancelled": 3,
      "unusedQuotaSeatsReleased": 28,
      "autoUpgradesProcessed": 4,
      "oldClassPromotionsTriggered": 4,
      "waitlistedPassengersCancelled": 12,
      "totalRefundsDisbursed": 24480.00,
      "chartSnapshotRowsPersisted": 842
    }
  }
}
```

### 7.3 TDR Review & Adjudication (Section 9)
- **`GET /api/admin/tdr`**: List all pending TDR claims across all trains.
- **`PUT /api/admin/tdr/:tdrRefNo`**:
  - Request: `{ "status": "APPROVED", "refundAmount": 2039.80, "remarks": "Train delay exceeded 180 min at boarding stop confirmed via schedule log." }`
  - Response:
```json
{
  "success": true,
  "data": {
    "tdrRefNo": 701,
    "status": "APPROVED",
    "refundAmount": 2039.80,
    "refund": {
      "refundId": 303,
      "reason": "TDR_APPROVED",
      "status": "PROCESSED"
    }
  }
}
```

### 7.4 Master Data Management (Stations, Trains, Routes, Coaches, Fares)
Standard CRUD endpoints maintaining zero schema drift:
- `/api/admin/stations` (158 stations with `platform_count`)
- `/api/admin/trains` (60 trains with `running_days`)
- `/api/admin/routes` (536 stops with `day_offset`)
- `/api/admin/coaches` & `/api/admin/seats`
- `/api/admin/fares` (distance slabs and class rates)
- `/api/admin/audit-logs` (immutable forensic trail)
