# Database Architecture & Implementation Specification

Welcome to the database repository of the **Railway Reservation & Management System**.

This document specifies the relational database schema (MySQL InnoDB, proposed design: MySQL 8.0+), operational NoSQL storage (MongoDB, proposed design: MongoDB 7.0+), and DBMS automation scripts (triggers, stored procedures, transactions) in accordance with the approved ER diagram (`FINALx4_Railway Reservation & Management System – ER Diagram.html`) and Section 16 of the Business Rules (`docs/BUSINESS_RULES.md`).

All tables strictly incorporate the canonical entities, primary/foreign keys, and real codes from the five datasets in `datasets/`:
- **Stations (158)**: Station IDs 1 to 158 (`stations_158_final.xlsx`)
- **Trains (60)**: Train IDs 101 to 160 (`final_trains_60.xlsx`)
- **Routes (536)**: Route stop IDs 1001 to 1536 (`final_routes_536.xlsx`)
- **Users (50,000)**: User IDs 1 to 50000 (`users_synthetic_2.csv`)
- **Passengers (75,000)**: Passenger IDs 7 to 75006 (`passengers_synthetic_2.csv`)

Attributes required by the business rules that are not present in the initial dataset files are marked **`(new)`**.

---

## 1. Storage Architecture & Normalization

The system utilizes a hybrid persistence architecture:
1. **MySQL (InnoDB Storage Engine, proposed design: MySQL 8.0+)**:
   - Houses all transactional, financial, and seat inventory entities requiring strict ACID guarantees.
   - Normalized to **Third Normal Form (3NF)** / **BCNF** to eliminate update and deletion anomalies.
   - Enforces referential integrity through foreign keys with explicit cascade/restrict policies.
2. **MongoDB (NoSQL Document Store)**:
   - Houses high-velocity real-time train status feeds, in-app notifications, user session telemetry, and varied-structure passenger complaints.

---

## 2. MySQL Relational Schema (37 Tables) (proposed design)

### Section 1: User, Reservation & Pricing Core
1. `USER_ACCOUNT` (`user_id` [PK], `email` [UQ], `password_hash`, `phone` [UQ], `full_name` **`(new)`**, `role` [`PASSENGER`, `STAFF`, `ADMIN`] **`(new)`**, `account_status` [`ACTIVE`, `SUSPENDED`, `PENDING`] **`(new)`**, `aadhaar_verified` **`(new)`**, `created_at`)
2. `SAVED_PASSENGER` (`passenger_id` [PK], `user_id` [FK], `name`, `age`, `gender`, `id_proof_type`, `id_proof_reference`, `disability_type`, `berth_preference`)  
   *(Note: Concessions are chosen dynamically per booking and not stored permanently on saved passenger profiles per BR-C10).*
3. `SEAT_HOLD` **`(new)`** (`token` [PK], `user_id` [FK], `schedule_id` [FK], `class_id` [FK], `quota`, `seat_count`, `expires_at`)  
   *(Implements 10-minute temporary seat hold starting at Step 3 per BR-B2).*
4. `BOOKING` (`pnr` [PK, 10 digits], `user_id` [FK], `schedule_id` [FK], `class_id` [FK], `from_stop_id` [FK], `to_stop_id` [FK], `channel` [`ONLINE`, `COUNTER`] **`(new)`**, `booked_by_staff_id` [FK, NULLABLE] **`(new)`**, `quota` [`GENERAL`, `LADIES`, `TATKAL`, `SENIOR_CITIZEN`, `DIVYAANG`] **`(new)`**, `requested_quota` **`(new)`**, `berth_condition` **`(new)`**, `total_fare`, `status` [`PAYMENT_PENDING`, `CONFIRMED`, `RAC`, `WAITING_LIST`, `CANCELLED`, `FAILED`], `created_at`)  
   *(Indexed on `(user_id, created_at)` to accelerate monthly booking limit enforcement per BR-B15: 12 tickets/month, or 24 if Aadhaar-verified; settings MAX_TICKETS_PER_MONTH and MAX_TICKETS_PER_MONTH_AADHAAR_VERIFIED; counted by booking date, includes cancelled, excludes FAILED; shared COUNTER_WALKIN exempt).*
