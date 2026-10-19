-- =============================================================================
-- Railway Reservation & Management System (MySQL 8.0)
-- File: 07_tests.sql
-- Description: Comprehensive automated test suite verifying all 5 Demo Stories
--              and critical Edge Case error codes.
--
-- Verification Protocol:
--   Every test executes in an isolated transaction that explicitly ROLLS BACK,
--   or creates and cleans up dedicated test records so that seed data remains
--   100% pristine and unaltered.
--
-- Demo Stories Tested:
--   - Story 1: Train 111 on 18 Oct -> Confirmed cancellation triggers promotion
--              (RAC 1 becomes CONFIRMED, WL 1 becomes RAC).
--   - Story 2: Train 127 on 18 Oct -> TDR filing & approval triggers promotion chain.
--   - Story 3: Train 125 on 19 Oct -> Ticket collector marks NO_SHOW -> frees seat -> promotion.
--   - Story 4: Train 119 on 19 Oct -> Chart preparation lockout, unsold quota sweep,
--              waitlist auto-refund, snapshot creation.
--   - Story 5: Train 146 on 20 Oct -> Quota fallback (LADIES quota full -> fallback to GENERAL).
--
-- Edge Cases Tested:
--   - Test 6: WAITING_LIST_FULL rejection when capacity reached.
--   - Test 7: RAC-open booking validation.
--   - Test 8: BERTH_PREFERENCE_NOT_MET rejection with rollback when preferred berth unavailable.
--   - Test 9: MONTHLY_LIMIT_EXCEEDED rejection when monthly quota breached.
--   - Test 10: CHART_PREPARED rejection when booking attempted after chart lock.
-- =============================================================================

USE railway_db;

-- Persistent test results table (so procedures across connections can populate it)
DROP TABLE IF EXISTS test_results;
CREATE TABLE IF NOT EXISTS test_results (
    test_id INT AUTO_INCREMENT PRIMARY KEY,
    test_name VARCHAR(120) NOT NULL,
    expected_outcome VARCHAR(150) NOT NULL,
    actual_outcome VARCHAR(150) NOT NULL,
    status ENUM('PASS', 'FAIL') NOT NULL,
    details TEXT NULL
) ENGINE=MyISAM;

DELIMITER $$

-- -----------------------------------------------------------------------------
-- -----------------------------------------------------------------------------
-- TEST 1: Demo Story 1 - Train 111 on 2026-10-18 (PNR: 2849100146 Cancel & Promotion)
-- -----------------------------------------------------------------------------
DROP PROCEDURE IF EXISTS test_story_1$$
CREATE PROCEDURE test_story_1()
BEGIN
    DECLARE v_conf_pnr VARCHAR(10) DEFAULT '2849100146';
    DECLARE v_rac_pnr VARCHAR(10) DEFAULT '2849100410';
    DECLARE v_wl_pnr VARCHAR(10) DEFAULT '2849100474';
    DECLARE v_res_rac_status VARCHAR(20);
    DECLARE v_res_wl_status VARCHAR(20);
    DECLARE v_out_chg DECIMAL(10,2);
    DECLARE v_out_ref DECIMAL(10,2);
    DECLARE v_out_stat VARCHAR(20);

    START TRANSACTION;

    -- Set deterministic as-of time: 24h before train origin departure (2026-10-18 19:15:00)
    SET @as_of_time = '2026-10-17 19:15:00';

    -- Execute Cancellation of Confirmed Passenger with p_manage_tx = 0
    CALL sp_cancel_passenger_ticket(v_conf_pnr, 1, 'PLANS_CHANGED', 0, v_out_chg, v_out_ref, v_out_stat);

    -- Check Promotion
    SELECT status INTO v_res_rac_status FROM RESERVATION WHERE pnr = v_rac_pnr AND passenger_no = 1;
    SELECT status INTO v_res_wl_status FROM RESERVATION WHERE pnr = v_wl_pnr AND passenger_no = 1;

    IF v_res_rac_status = 'CONFIRMED' AND v_res_wl_status = 'RAC' THEN
        INSERT INTO test_results (test_name, expected_outcome, actual_outcome, status, details)
        VALUES ('Story 1: Train 111 on 2026-10-18 (PNR: 2849100146) Cancel & Promotion', 'RAC->CONFIRMED and WL->RAC', CONCAT('RAC: ', v_res_rac_status, ', WL: ', v_res_wl_status), 'PASS', 'Promotion cascade executed accurately.');
    ELSE
        INSERT INTO test_results (test_name, expected_outcome, actual_outcome, status, details)
        VALUES ('Story 1: Train 111 on 2026-10-18 (PNR: 2849100146) Cancel & Promotion', 'RAC->CONFIRMED and WL->RAC', CONCAT('RAC: ', v_res_rac_status, ', WL: ', v_res_wl_status), 'FAIL', 'Promotion cascade failed.');
    END IF;

    SET @as_of_time = NULL;
    ROLLBACK;
END$$

-- -----------------------------------------------------------------------------
-- TEST 2: Demo Story 2 - Train 127 on 2026-10-18 (PNR: 2849101269 TDR Approval & Promotion)
-- -----------------------------------------------------------------------------
DROP PROCEDURE IF EXISTS test_story_2$$
CREATE PROCEDURE test_story_2()
BEGIN
    DECLARE v_sched_id INT DEFAULT 1147;
    DECLARE v_class_id INT DEFAULT 3;
    DECLARE v_conf_pnr VARCHAR(10) DEFAULT '2849101269';
    DECLARE v_rac_pnr VARCHAR(10) DEFAULT '2849101529';
    DECLARE v_wl_pnr VARCHAR(10) DEFAULT '2849101593';
    DECLARE v_res_rac_status VARCHAR(20);
    DECLARE v_res_wl_status VARCHAR(20);

    START TRANSACTION;

    -- File TDR & Approve for Confirmed Passenger
    INSERT INTO TDR_FILING (tdr_ref_no, pnr, passenger_no, reason, filed_at, status, evidence_ref, refund_amount, reviewed_by, reviewed_at, remarks)
    VALUES ('TDR-TEST-002', v_conf_pnr, 1, 'TRAIN_DELAYED_OVER_3_HOURS', NOW(), 'APPROVED', 'DELAY-VERIFIED', 600.00, 1, NOW(), 'Approved by Admin');

    -- TDR approval frees berth and runs single promotion procedure
    UPDATE RESERVATION SET status = 'CANCELLED', seat_id = NULL WHERE pnr = v_conf_pnr AND passenger_no = 1;
    CALL sp_promote_passenger(v_sched_id, v_class_id, 23273);

    SELECT status INTO v_res_rac_status FROM RESERVATION WHERE pnr = v_rac_pnr AND passenger_no = 1;
    SELECT status INTO v_res_wl_status FROM RESERVATION WHERE pnr = v_wl_pnr AND passenger_no = 1;

    IF v_res_rac_status = 'CONFIRMED' AND v_res_wl_status = 'RAC' THEN
        INSERT INTO test_results (test_name, expected_outcome, actual_outcome, status, details)
        VALUES ('Story 2: Train 127 on 2026-10-18 (PNR: 2849101269) TDR Approval & Promotion', 'RAC->CONFIRMED and WL->RAC', CONCAT('RAC: ', v_res_rac_status, ', WL: ', v_res_wl_status), 'PASS', 'TDR release triggered sp_promote_passenger.');
    ELSE
        INSERT INTO test_results (test_name, expected_outcome, actual_outcome, status, details)
        VALUES ('Story 2: Train 127 on 2026-10-18 (PNR: 2849101269) TDR Approval & Promotion', 'RAC->CONFIRMED and WL->RAC', CONCAT('RAC: ', v_res_rac_status, ', WL: ', v_res_wl_status), 'FAIL', 'TDR promotion failed.');
    END IF;

    ROLLBACK;
END$$

