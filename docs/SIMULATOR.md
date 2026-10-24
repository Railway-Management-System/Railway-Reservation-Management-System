# Railway Reservation Management System - Daily Operations Simulator

## 1. Overview

The Daily Operations Simulator (`backend/scripts/simulate-daily.js`) is an automated system service designed to maintain the continuous lifecycle of railway operations across a rolling 7-day operational window (`today` to `today + 6`). 

It automates:
1. **Schedule & Capacity Synchronization**: Creates missing train runs for active operating days, allocating coach statuses and class inventories.
2. **Realistic Booking Generation**: Generates passenger bookings on newly rolled dates using stored procedures (`sp_create_booking`), adhering to the approved fill distribution pattern of `demo_fill_plan.csv`.
3. **Random Passenger Cancellations**: Simulates real-world passenger cancellations on future runs via `sp_cancel_passenger_ticket`.
4. **Chart Preparation**: Automatically prepares charts for runs within 8 hours of origin departure via `prepareChartForSchedule`.
5. **Master Inventory Verification**: Audits every class inventory row across all active schedules, asserting 0 mismatches against raw reservation states.

---

## 2. Operational Rolling Window & Mechanics

```
      [Past / Archived]          [Current Operational Window: 7 Days]
  ... ------------------------ [ Today ] -> [ +1 ] -> [ +2 ] -> [ +3 ] -> [ +4 ] -> [ +5 ] -> [ +6 ]
                                   │
                                   ├── Chart Preparation (<= 8h to departure)
                                   ├── Missing Runs Provisioning
                                   ├── Booking Generation for New Days
                                   └── Real-time Inventory Audit (0 mismatches)
```

### 2.1 Schedule Creation
For each date in the window `[today, ..., today + 6]`, the simulator checks each active train in the `TRAIN` table. If the train operates on that weekday (per `running_days` JSON array), it invokes `ensureRunExists(pool, trainId, dateStr)`:
- Inserts `TRAIN_SCHEDULE` with origin departure time.
- Inserts `RUN_COACH_STATUS` for each coach mapped to the train (`IN_SERVICE`).
- Inserts `SCHEDULE_CLASS_INVENTORY` establishing total seats, available seats, RAC capacity (10% on sleeper/AC classes), and WL capacity (25%).

### 2.2 Idempotent Booking Generation
- When a day first enters the window (or when database is loaded), up to 8 representative train schedules on that day are selected for booking generation.
- Bookings are created exclusively via `CALL sp_create_booking(..., p_manage_tx = 1, p_hold_for_payment = 0)`.
- Associated `PAYMENT` records are recorded (`status = 'SUCCESS'`, `paid_at = NOW()`).
- The remaining runs remain empty, strictly matching the production benchmark established in `demo_fill_plan.csv`.
- **Idempotency**: If the simulator is executed multiple times on the same date, existing bookings and schedules are detected; exactly 0 duplicate schedules, 0 duplicate bookings, and 0 duplicate charts are created.

### 2.3 Automated Chart Preparation
- Queries all schedules where `chart_prepared_at IS NULL` and `TIMESTAMP(journey_date, departure_time) <= NOW() + INTERVAL 8 HOUR`.
- Invokes `prepareChartForSchedule(scheduleId, p_manage_tx = 1)`.
- Executes RAC promotions to confirmed seats, waitlist purge with automatic refunds (`WAITLIST_PURGE`), and stores chart snapshots in MongoDB.

### 2.4 Master Inventory Audit
After operations conclude, the simulator runs `auditInventory(pool)`:
$$\text{Expected Available Seats} = \text{Total Seats} - \sum (\text{CONFIRMED} + \text{BOARDED})$$
$$\text{Expected RAC Count} = \sum \text{RAC}$$
$$\text{Expected WL Count} = \sum \text{WAITING\_LIST}$$
The audit verifies that actual values in `SCHEDULE_CLASS_INVENTORY` match calculated reservation totals with **0 mismatches**.

---

## 3. Usage & CLI Options

### 3.1 Direct Execution
```bash
# Run simulator using current local machine date
node backend/scripts/simulate-daily.js

# Run simulator with explicit reference date (test-only override)
node backend/scripts/simulate-daily.js --today=2026-10-26
```

### 3.2 NPM Scripts (from `backend/`)
```bash
# Run daily simulation
npm run simulate:daily

# Full demo refresh: resets database to seed baseline, then runs simulation
npm run demo:refresh

# Run test suite D4 validating simulator & idempotency
npm run test:d4
```

### 3.3 Batch File Execution
From repository root:
```cmd
.\run-simulator.bat
```
Supports passing arguments, e.g.:
```cmd
.\run-simulator.bat --today=2026-10-26
```

---

## 4. Windows Task Scheduler Setup Guide

Follow these steps to schedule the simulator to run automatically every night at **00:05 AM**:

### Step 1: Open Windows Task Scheduler
1. Press `Win + R` on your keyboard to open the **Run** dialog.
2. Type `taskschd.msc` and press **Enter** (or search for "Task Scheduler" in the Windows Start Menu).

### Step 2: Create a New Task
1. In the right-hand **Actions** pane, click **Create Task...** (do not click "Create Basic Task", as full task allows advanced security settings).
2. On the **General** tab:
   - **Name**: `RailwayDailySimulator`
   - **Description**: `Automated daily rolling window operations simulator for Railway Reservation System`
   - **Security options**:
     - Select **Run whether user is logged on or not**.
     - Check **Run with highest privileges**.
     - Configure for: **Windows 10 / Windows 11**.

### Step 3: Configure Daily Trigger
1. Click the **Triggers** tab, then click **New...**.
2. **Begin the task**: `On a schedule`.
3. Under **Settings**:
   - Select **Daily**.
   - **Start date**: Today's date.
   - **Start time**: `00:05:00` (5 minutes past midnight).
   - **Recur every**: `1` days.
4. Under **Advanced settings**:
   - Check **Enabled**.
   - Click **OK**.

### Step 4: Configure Action (Run Batch File)
1. Click the **Actions** tab, then click **New...**.
2. **Action**: `Start a program`.
3. In **Program/script**, enter the absolute path to `run-simulator.bat`:
   ```
   C:\Users\Ved\OneDrive\Documents\GitHub\Railway-Reservation-Management-System\run-simulator.bat
   ```
4. In **Start in (optional)**, enter the absolute repository root directory:
   ```
   C:\Users\Ved\OneDrive\Documents\GitHub\Railway-Reservation-Management-System
   ```
   *(Note: Setting "Start in" is mandatory so that relative module paths resolve properly).*
5. Click **OK**.

### Step 5: Configure Conditions & Settings
1. On the **Conditions** tab:
   - Uncheck **Start the task only if the computer is on AC power** (ensures it runs on laptops on battery).
   - Check **Wake the computer to run this task** (optional, if server/machine sleeps).
2. On the **Settings** tab:
   - Check **Allow task to be run on demand**.
   - Check **Run task as soon as possible after a scheduled start is missed**.
   - If the task fails, restart every: `10 minutes`, up to `3 times`.
   - Check **Do not start a new instance if already running** (Stop the existing instance or Do not start a new instance).
3. Click **OK**.
4. When prompted, enter your Windows user password to authorize background execution.

### Step 6: Verify and Test
1. In the Task Scheduler library, locate `RailwayDailySimulator`.
2. Right-click the task and select **Run**.
3. Confirm that the **Last Run Result** shows `The operation completed successfully. (0x0)`.
