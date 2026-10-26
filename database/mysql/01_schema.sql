-- =============================================================================
-- Railway Reservation & Management System (MySQL 8.0)
-- File: 01_schema.sql
-- Description: DDL for database railway_db, 37 tables in 3NF, PK, FK, NOT NULL,
--              UNIQUE, CHECK, DEFAULT constraints, and performance indexes.
-- =============================================================================

CREATE DATABASE IF NOT EXISTS railway_db
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE railway_db;

-- Disable FK checks temporarily for clean drop if re-running
SET FOREIGN_KEY_CHECKS = 0;

-- Drop tables in reverse dependency order if they exist
DROP TABLE IF EXISTS CHART_SNAPSHOT;
DROP TABLE IF EXISTS REPORT;
DROP TABLE IF EXISTS AUDIT_LOG;
DROP TABLE IF EXISTS CLEANLINESS_REPORT;
DROP TABLE IF EXISTS CROWD_REPORT;
DROP TABLE IF EXISTS INCIDENT;
DROP TABLE IF EXISTS MAINTENANCE;
DROP TABLE IF EXISTS FINE;
DROP TABLE IF EXISTS TICKET_VERIFICATION;
DROP TABLE IF EXISTS REFUND;
DROP TABLE IF EXISTS CANCELLATION;
DROP TABLE IF EXISTS PAYMENT;
DROP TABLE IF EXISTS RESERVATION;
DROP TABLE IF EXISTS PASSENGER_BOOKING;
DROP TABLE IF EXISTS TDR_FILING;
DROP TABLE IF EXISTS BOOKING;
DROP TABLE IF EXISTS SETTING;
DROP TABLE IF EXISTS TDR_RULE;
DROP TABLE IF EXISTS REFUND_RULE;
DROP TABLE IF EXISTS CONCESSION_RULE;
DROP TABLE IF EXISTS FARE;
DROP TABLE IF EXISTS SEAT_HOLD;
DROP TABLE IF EXISTS RUN_COACH_STATUS;
DROP TABLE IF EXISTS SCHEDULE_CLASS_INVENTORY;
DROP TABLE IF EXISTS TRAIN_SCHEDULE;
DROP TABLE IF EXISTS STAFF_ASSIGNMENT;
DROP TABLE IF EXISTS STAFF;
DROP TABLE IF EXISTS ADMIN;
DROP TABLE IF EXISTS SAVED_PASSENGER;
DROP TABLE IF EXISTS USER_ACCOUNT;
DROP TABLE IF EXISTS SEAT;
DROP TABLE IF EXISTS COACH;
DROP TABLE IF EXISTS SEAT_CLASS;
DROP TABLE IF EXISTS PLATFORM;
DROP TABLE IF EXISTS ROUTE_STOP;
DROP TABLE IF EXISTS TRAIN;
DROP TABLE IF EXISTS STATION;

SET FOREIGN_KEY_CHECKS = 1;

-- =============================================================================
-- 1. MASTER GEOGRAPHY & NETWORK TABLES
-- =============================================================================

-- 1. STATION (158 stations)
CREATE TABLE STATION (
    station_id INT NOT NULL,
    station_code VARCHAR(10) NOT NULL,
    station_name VARCHAR(100) NOT NULL,
    display_name VARCHAR(120) NOT NULL,
    city VARCHAR(80) NOT NULL,
    state VARCHAR(80) NOT NULL,
    platform_count INT NOT NULL DEFAULT 1,
    PRIMARY KEY (station_id),
    UNIQUE KEY uq_station_code (station_code),
    CONSTRAINT chk_station_platform_count CHECK (platform_count >= 1)
) ENGINE=InnoDB;

-- 2. TRAIN (60 trains)
CREATE TABLE TRAIN (
    train_id INT NOT NULL,
    train_number VARCHAR(10) NOT NULL,
    short_name VARCHAR(50) NOT NULL,
    display_name VARCHAR(150) NOT NULL,
    train_type ENUM('RAJDHANI', 'SHATABDI', 'DURONTO', 'EXPRESS', 'VANDE_BHARAT') NOT NULL,
    source_station_id INT NOT NULL,
    destination_station_id INT NOT NULL,
    running_days JSON NOT NULL,
    status ENUM('ACTIVE', 'CANCELLED', 'SUSPENDED') NOT NULL DEFAULT 'ACTIVE',
    PRIMARY KEY (train_id),
    UNIQUE KEY uq_train_number (train_number),
    CONSTRAINT fk_train_source_station FOREIGN KEY (source_station_id) REFERENCES STATION (station_id),
    CONSTRAINT fk_train_dest_station FOREIGN KEY (destination_station_id) REFERENCES STATION (station_id)
) ENGINE=InnoDB;