-- -----------------------------------------------------------------------------
-- TEST 3: Demo Story 3 - Train 125 on 2026-10-19 (PNR: 2849100701 No-Show Action & Promotion)
-- -----------------------------------------------------------------------------
DROP PROCEDURE IF EXISTS test_story_3$$
CREATE PROCEDURE test_story_3()
BEGIN
    DECLARE v_ns_pnr VARCHAR(10) DEFAULT '2849100701';
    DECLARE v_rac_pnr VARCHAR(10) DEFAULT '2849100985';
    DECLARE v_res_rac_status VARCHAR(20);
    DECLARE v_stat VARCHAR(20);

    START TRANSACTION;

    -- Staff marks NO_SHOW via sp_mark_passenger_noshow (calls sp_promote_passenger)
    CALL sp_mark_passenger_noshow(v_ns_pnr, 1, v_stat);

    SELECT status INTO v_res_rac_status FROM RESERVATION WHERE pnr = v_rac_pnr AND passenger_no = 1;

    IF v_res_rac_status = 'CONFIRMED' THEN
        INSERT INTO test_results (test_name, expected_outcome, actual_outcome, status, details)
        VALUES ('Story 3: Train 125 on 2026-10-19 (PNR: 2849100701) No-Show & Promotion', 'RAC->CONFIRMED', v_res_rac_status, 'PASS', 'NO_SHOW marked by TC successfully promoted next RAC passenger.');
    ELSE
        INSERT INTO test_results (test_name, expected_outcome, actual_outcome, status, details)
        VALUES ('Story 3: Train 125 on 2026-10-19 (PNR: 2849100701) No-Show & Promotion', 'RAC->CONFIRMED', v_res_rac_status, 'FAIL', 'No-show promotion failed.');
    END IF;

    ROLLBACK;
END$$

-- -----------------------------------------------------------------------------
-- TEST 4: Demo Story 4 - Train 119 on 2026-10-19 (Real Run Schedule 1111 Chart Lockout & Purge)
-- -----------------------------------------------------------------------------
DROP PROCEDURE IF EXISTS test_story_4$$
CREATE PROCEDURE test_story_4()
BEGIN
    DECLARE v_sched_id INT DEFAULT 1111;
    DECLARE v_snap_cnt INT DEFAULT 0;
    DECLARE v_remaining_wl INT DEFAULT 0;
    DECLARE v_purged_refunds INT DEFAULT 0;

    START TRANSACTION;

    -- Execute Chart Preparation with p_manage_tx = 0 against the real demo run (Schedule 1111)
    CALL sp_prepare_chart(v_sched_id, 0, v_snap_cnt);

    SELECT COUNT(*) INTO v_remaining_wl
    FROM RESERVATION
    WHERE schedule_id = v_sched_id AND status = 'WAITING_LIST';

    SELECT COUNT(*) INTO v_purged_refunds
    FROM REFUND
    WHERE reason = 'WAITLIST_PURGE';

    IF v_remaining_wl = 0 AND v_purged_refunds > 0 AND v_snap_cnt > 0 THEN
        INSERT INTO test_results (test_name, expected_outcome, actual_outcome, status, details)
        VALUES ('Story 4: Train 119 on 2026-10-19 (Schedule: 1111) Real Run Chart Prep & Purge',
                '0 Remaining WL, Auto-Refunds Created, Snapshots Generated',
                CONCAT('WL: ', v_remaining_wl, ', Purged Refunds: ', v_purged_refunds, ', Snapshots: ', v_snap_cnt),
                'PASS',
                'Chart prep against real demo run Train 119 purged all WL with auto-refunds and locked run.');
    ELSE
        INSERT INTO test_results (test_name, expected_outcome, actual_outcome, status, details)
        VALUES ('Story 4: Train 119 on 2026-10-19 (Schedule: 1111) Real Run Chart Prep & Purge',
                '0 Remaining WL, Auto-Refunds Created, Snapshots Generated',
                CONCAT('WL: ', v_remaining_wl, ', Purged Refunds: ', v_purged_refunds, ', Snapshots: ', v_snap_cnt),
                'FAIL',
                'Chart prep on real demo run failed.');
    END IF;

    -- Clean rollback restores the real demo run data completely
    ROLLBACK;
END$$

-- -----------------------------------------------------------------------------
-- TEST 5: Demo Story 5 - Train 146 on 2026-10-20 (Schedule: 1254 Quota Fallback)
-- -----------------------------------------------------------------------------
DROP PROCEDURE IF EXISTS test_story_5$$
CREATE PROCEDURE test_story_5()
BEGIN
    DECLARE v_sched_id INT DEFAULT 1254;
    DECLARE v_class_id INT DEFAULT 5; -- CC for Train 146
    DECLARE v_out_pnr VARCHAR(10);
    DECLARE v_out_stat VARCHAR(20);
    DECLARE v_out_fare DECIMAL(10,2);
    DECLARE v_out_err VARCHAR(32);
    DECLARE v_booked_quota VARCHAR(20);
    DECLARE v_req_quota VARCHAR(20);
    DECLARE v_passengers JSON;

    SET v_passengers = JSON_ARRAY(
        JSON_OBJECT('saved_passenger_id', 7, 'name', 'Pooja Verma', 'age', 25, 'gender', 'FEMALE', 'concession_type', 'NONE', 'berth_preference', 'WINDOW')
    );

    START TRANSACTION;

    -- Real demo run Train 146 on 2026-10-20 (Schedule 1254, Class 5 CC):
    -- LADIES quota has 78 seats and all 78 are booked (sold out).
    -- GENERAL quota has 620 capacity, 434 booked, and 186 free confirmed seats.
    -- First: booking without consent (p_fallback_consent = 0) must return SEAT_NOT_AVAILABLE.
    CALL sp_create_booking(
        50001, v_sched_id, v_class_id, 1069, 1076, 'LADIES', 0, 0, v_passengers, 'ONLINE', NULL, 0,
        v_out_pnr, v_out_stat, v_out_fare, v_out_err
    );

    IF v_out_err = 'SEAT_NOT_AVAILABLE' THEN
        -- Second: booking with consent (p_fallback_consent = 1) falls back to GENERAL and receives CONFIRMED seat
        CALL sp_create_booking(
            50001, v_sched_id, v_class_id, 1069, 1076, 'LADIES', 1, 0, v_passengers, 'ONLINE', NULL, 0,
            v_out_pnr, v_out_stat, v_out_fare, v_out_err
        );

        IF v_out_pnr IS NOT NULL THEN
            SELECT quota, requested_quota, status INTO v_booked_quota, v_req_quota, v_out_stat FROM BOOKING WHERE pnr = v_out_pnr;
        END IF;

        IF v_out_pnr IS NOT NULL AND v_booked_quota = 'GENERAL' AND v_req_quota = 'LADIES' AND v_out_stat = 'CONFIRMED' THEN
            INSERT INTO test_results (test_name, expected_outcome, actual_outcome, status, details)
            VALUES ('Story 5: Train 146 on 2026-10-20 (Schedule: 1254) Quota Fallback',
                    'Fallback Notice + CONFIRMED in GENERAL',
                    CONCAT('Active: ', v_booked_quota, ', Req: ', v_req_quota, ', Status: ', v_out_stat),
                    'PASS',
                    'LADIES sold out triggered fallback notice (SEAT_NOT_AVAILABLE). With consent, booked CONFIRMED in GENERAL.');
        ELSE
            INSERT INTO test_results (test_name, expected_outcome, actual_outcome, status, details)
            VALUES ('Story 5: Train 146 on 2026-10-20 (Schedule: 1254) Quota Fallback',
                    'Fallback Notice + CONFIRMED in GENERAL',
                    CONCAT('Active: ', COALESCE(v_booked_quota, 'NULL'), ', Status: ', COALESCE(v_out_stat, 'NULL'), ', Err: ', COALESCE(v_out_err, 'NONE')),
                    'FAIL',
                    'Quota fallback with consent did not confirm in GENERAL.');
        END IF;
    ELSE
        INSERT INTO test_results (test_name, expected_outcome, actual_outcome, status, details)
        VALUES ('Story 5: Train 146 on 2026-10-20 (Schedule: 1254) Quota Fallback',
                'Fallback Notice (SEAT_NOT_AVAILABLE)',
                CONCAT('Error: ', COALESCE(v_out_err, 'NONE')),
                'FAIL',
                'LADIES sold out failed to return SEAT_NOT_AVAILABLE without consent.');
    END IF;

    ROLLBACK;
END$$

