-- =============================================================================
-- Railway Reservation & Management System (MySQL 8.0)
-- File: 03_procedures.sql
-- Description: Stored procedures with business rules:
--   1. sp_promote_passenger (Single promotion procedure per BR-W4, BR-W5, BR-W6)
--      * NO explicit transaction control inside (no COMMIT/ROLLBACK)
--      * Handles VARCHAR queue_position ('RAC/1', 'WL/1', etc.)
--   2. sp_mark_passenger_noshow (Staff NO_SHOW action calling sp_promote_passenger)
--   3. sp_create_booking (Booking procedure with quota fallback, RAC/WL, berth
--      preference check, monthly limit check, chart lockout, savepoints)
--   4. sp_cancel_passenger_ticket (Cancellation with refund slabs, clerkage)
--   5. sp_prepare_chart (Chart prep: lockout, quota sweep, auto-upgrade, WL purge, snapshot)
--   6. sp_process_late_payment_refund (BR-B14 auto-refund for expired/failed holds)
--   7. sp_create_counter_booking (Counter booking for walk-in passengers)
-- =============================================================================

USE railway_db;

DELIMITER $$

-- -----------------------------------------------------------------------------
-- 1. sp_promote_passenger
-- ONE single promotion procedure called from:
--   - trg_after_cancellation_promote (AFTER INSERT ON CANCELLATION trigger)
--   - sp_mark_passenger_noshow (Staff NO_SHOW action)
--   - sp_prepare_chart (during chart preparation quota release & auto-upgrade)
--
-- Crucial architectural design for MySQL 8.0:
--   - Contains NO 'START TRANSACTION', 'COMMIT', or 'ROLLBACK'
--   - Does NOT touch or modify CANCELLATION table
--   - Safe to be invoked from within triggers as well as procedures.
--   - Extracts numeric suffix from 'RAC/x' and 'WL/x' strings for queue management.
-- -----------------------------------------------------------------------------
DROP PROCEDURE IF EXISTS sp_promote_passenger$$
CREATE PROCEDURE sp_promote_passenger(
    IN p_schedule_id INT,
    IN p_class_id INT,
    IN p_freed_seat_id INT
)
proc_label: BEGIN
    DECLARE v_rac_res_id INT DEFAULT NULL;
    DECLARE v_rac_pnr VARCHAR(10) DEFAULT NULL;
    DECLARE v_rac_pass_no INT DEFAULT NULL;
    DECLARE v_wl_res_id INT DEFAULT NULL;
    DECLARE v_wl_pnr VARCHAR(10) DEFAULT NULL;
    DECLARE v_wl_pass_no INT DEFAULT NULL;
    DECLARE v_wl_old_num INT DEFAULT NULL;
    DECLARE v_max_rac_num INT DEFAULT 0;

    -- If a confirmed seat is freed
    IF p_freed_seat_id IS NOT NULL THEN
        -- Find lowest RAC passenger for this schedule and class
        SELECT r.res_id, r.pnr, r.passenger_no
        INTO v_rac_res_id, v_rac_pnr, v_rac_pass_no
        FROM RESERVATION r
        JOIN BOOKING b ON r.pnr = b.pnr
        WHERE r.schedule_id = p_schedule_id
          AND b.class_id = p_class_id
          AND r.status = 'RAC'
        ORDER BY
            CAST(SUBSTRING_INDEX(COALESCE(r.queue_position, '0'), '/', -1) AS UNSIGNED) ASC,
            r.res_id ASC
        LIMIT 1;

        IF v_rac_res_id IS NOT NULL THEN
            -- Promote RAC passenger to CONFIRMED with freed seat
            UPDATE RESERVATION
            SET status = 'CONFIRMED',
                seat_id = p_freed_seat_id,
                queue_position = NULL
            WHERE res_id = v_rac_res_id;

            -- Check if booking overall status should update to CONFIRMED
            IF NOT EXISTS (
                SELECT 1 FROM RESERVATION
                WHERE pnr = v_rac_pnr AND status IN ('RAC', 'WAITING_LIST')
            ) THEN
                UPDATE BOOKING SET status = 'CONFIRMED' WHERE pnr = v_rac_pnr;
            END IF;

            -- Update class inventory counts: RAC count decrements, available seats adjust
            UPDATE SCHEDULE_CLASS_INVENTORY
            SET rac_count = GREATEST(0, rac_count - 1)
            WHERE schedule_id = p_schedule_id AND class_id = p_class_id;

            -- A RAC slot just opened up! Now advance lowest WL passenger to RAC
            SELECT r.res_id, r.pnr, r.passenger_no,
                   CAST(SUBSTRING_INDEX(COALESCE(r.queue_position, '0'), '/', -1) AS UNSIGNED)
            INTO v_wl_res_id, v_wl_pnr, v_wl_pass_no, v_wl_old_num
            FROM RESERVATION r
            JOIN BOOKING b ON r.pnr = b.pnr
            WHERE r.schedule_id = p_schedule_id
              AND b.class_id = p_class_id
              AND r.status = 'WAITING_LIST'
            ORDER BY
                CAST(SUBSTRING_INDEX(COALESCE(r.queue_position, '0'), '/', -1) AS UNSIGNED) ASC,
                r.res_id ASC
            LIMIT 1;

            IF v_wl_res_id IS NOT NULL THEN
                -- Find highest current RAC queue position + 1
                SELECT COALESCE(MAX(CAST(SUBSTRING_INDEX(COALESCE(r.queue_position, '0'), '/', -1) AS UNSIGNED)), 0) + 1
                INTO v_max_rac_num
                FROM RESERVATION r
                JOIN BOOKING b ON r.pnr = b.pnr
                WHERE r.schedule_id = p_schedule_id AND b.class_id = p_class_id AND r.status = 'RAC';

                UPDATE RESERVATION
                SET status = 'RAC',
                    queue_position = CONCAT('RAC/', v_max_rac_num)
                WHERE res_id = v_wl_res_id;

                UPDATE BOOKING SET status = 'RAC' WHERE pnr = v_wl_pnr AND status = 'WAITING_LIST';

                UPDATE SCHEDULE_CLASS_INVENTORY
                SET rac_count = rac_count + 1,
                    wl_count = GREATEST(0, wl_count - 1)
                WHERE schedule_id = p_schedule_id AND class_id = p_class_id;

                -- Shift subsequent WL queue positions up by 1
                UPDATE RESERVATION r
                JOIN BOOKING b ON r.pnr = b.pnr
                SET r.queue_position = CONCAT('WL/', CAST(SUBSTRING_INDEX(r.queue_position, '/', -1) AS UNSIGNED) - 1)
                WHERE r.schedule_id = p_schedule_id
                  AND b.class_id = p_class_id
                  AND r.status = 'WAITING_LIST'
                  AND CAST(SUBSTRING_INDEX(COALESCE(r.queue_position, '0'), '/', -1) AS UNSIGNED) > v_wl_old_num;
            END IF;

        ELSE
            -- No RAC passengers exist. Check if a Waiting List passenger exists directly (e.g., classes without RAC like 1A, CC, EC)
            SELECT r.res_id, r.pnr, r.passenger_no,
                   CAST(SUBSTRING_INDEX(COALESCE(r.queue_position, '0'), '/', -1) AS UNSIGNED)
            INTO v_wl_res_id, v_wl_pnr, v_wl_pass_no, v_wl_old_num
            FROM RESERVATION r
            JOIN BOOKING b ON r.pnr = b.pnr
            WHERE r.schedule_id = p_schedule_id
              AND b.class_id = p_class_id
              AND r.status = 'WAITING_LIST'
            ORDER BY
                CAST(SUBSTRING_INDEX(COALESCE(r.queue_position, '0'), '/', -1) AS UNSIGNED) ASC,
                r.res_id ASC
            LIMIT 1;

            IF v_wl_res_id IS NOT NULL THEN
                UPDATE RESERVATION
                SET status = 'CONFIRMED',
                    seat_id = p_freed_seat_id,
                    queue_position = NULL
                WHERE res_id = v_wl_res_id;

                IF NOT EXISTS (
                    SELECT 1 FROM RESERVATION
                    WHERE pnr = v_wl_pnr AND status IN ('RAC', 'WAITING_LIST')
                ) THEN
                    UPDATE BOOKING SET status = 'CONFIRMED' WHERE pnr = v_wl_pnr;
                END IF;

                UPDATE SCHEDULE_CLASS_INVENTORY
                SET wl_count = GREATEST(0, wl_count - 1)
                WHERE schedule_id = p_schedule_id AND class_id = p_class_id;

                UPDATE RESERVATION r
                JOIN BOOKING b ON r.pnr = b.pnr
                SET r.queue_position = CONCAT('WL/', CAST(SUBSTRING_INDEX(r.queue_position, '/', -1) AS UNSIGNED) - 1)
                WHERE r.schedule_id = p_schedule_id
                  AND b.class_id = p_class_id
                  AND r.status = 'WAITING_LIST'
                  AND CAST(SUBSTRING_INDEX(COALESCE(r.queue_position, '0'), '/', -1) AS UNSIGNED) > v_wl_old_num;
            ELSE
                UPDATE SCHEDULE_CLASS_INVENTORY
                SET available_seats = available_seats + 1
                WHERE schedule_id = p_schedule_id AND class_id = p_class_id;
            END IF;
        END IF;

    ELSE
        -- No specific seat freed, but an RAC slot freed (e.g. RAC passenger cancelled)
        SELECT r.res_id, r.pnr, r.passenger_no,
               CAST(SUBSTRING_INDEX(COALESCE(r.queue_position, '0'), '/', -1) AS UNSIGNED)
        INTO v_wl_res_id, v_wl_pnr, v_wl_pass_no, v_wl_old_num
        FROM RESERVATION r
        JOIN BOOKING b ON r.pnr = b.pnr
        WHERE r.schedule_id = p_schedule_id
          AND b.class_id = p_class_id
          AND r.status = 'WAITING_LIST'
        ORDER BY
            CAST(SUBSTRING_INDEX(COALESCE(r.queue_position, '0'), '/', -1) AS UNSIGNED) ASC,
            r.res_id ASC
        LIMIT 1;

        IF v_wl_res_id IS NOT NULL THEN
            SELECT COALESCE(MAX(CAST(SUBSTRING_INDEX(COALESCE(r.queue_position, '0'), '/', -1) AS UNSIGNED)), 0) + 1
            INTO v_max_rac_num
            FROM RESERVATION r
            JOIN BOOKING b ON r.pnr = b.pnr
            WHERE r.schedule_id = p_schedule_id AND b.class_id = p_class_id AND r.status = 'RAC';

            UPDATE RESERVATION
            SET status = 'RAC',
                queue_position = CONCAT('RAC/', v_max_rac_num)
            WHERE res_id = v_wl_res_id;

            UPDATE BOOKING SET status = 'RAC' WHERE pnr = v_wl_pnr AND status = 'WAITING_LIST';

            UPDATE SCHEDULE_CLASS_INVENTORY
            SET wl_count = GREATEST(0, wl_count - 1)
            WHERE schedule_id = p_schedule_id AND class_id = p_class_id;

            UPDATE RESERVATION r
            JOIN BOOKING b ON r.pnr = b.pnr
            SET r.queue_position = CONCAT('WL/', CAST(SUBSTRING_INDEX(r.queue_position, '/', -1) AS UNSIGNED) - 1)
            WHERE r.schedule_id = p_schedule_id
              AND b.class_id = p_class_id
              AND r.status = 'WAITING_LIST'
              AND CAST(SUBSTRING_INDEX(COALESCE(r.queue_position, '0'), '/', -1) AS UNSIGNED) > v_wl_old_num;
        ELSE
            UPDATE SCHEDULE_CLASS_INVENTORY
            SET rac_count = GREATEST(0, rac_count - 1)
            WHERE schedule_id = p_schedule_id AND class_id = p_class_id;
        END IF;
    END IF;