5. `PASSENGER_BOOKING` (`pnr` [PFK], `passenger_no` [PK, 1..6], `saved_passenger_id` [FK, NULLABLE] **`(new)`**, `name`, `age`, `gender`, `concession_type` [`NONE`, `DIVYAANG`, `SENIOR_CITIZEN`] **`(new)`**, `concession_proof_type` **`(new)`**, `concession_proof_ref` **`(new)`**, `base_fare` **`(new)`**, `concession_discount` **`(new)`**, `reservation_charge` **`(new)`**, `superfast_charge` **`(new)`**, `tatkal_charge` **`(new)`**, `dynamic_surcharge` **`(new)`**, `gst` **`(new)`**, `insurance` **`(new)`**, `total_fare` **`(new)`**)
6. `RESERVATION` (`res_id` [PK], `pnr` [FK], `passenger_no` [FK], `schedule_id` [FK], `seat_id` [FK, NULLABLE], `status` [`CONFIRMED`, `RAC`, `WAITING_LIST`, `BOARDED`, `NO_SHOW`, `CANCELLED`], `queue_position`)
7. `PAYMENT` (`payment_id` [PK], `pnr` [FK, NULLABLE], `amount`, `method` [`CREDIT_CARD`, `DEBIT_CARD`, `UPI`, `NET_BANKING`, `CASH`], `status` [`PENDING`, `SUCCESS`, `FAILED`], `gateway_payment_id` [UQ] **`(new)`**, `paid_at`)
8. `CANCELLATION` (`cancel_id` [PK], `pnr` [FK], `passenger_no` [FK, NULLABLE], `reason`, `charge`, `cancelled_at`)
9. `TDR_FILING` (`tdr_ref_no` [PK], `pnr` [FK], `passenger_no` [FK, NULLABLE], `reason` [`TRAIN_DELAYED_OVER_3_HOURS`, `TRAIN_DIVERTED`, `CLASS_DOWNGRADED`, `AC_FAILURE`, `COACH_NOT_ATTACHED`, `TRAIN_TERMINATED_SHORT`], `filed_at`, `status` [`FILED`, `UNDER_REVIEW`, `APPROVED`, `REJECTED`, `REFUND_PROCESSED`], `evidence_reference` **`(new)`**, `refund_amount` **`(new)`**, `reviewed_by` [FK] **`(new)`**, `reviewed_at` **`(new)`**, `remarks`)
10. `REFUND` (`refund_id` [PK], `cancel_id` [FK, NULLABLE], `tdr_ref_no` [FK, NULLABLE] **`(new)`**, `payment_id` [FK], `amount`, `reason` [`CANCELLATION`, `TDR_APPROVED`, `WAITLIST_PURGE`, `PAYMENT_AFTER_EXPIRY`, `TRAIN_CANCELLED`] **`(new)`**, `status` [`PENDING`, `PROCESSED`])
11. `CHART_SNAPSHOT` **`(new)`** (`snapshot_id` [PK], `schedule_id` [FK], `pnr`, `passenger_no`, `coach_number`, `seat_number`, `berth_type`, `status`, `from_station_id` [FK], `to_station_id` [FK], `concession_flag`, `generated_at`)  
    *(Frozen manifest generated 8 hours before origin departure per BR-B12a).*
12. `SETTING` **`(new)`** (`setting_key` [PK], `setting_value`, `description`, `updated_at`)