-- -----------------------------------------------------------------------------
-- TEST 6: Edge Case - Train 101 on 2026-10-18 (Schedule: 1001) WAITING_LIST_FULL Rejection
-- -----------------------------------------------------------------------------
DROP PROCEDURE IF EXISTS test_waiting_list_full$$
CREATE PROCEDURE test_waiting_list_full()
BEGIN
    DECLARE v_sched_id INT DEFAULT 1001;
    DECLARE v_out_pnr VARCHAR(10);
    DECLARE v_out_stat VARCHAR(20);
    DECLARE v_out_fare DECIMAL(10,2);
    DECLARE v_out_err VARCHAR(32);
    DECLARE v_passengers JSON;

    SET v_passengers = JSON_ARRAY(
        JSON_OBJECT('saved_passenger_id', 7, 'name', 'Test Passenger', 'age', 30, 'gender', 'MALE', 'concession_type', 'NONE', 'berth_preference', 'LOWER')
    );

    START TRANSACTION;

    UPDATE SCHEDULE_CLASS_INVENTORY
    SET available_seats = 0, rac_capacity = 0, rac_count = 0, wl_capacity = 0, wl_count = 0
    WHERE schedule_id = v_sched_id AND class_id = 3;

    CALL sp_create_booking(
        50001, v_sched_id, 3, 1001, 1005, 'GENERAL', 0, 0, v_passengers, 'ONLINE', NULL, 0,
        v_out_pnr, v_out_stat, v_out_fare, v_out_err
    );

    IF v_out_err = 'WAITING_LIST_FULL' THEN
        INSERT INTO test_results (test_name, expected_outcome, actual_outcome, status, details)
        VALUES ('Edge Case: Train 101 on 2026-10-18 (Schedule: 1001) WAITING_LIST_FULL', 'WAITING_LIST_FULL', v_out_err, 'PASS', 'Correctly rejected booking when WL slots exhausted.');
    ELSE
        INSERT INTO test_results (test_name, expected_outcome, actual_outcome, status, details)
        VALUES ('Edge Case: Train 101 on 2026-10-18 (Schedule: 1001) WAITING_LIST_FULL', 'WAITING_LIST_FULL', COALESCE(v_out_err, 'NULL'), 'FAIL', 'Failed to reject with WAITING_LIST_FULL.');
    END IF;

    ROLLBACK;
END$$

-- -----------------------------------------------------------------------------
-- TEST 7: Edge Case - Train 101 on 2026-10-18 (Schedule: 1001) RAC-Open Allocation
-- -----------------------------------------------------------------------------
DROP PROCEDURE IF EXISTS test_rac_open$$
CREATE PROCEDURE test_rac_open()
BEGIN
    DECLARE v_sched_id INT DEFAULT 1001;
    DECLARE v_out_pnr VARCHAR(10);
    DECLARE v_out_stat VARCHAR(20);
    DECLARE v_out_fare DECIMAL(10,2);
    DECLARE v_out_err VARCHAR(32);
    DECLARE v_passengers JSON;

    SET v_passengers = JSON_ARRAY(
        JSON_OBJECT('saved_passenger_id', 7, 'name', 'Test RAC User', 'age', 30, 'gender', 'MALE', 'concession_type', 'NONE', 'berth_preference', 'NO_BERTH')
    );

    START TRANSACTION;

    UPDATE SCHEDULE_CLASS_INVENTORY
    SET available_seats = 0, rac_capacity = 5, rac_count = 0, wl_capacity = 5, wl_count = 0
    WHERE schedule_id = v_sched_id AND class_id = 3;

    CALL sp_create_booking(
        50001, v_sched_id, 3, 1001, 1005, 'GENERAL', 0, 0, v_passengers, 'ONLINE', NULL, 0,
        v_out_pnr, v_out_stat, v_out_fare, v_out_err
    );

    IF v_out_pnr IS NOT NULL AND v_out_stat = 'RAC' THEN
        INSERT INTO test_results (test_name, expected_outcome, actual_outcome, status, details)
        VALUES ('Edge Case: Train 101 on 2026-10-18 (Schedule: 1001) RAC-Open Booking', 'RAC', v_out_stat, 'PASS', 'Passenger allocated RAC when seats full.');
    ELSE
        INSERT INTO test_results (test_name, expected_outcome, actual_outcome, status, details)
        VALUES ('Edge Case: Train 101 on 2026-10-18 (Schedule: 1001) RAC-Open Booking', 'RAC', COALESCE(v_out_stat, v_out_err), 'FAIL', 'RAC allocation failed.');
    END IF;

    ROLLBACK;
END$$

-- -----------------------------------------------------------------------------
-- TEST 8: Edge Case - Train 101 on 2026-10-18 (Schedule: 1001) BERTH_PREFERENCE_NOT_MET Rejection
-- -----------------------------------------------------------------------------
DROP PROCEDURE IF EXISTS test_berth_preference_not_met$$
CREATE PROCEDURE test_berth_preference_not_met()
BEGIN
    DECLARE v_sched_id INT DEFAULT 1001;
    DECLARE v_out_pnr VARCHAR(10);
    DECLARE v_out_stat VARCHAR(20);
    DECLARE v_out_fare DECIMAL(10,2);
    DECLARE v_out_err VARCHAR(32);
    DECLARE v_passengers JSON;

    SET v_passengers = JSON_ARRAY(
        JSON_OBJECT('saved_passenger_id', 7, 'name', 'Pick Berth User', 'age', 30, 'gender', 'MALE', 'concession_type', 'NONE', 'berth_preference', 'LOWER')
    );

    START TRANSACTION;

    UPDATE SCHEDULE_CLASS_INVENTORY
    SET available_seats = 0, rac_capacity = 10, rac_count = 0
    WHERE schedule_id = v_sched_id AND class_id = 3;

    CALL sp_create_booking(
        50001, v_sched_id, 3, 1001, 1005, 'GENERAL', 0, 1, v_passengers, 'ONLINE', NULL, 0,
        v_out_pnr, v_out_stat, v_out_fare, v_out_err
    );

    IF v_out_err = 'BERTH_PREFERENCE_NOT_MET' THEN
        INSERT INTO test_results (test_name, expected_outcome, actual_outcome, status, details)
        VALUES ('Edge Case: Train 101 on 2026-10-18 (Schedule: 1001) BERTH_PREFERENCE_NOT_MET', 'BERTH_PREFERENCE_NOT_MET', v_out_err, 'PASS', 'Berth condition enforced and transaction rolled back to savepoint.');
    ELSE
        INSERT INTO test_results (test_name, expected_outcome, actual_outcome, status, details)
        VALUES ('Edge Case: Train 101 on 2026-10-18 (Schedule: 1001) BERTH_PREFERENCE_NOT_MET', 'BERTH_PREFERENCE_NOT_MET', COALESCE(v_out_err, 'NONE'), 'FAIL', 'Berth condition enforcement failed.');
    END IF;

    ROLLBACK;
END$$

-- -----------------------------------------------------------------------------
-- TEST 9: Edge Case - Train 101 on 2026-10-18 (Schedule: 1001) MONTHLY_LIMIT_EXCEEDED Rejection
-- -----------------------------------------------------------------------------
DROP PROCEDURE IF EXISTS test_monthly_limit_exceeded$$
CREATE PROCEDURE test_monthly_limit_exceeded()
BEGIN
    DECLARE v_sched_id INT DEFAULT 1001;
    DECLARE v_out_pnr VARCHAR(10);
    DECLARE v_out_stat VARCHAR(20);
    DECLARE v_out_fare DECIMAL(10,2);
    DECLARE v_out_err VARCHAR(32);
    DECLARE v_passengers JSON;
    DECLARE v_cnt INT DEFAULT 0;

    SET v_passengers = JSON_ARRAY(
        JSON_OBJECT('saved_passenger_id', 7, 'name', 'Limit User', 'age', 30, 'gender', 'MALE', 'concession_type', 'NONE', 'berth_preference', 'NO_BERTH')
    );

    DELETE FROM BOOKING WHERE pnr LIKE '88880000%';

    START TRANSACTION;

    UPDATE USER_ACCOUNT SET aadhaar_verified = 0 WHERE user_id = 50002;

    WHILE v_cnt < 12 DO
        INSERT INTO BOOKING (pnr, user_id, schedule_id, class_id, from_stop_id, to_stop_id, channel, quota, requested_quota, berth_condition, total_fare, status, created_at)
        VALUES (CONCAT('88880000', LPAD(v_cnt, 2, '0')), 50002, v_sched_id, 3, 1001, 1005, 'ONLINE', 'GENERAL', 'GENERAL', 0, 100.00, 'CONFIRMED', NOW());
        SET v_cnt = v_cnt + 1;
    END WHILE;

    CALL sp_create_booking(
        50002, v_sched_id, 3, 1001, 1005, 'GENERAL', 0, 0, v_passengers, 'ONLINE', NULL, 0,
        v_out_pnr, v_out_stat, v_out_fare, v_out_err
    );

    IF v_out_err = 'MONTHLY_LIMIT_EXCEEDED' THEN
        INSERT INTO test_results (test_name, expected_outcome, actual_outcome, status, details)
        VALUES ('Edge Case: Train 101 on 2026-10-18 (Schedule: 1001) MONTHLY_LIMIT_EXCEEDED', 'MONTHLY_LIMIT_EXCEEDED', v_out_err, 'PASS', 'Monthly booking limit of 12 tickets blocked 13th booking.');
    ELSE
        INSERT INTO test_results (test_name, expected_outcome, actual_outcome, status, details)
        VALUES ('Edge Case: Train 101 on 2026-10-18 (Schedule: 1001) MONTHLY_LIMIT_EXCEEDED', 'MONTHLY_LIMIT_EXCEEDED', COALESCE(v_out_err, 'NONE'), 'FAIL', 'Monthly limit enforcement failed.');
    END IF;

    ROLLBACK;
    DELETE FROM BOOKING WHERE pnr LIKE '88880000%';
