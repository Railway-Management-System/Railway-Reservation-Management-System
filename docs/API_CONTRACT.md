# REST API Contract Specification

## 1. Overview & General Standards

This API contract defines the exact interface for all communication between the frontends and the backend for the **Railway Reservation & Management System**. It aligns with the Business Rules (`docs/BUSINESS_RULES.md`), the Relational Schema (`docs/DATA_SCHEMA.md`), and the approved ER diagram.

### 1.1 HTTP Response Conventions
- All date-times are India time as 'YYYY-MM-DD HH:MM:SS', never append Z.
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

#### 4.5.2 My Bookings List
- **Method / Endpoint**: `GET /api/bookings`
- **Role**: Passenger only (STAFF and ADMIN receive 403 Forbidden; logged-in passenger sees only their own bookings, newest first, then PNR descending)
- **Query Parameters**:
  - `status` (optional): Filter bookings by status (`CONFIRMED`, `RAC`, `WAITING_LIST`, `CANCELLED`, `FAILED`, `PAYMENT_PENDING`).
  - `limit` (optional): Maximum number of bookings to return (default: `50`, maximum: `200`).
- **Response (200 OK)**:
```json
{
  "success": true,
  "data": [
    {
      "pnr": "2849100161",
      "bookingStatus": "CONFIRMED",
      "trainNumber": "12301",
      "trainName": "Howrah Rajdhani Express (12301)",
      "journeyDate": "2026-10-18",
      "classType": "3A",
      "quota": "GENERAL",
      "totalFare": 4225.94,
      "passengerCount": 2,
      "createdAt": "2026-10-17 12:00:00",
      "boardingStation": {
        "stationCode": "HWH",
        "stationName": "HOWRAH JN."
      },
      "destinationStation": {
        "stationCode": "NDLS",
        "stationName": "NEW DELHI"
      }
    }
  ]
}
```
- **Errors**: `401 Unauthorized` (Token missing, invalid, or expired), `403 Forbidden` (Only passengers can access booking list).

#### 4.5.3 PNR Status Lookup
- **Method / Endpoint**: `GET /api/bookings/:pnr`
- **Role**: Passenger (own PNR only) / Staff / Admin (may read any PNR)
- **Parameters**:
  - `pnr` (path parameter, required): 10-digit PNR string.
- **Response (200 OK)**:
```json
{
  "success": true,
  "data": {
    "pnr": "2849100001",
    "bookingStatus": "CONFIRMED",
    "trainNumber": "12301",
    "trainName": "Howrah Rajdhani Express (12301)",
    "journeyDate": "2026-10-18",
    "classType": "1A",
    "quota": "GENERAL",
    "totalFare": 15374.61,
    "passengerCount": 3,
    "createdAt": "2026-10-17 12:00:00",
    "boardingStation": {
      "stationCode": "HWH",
      "stationName": "HOWRAH JN."
    },
    "destinationStation": {
      "stationCode": "NDLS",
      "stationName": "NEW DELHI"
    },
    "passengers": [
      {
        "passengerNo": 1,
        "name": "Ekapad Dhingra",
        "age": 79,
        "gender": "MALE",
        "status": "CONFIRMED",
        "queuePosition": null,
        "coachNumber": "H1",
        "seatNumber": 3,
        "berthType": "LOWER"
      },
      {
        "passengerNo": 2,
        "name": "Advaith Tata",
        "age": 77,
        "gender": "MALE",
        "status": "CONFIRMED",
        "queuePosition": null,
        "coachNumber": "H1",
        "seatNumber": 4,
        "berthType": "UPPER"
      }
    ]
  }
}
```
- **Errors**: `404 Not Found` (Booking not found), `403 Forbidden` (Not booking owner and not staff/admin), `401 Unauthorized` (Token missing, invalid, or expired), `400 Bad Request` (Invalid PNR parameter).

---

