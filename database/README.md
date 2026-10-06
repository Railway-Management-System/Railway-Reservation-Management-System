# Database Design & MySQL Implementation Guide

Welcome to the database directory of the **Railway Reservation & Management System**.

> **Current Stage Note**:
> Physical database creation in MySQL is scheduled for **Phase 3**. The relational specifications, schema dictionaries, and foreign key rules are fully documented in `docs/DATA_SCHEMA.md` and `docs/DATA_RELATIONSHIPS.md`.

---

## 1. Relational Database Architecture

The system is designed for **MySQL 8.0+** utilizing the **InnoDB** storage engine to guarantee ACID transaction properties for financial transactions and seat reservations.

### Normalization Level
- **Third Normal Form (3NF) / Boyce-Codd Normal Form (BCNF)**:
  - Eliminates all repeating groups (1NF).
  - Ensures every non-key attribute is fully functionally dependent on the primary key (2NF).
  - Eliminates all transitive dependencies (3NF).

---

## 2. Planned Tables & Constraints

The future MySQL schema will construct the following normalized tables:

1. `users` (`user_id`, `name`, `email`, `phone`, `role`, `account_status`, `created_at`)
2. `passengers` (`passenger_id`, `user_id`, `name`, `age`, `gender`, `id_proof_type`, `id_proof_reference`, `disability_type`, `concession_type`, `berth_preference`)
3. `staff` (`staff_id`, `user_id`, `employee_id`, `name`, `designation`, `assigned_station_id`, `status`)
4. `stations` (`station_id`, `station_code`, `station_name`, `city`, `state`)
5. `trains` (`train_id`, `train_number`, `train_name`, `train_type`, `source_station_id`, `destination_station_id`, `running_days`, `status`)
6. `routes` (`route_id`, `train_id`, `station_id`, `stop_sequence`, `arrival_time`, `departure_time`, `distance_from_origin`, `platform_number`)
7. `schedules` (`schedule_id`, `train_id`, `journey_date`, `status`, `delay_minutes`)
8. `coaches` (`coach_id`, `train_id`, `coach_number`, `coach_type`, `class_type`)
9. `seats` (`seat_id`, `coach_id`, `seat_number`, `berth_type`, `seat_status`)
10. `availability` (`availability_id`, `train_id`, `journey_date`, `class_type`, `quota`, `available_seats`, `rac_count`, `waiting_list_count`)
11. `bookings` (`booking_id`, `pnr`, `user_id`, `train_id`, `journey_date`, `boarding_station_id`, `destination_station_id`, `class_type`, `quota`, `booking_status`, `total_fare`, `created_at`)
12. `booking_passengers` (`booking_passenger_id`, `booking_id`, `passenger_id`, `coach_number`, `seat_number`, `berth_type`, `passenger_status`)
13. `payments` (`payment_id`, `booking_id`, `amount`, `payment_mode`, `payment_status`, `gateway_transaction_id`, `paid_at`)
14. `cancellations` (`cancellation_id`, `booking_id`, `passenger_id`, `cancellation_date`, `cancellation_charge`, `refund_amount`, `status`)
15. `tdr` (`tdr_id`, `booking_id`, `pnr`, `reason`, `submitted_at`, `status`, `refund_amount`)
16. `notifications` (`notification_id`, `user_id`, `type`, `title`, `message`, `reference_id`, `is_read`, `created_at`)
17. `grievances` (`grievance_id`, `user_id`, `category`, `subject`, `description`, `status`, `response`, `created_at`)
18. `fines` (`fine_id`, `staff_id`, `passenger_name`, `id_proof_reference`, `train_id`, `amount`, `reason`, `payment_status`, `issued_at`)
19. `incidents` (`incident_id`, `reported_by`, `type`, `severity`, `location_type`, `station_id`, `train_id`, `description`, `status`, `created_at`)
20. `crowd_reports` (`crowd_report_id`, `station_id`, `platform_number`, `crowd_level`, `head_count`, `recorded_by`, `recorded_at`)
21. `cleanliness_reports` (`report_id`, `reported_by`, `train_id`, `coach_id`, `station_id`, `platform_number`, `issue_type`, `description`, `status`, `created_at`)
22. `audit_logs` (`audit_id`, `user_id`, `action`, `entity_type`, `entity_id`, `old_value`, `new_value`, `created_at`)

---

## 3. Advanced DBMS Features to Implement in Phase 3

### Stored Procedures
- `sp_check_seat_segment_overlap`: Checks if an allocated seat intersects a passenger's journey $[s_{\text{board}}, s_{\text{dest}})$.
- `sp_promote_rac_waitlist`: Automatically promotes the next eligible RAC passenger to a confirmed berth upon cancellation.

### Triggers
- `trg_audit_master_changes`: Logs changes on critical tables (`trains`, `schedules`, `fares`) directly into `audit_logs`.
- `trg_update_availability_on_booking`: Automatically decrements `available_seats` in `availability` table upon booking confirmation.

### Database Seeding
The database will be populated by running a seed script directly from the standardized JSON records in `mock-data/`.