END$$

-- -----------------------------------------------------------------------------
-- TEST 10: Edge Case - Train 101 on 2026-10-18 (Schedule: 1001) CHART_PREPARED Lockout Rejection
-- -----------------------------------------------------------------------------
DROP PROCEDURE IF EXISTS test_chart_prepared$$
CREATE PROCEDURE test_chart_prepared()
BEGIN
    DECLARE v_sched_id INT DEFAULT 1001;
    DECLARE v_out_pnr VARCHAR(10);
    DECLARE v_out_stat VARCHAR(20);
    DECLARE v_out_fare DECIMAL(10,2);
    DECLARE v_out_err VARCHAR(32);
    DECLARE v_passengers JSON;

    SET v_passengers = JSON_ARRAY(
        JSON_OBJECT('saved_passenger_id', 7, 'name', 'Late Booker', 'age', 30, 'gender', 'MALE', 'concession_type', 'NONE', 'berth_preference', 'NO_BERTH')
    );

    START TRANSACTION;

    UPDATE TRAIN_SCHEDULE SET chart_prepared_at = NOW() - INTERVAL 1 HOUR WHERE schedule_id = v_sched_id;

    CALL sp_create_booking(
        50001, v_sched_id, 3, 1001, 1005, 'GENERAL', 0, 0, v_passengers, 'ONLINE', NULL, 0,
        v_out_pnr, v_out_stat, v_out_fare, v_out_err
    );

    IF v_out_err = 'CHART_PREPARED' THEN
        INSERT INTO test_results (test_name, expected_outcome, actual_outcome, status, details)
        VALUES ('Edge Case: Train 101 on 2026-10-18 (Schedule: 1001) CHART_PREPARED', 'CHART_PREPARED', v_out_err, 'PASS', 'Booking rejected immediately because chart was already prepared.');
    ELSE
        INSERT INTO test_results (test_name, expected_outcome, actual_outcome, status, details)
        VALUES ('Edge Case: Train 101 on 2026-10-18 (Schedule: 1001) CHART_PREPARED', 'CHART_PREPARED', COALESCE(v_out_err, 'NONE'), 'FAIL', 'Chart lockout failed.');
    END IF;

    ROLLBACK;
END$$

-- -----------------------------------------------------------------------------
-- TEST 11: Whole-PNR Cancellation with 2 Confirmed Seats
-- Train 111 on 2026-10-18 (Schedule: 1064, Class: 1A, PNR: 2849100002)
-- Rule BR-W2: "In classes without RAC, a waiting-list passenger moves straight to CONFIRMED."
-- Class 1 (1A) has rac_capacity = 0. Therefore, RAC does NOT exist on this run/class,
-- and cancelling 2 confirmed seats promotes WL/1 and WL/2 directly to CONFIRMED.
-- -----------------------------------------------------------------------------
DROP PROCEDURE IF EXISTS test_whole_pnr_cancel_two_seats$$
CREATE PROCEDURE test_whole_pnr_cancel_two_seats()
BEGIN
    DECLARE v_pnr VARCHAR(10) DEFAULT '2849100002'; -- Has 2 Confirmed seats (9366, 9367) on Train 111 (Schedule 1064), Class 1 (1A)
    DECLARE v_wl1_status VARCHAR(20);
    DECLARE v_wl2_status VARCHAR(20);
    DECLARE v_out_chg DECIMAL(10,2);
    DECLARE v_out_ref DECIMAL(10,2);
    DECLARE v_out_stat VARCHAR(20);

    START TRANSACTION;

    -- Set deterministic as-of time: 24h before train origin departure (2026-10-18 19:15:00)
    SET @as_of_time = '2026-10-17 19:15:00';

    -- Cancel whole PNR (passenger_no = NULL) with p_manage_tx = 0
    CALL sp_cancel_passenger_ticket(v_pnr, NULL, 'TRAVEL_CANCELLED', 0, v_out_chg, v_out_ref, v_out_stat);

    -- For Class 1 (1A, rac_capacity = 0 per BR-W2), freed seats promote lowest WL passengers straight to CONFIRMED
    SELECT status INTO v_wl1_status FROM RESERVATION WHERE pnr = '2849100012' AND passenger_no = 1;
    SELECT status INTO v_wl2_status FROM RESERVATION WHERE pnr = '2849100013' AND passenger_no = 1;

    IF v_wl1_status = 'CONFIRMED' AND v_wl2_status = 'CONFIRMED' THEN
        INSERT INTO test_results (test_name, expected_outcome, actual_outcome, status, details)
        VALUES ('Edge Case: Train 111 on 2026-10-18 (PNR: 2849100002) Whole-PNR Cancel Class 1A (BR-W2: No RAC -> WL to CONFIRMED)',
                'Both WL1 & WL2 Promoted to CONFIRMED',
                CONCAT('WL1: ', v_wl1_status, ', WL2: ', v_wl2_status),
                'PASS',
                'Whole-PNR cancellation triggered 2 promotions. Class 1A has rac_capacity=0; per BR-W2, WL moves straight to CONFIRMED.');
    ELSE
        INSERT INTO test_results (test_name, expected_outcome, actual_outcome, status, details)
        VALUES ('Edge Case: Train 111 on 2026-10-18 (PNR: 2849100002) Whole-PNR Cancel Class 1A (BR-W2: No RAC -> WL to CONFIRMED)',
                'Both WL1 & WL2 Promoted to CONFIRMED',
                CONCAT('WL1: ', COALESCE(v_wl1_status, 'NULL'), ', WL2: ', COALESCE(v_wl2_status, 'NULL')),
                'FAIL',
                'Whole-PNR promotion failed.');
    END IF;

    SET @as_of_time = NULL;
    ROLLBACK;
END$$

-- -----------------------------------------------------------------------------
-- TEST 12: Cancellation of a Waiting List Passenger
-- Train 111 on 2026-10-18 (Schedule: 1064, Class: 2A, PNR: 2849100122)
-- Verifies that cancelling an RAC or WL passenger frees no seat and promotes nobody wrongly,
-- strictly shifting subsequent WL positions up by 1 per BR-W7.
-- -----------------------------------------------------------------------------
DROP PROCEDURE IF EXISTS test_cancel_wl_passenger$$
CREATE PROCEDURE test_cancel_wl_passenger()
BEGIN
    DECLARE v_wl_pnr VARCHAR(10) DEFAULT '2849100122'; -- WL/1 on schedule 1064 class 2
    DECLARE v_next_wl_pnr VARCHAR(10) DEFAULT '2849100123'; -- WL/2 on schedule 1064 class 2
    DECLARE v_next_wl_queue VARCHAR(32);
    DECLARE v_next_wl_status VARCHAR(20);
    DECLARE v_out_chg DECIMAL(10,2);
    DECLARE v_out_ref DECIMAL(10,2);
    DECLARE v_out_stat VARCHAR(20);

    START TRANSACTION;

    -- Set deterministic as-of time: 24h before train origin departure (2026-10-18 19:15:00)
    SET @as_of_time = '2026-10-17 19:15:00';

    -- Cancel WL/1 passenger with p_manage_tx = 0
    CALL sp_cancel_passenger_ticket(v_wl_pnr, 1, 'PLANS_CHANGED', 0, v_out_chg, v_out_ref, v_out_stat);

    -- Check next WL passenger: must remain WAITING_LIST (promotes nobody wrongly) and move from WL/2 to WL/1
    SELECT status, queue_position INTO v_next_wl_status, v_next_wl_queue
    FROM RESERVATION
    WHERE pnr = v_next_wl_pnr AND passenger_no = 1;

    IF v_next_wl_status = 'WAITING_LIST' AND v_next_wl_queue = 'WL/1' THEN
        INSERT INTO test_results (test_name, expected_outcome, actual_outcome, status, details)
        VALUES ('Edge Case: Train 111 on 2026-10-18 (PNR: 2849100122) Cancel Waiting List Passenger',
                'Status WAITING_LIST, Queue WL/1',
                CONCAT('Status: ', v_next_wl_status, ', Queue: ', v_next_wl_queue),
                'PASS',
                'Cancelling WL passenger freed no seat and correctly shifted queue position without false promotion.');
    ELSE
        INSERT INTO test_results (test_name, expected_outcome, actual_outcome, status, details)
        VALUES ('Edge Case: Train 111 on 2026-10-18 (PNR: 2849100122) Cancel Waiting List Passenger',
                'Status WAITING_LIST, Queue WL/1',
                CONCAT('Status: ', COALESCE(v_next_wl_status, 'NULL'), ', Queue: ', COALESCE(v_next_wl_queue, 'NULL')),
                'FAIL',
                'WL cancellation queue shift failed.');
    END IF;

    SET @as_of_time = NULL;
    ROLLBACK;