END proc_label$$

-- -----------------------------------------------------------------------------
-- 2. sp_mark_passenger_noshow
-- Staff action to mark a passenger NO_SHOW, freeing their berth and calling
-- the single promotion procedure sp_promote_passenger (BR-ST5).
-- -----------------------------------------------------------------------------
DROP PROCEDURE IF EXISTS sp_mark_passenger_noshow$$
CREATE PROCEDURE sp_mark_passenger_noshow(
    IN p_pnr VARCHAR(10),
    IN p_passenger_no INT,
    OUT p_out_status VARCHAR(20)
)
proc_label: BEGIN
    DECLARE v_sched_id INT;
    DECLARE v_cls_id INT;
    DECLARE v_st_id INT DEFAULT NULL;

    SELECT b.schedule_id, b.class_id, r.seat_id
    INTO v_sched_id, v_cls_id, v_st_id
    FROM BOOKING b
    JOIN RESERVATION r ON b.pnr = r.pnr
    WHERE b.pnr = p_pnr AND r.passenger_no = p_passenger_no
    LIMIT 1;

    IF v_sched_id IS NULL THEN
        SET p_out_status = 'NOT_FOUND';
        LEAVE proc_label;
    END IF;

    -- Update reservation status to NO_SHOW and vacate physical seat
    UPDATE RESERVATION
    SET status = 'NO_SHOW',
        seat_id = NULL
    WHERE pnr = p_pnr AND passenger_no = p_passenger_no;

    -- Trigger the single promotion procedure
    IF v_st_id IS NOT NULL THEN
        CALL sp_promote_passenger(v_sched_id, v_cls_id, v_st_id);
    END IF;

    SET p_out_status = 'NO_SHOW_MARKED';
