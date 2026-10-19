-- =============================================================================
-- Railway Reservation & Management System (MySQL 8.0)
-- File: 06_reports.sql
-- Description: Advanced analytical reports leveraging MySQL 8.0 window functions:
--   1. Top Busiest Trains ranked by total passengers booked (RANK & DENSE_RANK)
--   2. Top Routes Ranked by Revenue (DENSE_RANK across route origin-dest pairs)
--   3. Rank of Stations by Total Passenger Boardings and Terminations (RANK)
--   4. Class-wise Revenue, Volume and Cumulative Share (Window running sum & total share)
--   5. Quota Utilization and Demand Spread (RANK)
--
-- Accounting Rule Applied:
--   Counts passengers strictly by their OWN reservation status ('CONFIRMED', 'RAC', 'BOARDED'),
--   regardless of overall booking status, so confirmed passengers inside a WL-status booking
--   are properly included.
-- =============================================================================

USE railway_db;

-- -----------------------------------------------------------------------------
-- Report 1: Top Busiest Trains Ranked by Passenger Count
-- -----------------------------------------------------------------------------
SELECT
    RANK() OVER (ORDER BY COUNT(pb.passenger_no) DESC) AS rank_pos,
    DENSE_RANK() OVER (ORDER BY COUNT(pb.passenger_no) DESC) AS dense_rank_pos,
    t.train_id,
    t.train_number,
    t.display_name AS train_name,
    t.train_type,
    COUNT(DISTINCT ts.schedule_id) AS total_runs_conducted,
    COUNT(pb.passenger_no) AS total_passengers_booked,
    ROUND(SUM(pb.total_fare), 2) AS total_revenue
FROM TRAIN t
JOIN TRAIN_SCHEDULE ts ON t.train_id = ts.train_id
JOIN BOOKING b ON ts.schedule_id = b.schedule_id
JOIN PASSENGER_BOOKING pb ON b.pnr = pb.pnr
JOIN RESERVATION r ON pb.pnr = r.pnr AND pb.passenger_no = r.passenger_no
WHERE r.status IN ('CONFIRMED', 'RAC', 'BOARDED')
GROUP BY t.train_id, t.train_number, t.display_name, t.train_type
ORDER BY rank_pos ASC
LIMIT 15;

-- -----------------------------------------------------------------------------
-- Report 2: Top Routes Ranked by Gross Revenue
-- -----------------------------------------------------------------------------
SELECT
    DENSE_RANK() OVER (ORDER BY SUM(pb.total_fare) DESC) AS revenue_rank,
    s_from.station_code AS origin_code,
    s_from.display_name AS origin_station,
    s_to.station_code AS destination_code,
    s_to.display_name AS destination_station,
    COUNT(DISTINCT b.pnr) AS total_bookings_count,
    ROUND(SUM(pb.total_fare), 2) AS gross_route_revenue,
    ROUND(AVG(pb.total_fare), 2) AS avg_fare_per_passenger
FROM BOOKING b
JOIN PASSENGER_BOOKING pb ON b.pnr = pb.pnr
JOIN RESERVATION r ON pb.pnr = r.pnr AND pb.passenger_no = r.passenger_no
JOIN ROUTE_STOP rs_from ON b.from_stop_id = rs_from.stop_id
JOIN STATION s_from ON rs_from.station_id = s_from.station_id
JOIN ROUTE_STOP rs_to ON b.to_stop_id = rs_to.stop_id
JOIN STATION s_to ON rs_to.station_id = s_to.station_id
WHERE r.status IN ('CONFIRMED', 'RAC', 'BOARDED')
GROUP BY s_from.station_code, s_from.display_name, s_to.station_code, s_to.display_name
ORDER BY revenue_rank ASC
LIMIT 15;

-- -----------------------------------------------------------------------------
-- Report 3: Rank of Stations by Total Passenger Boardings
-- -----------------------------------------------------------------------------
SELECT
    RANK() OVER (ORDER BY COUNT(pb.passenger_no) DESC) AS station_rank,
    s.station_id,
    s.station_code,
    s.display_name AS station_name,
    s.city,
    s.state,
    COUNT(pb.passenger_no) AS total_boarding_passengers,
    ROUND(SUM(pb.total_fare), 2) AS originating_revenue
FROM STATION s
JOIN ROUTE_STOP rs ON s.station_id = rs.station_id
JOIN BOOKING b ON rs.stop_id = b.from_stop_id
JOIN PASSENGER_BOOKING pb ON b.pnr = pb.pnr
JOIN RESERVATION r ON pb.pnr = r.pnr AND pb.passenger_no = r.passenger_no
WHERE r.status IN ('CONFIRMED', 'RAC', 'BOARDED')
GROUP BY s.station_id, s.station_code, s.display_name, s.city, s.state
ORDER BY station_rank ASC
LIMIT 20;

-- -----------------------------------------------------------------------------
-- Report 4: Class-wise Revenue, Volume and Cumulative Share
-- -----------------------------------------------------------------------------
SELECT
    sc.class_code,
    sc.class_name,
    COUNT(pb.passenger_no) AS total_passengers,
    ROUND(SUM(pb.total_fare), 2) AS class_revenue,
    ROUND(SUM(SUM(pb.total_fare)) OVER (ORDER BY SUM(pb.total_fare) DESC), 2) AS running_cumulative_revenue,
    ROUND((SUM(pb.total_fare) / SUM(SUM(pb.total_fare)) OVER ()) * 100, 2) AS revenue_pct_share
FROM SEAT_CLASS sc
JOIN BOOKING b ON sc.class_id = b.class_id
JOIN PASSENGER_BOOKING pb ON b.pnr = pb.pnr
JOIN RESERVATION r ON pb.pnr = r.pnr AND pb.passenger_no = r.passenger_no
WHERE r.status IN ('CONFIRMED', 'RAC', 'BOARDED')
GROUP BY sc.class_code, sc.class_name
ORDER BY class_revenue DESC;

-- -----------------------------------------------------------------------------
-- Report 5: Quota Utilization and Demand Spread
-- -----------------------------------------------------------------------------
SELECT
    b.quota,
    COUNT(DISTINCT b.pnr) AS total_bookings,
    COUNT(pb.passenger_no) AS total_passengers,
    ROUND(SUM(pb.total_fare), 2) AS total_fare_collected,
    ROUND(AVG(pb.total_fare), 2) AS avg_passenger_fare,
    RANK() OVER (ORDER BY COUNT(pb.passenger_no) DESC) AS quota_popularity_rank
FROM BOOKING b
JOIN PASSENGER_BOOKING pb ON b.pnr = pb.pnr
JOIN RESERVATION r ON pb.pnr = r.pnr AND pb.passenger_no = r.passenger_no
WHERE r.status IN ('CONFIRMED', 'RAC', 'BOARDED')
GROUP BY b.quota
ORDER BY quota_popularity_rank ASC;
