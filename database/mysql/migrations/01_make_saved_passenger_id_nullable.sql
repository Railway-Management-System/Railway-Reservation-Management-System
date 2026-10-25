-- =============================================================================
-- Migration: Make PASSENGER_BOOKING.saved_passenger_id nullable
-- Reason: Allows ad-hoc passengers to be booked without associating an arbitrary
--         saved-passenger profile or violating foreign key constraints.
-- Target Table: PASSENGER_BOOKING
-- Constraint: fk_pb_saved_passenger -> SAVED_PASSENGER(passenger_id) ON DELETE SET NULL
-- Note: Do NOT execute automatically without explicit review and approval.
-- =============================================================================

USE railway_db;

-- 1. Drop existing foreign key constraint
ALTER TABLE PASSENGER_BOOKING
  DROP FOREIGN KEY fk_pb_saved_passenger;

-- 2. Modify saved_passenger_id column to allow NULL
ALTER TABLE PASSENGER_BOOKING
  MODIFY saved_passenger_id INT NULL;

-- 3. Re-add foreign key with ON DELETE SET NULL
ALTER TABLE PASSENGER_BOOKING
  ADD CONSTRAINT fk_pb_saved_passenger
  FOREIGN KEY (saved_passenger_id) REFERENCES SAVED_PASSENGER (passenger_id)
  ON DELETE SET NULL;