END proc_label$$

-- -----------------------------------------------------------------------------
-- 3. sp_create_booking
-- Complete booking transaction with:
--   - Chart-time check (CHART_PREPARED)
--   - Monthly ticket limit check (MONTHLY_LIMIT_EXCEEDED)
--   - Adult passenger check (NO_ADULT_PASSENGER)
--   - Quota fallback handling with user consent (BR-Q13)
--   - Berth preference condition check (BERTH_PREFERENCE_NOT_MET) with SAVEPOINT
--   - RAC and Waiting List allocation (WAITING_LIST_FULL)
--   - Transaction safety: p_manage_tx = 1 manages its own transaction; p_manage_tx = 0
--     participates safely in caller's transaction without stray COMMIT/ROLLBACK.
--   - Exact error codes per BR-B5
-- -----------------------------------------------------------------------------
DROP PROCEDURE IF EXISTS sp_create_booking$$
CREATE PROCEDURE sp_create_booking(
    IN p_user_id INT,
    IN p_schedule_id INT,
    IN p_class_id INT,
    IN p_from_stop_id INT,
    IN p_to_stop_id INT,
    IN p_quota VARCHAR(20),
    IN p_fallback_consent TINYINT(1),
    IN p_berth_condition TINYINT(1),
    IN p_passengers JSON,
    IN p_channel VARCHAR(10),
    IN p_staff_id INT,
    IN p_manage_tx TINYINT(1),
    OUT p_out_pnr VARCHAR(10),
    OUT p_out_status VARCHAR(20),
    OUT p_out_total_fare DECIMAL(10,2),
    OUT p_out_error_code VARCHAR(32)
)
proc_label: BEGIN
    DECLARE v_chart_prep DATETIME DEFAULT NULL;
    DECLARE v_journey_date DATE;
    DECLARE v_dep_time TIME;
    DECLARE v_train_id INT;
    DECLARE v_pass_count INT DEFAULT 0;
    DECLARE v_adult_count INT DEFAULT 0;
    DECLARE v_idx INT DEFAULT 0;
    DECLARE v_can_book TINYINT(1) DEFAULT 1;
    DECLARE v_active_quota VARCHAR(20);
    DECLARE v_requested_quota VARCHAR(20);
    DECLARE v_avail_seats INT DEFAULT 0;
    DECLARE v_rac_cap INT DEFAULT 0;
    DECLARE v_rac_cnt INT DEFAULT 0;
    DECLARE v_wl_cap INT DEFAULT 0;
    DECLARE v_wl_cnt INT DEFAULT 0;
    DECLARE v_new_pnr VARCHAR(10);
    DECLARE v_total_booking_fare DECIMAL(10,2) DEFAULT 0.00;
    DECLARE v_overall_status VARCHAR(20) DEFAULT 'CONFIRMED';
    DECLARE v_distance INT DEFAULT 0;
    DECLARE v_has_berths TINYINT(1) DEFAULT 1;
    DECLARE v_tot_class_seats INT DEFAULT 0;
    DECLARE v_quota_cap INT DEFAULT 0;
    DECLARE v_quota_booked INT DEFAULT 0;
    DECLARE v_quota_free INT DEFAULT 0;
    DECLARE v_tatkal_cap INT DEFAULT 0;
    DECLARE v_ladies_cap INT DEFAULT 0;
    DECLARE v_divyaang_cap INT DEFAULT 0;
    DECLARE v_senior_cap INT DEFAULT 0;

    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        IF p_manage_tx = 1 THEN
            ROLLBACK;
        END IF;
        SET p_out_error_code = 'TRANSACTION_FAILED';
        SET p_out_pnr = NULL;
        SET p_out_status = 'FAILED';
    END;

    IF p_manage_tx = 1 THEN
        START TRANSACTION;
    END IF;

    SET p_out_error_code = NULL;
    SET v_pass_count = JSON_LENGTH(p_passengers);

    IF v_pass_count IS NULL OR v_pass_count < 1 THEN
        IF p_manage_tx = 1 THEN ROLLBACK; END IF;
        SET p_out_error_code = 'SEAT_NOT_AVAILABLE';
        LEAVE proc_label;
    END IF;

    -- 1. Check at least one adult (age >= 18) (BR-Q15, BR-B3)
    SET v_idx = 0;
    WHILE v_idx < v_pass_count DO
        IF JSON_EXTRACT(p_passengers, CONCAT('$[', v_idx, '].age')) >= 18 THEN
            SET v_adult_count = v_adult_count + 1;
        END IF;
        SET v_idx = v_idx + 1;
    END WHILE;

    IF v_adult_count = 0 THEN
        IF p_manage_tx = 1 THEN ROLLBACK; END IF;
        SET p_out_error_code = 'NO_ADULT_PASSENGER';
        LEAVE proc_label;
    END IF;

    -- 2. Lock schedule and check Chart Prepared / Lockout (BR-B12a)
    SELECT ts.chart_prepared_at, ts.journey_date, ts.departure_time, ts.train_id
    INTO v_chart_prep, v_journey_date, v_dep_time, v_train_id
    FROM TRAIN_SCHEDULE ts
    WHERE ts.schedule_id = p_schedule_id
    FOR UPDATE;

    IF v_chart_prep IS NOT NULL THEN
        IF p_manage_tx = 1 THEN ROLLBACK; END IF;
        SET p_out_error_code = 'CHART_PREPARED';
        LEAVE proc_label;
    END IF;

    -- 3. Check Monthly ticket limit (BR-B15)
    SET v_can_book = fn_check_monthly_ticket_limit(p_user_id, NOW());
    IF v_can_book = 0 THEN
        IF p_manage_tx = 1 THEN ROLLBACK; END IF;
        SET p_out_error_code = 'MONTHLY_LIMIT_EXCEEDED';
        LEAVE proc_label;
    END IF;

    -- 4. Check Inventory and Quota Free Seats for run & class
    SELECT total_seats, available_seats, rac_capacity, rac_count, wl_capacity, wl_count
    INTO v_tot_class_seats, v_avail_seats, v_rac_cap, v_rac_cnt, v_wl_cap, v_wl_cnt
    FROM SCHEDULE_CLASS_INVENTORY
    WHERE schedule_id = p_schedule_id AND class_id = p_class_id
    FOR UPDATE;

    SELECT has_berths INTO v_has_berths FROM SEAT_CLASS WHERE class_id = p_class_id;

    SET v_requested_quota = p_quota;
    SET v_active_quota = p_quota;

    -- Compute quota capacities per BR-Q10
    SET v_tatkal_cap = ROUND(v_tot_class_seats * 0.10);
    SET v_ladies_cap = ROUND(v_tot_class_seats * 0.10);
    IF p_class_id IN (3, 4, 5, 7) THEN SET v_divyaang_cap = 4; ELSE SET v_divyaang_cap = 0; END IF;
    IF p_class_id = 4 THEN SET v_senior_cap = 6 * (SELECT COUNT(*) FROM COACH WHERE train_id = v_train_id AND class_id = 4);
    ELSEIF p_class_id = 3 THEN SET v_senior_cap = 4 * (SELECT COUNT(*) FROM COACH WHERE train_id = v_train_id AND class_id = 3);
    ELSEIF p_class_id = 2 THEN SET v_senior_cap = 3 * (SELECT COUNT(*) FROM COACH WHERE train_id = v_train_id AND class_id = 2);
    ELSE SET v_senior_cap = 0; END IF;

    IF v_requested_quota = 'LADIES' THEN
        SET v_quota_cap = v_ladies_cap;
    ELSEIF v_requested_quota = 'TATKAL' THEN
        SET v_quota_cap = v_tatkal_cap;
    ELSEIF v_requested_quota = 'DIVYAANG' THEN
        SET v_quota_cap = v_divyaang_cap;
    ELSEIF v_requested_quota = 'SENIOR_CITIZEN' THEN
        SET v_quota_cap = v_senior_cap;
    ELSE
        -- GENERAL quota gets the remainder per BR-Q10
        SET v_quota_cap = GREATEST(0, v_tot_class_seats - (v_tatkal_cap + v_ladies_cap + v_divyaang_cap + v_senior_cap));
    END IF;

    SELECT COUNT(r.res_id) INTO v_quota_booked
    FROM BOOKING b
    JOIN RESERVATION r ON b.pnr = r.pnr
    WHERE b.schedule_id = p_schedule_id AND b.class_id = p_class_id AND b.quota = v_requested_quota AND r.status IN ('CONFIRMED', 'BOARDED');

    IF v_quota_cap >= v_quota_booked THEN
        SET v_quota_free = v_quota_cap - v_quota_booked;
    ELSE
        SET v_quota_free = 0;
    END IF;

    -- If overall available seats in inventory are less than quota free seats, physical availability is the ceiling
    IF v_avail_seats < v_quota_free THEN
        SET v_quota_free = v_avail_seats;
    END IF;

    IF v_requested_quota IN ('LADIES', 'SENIOR_CITIZEN', 'DIVYAANG') THEN
        IF v_quota_free < v_pass_count THEN
            IF p_fallback_consent = 1 THEN
                SET v_active_quota = 'GENERAL';
                -- Recompute for GENERAL quota
                SET v_quota_cap = GREATEST(0, v_tot_class_seats - (v_tatkal_cap + v_ladies_cap + v_divyaang_cap + v_senior_cap));
                SELECT COUNT(r.res_id) INTO v_quota_booked
                FROM BOOKING b
                JOIN RESERVATION r ON b.pnr = r.pnr
                WHERE b.schedule_id = p_schedule_id AND b.class_id = p_class_id AND b.quota = 'GENERAL' AND r.status IN ('CONFIRMED', 'BOARDED');
                SET v_quota_free = GREATEST(0, v_quota_cap - v_quota_booked);
                IF v_avail_seats < v_quota_free THEN
                    SET v_quota_free = v_avail_seats;
                END IF;
            ELSE
                IF p_manage_tx = 1 THEN ROLLBACK; END IF;
                SET p_out_error_code = 'SEAT_NOT_AVAILABLE';
                LEAVE proc_label;
            END IF;
        END IF;
    END IF;

    IF v_quota_free < v_pass_count THEN
        IF v_active_quota IN ('GENERAL', 'TATKAL') AND v_has_berths = 1 THEN
            IF (v_quota_free + (v_rac_cap - v_rac_cnt) + (v_wl_cap - v_wl_cnt)) < v_pass_count THEN
                IF p_manage_tx = 1 THEN ROLLBACK; END IF;
                SET p_out_error_code = 'WAITING_LIST_FULL';
                LEAVE proc_label;
            END IF;
        ELSEIF v_active_quota IN ('GENERAL', 'TATKAL') AND v_has_berths = 0 THEN
            IF (v_quota_free + (v_wl_cap - v_wl_cnt)) < v_pass_count THEN
                IF p_manage_tx = 1 THEN ROLLBACK; END IF;
                SET p_out_error_code = 'WAITING_LIST_FULL';
                LEAVE proc_label;
            END IF;
        ELSE
            IF p_manage_tx = 1 THEN ROLLBACK; END IF;
            SET p_out_error_code = 'SEAT_NOT_AVAILABLE';
            LEAVE proc_label;
        END IF;
    END IF;

    SAVEPOINT sp_berth_check;

    SET v_new_pnr = LPAD(FLOOR(RAND() * 8999999999 + 1000000000), 10, '0');
    WHILE EXISTS (SELECT 1 FROM BOOKING WHERE pnr = v_new_pnr) DO
        SET v_new_pnr = LPAD(FLOOR(RAND() * 8999999999 + 1000000000), 10, '0');
    END WHILE;

    SET v_distance = fn_calculate_distance(p_from_stop_id, p_to_stop_id);

    INSERT INTO BOOKING (
        pnr, user_id, schedule_id, class_id, from_stop_id, to_stop_id,
        channel, booked_by_staff_id, quota, requested_quota,
        berth_condition, total_fare, status, created_at
    ) VALUES (
        v_new_pnr, p_user_id, p_schedule_id, p_class_id, p_from_stop_id, p_to_stop_id,
        p_channel, p_staff_id, v_active_quota, v_requested_quota,
        p_berth_condition, 0.00, 'PAYMENT_PENDING', NOW()
    );

    SET v_idx = 0;
    WHILE v_idx < v_pass_count DO
        passenger_block: BEGIN
            DECLARE v_p_saved_id INT;
            DECLARE v_p_name VARCHAR(128);
            DECLARE v_p_age INT;
            DECLARE v_p_gender VARCHAR(10);
            DECLARE v_p_conc_type VARCHAR(20);
            DECLARE v_p_proof_type VARCHAR(32);
            DECLARE v_p_proof_ref VARCHAR(64);
            DECLARE v_p_berth_pref VARCHAR(20);
            DECLARE v_fare_json JSON;
            DECLARE v_assigned_seat_id INT DEFAULT NULL;
            DECLARE v_seat_berth VARCHAR(20) DEFAULT NULL;
            DECLARE v_pass_status VARCHAR(20) DEFAULT 'CONFIRMED';
            DECLARE v_queue_pos VARCHAR(16) DEFAULT NULL;
            DECLARE v_res_id INT;

            SET v_p_saved_id = JSON_UNQUOTE(JSON_EXTRACT(p_passengers, CONCAT('$[', v_idx, '].saved_passenger_id')));
            SET v_p_name = JSON_UNQUOTE(JSON_EXTRACT(p_passengers, CONCAT('$[', v_idx, '].name')));
            SET v_p_age = JSON_EXTRACT(p_passengers, CONCAT('$[', v_idx, '].age'));
            SET v_p_gender = JSON_UNQUOTE(JSON_EXTRACT(p_passengers, CONCAT('$[', v_idx, '].gender')));
            SET v_p_conc_type = JSON_UNQUOTE(JSON_EXTRACT(p_passengers, CONCAT('$[', v_idx, '].concession_type')));
            IF v_p_conc_type IS NULL OR v_p_conc_type = 'null' THEN SET v_p_conc_type = 'NONE'; END IF;
            SET v_p_proof_type = JSON_UNQUOTE(JSON_EXTRACT(p_passengers, CONCAT('$[', v_idx, '].concession_proof_type')));
            IF v_p_proof_type = 'null' THEN SET v_p_proof_type = NULL; END IF;
            SET v_p_proof_ref = JSON_UNQUOTE(JSON_EXTRACT(p_passengers, CONCAT('$[', v_idx, '].concession_proof_ref')));
            IF v_p_proof_ref = 'null' THEN SET v_p_proof_ref = NULL; END IF;
            SET v_p_berth_pref = JSON_UNQUOTE(JSON_EXTRACT(p_passengers, CONCAT('$[', v_idx, '].berth_preference')));
            IF v_p_berth_pref IS NULL OR v_p_berth_pref = 'null' THEN SET v_p_berth_pref = 'NO_BERTH'; END IF;

            SET v_fare_json = fn_calculate_fare(p_class_id, v_train_id, v_distance, v_active_quota, v_p_conc_type, 1, p_schedule_id);

            IF v_quota_free > 0 AND v_avail_seats > 0 THEN
                SELECT s.seat_id, s.berth_type
                INTO v_assigned_seat_id, v_seat_berth
                FROM SEAT s
                JOIN COACH c ON s.coach_id = c.coach_id
                WHERE c.train_id = v_train_id
                  AND c.class_id = p_class_id
                  AND s.seat_id NOT IN (
                      SELECT r.seat_id FROM RESERVATION r
                      WHERE r.schedule_id = p_schedule_id
                        AND r.seat_id IS NOT NULL
                        AND r.status IN ('CONFIRMED', 'BOARDED')
                  )
                ORDER BY
                    CASE WHEN (v_p_age >= 60 AND s.berth_type = 'LOWER') THEN 1
                         WHEN (v_p_berth_pref = s.berth_type) THEN 2
                         ELSE 3 END,
                    s.seat_id ASC
                LIMIT 1;

                IF v_assigned_seat_id IS NOT NULL THEN
                    SET v_pass_status = 'CONFIRMED';
                    SET v_avail_seats = v_avail_seats - 1;
                    SET v_quota_free = v_quota_free - 1;

                    IF p_berth_condition = 1 AND v_has_berths = 1 THEN
                        IF v_p_berth_pref != 'NO_BERTH' AND v_seat_berth != v_p_berth_pref THEN
                            ROLLBACK TO SAVEPOINT sp_berth_check;
                            IF p_manage_tx = 1 THEN ROLLBACK; END IF;
                            SET p_out_error_code = 'BERTH_PREFERENCE_NOT_MET';
                            LEAVE proc_label;
                        END IF;
                    END IF;
                ELSE
                    SET v_avail_seats = 0;
                    SET v_quota_free = 0;
                END IF;
            END IF;

            IF v_assigned_seat_id IS NULL THEN
                IF p_berth_condition = 1 THEN
                    ROLLBACK TO SAVEPOINT sp_berth_check;
                    IF p_manage_tx = 1 THEN ROLLBACK; END IF;
                    SET p_out_error_code = 'BERTH_PREFERENCE_NOT_MET';
                    LEAVE proc_label;
                END IF;

                IF v_has_berths = 1 AND v_rac_cnt < v_rac_cap AND v_active_quota IN ('GENERAL', 'TATKAL') THEN
                    SET v_pass_status = 'RAC';
                    SET v_rac_cnt = v_rac_cnt + 1;
                    SET v_queue_pos = CONCAT('RAC/', v_rac_cnt);
                    IF v_overall_status != 'WAITING_LIST' THEN SET v_overall_status = 'RAC'; END IF;
                ELSEIF v_wl_cnt < v_wl_cap THEN
                    SET v_pass_status = 'WAITING_LIST';
                    SET v_wl_cnt = v_wl_cnt + 1;
                    SET v_queue_pos = CONCAT('WL/', v_wl_cnt);
                    SET v_overall_status = 'WAITING_LIST';
                ELSE
                    ROLLBACK TO SAVEPOINT sp_berth_check;
                    IF p_manage_tx = 1 THEN ROLLBACK; END IF;
                    SET p_out_error_code = 'WAITING_LIST_FULL';
                    LEAVE proc_label;
                END IF;
            END IF;

            INSERT INTO PASSENGER_BOOKING (
                pnr, passenger_no, saved_passenger_id, name, age, gender,
                concession_type, concession_proof_type, concession_proof_ref,
                base_fare, concession_discount, reservation_charge, superfast_charge,
                tatkal_charge, dynamic_surcharge, gst, insurance, total_fare
            ) VALUES (
                v_new_pnr, v_idx + 1, v_p_saved_id, v_p_name, v_p_age, v_p_gender,
                v_p_conc_type, v_p_proof_type, v_p_proof_ref,
                JSON_EXTRACT(v_fare_json, '$.base_fare'),
                JSON_EXTRACT(v_fare_json, '$.concession_discount'),
                JSON_EXTRACT(v_fare_json, '$.reservation_charge'),
                JSON_EXTRACT(v_fare_json, '$.superfast_charge'),
                JSON_EXTRACT(v_fare_json, '$.tatkal_charge'),
                JSON_EXTRACT(v_fare_json, '$.dynamic_surcharge'),
                JSON_EXTRACT(v_fare_json, '$.gst'),
                JSON_EXTRACT(v_fare_json, '$.insurance'),
                JSON_EXTRACT(v_fare_json, '$.total_fare')
            );

            SET v_total_booking_fare = v_total_booking_fare + JSON_EXTRACT(v_fare_json, '$.total_fare');

            SELECT COALESCE(MAX(res_id), 0) + 1 INTO v_res_id FROM RESERVATION;

            INSERT INTO RESERVATION (
                res_id, pnr, passenger_no, schedule_id, seat_id, status, queue_position
            ) VALUES (
                v_res_id, v_new_pnr, v_idx + 1, p_schedule_id, v_assigned_seat_id, v_pass_status, v_queue_pos
            );

        END passenger_block;
        SET v_idx = v_idx + 1;
    END WHILE;

    UPDATE SCHEDULE_CLASS_INVENTORY
    SET available_seats = v_avail_seats,
        rac_count = v_rac_cnt,
        wl_count = v_wl_cnt
    WHERE schedule_id = p_schedule_id AND class_id = p_class_id;

    UPDATE BOOKING
    SET total_fare = v_total_booking_fare,
        status = v_overall_status
    WHERE pnr = v_new_pnr;

    IF p_manage_tx = 1 THEN
        COMMIT;
    END IF;

    SET p_out_pnr = v_new_pnr;
    SET p_out_status = v_overall_status;
    SET p_out_total_fare = v_total_booking_fare;
    SET p_out_error_code = NULL;