-- 3. ROUTE_STOP (536 route stops)
CREATE TABLE ROUTE_STOP (
    stop_id INT NOT NULL,
    train_id INT NOT NULL,
    station_id INT NOT NULL,
    stop_sequence INT NOT NULL,
    arrival_time TIME NOT NULL,
    departure_time TIME NOT NULL,
    day_offset INT NOT NULL DEFAULT 0,
    distance_from_origin INT NOT NULL DEFAULT 0,
    platform_number INT NOT NULL DEFAULT 1,
    PRIMARY KEY (stop_id),
    UNIQUE KEY uq_train_stop_seq (train_id, stop_sequence),
    KEY idx_route_stop_station (station_id),
    KEY idx_route_stop_train (train_id),
    CONSTRAINT fk_route_stop_train FOREIGN KEY (train_id) REFERENCES TRAIN (train_id) ON DELETE CASCADE,
    CONSTRAINT fk_route_stop_station FOREIGN KEY (station_id) REFERENCES STATION (station_id),
    CONSTRAINT chk_stop_seq CHECK (stop_sequence >= 1),
    CONSTRAINT chk_day_offset CHECK (day_offset >= 0),
    CONSTRAINT chk_distance_from_origin CHECK (distance_from_origin >= 0)
) ENGINE=InnoDB;

-- 4. PLATFORM (888 platforms)
CREATE TABLE PLATFORM (
    platform_id INT NOT NULL,
    station_id INT NOT NULL,
    platform_no INT NOT NULL,
    PRIMARY KEY (platform_id),
    UNIQUE KEY uq_station_platform (station_id, platform_no),
    CONSTRAINT fk_platform_station FOREIGN KEY (station_id) REFERENCES STATION (station_id) ON DELETE CASCADE,
    CONSTRAINT chk_platform_no CHECK (platform_no >= 1)
) ENGINE=InnoDB;

-- =============================================================================
-- 2. COACH & SEAT CONFIGURATION
-- =============================================================================

-- 5. SEAT_CLASS (7 classes)
CREATE TABLE SEAT_CLASS (
    class_id INT NOT NULL,
    class_code VARCHAR(10) NOT NULL,
    class_name VARCHAR(50) NOT NULL,
    coach_type ENUM('AC', 'NON_AC') NOT NULL,
    has_berths TINYINT(1) NOT NULL DEFAULT 1,
    base_multiplier DECIMAL(5,2) NOT NULL DEFAULT 1.00,
    PRIMARY KEY (class_id),
    UNIQUE KEY uq_seat_class_code (class_code)
) ENGINE=InnoDB;

-- 6. COACH (828 coaches)
CREATE TABLE COACH (
    coach_id INT NOT NULL,
    train_id INT NOT NULL,
    class_id INT NOT NULL,
    coach_code VARCHAR(10) NOT NULL,
    sequence_number INT NOT NULL,
    total_seats INT NOT NULL,
    PRIMARY KEY (coach_id),
    UNIQUE KEY uq_train_coach_code (train_id, coach_code),
    UNIQUE KEY uq_train_coach_seq (train_id, sequence_number),
    KEY idx_coach_class (class_id),
    CONSTRAINT fk_coach_train FOREIGN KEY (train_id) REFERENCES TRAIN (train_id) ON DELETE CASCADE,
    CONSTRAINT fk_coach_class FOREIGN KEY (class_id) REFERENCES SEAT_CLASS (class_id)
) ENGINE=InnoDB;

