-- =============================================================================
-- Railway Reservation & Management System (MySQL 8.0)
-- File: 02_functions.sql
-- Description: User-defined functions for:
--   1. fn_calculate_distance (distance in km between two route stops)
--   2. fn_calculate_fare (detailed fare calculation per Section 6)
--   3. fn_check_monthly_ticket_limit (check 12 vs 24 monthly PNR limit)
--   4. fn_get_user_monthly_ticket_count (count valid PNRs in a calendar month)
--   5. fn_calculate_cancellation_refund (work out deduction and refund slab)
-- =============================================================================

USE railway_db;

DELIMITER $$

-- -----------------------------------------------------------------------------
-- 1. fn_calculate_distance
-- Calculates chargeable distance between boarding and destination route stops.
-- Enforces minimum chargeable distance of 100 km (BR-F1).
-- -----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS fn_calculate_distance$$
CREATE FUNCTION fn_calculate_distance(
    p_from_stop_id INT,
    p_to_stop_id INT
)
RETURNS INT
DETERMINISTIC
READS SQL DATA
BEGIN
    DECLARE v_from_dist INT DEFAULT 0;
    DECLARE v_to_dist INT DEFAULT 0;
    DECLARE v_dist INT DEFAULT 0;
    DECLARE v_min_km INT DEFAULT 100;

    SELECT distance_from_origin INTO v_from_dist FROM ROUTE_STOP WHERE stop_id = p_from_stop_id;
    SELECT distance_from_origin INTO v_to_dist FROM ROUTE_STOP WHERE stop_id = p_to_stop_id;

    SET v_dist = ABS(v_to_dist - v_from_dist);

    SELECT CAST(setting_value AS SIGNED) INTO v_min_km
    FROM SETTING
    WHERE setting_key = 'MIN_CHARGEABLE_KM';

    IF v_dist < v_min_km THEN
        SET v_dist = v_min_km;
    END IF;

    RETURN v_dist;
END$$

-- -----------------------------------------------------------------------------
-- 2. fn_get_user_monthly_ticket_count
-- Counts how many valid tickets (PNRs) a user created in the same calendar month.
-- Excludes FAILED bookings and shared COUNTER_WALKIN (BR-B15).
-- -----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS fn_get_user_monthly_ticket_count$$
CREATE FUNCTION fn_get_user_monthly_ticket_count(
    p_user_id INT,
    p_booking_date DATETIME
)
RETURNS INT
READS SQL DATA
BEGIN
    DECLARE v_count INT DEFAULT 0;

    -- Shared COUNTER_WALKIN account is exempt (user_id 50008)
    IF p_user_id = 50008 THEN
        RETURN 0;
    END IF;

    SELECT COUNT(*) INTO v_count
    FROM BOOKING
    WHERE user_id = p_user_id
      AND YEAR(created_at) = YEAR(p_booking_date)
      AND MONTH(created_at) = MONTH(p_booking_date)
      AND status != 'FAILED';

    RETURN v_count;
END$$

-- -----------------------------------------------------------------------------
-- 3. fn_check_monthly_ticket_limit
-- Returns 1 if user can book, 0 if MONTHLY_LIMIT_EXCEEDED (12 or 24 if Aadhaar verified).
-- -----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS fn_check_monthly_ticket_limit$$
CREATE FUNCTION fn_check_monthly_ticket_limit(
    p_user_id INT,
    p_booking_date DATETIME
)
RETURNS TINYINT(1)
READS SQL DATA
BEGIN
    DECLARE v_aadhaar_verified TINYINT(1) DEFAULT 0;
    DECLARE v_max_limit INT DEFAULT 12;
    DECLARE v_current_count INT DEFAULT 0;

    IF p_user_id = 50008 THEN
        RETURN 1; -- COUNTER_WALKIN exempt
    END IF;

    SELECT aadhaar_verified INTO v_aadhaar_verified
    FROM USER_ACCOUNT
    WHERE user_id = p_user_id;

    IF v_aadhaar_verified = 1 THEN
        SELECT CAST(setting_value AS SIGNED) INTO v_max_limit
        FROM SETTING WHERE setting_key = 'MAX_TICKETS_PER_MONTH_AADHAAR_VERIFIED';
        IF v_max_limit IS NULL THEN SET v_max_limit = 24; END IF;
    ELSE
        SELECT CAST(setting_value AS SIGNED) INTO v_max_limit
        FROM SETTING WHERE setting_key = 'MAX_TICKETS_PER_MONTH';
        IF v_max_limit IS NULL THEN SET v_max_limit = 12; END IF;
    END IF;

    SET v_current_count = fn_get_user_monthly_ticket_count(p_user_id, p_booking_date);

    IF v_current_count >= v_max_limit THEN
        RETURN 0;
    END IF;

    RETURN 1;
