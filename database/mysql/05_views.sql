-- =============================================================================
-- Railway Reservation & Management System (MySQL 8.0)
-- File: 05_views.sql
-- Description: Analytical and operational views:
--   1. vw_available_seats_per_run (live availability, RAC and WL per run & class)
--   2. vw_booking_summary (booking metrics, passenger count, revenue per PNR)
--   3. vw_run_occupancy (coach and run level occupancy percentages)
--   4. vw_train_master_schedule (detailed train stops, arrival/departure timetable)
--   5. vw_tdr_refund_summary (claims, verification status, and refund payouts)
-- =============================================================================

USE railway_db;

-- -----------------------------------------------------------------------------
-- 1. vw_available_seats_per_run
-- Shows live available seats, RAC count/capacity, and WL count/capacity per run.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW vw_available_seats_per_run AS
SELECT
    ts.schedule_id,
    t.train_id,
    t.train_number,
    t.display_name AS train_name,
    t.train_type,
    ts.journey_date,
    ts.departure_time,
    ts.status AS schedule_status,
    ts.chart_prepared_at,
    sc.class_code,
    sc.class_name,
    sci.total_seats,
    sci.available_seats,
    sci.rac_capacity,
    sci.rac_count,
    sci.wl_capacity,
    sci.wl_count,
    ROUND((1 - (sci.available_seats / NULLIF(sci.total_seats, 0))) * 100, 2) AS seat_booked_pct
FROM TRAIN_SCHEDULE ts
JOIN TRAIN t ON ts.train_id = t.train_id
JOIN SCHEDULE_CLASS_INVENTORY sci ON ts.schedule_id = sci.schedule_id
JOIN SEAT_CLASS sc ON sci.class_id = sc.class_id;

-- -----------------------------------------------------------------------------
-- 2. vw_booking_summary
-- Provides consolidated PNR details, passenger count, fare breakdown, and payment status.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW vw_booking_summary AS
SELECT
    b.pnr,
    b.user_id,
    u.full_name AS booked_by_user,
    u.email AS user_email,
    b.channel,
    b.quota,
    b.status AS booking_status,
    b.created_at AS booked_at,
    t.train_number,
    t.display_name AS train_name,
    ts.journey_date,
    sc.class_code,
    s_from.station_code AS from_station,
    s_to.station_code AS to_station,
    COUNT(pb.passenger_no) AS passenger_count,
    b.total_fare,
    p.method AS payment_method,
    p.status AS payment_status,
    p.gateway_payment_id
FROM BOOKING b
JOIN USER_ACCOUNT u ON b.user_id = u.user_id
JOIN TRAIN_SCHEDULE ts ON b.schedule_id = ts.schedule_id
JOIN TRAIN t ON ts.train_id = t.train_id
JOIN SEAT_CLASS sc ON b.class_id = sc.class_id
JOIN ROUTE_STOP rs_from ON b.from_stop_id = rs_from.stop_id
JOIN STATION s_from ON rs_from.station_id = s_from.station_id
JOIN ROUTE_STOP rs_to ON b.to_stop_id = rs_to.stop_id
JOIN STATION s_to ON rs_to.station_id = s_to.station_id
LEFT JOIN PASSENGER_BOOKING pb ON b.pnr = pb.pnr
LEFT JOIN PAYMENT p ON b.pnr = p.pnr
GROUP BY
    b.pnr, b.user_id, u.full_name, u.email, b.channel, b.quota,
    b.status, b.created_at, t.train_number, t.display_name,
    ts.journey_date, sc.class_code, s_from.station_code, s_to.station_code,
    b.total_fare, p.method, p.status, p.gateway_payment_id;

-- -----------------------------------------------------------------------------
-- 3. vw_run_occupancy
-- Aggregates confirmed passenger reservations vs total capacity per train run.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW vw_run_occupancy AS
SELECT
    ts.schedule_id,
    t.train_id,
    t.train_number,
    t.display_name AS train_name,
    ts.journey_date,
    SUM(sci.total_seats) AS total_train_capacity,
    SUM(sci.total_seats - sci.available_seats) AS total_seats_booked,
    SUM(sci.available_seats) AS total_seats_available,
    SUM(sci.rac_count) AS total_rac_passengers,
    SUM(sci.wl_count) AS total_wl_passengers,
    ROUND((SUM(sci.total_seats - sci.available_seats) / NULLIF(SUM(sci.total_seats), 0)) * 100, 2) AS occupancy_pct
FROM TRAIN_SCHEDULE ts
JOIN TRAIN t ON ts.train_id = t.train_id
JOIN SCHEDULE_CLASS_INVENTORY sci ON ts.schedule_id = sci.schedule_id
GROUP BY ts.schedule_id, t.train_id, t.train_number, t.display_name, ts.journey_date;

-- -----------------------------------------------------------------------------
-- 4. vw_train_master_schedule
-- Route and timetable schedule showing stops, arrival, departure, offsets, and platforms.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW vw_train_master_schedule AS
SELECT
    t.train_id,
    t.train_number,
    t.display_name AS train_name,
    t.train_type,
    rs.stop_sequence,
    s.station_code,
    s.display_name AS station_name,
    s.city,
    s.state,
    rs.arrival_time,
    rs.departure_time,
    rs.day_offset,
    rs.distance_from_origin,
    rs.platform_number
FROM ROUTE_STOP rs
JOIN TRAIN t ON rs.train_id = t.train_id
JOIN STATION s ON rs.station_id = s.station_id;

-- -----------------------------------------------------------------------------
-- 5. vw_tdr_refund_summary
-- Summary of TDR filings, review outcomes, and refund disbursement status.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW vw_tdr_refund_summary AS
SELECT
    tf.tdr_ref_no,
    tf.pnr,
    tf.reason AS tdr_reason,
    tf.filed_at,
    tf.status AS filing_status,
    tf.refund_amount,
    tf.reviewed_by AS reviewed_by_admin_id,
    u.full_name AS reviewed_by_admin_name,
    tf.reviewed_at,
    r.refund_id,
    r.status AS refund_disbursement_status
FROM TDR_FILING tf
LEFT JOIN ADMIN a ON tf.reviewed_by = a.admin_id
LEFT JOIN USER_ACCOUNT u ON a.user_id = u.user_id
LEFT JOIN REFUND r ON tf.tdr_ref_no = r.tdr_ref_no;