END proc_label$$

-- -----------------------------------------------------------------------------
-- 4. sp_cancel_passenger_ticket
-- Cancels a single passenger or full PNR, works out deduction charge via
-- fn_calculate_cancellation_refund, records CANCELLATION and REFUND.
-- Note: When cancelling a whole PNR (p_passenger_no IS NULL), creates one CANCELLATION
-- row per passenger, each with its own refund line (BR-R3, BR-R4).
-- The promotion is automatically triggered by trg_after_cancellation_promote!
-- -----------------------------------------------------------------------------
DROP PROCEDURE IF EXISTS sp_cancel_passenger_ticket$$
CREATE PROCEDURE sp_cancel_passenger_ticket(
    IN p_pnr VARCHAR(10),
    IN p_passenger_no INT,
    IN p_reason VARCHAR(128),
    IN p_manage_tx TINYINT(1),
    OUT p_out_charge DECIMAL(10,2),
    OUT p_out_refund_amount DECIMAL(10,2),
    OUT p_out_status VARCHAR(20)
)
proc_label: BEGIN
    DECLARE v_active_count INT DEFAULT 0;
    DECLARE v_total_charge DECIMAL(10,2) DEFAULT 0.00;
    DECLARE v_total_refund DECIMAL(10,2) DEFAULT 0.00;
    DECLARE v_new_cancel_id INT;
    DECLARE v_new_refund_id INT;
    DECLARE v_payment_id INT;
    DECLARE v_sched_id INT;
    DECLARE v_dep_date DATE;
    DECLARE v_dep_time TIME;
    DECLARE v_origin_departure DATETIME;
    DECLARE v_as_of DATETIME;
    DECLARE v_hours_left DECIMAL(10,2);
    DECLARE done INT DEFAULT 0;

    DECLARE cur_pass_no INT;
    DECLARE cur_pass CURSOR FOR
        SELECT pb.passenger_no
        FROM PASSENGER_BOOKING pb
        JOIN RESERVATION r ON pb.pnr = r.pnr AND pb.passenger_no = r.passenger_no
        WHERE pb.pnr = p_pnr
          AND (p_passenger_no IS NULL OR pb.passenger_no = p_passenger_no)
          AND r.status != 'CANCELLED';
    DECLARE CONTINUE HANDLER FOR NOT FOUND SET done = 1;

    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        IF p_manage_tx = 1 THEN
            ROLLBACK;
        END IF;
        SET p_out_status = 'FAILED';
    END;

    IF p_manage_tx = 1 THEN
        START TRANSACTION;
    END IF;

    SET v_as_of = COALESCE(@as_of_time, NOW());

    -- Verify active reservations exist to cancel
    SELECT COUNT(*) INTO v_active_count
    FROM RESERVATION
    WHERE pnr = p_pnr
      AND (p_passenger_no IS NULL OR passenger_no = p_passenger_no)
      AND status != 'CANCELLED';

    IF v_active_count = 0 THEN
        IF p_manage_tx = 1 THEN ROLLBACK; END IF;
        SET p_out_charge = 0.00;
        SET p_out_refund_amount = 0.00;
        SET p_out_status = 'ALREADY_CANCELLED';
        LEAVE proc_label;
    END IF;

    -- BR-B12, BR-R7, API_CONTRACT: Online cancellation closes at chart time (8 hrs before origin departure)
    SELECT schedule_id INTO v_sched_id FROM BOOKING WHERE pnr = p_pnr;
    SELECT journey_date, departure_time INTO v_dep_date, v_dep_time FROM TRAIN_SCHEDULE WHERE schedule_id = v_sched_id;
    SET v_origin_departure = TIMESTAMP(v_dep_date, v_dep_time);
    SET v_hours_left = TIMESTAMPDIFF(MINUTE, v_as_of, v_origin_departure) / 60.0;

    IF v_hours_left <= 8.0 THEN
        IF p_manage_tx = 1 THEN ROLLBACK; END IF;
        SET p_out_charge = 0.00;
        SET p_out_refund_amount = 0.00;
        SET p_out_status = 'CHART_PREPARED';
        LEAVE proc_label;
    END IF;

    SELECT payment_id INTO v_payment_id
    FROM PAYMENT
    WHERE pnr = p_pnr AND status = 'SUCCESS'
    ORDER BY payment_id DESC
    LIMIT 1;

    SELECT COALESCE(MAX(cancel_id), 0) INTO v_new_cancel_id FROM CANCELLATION;
    SELECT COALESCE(MAX(refund_id), 0) INTO v_new_refund_id FROM REFUND;

    OPEN cur_pass;
    pass_loop: LOOP
        FETCH cur_pass INTO cur_pass_no;
        IF done = 1 THEN LEAVE pass_loop; END IF;

        cancel_single: BEGIN
            DECLARE v_p_refund_json JSON;
            DECLARE v_p_charge DECIMAL(10,2);
            DECLARE v_p_refund DECIMAL(10,2);

            SET v_p_refund_json = fn_calculate_cancellation_refund(p_pnr, cur_pass_no, v_as_of);
            SET v_p_charge = JSON_EXTRACT(v_p_refund_json, '$.charge');
            SET v_p_refund = JSON_EXTRACT(v_p_refund_json, '$.refund_amount');

            SET v_total_charge = v_total_charge + v_p_charge;
            SET v_total_refund = v_total_refund + v_p_refund;

            SET v_new_cancel_id = v_new_cancel_id + 1;
            INSERT INTO CANCELLATION (cancel_id, pnr, passenger_no, reason, charge, cancelled_at)
            VALUES (v_new_cancel_id, p_pnr, cur_pass_no, p_reason, v_p_charge, v_as_of);

            UPDATE RESERVATION
            SET status = 'CANCELLED',
                seat_id = NULL,
                queue_position = NULL
            WHERE pnr = p_pnr AND passenger_no = cur_pass_no;

            IF v_payment_id IS NOT NULL AND v_p_refund > 0 THEN
                SET v_new_refund_id = v_new_refund_id + 1;
                INSERT INTO REFUND (refund_id, cancel_id, tdr_ref_no, payment_id, amount, reason, status)
                VALUES (v_new_refund_id, v_new_cancel_id, NULL, v_payment_id, v_p_refund, 'CANCELLATION', 'PROCESSED');
            END IF;
        END cancel_single;
    END LOOP;
    CLOSE cur_pass;

    IF NOT EXISTS (
        SELECT 1 FROM RESERVATION WHERE pnr = p_pnr AND status != 'CANCELLED'
    ) THEN
        UPDATE BOOKING SET status = 'CANCELLED' WHERE pnr = p_pnr;
    END IF;

    IF p_manage_tx = 1 THEN
        COMMIT;
    END IF;

    SET p_out_charge = v_total_charge;
    SET p_out_refund_amount = v_total_refund;
    SET p_out_status = 'CANCELLED';