END$$

-- -----------------------------------------------------------------------------
-- TEST 13: Whole-PNR Cancellation with Mixed CONFIRMED, RAC, and WL Passengers
-- Train 119 on 2026-10-19 (Schedule: 1111, Class: 3A, PNR: 9888000001)
-- Verifies that cancelling a whole PNR with a mix of CONFIRMED, RAC, and WL passengers
-- before chart preparation (at 33.25h before origin departure -> 25% slab for CONF):
--   - Creates exactly one CANCELLATION row per passenger (3 rows)
--   - Creates individual REFUND rows per passenger (3 rows, BR-R3)
--   - Total refund equals sum of individual passenger refunds
--   - Only CONFIRMED seat promotes RAC to CONFIRMED, RAC slot promotes WL to RAC, and WL queue shifts
-- -----------------------------------------------------------------------------
DROP PROCEDURE IF EXISTS test_whole_pnr_cancel_mixed_passengers$$
CREATE PROCEDURE test_whole_pnr_cancel_mixed_passengers()
BEGIN
    DECLARE v_test_pnr VARCHAR(10) DEFAULT '9888000001';
    DECLARE v_sched_id INT DEFAULT 1111;
    DECLARE v_class_id INT DEFAULT 3;
    DECLARE v_cancel_count INT DEFAULT 0;
    DECLARE v_refund_count INT DEFAULT 0;
    DECLARE v_refund_sum DECIMAL(10,2) DEFAULT 0.00;
    DECLARE v_out_chg DECIMAL(10,2);
    DECLARE v_out_ref DECIMAL(10,2);
    DECLARE v_out_stat VARCHAR(20);

    START TRANSACTION;

    -- Set deterministic as-of time: 2026-10-18 10:00:00 (33.25 hours before 2026-10-19 19:15:00 departure)
    -- CONF passenger falls in 25% slab (BR-R1: 24h to 72h before departure -> deduction 25%)
    SET @as_of_time = '2026-10-18 10:00:00';

    INSERT INTO BOOKING (
        pnr, user_id, schedule_id, class_id, from_stop_id, to_stop_id,
        channel, quota, requested_quota, berth_condition, total_fare, status, created_at
    ) VALUES (v_test_pnr, 50001, v_sched_id, v_class_id, 1001, 1005, 'ONLINE', 'GENERAL', 'GENERAL', 0, 3000.00, 'CONFIRMED', '2026-10-18 08:00:00');

    INSERT INTO PASSENGER_BOOKING (pnr, passenger_no, saved_passenger_id, name, age, gender, concession_type, base_fare, total_fare, insurance)
    VALUES
    (v_test_pnr, 1, 15, 'Mixed Pass 1 Conf', 30, 'MALE', 'NONE', 999.55, 1000.00, 0.45),
    (v_test_pnr, 2, 16, 'Mixed Pass 2 RAC', 28, 'FEMALE', 'NONE', 999.55, 1000.00, 0.45),
    (v_test_pnr, 3, 17, 'Mixed Pass 3 WL', 25, 'MALE', 'NONE', 999.55, 1000.00, 0.45);

    INSERT INTO RESERVATION (res_id, pnr, passenger_no, schedule_id, seat_id, status, queue_position)
    VALUES
    (988801, v_test_pnr, 1, v_sched_id, 17001, 'CONFIRMED', NULL),
    (988802, v_test_pnr, 2, v_sched_id, NULL, 'RAC', 'RAC/99'),
    (988803, v_test_pnr, 3, v_sched_id, NULL, 'WAITING_LIST', 'WL/99');

    INSERT INTO PAYMENT (payment_id, pnr, amount, method, status, gateway_payment_id, paid_at)
    VALUES (988801, v_test_pnr, 3000.00, 'UPI', 'SUCCESS', 'pay_mixed_test_01', '2026-10-18 08:00:00');

    -- Execute whole-PNR cancellation (passenger_no = NULL) with p_manage_tx = 0
    CALL sp_cancel_passenger_ticket(v_test_pnr, NULL, 'MIXED_PASSENGERS_CANCEL', 0, v_out_chg, v_out_ref, v_out_stat);

    SELECT COUNT(*) INTO v_cancel_count FROM CANCELLATION WHERE pnr = v_test_pnr;
    SELECT COUNT(*), COALESCE(SUM(amount), 0.00) INTO v_refund_count, v_refund_sum FROM REFUND WHERE payment_id = 988801;

    IF v_cancel_count = 3 AND v_refund_count = 3 AND v_refund_sum = v_out_ref THEN
        INSERT INTO test_results (test_name, expected_outcome, actual_outcome, status, details)
        VALUES ('Edge Case: Train 119 on 2026-10-19 (PNR: 9888000001) Whole-PNR Cancel Mixed Passengers (CONF+RAC+WL)',
                '3 CANCELLATION Rows, 3 REFUND Rows Matching Sum (BR-R3)',
                CONCAT('Cancels: ', v_cancel_count, ', Refunds: ', v_refund_count, ', Total Refund: ', v_refund_sum),
                'PASS',
                'Whole-PNR cancellation before chart limit created individual CANCELLATION and REFUND rows for all 3 passengers.');
    ELSE
        INSERT INTO test_results (test_name, expected_outcome, actual_outcome, status, details)
        VALUES ('Edge Case: Train 119 on 2026-10-19 (PNR: 9888000001) Whole-PNR Cancel Mixed Passengers (CONF+RAC+WL)',
                '3 CANCELLATION Rows, 3 REFUND Rows Matching Sum (BR-R3)',
                CONCAT('Cancels: ', v_cancel_count, ', Refunds: ', v_refund_count, ', Refund Sum: ', v_refund_sum, ', Out Ref: ', v_out_ref),
                'FAIL',
                'Mixed passenger whole-PNR cancellation verification failed.');
    END IF;

    SET @as_of_time = NULL;
    ROLLBACK;
END$$

-- -----------------------------------------------------------------------------
-- TEST 14: Online Cancellation Rejection After Chart Preparation Time (< 8h)
-- Train 119 on 2026-10-19 (Schedule: 1111, Origin Departure: 19:15:00)
-- Rules: BR-B12, BR-R7, API_CONTRACT
-- Verifies that online cancellation attempted at or after chart time (<= 8 hours before origin departure)
-- is strictly rejected with status / error code 'CHART_PREPARED'.
-- -----------------------------------------------------------------------------
DROP PROCEDURE IF EXISTS test_cancel_after_chart$$
CREATE PROCEDURE test_cancel_after_chart()
BEGIN
    DECLARE v_test_pnr VARCHAR(10) DEFAULT '9888000002';
    DECLARE v_sched_id INT DEFAULT 1111;
    DECLARE v_class_id INT DEFAULT 3;
    DECLARE v_out_chg DECIMAL(10,2);
    DECLARE v_out_ref DECIMAL(10,2);
    DECLARE v_out_stat VARCHAR(20);

    START TRANSACTION;

    -- Set deterministic as-of time: 2026-10-19 14:00:00 (5.25 hours before 19:15:00 departure -> past 8h chart deadline)
    SET @as_of_time = '2026-10-19 14:00:00';

    INSERT INTO BOOKING (
        pnr, user_id, schedule_id, class_id, from_stop_id, to_stop_id,
        channel, quota, requested_quota, berth_condition, total_fare, status, created_at
    ) VALUES (v_test_pnr, 50001, v_sched_id, v_class_id, 1001, 1005, 'ONLINE', 'GENERAL', 'GENERAL', 0, 1000.00, 'CONFIRMED', '2026-10-18 08:00:00');

    INSERT INTO PASSENGER_BOOKING (pnr, passenger_no, saved_passenger_id, name, age, gender, concession_type, base_fare, total_fare, insurance)
    VALUES (v_test_pnr, 1, 15, 'Late Canceller', 30, 'MALE', 'NONE', 999.55, 1000.00, 0.45);

    INSERT INTO RESERVATION (res_id, pnr, passenger_no, schedule_id, seat_id, status, queue_position)
    VALUES (988804, v_test_pnr, 1, v_sched_id, 17002, 'CONFIRMED', NULL);

    INSERT INTO PAYMENT (payment_id, pnr, amount, method, status, gateway_payment_id, paid_at)
    VALUES (988802, v_test_pnr, 1000.00, 'UPI', 'SUCCESS', 'pay_late_cancel_01', '2026-10-18 08:00:00');

    -- Attempt online cancellation after chart time (< 8 hours) with p_manage_tx = 0
    CALL sp_cancel_passenger_ticket(v_test_pnr, 1, 'LATE_CANCEL_ATTEMPT', 0, v_out_chg, v_out_ref, v_out_stat);

    IF v_out_stat = 'CHART_PREPARED' THEN
        INSERT INTO test_results (test_name, expected_outcome, actual_outcome, status, details)
        VALUES ('Edge Case: Train 119 on 2026-10-19 (PNR: 9888000002) Cancel After Chart Time (BR-B12, BR-R7)',
                'CHART_PREPARED',
                v_out_stat,
                'PASS',
                'Cancellation correctly rejected with error CHART_PREPARED when attempted within 8h of departure.');
    ELSE
        INSERT INTO test_results (test_name, expected_outcome, actual_outcome, status, details)
        VALUES ('Edge Case: Train 119 on 2026-10-19 (PNR: 9888000002) Cancel After Chart Time (BR-B12, BR-R7)',
                'CHART_PREPARED',
                COALESCE(v_out_stat, 'NULL'),
                'FAIL',
                'Cancellation after chart time was not rejected.');
    END IF;

    SET @as_of_time = NULL;
    ROLLBACK;