### Section 2: Railway Infrastructure & Timetable
13. `STATION` (`station_id` [PK, 1..158], `station_code` [UQ], `station_name`, `display_name` **`(new)`**, `city`, `state`, `platform_count` **`(new)`**)
14. `PLATFORM` (`platform_id` [PK], `station_id` [FK], `platform_no`, `status`)
15. `TRAIN` (`train_id` [PK, 101..160], `train_number` [UQ], `short_name`, `display_name` **`(new)`**, `train_type` [`RAJDHANI`, `SHATABDI`, `DURONTO`, `EXPRESS`, `VANDE_BHARAT`], `source_station_id` [FK], `destination_station_id` [FK], `running_days` [JSON: `"MON"`..`"SUN"`], `status`)
16. `ROUTE_STOP` (`stop_id` [PK, 1001..1536], `train_id` [FK], `station_id` [FK], `stop_sequence`, `arrival_time`, `departure_time`, `day_offset` [0, 1, 2] **`(new)`**, `distance_from_origin_km`, `platform_no`)
17. `TRAIN_SCHEDULE` (`schedule_id` [PK], `train_id` [FK], `journey_date` [origin departure date], `departure_time`, `delay_minutes` **`(new)`**, `chart_prepared_at` **`(new)`**, `status` [`ON_TIME`, `DELAYED`, `CANCELLED`, `RESCHEDULED`])
18. `RUN_COACH_STATUS` **`(new)`** (`run_coach_id` [PK], `schedule_id` [FK], `coach_id` [FK], `status` [`IN_SERVICE`, `OUT_OF_SERVICE`])
19. `SEAT_CLASS` (`class_id` [PK], `code` [`1A`, `2A`, `3A`, `SL`, `CC`, `EC`, `2S`], `name`)
20. `COACH` (`coach_id` [PK], `train_id` [FK], `class_id` [FK], `coach_no`, `total_seats`)
21. `SEAT` (`seat_id` [PK], `coach_id` [FK], `seat_no`, `berth_type` [`LOWER`, `MIDDLE`, `UPPER`, `SIDE_LOWER`, `SIDE_UPPER`, `WINDOW`, `AISLE`, `NO_BERTH`])
22. `SCHEDULE_CLASS_INVENTORY` (`schedule_id` [PFK], `class_id` [PFK], `quota` [PFK, Quota Enum] **`(new)`**, `total_seats`, `available_seats`, `rac_count`, `wl_count`)
23. `FARE` (`fare_id` [PK], `class_id` [FK], `from_km` **`(new)`**, `to_km` **`(new)`**, `per_km_rate`, `reservation_charge` **`(new)`**, `superfast_charge` **`(new)`**, `tatkal_percent` **`(new)`**)
24. `CONCESSION_RULE` (`concession_rule_id` [PK] **`(new)`**, `concession_type`, `class_id` [FK, NULLABLE] **`(new)`**, `train_type_group` **`(new)`**, `discount_pct`, `proof_types` [JSON] **`(new)`**, `is_active` **`(new)`**)  
    *(DIVYAANG active; SENIOR_CITIZEN inactive; no STUDENT or MEDICAL).*
25. `REFUND_RULE` (`rule_id` [PK], `min_hours`, `max_hours`, `deduction_pct`, `flat_min_charge` **`(new)`**, `clerkage_per_passenger` **`(new)`**)

### Section 3: Staff Operations & Maintenance
26. `STAFF` (`staff_id` [PK], `user_id` [FK], `employee_no` [UQ], `designation`, `status`)
27. `STAFF_ASSIGNMENT` (`assign_id` [PK], `staff_id` [FK], `schedule_id` [FK, NULLABLE], `station_id` [FK, NULLABLE], `duty_type` [`TRAIN_DUTY`, `STATION_DUTY`, `COUNTER_DUTY`, `MAINTENANCE_DUTY`] **`(new)`**, `shift_start`, `shift_end` **`(new)`**)
28. `TICKET_VERIFICATION` (`verify_id` [PK], `pnr` [FK], `passenger_no` [FK], `staff_id` [FK], `id_checked`, `concession_proof_checked` **`(new)`**, `result` [`VALID`, `INVALID`, `MISMATCH`], `verified_at`)
29. `FINE` (`fine_id` [PK], `verify_id` [FK, NULLABLE], `staff_id` [FK], `passenger_name`, `id_proof_reference`, `train_id` [FK, NULLABLE], `amount`, `reason` [`TICKETLESS_TRAVEL`, `UNAUTHORIZED_CLASS`, `SMOKING_NUISANCE`, `UNBOOKED_LUGGAGE`], `payment_status` [`PAID`, `UNPAID`], `issued_at`)
30. `INCIDENT` (`incident_id` [PK], `staff_id` [FK], `station_id` [FK, NULLABLE], `schedule_id` [FK, NULLABLE], `type`, `severity` [`LOW`, `MEDIUM`, `HIGH`, `CRITICAL`], `status`, `reported_at`)
31. `MAINTENANCE` (`maint_id` [PK], `staff_id` [FK], `coach_id` [FK, NULLABLE], `platform_id` [FK, NULLABLE], `type` [`CLEANING`, `REPAIR`, `AC_SERVICE`, `INSPECTION`, `SAFETY_CHECK`], `status` [`OPEN`, `IN_PROGRESS`, `COMPLETED`, `CANCELLED`], `created_at`, `completed_at` **`(new)`**)  
    *(CHECK: exactly one of `coach_id` or `platform_id` must be non-null).*