END$$

-- -----------------------------------------------------------------------------
-- 4. fn_calculate_fare
-- Computes passenger fare components per Section 6 (Base, Concession, Res,
-- Superfast, Tatkal, Dynamic, GST, Insurance, Total).
-- Returns JSON object with all components.
-- -----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS fn_calculate_fare$$
CREATE FUNCTION fn_calculate_fare(
    p_class_id INT,
    p_train_id INT,
    p_distance INT,
    p_quota VARCHAR(20),
    p_concession_type VARCHAR(20),
    p_include_insurance TINYINT(1),
    p_schedule_id INT
)
RETURNS JSON
READS SQL DATA
BEGIN
    DECLARE v_train_type VARCHAR(20);
    DECLARE v_coach_type VARCHAR(10);
    DECLARE v_rate_per_km DECIMAL(6,2) DEFAULT 0.00;
    DECLARE v_base_fare DECIMAL(10,2) DEFAULT 0.00;
    DECLARE v_concession_pct DECIMAL(5,2) DEFAULT 0.00;
    DECLARE v_concession_discount DECIMAL(10,2) DEFAULT 0.00;
    DECLARE v_res_charge DECIMAL(10,2) DEFAULT 0.00;
    DECLARE v_sf_charge DECIMAL(10,2) DEFAULT 0.00;
    DECLARE v_tatkal_charge DECIMAL(10,2) DEFAULT 0.00;
    DECLARE v_dynamic_surcharge DECIMAL(10,2) DEFAULT 0.00;
    DECLARE v_taxable DECIMAL(10,2) DEFAULT 0.00;
    DECLARE v_gst DECIMAL(10,2) DEFAULT 0.00;
    DECLARE v_insurance DECIMAL(10,2) DEFAULT 0.00;
    DECLARE v_total_fare DECIMAL(10,2) DEFAULT 0.00;

    -- 1. Identify train type and coach type
    SELECT train_type INTO v_train_type FROM TRAIN WHERE train_id = p_train_id;
    SELECT coach_type INTO v_coach_type FROM SEAT_CLASS WHERE class_id = p_class_id;

    -- 2. Lookup rate per km from FARE slab table
    SELECT rate_per_km INTO v_rate_per_km
    FROM FARE
    WHERE class_id = p_class_id
      AND p_distance >= min_distance_km
      AND (max_distance_km IS NULL OR max_distance_km = 0 OR p_distance <= max_distance_km)
    LIMIT 1;

    IF v_rate_per_km IS NULL THEN
        -- Fallback to default multiplier
        SELECT base_multiplier INTO v_rate_per_km FROM SEAT_CLASS WHERE class_id = p_class_id;
    END IF;

    SET v_base_fare = ROUND(p_distance * v_rate_per_km, 2);

    -- 3. Concession (Divyaang only, on base fare; Tatkal cannot have concession)
    IF p_quota != 'TATKAL' AND p_concession_type = 'DIVYAANG' THEN
        IF v_train_type IN ('RAJDHANI', 'SHATABDI', 'DURONTO', 'VANDE_BHARAT') AND p_class_id IN (3, 5) THEN -- 3A, CC
            SET v_concession_pct = 25.00;
        ELSEIF p_class_id IN (4, 7, 3, 5) THEN -- SL, 2S, 3A, CC
            SET v_concession_pct = 75.00;
        ELSEIF p_class_id IN (1, 2) THEN -- 1A, 2A
            SET v_concession_pct = 50.00;
        ELSE -- EC
            SET v_concession_pct = 0.00;
        END IF;
        SET v_concession_discount = ROUND(v_base_fare * (v_concession_pct / 100.00), 2);
    END IF;

    -- 4. Reservation charge
    CASE p_class_id
        WHEN 7 THEN SET v_res_charge = 15.00; -- 2S
        WHEN 4 THEN SET v_res_charge = 20.00; -- SL
        WHEN 3 THEN SET v_res_charge = 40.00; -- 3A
        WHEN 2 THEN SET v_res_charge = 50.00; -- 2A
        WHEN 1 THEN SET v_res_charge = 60.00; -- 1A
        WHEN 5 THEN SET v_res_charge = 40.00; -- CC
        WHEN 6 THEN SET v_res_charge = 60.00; -- EC
        ELSE SET v_res_charge = 20.00;
    END CASE;

    -- 5. Superfast charge (Rajdhani, Shatabdi, Duronto, Vande Bharat)
    IF v_train_type IN ('RAJDHANI', 'SHATABDI', 'DURONTO', 'VANDE_BHARAT') THEN
        CASE p_class_id
            WHEN 7 THEN SET v_sf_charge = 15.00; -- 2S
            WHEN 4 THEN SET v_sf_charge = 30.00; -- SL
            WHEN 3 THEN SET v_sf_charge = 45.00; -- 3A
            WHEN 2 THEN SET v_sf_charge = 45.00; -- 2A
            WHEN 1 THEN SET v_sf_charge = 75.00; -- 1A
            WHEN 5 THEN SET v_sf_charge = 45.00; -- CC
            WHEN 6 THEN SET v_sf_charge = 75.00; -- EC
            ELSE SET v_sf_charge = 30.00;
        END CASE;
    END IF;

    -- 6. Tatkal charge (30% AC, 10% non-AC of base fare)
    IF p_quota = 'TATKAL' THEN
        IF v_coach_type = 'AC' THEN
            SET v_tatkal_charge = ROUND(v_base_fare * 0.30, 2);
        ELSE
            SET v_tatkal_charge = ROUND(v_base_fare * 0.10, 2);
        END IF;
    END IF;

    -- 7. Taxable Amount
    SET v_taxable = (v_base_fare - v_concession_discount) + v_res_charge + v_sf_charge + v_tatkal_charge + v_dynamic_surcharge;

    -- 8. GST (5% on AC classes)
    IF v_coach_type = 'AC' THEN
        SET v_gst = ROUND(v_taxable * 0.05, 2);
    ELSE
        SET v_gst = 0.00;
    END IF;

    -- 9. Optional insurance premium (0.45 flat)
    IF p_include_insurance = 1 THEN
        SET v_insurance = 0.45;
    ELSE
        SET v_insurance = 0.00;
    END IF;

    -- 10. Total fare
    SET v_total_fare = ROUND(v_taxable + v_gst + v_insurance, 2);

    RETURN JSON_OBJECT(
        'base_fare', v_base_fare,
        'concession_discount', v_concession_discount,
        'reservation_charge', v_res_charge,
        'superfast_charge', v_sf_charge,
        'tatkal_charge', v_tatkal_charge,
        'dynamic_surcharge', v_dynamic_surcharge,
        'gst', v_gst,
        'insurance', v_insurance,
        'total_fare', v_total_fare
    );