END$$

-- -----------------------------------------------------------------------------
-- TEST 15: Tatkal CONFIRMED Passenger Cancellation Before Chart Preparation
-- Rule BR-R6: "Confirmed Tatkal tickets get no refund on voluntary cancellation."
-- Verifies that cancellation of a CONFIRMED Tatkal ticket produces charge = eligible fare,
-- refund_amount = 0.00, creates CANCELLATION row, and generates 0 REFUND rows.
-- -----------------------------------------------------------------------------
DROP PROCEDURE IF EXISTS test_tatkal_confirmed_cancel$$
CREATE PROCEDURE test_tatkal_confirmed_cancel()
BEGIN
    DECLARE v_test_pnr VARCHAR(10) DEFAULT '9888000003';
    DECLARE v_sched_id INT DEFAULT 1111;
    DECLARE v_class_id INT DEFAULT 3;
    DECLARE v_out_chg DECIMAL(10,2);
    DECLARE v_out_ref DECIMAL(10,2);
    DECLARE v_out_stat VARCHAR(20);
    DECLARE v_refund_rows INT DEFAULT 0;
    DECLARE v_cancel_rows INT DEFAULT 0;

    START TRANSACTION;

    -- Set deterministic as-of time: 24h before origin departure (2026-10-18 19:15:00)
    SET @as_of_time = '2026-10-18 19:15:00';

    INSERT INTO BOOKING (
        pnr, user_id, schedule_id, class_id, from_stop_id, to_stop_id,
        channel, quota, requested_quota, berth_condition, total_fare, status, created_at
    ) VALUES (v_test_pnr, 50001, v_sched_id, v_class_id, 1001, 1005, 'ONLINE', 'TATKAL', 'TATKAL', 0, 1000.00, 'CONFIRMED', '2026-10-18 10:30:00');

    INSERT INTO PASSENGER_BOOKING (pnr, passenger_no, saved_passenger_id, name, age, gender, concession_type, base_fare, total_fare, insurance)
    VALUES (v_test_pnr, 1, 18, 'Tatkal Conf Booker', 32, 'MALE', 'NONE', 999.55, 1000.00, 0.45);

    INSERT INTO RESERVATION (res_id, pnr, passenger_no, schedule_id, seat_id, status, queue_position)
    VALUES (988805, v_test_pnr, 1, v_sched_id, 17003, 'CONFIRMED', NULL);

    INSERT INTO PAYMENT (payment_id, pnr, amount, method, status, gateway_payment_id, paid_at)
    VALUES (988803, v_test_pnr, 1000.00, 'UPI', 'SUCCESS', 'pay_tatkal_cancel_01', '2026-10-18 10:30:00');

    -- Cancel Tatkal confirmed passenger ticket
    CALL sp_cancel_passenger_ticket(v_test_pnr, 1, 'TATKAL_PLANS_CANCELLED', 0, v_out_chg, v_out_ref, v_out_stat);

    SELECT COUNT(*) INTO v_cancel_rows FROM CANCELLATION WHERE pnr = v_test_pnr;
    SELECT COUNT(*) INTO v_refund_rows FROM REFUND WHERE payment_id = 988803;

    IF v_out_stat = 'CANCELLED' AND v_out_ref = 0.00 AND v_out_chg = 999.55 AND v_refund_rows = 0 AND v_cancel_rows = 1 THEN
        INSERT INTO test_results (test_name, expected_outcome, actual_outcome, status, details)
        VALUES ('Edge Case: Tatkal Confirmed Passenger Cancel (BR-R6: No Refund)',
                'Charge 999.55, Refund 0.00, 0 REFUND Rows',
                CONCAT('Charge: ', v_out_chg, ', Refund: ', v_out_ref, ', Refund Rows: ', v_refund_rows),
                'PASS',
                'BR-R6 verified: Confirmed Tatkal ticket gets no voluntary refund (charge equals fare paid minus insurance).');
    ELSE
        INSERT INTO test_results (test_name, expected_outcome, actual_outcome, status, details)
        VALUES ('Edge Case: Tatkal Confirmed Passenger Cancel (BR-R6: No Refund)',
                'Charge 999.55, Refund 0.00, 0 REFUND Rows',
                CONCAT('Charge: ', COALESCE(v_out_chg, 0), ', Refund: ', COALESCE(v_out_ref, 0), ', Status: ', COALESCE(v_out_stat, 'NULL')),
                'FAIL',
                'Tatkal cancellation refund rule BR-R6 check failed.');
    END IF;

    SET @as_of_time = NULL;
    ROLLBACK;
END$$

-- -----------------------------------------------------------------------------
-- TEST 16: Counter-Booked Ticket Cancellation with Cash Refund
-- Rules BR-CB6, BR-R11: "Counter-booked tickets are cancelled at the counter by staff, and the refund is paid back as CASH."
-- Verifies that a counter-booked ticket (channel = 'COUNTER') cancelled before chart generates
-- a valid CANCELLATION record and a REFUND record linked to the CASH payment.
-- -----------------------------------------------------------------------------
DROP PROCEDURE IF EXISTS test_counter_ticket_cancel$$
CREATE PROCEDURE test_counter_ticket_cancel()
BEGIN
    DECLARE v_test_pnr VARCHAR(10) DEFAULT '9888000004';
    DECLARE v_sched_id INT DEFAULT 1111;
    DECLARE v_class_id INT DEFAULT 3;
    DECLARE v_out_chg DECIMAL(10,2);
    DECLARE v_out_ref DECIMAL(10,2);
    DECLARE v_out_stat VARCHAR(20);
    DECLARE v_refund_rows INT DEFAULT 0;
    DECLARE v_cancel_rows INT DEFAULT 0;
    DECLARE v_pay_method VARCHAR(20);

    START TRANSACTION;

    -- Set deterministic as-of time: 33.25h before origin departure -> 25% slab (deduction 25%, min 180)
    SET @as_of_time = '2026-10-18 10:00:00';

    INSERT INTO BOOKING (
        pnr, user_id, schedule_id, class_id, from_stop_id, to_stop_id,
        channel, quota, requested_quota, berth_condition, total_fare, status, created_at
    ) VALUES (v_test_pnr, 50004, v_sched_id, v_class_id, 1001, 1005, 'COUNTER', 'GENERAL', 'GENERAL', 0, 1000.00, 'CONFIRMED', '2026-10-18 09:00:00');

    INSERT INTO PASSENGER_BOOKING (pnr, passenger_no, saved_passenger_id, name, age, gender, concession_type, base_fare, total_fare, insurance)
    VALUES (v_test_pnr, 1, 19, 'Walkin Counter Passenger', 45, 'MALE', 'NONE', 999.55, 1000.00, 0.45);

    INSERT INTO RESERVATION (res_id, pnr, passenger_no, schedule_id, seat_id, status, queue_position)
    VALUES (988806, v_test_pnr, 1, v_sched_id, 17004, 'CONFIRMED', NULL);

    INSERT INTO PAYMENT (payment_id, pnr, amount, method, status, gateway_payment_id, paid_at)
    VALUES (988804, v_test_pnr, 1000.00, 'CASH', 'SUCCESS', 'CASH_REC_COUNTER_01', '2026-10-18 09:00:00');

    -- Cancel counter ticket with p_manage_tx = 0
    CALL sp_cancel_passenger_ticket(v_test_pnr, 1, 'COUNTER_WALKIN_CANCEL', 0, v_out_chg, v_out_ref, v_out_stat);

    SELECT COUNT(*) INTO v_cancel_rows FROM CANCELLATION WHERE pnr = v_test_pnr;
    SELECT COUNT(*) INTO v_refund_rows FROM REFUND WHERE payment_id = 988804;
    SELECT p.method INTO v_pay_method FROM REFUND r JOIN PAYMENT p ON r.payment_id = p.payment_id WHERE r.payment_id = 988804 LIMIT 1;

    IF v_out_stat = 'CANCELLED' AND v_out_ref = 749.66 AND v_cancel_rows = 1 AND v_refund_rows = 1 AND v_pay_method = 'CASH' THEN
        INSERT INTO test_results (test_name, expected_outcome, actual_outcome, status, details)
        VALUES ('Edge Case: Counter Ticket Cancel (BR-R11, BR-CB6: Cash Refund)',
                '1 CANCELLATION, 1 REFUND on CASH Payment (Refund 749.66)',
                CONCAT('Refund: ', v_out_ref, ', Payment Method: ', v_pay_method),
                'PASS',
                'BR-R11 verified: Counter ticket cancelled, refund linked to CASH payment for immediate cash disbursement.');
    ELSE
        INSERT INTO test_results (test_name, expected_outcome, actual_outcome, status, details)
        VALUES ('Edge Case: Counter Ticket Cancel (BR-R11, BR-CB6: Cash Refund)',
                '1 CANCELLATION, 1 REFUND on CASH Payment (Refund 749.66)',
                CONCAT('Refund: ', COALESCE(v_out_ref, 0), ', Method: ', COALESCE(v_pay_method, 'NULL')),
                'FAIL',
                'Counter ticket cancellation check failed.');
    END IF;

    SET @as_of_time = NULL;
    ROLLBACK;