### 4.6 File and Track TDR (Ticket Deposit Receipt, Section 9)
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
    "tdrRefNo": "TDR-2849102841-1-1",
    "pnr": "2849102841",
    "reason": "TRAIN_DELAYED_OVER_3_HOURS",
    "status": "FILED",
    "filedAt": "2026-10-18T16:15:00.000Z",
    "tdrRefNos": [
      "TDR-2849102841-1-1"
    ],
    "tdrs": [
      {
        "tdrRefNo": "TDR-2849102841-1-1",
        "passengerNo": 1,
        "status": "FILED"
      }
    ]
  }
}
```
- **Errors**: `400 Bad Request` (Invalid reason code, deadline exceeded, missing evidence, duplicate TDR, or passenger already marked `BOARDED`), `401 Unauthorized` (Token missing or invalid), `403 Forbidden` (Not PNR owner or non-passenger token), `404 Not Found` (Booking or passenger not found).

- **Method / Endpoint**: `GET /api/tdr`
- **Role**: Passenger
- **Response (200 OK)**:
```json
{
  "success": true,
  "data": [
    {
      "tdrRefNo": "TDR-2849102841-1-1",
      "pnr": "2849102841",
      "passengerNo": 1,
      "reason": "TRAIN_DELAYED_OVER_3_HOURS",
      "status": "FILED",
      "filedAt": "2026-10-18T16:15:00.000Z",
      "refundAmount": null,
      "remarks": null
    }
  ]
}
```
- **Errors**: `401 Unauthorized` (Token missing or invalid), `403 Forbidden` (Non-passenger role).

- **Method / Endpoint**: `GET /api/tdr/:tdrRefNo`
- **Role**: Passenger (own filings only)
- **Response (200 OK)**:
```json
{
  "success": true,
  "data": {
    "tdrRefNo": "TDR-2849102841-1-1",
    "pnr": "2849102841",
    "passengerNo": 1,
    "reason": "TRAIN_DELAYED_OVER_3_HOURS",
    "status": "FILED",
    "filedAt": "2026-10-18T16:15:00.000Z",
    "refundAmount": null,
    "remarks": null
  }
}
```
- **Errors**: `401 Unauthorized` (Token missing or invalid), `403 Forbidden` (Not owner of filing or non-passenger role), `404 Not Found` (TDR not found).

---

## 5. Staff & Operations APIs

### 5.1 Staff Duty & Passenger Chart Manifest

#### 5.1.1 Current Staff Duty Assignment
- **Method / Endpoint**: `GET /api/staff/assignments/current`
- **Role**: `STAFF` (staff ID extracted from JWT token)
- **Behavior**: Returns the assignment active now (`NOW() BETWEEN shift_start AND shift_end`), otherwise the most recent one with `isActive: false` (since seed shifts are in the past).
- **Response (200 OK)**:
```json
{
  "success": true,
  "data": {
    "assignId": 1,
    "staffId": 1,
    "scheduleId": 1001,
    "stationId": 21,
    "dutyType": "TRAIN_DUTY",
    "shiftStart": "2026-10-18T06:00:00.000Z",
    "shiftEnd": "2026-10-18T14:00:00.000Z",
    "isActive": false,
    "station": {
      "stationId": 21,
      "stationCode": "BCT",
      "stationName": "MUMBAI CENTRAL"
    },
    "schedule": {
      "scheduleId": 1001,
      "trainId": 101,
      "trainNumber": "12951",
      "trainName": "Mumbai Tejas Rajdhani Express",
      "journeyDate": "2026-10-18"
    }
  }
}
```
- **Errors**: `401 Unauthorized` (Token missing or invalid), `403 Forbidden` (Non-staff role), `404 Not Found` (No duty assignment found).

#### 5.1.2 Passenger Chart Manifest View
- **Method / Endpoint**: `GET /api/staff/schedules/:scheduleId/chart`
- **Role**: `STAFF` (must have assignment for that run) or `ADMIN`
- **Behavior**: Returns immutable `CHART_SNAPSHOT` rows for the schedule. Refuses with `400 Bad Request` if the chart has not been prepared yet.
- **Response (200 OK)**:
```json
{
  "success": true,
  "data": [
    {
      "snapshotId": 1,
      "scheduleId": 1111,
      "pnr": "2849100001",
      "passengerNo": 1,
      "passengerName": "Ekapad Dhingra",
      "coachNo": "H1",
      "seatNo": 3,
      "berthType": "LOWER",
      "status": "CONFIRMED",
      "fromStationId": 69,
      "fromStationCode": "HWH",
      "toStationId": 10,
      "toStationCode": "NDLS",
      "concessionFlag": false,
      "generatedAt": "2026-10-23T12:00:00.000Z"
    }
  ]
}
```
- **Errors**: `400 Bad Request` (Chart not prepared yet or invalid scheduleId), `401 Unauthorized` (Token missing or invalid), `403 Forbidden` (Staff not assigned to this schedule, or non-staff/non-admin token), `404 Not Found` (Schedule not found).

- **`GET /api/staff/pnr/:pnr`**: Instant lookup of passenger status and allocated berth.

### 5.2 Ticket Verification & Boarding (BR-ST3, BR-ST4)
- **`POST /api/staff/verification`**:
  - **Role**: `STAFF` (staff ID extracted from JWT token)
  - **Request Body**:
    ```json
    {
      "pnr": "2849102841",
      "passengerNo": 1,
      "idChecked": true,
      "concessionChecked": false,
      "result": "VALID",
      "remarks": "ID verified"
    }
    ```
  - **Response (200 OK)**:
    ```json
    {
      "success": true,
      "data": {
        "verifyId": 801,
        "result": "VALID"
      }
    }
    ```
  - **Errors**: `400 Bad Request` (Validation error or idChecked false), `401 Unauthorized` (Token missing or invalid), `403 Forbidden` (Staff not assigned on TRAIN_DUTY for this train schedule, or non-staff token), `404 Not Found` (Booking or passenger not found).

- **`POST /api/staff/boarding`**:
  - **Role**: `STAFF` (staff ID extracted from JWT token)
  - **Request Body**:
    ```json
    {
      "pnr": "2849102841",
      "passengerNo": 1
    }
    ```
  - **Response (200 OK)**:
    ```json
    {
      "success": true,
      "data": {
        "pnr": "2849102841",
        "passengerNo": 1,
        "status": "BOARDED"
      }
    }
    ```
  - **Errors**: `400 Bad Request` (Passenger has open delay TDR [BR-ST4, BR-T6] or status not eligible), `401 Unauthorized` (Token missing or invalid), `403 Forbidden` (Staff not assigned on TRAIN_DUTY for this train schedule, or non-staff token), `404 Not Found` (Booking or passenger not found).

- **`POST /api/staff/no-show`**:
  - **Role**: `STAFF` (staff ID extracted from JWT token)
  - **Request Body**:
    ```json
    {
      "pnr": "2849102841",
      "passengerNo": 1
    }
    ```
  - **Response (200 OK)**:
    ```json
    {
      "success": true,
      "data": {
        "pnr": "2849102841",
        "passengerNo": 1,
        "status": "NO_SHOW"
      }
    }
    ```
  - **Errors**: `400 Bad Request` (Passenger status not eligible for no-show [BR-ST4]), `401 Unauthorized` (Token missing or invalid), `403 Forbidden` (Staff not assigned on TRAIN_DUTY for this train schedule, or non-staff token), `404 Not Found` (Booking or passenger not found).

### 5.3 On-Spot Fines & Incident Reports

#### 5.3.1 Issue On-Spot Fine (BR-ST7)
- **Method / Endpoint**: `POST /api/staff/fines`
- **Role**: `STAFF` (staff ID extracted from JWT token)
- **Validation**:
  - `passengerName`, `idProofReference`, `trainId` are required.
  - `amount` must be greater than 0.
  - `reason` must be a valid FINE ENUM (`TICKETLESS_TRAVEL`, `UNAUTHORIZED_CLASS`, `SMOKING_NUISANCE`, `UNBOOKED_LUGGAGE`).
  - `paymentStatus` must be `PAID` or `UNPAID`.
  - ID generated as `MAX(fine_id) + 1` inside transaction.
- **Request Body**:
```json
{
  "passengerName": "Ajay Kumar",
  "idProofReference": "VOTER-88491",
  "trainId": 129,
  "amount": 550.00,
  "reason": "TICKETLESS_TRAVEL",
  "paymentStatus": "PAID"
}
```
- **Response (201 Created)**:
```json
{
  "success": true,
  "data": {
    "fineId": 101,
    "verifyId": null,
    "staffId": 1,
    "passengerName": "Ajay Kumar",
    "idProofReference": "VOTER-88491",
    "trainId": 129,
    "amount": 550.00,
    "reason": "TICKETLESS_TRAVEL",
    "paymentStatus": "PAID",
    "issuedAt": "2026-10-23 19:35:46"
  }
}
```
- **Errors**: `400 Bad Request` (Missing required field, negative/zero amount, invalid reason or status), `401 Unauthorized`, `403 Forbidden` (Non-staff token), `404 Not Found` (Train not found).

#### 5.3.2 Report Operational Incident (BR-ST8, BR-ST9)
- **Method / Endpoint**: `POST /api/staff/incidents`
- **Role**: `STAFF` (staff ID extracted from JWT token)
- **Validation**:
  - Staff member must have active or scheduled assignment for the train schedule or station.
  - `severity` must be `LOW`, `MEDIUM`, `HIGH`, or `CRITICAL`.
  - Status starts as `REPORTED`.
  - ID generated as `MAX(incident_id) + 1` inside transaction.
- **Request Body**:
```json
{
  "scheduleId": 1001,
  "stationId": 21,
  "type": "MEDICAL_EMERGENCY",
  "severity": "HIGH"
}
```
- **Response (201 Created)**:
```json
{
  "success": true,
  "data": {
    "incidentId": 101,
    "staffId": 1,
    "scheduleId": 1001,
    "stationId": 21,
    "type": "MEDICAL_EMERGENCY",
    "severity": "HIGH",
    "status": "REPORTED",
    "reportedAt": "2026-10-23 19:35:46"
  }
}
```
- **Errors**: `400 Bad Request` (Missing type, invalid severity, neither scheduleId nor stationId provided), `401 Unauthorized`, `403 Forbidden` (Staff not assigned to schedule/station, or non-staff token).

### 5.4 Live Operations, Crowds & Cleanliness

#### 5.4.1 Log Train Delay (BR-ST8)
- **Method / Endpoint**: `POST /api/staff/delays`
- **Role**: `STAFF` (must have `TRAIN_DUTY` assignment on that schedule)
- **Validation**:
  - `delayMinutes` must be an integer between 0 and 1,440.
  - Updates `TRAIN_SCHEDULE.delay_minutes` and status (`DELAYED` if > 0, `ON_TIME` if 0, preserves `CANCELLED`).
- **Request Body**:
```json
{
  "scheduleId": 1001,
  "delayMinutes": 35
}
```
- **Response (200 OK)**:
```json
{
  "success": true,
  "data": {
    "scheduleId": 1001,
    "delayMinutes": 35,
    "status": "DELAYED"
  }
}
```
- **Errors**: `400 Bad Request` (delayMinutes out of 0..1440 range or invalid scheduleId), `401 Unauthorized`, `403 Forbidden` (Staff not on TRAIN_DUTY for schedule), `404 Not Found` (Schedule not found).

#### 5.4.2 Report Platform Crowd Density (BR-ST8)
- **Method / Endpoint**: `POST /api/staff/crowd-reports`
- **Role**: `STAFF` (station inferred from staff assignment or validated against it)
- **Validation**:
  - `crowdLevel` must be `LOW`, `MODERATE`, `HIGH`, or `OVERCROWDED`.
  - Platform number must exist at the assigned station.
  - ID generated as `MAX(crowd_report_id) + 1` inside transaction.
- **Request Body**:
```json
{
  "stationId": 21,
  "platformNo": 2,
  "crowdLevel": "HIGH",
  "headCount": 150
}
```
- **Response (201 Created)**:
```json
{
  "success": true,
  "data": {
    "crowdReportId": 101,
    "stationId": 21,
    "platformNo": 2,
    "crowdLevel": "HIGH",
    "headCount": 150,
    "staffId": 1,
    "recordedAt": "2026-10-23 19:35:46"
  }
}
```
- **Errors**: `400 Bad Request` (Invalid crowdLevel, invalid platform number for station), `401 Unauthorized`, `403 Forbidden` (Staff not assigned to station, or non-staff token).

#### 5.4.3 Report Cleanliness Defect (BR-ST8)
- **Method / Endpoint**: `POST /api/staff/cleanliness-reports`
- **Role**: `STAFF` (staff ID extracted from JWT token)
- **Validation**:
  - `issueType` must be one of: `TOILET_DIRTY`, `LITTER`, `WATER_SHORTAGE`, `LINEN_SOILED`, `PESTS`, `SPILLAGE`.
  - `description` is required.
  - Optional targets: `trainId`, `coachId`, `stationId`, `platformNo`.
  - ID generated as `MAX(cleanliness_report_id) + 1` inside transaction.
- **Request Body**:
```json
{
  "issueType": "TOILET_DIRTY",
  "description": "Coach B1 toilet requires immediate sanitation",
  "trainId": 129,
  "coachId": 301
}
```
- **Response (201 Created)**:
```json
{
  "success": true,
  "data": {
    "cleanlinessReportId": 101,
    "staffId": 1,
    "trainId": 129,
    "coachId": 301,
    "stationId": null,
    "platformNo": null,
    "issueType": "TOILET_DIRTY",
    "description": "Coach B1 toilet requires immediate sanitation",
    "status": "REPORTED",
    "recordedAt": "2026-10-23 19:35:46"
  }
}
```
- **Errors**: `400 Bad Request` (Invalid issueType, missing description), `401 Unauthorized`, `403 Forbidden` (Non-staff token).

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

#### 7.1.1 List System Settings
- **Method / Endpoint**: `GET /api/admin/settings`
- **Role**: `ADMIN`
- **Response (200 OK)**:
```json
{
  "success": true,
  "data": [
    {
      "settingKey": "BOOKING_WINDOW_DAYS",
      "settingValue": "7",
      "description": "Advance booking window in days",
      "updatedAt": "2026-10-18T00:00:00.000Z"
    }
  ]
}
```
- **Errors**: `401 Unauthorized` (Token missing or invalid), `403 Forbidden` (Non-admin token).

#### 7.1.2 Update System Setting
- **Method / Endpoint**: `PUT /api/admin/settings/:key`
- **Role**: `ADMIN`
- **Validation**:
  - Key must exist in SETTING table (13 supported configuration keys).
  - Numeric settings must be strictly positive (> 0).
  - Boolean flag settings (`CONCESSION_SENIOR_ENABLED`, `DYNAMIC_FARE_ENABLED`) must be `'true'` or `'false'`.
  - Trigger `trg_audit_setting_change` automatically records audit trail into `AUDIT_LOG`.
- **Request Body**:
```json
{
  "value": "7"
}
```
*(Accepts either `"value"` or `"settingValue"`)*
- **Response (200 OK)**:
```json
{
  "success": true,
  "data": {
    "settingKey": "BOOKING_WINDOW_DAYS",
    "settingValue": "7",
    "updatedAt": "2026-10-18T16:22:00.000Z"
  }
}
```
- **Errors**: `400 Bad Request` (Unknown setting key, negative or zero numeric value, or invalid boolean value), `401 Unauthorized`, `403 Forbidden`.

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
- **`GET /api/admin/tdr`**:
  - **Role**: Admin (admin ID extracted from token)
  - **Query Parameters**: `?status=` (optional; defaults to `FILED` and `UNDER_REVIEW`)
  - **Response (200 OK)**:
```json
{
  "success": true,
  "data": [
    {
      "tdrRefNo": "TDR-2849102841-1-1",
      "pnr": "2849102841",
      "passengerNo": 1,
      "reason": "TRAIN_DELAYED_OVER_3_HOURS",
      "status": "FILED",
      "filedAt": "2026-10-18T16:15:00.000Z",
      "evidenceRef": "DELAY_LOG_STATION_BCT",
      "refundAmount": null,
      "remarks": null,
      "reviewedBy": null,
      "reviewedAt": null
    }
  ]
}
```
  - **Errors**: `401 Unauthorized` (Token missing or invalid), `403 Forbidden` (Non-admin token).

- **`PUT /api/admin/tdr/:tdrRefNo`**:
  - **Role**: Admin (admin ID extracted from token)
  - **Request Body (Approval)**:
```json
{
  "status": "APPROVED",
  "refundAmount": 2039.80,
  "remarks": "Train delay exceeded 180 min at boarding stop confirmed via schedule log."
}
```
  - **Request Body (Rejection)**:
```json
{
  "status": "REJECTED",
  "remarks": "Claim rejected: train arrived with less than 3 hours delay."
}
```
  - **Response (200 OK - Approved)**:
```json
{
  "success": true,
  "data": {
    "tdrRefNo": "TDR-2849102841-1-1",
    "status": "APPROVED",
    "refundAmount": 2039.80,
    "refund": {
      "refundId": 303,
      "reason": "TDR_APPROVED",
      "status": "PROCESSED"
    },
    "gatewayRefund": "SKIPPED"
  }
}
```
  - **Response (200 OK - Rejected)**:
```json
{
  "success": true,
  "data": {
    "tdrRefNo": "TDR-2849102841-1-1",
    "status": "REJECTED",
    "refundAmount": 0,
    "refund": null
  }
}
```
  - **Errors**: `400 Bad Request` (Invalid decision, refundAmount exceeds passenger fare line, or TDR already reviewed), `401 Unauthorized` (Token missing or invalid), `403 Forbidden` (Non-admin token), `404 Not Found` (TDR record not found).

### 7.4 Forensic Audit Logs (BR-A7)
- **Method / Endpoint**: `GET /api/admin/audit-logs`
- **Role**: `ADMIN`
- **Query Parameters**:
  - `page` (optional, default: 1)
  - `limit` (optional, default: 50, maximum: 200)
  - `tableName` (optional): Filter by table name (e.g. `SETTING`, `STAFF`)
  - `recordId` (optional): Filter by entity primary key
  - `userId` (optional): Filter by acting user ID
- **Response (200 OK)**:
```json
{
  "success": true,
  "data": [
    {
      "logId": 1,
      "userId": 2,
      "action": "UPDATE_SETTING",
      "tableName": "SETTING",
      "recordId": "HOLD_MINUTES",
      "oldValue": {
        "setting_value": "10"
      },
      "newValue": {
        "setting_value": "15"
      },
      "loggedAt": "2026-10-23 19:35:46"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 1,
    "totalPages": 1
  }
}
```
- **Errors**: `401 Unauthorized`, `403 Forbidden` (Non-admin token).

### 7.5 Analytical RANK Reports (06_reports.sql)

#### 7.5.1 List Analytical Reports
- **Method / Endpoint**: `GET /api/admin/reports`
- **Role**: `ADMIN`
- **Response (200 OK)**:
```json
{
  "success": true,
  "data": [
    {
      "reportKey": "busiest-trains",
      "reportType": "BUSIEST_TRAINS",
      "name": "Top Busiest Trains Ranked by Passenger Count",
      "description": "Ranks trains by total passengers booked and revenue using RANK() and DENSE_RANK()."
    },
    {
      "reportKey": "top-routes",
      "reportType": "TOP_ROUTES",
      "name": "Top Routes Ranked by Gross Revenue",
      "description": "Ranks route origin-destination pairs by gross revenue using DENSE_RANK()."
    },
    {
      "reportKey": "station-ranking",
      "reportType": "STATION_RANKING",
      "name": "Rank of Stations by Total Passenger Boardings",
      "description": "Ranks stations by total boarding passengers and originating revenue using RANK()."
    },
    {
      "reportKey": "class-revenue",
      "reportType": "CLASS_REVENUE",
      "name": "Class-wise Revenue, Volume and Cumulative Share",
      "description": "Calculates running cumulative revenue and percentage share across coach classes."
    },
    {
      "reportKey": "quota-utilization",
      "reportType": "QUOTA_UTILIZATION",
      "name": "Quota Utilization and Demand Spread",
      "description": "Ranks booking quotas by popularity and total fare collected using RANK()."
    }
  ]
}
```
- **Errors**: `401 Unauthorized`, `403 Forbidden` (Non-admin token).

#### 7.5.2 Execute Analytical Report
- **Method / Endpoint**: `GET /api/admin/reports/:reportKey`
- **Role**: `ADMIN`
- **Behavior**: Runs the report's read-only SQL and records each execution as an audit entry in the `REPORT` table (`report_id = MAX+1` inside a transaction).
- **Response (200 OK)**:
```json
{
  "success": true,
  "data": {
    "reportId": 101,
    "reportKey": "busiest-trains",
    "reportType": "BUSIEST_TRAINS",
    "generatedAt": "2026-10-23 19:35:46",
    "rowCount": 15,
    "rows": [
      {
        "rank_pos": 1,
        "dense_rank_pos": 1,
        "train_id": 111,
        "train_number": "12301",
        "train_name": "Howrah Rajdhani Express (12301)",
        "train_type": "RAJDHANI",
        "total_runs_conducted": 6,
        "total_passengers_booked": 850,
        "total_revenue": 1733650.00
      }
    ]
  }
}
```
- **Errors**: `400 Bad Request` (Unknown reportKey), `401 Unauthorized`, `403 Forbidden` (Non-admin token).

### 7.6 Staff Account Management (BR-ST1)

#### 7.6.1 List Staff Accounts
- **Method / Endpoint**: `GET /api/admin/staff`
- **Role**: `ADMIN`
- **Response (200 OK)**:
```json
{
  "success": true,
  "data": [
    {
      "staffId": 1,
      "employeeNo": "EMP-TC-101",
      "designation": "TRAIN_TICKET_EXAMINER",
      "status": "ACTIVE",
      "userId": 50002,
      "name": "Vikram Singh",
      "email": "vikram.singh@railways.gov.in",
      "phone": "+91-9876543211",
      "accountStatus": "ACTIVE",
      "createdAt": "2026-10-18 00:00:00"
    }
  ]
}
```
- **Errors**: `401 Unauthorized`, `403 Forbidden` (Non-admin token).

#### 7.6.2 Create Staff Account
- **Method / Endpoint**: `POST /api/admin/staff`
- **Role**: `ADMIN`
- **Validation**:
  - `employeeNo`, `name`, `email`, `phone`, `designation`, and initial `password` are required.
  - Password is hashed with bcrypt like registration; never returned or logged.
  - `user_id` and `staff_id` generated via `MAX+1` inside transaction.
  - Duplicate `employeeNo` or `email` refused.
  - Automatically writes an `AUDIT_LOG` row (`action: 'CREATE_STAFF'`).
- **Request Body**:
```json
{
  "employeeNo": "EMP-TC-104",
  "name": "Amit Patel",
  "email": "amit.patel@railways.gov.in",
  "phone": "+91-9876543219",
  "designation": "TRAIN_TICKET_EXAMINER",
  "password": "Password123!"
}
```
- **Response (201 Created)**:
```json
{
  "success": true,
  "data": {
    "staffId": 4,
    "userId": 50009,
    "employeeNo": "EMP-TC-104",
    "name": "Amit Patel",
    "email": "amit.patel@railways.gov.in",
    "phone": "+91-9876543219",
    "designation": "TRAIN_TICKET_EXAMINER",
    "status": "ACTIVE"
  }
}
```
- **Errors**: `400 Bad Request` (Validation error or duplicate employeeNo/email), `401 Unauthorized`, `403 Forbidden` (Non-admin token).

#### 7.6.3 Update Staff Status
- **Method / Endpoint**: `PUT /api/admin/staff/:staffId/status`
- **Role**: `ADMIN`
- **Validation**:
  - `status` must be `ACTIVE`, `ON_LEAVE`, or `SUSPENDED`.
  - Automatically synchronizes `USER_ACCOUNT.account_status` (`SUSPENDED` prevents login across all portals).
  - Automatically writes an `AUDIT_LOG` row (`action: 'UPDATE_STAFF_STATUS'`).
- **Request Body**:
```json
{
  "status": "SUSPENDED"
}
```
- **Response (200 OK)**:
```json
{
  "success": true,
  "data": {
    "staffId": 4,
    "employeeNo": "EMP-TC-104",
    "status": "SUSPENDED"
  }
}
```
- **Errors**: `400 Bad Request` (Invalid status), `401 Unauthorized`, `403 Forbidden` (Non-admin token), `404 Not Found` (Staff not found).

### 7.7 Master Data Management (Stations, Trains, Routes, Coaches, Fares)
Standard CRUD endpoints maintaining zero schema drift:
- `/api/admin/stations` (158 stations with `platform_count`)
- `/api/admin/trains` (60 trains with `running_days`)
- `/api/admin/routes` (536 stops with `day_offset`)
- `/api/admin/coaches` & `/api/admin/seats`
- `/api/admin/fares` (distance slabs and class rates)