END$$

-- -----------------------------------------------------------------------------
-- 5. fn_calculate_cancellation_refund
-- Computes cancellation deduction charge and net refund amount per Section 8.
-- Returns JSON with charge and refund_amount.
-- -----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS fn_calculate_cancellation_refund$$
CREATE FUNCTION fn_calculate_cancellation_refund(
    p_pnr VARCHAR(10),
    p_passenger_no INT,
    p_cancellation_time DATETIME
)
RETURNS JSON
READS SQL DATA
BEGIN
    DECLARE v_status VARCHAR(20);
    DECLARE v_quota VARCHAR(20);
    DECLARE v_class_id INT;
    DECLARE v_schedule_id INT;
    DECLARE v_total_fare DECIMAL(10,2);
    DECLARE v_insurance DECIMAL(10,2);
    DECLARE v_dep_date DATE;
    DECLARE v_dep_time TIME;
    DECLARE v_origin_departure DATETIME;
    DECLARE v_hours_left DECIMAL(10,2);
    DECLARE v_charge DECIMAL(10,2) DEFAULT 0.00;
    DECLARE v_refund DECIMAL(10,2) DEFAULT 0.00;
    DECLARE v_flat_min DECIMAL(10,2) DEFAULT 0.00;
    DECLARE v_deduction_pct DECIMAL(5,2) DEFAULT 0.00;
    DECLARE v_clerkage DECIMAL(10,2) DEFAULT 60.00;
    DECLARE v_eligible_fare DECIMAL(10,2) DEFAULT 0.00;

    -- Retrieve booking & passenger info
    SELECT b.schedule_id, b.class_id, b.quota, pb.total_fare, pb.insurance, r.status
    INTO v_schedule_id, v_class_id, v_quota, v_total_fare, v_insurance, v_status
    FROM BOOKING b
    JOIN PASSENGER_BOOKING pb ON b.pnr = pb.pnr
    JOIN RESERVATION r ON pb.pnr = r.pnr AND pb.passenger_no = r.passenger_no
    WHERE b.pnr = p_pnr AND pb.passenger_no = p_passenger_no;

    -- Origin departure datetime
    SELECT journey_date, departure_time
    INTO v_dep_date, v_dep_time
    FROM TRAIN_SCHEDULE
    WHERE schedule_id = v_schedule_id;

    SET v_origin_departure = TIMESTAMP(v_dep_date, v_dep_time);
    IF p_cancellation_time IS NOT NULL THEN
        SET v_hours_left = TIMESTAMPDIFF(MINUTE, p_cancellation_time, v_origin_departure) / 60.0;
    ELSEIF @as_of_time IS NOT NULL THEN
        SET v_hours_left = TIMESTAMPDIFF(MINUTE, @as_of_time, v_origin_departure) / 60.0;
    ELSE
        SET v_hours_left = TIMESTAMPDIFF(MINUTE, NOW(), v_origin_departure) / 60.0;
    END IF;
    SET v_eligible_fare = v_total_fare - v_insurance; -- Insurance never refunded on voluntary cancel

    -- Rule BR-R6: Confirmed Tatkal tickets get no refund
    IF v_quota = 'TATKAL' AND v_status = 'CONFIRMED' THEN
        SET v_charge = v_eligible_fare;
        SET v_refund = 0.00;
        RETURN JSON_OBJECT('charge', v_charge, 'refund_amount', v_refund);
    END IF;

    -- Rule BR-R5: RAC and WL passengers get full refund minus clerkage
    IF v_status IN ('RAC', 'WAITING_LIST') THEN
        SELECT CAST(setting_value AS DECIMAL(10,2)) INTO v_clerkage
        FROM SETTING WHERE setting_key = 'CLERKAGE_PER_PASSENGER';
        IF v_clerkage IS NULL THEN SET v_clerkage = 60.00; END IF;

        IF v_eligible_fare > v_clerkage THEN
            SET v_charge = v_clerkage;
            SET v_refund = v_eligible_fare - v_clerkage;
        ELSE
            SET v_charge = v_eligible_fare;
            SET v_refund = 0.00;
        END IF;
        RETURN JSON_OBJECT('charge', v_charge, 'refund_amount', v_refund);
    END IF;

    -- Rule BR-R1: Confirmed ticket refund slabs by origin departure time
    IF v_hours_left > 72 THEN
        -- Flat minimum charge
        CASE v_class_id
            WHEN 1 THEN SET v_flat_min = 240.00; -- 1A
            WHEN 6 THEN SET v_flat_min = 240.00; -- EC
            WHEN 2 THEN SET v_flat_min = 200.00; -- 2A
            WHEN 3 THEN SET v_flat_min = 180.00; -- 3A
            WHEN 5 THEN SET v_flat_min = 180.00; -- CC
            WHEN 4 THEN SET v_flat_min = 120.00; -- SL
            WHEN 7 THEN SET v_flat_min = 60.00;  -- 2S
            ELSE SET v_flat_min = 120.00;
        END CASE;
        SET v_charge = v_flat_min;
    ELSEIF v_hours_left >= 24 AND v_hours_left <= 72 THEN
        CASE v_class_id
            WHEN 1 THEN SET v_flat_min = 240.00;
            WHEN 6 THEN SET v_flat_min = 240.00;
            WHEN 2 THEN SET v_flat_min = 200.00;
            WHEN 3 THEN SET v_flat_min = 180.00;
            WHEN 5 THEN SET v_flat_min = 180.00;
            WHEN 4 THEN SET v_flat_min = 120.00;
            WHEN 7 THEN SET v_flat_min = 60.00;
            ELSE SET v_flat_min = 120.00;
        END CASE;
        SET v_charge = ROUND(v_eligible_fare * 0.25, 2);
        IF v_charge < v_flat_min THEN SET v_charge = v_flat_min; END IF;
    ELSEIF v_hours_left >= 8 AND v_hours_left < 24 THEN
        CASE v_class_id
            WHEN 1 THEN SET v_flat_min = 240.00;
            WHEN 6 THEN SET v_flat_min = 240.00;
            WHEN 2 THEN SET v_flat_min = 200.00;
            WHEN 3 THEN SET v_flat_min = 180.00;
            WHEN 5 THEN SET v_flat_min = 180.00;
            WHEN 4 THEN SET v_flat_min = 120.00;
            WHEN 7 THEN SET v_flat_min = 60.00;
            ELSE SET v_flat_min = 120.00;
        END CASE;
        SET v_charge = ROUND(v_eligible_fare * 0.50, 2);
        IF v_charge < v_flat_min THEN SET v_charge = v_flat_min; END IF;
    ELSE
        -- Less than 8 hours: No refund
        SET v_charge = v_eligible_fare;
    END IF;

    IF v_charge > v_eligible_fare THEN
        SET v_charge = v_eligible_fare;
    END IF;

    SET v_refund = ROUND(v_eligible_fare - v_charge, 2);

    RETURN JSON_OBJECT('charge', v_charge, 'refund_amount', v_refund);
END$$

DELIMITER ;