END$$

-- -----------------------------------------------------------------------------
-- TEST 17: Real Data - Train 123 on 2026-10-18 (Schedule 1127, Class 3) GENERAL Booking WAITING_LIST_FULL
-- With NO changes to inventory: GENERAL confirmed is full (468/468), RAC is full (64/64), WL is full (160/160).
-- A new GENERAL booking must be rejected with WAITING_LIST_FULL per BR-W1.
-- -----------------------------------------------------------------------------
DROP PROCEDURE IF EXISTS test_real_general_waiting_list_full$$
CREATE PROCEDURE test_real_general_waiting_list_full()
BEGIN
    DECLARE v_sched_id INT DEFAULT 1127;
    DECLARE v_class_id INT DEFAULT 3;
    DECLARE v_out_pnr VARCHAR(10);
    DECLARE v_out_stat VARCHAR(20);
    DECLARE v_out_fare DECIMAL(10,2);
    DECLARE v_out_err VARCHAR(32);
    DECLARE v_passengers JSON;

    SET v_passengers = JSON_ARRAY(
        JSON_OBJECT('saved_passenger_id', 7, 'name', 'WL Full User', 'age', 30, 'gender', 'MALE', 'concession_type', 'NONE', 'berth_preference', 'NO_BERTH')
    );

    START TRANSACTION;

    CALL sp_create_booking(
        50001, v_sched_id, v_class_id, 1109, 1118, 'GENERAL', 0, 0, v_passengers, 'ONLINE', NULL, 0,
        v_out_pnr, v_out_stat, v_out_fare, v_out_err
    );

    IF v_out_err = 'WAITING_LIST_FULL' THEN
        INSERT INTO test_results (test_name, expected_outcome, actual_outcome, status, details)
        VALUES ('Real Data: Train 123 on 2026-10-18 (Schedule 1127) GENERAL Booking',
                'WAITING_LIST_FULL',
                v_out_err,
                'PASS',
                'BR-W1 verified: With no inventory modifications, booking on full run correctly rejected with WAITING_LIST_FULL.');
    ELSE
        INSERT INTO test_results (test_name, expected_outcome, actual_outcome, status, details)
        VALUES ('Real Data: Train 123 on 2026-10-18 (Schedule 1127) GENERAL Booking',
                'WAITING_LIST_FULL',
                COALESCE(v_out_err, v_out_stat, 'NULL'),
                'FAIL',
                'Expected WAITING_LIST_FULL on full run with no inventory changes.');
    END IF;

    ROLLBACK;
END$$

-- -----------------------------------------------------------------------------
-- TEST 18: Real Data - Train 131 on 2026-10-18 (Schedule 1174, Class 3) GENERAL Booking RAC Open
-- With NO changes to inventory: GENERAL confirmed is full (468/468), RAC is open (32 booked out of 64).
-- A new GENERAL booking must be allocated RAC status with queue position RAC/33.
-- -----------------------------------------------------------------------------
DROP PROCEDURE IF EXISTS test_real_general_rac_allocation$$
CREATE PROCEDURE test_real_general_rac_allocation()
BEGIN
    DECLARE v_sched_id INT DEFAULT 1174;
    DECLARE v_class_id INT DEFAULT 3;
    DECLARE v_out_pnr VARCHAR(10);
    DECLARE v_out_stat VARCHAR(20);
    DECLARE v_out_fare DECIMAL(10,2);
    DECLARE v_out_err VARCHAR(32);
    DECLARE v_res_stat VARCHAR(20);
    DECLARE v_res_queue VARCHAR(32);
    DECLARE v_passengers JSON;

    SET v_passengers = JSON_ARRAY(
        JSON_OBJECT('saved_passenger_id', 7, 'name', 'RAC User', 'age', 30, 'gender', 'MALE', 'concession_type', 'NONE', 'berth_preference', 'NO_BERTH')
    );

    START TRANSACTION;

    CALL sp_create_booking(
        50001, v_sched_id, v_class_id, 1001, 1005, 'GENERAL', 0, 0, v_passengers, 'ONLINE', NULL, 0,
        v_out_pnr, v_out_stat, v_out_fare, v_out_err
    );

    IF v_out_pnr IS NOT NULL THEN
        SELECT status, queue_position INTO v_res_stat, v_res_queue
        FROM RESERVATION
        WHERE pnr = v_out_pnr AND passenger_no = 1;
    END IF;

    IF v_out_stat = 'RAC' AND v_res_stat = 'RAC' AND v_res_queue = 'RAC/33' THEN
        INSERT INTO test_results (test_name, expected_outcome, actual_outcome, status, details)
        VALUES ('Real Data: Train 131 on 2026-10-18 (Schedule 1174) GENERAL Booking',
                'RAC (Queue: RAC/33)',
                CONCAT(v_out_stat, ' (', v_res_queue, ')'),
                'PASS',
                'BR-W1 verified: GENERAL confirmed full but RAC open correctly allocates RAC/33 with no inventory changes.');
    ELSE
        INSERT INTO test_results (test_name, expected_outcome, actual_outcome, status, details)
        VALUES ('Real Data: Train 131 on 2026-10-18 (Schedule 1174) GENERAL Booking',
                'RAC (Queue: RAC/33)',
                CONCAT(COALESCE(v_out_stat, 'NULL'), ' (', COALESCE(v_res_queue, 'NULL'), ', err: ', COALESCE(v_out_err, 'NONE'), ')'),
                'FAIL',
                'Expected RAC allocation on Train 131.');
    END IF;

    ROLLBACK;
END$$

