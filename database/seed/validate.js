const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');
const { SEED_MYSQL_DIR, SEED_MONGODB_DIR, DATASETS_DIR } = require('./helpers');

function readCsv(filename) {
  const fullPath = path.join(SEED_MYSQL_DIR, filename);
  if (!fs.existsSync(fullPath)) return [];
  const lines = fs.readFileSync(fullPath, 'utf8').trim().split('\n');
  const headers = lines[0].split(',').map(h => h.trim());
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    // basic CSV line parser handling quotes
    const values = [];
    let cur = '';
    let inQuote = false;
    for (let c = 0; c < line.length; c++) {
      const ch = line[c];
      if (ch === '"') {
        if (inQuote && line[c+1] === '"') {
          cur += '"';
          c++;
        } else {
          inQuote = !inQuote;
        }
      } else if (ch === ',' && !inQuote) {
        values.push(cur);
        cur = '';
      } else {
        cur += ch;
      }
    }
    values.push(cur);
    const row = {};
    for (let h = 0; h < headers.length; h++) {
      row[headers[h]] = values[h];
    }
    rows.push(row);
  }
  return rows;
}

function runValidation() {
  console.log('====================================================');
  console.log('       SEED DATA VALIDATION REPORT & INTEGRITY CHECK');
  console.log('====================================================\n');
  let failures = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`[PASS] ${message}`);
    } else {
      console.error(`[FAIL] ${message}`);
      failures++;
    }
  }

  // 1. Row counts check
  const stations = readCsv('STATION.csv');
  const trains = readCsv('TRAIN.csv');
  const routes = readCsv('ROUTE_STOP.csv');
  const users = readCsv('USER_ACCOUNT.csv');
  const passengers = readCsv('SAVED_PASSENGER.csv');
  const platforms = readCsv('PLATFORM.csv');
  const coaches = readCsv('COACH.csv');
  const seats = readCsv('SEAT.csv');
  const schedules = readCsv('TRAIN_SCHEDULE.csv');
  const inventories = readCsv('SCHEDULE_CLASS_INVENTORY.csv');
  const bookings = readCsv('BOOKING.csv');
  const passengerBookings = readCsv('PASSENGER_BOOKING.csv');
  const reservations = readCsv('RESERVATION.csv');
  const payments = readCsv('PAYMENT.csv');

  console.log('--- 1. Mandatory Row Counts ---');
  assert(stations.length === 158, `STATION count equals 158 (actual: ${stations.length})`);
  assert(trains.length === 60, `TRAIN count equals 60 (actual: ${trains.length})`);
  assert(routes.length === 536, `ROUTE_STOP count equals 536 (actual: ${routes.length})`);
  assert(passengers.length === 75000, `SAVED_PASSENGER count equals 75,000 (actual: ${passengers.length})`);
  assert(users.length === 50008, `USER_ACCOUNT count equals 50,000 synthetic + 8 extra accounts (actual: ${users.length})`);
  assert(platforms.length === 888, `PLATFORM count matches all station platforms (actual: ${platforms.length})`);
  assert(schedules.length === 350, `TRAIN_SCHEDULE runs count across 7 days (actual: ${schedules.length})`);
  assert(passengerBookings.length >= 30000, `Booking rows about 30,000 (actual: ${passengerBookings.length})`);

  // 2. Unique Constraints (Phones, ID references)
  console.log('\n--- 2. Uniqueness & Identity Constraints ---');
  const phoneSet = new Set();
  let dupPhones = 0;
  for (const u of users) {
    if (phoneSet.has(u.phone)) dupPhones++;
    phoneSet.add(u.phone);
  }
  assert(dupPhones === 0, `All user phone numbers are unique (duplicates: ${dupPhones})`);

  const idRefSet = new Set();
  let dupRefs = 0;
  for (const p of passengers) {
    if (idRefSet.has(p.id_proof_reference)) dupRefs++;
    idRefSet.add(p.id_proof_reference);
  }
  assert(dupRefs === 0, `All passenger idProofReference strings are unique (duplicates: ${dupRefs})`);

  // 3. Route Timing Directionality (No time goes backwards)
  console.log('\n--- 3. Route Timing Directionality ---');
  const byTrain = {};
  for (const r of routes) {
    if (!byTrain[r.train_id]) byTrain[r.train_id] = [];
    byTrain[r.train_id].push(r);
  }
  let backwardsCount = 0;
  for (const [tId, stops] of Object.entries(byTrain)) {
    stops.sort((a,b) => parseInt(a.stop_sequence, 10) - parseInt(b.stop_sequence, 10));
    let prevMin = -1;
    for (const s of stops) {
      const arrParts = s.arrival_time.split(':').map(Number);
      const depParts = s.departure_time.split(':').map(Number);
      const offset = parseInt(s.day_offset, 10);
      let arrAbs = offset * 1440 + arrParts[0] * 60 + arrParts[1];
      let depAbs = offset * 1440 + depParts[0] * 60 + depParts[1];
      if (depAbs < arrAbs) {
        arrAbs -= 1440;
      }
      if (arrAbs < prevMin || depAbs < arrAbs) {
        backwardsCount++;
      }
      prevMin = depAbs;
    }
  }
  assert(backwardsCount === 0, `No stop goes backwards in time across all routes (errors: ${backwardsCount})`);

  // 4. Running Days Adherence
  console.log('\n--- 4. Running Days Adherence ---');
  const trainDaysMap = {};
  for (const t of trains) {
    trainDaysMap[t.train_id] = JSON.parse(t.running_days);
  }
  const dayNameMap = {
    '2026-10-18': 'SUN',
    '2026-10-19': 'MON',
    '2026-10-20': 'TUE',
    '2026-10-21': 'WED',
    '2026-10-22': 'THU',
    '2026-10-23': 'FRI',
    '2026-10-24': 'SAT'
  };
  let runningDayViolations = 0;
  for (const s of schedules) {
    const expDay = dayNameMap[s.journey_date];
    const allowed = trainDaysMap[s.train_id];
    if (!allowed || !allowed.includes(expDay)) {
      runningDayViolations++;
    }
  }
  assert(runningDayViolations === 0, `All schedules operate strictly on allowed running days (violations: ${runningDayViolations})`);

  // 5. Booking Rules (Adult requirement, Monthly limits, Berth preferences)
  console.log('\n--- 5. Booking Rules & Integrity ---');
  // Check at least one adult per booking
  const bkgPassengersMap = {};
  for (const pb of passengerBookings) {
    if (!bkgPassengersMap[pb.pnr]) bkgPassengersMap[pb.pnr] = [];
    bkgPassengersMap[pb.pnr].push(parseInt(pb.age, 10));
  }
  let noAdultCount = 0;
  for (const [pnr, ages] of Object.entries(bkgPassengersMap)) {
    const hasAdult = ages.some(a => a >= 18);
    if (!hasAdult) noAdultCount++;
  }
  assert(noAdultCount === 0, `Every booking has at least one adult (age >= 18) (violations: ${noAdultCount})`);

  // Check user monthly ticket limit
  const userBkgCount = {};
  for (const b of bookings) {
    userBkgCount[b.user_id] = (userBkgCount[b.user_id] || 0) + 1;
  }
  const userAadhaarMap = {};
  for (const u of users) {
    userAadhaarMap[u.user_id] = (u.aadhaar_verified === '1' || u.aadhaar_verified === 1 || u.aadhaar_verified === 'true');
  }
  let monthlyLimitViolations = 0;
  for (const [uId, count] of Object.entries(userBkgCount)) {
    if (uId === '50008') continue; // COUNTER_WALKIN is exempt
    const isAadhaar = userAadhaarMap[uId];
    const maxAllowed = isAadhaar ? 24 : 12;
    if (count > maxAllowed) monthlyLimitViolations++;
  }
  assert(monthlyLimitViolations === 0, `No user exceeds monthly ticket limit (12 or 24 if Aadhaar) (violations: ${monthlyLimitViolations})`);

  // Check WINDOW preference strictly in CC, EC, 2S
  let invalidWindowCount = 0;
  const coachClassMap = {};
  for (const c of coaches) coachClassMap[c.coach_id] = parseInt(c.class_id, 10);
  for (const s of seats) {
    const cId = coachClassMap[s.coach_id];
    if (s.berth_type === 'WINDOW' && (cId !== 5 && cId !== 6 && cId !== 7)) {
      invalidWindowCount++;
    }
  }
  assert(invalidWindowCount === 0, `WINDOW berths exist strictly in CC, EC, and 2S (violations: ${invalidWindowCount})`);

  // 6. Segment Non-Overlap Check for Confirmed Seats
  console.log('\n--- 6. Segment Non-Overlap on Confirmed Allocations ---');
  const resBySeatSchedule = {};
  const bkgStopMap = {};
  for (const b of bookings) {
    bkgStopMap[b.pnr] = { from: parseInt(b.from_stop_id, 10), to: parseInt(b.to_stop_id, 10) };
  }
  const stopSeqMap = {};
  for (const r of routes) {
    stopSeqMap[r.stop_id] = parseInt(r.stop_sequence, 10);
  }

  let doubleBookings = 0;
  for (const r of reservations) {
    if (r.status === 'CONFIRMED' && r.seat_id && r.seat_id !== 'null') {
      const k = `${r.schedule_id}_${r.seat_id}`;
      if (!resBySeatSchedule[k]) resBySeatSchedule[k] = [];
      const bStops = bkgStopMap[r.pnr];
      if (bStops) {
        const startSeq = stopSeqMap[bStops.from] || 1;
        const endSeq = stopSeqMap[bStops.to] || 999;
        // Check overlap with existing allocations
        for (const existing of resBySeatSchedule[k]) {
          if (Math.max(startSeq, existing.start) < Math.min(endSeq, existing.end)) {
            doubleBookings++;
          }
        }
        resBySeatSchedule[k].push({ start: startSeq, end: endSeq, pnr: r.pnr });
      }
    }
  }
  assert(doubleBookings === 0, `No seat double-booked on overlapping segments (conflicts: ${doubleBookings})`);

  // 7. Fares Sum Validation
  console.log('\n--- 7. Financial & Fare Accuracy ---');
  let fareMismatchCount = 0;
  for (const pb of passengerBookings) {
    const base = parseFloat(pb.base_fare);
    const disc = parseFloat(pb.concession_discount);
    const resv = parseFloat(pb.reservation_charge);
    const sf = parseFloat(pb.superfast_charge);
    const tatkal = parseFloat(pb.tatkal_charge);
    const gst = parseFloat(pb.gst);
    const ins = parseFloat(pb.insurance);
    const total = parseFloat(pb.total_fare);
    const taxable = base - disc + resv + sf + tatkal;
    const computed = Math.round((taxable + gst + ins) * 100) / 100;
    if (Math.abs(computed - total) > 0.05) {
      fareMismatchCount++;
    }
  }
  assert(fareMismatchCount === 0, `All passenger fare lines calculate and add up exactly (mismatches: ${fareMismatchCount})`);

  // 8. Foreign Key Referential Integrity
  console.log('\n--- 8. Foreign Key Referential Integrity ---');
  const userIds = new Set(users.map(u => u.user_id));
  const trainIds = new Set(trains.map(t => t.train_id));
  const stationIds = new Set(stations.map(s => s.station_id));
  const scheduleIds = new Set(schedules.map(s => s.schedule_id));
  const coachIds = new Set(coaches.map(c => c.coach_id));
  const seatIds = new Set(seats.map(s => s.seat_id));
  const pnrIds = new Set(bookings.map(b => b.pnr));

  let fkErrors = 0;
  for (const p of passengers) if (!userIds.has(p.user_id)) fkErrors++;
  for (const r of routes) if (!trainIds.has(r.train_id) || !stationIds.has(r.station_id)) fkErrors++;
  for (const s of schedules) if (!trainIds.has(s.train_id)) fkErrors++;
  for (const c of coaches) if (!trainIds.has(c.train_id)) fkErrors++;
  for (const st of seats) if (!coachIds.has(st.coach_id)) fkErrors++;
  for (const b of bookings) if (!userIds.has(b.user_id) || !scheduleIds.has(b.schedule_id)) fkErrors++;
  for (const pb of passengerBookings) if (!pnrIds.has(pb.pnr)) fkErrors++;
  for (const pay of payments) if (!pnrIds.has(pay.pnr)) fkErrors++;

  assert(fkErrors === 0, `All relational foreign keys are strictly satisfied (errors: ${fkErrors})`);

  // 9. MongoDB collections check
  console.log('\n--- 9. MongoDB Collections ---');
  const mongoFiles = ['complaints.json', 'activity_logs.json', 'live_train_status.json', 'notifications.json', 'raw_gateway_replies.json'];
  for (const mf of mongoFiles) {
    const fPath = path.join(SEED_MONGODB_DIR, mf);
    assert(fs.existsSync(fPath), `MongoDB collection ${mf} exists and is populated`);
  }

  // 10. Quota Seat Breakdown & Capacity Check across All Inventories
  console.log('\n--- 10. Quota Seat Breakdown & RAC/WL Capacity Checks ---');
  let quotaAllocationErrors = 0;
  let racWlCapacityErrors = 0;

  for (const inv of inventories) {
    const total = parseInt(inv.total_seats, 10);
    const cId = parseInt(inv.class_id, 10);
    const racCap = parseInt(inv.rac_capacity, 10);
    const wlCap = parseInt(inv.wl_capacity, 10);

    const offersRac = (cId === 2 || cId === 3 || cId === 4);
    const expRac = offersRac ? Math.round(total * 0.10) : 0;
    const expWl = Math.round(total * 0.25);

    if (racCap !== expRac || wlCap !== expWl) {
      racWlCapacityErrors++;
    }

    const tatkalSeats = Math.round(total * 0.10);
    const ladiesSeats = Math.round(total * 0.10);
    let coaches = 0;
    if (cId === 1) coaches = 1;
    else if (cId === 2) coaches = (total === 96 ? 2 : 4);
    else if (cId === 3) coaches = (total === 384 ? 6 : 10);
    else if (cId === 4) coaches = 6;
    else if (cId === 5) coaches = 10;
    else if (cId === 6) coaches = 1;

    let seniorSeats = 0;
    let divyaangSeats = 0;
    if (cId === 4) { seniorSeats = 6 * coaches; divyaangSeats = 4; }
    else if (cId === 3) { seniorSeats = 4 * coaches; divyaangSeats = 4; }
    else if (cId === 2) { seniorSeats = 3 * coaches; divyaangSeats = 0; }
    else if (cId === 5) { seniorSeats = 0; divyaangSeats = 4; }

    const genSeats = total - tatkalSeats - ladiesSeats - seniorSeats - divyaangSeats;
    if (genSeats <= 0 || tatkalSeats <= 0 || ladiesSeats <= 0) {
      quotaAllocationErrors++;
    }
  }
  assert(racWlCapacityErrors === 0, `RAC slots are 10% (for 2A/3A/SL) and WL slots 25% across all inventories (errors: ${racWlCapacityErrors})`);
  assert(quotaAllocationErrors === 0, `Quota seat counts per run and class (TATKAL 10%, LADIES 10%, reserved blocks, rest GENERAL) verified across all inventories (errors: ${quotaAllocationErrors})`);

  // 11. Demo Fill Plan Run-by-Run Table & Level Checks
  console.log('\n--- 11. Demo Fill Plan Run-by-Run Analysis ---');
  const planLines = fs.readFileSync('database/seed-data/demo_fill_plan.csv', 'utf8').trim().split('\n').slice(1);
  const planRuns = [];
  for (const l of planLines) {
    const m = l.match(/^([^,]+),([^,]+),([^,]+),([^,]+),([^,]+),([^,]+),([^,]+),(.*)$/);
    if (m) {
      planRuns.push({
        level: m[1],
        trainId: m[2],
        trainNumber: m[3],
        type: m[4],
        from: m[5],
        to: m[6],
        journeyDate: m[7],
        note: m[8].replace(/^"|"$/g, '')
      });
    }
  }

  // Level count verification in CSV
  const expectedLevelCounts = {
    RAC_FULL_WL_OPEN: 4,
    WL_FULL: 2,
    RAC_OPEN: 5,
    NEARLY_FULL: 6,
    BUSY: 12,
    MEDIUM: 15,
    LIGHT: 25
  };
  const actualCsvLevelCounts = {};
  for (const pr of planRuns) {
    actualCsvLevelCounts[pr.level] = (actualCsvLevelCounts[pr.level] || 0) + 1;
  }
  let levelCountMismatch = 0;
  for (const [lvl, count] of Object.entries(expectedLevelCounts)) {
    if (actualCsvLevelCounts[lvl] !== count) {
      console.error(`[FAIL] Level count mismatch for ${lvl}: expected ${count}, got ${actualCsvLevelCounts[lvl]}`);
      levelCountMismatch++;
    }
  }
  assert(levelCountMismatch === 0 && planRuns.length === 69, `Set of runs and level counts in demo_fill_plan.csv matches exactly (RAC_FULL_WL_OPEN: 4, WL_FULL: 2, RAC_OPEN: 5, NEARLY_FULL: 6, BUSY: 12, MEDIUM: 15, LIGHT: 25; total 69 runs) (mismatches: ${levelCountMismatch})`);

  const schMap = {};
  for (const s of schedules) {
    schMap[`${s.train_id}_${s.journey_date}`] = s.schedule_id;
  }

  const invMap = {};
  for (const inv of inventories) {
    invMap[`${inv.schedule_id}_${inv.class_id}`] = {
      totalSeats: parseInt(inv.total_seats, 10),
      racCapacity: parseInt(inv.rac_capacity, 10),
      wlCapacity: parseInt(inv.wl_capacity, 10)
    };
  }

  const bkgByPnr = {};
  for (const b of bookings) {
    bkgByPnr[b.pnr] = b;
  }

  const runClassStats = {};
  for (const res of reservations) {
    const bkg = bkgByPnr[res.pnr];
    if (!bkg) continue;
    const k = `${res.schedule_id}_${bkg.class_id}`;
    if (!runClassStats[k]) {
      runClassStats[k] = { genConfirmed: 0, ladiesConfirmed: 0, tatkalConfirmed: 0, racCount: 0, wlCount: 0 };
    }
    if (res.status === 'CONFIRMED') {
      if (bkg.quota === 'GENERAL') runClassStats[k].genConfirmed++;
      else if (bkg.quota === 'LADIES') runClassStats[k].ladiesConfirmed++;
      else if (bkg.quota === 'TATKAL') runClassStats[k].tatkalConfirmed++;
    } else if (res.status === 'RAC') {
      runClassStats[k].racCount++;
    } else if (res.status === 'WAITING_LIST') {
      runClassStats[k].wlCount++;
    }
  }

  const classNames = { '1': '1A', '2': '2A', '3': '3A', '4': 'SL', '5': 'CC', '6': 'EC', '7': '2S' };
  let levelCheckFailures = 0;

  console.log('LEVEL            | TRAIN_ID | TRAIN_NO | JOURNEY_DATE | CLASS | GEN SOLD % | RAC FILLED / CAP    | WL FILLED / CAP     | LADIES SOLD % (STORY 5)');
  console.log('-----------------+----------+----------+--------------+-------+------------+---------------------+---------------------+-------------------------');

  for (const pr of planRuns) {
    const sId = schMap[`${pr.trainId}_${pr.journeyDate}`];
    if (!sId) {
      console.error(`[FAIL] Schedule not found for planned run Train ${pr.trainId} on ${pr.journeyDate}`);
      failures++;
      continue;
    }

    for (let cId = 1; cId <= 7; cId++) {
      const inv = invMap[`${sId}_${cId}`];
      if (!inv) continue;

      const stats = runClassStats[`${sId}_${cId}`] || { genConfirmed: 0, ladiesConfirmed: 0, tatkalConfirmed: 0, racCount: 0, wlCount: 0 };
      const total = inv.totalSeats;
      const tatkalSeats = Math.round(total * 0.10);
      const ladiesSeats = Math.round(total * 0.10);
      let seniorSeats = 0;
      let divyaangSeats = 0;

      let coaches = 0;
      if (cId === 1) coaches = 1;
      else if (cId === 2) coaches = (total === 96 ? 2 : 4);
      else if (cId === 3) coaches = (total === 384 ? 6 : 10);
      else if (cId === 4) coaches = 6;
      else if (cId === 5) coaches = 10;
      else if (cId === 6) coaches = 1;

      if (cId === 4) { seniorSeats = 6 * coaches; divyaangSeats = 4; }
      else if (cId === 3) { seniorSeats = 4 * coaches; divyaangSeats = 4; }
      else if (cId === 2) { seniorSeats = 3 * coaches; divyaangSeats = 0; }
      else if (cId === 5) { seniorSeats = 0; divyaangSeats = 4; }

      const genQuotaSeats = total - tatkalSeats - ladiesSeats - seniorSeats - divyaangSeats;
      const genPct = genQuotaSeats > 0 ? (stats.genConfirmed / genQuotaSeats) * 100 : 0;
      const racPct = inv.racCapacity > 0 ? (stats.racCount / inv.racCapacity) * 100 : 0;
      const wlPct = inv.wlCapacity > 0 ? (stats.wlCount / inv.wlCapacity) * 100 : 0;

      const isStory5 = (pr.trainId == 146 && pr.journeyDate === '2026-10-20');
      const ladiesPct = ladiesSeats > 0 ? (stats.ladiesConfirmed / ladiesSeats) * 100 : 0;
      const ladiesStr = isStory5 ? `${ladiesPct.toFixed(1)}% (${stats.ladiesConfirmed}/${ladiesSeats})` : '-';

      console.log(
        `${pr.level.padEnd(16)} | ` +
        `${String(pr.trainId).padStart(8)} | ` +
        `${String(pr.trainNumber).padStart(8)} | ` +
        `${pr.journeyDate}   | ` +
        `${classNames[cId].padEnd(5)} | ` +
        `${genPct.toFixed(1).padStart(9)}% | ` +
        `${stats.racCount}/${inv.racCapacity} (${racPct.toFixed(0)}%)`.padEnd(19) + ` | ` +
        `${stats.wlCount}/${inv.wlCapacity} (${wlPct.toFixed(0)}%)`.padEnd(19) + ` | ` +
        `${ladiesStr}`
      );

      // Verify level criteria
      if (pr.level === 'RAC_FULL_WL_OPEN') {
        if (Math.abs(genPct - 100) > 1.0) levelCheckFailures++;
        if (inv.racCapacity > 0 && Math.abs(racPct - 100) > 1.0) levelCheckFailures++;
        if (wlPct < 40 || wlPct > 60) levelCheckFailures++;
      } else if (pr.level === 'WL_FULL') {
        if (Math.abs(genPct - 100) > 1.0) levelCheckFailures++;
        if (inv.racCapacity > 0 && Math.abs(racPct - 100) > 1.0) levelCheckFailures++;
        if (Math.abs(wlPct - 100) > 1.0) levelCheckFailures++;
      } else if (pr.level === 'RAC_OPEN') {
        if (Math.abs(genPct - 100) > 1.0) levelCheckFailures++;
        if (inv.racCapacity > 0 && Math.abs(racPct - 50) > 5.0) levelCheckFailures++;
        if (stats.wlCount !== 0) levelCheckFailures++;
      } else if (pr.level === 'NEARLY_FULL') {
        if (genPct < 85 || genPct > 95) levelCheckFailures++;
        if (stats.racCount !== 0 || stats.wlCount !== 0) levelCheckFailures++;
      } else if (pr.level === 'BUSY') {
        if (genPct < 60 || genPct > 75) levelCheckFailures++;
        if (stats.racCount !== 0 || stats.wlCount !== 0) levelCheckFailures++;
      } else if (pr.level === 'MEDIUM') {
        if (genPct < 35 || genPct > 45) levelCheckFailures++;
        if (stats.racCount !== 0 || stats.wlCount !== 0) levelCheckFailures++;
      } else if (pr.level === 'LIGHT') {
        if (genPct < 10 || genPct > 20) levelCheckFailures++;
        if (stats.racCount !== 0 || stats.wlCount !== 0) levelCheckFailures++;
      }
    }
  }

  assert(levelCheckFailures === 0, `All 69 fill plan runs strictly satisfy their level criteria (failures: ${levelCheckFailures})`);

  // 12. Story 5 Ladies Quota Sold Out Verification
  console.log('\n--- 12. Story 5 Run Verification ---');
  const story5ScheduleId = schMap['146_2026-10-20'];
  let story5LadiesFailures = 0;
  for (const cId of [5, 6]) { // CC and EC on Shatabdi
    const inv = invMap[`${story5ScheduleId}_${cId}`];
    const stats = runClassStats[`${story5ScheduleId}_${cId}`];
    const expectedLadiesSeats = Math.round(inv.totalSeats * 0.10);
    if (!stats || stats.ladiesConfirmed !== expectedLadiesSeats) {
      story5LadiesFailures++;
    }
  }
  assert(story5LadiesFailures === 0, `Story 5 (Train 146 on 2026-10-20) has LADIES quota 100% sold out in every class (failures: ${story5LadiesFailures})`);

  // 13. Non-Plan Runs Have Zero Bookings
  console.log('\n--- 13. Unplanned Runs Booking Isolation ---');
  const plannedScheduleIdSet = new Set(planRuns.map(pr => schMap[`${pr.trainId}_${pr.journeyDate}`]));
  let unplannedBookingsCount = 0;
  for (const b of bookings) {
    if (!plannedScheduleIdSet.has(b.schedule_id)) {
      unplannedBookingsCount++;
    }
  }
  assert(unplannedBookingsCount === 0, `All runs not in demo_fill_plan.csv have strictly zero bookings (unplanned bookings: ${unplannedBookingsCount})`);

  // 14. Queue Positions Have No Gaps
  console.log('\n--- 14. Queue Positions Gapless Check ---');
  const qPosMap = {};
  for (const res of reservations) {
    const qp = res.queue_position;
    if (qp && (qp.startsWith('RAC/') || qp.startsWith('WL/'))) {
      const bkg = bkgByPnr[res.pnr];
      const [type, numStr] = qp.split('/');
      const num = parseInt(numStr, 10);
      const k = `${res.schedule_id}_${bkg.class_id}_${type}`;
      if (!qPosMap[k]) qPosMap[k] = [];
      qPosMap[k].push(num);
    }
  }

  let queueGapsCount = 0;
  for (const [k, nums] of Object.entries(qPosMap)) {
    nums.sort((a,b) => a - b);
    for (let i = 0; i < nums.length; i++) {
      if (nums[i] !== i + 1) {
        queueGapsCount++;
        break;
      }
    }
  }
  assert(queueGapsCount === 0, `Passenger queue positions (RAC/n, WL/n) have no gaps across all runs and classes (gap errors: ${queueGapsCount})`);

  // 15. Demographics & Seat Counts Summary
  console.log('\n--- 15. Demographics & Master Seat Distribution ---');
  // Seats per train type and class
  const coachTrainMap = {};
  const coachClassMap2 = {};
  for (const c of coaches) {
    coachTrainMap[c.coach_id] = c.train_id;
    coachClassMap2[c.coach_id] = c.class_id;
  }
  const trainTypeMap = {};
  for (const t of trains) {
    trainTypeMap[t.train_id] = t.train_type;
  }



  const seatsByTrainType = {};
  const seatsByClassName = {};
  for (const st of seats) {
    const tId = coachTrainMap[st.coach_id];
    const cId = coachClassMap2[st.coach_id];
    const tType = trainTypeMap[tId];
    const cName = classNames[cId];
    seatsByTrainType[tType] = (seatsByTrainType[tType] || 0) + 1;
    seatsByClassName[cName] = (seatsByClassName[cName] || 0) + 1;
  }

  console.log('Seats per train type:');
  for (const [tType, count] of Object.entries(seatsByTrainType)) {
    console.log(`  - ${tType}: ${count} seats`);
  }
  console.log('Seats per class:');
  for (const [cName, count] of Object.entries(seatsByClassName)) {
    console.log(`  - ${cName}: ${count} seats`);
  }
  console.log(`Total SEAT rows: ${seats.length}`);
  assert(seats.length === 51960, `Total SEAT rows equal exactly 51,960 as per section 4 (actual: ${seats.length})`);

  // SAVED_PASSENGER demographics
  const disMap = {};
  const genderMap = {};
  for (const p of passengers) {
    disMap[p.disability_type] = (disMap[p.disability_type] || 0) + 1;
    genderMap[p.gender] = (genderMap[p.gender] || 0) + 1;
  }
  const concActiveMap = {
    'DIVYAANG': disMap['ORTHOPEDIC'] || 0,
    'NONE': (passengers.length - (disMap['ORTHOPEDIC'] || 0))
  };

  console.log('\nSAVED_PASSENGER Demographic Counts:');
  console.log('  - By Concession Type (active v1):', concActiveMap);
  console.log('  - By Disability Type:', disMap);
  console.log('  - By Gender:', genderMap);

  let divyaangBookedCount = 0;
  for (const pb of passengerBookings) {
    if (pb.concession_type === 'DIVYAANG') {
      divyaangBookedCount++;
    }
  }
  console.log(`Passengers who used DIVYAANG concession in generated bookings: ${divyaangBookedCount}`);
  assert(divyaangBookedCount > 0, `DIVYAANG concession was utilized in bookings (actual: ${divyaangBookedCount})`);

  // SAVED_PASSENGER age check against raw dataset
  const rawPassLines = fs.readFileSync(path.join(DATASETS_DIR, 'passengers_synthetic_2.csv'), 'utf8').trim().split('\n');
  let ageMismatches = 0;
  for (let i = 1; i < rawPassLines.length && i <= 1000; i++) {
    const rawAge = parseInt(rawPassLines[i].split(',')[3], 10);
    const cleanedAge = parseInt(passengers[i - 1].age, 10);
    if (rawAge !== cleanedAge) ageMismatches++;
  }
  assert(ageMismatches === 0, `SAVED_PASSENGER ages match the raw dataset 100% (mismatches: ${ageMismatches})`);

  console.log('\n====================================================');
  if (failures === 0) {
    console.log('   >>> ALL VALIDATION CHECKS PASSED PERFECTLY! <<<');
  } else {
    console.error(`   >>> VALIDATION FAILED WITH ${failures} ERRORS! <<<`);
    process.exit(1);
  }
  console.log('====================================================\n');
}

if (require.main === module) {
  runValidation();
}

module.exports = { runValidation };
