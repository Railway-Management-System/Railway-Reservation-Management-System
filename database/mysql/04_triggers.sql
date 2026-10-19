-- =============================================================================
-- Railway Reservation & Management System (MySQL 8.0)
-- File: 04_triggers.sql
-- Description: MySQL triggers adhering to MySQL 8.0 constraints:
--   1. trg_check_seat_overlap (BEFORE INSERT ON RESERVATION: segment overlap check)
--   2. trg_after_cancellation_promote (AFTER INSERT ON CANCELLATION: calls sp_promote_passenger)
--   3. trg_audit_fare_change (AFTER UPDATE ON FARE: audit log)
--   4. trg_audit_concession_change (AFTER UPDATE ON CONCESSION_RULE: audit log)
--   5. trg_audit_refund_rule_change (AFTER UPDATE ON REFUND_RULE: audit log)
--   6. trg_audit_setting_change (AFTER UPDATE ON SETTING: audit log)
-- =============================================================================

USE railway_db;

DELIMITER $$

-- -----------------------------------------------------------------------------
-- 1. trg_check_seat_overlap
-- Enforces Section 4 (BR-S4 & BR-S5):
-- "Two passengers can share a seat only if their segments do not overlap.
--  Two segments overlap when max(StartA, StartB) < min(EndA, EndB) in stop sequence.
--  Exception (BR-S5): up to 2 RAC passengers may share one SIDE_LOWER berth."
-- -----------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_check_seat_overlap$$
CREATE TRIGGER trg_check_seat_overlap
BEFORE INSERT ON RESERVATION
FOR EACH ROW
BEGIN
    DECLARE v_new_from_seq INT;
    DECLARE v_new_to_seq INT;
    DECLARE v_overlap_count INT DEFAULT 0;
    DECLARE v_berth_type VARCHAR(20);

    -- Only check overlap for CONFIRMED allocations with physical seats
    IF NEW.seat_id IS NOT NULL AND NEW.status = 'CONFIRMED' THEN
        SELECT rs_from.stop_sequence, rs_to.stop_sequence
        INTO v_new_from_seq, v_new_to_seq
        FROM BOOKING b
        JOIN ROUTE_STOP rs_from ON b.from_stop_id = rs_from.stop_id
        JOIN ROUTE_STOP rs_to ON b.to_stop_id = rs_to.stop_id
        WHERE b.pnr = NEW.pnr;

        SELECT COUNT(*)
        INTO v_overlap_count
        FROM RESERVATION r
        JOIN BOOKING b ON r.pnr = b.pnr
        JOIN ROUTE_STOP rs_from ON b.from_stop_id = rs_from.stop_id
        JOIN ROUTE_STOP rs_to ON b.to_stop_id = rs_to.stop_id
        WHERE r.schedule_id = NEW.schedule_id
          AND r.seat_id = NEW.seat_id
          AND r.status IN ('CONFIRMED', 'BOARDED')
          AND GREATEST(rs_from.stop_sequence, v_new_from_seq) < LEAST(rs_to.stop_sequence, v_new_to_seq);

        IF v_overlap_count > 0 THEN
            SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'SEAT_OVERLAP_ERROR: Seat is already allocated for an overlapping route segment.';
        END IF;

    ELSEIF NEW.seat_id IS NOT NULL AND NEW.status = 'RAC' THEN
        SELECT s.berth_type INTO v_berth_type
        FROM SEAT s WHERE s.seat_id = NEW.seat_id;

        IF v_berth_type != 'SIDE_LOWER' THEN
            SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'RAC_BERTH_ERROR: RAC passengers may only be assigned SIDE_LOWER berths.';
        END IF;

        SELECT COUNT(*)
        INTO v_overlap_count
        FROM RESERVATION r
        WHERE r.schedule_id = NEW.schedule_id
          AND r.seat_id = NEW.seat_id
          AND r.status = 'RAC';

        IF v_overlap_count >= 2 THEN
            SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'RAC_CAPACITY_EXCEEDED: Maximum of 2 RAC passengers permitted per SIDE_LOWER berth.';
        END IF;
    END IF;
END$$

-- -----------------------------------------------------------------------------
-- 2. trg_after_cancellation_promote
-- Automatically executes the single promotion procedure (sp_promote_passenger)
-- whenever a cancellation record is inserted (BR-R9, BR-W4).
-- -----------------------------------------------------------------------------
-- Drop old trigger if exists
DROP TRIGGER IF EXISTS trg_after_reservation_update$$