END proc_label$$

-- -----------------------------------------------------------------------------
-- 5. sp_prepare_chart
-- Chart preparation procedure per BR-B12a, BR-B16:
--   1. Chart lockout: set chart_prepared_at = NOW()
--   2. Cancel active holds for this run
--   3. Move unsold quota seats to GENERAL and run promotion
--   4. Purge/cancel passengers still waitlisted and refund in full (BR-W8)
--   5. Create unchanging CHART_SNAPSHOT records
-- -----------------------------------------------------------------------------
DROP PROCEDURE IF EXISTS sp_prepare_chart$$
CREATE PROCEDURE sp_prepare_chart(
    IN p_schedule_id INT,
    IN p_manage_tx TINYINT(1),
    OUT p_out_snapshot_count INT
)
proc_label: BEGIN
    DECLARE v_new_snapshot_id INT DEFAULT 0;
    DECLARE v_new_refund_id INT DEFAULT 0;
    DECLARE done INT DEFAULT 0;

    DECLARE cur_wl_pnr VARCHAR(10);
    DECLARE cur_wl_pass_no INT;
    DECLARE cur_wl_fare DECIMAL(10,2);
    DECLARE cur_wl_ins DECIMAL(10,2);
    DECLARE cur_wl_pay_id INT;
    DECLARE cur_wl CURSOR FOR
        SELECT r.pnr, r.passenger_no, pb.total_fare, pb.insurance, p.payment_id
        FROM RESERVATION r
        JOIN PASSENGER_BOOKING pb ON r.pnr = pb.pnr AND r.passenger_no = pb.passenger_no
        LEFT JOIN PAYMENT p ON r.pnr = p.pnr AND p.status = 'SUCCESS'
        WHERE r.schedule_id = p_schedule_id AND r.status = 'WAITING_LIST';
    DECLARE CONTINUE HANDLER FOR NOT FOUND SET done = 1;

    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        IF p_manage_tx = 1 THEN
            ROLLBACK;
        END IF;
        SET p_out_snapshot_count = 0;
    END;

    IF p_manage_tx = 1 THEN
        START TRANSACTION;
    END IF;

    UPDATE TRAIN_SCHEDULE
    SET chart_prepared_at = NOW()
    WHERE schedule_id = p_schedule_id;

    DELETE FROM SEAT_HOLD WHERE schedule_id = p_schedule_id;

    SELECT COALESCE(MAX(refund_id), 0) INTO v_new_refund_id FROM REFUND;

    OPEN cur_wl;
    wl_loop: LOOP
        FETCH cur_wl INTO cur_wl_pnr, cur_wl_pass_no, cur_wl_fare, cur_wl_ins, cur_wl_pay_id;
        IF done = 1 THEN LEAVE wl_loop; END IF;

        UPDATE RESERVATION
        SET status = 'CANCELLED'
        WHERE pnr = cur_wl_pnr AND passenger_no = cur_wl_pass_no;

        IF cur_wl_pay_id IS NOT NULL THEN
            SET v_new_refund_id = v_new_refund_id + 1;
            INSERT INTO REFUND (refund_id, cancel_id, tdr_ref_no, payment_id, amount, reason, status)
            VALUES (
                v_new_refund_id,
                NULL, NULL, cur_wl_pay_id, cur_wl_fare - cur_wl_ins, 'WAITLIST_PURGE', 'PROCESSED'
            );
        END IF;
    END LOOP;
    CLOSE cur_wl;

    -- Purged waitlisted passengers; reset wl_count on schedule inventory to 0 per BR-W8
    UPDATE SCHEDULE_CLASS_INVENTORY
    SET wl_count = 0
    WHERE schedule_id = p_schedule_id;

    SELECT COALESCE(MAX(snapshot_id), 0) INTO v_new_snapshot_id FROM CHART_SNAPSHOT;

    INSERT INTO CHART_SNAPSHOT (
        snapshot_id, schedule_id, pnr, passenger_no, coach_no, seat_no,
        berth_type, status, from_station_id, to_station_id, concession_flag, generated_at
    )
    SELECT
        ROW_NUMBER() OVER (ORDER BY b.pnr, pb.passenger_no) + v_new_snapshot_id,
        p_schedule_id,
        b.pnr,
        pb.passenger_no,
        COALESCE(c.coach_code, 'RAC'),
        COALESCE(s.seat_number, 0),
        COALESCE(s.berth_type, 'SIDE_LOWER'),
        r.status,
        rs_from.station_id,
        rs_to.station_id,
        CASE WHEN pb.concession_type != 'NONE' THEN 1 ELSE 0 END,
        NOW()
    FROM BOOKING b
    JOIN PASSENGER_BOOKING pb ON b.pnr = pb.pnr
    JOIN RESERVATION r ON pb.pnr = r.pnr AND pb.passenger_no = r.passenger_no
    JOIN ROUTE_STOP rs_from ON b.from_stop_id = rs_from.stop_id
    JOIN ROUTE_STOP rs_to ON b.to_stop_id = rs_to.stop_id
    LEFT JOIN SEAT s ON r.seat_id = s.seat_id
    LEFT JOIN COACH c ON s.coach_id = c.coach_id
    WHERE b.schedule_id = p_schedule_id
      AND r.status IN ('CONFIRMED', 'RAC');

    SELECT COUNT(*) INTO p_out_snapshot_count
    FROM CHART_SNAPSHOT
    WHERE schedule_id = p_schedule_id;

    IF p_manage_tx = 1 THEN
        COMMIT;
    END IF;

