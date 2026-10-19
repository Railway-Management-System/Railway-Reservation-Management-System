const fs = require('fs');
const path = require('path');
const readline = require('readline');
const xlsx = require('xlsx');
const {
  SEED_MYSQL_DIR,
  SEED_MONGODB_DIR,
  DATASETS_DIR,
  writeCsv: rawWriteCsv,
  writeJson: rawWriteJson,
  createRng
} = require('./helpers');

function writeCsv(filePath, headers, rows) {
  const onlyInventory = process.argv.includes('--only-inventory') || process.env.ONLY_INVENTORY === '1';
  if (onlyInventory && !filePath.endsWith('SCHEDULE_CLASS_INVENTORY.csv')) return;
  rawWriteCsv(filePath, headers, rows);
}

function writeJson(filePath, data) {
  const onlyInventory = process.argv.includes('--only-inventory') || process.env.ONLY_INVENTORY === '1';
  if (onlyInventory) return;
  rawWriteJson(filePath, data);
}

function runStep3() {
  console.log('=== Step 3: Generating Operational Infrastructure & Bookings ===');
  const rng = createRng(42); // FIXED random seed for determinism

  // 1. Static Rule Tables & Master Settings
  console.log('Generating master rules and settings...');

  // SEAT_CLASS
  const seatClasses = [
    { class_id: 1, class_code: '1A', class_name: 'AC First Class', coach_type: 'AC', has_berths: 1, base_multiplier: 5.40 },
    { class_id: 2, class_code: '2A', class_name: 'AC 2 Tier', coach_type: 'AC', has_berths: 1, base_multiplier: 3.20 },
    { class_id: 3, class_code: '3A', class_name: 'AC 3 Tier', coach_type: 'AC', has_berths: 1, base_multiplier: 2.20 },
    { class_id: 4, class_code: 'SL', class_name: 'Sleeper', coach_type: 'NON_AC', has_berths: 1, base_multiplier: 0.85 },
    { class_id: 5, class_code: 'CC', class_name: 'AC Chair Car', coach_type: 'AC', has_berths: 0, base_multiplier: 1.90 },
    { class_id: 6, class_code: 'EC', class_name: 'Executive Chair Car', coach_type: 'AC', has_berths: 0, base_multiplier: 3.60 },
    { class_id: 7, class_code: '2S', class_name: 'Second Sitting', coach_type: 'NON_AC', has_berths: 0, base_multiplier: 0.55 }
  ];
  writeCsv(
    path.join(SEED_MYSQL_DIR, 'SEAT_CLASS.csv'),
    ['class_id', 'class_code', 'class_name', 'coach_type', 'has_berths', 'base_multiplier'],
    seatClasses
  );

  // FARE slabs
  const fareSlabs = [
    // 2S
    { fare_id: 1, class_id: 7, min_distance_km: 0, max_distance_km: 300, rate_per_km: 0.55 },
    { fare_id: 2, class_id: 7, min_distance_km: 301, max_distance_km: 700, rate_per_km: 0.48 },
    { fare_id: 3, class_id: 7, min_distance_km: 701, max_distance_km: 1300, rate_per_km: 0.42 },
    { fare_id: 4, class_id: 7, min_distance_km: 1301, max_distance_km: 10000, rate_per_km: 0.38 },
    // SL
    { fare_id: 5, class_id: 4, min_distance_km: 0, max_distance_km: 300, rate_per_km: 0.85 },
    { fare_id: 6, class_id: 4, min_distance_km: 301, max_distance_km: 700, rate_per_km: 0.72 },
    { fare_id: 7, class_id: 4, min_distance_km: 701, max_distance_km: 1300, rate_per_km: 0.62 },
    { fare_id: 8, class_id: 4, min_distance_km: 1301, max_distance_km: 10000, rate_per_km: 0.55 },
    // 3A
    { fare_id: 9, class_id: 3, min_distance_km: 0, max_distance_km: 300, rate_per_km: 2.20 },
    { fare_id: 10, class_id: 3, min_distance_km: 301, max_distance_km: 700, rate_per_km: 1.90 },
    { fare_id: 11, class_id: 3, min_distance_km: 701, max_distance_km: 1300, rate_per_km: 1.55 },
    { fare_id: 12, class_id: 3, min_distance_km: 1301, max_distance_km: 10000, rate_per_km: 1.34 },
    // 2A
    { fare_id: 13, class_id: 2, min_distance_km: 0, max_distance_km: 300, rate_per_km: 3.20 },
    { fare_id: 14, class_id: 2, min_distance_km: 301, max_distance_km: 700, rate_per_km: 2.75 },
    { fare_id: 15, class_id: 2, min_distance_km: 701, max_distance_km: 1300, rate_per_km: 2.25 },
    { fare_id: 16, class_id: 2, min_distance_km: 1301, max_distance_km: 10000, rate_per_km: 1.95 },
    // 1A
    { fare_id: 17, class_id: 1, min_distance_km: 0, max_distance_km: 300, rate_per_km: 5.40 },
    { fare_id: 18, class_id: 1, min_distance_km: 301, max_distance_km: 700, rate_per_km: 4.60 },
    { fare_id: 19, class_id: 1, min_distance_km: 701, max_distance_km: 1300, rate_per_km: 3.80 },
    { fare_id: 20, class_id: 1, min_distance_km: 1301, max_distance_km: 10000, rate_per_km: 3.30 },
    // CC
    { fare_id: 21, class_id: 5, min_distance_km: 0, max_distance_km: 300, rate_per_km: 1.90 },
    { fare_id: 22, class_id: 5, min_distance_km: 301, max_distance_km: 700, rate_per_km: 1.65 },
    { fare_id: 23, class_id: 5, min_distance_km: 701, max_distance_km: 1300, rate_per_km: 1.40 },
    { fare_id: 24, class_id: 5, min_distance_km: 1301, max_distance_km: 10000, rate_per_km: 1.20 },
    // EC
    { fare_id: 25, class_id: 6, min_distance_km: 0, max_distance_km: 300, rate_per_km: 3.60 },
    { fare_id: 26, class_id: 6, min_distance_km: 301, max_distance_km: 700, rate_per_km: 3.15 },
    { fare_id: 27, class_id: 6, min_distance_km: 701, max_distance_km: 1300, rate_per_km: 2.70 },
    { fare_id: 28, class_id: 6, min_distance_km: 1301, max_distance_km: 10000, rate_per_km: 2.35 }
  ];
  writeCsv(
    path.join(SEED_MYSQL_DIR, 'FARE.csv'),
    ['fare_id', 'class_id', 'min_distance_km', 'max_distance_km', 'rate_per_km'],
    fareSlabs
  );

  // CONCESSION_RULE
  const concessionRules = [
    { rule_id: 1, concession_type: 'DIVYAANG', class_id: 4, train_group: 'STANDARD', discount_pct: 75.00, proof_types: '["RAILWAY_DIVYANGJAN_ID", "UDID", "CONCESSION_CERTIFICATE"]', is_active: 1 },
    { rule_id: 2, concession_type: 'DIVYAANG', class_id: 7, train_group: 'STANDARD', discount_pct: 75.00, proof_types: '["RAILWAY_DIVYANGJAN_ID", "UDID", "CONCESSION_CERTIFICATE"]', is_active: 1 },
    { rule_id: 3, concession_type: 'DIVYAANG', class_id: 3, train_group: 'STANDARD', discount_pct: 75.00, proof_types: '["RAILWAY_DIVYANGJAN_ID", "UDID", "CONCESSION_CERTIFICATE"]', is_active: 1 },
    { rule_id: 4, concession_type: 'DIVYAANG', class_id: 5, train_group: 'STANDARD', discount_pct: 75.00, proof_types: '["RAILWAY_DIVYANGJAN_ID", "UDID", "CONCESSION_CERTIFICATE"]', is_active: 1 },
    { rule_id: 5, concession_type: 'DIVYAANG', class_id: 1, train_group: 'STANDARD', discount_pct: 50.00, proof_types: '["RAILWAY_DIVYANGJAN_ID", "UDID", "CONCESSION_CERTIFICATE"]', is_active: 1 },
    { rule_id: 6, concession_type: 'DIVYAANG', class_id: 2, train_group: 'STANDARD', discount_pct: 50.00, proof_types: '["RAILWAY_DIVYANGJAN_ID", "UDID", "CONCESSION_CERTIFICATE"]', is_active: 1 },
    { rule_id: 7, concession_type: 'DIVYAANG', class_id: 6, train_group: 'STANDARD', discount_pct: 0.00, proof_types: '["RAILWAY_DIVYANGJAN_ID", "UDID", "CONCESSION_CERTIFICATE"]', is_active: 0 },
    // Premium train group (Rajdhani, Shatabdi, Duronto)
    { rule_id: 8, concession_type: 'DIVYAANG', class_id: 3, train_group: 'PREMIUM', discount_pct: 25.00, proof_types: '["RAILWAY_DIVYANGJAN_ID", "UDID", "CONCESSION_CERTIFICATE"]', is_active: 1 },
    { rule_id: 9, concession_type: 'DIVYAANG', class_id: 5, train_group: 'PREMIUM', discount_pct: 25.00, proof_types: '["RAILWAY_DIVYANGJAN_ID", "UDID", "CONCESSION_CERTIFICATE"]', is_active: 1 },
    // Senior Citizen (Inactive)
    { rule_id: 10, concession_type: 'SENIOR_CITIZEN', class_id: 4, train_group: 'STANDARD', discount_pct: 0.00, proof_types: '["AADHAAR", "PAN", "PASSPORT"]', is_active: 0 },
    { rule_id: 11, concession_type: 'SENIOR_CITIZEN', class_id: 3, train_group: 'STANDARD', discount_pct: 0.00, proof_types: '["AADHAAR", "PAN", "PASSPORT"]', is_active: 0 },
    { rule_id: 12, concession_type: 'SENIOR_CITIZEN', class_id: 2, train_group: 'STANDARD', discount_pct: 0.00, proof_types: '["AADHAAR", "PAN", "PASSPORT"]', is_active: 0 },
    { rule_id: 13, concession_type: 'SENIOR_CITIZEN', class_id: 1, train_group: 'STANDARD', discount_pct: 0.00, proof_types: '["AADHAAR", "PAN", "PASSPORT"]', is_active: 0 }
  ];
  writeCsv(
    path.join(SEED_MYSQL_DIR, 'CONCESSION_RULE.csv'),
    ['rule_id', 'concession_type', 'class_id', 'train_group', 'discount_pct', 'proof_types', 'is_active'],
    concessionRules
  );

  // REFUND_RULE
  const refundRules = [
    { rule_id: 1, min_hours: 72, max_hours: null, deduction_pct: 0.00, flat_min_charge: 240.00, clerkage: 60.00 },
    { rule_id: 2, min_hours: 24, max_hours: 72, deduction_pct: 25.00, flat_min_charge: 200.00, clerkage: 60.00 },
    { rule_id: 3, min_hours: 8, max_hours: 24, deduction_pct: 50.00, flat_min_charge: 180.00, clerkage: 60.00 },
    { rule_id: 4, min_hours: 0, max_hours: 8, deduction_pct: 100.00, flat_min_charge: 120.00, clerkage: 60.00 }
  ];
  writeCsv(
    path.join(SEED_MYSQL_DIR, 'REFUND_RULE.csv'),
    ['rule_id', 'min_hours', 'max_hours', 'deduction_pct', 'flat_min_charge', 'clerkage'],
    refundRules
  );

  // TDR_RULE
  const tdrRules = [
    { rule_id: 1, reason_code: 'TRAIN_DELAYED_OVER_3_HOURS', description: 'Train delayed over 3 hours at boarding station', deadline_hours: 0, requires_verification: 0, refund_pct: 100.00 },
    { rule_id: 2, reason_code: 'TRAIN_DIVERTED', description: 'Train diverted and passenger not willing to travel', deadline_hours: 0, requires_verification: 0, refund_pct: 100.00 },
    { rule_id: 3, reason_code: 'CLASS_DOWNGRADED', description: 'Class downgraded and passenger not willing to travel', deadline_hours: 72, requires_verification: 1, refund_pct: 100.00 },
    { rule_id: 4, reason_code: 'AC_FAILURE', description: 'AC failure in coach for significant duration', deadline_hours: 72, requires_verification: 1, refund_pct: 30.00 },
    { rule_id: 5, reason_code: 'COACH_NOT_ATTACHED', description: 'Reserved coach not attached to train', deadline_hours: 72, requires_verification: 1, refund_pct: 100.00 },
    { rule_id: 6, reason_code: 'TRAIN_TERMINATED_SHORT', description: 'Train terminated short of destination', deadline_hours: 72, requires_verification: 1, refund_pct: 100.00 }
  ];
  writeCsv(
    path.join(SEED_MYSQL_DIR, 'TDR_RULE.csv'),
    ['rule_id', 'reason_code', 'description', 'deadline_hours', 'requires_verification', 'refund_pct'],
    tdrRules
  );

  // SETTING
  const settingsRows = [
    { setting_key: 'BOOKING_WINDOW_DAYS', setting_value: '7', description: 'Advance booking window in days', updated_at: '2026-10-18 00:00:00' },
    { setting_key: 'HOLD_MINUTES', setting_value: '10', description: 'Seat hold duration in minutes', updated_at: '2026-10-18 00:00:00' },
    { setting_key: 'MAX_PASSENGERS_PER_PNR', setting_value: '6', description: 'Maximum passengers per standard booking', updated_at: '2026-10-18 00:00:00' },
    { setting_key: 'MAX_PASSENGERS_PER_PNR_TATKAL', setting_value: '4', description: 'Maximum passengers per Tatkal booking', updated_at: '2026-10-18 00:00:00' },
    { setting_key: 'MAX_TICKETS_PER_MONTH', setting_value: '12', description: 'Monthly booking limit for unverified users', updated_at: '2026-10-18 00:00:00' },
    { setting_key: 'MAX_TICKETS_PER_MONTH_AADHAAR_VERIFIED', setting_value: '24', description: 'Monthly booking limit for Aadhaar verified users', updated_at: '2026-10-18 00:00:00' },
    { setting_key: 'CHART_HOURS_BEFORE_ORIGIN_DEPARTURE', setting_value: '8', description: 'Hours before origin departure when chart prepares', updated_at: '2026-10-18 00:00:00' },
    { setting_key: 'CLERKAGE_PER_PASSENGER', setting_value: '60.00', description: 'Cancellation clerkage fee for RAC/WL', updated_at: '2026-10-18 00:00:00' },
    { setting_key: 'CONCESSION_SENIOR_ENABLED', setting_value: 'false', description: 'Senior citizen concession active flag', updated_at: '2026-10-18 00:00:00' },
    { setting_key: 'DYNAMIC_FARE_ENABLED', setting_value: 'false', description: 'BR-F11 dynamic Tatkal surcharge flag', updated_at: '2026-10-18 00:00:00' },
    { setting_key: 'MIN_CHARGEABLE_DISTANCE_KM', setting_value: '100', description: 'Minimum billable distance slab', updated_at: '2026-10-18 00:00:00' },
    { setting_key: 'INSURANCE_PREMIUM_PER_PASSENGER', setting_value: '0.45', description: 'Optional travel insurance charge', updated_at: '2026-10-18 00:00:00' },
    { setting_key: 'GST_RATE_AC', setting_value: '0.05', description: 'GST rate on AC travel classes', updated_at: '2026-10-18 00:00:00' }
  ];
  writeCsv(
    path.join(SEED_MYSQL_DIR, 'SETTING.csv'),
    ['setting_key', 'setting_value', 'description', 'updated_at'],
    settingsRows
  );

  // 2. COACH & SEAT Tables
  console.log('Generating COACH and SEAT tables across all 60 trains...');
  const wbTrains = xlsx.readFile(path.join(DATASETS_DIR, 'final_trains_60.xlsx'));
  const rawTrains = xlsx.utils.sheet_to_json(wbTrains.Sheets[wbTrains.SheetNames[0]]);

  const rajTypes = [117, 118, 125, 126, 127, 128, 132, 135, 136];
  const shatTypes = [139, 140, 141, 142, 145, 146, 147, 148, 151, 152];
  const durTypes = [105, 106, 157, 158];

  const coachRows = [];
  const seatRows = [];
  let coachIdCounter = 1;
  let seatIdCounter = 1;

  // Layout templates per train type:
  // RAJDHANI: 1A x 1, 2A x 4, 3A x 10 (total 15 coaches)
  // SHATABDI: EC x 1, CC x 10 (total 11 coaches)
  // DURONTO: 1A x 1, 2A x 2, 3A x 6, SL x 6 (total 15 coaches)

  for (const t of rawTrains) {
    let tType = t.trainType;
    if (rajTypes.includes(t.trainId)) tType = 'RAJDHANI';
    else if (shatTypes.includes(t.trainId)) tType = 'SHATABDI';
    else if (durTypes.includes(t.trainId)) tType = 'DURONTO';

    let coachDef = [];
    if (tType === 'RAJDHANI') {
      coachDef.push({ code: 'H1', classId: 1, count: 24, classCode: '1A' });
      for (let i = 1; i <= 4; i++) coachDef.push({ code: `A${i}`, classId: 2, count: 48, classCode: '2A' });
      for (let i = 1; i <= 10; i++) coachDef.push({ code: `B${i}`, classId: 3, count: 64, classCode: '3A' });
    } else if (tType === 'SHATABDI') {
      coachDef.push({ code: 'E1', classId: 6, count: 56, classCode: 'EC' });
      for (let i = 1; i <= 10; i++) coachDef.push({ code: `C${i}`, classId: 5, count: 78, classCode: 'CC' });
    } else if (tType === 'DURONTO') {
      coachDef.push({ code: 'H1', classId: 1, count: 24, classCode: '1A' });
      for (let i = 1; i <= 2; i++) coachDef.push({ code: `A${i}`, classId: 2, count: 48, classCode: '2A' });
      for (let i = 1; i <= 6; i++) coachDef.push({ code: `B${i}`, classId: 3, count: 64, classCode: '3A' });
      for (let i = 1; i <= 6; i++) coachDef.push({ code: `S${i}`, classId: 4, count: 72, classCode: 'SL' });
    }

    let seq = 1;
    for (const c of coachDef) {
      const coachId = coachIdCounter++;
      coachRows.push({
        coach_id: coachId,
        train_id: t.trainId,
        class_id: c.classId,
        coach_code: c.code,
        sequence_number: seq++,
        total_seats: c.count
      });

      // Generate seats for this coach
      for (let s = 1; s <= c.count; s++) {
        let bType = 'LOWER';
        if (c.classCode === '1A') {
          bType = (s % 2 === 1) ? 'LOWER' : 'UPPER';
        } else if (c.classCode === '2A') {
          const mod = s % 6;
          if (mod === 1 || mod === 3) bType = 'LOWER';
          else if (mod === 2 || mod === 4) bType = 'UPPER';
          else if (mod === 5) bType = 'SIDE_LOWER';
          else bType = 'SIDE_UPPER';
        } else if (c.classCode === '3A' || c.classCode === 'SL') {
          const mod = s % 8;
          if (mod === 1 || mod === 4) bType = 'LOWER';
          else if (mod === 2 || mod === 5) bType = 'MIDDLE';
          else if (mod === 3 || mod === 6) bType = 'UPPER';
          else if (mod === 7) bType = 'SIDE_LOWER';
          else bType = 'SIDE_UPPER';
        } else if (c.classCode === 'CC' || c.classCode === 'EC') {
          bType = (s % 5 === 1 || s % 5 === 0) ? 'WINDOW' : 'AISLE';
        }

        seatRows.push({
          seat_id: seatIdCounter++,
          coach_id: coachId,
          seat_number: s,
          berth_type: bType
        });
      }
    }
  }

  writeCsv(
    path.join(SEED_MYSQL_DIR, 'COACH.csv'),
    ['coach_id', 'train_id', 'class_id', 'coach_code', 'sequence_number', 'total_seats'],
    coachRows
  );

  writeCsv(
    path.join(SEED_MYSQL_DIR, 'SEAT.csv'),
    ['seat_id', 'coach_id', 'seat_number', 'berth_type'],
    seatRows
  );
  console.log(`COACH.csv written (${coachRows.length} rows), SEAT.csv written (${seatRows.length} rows)`);

  // 3. TRAIN_SCHEDULE & RUN_COACH_STATUS & SCHEDULE_CLASS_INVENTORY
  console.log('Generating TRAIN_SCHEDULE and inventory for 7 dates (18-24 Oct 2026)...');
  const dates = [
    { date: '2026-10-18', day: 'SUN' },
    { date: '2026-10-19', day: 'MON' },
    { date: '2026-10-20', day: 'TUE' },
    { date: '2026-10-21', day: 'WED' },
    { date: '2026-10-22', day: 'THU' },
    { date: '2026-10-23', day: 'FRI' },
    { date: '2026-10-24', day: 'SAT' }
  ];

  // Route first stop departure times map
  const wbRoutes = xlsx.readFile(path.join(DATASETS_DIR, 'final_routes_536.xlsx'));
  const rawRoutes = xlsx.utils.sheet_to_json(wbRoutes.Sheets[wbRoutes.SheetNames[0]]);
  const originDepMap = {};
  for (const r of rawRoutes) {
    if (r.stopSequence === 1) {
      originDepMap[r.trainId] = r.departureTime.length === 5 ? r.departureTime + ':00' : r.departureTime;
    }
  }

  const scheduleRows = [];
  const runCoachRows = [];
  const inventoryRows = [];
  let scheduleIdCounter = 1001;
  let runCoachIdCounter = 1;
  let invIdCounter = 1;

  // Build coach map by trainId
  const coachesByTrain = {};
  for (const c of coachRows) {
    if (!coachesByTrain[c.train_id]) coachesByTrain[c.train_id] = [];
    coachesByTrain[c.train_id].push(c);
  }

  const scheduleLookup = {}; // (trainId, journeyDate) -> scheduleId

  for (const t of rawTrains) {
    const rDays = JSON.parse(t.runningDays);
    const depTime = originDepMap[t.trainId] || '08:00:00';
    const trainCoaches = coachesByTrain[t.trainId] || [];

    // Calculate class seat totals for this train
    const classTotals = {};
    for (const c of trainCoaches) {
      classTotals[c.class_id] = (classTotals[c.class_id] || 0) + c.total_seats;
    }

    for (const d of dates) {
      if (rDays.includes(d.day)) {
        const sId = scheduleIdCounter++;
        scheduleLookup[`${t.trainId}_${d.date}`] = sId;

        scheduleRows.push({
          schedule_id: sId,
          train_id: t.trainId,
          journey_date: d.date,
          departure_time: depTime,
          delay_minutes: 0,
          chart_prepared_at: null,
          status: 'ON_TIME'
        });

        // RUN_COACH_STATUS
        for (const c of trainCoaches) {
          runCoachRows.push({
            status_id: runCoachIdCounter++,
            schedule_id: sId,
            coach_id: c.coach_id,
            status: 'IN_SERVICE'
          });
        }

        // SCHEDULE_CLASS_INVENTORY
        for (const [classId, totalSeats] of Object.entries(classTotals)) {
          const cId = parseInt(classId, 10);
          const offersRac = (cId === 2 || cId === 3 || cId === 4);
          const racCap = offersRac ? Math.round(totalSeats * 0.10) : 0;
          const wlCap = Math.round(totalSeats * 0.25);

          inventoryRows.push({
            inventory_id: invIdCounter++,
            schedule_id: sId,
            class_id: cId,
            total_seats: totalSeats,
            available_seats: totalSeats,
            rac_capacity: racCap,
            rac_count: 0,
            wl_capacity: wlCap,
            wl_count: 0
          });
        }
      }
    }
  }

  writeCsv(
    path.join(SEED_MYSQL_DIR, 'TRAIN_SCHEDULE.csv'),
    ['schedule_id', 'train_id', 'journey_date', 'departure_time', 'delay_minutes', 'chart_prepared_at', 'status'],
    scheduleRows
  );

  writeCsv(
    path.join(SEED_MYSQL_DIR, 'RUN_COACH_STATUS.csv'),
    ['status_id', 'schedule_id', 'coach_id', 'status'],
    runCoachRows
  );

  console.log(`TRAIN_SCHEDULE.csv written (${scheduleRows.length} runs), RUN_COACH_STATUS.csv (${runCoachRows.length} rows), SCHEDULE_CLASS_INVENTORY will be written after reservation sync`);

  // 4. BOOKINGS, PASSENGERS, PAYMENTS, RESERVATIONS, REFUNDS, TDR
  console.log('Generating realistic bookings adhering strictly to demo_fill_plan.csv...');

  // Read saved passengers from cleaned SAVED_PASSENGER.csv
  const savedPassengers = [];
  const spLines = fs.readFileSync(path.join(SEED_MYSQL_DIR, 'SAVED_PASSENGER.csv'), 'utf8').trim().split('\n');
  const spHeaders = spLines[0].split(',');
  for (let i = 1; i < spLines.length; i++) {
    const p = spLines[i].split(',');
    savedPassengers.push({
      passengerId: parseInt(p[0], 10),
      userId: parseInt(p[1], 10),
      name: p[2],
      age: parseInt(p[3], 10),
      gender: p[4],
      idProofType: p[5],
      idProofReference: p[6],
      disabilityType: p[7],
      berthPreference: p[8]
    });
  }

  // Pre-index route stops by trainId
  const stopsByTrain = {};
  const rsLines = fs.readFileSync(path.join(SEED_MYSQL_DIR, 'ROUTE_STOP.csv'), 'utf8').trim().split('\n');
  for (let i = 1; i < rsLines.length; i++) {
    const p = rsLines[i].split(',');
    const tId = parseInt(p[1], 10);
    if (!stopsByTrain[tId]) stopsByTrain[tId] = [];
    stopsByTrain[tId].push({
      stopId: parseInt(p[0], 10),
      trainId: tId,
      stationId: parseInt(p[2], 10),
      stopSequence: parseInt(p[3], 10),
      arrivalTime: p[4],
      departureTime: p[5],
      dayOffset: parseInt(p[6], 10),
      distance: parseFloat(p[7])
    });
  }
  for (const tId in stopsByTrain) {
    stopsByTrain[tId].sort((a,b) => a.stopSequence - b.stopSequence);
  }

  // Pre-index seats by coachId and classId
  const seatsByCoach = {};
  for (const s of seatRows) {
    if (!seatsByCoach[s.coach_id]) seatsByCoach[s.coach_id] = [];
    seatsByCoach[s.coach_id].push(s);
  }

  const coachesByTrainClass = {};
  for (const c of coachRows) {
    const k = `${c.train_id}_${c.class_id}`;
    if (!coachesByTrainClass[k]) coachesByTrainClass[k] = [];
    coachesByTrainClass[k].push(c);
  }

  // Read demo_fill_plan.csv
  const planLines = fs.readFileSync('database/seed-data/demo_fill_plan.csv', 'utf8').trim().split('\n');
  const planEntries = [];
  for (let i = 1; i < planLines.length; i++) {
    const line = planLines[i];
    // parse CSV with possible quoted note
    const match = line.match(/^([^,]+),([^,]+),([^,]+),([^,]+),([^,]+),([^,]+),([^,]+),(.*)$/);
    if (match) {
      planEntries.push({
        level: match[1],
        trainId: parseInt(match[2], 10),
        trainNumber: match[3],
        type: match[4],
        from: match[5],
        to: match[6],
        journeyDate: match[7],
        note: match[8].replace(/^"|"$/g, '')
      });
    }
  }

  // Target booking containers
  const bookingRows = [];
  const passengerBookingRows = [];
  const reservationRows = [];
  const paymentRows = [];
  const cancellationRows = [];
  const tdrRows = [];
  const refundRows = [];
  const chartSnapshotRows = [];
  const notificationRows = [];
  const rawGatewayReplies = [];

  let pnrSeed = 2849100000;
  let paymentIdCounter = 1001;
  let resIdCounter = 1;
  let cancelIdCounter = 1;
  let tdrCounter = 701;
  let refundIdCounter = 1;
  let snapshotIdCounter = 1;

  // Track monthly ticket count per user: userId -> count
  const userTicketCount = {};

  // Fare calculator helper
  function calcFare(classId, distKm, trainType, quota, concessionType) {
    const d = Math.max(100, distKm);
    let rate = 1.0;
    for (const f of fareSlabs) {
      if (f.class_id === classId && d >= f.min_distance_km && d <= f.max_distance_km) {
        rate = f.rate_per_km;
        break;
      }
    }
    const baseFare = Math.round(d * rate * 100) / 100;
    
    let discountPct = 0;
    if (concessionType === 'DIVYAANG') {
      const isPrem = (trainType === 'RAJDHANI' || trainType === 'SHATABDI' || trainType === 'DURONTO');
      if (classId === 3 || classId === 5) {
        discountPct = isPrem ? 25 : 75;
      } else if (classId === 4 || classId === 7) {
        discountPct = 75;
      } else if (classId === 1 || classId === 2) {
        discountPct = 50;
      }
    }
    const concessionDiscount = Math.round(baseFare * (discountPct / 100) * 100) / 100;
    const baseAfterDiscount = baseFare - concessionDiscount;

    // Reservation charge
    let resv = 40;
    if (classId === 1 || classId === 6) resv = 60;
    else if (classId === 2) resv = 50;
    else if (classId === 4) resv = 20;
    else if (classId === 7) resv = 15;

    // Superfast charge
    let sf = 45;
    if (classId === 1 || classId === 6) sf = 75;
    else if (classId === 4) sf = 30;
    else if (classId === 7) sf = 15;

    // Tatkal charge
    let tatkal = 0;
    if (quota === 'TATKAL') {
      const isAc = (classId !== 4 && classId !== 7);
      tatkal = Math.round(baseFare * (isAc ? 0.30 : 0.10) * 100) / 100;
    }

    const taxable = baseAfterDiscount + resv + sf + tatkal;
    const isAc = (classId !== 4 && classId !== 7);
    const gst = isAc ? Math.round(taxable * 0.05 * 100) / 100 : 0;
    const ins = 0.45;
    const total = Math.round((taxable + gst + ins) * 100) / 100;

    return {
      baseFare,
      concessionDiscount,
      reservationCharge: resv,
      superfastCharge: sf,
      tatkalCharge: tatkal,
      dynamicSurcharge: 0,
      gst,
      insurance: ins,
      totalFare: total
    };
  }

  // Separate saved passenger pools to strictly respect adult and eligibility rules without mutating profiles
  const adultPool = savedPassengers.filter(p => p.age >= 18);
  const femaleAdultPool = adultPool.filter(p => p.gender === 'FEMALE');
  const childUnder12Pool = savedPassengers.filter(p => p.age < 12);
  const divyaangAdultPool = adultPool.filter(p => p.disabilityType !== 'NONE');
  const seniorPool = adultPool.filter(p => (p.gender === 'FEMALE' && p.age >= 45) || (p.gender !== 'FEMALE' && p.age >= 60));

  let adultIdx = 0;
  let femaleAdultIdx = 0;
  let childIdx = 0;
  let divyaangIdx = 0;
  let seniorIdx = 0;

  function pickPassenger(poolType) {
    let p = null;
    if (poolType === 'DIVYAANG') {
      p = divyaangAdultPool[divyaangIdx % divyaangAdultPool.length];
      divyaangIdx++;
    } else if (poolType === 'SENIOR') {
      p = seniorPool[seniorIdx % seniorPool.length];
      seniorIdx++;
    } else if (poolType === 'FEMALE_ADULT') {
      p = femaleAdultPool[femaleAdultIdx % femaleAdultPool.length];
      femaleAdultIdx++;
    } else if (poolType === 'CHILD') {
      p = childUnder12Pool[childIdx % childUnder12Pool.length];
      childIdx++;
    } else {
      p = adultPool[adultIdx % adultPool.length];
      adultIdx++;
    }
    return p;
  }

  // Process each fill plan run
  for (const entry of planEntries) {
    const sId = scheduleLookup[`${entry.trainId}_${entry.journeyDate}`];
    if (!sId) {
      console.error('Schedule not found for plan entry:', entry);
      continue;
    }

    const stops = stopsByTrain[entry.trainId];
    const originStop = stops[0];
    const destStop = stops[stops.length - 1];
    const totalDist = destStop.distance - originStop.distance;

    // Classes available on this train
    const tCoaches = coachesByTrain[entry.trainId] || [];
    const classesOnTrain = [...new Set(tCoaches.map(c => c.class_id))];

    // Determine target load for GENERAL quota confirmed seats based on entry.level
    let fillRatio = 0.15;
    if (entry.level === 'RAC_FULL_WL_OPEN' || entry.level === 'WL_FULL' || entry.level === 'RAC_OPEN') fillRatio = 1.0;
    else if (entry.level === 'NEARLY_FULL') fillRatio = 0.90;
    else if (entry.level === 'BUSY') fillRatio = 0.70;
    else if (entry.level === 'MEDIUM') fillRatio = 0.40;
    else if (entry.level === 'LIGHT') fillRatio = 0.15;

    // Fill each class on the train
    for (const cId of classesOnTrain) {
      const cCoaches = coachesByTrainClass[`${entry.trainId}_${cId}`] || [];
      const allClassSeats = [];
      for (const co of cCoaches) {
        const cSeats = seatsByCoach[co.coach_id] || [];
        for (const st of cSeats) {
          allClassSeats.push({ coach: co, seat: st });
        }
      }

      const totalSeats = allClassSeats.length;
      const numCoaches = cCoaches.length;

      // Quota seat breakdown (BR-Q10 & BR-S3)
      const tatkalSeats = Math.round(totalSeats * 0.10);
      const ladiesSeats = Math.round(totalSeats * 0.10);
      let seniorSeats = 0;
      let divyaangSeats = 0;
      if (cId === 4) { seniorSeats = 6 * numCoaches; divyaangSeats = 4; }
      else if (cId === 3) { seniorSeats = 4 * numCoaches; divyaangSeats = 4; }
      else if (cId === 2) { seniorSeats = 3 * numCoaches; divyaangSeats = 0; }
      else if (cId === 5) { seniorSeats = 0; divyaangSeats = 4; }

      const generalSeats = totalSeats - tatkalSeats - ladiesSeats - seniorSeats - divyaangSeats;
      const targetGeneralSold = Math.round(generalSeats * fillRatio);

      // Story 5 check: on Train 146 on 2026-10-20, LADIES quota is 100% sold out in every class
      const isStory5 = (entry.trainId === 146 && entry.journeyDate === '2026-10-20');
      const targetLadiesSold = isStory5 ? ladiesSeats : Math.round(ladiesSeats * 0.50);
      const targetTatkalSold = Math.round(tatkalSeats * 0.50);
      const targetSeniorSold = Math.round(seniorSeats * 0.30);
      const targetDivyaangSold = Math.min(2, divyaangSeats);

      let allocatedSeatIndex = 0;

      // Helper to generate confirmed booking groups
      function generateConfirmedBookings(quota, targetCount) {
        let sold = 0;
        while (sold < targetCount) {
          const groupSize = Math.min(Math.floor(rng() * 3) + 1, targetCount - sold);
          const pnr = String(pnrSeed++);
          const bkgDate = '2026-10-17 12:00:00';

          // Pick group passengers
          const groupPass = [];
          if (quota === 'DIVYAANG') {
            const first = pickPassenger('DIVYAANG');
            groupPass.push({ pass: first, concession: 'DIVYAANG' });
            for (let g = 1; g < groupSize; g++) {
              groupPass.push({ pass: pickPassenger('ADULT'), concession: 'NONE' });
            }
          } else if (quota === 'SENIOR_CITIZEN') {
            const first = pickPassenger('SENIOR');
            groupPass.push({ pass: first, concession: 'NONE' });
            for (let g = 1; g < groupSize; g++) {
              groupPass.push({ pass: pickPassenger('ADULT'), concession: 'NONE' });
            }
          } else if (quota === 'LADIES') {
            const first = pickPassenger('FEMALE_ADULT');
            groupPass.push({ pass: first, concession: 'NONE' });
            for (let g = 1; g < groupSize; g++) {
              const p = (rng() < 0.3) ? pickPassenger('CHILD') : pickPassenger('FEMALE_ADULT');
              groupPass.push({ pass: p, concession: 'NONE' });
            }
          } else {
            // GENERAL or TATKAL
            const first = pickPassenger('ADULT');
            groupPass.push({ pass: first, concession: 'NONE' });
            for (let g = 1; g < groupSize; g++) {
              const p = (rng() < 0.2) ? pickPassenger('CHILD') : pickPassenger('ADULT');
              groupPass.push({ pass: p, concession: 'NONE' });
            }
          }

          const bookingOwner = groupPass[0].pass.userId;
          userTicketCount[bookingOwner] = (userTicketCount[bookingOwner] || 0) + 1;

          let bookingTotalFare = 0;
          const passengerItems = [];

          for (let pNo = 1; pNo <= groupPass.length; pNo++) {
            const item = groupPass[pNo - 1];
            const pass = item.pass;
            const conc = item.concession;
            const fareObj = calcFare(cId, totalDist, entry.type, quota, conc);
            bookingTotalFare += fareObj.totalFare;

            const seatObj = allClassSeats[allocatedSeatIndex % allClassSeats.length];
            allocatedSeatIndex++;
            sold++;

            passengerItems.push({
              pnr,
              passenger_no: pNo,
              saved_passenger_id: pass.passengerId,
              name: pass.name,
              age: pass.age,
              gender: pass.gender,
              concession_type: conc,
              concession_proof_type: conc === 'DIVYAANG' ? 'UDID' : null,
              concession_proof_ref: conc === 'DIVYAANG' ? `UDID-${pass.passengerId}` : null,
              base_fare: fareObj.baseFare,
              concession_discount: fareObj.concessionDiscount,
              reservation_charge: fareObj.reservationCharge,
              superfast_charge: fareObj.superfastCharge,
              tatkal_charge: fareObj.tatkalCharge,
              dynamic_surcharge: 0,
              gst: fareObj.gst,
              insurance: fareObj.insurance,
              total_fare: fareObj.totalFare,
              seatId: seatObj.seat.seat_id,
              coachNo: seatObj.coach.coach_code,
              seatNo: seatObj.seat.seat_number,
              berthType: seatObj.seat.berth_type,
              status: 'CONFIRMED',
              queuePos: null
            });
          }

          bookingRows.push({
            pnr,
            user_id: bookingOwner,
            schedule_id: sId,
            class_id: cId,
            from_stop_id: originStop.stopId,
            to_stop_id: destStop.stopId,
            channel: 'ONLINE',
            booked_by_staff_id: null,
            quota,
            requested_quota: quota,
            berth_condition: 0,
            total_fare: Math.round(bookingTotalFare * 100) / 100,
            status: 'CONFIRMED',
            created_at: bkgDate
          });

          paymentRows.push({
            payment_id: paymentIdCounter++,
            pnr,
            amount: Math.round(bookingTotalFare * 100) / 100,
            method: 'UPI',
            status: 'SUCCESS',
            gateway_payment_id: `pay_test_${pnr}_${paymentIdCounter}`,
            paid_at: bkgDate
          });

          for (const it of passengerItems) {
            passengerBookingRows.push({
              pnr: it.pnr,
              passenger_no: it.passenger_no,
              saved_passenger_id: it.saved_passenger_id,
              name: it.name,
              age: it.age,
              gender: it.gender,
              concession_type: it.concession_type,
              concession_proof_type: it.concession_proof_type,
              concession_proof_ref: it.concession_proof_ref,
              base_fare: it.base_fare,
              concession_discount: it.concession_discount,
              reservation_charge: it.reservation_charge,
              superfast_charge: it.superfast_charge,
              tatkal_charge: it.tatkal_charge,
              dynamic_surcharge: it.dynamic_surcharge,
              gst: it.gst,
              insurance: it.insurance,
              total_fare: it.total_fare
            });

            reservationRows.push({
              res_id: resIdCounter++,
              pnr: it.pnr,
              passenger_no: it.passenger_no,
              schedule_id: sId,
              seat_id: it.seatId,
              status: it.status,
              queue_position: it.queuePos
            });
          }
        }
      }

      // Generate confirmed seats strictly in order
      generateConfirmedBookings('GENERAL', targetGeneralSold);
      generateConfirmedBookings('TATKAL', targetTatkalSold);
      generateConfirmedBookings('LADIES', targetLadiesSold);
      generateConfirmedBookings('SENIOR_CITIZEN', targetSeniorSold);
      generateConfirmedBookings('DIVYAANG', targetDivyaangSold);

      // Track queue positions for RAC & WL
      const offersRac = (cId === 2 || cId === 3 || cId === 4);
      const racCap = offersRac ? Math.round(totalSeats * 0.10) : 0;
      const wlCap = Math.round(totalSeats * 0.25);

      let targetRac = 0;
      let targetWl = 0;
      if (entry.level === 'RAC_FULL_WL_OPEN') {
        targetRac = racCap;
        targetWl = Math.round(wlCap * 0.50);
      } else if (entry.level === 'WL_FULL') {
        targetRac = racCap;
        targetWl = wlCap;
      } else if (entry.level === 'RAC_OPEN') {
        targetRac = Math.round(racCap * 0.50);
        targetWl = 0;
      }

      // Generate RAC bookings
      for (let rPos = 1; rPos <= targetRac; rPos++) {
        const pnr = String(pnrSeed++);
        const pass = pickPassenger('ADULT');
        const bookingOwner = pass.userId;
        const fareObj = calcFare(cId, totalDist, entry.type, 'GENERAL', 'NONE');
        const bkgDate = '2026-10-17 14:00:00';

        bookingRows.push({
          pnr,
          user_id: bookingOwner,
          schedule_id: sId,
          class_id: cId,
          from_stop_id: originStop.stopId,
          to_stop_id: destStop.stopId,
          channel: 'ONLINE',
          booked_by_staff_id: null,
          quota: 'GENERAL',
          requested_quota: 'GENERAL',
          berth_condition: 0,
          total_fare: fareObj.totalFare,
          status: 'RAC',
          created_at: bkgDate
        });

        paymentRows.push({
          payment_id: paymentIdCounter++,
          pnr,
          amount: fareObj.totalFare,
          method: 'CREDIT_CARD',
          status: 'SUCCESS',
          gateway_payment_id: `pay_test_${pnr}_${paymentIdCounter}`,
          paid_at: bkgDate
        });

        passengerBookingRows.push({
          pnr,
          passenger_no: 1,
          saved_passenger_id: pass.passengerId,
          name: pass.name,
          age: pass.age,
          gender: pass.gender,
          concession_type: 'NONE',
          concession_proof_type: null,
          concession_proof_ref: null,
          base_fare: fareObj.baseFare,
          concession_discount: fareObj.concessionDiscount,
          reservation_charge: fareObj.reservationCharge,
          superfast_charge: fareObj.superfastCharge,
          tatkal_charge: fareObj.tatkalCharge,
          dynamic_surcharge: 0,
          gst: fareObj.gst,
          insurance: fareObj.insurance,
          total_fare: fareObj.totalFare
        });

        reservationRows.push({
          res_id: resIdCounter++,
          pnr,
          passenger_no: 1,
          schedule_id: sId,
          seat_id: null,
          status: 'RAC',
          queue_position: `RAC/${rPos}`
        });
      }

      // Generate WL bookings
      for (let wPos = 1; wPos <= targetWl; wPos++) {
        const pnr = String(pnrSeed++);
        const pass = pickPassenger('ADULT');
        const bookingOwner = pass.userId;
        const fareObj = calcFare(cId, totalDist, entry.type, 'GENERAL', 'NONE');
        const bkgDate = '2026-10-17 15:00:00';

        bookingRows.push({
          pnr,
          user_id: bookingOwner,
          schedule_id: sId,
          class_id: cId,
          from_stop_id: originStop.stopId,
          to_stop_id: destStop.stopId,
          channel: 'ONLINE',
          booked_by_staff_id: null,
          quota: 'GENERAL',
          requested_quota: 'GENERAL',
          berth_condition: 0,
          total_fare: fareObj.totalFare,
          status: 'WAITING_LIST',
          created_at: bkgDate
        });

        paymentRows.push({
          payment_id: paymentIdCounter++,
          pnr,
          amount: fareObj.totalFare,
          method: 'NET_BANKING',
          status: 'SUCCESS',
          gateway_payment_id: `pay_test_${pnr}_${paymentIdCounter}`,
          paid_at: bkgDate
        });

        passengerBookingRows.push({
          pnr,
          passenger_no: 1,
          saved_passenger_id: pass.passengerId,
          name: pass.name,
          age: pass.age,
          gender: pass.gender,
          concession_type: 'NONE',
          concession_proof_type: null,
          concession_proof_ref: null,
          base_fare: fareObj.baseFare,
          concession_discount: fareObj.concessionDiscount,
          reservation_charge: fareObj.reservationCharge,
          superfast_charge: fareObj.superfastCharge,
          tatkal_charge: fareObj.tatkalCharge,
          dynamic_surcharge: 0,
          gst: fareObj.gst,
          insurance: fareObj.insurance,
          total_fare: fareObj.totalFare
        });

        reservationRows.push({
          res_id: resIdCounter++,
          pnr,
          passenger_no: 1,
          schedule_id: sId,
          seat_id: null,
          status: 'WAITING_LIST',
          queue_position: `WL/${wPos}`
        });
      }
    }
  }

  // 5. Add ~3% Cancellations, a few Approved TDRs, FAILED and Expired Holds
  console.log('Generating cancellations, refunds, TDRs, and expired holds...');
  const cancelCount = Math.floor(bookingRows.length * 0.03);
  for (let i = 0; i < cancelCount; i++) {
    const bkg = bookingRows[(i * 37) % bookingRows.length];
    if (bkg.status === 'CONFIRMED') {
      bkg.status = 'CANCELLED';
      const cancelId = cancelIdCounter++;
      const charge = Math.round(bkg.total_fare * 0.25 * 100) / 100;
      const refAmt = Math.round((bkg.total_fare - charge) * 100) / 100;

      cancellationRows.push({
        cancel_id: cancelId,
        pnr: bkg.pnr,
        passenger_no: null,
        reason: 'PLANS_CHANGED',
        charge: charge,
        cancelled_at: '2026-10-17 16:00:00'
      });

      refundRows.push({
        refund_id: refundIdCounter++,
        cancel_id: cancelId,
        tdr_ref_no: null,
        payment_id: 1001 + (i % 100),
        amount: refAmt,
        reason: 'CANCELLATION',
        status: 'PROCESSED'
      });
    }
  }

  // A few Approved TDR records (Story 2: approved TDR on Train 127 on 2026-10-18)
  const story2ScheduleId = scheduleLookup['127_2026-10-18'];
  const story2Booking = bookingRows.find(b => b.schedule_id === story2ScheduleId && b.status === 'CONFIRMED') || bookingRows[5];
  const tdr1 = {
    tdr_ref_no: `TDR-${tdrCounter++}`,
    pnr: story2Booking.pnr,
    passenger_no: null,
    reason: 'TRAIN_DELAYED_OVER_3_HOURS',
    filed_at: '2026-10-17 17:00:00',
    status: 'APPROVED',
    evidence_ref: 'DELAY-VERIFIED',
    refund_amount: story2Booking.total_fare,
    reviewed_by: 1,
    reviewed_at: '2026-10-17 17:30:00',
    remarks: 'Delay > 3 hours confirmed from schedule telemetry.'
  };
  tdrRows.push(tdr1);
  refundRows.push({
    refund_id: refundIdCounter++,
    cancel_id: null,
    tdr_ref_no: tdr1.tdr_ref_no,
    payment_id: 1005,
    amount: story2Booking.total_fare,
    reason: 'TDR_APPROVED',
    status: 'PROCESSED'
  });

  // Pick planned schedule 1064 (Train 111 on 2026-10-18) for holds and failed booking
  const plannedScheduleId = scheduleLookup['111_2026-10-18'] || 1064;
  const plannedStops = stopsByTrain[111];

  const seatHoldRows = [];
  for (let h = 1; h <= 5; h++) {
    seatHoldRows.push({
      token: `HOLD-TEST-TOKEN-${h}`,
      user_id: 50001,
      schedule_id: plannedScheduleId,
      class_id: 3,
      quota: 'GENERAL',
      seat_count: 2,
      expires_at: '2026-10-18 10:10:00'
    });
  }

  // FAILED booking on a planned run (so zero unplanned runs have bookings)
  bookingRows.push({
    pnr: String(pnrSeed++),
    user_id: 50001,
    schedule_id: plannedScheduleId,
    class_id: 3,
    from_stop_id: plannedStops[0].stopId,
    to_stop_id: plannedStops[plannedStops.length - 1].stopId,
    channel: 'ONLINE',
    booked_by_staff_id: null,
    quota: 'GENERAL',
    requested_quota: 'GENERAL',
    berth_condition: 0,
    total_fare: 1850.00,
    status: 'FAILED',
    created_at: '2026-10-18 09:50:00'
  });

  // Write all generated transaction tables
  writeCsv(
    path.join(SEED_MYSQL_DIR, 'SEAT_HOLD.csv'),
    ['token', 'user_id', 'schedule_id', 'class_id', 'quota', 'seat_count', 'expires_at'],
    seatHoldRows
  );

  writeCsv(
    path.join(SEED_MYSQL_DIR, 'BOOKING.csv'),
    ['pnr', 'user_id', 'schedule_id', 'class_id', 'from_stop_id', 'to_stop_id', 'channel', 'booked_by_staff_id', 'quota', 'requested_quota', 'berth_condition', 'total_fare', 'status', 'created_at'],
    bookingRows
  );

  writeCsv(
    path.join(SEED_MYSQL_DIR, 'PASSENGER_BOOKING.csv'),
    ['pnr', 'passenger_no', 'saved_passenger_id', 'name', 'age', 'gender', 'concession_type', 'concession_proof_type', 'concession_proof_ref', 'base_fare', 'concession_discount', 'reservation_charge', 'superfast_charge', 'tatkal_charge', 'dynamic_surcharge', 'gst', 'insurance', 'total_fare'],
    passengerBookingRows
  );

  writeCsv(
    path.join(SEED_MYSQL_DIR, 'RESERVATION.csv'),
    ['res_id', 'pnr', 'passenger_no', 'schedule_id', 'seat_id', 'status', 'queue_position'],
    reservationRows
  );

  // Sync SCHEDULE_CLASS_INVENTORY counters with generated reservations:
  // available_seats = total_seats - confirmed/boarded
  // rac_count = RAC passengers
  // wl_count = waiting-list passengers
  const pnrClassMap = new Map();
  for (const b of bookingRows) {
    pnrClassMap.set(b.pnr, b.class_id);
  }

  const resCounts = new Map();
  for (const r of reservationRows) {
    const classId = pnrClassMap.get(r.pnr);
    const key = `${r.schedule_id}_${classId}`;
    let c = resCounts.get(key);
    if (!c) {
      c = { confirmed_boarded: 0, rac: 0, wl: 0 };
      resCounts.set(key, c);
    }
    if (r.status === 'CONFIRMED' || r.status === 'BOARDED') {
      c.confirmed_boarded++;
    } else if (r.status === 'RAC') {
      c.rac++;
    } else if (r.status === 'WAITING_LIST') {
      c.wl++;
    }
  }

  for (const inv of inventoryRows) {
    const key = `${inv.schedule_id}_${inv.class_id}`;
    const c = resCounts.get(key) || { confirmed_boarded: 0, rac: 0, wl: 0 };
    inv.available_seats = Math.max(0, inv.total_seats - c.confirmed_boarded);
    inv.rac_count = c.rac;
    inv.wl_count = c.wl;
  }

  writeCsv(
    path.join(SEED_MYSQL_DIR, 'SCHEDULE_CLASS_INVENTORY.csv'),
    ['inventory_id', 'schedule_id', 'class_id', 'total_seats', 'available_seats', 'rac_capacity', 'rac_count', 'wl_capacity', 'wl_count'],
    inventoryRows
  );
  console.log(`SCHEDULE_CLASS_INVENTORY.csv written (${inventoryRows.length} rows) with synced counters.`);

  writeCsv(
    path.join(SEED_MYSQL_DIR, 'PAYMENT.csv'),
    ['payment_id', 'pnr', 'amount', 'method', 'status', 'gateway_payment_id', 'paid_at'],
    paymentRows
  );

  writeCsv(
    path.join(SEED_MYSQL_DIR, 'CANCELLATION.csv'),
    ['cancel_id', 'pnr', 'passenger_no', 'reason', 'charge', 'cancelled_at'],
    cancellationRows
  );

  writeCsv(
    path.join(SEED_MYSQL_DIR, 'TDR_FILING.csv'),
    ['tdr_ref_no', 'pnr', 'passenger_no', 'reason', 'filed_at', 'status', 'evidence_ref', 'refund_amount', 'reviewed_by', 'reviewed_at', 'remarks'],
    tdrRows
  );

  writeCsv(
    path.join(SEED_MYSQL_DIR, 'REFUND.csv'),
    ['refund_id', 'cancel_id', 'tdr_ref_no', 'payment_id', 'amount', 'reason', 'status'],
    refundRows
  );

  // CHART_SNAPSHOT (for run 119 on 2026-10-19 Story 4 demo)
  const chartSnapshots = [];
  const run119Res = reservationRows.filter(r => r.schedule_id === scheduleLookup['119_2026-10-19'] && r.status === 'CONFIRMED');
  for (const r of run119Res) {
    chartSnapshots.push({
      snapshot_id: snapshotIdCounter++,
      schedule_id: r.schedule_id,
      pnr: r.pnr,
      passenger_no: r.passenger_no,
      coach_no: 'B1',
      seat_no: 12,
      berth_type: 'LOWER',
      status: 'CONFIRMED',
      from_station_id: 10,
      to_station_id: 69,
      concession_flag: 0,
      generated_at: '2026-10-19 02:00:00'
    });
  }
  writeCsv(
    path.join(SEED_MYSQL_DIR, 'CHART_SNAPSHOT.csv'),
    ['snapshot_id', 'schedule_id', 'pnr', 'passenger_no', 'coach_no', 'seat_no', 'berth_type', 'status', 'from_station_id', 'to_station_id', 'concession_flag', 'generated_at'],
    chartSnapshots
  );

  // TICKET_VERIFICATION
  const ticketVerifications = [
    { verify_id: 1, staff_id: 1, pnr: bookingRows[0].pnr, passenger_no: 1, id_proof_match: 'VALID', concession_match: 'NOT_APPLICABLE', result: 'VALID', remarks: 'Passenger verified', verified_at: '2026-10-18 10:00:00' }
  ];
  writeCsv(
    path.join(SEED_MYSQL_DIR, 'TICKET_VERIFICATION.csv'),
    ['verify_id', 'staff_id', 'pnr', 'passenger_no', 'id_proof_match', 'concession_match', 'result', 'remarks', 'verified_at'],
    ticketVerifications
  );

  // MAINTENANCE table
  const maintenanceRows = [
    { maint_id: 1, staff_id: 3, coach_id: 1, platform_id: null, type: 'INSPECTION', status: 'COMPLETED', created_at: '2026-10-17 08:00:00', completed_at: '2026-10-17 09:30:00' },
    { maint_id: 2, staff_id: 3, coach_id: null, platform_id: 1, type: 'CLEANING', status: 'COMPLETED', created_at: '2026-10-17 10:00:00', completed_at: '2026-10-17 11:00:00' }
  ];
  writeCsv(
    path.join(SEED_MYSQL_DIR, 'MAINTENANCE.csv'),
    ['maint_id', 'staff_id', 'coach_id', 'platform_id', 'type', 'status', 'created_at', 'completed_at'],
    maintenanceRows
  );

  // Remaining MongoDB collections:
  // - live_train_status
  // - notifications
  // - raw_gateway_replies
  const liveTrainStatus = [
    {
      _id: 'lts_1001',
      schedule_id: 1001,
      station_id: 10,
      delay_min: 0,
      status: 'ON_TIME',
      current_platform: 3,
      updated_at: '2026-10-18T10:00:00Z'
    },
    {
      _id: 'lts_1002',
      schedule_id: 1002,
      station_id: 21,
      delay_min: 15,
      status: 'DELAYED',
      current_platform: 1,
      updated_at: '2026-10-18T10:30:00Z'
    }
  ];
  writeJson(path.join(SEED_MONGODB_DIR, 'live_train_status.json'), liveTrainStatus);

  const notifications = [
    {
      _id: 'ntf_1001',
      user_id: 50001,
      message: `Your booking for PNR ${bookingRows[0].pnr} is CONFIRMED.`,
      type: 'BOOKING_CONFIRMATION',
      reference_id: bookingRows[0].pnr,
      sent_at: '2026-10-18T09:00:00Z',
      is_read: true
    },
    {
      _id: 'ntf_1002',
      user_id: 50001,
      message: 'Chart preparation completed for your scheduled departure.',
      type: 'STATUS_UPDATE',
      reference_id: bookingRows[0].pnr,
      sent_at: '2026-10-18T10:00:00Z',
      is_read: false
    }
  ];
  writeJson(path.join(SEED_MONGODB_DIR, 'notifications.json'), notifications);

  for (let i = 0; i < 5; i++) {
    rawGatewayReplies.push({
      _id: `rgr_${1001 + i}`,
      gateway_payment_id: paymentRows[i].gateway_payment_id,
      payload: {
        order_id: `order_test_${paymentRows[i].pnr}`,
        payment_id: paymentRows[i].gateway_payment_id,
        amount: Math.round(paymentRows[i].amount * 100),
        status: 'captured',
        method: paymentRows[i].method
      },
      received_at: paymentRows[i].paid_at.replace(' ', 'T') + 'Z'
    });
  }
  writeJson(path.join(SEED_MONGODB_DIR, 'raw_gateway_replies.json'), rawGatewayReplies);

  console.log(`Generated BOOKING: ${bookingRows.length} rows, PASSENGER_BOOKING: ${passengerBookingRows.length} rows, RESERVATION: ${reservationRows.length} rows, PAYMENT: ${paymentRows.length} rows`);
  console.log('=== Step 3 Complete ===\n');
}

if (require.main === module) {
  runStep3();
}

module.exports = { runStep3 };