-- -----------------------------------------------------------------------------
-- 2. trg_after_cancellation_promote
-- Automatically executes the single promotion procedure (sp_promote_passenger)
-- whenever a cancellation record is inserted (BR-R9, BR-W4).
-- Handles:
--   - Whole-PNR cancellation (passenger_no IS NULL): promotes once per freed CONFIRMED seat via cursor.
--   - Single-passenger CONFIRMED cancellation: promotes exactly once for that freed seat.
--   - Single-passenger RAC cancellation: frees no seat, but calls sp_promote_passenger(sched, cls, NULL)
--     to advance the lowest WL passenger into the newly opened RAC slot.
--   - Single-passenger WL cancellation: frees no seat and opens no RAC slot, so promotes nobody wrongly,
--     advancing only subsequent WL queue positions up by 1 per BR-W7.
-- -----------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_after_cancellation_promote$$
CREATE TRIGGER trg_after_cancellation_promote
AFTER INSERT ON CANCELLATION
FOR EACH ROW
BEGIN
    DECLARE v_sched_id INT;
    DECLARE v_cls_id INT;
    DECLARE v_st_id INT DEFAULT NULL;
    DECLARE v_old_stat VARCHAR(20) DEFAULT NULL;
    DECLARE v_old_queue VARCHAR(32) DEFAULT NULL;
    DECLARE v_old_wl_num INT DEFAULT NULL;
    DECLARE done INT DEFAULT 0;

    -- Cursor for whole-PNR cancellation iterating over all CONFIRMED seats freed
    DECLARE cur_seats CURSOR FOR
        SELECT r.seat_id
        FROM RESERVATION r
        WHERE r.pnr = NEW.pnr
          AND r.seat_id IS NOT NULL;
    DECLARE CONTINUE HANDLER FOR NOT FOUND SET done = 1;

    -- Lookup schedule_id and class_id for booking
    SELECT b.schedule_id, b.class_id
    INTO v_sched_id, v_cls_id
    FROM BOOKING b
    WHERE b.pnr = NEW.pnr
    LIMIT 1;

    IF NEW.passenger_no IS NULL THEN
        -- Whole-PNR cancellation: promote once per freed confirmed seat
        OPEN cur_seats;
        seat_loop: LOOP
            FETCH cur_seats INTO v_st_id;
            IF done = 1 THEN LEAVE seat_loop; END IF;
            IF v_st_id IS NOT NULL THEN
                CALL sp_promote_passenger(v_sched_id, v_cls_id, v_st_id);
            END IF;
        END LOOP;
        CLOSE cur_seats;
    ELSE
        -- Single-passenger cancellation (and called per-passenger during whole-PNR cancellations)
        SELECT r.status, r.seat_id, r.queue_position
        INTO v_old_stat, v_st_id, v_old_queue
        FROM RESERVATION r
        WHERE r.pnr = NEW.pnr AND r.passenger_no = NEW.passenger_no
        LIMIT 1;

        IF v_old_stat = 'CONFIRMED' AND v_st_id IS NOT NULL THEN
            -- Confirmed passenger freed a physical seat: promote once for this seat
            CALL sp_promote_passenger(v_sched_id, v_cls_id, v_st_id);
        ELSEIF v_old_stat = 'RAC' THEN
            -- RAC passenger cancelled: freed an RAC slot (no physical seat)
            CALL sp_promote_passenger(v_sched_id, v_cls_id, NULL);
        ELSEIF v_old_stat = 'WAITING_LIST' THEN
            -- WL passenger cancelled: frees no seat and no RAC slot. Promotes nobody.
            -- Only shift subsequent WL queue positions up by 1 per BR-W7.
            IF v_old_queue IS NOT NULL THEN
                SET v_old_wl_num = CAST(SUBSTRING_INDEX(v_old_queue, '/', -1) AS UNSIGNED);
                UPDATE SCHEDULE_CLASS_INVENTORY
                SET wl_count = GREATEST(0, wl_count - 1)
                WHERE schedule_id = v_sched_id AND class_id = v_cls_id;

                UPDATE RESERVATION r
                JOIN BOOKING b ON r.pnr = b.pnr
                SET r.queue_position = CONCAT('WL/', CAST(SUBSTRING_INDEX(r.queue_position, '/', -1) AS UNSIGNED) - 1)
                WHERE r.schedule_id = v_sched_id
                  AND b.class_id = v_cls_id
                  AND r.status = 'WAITING_LIST'
                  AND CAST(SUBSTRING_INDEX(COALESCE(r.queue_position, '0'), '/', -1) AS UNSIGNED) > v_old_wl_num;
            END IF;
        END IF;
    END IF;