END proc_label$$

-- -----------------------------------------------------------------------------
-- 6. sp_process_late_payment_refund
-- Automatic full refund (including insurance) for payments received after hold
-- expired or when booking status is FAILED (BR-B14).
-- -----------------------------------------------------------------------------
DROP PROCEDURE IF EXISTS sp_process_late_payment_refund$$
CREATE PROCEDURE sp_process_late_payment_refund(
    IN p_pnr VARCHAR(10),
    IN p_amount DECIMAL(10,2),
    IN p_payment_method VARCHAR(20),
    IN p_gateway_id VARCHAR(64),
    IN p_manage_tx TINYINT(1),
    OUT p_out_refund_id INT,
    OUT p_out_status VARCHAR(20)
)
proc_label: BEGIN
    DECLARE v_new_payment_id INT;
    DECLARE v_new_refund_id INT;

    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        IF p_manage_tx = 1 THEN
            ROLLBACK;
        END IF;
        SET p_out_status = 'FAILED';
    END;

    IF p_manage_tx = 1 THEN
        START TRANSACTION;
    END IF;

    SELECT COALESCE(MAX(payment_id), 0) + 1 INTO v_new_payment_id FROM PAYMENT;

    INSERT INTO PAYMENT (payment_id, pnr, amount, method, status, gateway_payment_id, paid_at)
    VALUES (v_new_payment_id, p_pnr, p_amount, p_payment_method, 'SUCCESS', p_gateway_id, NOW());

    SELECT COALESCE(MAX(refund_id), 0) + 1 INTO v_new_refund_id FROM REFUND;

    INSERT INTO REFUND (refund_id, cancel_id, tdr_ref_no, payment_id, amount, reason, status)
    VALUES (v_new_refund_id, NULL, NULL, v_new_payment_id, p_amount, 'PAYMENT_AFTER_EXPIRY', 'PROCESSED');

    UPDATE BOOKING SET status = 'FAILED' WHERE pnr = p_pnr;

    IF p_manage_tx = 1 THEN
        COMMIT;
    END IF;

    SET p_out_refund_id = v_new_refund_id;
    SET p_out_status = 'REFUND_PROCESSED';