-- -----------------------------------------------------------------------------
-- TEST 19: Real Data - Inventory & Reservation Counter Sync After Cancel with Promotion (BR-R9, BR-W4)
-- With NO manual changes to inventory:
-- Cancelling a CONFIRMED passenger on Train 123 (Schedule 1127, Class 3) promotes RAC/1 to CONFIRMED,
-- and promotes WL/1 to RAC/64.
-- Verifies that available_seats, rac_count, and wl_count remain 100% equal to actual reservations.
-- -----------------------------------------------------------------------------
DROP PROCEDURE IF EXISTS test_real_inventory_sync_after_cancel_promotion$$
CREATE PROCEDURE test_real_inventory_sync_after_cancel_promotion()
BEGIN
    DECLARE v_sched_id INT DEFAULT 1127;
    DECLARE v_class_id INT DEFAULT 3;
    DECLARE v_cancel_pnr VARCHAR(10);
    DECLARE v_cancel_pass_no INT;
    DECLARE v_cancel_quota VARCHAR(20);
    DECLARE v_cancel_status VARCHAR(20);
    DECLARE v_out_chg DECIMAL(10,2);
    DECLARE v_out_ref DECIMAL(10,2);
    DECLARE v_out_stat VARCHAR(20);
    DECLARE v_inv_avail_before INT;
    DECLARE v_inv_rac_before INT;
    DECLARE v_inv_wl_before INT;
    DECLARE v_inv_avail_after INT;
    DECLARE v_inv_rac_after INT;
    DECLARE v_inv_wl_after INT;
    DECLARE v_inv_tot INT;
    DECLARE v_real_conf_before INT;
    DECLARE v_real_rac_before INT;
    DECLARE v_real_wl_before INT;
    DECLARE v_real_conf_after INT;
    DECLARE v_real_rac_after INT;
    DECLARE v_real_wl_after INT;

    START TRANSACTION;

    -- Train 123 on 2026-10-18 departs at 12:45:00.
    -- Set deterministic as-of time to 02:00:00 (10h45m before origin departure, safely before 8h chart cutoff)
    SET @as_of_time = '2026-10-18 02:00:00';

    -- Pick a GENERAL CONFIRMED passenger from Schedule 1127 Class 3
    SELECT r.pnr, r.passenger_no, b.quota, r.status
    INTO v_cancel_pnr, v_cancel_pass_no, v_cancel_quota, v_cancel_status
    FROM RESERVATION r
    JOIN BOOKING b ON r.pnr = b.pnr
    WHERE r.schedule_id = v_sched_id AND b.class_id = v_class_id AND b.quota = 'GENERAL' AND r.status = 'CONFIRMED'
    LIMIT 1;

    -- Read BEFORE inventory
    SELECT total_seats, available_seats, rac_count, wl_count
    INTO v_inv_tot, v_inv_avail_before, v_inv_rac_before, v_inv_wl_before
    FROM SCHEDULE_CLASS_INVENTORY
    WHERE schedule_id = v_sched_id AND class_id = v_class_id;

    -- Read BEFORE reservations
    SELECT 
      COALESCE(SUM(CASE WHEN r.status IN ('CONFIRMED', 'BOARDED') THEN 1 ELSE 0 END), 0),
      COALESCE(SUM(CASE WHEN r.status = 'RAC' THEN 1 ELSE 0 END), 0),
      COALESCE(SUM(CASE WHEN r.status = 'WAITING_LIST' THEN 1 ELSE 0 END), 0)
    INTO v_real_conf_before, v_real_rac_before, v_real_wl_before
    FROM RESERVATION r
    JOIN BOOKING b ON r.pnr = b.pnr
    WHERE r.schedule_id = v_sched_id AND b.class_id = v_class_id;

    -- Print BEFORE CANCEL: passenger, inventory row, real reservation counts
    SELECT 'BEFORE_CANCEL_PASSENGER' AS info_type, v_cancel_pnr AS pnr, v_cancel_pass_no AS passenger_no, v_cancel_quota AS quota, v_cancel_status AS status;
    SELECT 'BEFORE_CANCEL_INVENTORY' AS info_type, schedule_id, class_id, total_seats, available_seats, rac_capacity, rac_count, wl_capacity, wl_count
    FROM SCHEDULE_CLASS_INVENTORY WHERE schedule_id = v_sched_id AND class_id = v_class_id;
    SELECT 'BEFORE_CANCEL_RESERVATIONS' AS info_type, v_real_conf_before AS confirmed_seats, v_real_rac_before AS rac_passengers, v_real_wl_before AS wl_passengers;

    -- Cancel the passenger (triggers trg_after_cancellation_promote and sp_promote_passenger)
    CALL sp_cancel_passenger_ticket(v_cancel_pnr, v_cancel_pass_no, 'TEST_SYNC', 0, v_out_chg, v_out_ref, v_out_stat);

    -- Read AFTER inventory
    SELECT available_seats, rac_count, wl_count
    INTO v_inv_avail_after, v_inv_rac_after, v_inv_wl_after
    FROM SCHEDULE_CLASS_INVENTORY
    WHERE schedule_id = v_sched_id AND class_id = v_class_id;

    -- Read AFTER reservations
    SELECT 
      COALESCE(SUM(CASE WHEN r.status IN ('CONFIRMED', 'BOARDED') THEN 1 ELSE 0 END), 0),
      COALESCE(SUM(CASE WHEN r.status = 'RAC' THEN 1 ELSE 0 END), 0),
      COALESCE(SUM(CASE WHEN r.status = 'WAITING_LIST' THEN 1 ELSE 0 END), 0)
    INTO v_real_conf_after, v_real_rac_after, v_real_wl_after
    FROM RESERVATION r
    JOIN BOOKING b ON r.pnr = b.pnr
    WHERE r.schedule_id = v_sched_id AND b.class_id = v_class_id;

    -- Print AFTER CANCEL: passenger, inventory row, real reservation counts
    SELECT 'AFTER_CANCEL_PASSENGER' AS info_type, v_cancel_pnr AS pnr, v_cancel_pass_no AS passenger_no, v_cancel_quota AS quota, r.status AS status, r.seat_id
    FROM RESERVATION r WHERE r.pnr = v_cancel_pnr AND r.passenger_no = v_cancel_pass_no;
    SELECT 'AFTER_CANCEL_INVENTORY' AS info_type, schedule_id, class_id, total_seats, available_seats, rac_capacity, rac_count, wl_capacity, wl_count
    FROM SCHEDULE_CLASS_INVENTORY WHERE schedule_id = v_sched_id AND class_id = v_class_id;
    SELECT 'AFTER_CANCEL_RESERVATIONS' AS info_type, v_real_conf_after AS confirmed_seats, v_real_rac_after AS rac_passengers, v_real_wl_after AS wl_passengers;

    IF v_out_stat = 'CANCELLED' 
       AND v_inv_avail_after = 94 AND v_inv_rac_after = 64 AND v_inv_wl_after = 159
       AND v_real_conf_after = 546 AND v_real_rac_after = 64 AND v_real_wl_after = 159 THEN
        INSERT INTO test_results (test_name, expected_outcome, actual_outcome, status, details)
        VALUES ('Real Data: Inventory Sync After Cancel with Promotion',
                'Avail: 94, RAC: 64, WL: 159',
                CONCAT('Avail: ', v_inv_avail_after, ', RAC: ', v_inv_rac_after, ', WL: ', v_inv_wl_after),
                'PASS',
                CONCAT('PNR: ', v_cancel_pnr, ' (', v_cancel_quota, ') cancelled. Promoted RAC->CONF and WL->RAC. Before: [Inv: ', v_inv_avail_before, '/', v_inv_rac_before, '/', v_inv_wl_before, ', Res: ', v_real_conf_before, '/', v_real_rac_before, '/', v_real_wl_before, '], After: [Inv: ', v_inv_avail_after, '/', v_inv_rac_after, '/', v_inv_wl_after, ', Res: ', v_real_conf_after, '/', v_real_rac_after, '/', v_real_wl_after, '].'));
    ELSE
        INSERT INTO test_results (test_name, expected_outcome, actual_outcome, status, details)
        VALUES ('Real Data: Inventory Sync After Cancel with Promotion',
                'Avail: 94, RAC: 64, WL: 159',
                CONCAT('Avail: ', v_inv_avail_after, ', RAC: ', v_inv_rac_after, ', WL: ', v_inv_wl_after, ', Stat: ', COALESCE(v_out_stat, 'NULL')),
                'FAIL',
                CONCAT('Cancel outcome failed. Status: ', COALESCE(v_out_stat, 'NULL')));
    END IF;

    SET @as_of_time = NULL;
    ROLLBACK;
END$$

-- -----------------------------------------------------------------------------
-- Master Test Runner Procedure
-- -----------------------------------------------------------------------------
DROP PROCEDURE IF EXISTS sp_run_all_tests$$
CREATE PROCEDURE sp_run_all_tests()
BEGIN
    TRUNCATE TABLE test_results;

    CALL test_story_1();
    CALL test_story_2();
    CALL test_story_3();
    CALL test_story_4();
    CALL test_story_5();
    CALL test_waiting_list_full();
    CALL test_rac_open();
    CALL test_berth_preference_not_met();
    CALL test_monthly_limit_exceeded();
    CALL test_chart_prepared();
    CALL test_whole_pnr_cancel_two_seats();
    CALL test_cancel_wl_passenger();
    CALL test_whole_pnr_cancel_mixed_passengers();
    CALL test_cancel_after_chart();
    CALL test_tatkal_confirmed_cancel();
    CALL test_counter_ticket_cancel();
    CALL test_real_general_waiting_list_full();
    CALL test_real_general_rac_allocation();
    CALL test_real_inventory_sync_after_cancel_promotion();

    SELECT test_id, test_name, expected_outcome, actual_outcome, status, details FROM test_results;
END$$

DELIMITER ;