END$$

-- -----------------------------------------------------------------------------
-- 4. trg_audit_fare_change
-- Records any update to FARE tables into AUDIT_LOG per BR-A8.
-- -----------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_audit_fare_change$$
CREATE TRIGGER trg_audit_fare_change
AFTER UPDATE ON FARE
FOR EACH ROW
BEGIN
    INSERT INTO AUDIT_LOG (user_id, action, table_name, record_id, old_value, new_value, logged_at)
    VALUES (
        NULL,
        'UPDATE_FARE_RATE',
        'FARE',
        CAST(OLD.fare_id AS CHAR),
        JSON_OBJECT('class_id', OLD.class_id, 'min_km', OLD.min_distance_km, 'max_km', OLD.max_distance_km, 'rate_per_km', OLD.rate_per_km),
        JSON_OBJECT('class_id', NEW.class_id, 'min_km', NEW.min_distance_km, 'max_km', NEW.max_distance_km, 'rate_per_km', NEW.rate_per_km),
        NOW()
    );
END$$

-- -----------------------------------------------------------------------------
-- 5. trg_audit_concession_change
-- Records changes to CONCESSION_RULE into AUDIT_LOG per BR-C9, BR-A8.
-- -----------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_audit_concession_change$$
CREATE TRIGGER trg_audit_concession_change
AFTER UPDATE ON CONCESSION_RULE
FOR EACH ROW
BEGIN
    INSERT INTO AUDIT_LOG (user_id, action, table_name, record_id, old_value, new_value, logged_at)
    VALUES (
        NULL,
        'UPDATE_CONCESSION_RULE',
        'CONCESSION_RULE',
        CAST(OLD.rule_id AS CHAR),
        JSON_OBJECT('concession_type', OLD.concession_type, 'discount_pct', OLD.discount_pct, 'is_active', OLD.is_active),
        JSON_OBJECT('concession_type', NEW.concession_type, 'discount_pct', NEW.discount_pct, 'is_active', NEW.is_active),
        NOW()
    );
END$$

-- -----------------------------------------------------------------------------
-- 6. trg_audit_refund_rule_change
-- Records changes to REFUND_RULE into AUDIT_LOG per BR-A8.
-- -----------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_audit_refund_rule_change$$
CREATE TRIGGER trg_audit_refund_rule_change
AFTER UPDATE ON REFUND_RULE
FOR EACH ROW
BEGIN
    INSERT INTO AUDIT_LOG (user_id, action, table_name, record_id, old_value, new_value, logged_at)
    VALUES (
        NULL,
        'UPDATE_REFUND_RULE',
        'REFUND_RULE',
        CAST(OLD.rule_id AS CHAR),
        JSON_OBJECT('min_hours', OLD.min_hours, 'max_hours', OLD.max_hours, 'deduction_pct', OLD.deduction_pct, 'flat_min_charge', OLD.flat_min_charge, 'clerkage', OLD.clerkage),
        JSON_OBJECT('min_hours', NEW.min_hours, 'max_hours', NEW.max_hours, 'deduction_pct', NEW.deduction_pct, 'flat_min_charge', NEW.flat_min_charge, 'clerkage', NEW.clerkage),
        NOW()
    );
END$$

-- -----------------------------------------------------------------------------
-- 7. trg_audit_setting_change
-- Records modifications to system configuration in SETTING table.
-- -----------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_audit_setting_change$$
CREATE TRIGGER trg_audit_setting_change
AFTER UPDATE ON SETTING
FOR EACH ROW
BEGIN
    INSERT INTO AUDIT_LOG (user_id, action, table_name, record_id, old_value, new_value, logged_at)
    VALUES (
        NULL,
        'UPDATE_SETTING',
        'SETTING',
        OLD.setting_key,
        JSON_OBJECT('setting_value', OLD.setting_value),
        JSON_OBJECT('setting_value', NEW.setting_value),
        NOW()
    );
END$$

DELIMITER ;
