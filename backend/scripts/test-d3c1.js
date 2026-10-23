/**
 * Railway Reservation System - Master Test Suite D3c-1
 * Chart Preparation Pipeline, Admin Settings, Maintenance Tasks & Staff Chart Manifest View
 */

const http = require('http');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '../../database/.env') });
dotenv.config({ path: path.join(__dirname, '../.env') });

const app = require('../src/app');
const pool = require('../src/config/mysql');

let server;
let baseUrl;

function startServer() {
  return new Promise((resolve) => {
    server = http.createServer(app);
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      baseUrl = `http://127.0.0.1:${port}`;
      console.log(`[Test Runner] Express test server listening on ${baseUrl}`);
      resolve();
    });
  });
}

function stopServer() {
  return new Promise((resolve) => {
    if (server) {
      server.close(() => {
        console.log('[Test Runner] Express test server closed.');
        resolve();
      });
    } else {
      resolve();
    }
  });
}

async function request(method, endpoint, body = null, token = null) {
  const url = `${baseUrl}${endpoint}`;
  const headers = { 'Content-Type': 'application/json' };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  const opts = { method, headers };
  if (body) {
    opts.body = JSON.stringify(body);
  }
  const res = await fetch(url, opts);
  const data = await res.json().catch(() => ({}));
  return { status: res.status, ok: res.ok, data };
}

let totalTests = 0;
let passedTests = 0;