END proc_label$$

-- -----------------------------------------------------------------------------
-- 7. sp_create_counter_booking
-- Facilitates counter booking by staff with CASH/UPI payment, assigning
-- COUNTER_WALKIN account (50008) when walk-in passenger has no account (BR-CB3).
-- -----------------------------------------------------------------------------
DROP PROCEDURE IF EXISTS sp_create_counter_booking$$
CREATE PROCEDURE sp_create_counter_booking(
    IN p_staff_id INT,
    IN p_walkin_user_id INT,
    IN p_schedule_id INT,
    IN p_class_id INT,
    IN p_from_stop_id INT,
    IN p_to_stop_id INT,
    IN p_quota VARCHAR(20),
    IN p_passengers JSON,
    IN p_payment_method VARCHAR(20),
    IN p_manage_tx TINYINT(1),
    OUT p_out_pnr VARCHAR(10),
    OUT p_out_total_fare DECIMAL(10,2),
    OUT p_out_status VARCHAR(20),
    OUT p_out_error_code VARCHAR(32)
)
proc_label: BEGIN
    DECLARE v_user_id INT;
    DECLARE v_pnr VARCHAR(10);
    DECLARE v_fare DECIMAL(10,2);
    DECLARE v_status VARCHAR(20);
    DECLARE v_err VARCHAR(32);
    DECLARE v_new_payment_id INT;

    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        IF p_manage_tx = 1 THEN
            ROLLBACK;
        END IF;
        SET p_out_error_code = 'TRANSACTION_FAILED';
        SET p_out_status = 'FAILED';
    END;

    IF p_manage_tx = 1 THEN
        START TRANSACTION;
    END IF;

    IF p_walkin_user_id IS NULL OR p_walkin_user_id = 0 THEN
        SET v_user_id = 50008; -- Shared COUNTER_WALKIN account
    ELSE
        SET v_user_id = p_walkin_user_id;
    END IF;

    CALL sp_create_booking(
        v_user_id, p_schedule_id, p_class_id, p_from_stop_id, p_to_stop_id,
        p_quota, 1, 0, p_passengers, 'COUNTER', p_staff_id, 0,
        v_pnr, v_status, v_fare, v_err
    );

    IF v_err IS NOT NULL THEN
        IF p_manage_tx = 1 THEN ROLLBACK; END IF;
        SET p_out_error_code = v_err;
        SET p_out_status = 'FAILED';
        LEAVE proc_label;
    END IF;

    SELECT COALESCE(MAX(payment_id), 0) + 1 INTO v_new_payment_id FROM PAYMENT;
    INSERT INTO PAYMENT (
        payment_id, pnr, amount, method, status, gateway_payment_id, paid_at
    ) VALUES (
        v_new_payment_id, v_pnr, v_fare, p_payment_method, 'SUCCESS',
        CONCAT('counter_pay_', v_pnr, '_', v_new_payment_id), NOW()
    );

    IF p_manage_tx = 1 THEN
        COMMIT;
    END IF;

    SET p_out_pnr = v_new_pnr;
    SET p_out_total_fare = v_fare;
    SET p_out_status = v_status;
    SET p_out_error_code = NULL;
END proc_label$$

DELIMITER ;