32. `CROWD_REPORT` (`crowd_report_id` [PK], `station_id` [FK], `platform_no`, `crowd_level` [`LOW`, `MODERATE`, `HIGH`, `OVERCROWDED`], `head_count`, `staff_id` [FK], `recorded_at`)
33. `CLEANLINESS_REPORT` (`cleanliness_report_id` [PK], `staff_id` [FK], `train_id` [FK, NULLABLE], `coach_id` [FK, NULLABLE], `station_id` [FK, NULLABLE], `platform_no` [NULLABLE], `issue_type`, `description`, `status`, `recorded_at`)

### Section 4: Administration & Auditing
34. `ADMIN` (`admin_id` [PK], `user_id` [FK], `employee_no` [UQ], `access_level`)
35. `AUDIT_LOG` (`log_id` [PK], `user_id` [FK], `action`, `table_name`, `record_id`, `old_value`, `new_value`, `logged_at`)
36. `REPORT` (`report_id` [PK], `admin_id` [FK], `report_type`, `generated_at`)
37. `SETTING` (`setting_key` [PK], `setting_value`, `description`, `updated_at`)

---

## 3. MongoDB NoSQL Collections (5 Collections)

Located in Section 5 of the ER diagram:
1. `live_train_status`: Real-time operational delay and platform telemetry (`schedule_id`, `station_id`, `delay_minutes`, `status`, `current_platform`, `updated_at`).
2. `notifications`: In-app notification center alerts (`user_id`, `message`, `type` [`BOOKING_CONFIRMATION`, `STATUS_UPDATE`, `DELAY`, `PLATFORM_CHANGE`, `EMERGENCY`], `reference_id`, `sent_at`, `is_read`).
3. `complaints`: Flexible schema grievances and customer ratings (`user_id`, `type`, `message`, `rating`, `status`, `extra_fields{}`, `created_at`).
4. `activity_logs`: Telemetry logs for user logins, security events, and API audit (`user_id`, `event`, `ip`, `user_agent`, `meta{}`, `at`).
5. `raw_gateway_replies`: Raw callback and webhook payloads from Razorpay TEST gateway (`gateway_payment_id`, `payload{}`, `received_at`).

---

## 4. Advanced DBMS Features (Procedures, Triggers & Views) (proposed design)

### 4.1 Stored Procedures & Functions (proposed design)
- **`fn_calculate_cancellation_charge(p_pnr VARCHAR(10), p_passenger_no INT)`**:
  Evaluates time remaining before scheduled **origin departure** of the run (BR-R1). Applies deduction slabs:
  - $> 72$ hours: Flat minimum only (1A/EC: 240, 2A: 200, 3A/CC: 180, SL: 120, 2S: 60).
  - $72$ to $24$ hours: 25% of taxable fare (not less than flat minimum).
  - $24$ to $8$ hours: 50% of taxable fare (not less than flat minimum).
  - $< 8$ hours: Online cancellation locked (chart prepared, 100% deduction / no refund).
  - RAC / WL tickets: Full refund minus flat clerkage (60 per passenger, BR-R5).
- **`sp_check_seat_segment_overlap(p_schedule_id INT, p_seat_id INT, p_from_seq INT, p_to_seq INT)`**:
  Tests whether candidate seat overlaps with existing active reservations using:
  $$\max(\text{Start}_A, \text{Start}_B) < \min(\text{End}_A, \text{End}_B)$$
  Includes BR-S5 exception: permits up to 2 RAC passengers to share a single `SIDE_LOWER` berth.