function assert(condition, message) {
  totalTests++;
  if (!condition) {
    console.error(`  FAIL: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
  passedTests++;
  console.log(`  PASS: ${message}`);
}

async function runInventoryAudit() {
  const [resRows] = await pool.query(`
    SELECT 
      r.schedule_id,
      b.class_id,
      SUM(CASE WHEN r.status IN ('CONFIRMED', 'BOARDED') THEN 1 ELSE 0 END) AS confirmed_boarded_count,
      SUM(CASE WHEN r.status = 'RAC' THEN 1 ELSE 0 END) AS rac_count,
      SUM(CASE WHEN r.status = 'WAITING_LIST' THEN 1 ELSE 0 END) AS wl_count
    FROM RESERVATION r
    JOIN BOOKING b ON r.pnr = b.pnr
    GROUP BY r.schedule_id, b.class_id
  `);

  const resMap = {};
  for (const row of resRows) {
    const key = `${row.schedule_id}_${row.class_id}`;
    resMap[key] = {
      confirmed_boarded: parseInt(row.confirmed_boarded_count, 10),
      rac: parseInt(row.rac_count, 10),
      wl: parseInt(row.wl_count, 10)
    };
  }

  const [invRows] = await pool.query(`
    SELECT 
      inventory_id, schedule_id, class_id, total_seats, available_seats,
      rac_capacity, rac_count, wl_capacity, wl_count
    FROM SCHEDULE_CLASS_INVENTORY
    ORDER BY schedule_id, class_id
  `);

  const mismatches = [];
  for (const inv of invRows) {
    const key = `${inv.schedule_id}_${inv.class_id}`;
    const real = resMap[key] || { confirmed_boarded: 0, rac: 0, wl: 0 };
    const expected_available = inv.total_seats - real.confirmed_boarded;
    const expected_rac = real.rac;
    const expected_wl = real.wl;

    if (
      inv.available_seats !== expected_available ||
      inv.rac_count !== expected_rac ||
      inv.wl_count !== expected_wl
    ) {
      mismatches.push(inv);
    }
  }

  return { mismatches: mismatches.length, total: invRows.length };
}

async function runTests() {
  console.log('================================================================');
  console.log(' RAILWAY RESERVATION SYSTEM - SUITE D3C-1');
  console.log(' Chart Prep, Admin Settings, Maintenance & Staff Chart Manifest');
  console.log('================================================================');

  const baselineAudit = await runInventoryAudit();
  console.log(`\n--- BASELINE INVENTORY AUDIT: ${baselineAudit.mismatches} mismatches of ${baselineAudit.total} ---`);
  assert(baselineAudit.mismatches === 0, `Baseline inventory audit has 0 mismatches of ${baselineAudit.total}`);

  await pool.query('DELETE FROM STAFF_ASSIGNMENT WHERE assign_id > 100');

  await startServer();

  try {
    // -------------------------------------------------------------------------
    // SETUP: Authenticate Test Users
    // -------------------------------------------------------------------------
    console.log('\n--- SETUP: Authenticating Test Users ---');

    // Admin login
    const adminLogin = await request('POST', '/api/auth/admin/login', {
      email: 'admin@railways.gov.in',
      password: 'AdminPassword123!'
    });
    assert(adminLogin.status === 200, 'Admin (admin@railways.gov.in) logged in successfully');
    const tokenAdmin = adminLogin.data.data.token;

    // Staff 1 login (EMP-TC-101, TRAIN_DUTY on schedule 1001)
    const staff1Login = await request('POST', '/api/auth/staff/login', {
      employeeId: 'EMP-TC-101',
      password: 'StaffPassword123!'
    });
    assert(staff1Login.status === 200, 'Staff 1 (EMP-TC-101) logged in successfully');
    const tokenStaff1 = staff1Login.data.data.token;

    // Staff 3 login (EMP-TC-103, COUNTER_DUTY in seed)
    const staff3Login = await request('POST', '/api/auth/staff/login', {
      employeeId: 'EMP-TC-103',
      password: 'StaffPassword123!'
    });
    assert(staff3Login.status === 200, 'Staff 3 (EMP-TC-103) logged in successfully');
    const tokenStaff3 = staff3Login.data.data.token;

    // Passenger login
    const passengerLogin = await request('POST', '/api/auth/passenger/login', {
      email: 'rahul.sharma@example.com',
      password: 'Password123!'
    });
    assert(passengerLogin.status === 200, 'Passenger (rahul.sharma@example.com) logged in successfully');
    const tokenPassenger = passengerLogin.data.data.token;

    // -------------------------------------------------------------------------
    // TEST SECTION 1: Admin Settings Management (Contract 7.1, Section 15)
    // -------------------------------------------------------------------------
    console.log('\n--- TEST SECTION 1: Admin Settings Management (Contract 7.1) ---');

    // 1a. Non-admin calls are refused with 403 Forbidden
    const unauthSettingsGet = await request('GET', '/api/admin/settings', null, tokenPassenger);
    assert(unauthSettingsGet.status === 403, 'Passenger GET /api/admin/settings refused with 403 Forbidden');

    const staffSettingsPut = await request('PUT', '/api/admin/settings/BOOKING_WINDOW_DAYS', { value: '14' }, tokenStaff1);
    assert(staffSettingsPut.status === 403, 'Staff PUT /api/admin/settings/:key refused with 403 Forbidden');

    // 1b. Admin GET /api/admin/settings lists all 13 keys
    const settingsRes = await request('GET', '/api/admin/settings', null, tokenAdmin);
    assert(settingsRes.status === 200, 'Admin GET /api/admin/settings returned 200 OK');
    assert(Array.isArray(settingsRes.data.data), 'Settings response data is an array');

    const expectedKeys = [
      'BOOKING_WINDOW_DAYS',
      'CHART_HOURS_BEFORE_ORIGIN_DEPARTURE',
      'CLERKAGE_PER_PASSENGER',
      'CONCESSION_SENIOR_ENABLED',
      'DYNAMIC_FARE_ENABLED',
      'GST_RATE_AC',
      'HOLD_MINUTES',
      'INSURANCE_PREMIUM_PER_PASSENGER',
      'MAX_PASSENGERS_PER_PNR',
      'MAX_PASSENGERS_PER_PNR_TATKAL',
      'MAX_TICKETS_PER_MONTH',
      'MAX_TICKETS_PER_MONTH_AADHAAR_VERIFIED',
      'MIN_CHARGEABLE_DISTANCE_KM'
    ];

    assert(settingsRes.data.data.length === 13, `Settings count is exactly 13 (found ${settingsRes.data.data.length})`);
    const returnedKeys = settingsRes.data.data.map(s => s.settingKey);
    for (const k of expectedKeys) {
      assert(returnedKeys.includes(k), `Settings list contains required key: ${k}`);
    }

    // 1c. Invalid values refused
    const unknownKeyPut = await request('PUT', '/api/admin/settings/UNKNOWN_NON_EXISTENT_KEY', { value: '10' }, tokenAdmin);
    assert(unknownKeyPut.status === 400, 'Unknown setting key refused with 400 Bad Request');
    assert(unknownKeyPut.data.error.code === 'BAD_REQUEST', 'Unknown key returns canonical code BAD_REQUEST');

    const negNumPut = await request('PUT', '/api/admin/settings/HOLD_MINUTES', { value: '-5' }, tokenAdmin);
    assert(negNumPut.status === 400, 'Negative numeric setting refused with 400 Bad Request');

    const zeroNumPut = await request('PUT', '/api/admin/settings/HOLD_MINUTES', { value: '0' }, tokenAdmin);
    assert(zeroNumPut.status === 400, 'Zero numeric setting refused with 400 Bad Request');

    const nanPut = await request('PUT', '/api/admin/settings/HOLD_MINUTES', { value: 'not_a_number' }, tokenAdmin);
    assert(nanPut.status === 400, 'Non-numeric string for numeric setting refused with 400 Bad Request');

    const invalidBoolPut1 = await request('PUT', '/api/admin/settings/DYNAMIC_FARE_ENABLED', { value: 'yes' }, tokenAdmin);
    assert(invalidBoolPut1.status === 400, 'Non-boolean "yes" for flag setting refused with 400 Bad Request');

    const invalidBoolPut2 = await request('PUT', '/api/admin/settings/DYNAMIC_FARE_ENABLED', { value: '1' }, tokenAdmin);
    assert(invalidBoolPut2.status === 400, 'Non-boolean "1" for flag setting refused with 400 Bad Request');

    // 1d. Valid PUT & Audit Verification (Trigger writes the audit row)
    const [auditBefore] = await pool.query("SELECT COUNT(*) AS cnt FROM AUDIT_LOG WHERE table_name = 'SETTING'");
    const auditCountBefore = auditBefore[0].cnt;

    const [currentHold] = await pool.query("SELECT setting_value FROM SETTING WHERE setting_key = 'HOLD_MINUTES'");
    const origHoldValue = currentHold[0].setting_value;

    const validPut = await request('PUT', '/api/admin/settings/HOLD_MINUTES', { value: '15' }, tokenAdmin);
    assert(validPut.status === 200, 'Valid PUT /api/admin/settings/HOLD_MINUTES returned 200 OK');
    assert(validPut.data.data.settingKey === 'HOLD_MINUTES', 'Response settingKey is HOLD_MINUTES');
    assert(validPut.data.data.settingValue === '15', 'Response settingValue is 15');

    const [auditAfter] = await pool.query("SELECT COUNT(*) AS cnt FROM AUDIT_LOG WHERE table_name = 'SETTING'");
    const auditCountAfter = auditAfter[0].cnt;
    assert(auditCountAfter === auditCountBefore + 1, `Exactly one AUDIT_LOG row written by trigger (before: ${auditCountBefore}, after: ${auditCountAfter})`);

    const [latestAudit] = await pool.query(
      "SELECT action, table_name, record_id, old_value, new_value FROM AUDIT_LOG WHERE table_name = 'SETTING' ORDER BY log_id DESC LIMIT 1"
    );
    assert(latestAudit[0].action === 'UPDATE_SETTING', 'AUDIT_LOG action is UPDATE_SETTING');
    assert(latestAudit[0].record_id === 'HOLD_MINUTES', 'AUDIT_LOG record_id is HOLD_MINUTES');
    const oldValObj = typeof latestAudit[0].old_value === 'string' ? JSON.parse(latestAudit[0].old_value) : latestAudit[0].old_value;
    const newValObj = typeof latestAudit[0].new_value === 'string' ? JSON.parse(latestAudit[0].new_value) : latestAudit[0].new_value;
    assert(oldValObj.setting_value === origHoldValue, `AUDIT_LOG old_value matches original (${origHoldValue})`);
    assert(newValObj.setting_value === '15', 'AUDIT_LOG new_value matches new value (15)');

    // Revert HOLD_MINUTES back to original value
    await request('PUT', '/api/admin/settings/HOLD_MINUTES', { value: origHoldValue }, tokenAdmin);
    console.log(`  PASS: HOLD_MINUTES successfully reverted back to ${origHoldValue}`);

    // -------------------------------------------------------------------------
    // TEST SECTION 2: Maintenance Tasks (Contract 6.1, 6.2, Section 13)
    // -------------------------------------------------------------------------
    console.log('\n--- TEST SECTION 2: Maintenance Tasks (Contract 6.1, 6.2) ---');

    // 2a. Wrong role refused
    const unauthMaintPost = await request('POST', '/api/maintenance/tasks', { coachId: 1, type: 'CLEANING' }, tokenPassenger);
    assert(unauthMaintPost.status === 403, 'Passenger POST /api/maintenance/tasks refused with 403 Forbidden');

    const staffNoDutyMaintPost = await request('POST', '/api/maintenance/tasks', { coachId: 1, type: 'CLEANING' }, tokenStaff1);
    assert(staffNoDutyMaintPost.status === 403, 'Staff without MAINTENANCE_DUTY refused with 403 Forbidden');

    const unauthMaintPut = await request('PUT', '/api/maintenance/tasks/1/status', { status: 'IN_PROGRESS' }, tokenPassenger);
    assert(unauthMaintPut.status === 403, 'Passenger PUT /api/maintenance/tasks/:maintId/status refused with 403 Forbidden');

    const staffNoDutyMaintPut = await request('PUT', '/api/maintenance/tasks/1/status', { status: 'IN_PROGRESS' }, tokenStaff1);
    assert(staffNoDutyMaintPut.status === 403, 'Staff without MAINTENANCE_DUTY PUT status refused with 403 Forbidden');

    // 2b. Creation validations (Enforce CHECK: exactly one of coachId or platformId)
    const bothNullPost = await request('POST', '/api/maintenance/tasks', { type: 'CLEANING' }, tokenAdmin);
    assert(bothNullPost.status === 400, 'Creation with both coachId and platformId null refused with 400 Bad Request');

    const bothSetPost = await request('POST', '/api/maintenance/tasks', { coachId: 1, platformId: 1, type: 'CLEANING' }, tokenAdmin);
    assert(bothSetPost.status === 400, 'Creation with both coachId and platformId non-null refused with 400 Bad Request');

    const invalidTypePost = await request('POST', '/api/maintenance/tasks', { coachId: 1, type: 'INVALID_TYPE' }, tokenAdmin);
    assert(invalidTypePost.status === 400, 'Creation with invalid task type refused with 400 Bad Request');

    // 2c. Create task as Admin (Coach maintenance)
    const createMaintAdmin = await request('POST', '/api/maintenance/tasks', {
      coachId: 1,
      type: 'AC_SERVICE',
      description: 'AC unit cooling test'
    }, tokenAdmin);
    assert(createMaintAdmin.status === 201, 'Admin POST /api/maintenance/tasks returned 201 Created');
    assert(createMaintAdmin.data.data.status === 'OPEN', 'Created maintenance task has status OPEN');
    assert(createMaintAdmin.data.data.coachId === 1, 'Created maintenance task has coachId 1');
    assert(createMaintAdmin.data.data.platformId === null, 'Created maintenance task has platformId null');
    const maintId1 = createMaintAdmin.data.data.maintId;
    assert(typeof maintId1 === 'number' && maintId1 > 0, `Created task has numeric maintId: ${maintId1}`);

    // 2d. Create task as Staff with MAINTENANCE_DUTY (Platform maintenance)
    // Add temporary assignment for Staff 3
    await pool.query(`
      INSERT INTO STAFF_ASSIGNMENT (assign_id, staff_id, schedule_id, station_id, duty_type, shift_start, shift_end)
      VALUES (999, 3, NULL, 10, 'MAINTENANCE_DUTY', DATE_SUB(NOW(), INTERVAL 7 DAY), DATE_ADD(NOW(), INTERVAL 30 DAY))
      ON DUPLICATE KEY UPDATE duty_type = 'MAINTENANCE_DUTY', shift_end = DATE_ADD(NOW(), INTERVAL 30 DAY)
    `);

    const createMaintStaff = await request('POST', '/api/maintenance/tasks', {
      platformId: 1,
      type: 'CLEANING',
      description: 'Platform deep cleaning'
    }, tokenStaff3);
    assert(createMaintStaff.status === 201, 'Staff with MAINTENANCE_DUTY POST /api/maintenance/tasks returned 201 Created');
    assert(createMaintStaff.data.data.status === 'OPEN', 'Staff task has status OPEN');
    assert(createMaintStaff.data.data.platformId === 1, 'Staff task has platformId 1');
    assert(createMaintStaff.data.data.coachId === null, 'Staff task has coachId null');
    const maintId2 = createMaintStaff.data.data.maintId;
    assert(typeof maintId2 === 'number' && maintId2 > 0, `Staff task has numeric maintId: ${maintId2}`);

    // 2e. Status move validations on task 1 (OPEN -> IN_PROGRESS -> COMPLETED)
    // Refuse OPEN -> COMPLETED (skipping IN_PROGRESS is not allowed)
    const invalidSkipMove = await request('PUT', `/api/maintenance/tasks/${maintId1}/status`, { status: 'COMPLETED' }, tokenAdmin);
    assert(invalidSkipMove.status === 400, 'Invalid transition OPEN -> COMPLETED refused with 400 Bad Request');

    // Refuse OPEN -> OPEN
    const invalidSameMove = await request('PUT', `/api/maintenance/tasks/${maintId1}/status`, { status: 'OPEN' }, tokenAdmin);
    assert(invalidSameMove.status === 400, 'Invalid transition OPEN -> OPEN refused with 400 Bad Request');

    // Valid transition: OPEN -> IN_PROGRESS
    const validInProgressMove = await request('PUT', `/api/maintenance/tasks/${maintId1}/status`, { status: 'IN_PROGRESS' }, tokenStaff3);
    assert(validInProgressMove.status === 200, 'Valid transition OPEN -> IN_PROGRESS returned 200 OK');
    assert(validInProgressMove.data.data.status === 'IN_PROGRESS', 'Task status updated to IN_PROGRESS');
    assert(validInProgressMove.data.data.completedAt === null, 'completedAt is null for IN_PROGRESS');

    // Refuse IN_PROGRESS -> OPEN
    const invalidReverseMove = await request('PUT', `/api/maintenance/tasks/${maintId1}/status`, { status: 'OPEN' }, tokenStaff3);
    assert(invalidReverseMove.status === 400, 'Invalid transition IN_PROGRESS -> OPEN refused with 400 Bad Request');

    // Valid transition: IN_PROGRESS -> COMPLETED
    const validCompletedMove = await request('PUT', `/api/maintenance/tasks/${maintId1}/status`, {
      status: 'COMPLETED',
      completionRemarks: 'Compressor serviced and tested'
    }, tokenAdmin);
    assert(validCompletedMove.status === 200, 'Valid transition IN_PROGRESS -> COMPLETED returned 200 OK');
    assert(validCompletedMove.data.data.status === 'COMPLETED', 'Task status updated to COMPLETED');
    assert(validCompletedMove.data.data.completedAt !== null, 'completedAt is populated on COMPLETED');

    // Refuse transition from terminal state COMPLETED
    const invalidFromCompleted1 = await request('PUT', `/api/maintenance/tasks/${maintId1}/status`, { status: 'IN_PROGRESS' }, tokenAdmin);
    assert(invalidFromCompleted1.status === 400, 'Invalid transition COMPLETED -> IN_PROGRESS refused with 400 Bad Request');

    const invalidFromCompleted2 = await request('PUT', `/api/maintenance/tasks/${maintId1}/status`, { status: 'CANCELLED' }, tokenAdmin);
    assert(invalidFromCompleted2.status === 400, 'Invalid transition COMPLETED -> CANCELLED refused with 400 Bad Request');

    // Valid transition: OPEN -> CANCELLED on task 2
    const validCancelMove = await request('PUT', `/api/maintenance/tasks/${maintId2}/status`, { status: 'CANCELLED' }, tokenStaff3);
    assert(validCancelMove.status === 200, 'Valid transition OPEN -> CANCELLED returned 200 OK');
    assert(validCancelMove.data.data.status === 'CANCELLED', 'Task status updated to CANCELLED');

    // Non-existent task status update refused with 404
    const notFoundTask = await request('PUT', '/api/maintenance/tasks/999999/status', { status: 'IN_PROGRESS' }, tokenAdmin);
    assert(notFoundTask.status === 404, 'Non-existent task status update returned 404 Not Found');

    // -------------------------------------------------------------------------
    // TEST SECTION 3: Staff Duty Assignment & Chart Manifest View (Contract 5.1)
    // -------------------------------------------------------------------------
    console.log('\n--- TEST SECTION 3: Staff Duty & Chart Manifest View (Contract 5.1) ---');

    // 3a. Current assignment: non-staff refused
    const unauthAssign = await request('GET', '/api/staff/assignments/current', null, tokenPassenger);
    assert(unauthAssign.status === 403, 'Passenger GET /api/staff/assignments/current refused with 403 Forbidden');

    // 3b. Current assignment: Staff 1 (seed shifts are old, so returns most recent with isActive: false)
    const staff1Assign = await request('GET', '/api/staff/assignments/current', null, tokenStaff1);
    assert(staff1Assign.status === 200, 'Staff 1 GET /api/staff/assignments/current returned 200 OK');
    assert(staff1Assign.data.data.isActive === false, 'Current assignment has isActive: false for past seed shift');
    assert(staff1Assign.data.data.dutyType === 'TRAIN_DUTY', 'Duty type is TRAIN_DUTY');
    assert(staff1Assign.data.data.scheduleId === 1001, 'Schedule ID is 1001');
    assert(staff1Assign.data.data.stationId === 21, 'Station ID is 21 (BCT)');

    // Test active-now assignment (isActive: true)
    await pool.query(`
      INSERT INTO STAFF_ASSIGNMENT (assign_id, staff_id, schedule_id, station_id, duty_type, shift_start, shift_end)
      VALUES (997, 1, 1001, 21, 'TRAIN_DUTY', DATE_SUB(NOW(), INTERVAL 1 HOUR), DATE_ADD(NOW(), INTERVAL 2 HOUR))
    `);
    const staff1ActiveAssign = await request('GET', '/api/staff/assignments/current', null, tokenStaff1);
    assert(staff1ActiveAssign.status === 200, 'Staff 1 GET /api/staff/assignments/current (active shift) returned 200 OK');
    assert(staff1ActiveAssign.data.data.isActive === true, 'Current assignment has isActive: true for active shift');
    assert(staff1ActiveAssign.data.data.assignId === 997, 'Returns active assignment ID 997');
    await pool.query('DELETE FROM STAFF_ASSIGNMENT WHERE assign_id = 997');

    // 3c. Chart view before preparation refused
    // Schedule 1001 chart is not prepared yet in seed data
    const chartNotPrepared = await request('GET', '/api/staff/schedules/1001/chart', null, tokenStaff1);
    assert(chartNotPrepared.status === 400, 'GET chart on unprepared schedule refused with 400 Bad Request');
    assert(chartNotPrepared.data.error.code === 'BAD_REQUEST', 'Error code is BAD_REQUEST for unprepared chart');

    // 3d. Unassigned staff refused
    // Staff 1 is assigned to Schedule 1001, NOT Schedule 1111
    const unassignedStaffChart = await request('GET', '/api/staff/schedules/1111/chart', null, tokenStaff1);
    assert(unassignedStaffChart.status === 403, 'Unassigned staff GET /api/staff/schedules/1111/chart refused with 403 Forbidden');

    // Passenger refused
    const passengerChart = await request('GET', '/api/staff/schedules/1111/chart', null, tokenPassenger);
    assert(passengerChart.status === 403, 'Passenger GET chart refused with 403 Forbidden');

    // -------------------------------------------------------------------------
    // TEST SECTION 4: Chart Preparation Pipeline (Contract 7.2, BR-B12a, BR-W8)
    // -------------------------------------------------------------------------
    console.log('\n--- TEST SECTION 4: Chart Preparation Pipeline (Contract 7.2) ---');

    // 4a. Non-admin calls refused
    const passengerPrep = await request('POST', '/api/admin/schedules/1111/chart-preparation', null, tokenPassenger);
    assert(passengerPrep.status === 403, 'Passenger POST chart-preparation refused with 403 Forbidden');

    const staffPrep = await request('POST', '/api/admin/schedules/1111/chart-preparation', null, tokenStaff1);
    assert(staffPrep.status === 403, 'Staff POST chart-preparation refused with 403 Forbidden');

    // 4b. Pre-preparation assertions on Schedule 1111 (Train 119 on 2026-10-19)
    const [sched1111Before] = await pool.query('SELECT chart_prepared_at FROM TRAIN_SCHEDULE WHERE schedule_id = 1111');
    assert(sched1111Before[0].chart_prepared_at === null, 'Schedule 1111 chart_prepared_at is initially NULL');

    const [wlBefore] = await pool.query("SELECT COUNT(*) AS cnt FROM RESERVATION WHERE schedule_id = 1111 AND status = 'WAITING_LIST'");
    const wlCountBefore = wlBefore[0].cnt;
    assert(wlCountBefore === 107, `Schedule 1111 initially has 107 WAITING_LIST reservations (found ${wlCountBefore})`);

    const [confRacBefore] = await pool.query("SELECT COUNT(*) AS cnt FROM RESERVATION WHERE schedule_id = 1111 AND status IN ('CONFIRMED', 'RAC')");
    const confRacCountBefore = confRacBefore[0].cnt;
    assert(confRacCountBefore === 817, `Schedule 1111 initially has 817 CONFIRMED+RAC reservations (found ${confRacCountBefore})`);

    const [refundBefore] = await pool.query("SELECT COUNT(*) AS cnt, COALESCE(SUM(amount), 0) AS total FROM REFUND WHERE reason = 'WAITLIST_PURGE'");
    const purgeCountBefore = refundBefore[0].cnt;

    // 4c. Execute Chart Preparation via Admin API
    const prepRes = await request('POST', '/api/admin/schedules/1111/chart-preparation', null, tokenAdmin);
    assert(prepRes.status === 200, 'Admin POST /api/admin/schedules/1111/chart-preparation returned 200 OK');

    const prepData = prepRes.data.data;
    assert(prepData.scheduleId === 1111, 'Response scheduleId is 1111');
    assert(prepData.trainNumber === '12431', 'Response trainNumber is 12431');
    assert(prepData.journeyDate === '2026-10-19', 'Response journeyDate is 2026-10-19');
    assert(typeof prepData.chartPreparedAt === 'string' && prepData.chartPreparedAt.length > 0, 'chartPreparedAt is valid timestamp');

    assert(prepData.summary.waitlistedPassengersCancelled === 107, `summary.waitlistedPassengersCancelled is 107 (got ${prepData.summary.waitlistedPassengersCancelled})`);
    assert(prepData.summary.chartSnapshotRowsPersisted > 0, `summary.chartSnapshotRowsPersisted is positive (got ${prepData.summary.chartSnapshotRowsPersisted})`);
    assert(prepData.summary.totalRefundsDisbursed > 0, `summary.totalRefundsDisbursed is positive (${prepData.summary.totalRefundsDisbursed})`);

    const expectedSnapshotCount = prepData.summary.chartSnapshotRowsPersisted;

    // 4d. Post-preparation Database State Assertions
    // (1) Snapshot rows exist
    const [snapRows] = await pool.query('SELECT COUNT(*) AS cnt FROM CHART_SNAPSHOT WHERE schedule_id = 1111');
    assert(snapRows[0].cnt === expectedSnapshotCount, `CHART_SNAPSHOT table has exactly ${expectedSnapshotCount} persisted rows for schedule 1111 (found ${snapRows[0].cnt})`);

    // (2) Waiting list is 0
    const [wlAfter] = await pool.query("SELECT COUNT(*) AS cnt FROM RESERVATION WHERE schedule_id = 1111 AND status = 'WAITING_LIST'");
    assert(wlAfter[0].cnt === 0, `RESERVATION table has 0 WAITING_LIST records for schedule 1111 (found ${wlAfter[0].cnt})`);

    // (3) Purge refunds match REFUND rows
    const [refundAfter] = await pool.query("SELECT COUNT(*) AS cnt, COALESCE(SUM(amount), 0) AS total FROM REFUND WHERE reason = 'WAITLIST_PURGE'");
    const newPurgeRefunds = refundAfter[0].cnt - purgeCountBefore;
    assert(newPurgeRefunds === 107, `Exactly 107 WAITLIST_PURGE rows added to REFUND table (found ${newPurgeRefunds})`);
    assert(newPurgeRefunds === prepData.summary.waitlistedPassengersCancelled, 'Purge refunds count matches summary.waitlistedPassengersCancelled');

    // (4) Master Inventory Audit: 0 mismatches of 1,015
    const auditAfterPrep = await runInventoryAudit();
    console.log(`\n--- POST-CHART PREPARATION INVENTORY AUDIT: ${auditAfterPrep.mismatches} mismatches of ${auditAfterPrep.total} ---`);
    assert(auditAfterPrep.mismatches === 0, `Post-chart prep inventory audit has exactly 0 mismatches of ${auditAfterPrep.total}`);

    // (5) Second call is safe (idempotent, does not re-run or duplicate)
    const secondPrep = await request('POST', '/api/admin/schedules/1111/chart-preparation', null, tokenAdmin);
    assert(secondPrep.status === 200, 'Second call to chart-preparation returned 200 OK safely');
    assert(secondPrep.data.data.summary.chartSnapshotRowsPersisted === expectedSnapshotCount, `Second call returns existing snapshot count (${expectedSnapshotCount})`);
    assert(secondPrep.data.data.summary.waitlistedPassengersCancelled === 107, 'Second call returns existing waitlist purge count (107)');
    assert(secondPrep.data.data.summary.totalRefundsDisbursed === prepData.summary.totalRefundsDisbursed, 'Second call returns existing total refund amount');

    // Confirm no duplicate snapshots were created
    const [snapRowsSecond] = await pool.query('SELECT COUNT(*) AS cnt FROM CHART_SNAPSHOT WHERE schedule_id = 1111');
    assert(snapRowsSecond[0].cnt === expectedSnapshotCount, `Snapshot row count remains strictly ${expectedSnapshotCount} after second call`);

    // 4e. Chart View after preparation
    // Admin can view chart manifest
    const adminChartView = await request('GET', '/api/staff/schedules/1111/chart', null, tokenAdmin);
    assert(adminChartView.status === 200, 'Admin GET /api/staff/schedules/1111/chart returned 200 OK');
    assert(Array.isArray(adminChartView.data.data), 'Chart manifest data is an array');
    assert(adminChartView.data.data.length === expectedSnapshotCount, `Chart manifest contains exactly ${expectedSnapshotCount} rows (found ${adminChartView.data.data.length})`);
    assert(adminChartView.data.data[0].pnr && adminChartView.data.data[0].coachNo, 'Chart row contains required PNR and Coach details');

    // Assign Staff 1 to Schedule 1111, then Staff 1 can view chart manifest
    await pool.query(`
      INSERT INTO STAFF_ASSIGNMENT (assign_id, staff_id, schedule_id, station_id, duty_type, shift_start, shift_end)
      VALUES (998, 1, 1111, 69, 'TRAIN_DUTY', DATE_SUB(NOW(), INTERVAL 7 DAY), DATE_ADD(NOW(), INTERVAL 30 DAY))
      ON DUPLICATE KEY UPDATE duty_type = 'TRAIN_DUTY', schedule_id = 1111, shift_end = DATE_ADD(NOW(), INTERVAL 30 DAY)
    `);

    const staffChartView = await request('GET', '/api/staff/schedules/1111/chart', null, tokenStaff1);
    assert(staffChartView.status === 200, 'Assigned Staff 1 GET /api/staff/schedules/1111/chart returned 200 OK');
    assert(staffChartView.data.data.length === expectedSnapshotCount, `Staff chart view returns ${expectedSnapshotCount} rows`);

    // Clean up temporary test assignments
    await pool.query('DELETE FROM STAFF_ASSIGNMENT WHERE assign_id IN (998, 999)');

    console.log('\n================================================================');
    console.log(` SUITE D3C-1 FINISHED: ${passedTests}/${totalTests} TESTS PASSED (100%)`);
    console.log('================================================================');

  } catch (err) {
    console.error('\nTEST SUITE FAILED WITH ERROR:');
    console.error(err);
    process.exitCode = 1;
  } finally {
    // Clean up temporary test assignments if any left
    try {
      await pool.query('DELETE FROM STAFF_ASSIGNMENT WHERE assign_id IN (998, 999)');
    } catch (_) {}

    await stopServer();
    await pool.end();
  }
}

runTests();