-- 7. SEAT (51,960 physical seats)
CREATE TABLE SEAT (
    seat_id INT NOT NULL,
    coach_id INT NOT NULL,
    seat_number INT NOT NULL,
    berth_type ENUM('LOWER', 'MIDDLE', 'UPPER', 'SIDE_LOWER', 'SIDE_UPPER', 'WINDOW', 'AISLE', 'NO_BERTH') NOT NULL,
    PRIMARY KEY (seat_id),
    UNIQUE KEY uq_coach_seat_no (coach_id, seat_number),
    CONSTRAINT fk_seat_coach FOREIGN KEY (coach_id) REFERENCES COACH (coach_id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- =============================================================================
-- 3. USERS, PASSENGERS & STAFF
-- =============================================================================

-- 8. USER_ACCOUNT (50,008 accounts)
CREATE TABLE USER_ACCOUNT (
    user_id INT NOT NULL,
    email VARCHAR(191) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    phone VARCHAR(32) NOT NULL,
    full_name VARCHAR(128) NOT NULL,
    role ENUM('PASSENGER', 'STAFF', 'ADMIN') NOT NULL DEFAULT 'PASSENGER',
    account_status ENUM('ACTIVE', 'INACTIVE', 'SUSPENDED', 'PENDING') NOT NULL DEFAULT 'ACTIVE',
    aadhaar_verified TINYINT(1) NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL,
    PRIMARY KEY (user_id),
    UNIQUE KEY uq_user_email (email),
    UNIQUE KEY uq_user_phone (phone)
) ENGINE=InnoDB;

-- 9. SAVED_PASSENGER (75,000 saved passenger profiles)
CREATE TABLE SAVED_PASSENGER (
    passenger_id INT NOT NULL,
    user_id INT NOT NULL,
    name VARCHAR(128) NOT NULL,
    age INT NOT NULL,
    gender ENUM('MALE', 'FEMALE', 'OTHER') NOT NULL,
    id_proof_type ENUM('SYNTHETIC_TEST_ID', 'AADHAAR', 'PAN', 'PASSPORT', 'VOTER_ID', 'DRIVING_LICENSE', 'GOVT_ID') NOT NULL,
    id_proof_reference VARCHAR(64) NOT NULL,
    disability_type ENUM('NONE', 'ORTHOPEDIC', 'VISUAL', 'HEARING', 'MENTAL') NOT NULL DEFAULT 'NONE',
    berth_preference ENUM('LOWER', 'MIDDLE', 'UPPER', 'SIDE_LOWER', 'SIDE_UPPER', 'WINDOW', 'AISLE', 'NO_BERTH') NOT NULL DEFAULT 'NO_BERTH',
    PRIMARY KEY (passenger_id),
    KEY idx_saved_pass_user (user_id),
    CONSTRAINT fk_saved_pass_user FOREIGN KEY (user_id) REFERENCES USER_ACCOUNT (user_id) ON DELETE CASCADE,
    CONSTRAINT chk_passenger_age CHECK (age >= 0 AND age <= 125)
) ENGINE=InnoDB;

-- 10. ADMIN (1 administrator)
CREATE TABLE ADMIN (
    admin_id INT NOT NULL,
    user_id INT NOT NULL,
    employee_no VARCHAR(32) NOT NULL,
    access_level ENUM('SUPER_ADMIN', 'SYSTEM_ADMIN', 'OPERATIONS_ADMIN') NOT NULL DEFAULT 'SYSTEM_ADMIN',
    PRIMARY KEY (admin_id),
    UNIQUE KEY uq_admin_user (user_id),
    UNIQUE KEY uq_admin_emp (employee_no),
    CONSTRAINT fk_admin_user FOREIGN KEY (user_id) REFERENCES USER_ACCOUNT (user_id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 11. STAFF (3 staff members)
CREATE TABLE STAFF (
    staff_id INT NOT NULL,
    user_id INT NOT NULL,
    employee_no VARCHAR(32) NOT NULL,
    designation VARCHAR(64) NOT NULL,
    status ENUM('ACTIVE', 'ON_LEAVE', 'SUSPENDED') NOT NULL DEFAULT 'ACTIVE',
    PRIMARY KEY (staff_id),
    UNIQUE KEY uq_staff_user (user_id),
    UNIQUE KEY uq_staff_emp (employee_no),
    CONSTRAINT fk_staff_user FOREIGN KEY (user_id) REFERENCES USER_ACCOUNT (user_id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- =============================================================================
-- 4. RUNS, INVENTORY & OPERATIONAL STATUS
-- =============================================================================

-- 12. TRAIN_SCHEDULE (350 runs)
CREATE TABLE TRAIN_SCHEDULE (
    schedule_id INT NOT NULL,
    train_id INT NOT NULL,
    journey_date DATE NOT NULL,
    departure_time TIME NOT NULL,
    delay_minutes INT NOT NULL DEFAULT 0,
    chart_prepared_at DATETIME NULL,
    status ENUM('ON_TIME', 'DELAYED', 'CANCELLED', 'COMPLETED') NOT NULL DEFAULT 'ON_TIME',
    PRIMARY KEY (schedule_id),
    UNIQUE KEY uq_train_journey_date (train_id, journey_date),
    KEY idx_schedule_journey_date (journey_date),
    CONSTRAINT fk_schedule_train FOREIGN KEY (train_id) REFERENCES TRAIN (train_id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 13. SCHEDULE_CLASS_INVENTORY (1,015 run-class inventories)
CREATE TABLE SCHEDULE_CLASS_INVENTORY (
    inventory_id INT NOT NULL,
    schedule_id INT NOT NULL,
    class_id INT NOT NULL,
    total_seats INT NOT NULL,
    available_seats INT NOT NULL,
    rac_capacity INT NOT NULL DEFAULT 0,
    rac_count INT NOT NULL DEFAULT 0,
    wl_capacity INT NOT NULL DEFAULT 0,
    wl_count INT NOT NULL DEFAULT 0,
    PRIMARY KEY (inventory_id),
    UNIQUE KEY uq_sched_class (schedule_id, class_id),
    CONSTRAINT fk_inv_schedule FOREIGN KEY (schedule_id) REFERENCES TRAIN_SCHEDULE (schedule_id) ON DELETE CASCADE,
    CONSTRAINT fk_inv_class FOREIGN KEY (class_id) REFERENCES SEAT_CLASS (class_id)
) ENGINE=InnoDB;

-- 14. RUN_COACH_STATUS (4,818 run-coach statuses)
CREATE TABLE RUN_COACH_STATUS (
    status_id INT NOT NULL,
    schedule_id INT NOT NULL,
    coach_id INT NOT NULL,
    status ENUM('IN_SERVICE', 'OUT_OF_SERVICE') NOT NULL DEFAULT 'IN_SERVICE',
    PRIMARY KEY (status_id),
    UNIQUE KEY uq_sched_coach (schedule_id, coach_id),
    CONSTRAINT fk_rcs_schedule FOREIGN KEY (schedule_id) REFERENCES TRAIN_SCHEDULE (schedule_id) ON DELETE CASCADE,
    CONSTRAINT fk_rcs_coach FOREIGN KEY (coach_id) REFERENCES COACH (coach_id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 15. STAFF_ASSIGNMENT (3 assignments)
CREATE TABLE STAFF_ASSIGNMENT (
    assign_id INT NOT NULL,
    staff_id INT NOT NULL,
    schedule_id INT NULL,
    station_id INT NOT NULL,
    duty_type ENUM('TRAIN_DUTY', 'STATION_DUTY', 'COUNTER_DUTY', 'MAINTENANCE_DUTY') NOT NULL,
    shift_start DATETIME NOT NULL,
    shift_end DATETIME NOT NULL,
    PRIMARY KEY (assign_id),
    KEY idx_assign_staff (staff_id),
    KEY idx_assign_schedule (schedule_id),
    KEY idx_assign_station (station_id),
    CONSTRAINT fk_assign_staff FOREIGN KEY (staff_id) REFERENCES STAFF (staff_id) ON DELETE CASCADE,
    CONSTRAINT fk_assign_schedule FOREIGN KEY (schedule_id) REFERENCES TRAIN_SCHEDULE (schedule_id) ON DELETE SET NULL,
    CONSTRAINT fk_assign_station FOREIGN KEY (station_id) REFERENCES STATION (station_id)
) ENGINE=InnoDB;

-- 16. SEAT_HOLD (5 active seat holds)
CREATE TABLE SEAT_HOLD (
    token VARCHAR(64) NOT NULL,
    user_id INT NOT NULL,
    schedule_id INT NOT NULL,
    class_id INT NOT NULL,
    quota ENUM('GENERAL', 'LADIES', 'TATKAL', 'SENIOR_CITIZEN', 'DIVYAANG') NOT NULL,
    seat_count INT NOT NULL,
    expires_at DATETIME NOT NULL,
    PRIMARY KEY (token),
    KEY idx_seat_hold_user (user_id),
    KEY idx_seat_hold_sched (schedule_id),
    CONSTRAINT fk_hold_user FOREIGN KEY (user_id) REFERENCES USER_ACCOUNT (user_id) ON DELETE CASCADE,
    CONSTRAINT fk_hold_schedule FOREIGN KEY (schedule_id) REFERENCES TRAIN_SCHEDULE (schedule_id) ON DELETE CASCADE,
    CONSTRAINT fk_hold_class FOREIGN KEY (class_id) REFERENCES SEAT_CLASS (class_id)
) ENGINE=InnoDB;

-- =============================================================================
-- 5. FARE & BUSINESS RULES CONFIGURATION
-- =============================================================================

-- 17. FARE (28 distance slab rates)
CREATE TABLE FARE (
    fare_id INT NOT NULL,
    class_id INT NOT NULL,
    min_distance_km INT NOT NULL,
    max_distance_km INT NOT NULL,
    rate_per_km DECIMAL(6,2) NOT NULL,
    PRIMARY KEY (fare_id),
    KEY idx_fare_class (class_id),
    CONSTRAINT fk_fare_class FOREIGN KEY (class_id) REFERENCES SEAT_CLASS (class_id)
) ENGINE=InnoDB;

-- 18. CONCESSION_RULE (13 concession rules)
CREATE TABLE CONCESSION_RULE (
    rule_id INT NOT NULL,
    concession_type ENUM('NONE', 'DIVYAANG', 'SENIOR_CITIZEN') NOT NULL,
    class_id INT NOT NULL,
    train_group VARCHAR(32) NOT NULL,
    discount_pct DECIMAL(5,2) NOT NULL,
    proof_types JSON NOT NULL,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    PRIMARY KEY (rule_id),
    KEY idx_conc_rule_class (class_id),
    CONSTRAINT fk_conc_rule_class FOREIGN KEY (class_id) REFERENCES SEAT_CLASS (class_id)
) ENGINE=InnoDB;

-- 19. REFUND_RULE (4 cancellation refund slabs)
CREATE TABLE REFUND_RULE (
    rule_id INT NOT NULL,
    min_hours INT NOT NULL,
    max_hours INT NULL,
    deduction_pct DECIMAL(5,2) NOT NULL,
    flat_min_charge DECIMAL(8,2) NOT NULL,
    clerkage DECIMAL(8,2) NOT NULL DEFAULT 60.00,
    PRIMARY KEY (rule_id)
) ENGINE=InnoDB;

-- 20. TDR_RULE (6 TDR refund rules)
CREATE TABLE TDR_RULE (
    rule_id INT NOT NULL,
    reason_code ENUM('TRAIN_DELAYED_OVER_3_HOURS', 'TRAIN_DIVERTED', 'CLASS_DOWNGRADED', 'AC_FAILURE', 'COACH_NOT_ATTACHED', 'TRAIN_TERMINATED_SHORT') NOT NULL,
    description VARCHAR(255) NOT NULL,
    deadline_hours INT NOT NULL DEFAULT 0,
    requires_verification TINYINT(1) NOT NULL DEFAULT 0,
    refund_pct DECIMAL(5,2) NOT NULL DEFAULT 100.00,
    PRIMARY KEY (rule_id),
    UNIQUE KEY uq_tdr_reason (reason_code)
) ENGINE=InnoDB;

-- 21. SETTING (13 global operational settings)
CREATE TABLE SETTING (
    setting_key VARCHAR(64) NOT NULL,
    setting_value VARCHAR(255) NOT NULL,
    description VARCHAR(255) NULL,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (setting_key)
) ENGINE=InnoDB;

-- =============================================================================
-- 6. BOOKINGS, PASSENGERS, RESERVATIONS & PAYMENTS
-- =============================================================================

-- 22. BOOKING (16,376 bookings)
CREATE TABLE BOOKING (
    pnr VARCHAR(10) NOT NULL,
    user_id INT NOT NULL,
    schedule_id INT NOT NULL,
    class_id INT NOT NULL,
    from_stop_id INT NOT NULL,
    to_stop_id INT NOT NULL,
    channel ENUM('ONLINE', 'COUNTER') NOT NULL DEFAULT 'ONLINE',
    booked_by_staff_id INT NULL,
    quota ENUM('GENERAL', 'LADIES', 'TATKAL', 'SENIOR_CITIZEN', 'DIVYAANG') NOT NULL DEFAULT 'GENERAL',
    requested_quota ENUM('GENERAL', 'LADIES', 'TATKAL', 'SENIOR_CITIZEN', 'DIVYAANG') NOT NULL DEFAULT 'GENERAL',
    berth_condition TINYINT(1) NOT NULL DEFAULT 0,
    total_fare DECIMAL(10,2) NOT NULL,
    status ENUM('PAYMENT_PENDING', 'CONFIRMED', 'RAC', 'WAITING_LIST', 'CANCELLED', 'FAILED') NOT NULL,
    created_at DATETIME NOT NULL,
    PRIMARY KEY (pnr),
    KEY idx_booking_user_created (user_id, created_at),
    KEY idx_booking_schedule (schedule_id),
    KEY idx_booking_status (status),
    CONSTRAINT fk_booking_user FOREIGN KEY (user_id) REFERENCES USER_ACCOUNT (user_id),
    CONSTRAINT fk_booking_schedule FOREIGN KEY (schedule_id) REFERENCES TRAIN_SCHEDULE (schedule_id),
    CONSTRAINT fk_booking_class FOREIGN KEY (class_id) REFERENCES SEAT_CLASS (class_id),
    CONSTRAINT fk_booking_from_stop FOREIGN KEY (from_stop_id) REFERENCES ROUTE_STOP (stop_id),
    CONSTRAINT fk_booking_to_stop FOREIGN KEY (to_stop_id) REFERENCES ROUTE_STOP (stop_id),
    CONSTRAINT fk_booking_staff FOREIGN KEY (booked_by_staff_id) REFERENCES STAFF (staff_id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- 23. PASSENGER_BOOKING (30,852 passengers on bookings)
CREATE TABLE PASSENGER_BOOKING (
    pnr VARCHAR(10) NOT NULL,
    passenger_no INT NOT NULL,
    saved_passenger_id INT NULL,
    name VARCHAR(128) NOT NULL,
    age INT NOT NULL,
    gender ENUM('MALE', 'FEMALE', 'OTHER') NOT NULL,
    concession_type ENUM('NONE', 'DIVYAANG', 'SENIOR_CITIZEN') NOT NULL DEFAULT 'NONE',
    concession_proof_type ENUM('RAILWAY_DIVYANGJAN_ID', 'UDID', 'CONCESSION_CERTIFICATE', 'SYNTHETIC_TEST_ID', 'AADHAAR', 'PAN', 'PASSPORT', 'VOTER_ID', 'DRIVING_LICENSE', 'GOVT_ID') NULL,
    concession_proof_ref VARCHAR(64) NULL,
    base_fare DECIMAL(10,2) NOT NULL,
    concession_discount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    reservation_charge DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    superfast_charge DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    tatkal_charge DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    dynamic_surcharge DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    gst DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    insurance DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    total_fare DECIMAL(10,2) NOT NULL,
    PRIMARY KEY (pnr, passenger_no),
    KEY idx_pb_saved_passenger (saved_passenger_id),
    CONSTRAINT fk_pb_booking FOREIGN KEY (pnr) REFERENCES BOOKING (pnr) ON DELETE CASCADE,
    CONSTRAINT fk_pb_saved_passenger FOREIGN KEY (saved_passenger_id) REFERENCES SAVED_PASSENGER (passenger_id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- 24. RESERVATION (30,852 seat allotments and queue states)
CREATE TABLE RESERVATION (
    res_id INT NOT NULL,
    pnr VARCHAR(10) NOT NULL,
    passenger_no INT NOT NULL,
    schedule_id INT NOT NULL,
    seat_id INT NULL,
    status ENUM('CONFIRMED', 'RAC', 'WAITING_LIST', 'BOARDED', 'NO_SHOW', 'CANCELLED') NOT NULL,
    queue_position VARCHAR(16) NULL,
    PRIMARY KEY (res_id),
    UNIQUE KEY uq_res_pnr_pass (pnr, passenger_no),
    KEY idx_res_schedule_seat (schedule_id, seat_id),
    KEY idx_res_status (status),
    CONSTRAINT fk_res_pb FOREIGN KEY (pnr, passenger_no) REFERENCES PASSENGER_BOOKING (pnr, passenger_no) ON DELETE CASCADE,
    CONSTRAINT fk_res_schedule FOREIGN KEY (schedule_id) REFERENCES TRAIN_SCHEDULE (schedule_id),
    CONSTRAINT fk_res_seat FOREIGN KEY (seat_id) REFERENCES SEAT (seat_id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- 25. PAYMENT (16,375 payment records)
CREATE TABLE PAYMENT (
    payment_id INT NOT NULL,
    pnr VARCHAR(10) NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    method ENUM('CREDIT_CARD', 'DEBIT_CARD', 'UPI', 'NET_BANKING', 'CASH') NOT NULL,
    status ENUM('PENDING', 'SUCCESS', 'FAILED') NOT NULL,
    gateway_payment_id VARCHAR(64) NOT NULL,
    paid_at DATETIME NOT NULL,
    PRIMARY KEY (payment_id),
    UNIQUE KEY uq_payment_gateway_id (gateway_payment_id),
    KEY idx_payment_pnr (pnr),
    CONSTRAINT fk_payment_booking FOREIGN KEY (pnr) REFERENCES BOOKING (pnr) ON DELETE CASCADE,
    CONSTRAINT chk_payment_amount CHECK (amount > 0)
) ENGINE=InnoDB;

-- 26. CANCELLATION (435 cancellation records)
CREATE TABLE CANCELLATION (
    cancel_id INT NOT NULL,
    pnr VARCHAR(10) NOT NULL,
    passenger_no INT NULL,
    reason VARCHAR(128) NOT NULL,
    charge DECIMAL(10,2) NOT NULL,
    cancelled_at DATETIME NOT NULL,
    PRIMARY KEY (cancel_id),
    KEY idx_cancel_pnr (pnr),
    CONSTRAINT fk_cancel_booking FOREIGN KEY (pnr) REFERENCES BOOKING (pnr) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 27. TDR_FILING (1 filing)
CREATE TABLE TDR_FILING (
    tdr_ref_no VARCHAR(32) NOT NULL,
    pnr VARCHAR(10) NOT NULL,
    passenger_no INT NULL,
    reason ENUM('TRAIN_DELAYED_OVER_3_HOURS', 'TRAIN_DIVERTED', 'CLASS_DOWNGRADED', 'AC_FAILURE', 'COACH_NOT_ATTACHED', 'TRAIN_TERMINATED_SHORT') NOT NULL,
    filed_at DATETIME NOT NULL,
    status ENUM('FILED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'REFUND_PROCESSED') NOT NULL DEFAULT 'FILED',
    evidence_ref VARCHAR(128) NULL,
    refund_amount DECIMAL(10,2) NULL,
    reviewed_by INT NULL,
    reviewed_at DATETIME NULL,
    remarks TEXT NULL,
    PRIMARY KEY (tdr_ref_no),
    KEY idx_tdr_pnr (pnr),
    KEY idx_tdr_reviewed_by (reviewed_by),
    CONSTRAINT fk_tdr_booking FOREIGN KEY (pnr) REFERENCES BOOKING (pnr) ON DELETE CASCADE,
    CONSTRAINT fk_tdr_admin FOREIGN KEY (reviewed_by) REFERENCES ADMIN (admin_id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- 28. REFUND (436 refunds)
CREATE TABLE REFUND (
    refund_id INT NOT NULL,
    cancel_id INT NULL,
    tdr_ref_no VARCHAR(32) NULL,
    payment_id INT NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    reason ENUM('CANCELLATION', 'TDR_APPROVED', 'WAITLIST_PURGE', 'PAYMENT_AFTER_EXPIRY', 'TRAIN_CANCELLED') NOT NULL,
    status ENUM('PENDING', 'PROCESSED', 'FAILED') NOT NULL DEFAULT 'PENDING',
    PRIMARY KEY (refund_id),
    KEY idx_refund_cancel (cancel_id),
    KEY idx_refund_tdr (tdr_ref_no),
    KEY idx_refund_payment (payment_id),
    CONSTRAINT fk_refund_cancel FOREIGN KEY (cancel_id) REFERENCES CANCELLATION (cancel_id) ON DELETE CASCADE,
    CONSTRAINT fk_refund_tdr FOREIGN KEY (tdr_ref_no) REFERENCES TDR_FILING (tdr_ref_no) ON DELETE SET NULL,
    CONSTRAINT fk_refund_payment FOREIGN KEY (payment_id) REFERENCES PAYMENT (payment_id)
) ENGINE=InnoDB;

-- =============================================================================
-- 7. OPERATIONS, VERIFICATION, STAFF REPORTS & AUDIT
-- =============================================================================

-- 29. TICKET_VERIFICATION (1 record)
CREATE TABLE TICKET_VERIFICATION (
    verify_id INT NOT NULL,
    staff_id INT NOT NULL,
    pnr VARCHAR(10) NOT NULL,
    passenger_no INT NOT NULL,
    id_proof_match ENUM('VALID', 'INVALID', 'MISMATCH') NOT NULL,
    concession_match ENUM('VALID', 'INVALID', 'MISMATCH', 'NOT_APPLICABLE') NOT NULL,
    result ENUM('VALID', 'INVALID', 'MISMATCH') NOT NULL,
    remarks VARCHAR(255) NULL,
    verified_at DATETIME NOT NULL,
    PRIMARY KEY (verify_id),
    KEY idx_verify_staff (staff_id),
    KEY idx_verify_pnr (pnr),
    CONSTRAINT fk_verify_staff FOREIGN KEY (staff_id) REFERENCES STAFF (staff_id),
    CONSTRAINT fk_verify_booking FOREIGN KEY (pnr) REFERENCES BOOKING (pnr) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 30. FINE (3 records)
CREATE TABLE FINE (
    fine_id INT NOT NULL,
    verify_id INT NULL,
    staff_id INT NOT NULL,
    passenger_name VARCHAR(128) NOT NULL,
    id_proof_reference VARCHAR(64) NOT NULL,
    train_id INT NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    reason ENUM('TICKETLESS_TRAVEL', 'UNAUTHORIZED_CLASS', 'SMOKING_NUISANCE', 'UNBOOKED_LUGGAGE') NOT NULL,
    payment_status ENUM('PAID', 'UNPAID') NOT NULL DEFAULT 'UNPAID',
    issued_at DATETIME NOT NULL,
    PRIMARY KEY (fine_id),
    KEY idx_fine_staff (staff_id),
    KEY idx_fine_train (train_id),
    KEY idx_fine_verify (verify_id),
    CONSTRAINT fk_fine_staff FOREIGN KEY (staff_id) REFERENCES STAFF (staff_id),
    CONSTRAINT fk_fine_train FOREIGN KEY (train_id) REFERENCES TRAIN (train_id),
    CONSTRAINT fk_fine_verify FOREIGN KEY (verify_id) REFERENCES TICKET_VERIFICATION (verify_id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- 31. MAINTENANCE (2 records)
CREATE TABLE MAINTENANCE (
    maint_id INT NOT NULL,
    staff_id INT NOT NULL,
    coach_id INT NULL,
    platform_id INT NULL,
    type ENUM('CLEANING', 'REPAIR', 'AC_SERVICE', 'INSPECTION', 'SAFETY_CHECK') NOT NULL,
    status ENUM('OPEN', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED') NOT NULL DEFAULT 'OPEN',
    created_at DATETIME NOT NULL,
    completed_at DATETIME NULL,
    PRIMARY KEY (maint_id),
    KEY idx_maint_staff (staff_id),
    KEY idx_maint_coach (coach_id),
    KEY idx_maint_platform (platform_id),
    CONSTRAINT fk_maint_staff FOREIGN KEY (staff_id) REFERENCES STAFF (staff_id),
    CONSTRAINT fk_maint_coach FOREIGN KEY (coach_id) REFERENCES COACH (coach_id) ON DELETE CASCADE,
    CONSTRAINT fk_maint_platform FOREIGN KEY (platform_id) REFERENCES PLATFORM (platform_id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 32. INCIDENT (2 records)
CREATE TABLE INCIDENT (
    incident_id INT NOT NULL,
    staff_id INT NOT NULL,
    station_id INT NULL,
    schedule_id INT NULL,
    type VARCHAR(64) NOT NULL,
    severity ENUM('LOW', 'MEDIUM', 'HIGH', 'CRITICAL') NOT NULL,
    status ENUM('REPORTED', 'ACKNOWLEDGED', 'RESOLVED') NOT NULL DEFAULT 'REPORTED',
    reported_at DATETIME NOT NULL,
    PRIMARY KEY (incident_id),
    KEY idx_incident_staff (staff_id),
    KEY idx_incident_station (station_id),
    KEY idx_incident_schedule (schedule_id),
    CONSTRAINT fk_incident_staff FOREIGN KEY (staff_id) REFERENCES STAFF (staff_id),
    CONSTRAINT fk_incident_station FOREIGN KEY (station_id) REFERENCES STATION (station_id) ON DELETE SET NULL,
    CONSTRAINT fk_incident_schedule FOREIGN KEY (schedule_id) REFERENCES TRAIN_SCHEDULE (schedule_id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- 33. CROWD_REPORT (3 records)
CREATE TABLE CROWD_REPORT (
    crowd_report_id INT NOT NULL,
    station_id INT NOT NULL,
    platform_no INT NOT NULL,
    crowd_level ENUM('LOW', 'MODERATE', 'HIGH', 'OVERCROWDED') NOT NULL,
    head_count INT NOT NULL DEFAULT 0,
    staff_id INT NOT NULL,
    recorded_at DATETIME NOT NULL,
    PRIMARY KEY (crowd_report_id),
    KEY idx_crowd_station (station_id),
    KEY idx_crowd_staff (staff_id),
    CONSTRAINT fk_crowd_station FOREIGN KEY (station_id) REFERENCES STATION (station_id),
    CONSTRAINT fk_crowd_staff FOREIGN KEY (staff_id) REFERENCES STAFF (staff_id)
) ENGINE=InnoDB;

-- 34. CLEANLINESS_REPORT (3 records)
CREATE TABLE CLEANLINESS_REPORT (
    cleanliness_report_id INT NOT NULL,
    staff_id INT NOT NULL,
    train_id INT NULL,
    coach_id INT NULL,
    station_id INT NULL,
    platform_no INT NULL,
    issue_type ENUM('TOILET_DIRTY', 'LITTER', 'WATER_SHORTAGE', 'LINEN_SOILED', 'PESTS', 'SPILLAGE') NOT NULL,
    description TEXT NOT NULL,
    status ENUM('REPORTED', 'IN_PROGRESS', 'ATTENDING', 'RESOLVED') NOT NULL DEFAULT 'REPORTED',
    recorded_at DATETIME NOT NULL,
    PRIMARY KEY (cleanliness_report_id),
    KEY idx_clean_staff (staff_id),
    KEY idx_clean_train (train_id),
    KEY idx_clean_coach (coach_id),
    KEY idx_clean_station (station_id),
    CONSTRAINT fk_clean_staff FOREIGN KEY (staff_id) REFERENCES STAFF (staff_id),
    CONSTRAINT fk_clean_train FOREIGN KEY (train_id) REFERENCES TRAIN (train_id) ON DELETE SET NULL,
    CONSTRAINT fk_clean_coach FOREIGN KEY (coach_id) REFERENCES COACH (coach_id) ON DELETE SET NULL,
    CONSTRAINT fk_clean_station FOREIGN KEY (station_id) REFERENCES STATION (station_id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- 35. AUDIT_LOG (3 records)
CREATE TABLE AUDIT_LOG (
    log_id INT NOT NULL AUTO_INCREMENT,
    user_id INT NULL,
    action VARCHAR(64) NOT NULL,
    table_name VARCHAR(64) NOT NULL,
    record_id VARCHAR(64) NOT NULL,
    old_value JSON NULL,
    new_value JSON NULL,
    logged_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (log_id),
    KEY idx_audit_table_record (table_name, record_id),
    KEY idx_audit_user (user_id),
    CONSTRAINT fk_audit_user FOREIGN KEY (user_id) REFERENCES USER_ACCOUNT (user_id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- 36. REPORT (2 records)
CREATE TABLE REPORT (
    report_id INT NOT NULL,
    admin_id INT NOT NULL,
    report_type VARCHAR(64) NOT NULL,
    generated_at DATETIME NOT NULL,
    PRIMARY KEY (report_id),
    KEY idx_report_admin (admin_id),
    CONSTRAINT fk_report_admin FOREIGN KEY (admin_id) REFERENCES ADMIN (admin_id)
) ENGINE=InnoDB;

-- 37. CHART_SNAPSHOT (734 snapshot records)
CREATE TABLE CHART_SNAPSHOT (
    snapshot_id INT NOT NULL,
    schedule_id INT NOT NULL,
    pnr VARCHAR(10) NOT NULL,
    passenger_no INT NOT NULL,
    coach_no VARCHAR(10) NOT NULL,
    seat_no INT NOT NULL,
    berth_type VARCHAR(20) NOT NULL,
    status ENUM('CONFIRMED', 'RAC', 'WAITING_LIST', 'BOARDED', 'NO_SHOW', 'CANCELLED') NOT NULL,
    from_station_id INT NOT NULL,
    to_station_id INT NOT NULL,
    concession_flag TINYINT(1) NOT NULL DEFAULT 0,
    generated_at DATETIME NOT NULL,
    PRIMARY KEY (snapshot_id),
    KEY idx_chart_schedule (schedule_id),
    KEY idx_chart_pnr (pnr),
    CONSTRAINT fk_chart_schedule FOREIGN KEY (schedule_id) REFERENCES TRAIN_SCHEDULE (schedule_id) ON DELETE CASCADE,
    CONSTRAINT fk_chart_from_station FOREIGN KEY (from_station_id) REFERENCES STATION (station_id),
    CONSTRAINT fk_chart_to_station FOREIGN KEY (to_station_id) REFERENCES STATION (station_id)
) ENGINE=InnoDB;