- **`sp_promote_rac_waitlist(p_schedule_id INT, p_class_id INT, p_quota ENUM)`**:
  Executes atomic status promotion upon voluntary cancellation, staff no-show recording, or chart preparation:
  1. Lowest-numbered RAC passenger fitting the segment is promoted to `CONFIRMED`.
  2. Lowest-numbered Waiting List passenger is promoted to `RAC`.
  3. Subsequent queue tokens decrement by 1 without gaps (BR-W3).
  4. Triggers `STATUS_UPDATE` notification.
- **`sp_execute_chart_preparation(p_schedule_id INT)`**:
  Executes at chart time (8 hours before origin departure per BR-B12 / settings table) as one all-or-nothing step (BR-B12a, BR-B16):
  1. Sets chart lockout: cancels running holds, blocks subsequent booking attempts (`CHART_PREPARED`).
  2. Reallocates unsold seats in LADIES, TATKAL, SENIOR_CITIZEN, and DIVYAANG to GENERAL quota and runs promotions (BR-Q11).
  3. Executes auto-upgrades in booking order; each vacated seat triggers immediate promotion in its old class (BR-S6, BR-W4).
  4. Cancels remaining waitlisted passengers with 100% full refund (excluding insurance) to original payment (BR-W8).
  5. Freezes final manifest into `CHART_SNAPSHOT`.

### 4.2 Database Triggers (proposed design)
- **`trg_audit_master_changes`**:
  `AFTER UPDATE` trigger on master tables (`TRAIN`, `ROUTE_STOP`, `FARE`, `CONCESSION_RULE`, `SETTING`) capturing previous and updated JSON representations directly into `AUDIT_LOG` (BR-A8).
- **`trg_enforce_payment_idempotency`**:
  `BEFORE INSERT` trigger on `PAYMENT` ensuring `gateway_payment_id` is unique and processed exactly once. If a payment callback succeeds for an expired hold or failed booking, triggers automatic full refund with reason `PAYMENT_AFTER_EXPIRY` (BR-B14).
- **`trg_release_berth_on_no_show`**:
  `AFTER UPDATE` on `RESERVATION` detecting `status = 'NO_SHOW'`, releasing berth occupancy for downstream stops and calling `sp_promote_rac_waitlist` (BR-ST5).

---

## 5. Master Dataset Seeding Specifications

The database schema directly ingests the five standardized datasets in `datasets/`:
1. `stations_158_final.xlsx` $\to$ Seeds `STATION` (IDs 1–158) and generates `PLATFORM` rows 1 to `platform_count` for each station.
2. `final_trains_60.xlsx` $\to$ Seeds `TRAIN` (IDs 101–160), storing running days (`MON` through `SUN`) and train classifications.
3. `final_routes_536.xlsx` $\to$ Seeds `ROUTE_STOP` (IDs 1001–1536), computing cumulative distances and `day_offset` values (0, 1, or 2).
4. `users_synthetic_2.csv` $\to$ Seeds `USER_ACCOUNT` (50,000 accounts), assigning roles (`PASSENGER`, `STAFF`, `ADMIN`) and seeding the shared `COUNTER_WALKIN` account.
5. `passengers_synthetic_2.csv` $\to$ Seeds `SAVED_PASSENGER` (75,000 master list profiles) linked to owning user IDs.
6. `SETTING` is seeded with initial project constants:
   - `BOOKING_WINDOW_DAYS`: `'7'` (BR-B1)
   - `HOLD_MINUTES`: `'10'` (BR-B2)
   - `MAX_PASSENGERS_PER_PNR` / `TATKAL`: `'6'` / `'4'` (BR-B3, BR-Q3)
   - `CHART_HOURS_BEFORE_ORIGIN_DEPARTURE`: `'8'` (BR-B12)
   - `MAX_TICKETS_PER_MONTH` / `_AADHAAR`: `'12'` / `'24'` (BR-B15)
   - `CONCESSION_SENIOR_ACTIVE`: `'false'` (BR-C2)
   - `DYNAMIC_FARE_ENABLED`: `'false'` (BR-F11)
   - `CLERKAGE_PER_PASSENGER`: `'60'` (BR-R5)
