/**
 * Railway Reservation System - Master Test Suite D3c-2
 * Fines, Incidents, Live Reports, Admin Audit Logs, Reports & Staff Accounts
 */

const http = require('http');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '../../database/.env') });
dotenv.config({ path: path.join(__dirname, '../.env') });

const app = require('../src/app');
const pool = require('../src/config/mysql');
const { closeMongo } = require('../src/config/mongodb');

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
      if (typeof server.closeAllConnections === 'function') {
        server.closeAllConnections();
      }
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
    JOIN BOOKING b ON r.pnr = b.pnr AND r.passenger_no = b.from_stop_id * 0 + r.passenger_no
    GROUP BY r.schedule_id, b.class_id
  `);

  const [invRows] = await pool.query(`
    SELECT 
      schedule_id,
      class_id,
      total_seats,
      available_seats,
      rac_count,
      wl_count
    FROM SCHEDULE_CLASS_INVENTORY
  `);

  const resMap = new Map();
  for (const row of resRows) {
    resMap.set(`${row.schedule_id}-${row.class_id}`, row);
  }

  let mismatches = 0;
  for (const inv of invRows) {
    const key = `${inv.schedule_id}-${inv.class_id}`;
    const res = resMap.get(key) || { confirmed_boarded_count: 0, rac_count: 0, wl_count: 0 };

    const expectedAvail = inv.total_seats - Number(res.confirmed_boarded_count);
    const actualAvail = inv.available_seats;
    const actualRac = inv.rac_count;
    const actualWl = inv.wl_count;

    if (
      actualAvail !== expectedAvail ||
      Number(actualRac) !== Number(res.rac_count) ||
      Number(actualWl) !== Number(res.wl_count)
    ) {
      mismatches++;
    }
  }

  return { totalInventories: invRows.length, mismatches };
}

async function runTests() {
  const safetyTimeout = setTimeout(() => {
    console.error('\n[FATAL ERROR]: Safety timeout of 120 seconds reached. Test suite test-d3c2 timed out!');
    process.exit(1);
  }, 120000);
  safetyTimeout.unref();

  console.log('================================================================');
  console.log(' RAILWAY RESERVATION SYSTEM - SUITE D3C-2');
  console.log(' Fines, Incidents, Live Reports, Audit Logs, Reports & Staff Accounts');
  console.log('================================================================');

  try {
    // 0. Baseline Inventory Audit
    const auditBefore = await runInventoryAudit();
    console.log(`\n--- BASELINE INVENTORY AUDIT: ${auditBefore.mismatches} mismatches of ${auditBefore.totalInventories} ---`);
    assert(auditBefore.mismatches === 0, `Baseline inventory audit has 0 mismatches of ${auditBefore.totalInventories}`);

    await startServer();

    // 1. Authenticate users
    console.log('\n--- SETUP: Authenticating Test Users ---');

    const adminLogin = await request('POST', '/api/auth/admin/login', {
      email: 'admin@railways.gov.in',
      password: 'AdminPassword123!'
    });
    assert(adminLogin.status === 200, 'Admin (admin@railways.gov.in) logged in successfully');
    const tokenAdmin = adminLogin.data.data.token;

    const staffLogin1 = await request('POST', '/api/auth/staff/login', {
      employeeId: 'EMP-TC-101',
      password: 'StaffPassword123!'
    });
    assert(staffLogin1.status === 200, 'Staff 1 (EMP-TC-101) logged in successfully');
    const tokenStaff1 = staffLogin1.data.data.token;

    const passengerLogin = await request('POST', '/api/auth/passenger/login', {
      email: 'rahul.sharma@example.com',
      password: 'Password123!'
    });
    assert(passengerLogin.status === 200, 'Passenger (rahul.sharma@example.com) logged in successfully');
    const tokenPassenger = passengerLogin.data.data.token;

    // Clean up any test assignments, fines, incidents, reports with high IDs
    await pool.query('DELETE FROM STAFF_ASSIGNMENT WHERE assign_id >= 9900');
    await pool.query('DELETE FROM FINE WHERE fine_id >= 9900');
    await pool.query('DELETE FROM INCIDENT WHERE incident_id >= 9900');
    await pool.query('DELETE FROM CROWD_REPORT WHERE crowd_report_id >= 9900');
    await pool.query('DELETE FROM CLEANLINESS_REPORT WHERE cleanliness_report_id >= 9900');
    await pool.query('DELETE FROM REPORT WHERE report_id >= 9900');
    await pool.query('DELETE FROM USER_ACCOUNT WHERE email = "test.newstaff@railways.gov.in"');
    await pool.query('DELETE FROM STAFF WHERE employee_no = "EMP-TC-999"');

    // =========================================================================
    // SECTION 1: FINES (Contract 5.3)
    // =========================================================================
    console.log('\n--- TEST SECTION 1: On-Spot Fines (Contract 5.3) ---');

    // Role checks
    const passFine = await request('POST', '/api/staff/fines', {
      passengerName: 'Test Passenger',
      idProofReference: 'VOTER-12345',
      trainId: 101,
      amount: 250,
      reason: 'TICKETLESS_TRAVEL',
      paymentStatus: 'PAID'
    }, tokenPassenger);
    assert(passFine.status === 403, 'Passenger POST /api/staff/fines refused with 403 Forbidden');

    const adminFine = await request('POST', '/api/staff/fines', {
      passengerName: 'Test Passenger',
      idProofReference: 'VOTER-12345',
      trainId: 101,
      amount: 250,
      reason: 'TICKETLESS_TRAVEL',
      paymentStatus: 'PAID'
    }, tokenAdmin);
    assert(adminFine.status === 403, 'Admin POST /api/staff/fines refused with 403 Forbidden');

    // Input validations
    const missingName = await request('POST', '/api/staff/fines', {
      idProofReference: 'VOTER-12345',
      trainId: 101,
      amount: 250,
      reason: 'TICKETLESS_TRAVEL'
    }, tokenStaff1);
    assert(missingName.status === 400, 'Fine without passengerName refused with 400 Bad Request');

    const missingIdRef = await request('POST', '/api/staff/fines', {
      passengerName: 'Ajay Kumar',
      trainId: 101,
      amount: 250,
      reason: 'TICKETLESS_TRAVEL'
    }, tokenStaff1);
    assert(missingIdRef.status === 400, 'Fine without idProofReference refused with 400 Bad Request');

    const zeroAmount = await request('POST', '/api/staff/fines', {
      passengerName: 'Ajay Kumar',
      idProofReference: 'VOTER-12345',
      trainId: 101,
      amount: 0,
      reason: 'TICKETLESS_TRAVEL'
    }, tokenStaff1);
    assert(zeroAmount.status === 400, 'Fine with amount 0 refused with 400 Bad Request');

    const negAmount = await request('POST', '/api/staff/fines', {
      passengerName: 'Ajay Kumar',
      idProofReference: 'VOTER-12345',
      trainId: 101,
      amount: -100,
      reason: 'TICKETLESS_TRAVEL'
    }, tokenStaff1);
    assert(negAmount.status === 400, 'Fine with negative amount refused with 400 Bad Request');

    const invalidReason = await request('POST', '/api/staff/fines', {
      passengerName: 'Ajay Kumar',
      idProofReference: 'VOTER-12345',
      trainId: 101,
      amount: 250,
      reason: 'INVALID_REASON_CODE'
    }, tokenStaff1);
    assert(invalidReason.status === 400, 'Fine with invalid reason enum refused with 400 Bad Request');

    const invalidStatus = await request('POST', '/api/staff/fines', {
      passengerName: 'Ajay Kumar',
      idProofReference: 'VOTER-12345',
      trainId: 101,
      amount: 250,
      reason: 'TICKETLESS_TRAVEL',
      paymentStatus: 'UNKNOWN'
    }, tokenStaff1);
    assert(invalidStatus.status === 400, 'Fine with invalid paymentStatus refused with 400 Bad Request');

    const nonExistentTrain = await request('POST', '/api/staff/fines', {
      passengerName: 'Ajay Kumar',
      idProofReference: 'VOTER-12345',
      trainId: 99999,
      amount: 250,
      reason: 'TICKETLESS_TRAVEL'
    }, tokenStaff1);
    assert(nonExistentTrain.status === 404, 'Fine with non-existent trainId returns 404 Not Found');

    // Count before valid fine
    const [fineCountBefore] = await pool.query('SELECT COUNT(*) AS cnt FROM FINE');

    // Valid fine creation
    const validFine = await request('POST', '/api/staff/fines', {
      passengerName: 'Ajay Kumar',
      idProofReference: 'VOTER-88491',
      trainId: 101,
      amount: 550.00,
      reason: 'TICKETLESS_TRAVEL',
      paymentStatus: 'PAID'
    }, tokenStaff1);

    assert(validFine.status === 201, 'Valid fine creation returned 201 Created');
    assert(validFine.data.data.fineId > 0, 'Returned numeric fineId > 0');
    assert(validFine.data.data.staffId === 1, 'Fine assigned to Staff 1');
    assert(validFine.data.data.passengerName === 'Ajay Kumar', 'passengerName matches');
    assert(validFine.data.data.amount === 550.00, 'amount matches 550.00');
    assert(validFine.data.data.reason === 'TICKETLESS_TRAVEL', 'reason matches');
    assert(validFine.data.data.paymentStatus === 'PAID', 'paymentStatus matches PAID');
    assert(typeof validFine.data.data.issuedAt === 'string', 'issuedAt returned as raw datetime string');
    assert(!validFine.data.data.issuedAt.endsWith('Z'), 'issuedAt does not append Z (India time)');

    // Verify row really written in FINE table
    const [fineCountAfter] = await pool.query('SELECT COUNT(*) AS cnt FROM FINE');
    assert(fineCountAfter[0].cnt === fineCountBefore[0].cnt + 1, 'FINE table row count incremented by 1');

    // =========================================================================
    // SECTION 2: OPERATIONAL INCIDENTS (Contract 5.3)
    // =========================================================================
    console.log('\n--- TEST SECTION 2: Operational Incidents (Contract 5.3) ---');

    // Role checks
    const passInc = await request('POST', '/api/staff/incidents', {
      stationId: 21,
      type: 'MEDICAL_EMERGENCY',
      severity: 'HIGH'
    }, tokenPassenger);
    assert(passInc.status === 403, 'Passenger POST /api/staff/incidents refused with 403 Forbidden');

    const adminInc = await request('POST', '/api/staff/incidents', {
      stationId: 21,
      type: 'MEDICAL_EMERGENCY',
      severity: 'HIGH'
    }, tokenAdmin);
    assert(adminInc.status === 403, 'Admin POST /api/staff/incidents refused with 403 Forbidden');

    // Input validations
    const missingType = await request('POST', '/api/staff/incidents', {
      stationId: 21,
      severity: 'HIGH'
    }, tokenStaff1);
    assert(missingType.status === 400, 'Incident without type refused with 400 Bad Request');

    const invalidSev = await request('POST', '/api/staff/incidents', {
      stationId: 21,
      type: 'MEDICAL_EMERGENCY',
      severity: 'EXTREME'
    }, tokenStaff1);
    assert(invalidSev.status === 400, 'Incident with invalid severity refused with 400 Bad Request');

    const missingSchedAndStation = await request('POST', '/api/staff/incidents', {
      type: 'MEDICAL_EMERGENCY',
      severity: 'HIGH'
    }, tokenStaff1);
    assert(missingSchedAndStation.status === 400, 'Incident without scheduleId or stationId refused with 400 Bad Request');

    // Staff not assigned to requested schedule or station
    const unassignedInc = await request('POST', '/api/staff/incidents', {
      stationId: 99,
      type: 'MEDICAL_EMERGENCY',
      severity: 'HIGH'
    }, tokenStaff1);
    assert(unassignedInc.status === 403, 'Incident at station where staff is not assigned refused with 403 Forbidden');

    // Assign Staff 1 to station 21 (BCT)
    await pool.query(`
      INSERT INTO STAFF_ASSIGNMENT (assign_id, staff_id, schedule_id, station_id, duty_type, shift_start, shift_end)
      VALUES (9950, 1, 1001, 21, 'STATION_DUTY', DATE_SUB(NOW(), INTERVAL 7 DAY), DATE_ADD(NOW(), INTERVAL 30 DAY))
      ON DUPLICATE KEY UPDATE duty_type = 'STATION_DUTY', station_id = 21, shift_end = DATE_ADD(NOW(), INTERVAL 30 DAY)
    `);

    const [incCountBefore] = await pool.query('SELECT COUNT(*) AS cnt FROM INCIDENT');

    // Valid incident report
    const validInc = await request('POST', '/api/staff/incidents', {
      stationId: 21,
      scheduleId: 1001,
      type: 'MEDICAL_EMERGENCY',
      severity: 'HIGH'
    }, tokenStaff1);

    assert(validInc.status === 201, 'Valid incident creation returned 201 Created');
    assert(validInc.data.data.incidentId > 0, 'Returned numeric incidentId > 0');
    assert(validInc.data.data.staffId === 1, 'Incident assigned to Staff 1');
    assert(validInc.data.data.status === 'REPORTED', 'Incident status starts as REPORTED');
    assert(validInc.data.data.severity === 'HIGH', 'Severity is HIGH');
    assert(typeof validInc.data.data.reportedAt === 'string', 'reportedAt returned as raw datetime string');
    assert(!validInc.data.data.reportedAt.endsWith('Z'), 'reportedAt does not append Z');

    const [incCountAfter] = await pool.query('SELECT COUNT(*) AS cnt FROM INCIDENT');
    assert(incCountAfter[0].cnt === incCountBefore[0].cnt + 1, 'INCIDENT table row count incremented by 1');

    // =========================================================================
    // SECTION 3: LIVE REPORTS (Contract 5.4)
    // =========================================================================
    console.log('\n--- TEST SECTION 3: Live Reports (Contract 5.4) ---');

    // 3a. Delays (POST /api/staff/delays)
    const passDelay = await request('POST', '/api/staff/delays', { scheduleId: 1001, delayMinutes: 30 }, tokenPassenger);
    assert(passDelay.status === 403, 'Passenger POST /api/staff/delays refused with 403 Forbidden');

    const negDelay = await request('POST', '/api/staff/delays', { scheduleId: 1001, delayMinutes: -5 }, tokenStaff1);
    assert(negDelay.status === 400, 'Negative delayMinutes refused with 400 Bad Request');

    const excessiveDelay = await request('POST', '/api/staff/delays', { scheduleId: 1001, delayMinutes: 1500 }, tokenStaff1);
    assert(excessiveDelay.status === 400, 'delayMinutes > 1440 refused with 400 Bad Request');

    const nonIntDelay = await request('POST', '/api/staff/delays', { scheduleId: 1001, delayMinutes: 45.5 }, tokenStaff1);
    assert(nonIntDelay.status === 400, 'Non-integer delayMinutes refused with 400 Bad Request');

    // Staff not assigned on TRAIN_DUTY for schedule 1002
    const unassignedDelay = await request('POST', '/api/staff/delays', { scheduleId: 1002, delayMinutes: 20 }, tokenStaff1);
    assert(unassignedDelay.status === 403, 'Staff without TRAIN_DUTY for schedule 1002 refused with 403 Forbidden');

    // Assign Staff 1 on TRAIN_DUTY for schedule 1001
    await pool.query(`
      INSERT INTO STAFF_ASSIGNMENT (assign_id, staff_id, schedule_id, station_id, duty_type, shift_start, shift_end)
      VALUES (9951, 1, 1001, 21, 'TRAIN_DUTY', DATE_SUB(NOW(), INTERVAL 7 DAY), DATE_ADD(NOW(), INTERVAL 30 DAY))
      ON DUPLICATE KEY UPDATE duty_type = 'TRAIN_DUTY', schedule_id = 1001, shift_end = DATE_ADD(NOW(), INTERVAL 30 DAY)
    `);

    // Valid delay log
    const validDelay = await request('POST', '/api/staff/delays', { scheduleId: 1001, delayMinutes: 45 }, tokenStaff1);
    assert(validDelay.status === 200, 'Valid delay update returned 200 OK');
    assert(validDelay.data.data.scheduleId === 1001, 'Response scheduleId matches 1001');
    assert(validDelay.data.data.delayMinutes === 45, 'Response delayMinutes matches 45');
    assert(validDelay.data.data.status === 'DELAYED', 'Response status is DELAYED');

    // Verify row really updated in TRAIN_SCHEDULE
    const [schedRows] = await pool.query('SELECT delay_minutes, status FROM TRAIN_SCHEDULE WHERE schedule_id = 1001');
    assert(schedRows[0].delay_minutes === 45, 'TRAIN_SCHEDULE.delay_minutes updated to 45');
    assert(schedRows[0].status === 'DELAYED', 'TRAIN_SCHEDULE.status updated to DELAYED');

    // Reset delay back to 0
    await pool.query('UPDATE TRAIN_SCHEDULE SET delay_minutes = 0, status = "ON_TIME" WHERE schedule_id = 1001');

    // 3b. Crowd Reports (POST /api/staff/crowd-reports)
    const passCrowd = await request('POST', '/api/staff/crowd-reports', { platformNo: 1, crowdLevel: 'HIGH' }, tokenPassenger);
    assert(passCrowd.status === 403, 'Passenger POST /api/staff/crowd-reports refused with 403 Forbidden');

    const invalidCrowdLvl = await request('POST', '/api/staff/crowd-reports', { platformNo: 1, crowdLevel: 'DANGEROUS' }, tokenStaff1);
    assert(invalidCrowdLvl.status === 400, 'Invalid crowdLevel refused with 400 Bad Request');

    // Station 21 has platforms 1 to 5; platform 99 does not exist
    const invalidPlat = await request('POST', '/api/staff/crowd-reports', { stationId: 21, platformNo: 99, crowdLevel: 'HIGH' }, tokenStaff1);
    assert(invalidPlat.status === 400, 'Invalid platformNo refused with 400 Bad Request');

    const [crowdCountBefore] = await pool.query('SELECT COUNT(*) AS cnt FROM CROWD_REPORT');

    // Valid crowd report
    const validCrowd = await request('POST', '/api/staff/crowd-reports', {
      stationId: 21,
      platformNo: 2,
      crowdLevel: 'HIGH',
      headCount: 150
    }, tokenStaff1);

    assert(validCrowd.status === 201, 'Valid crowd report returned 201 Created');
    assert(validCrowd.data.data.crowdReportId > 0, 'Returned numeric crowdReportId > 0');
    assert(validCrowd.data.data.stationId === 21, 'stationId is 21');
    assert(validCrowd.data.data.platformNo === 2, 'platformNo is 2');
    assert(validCrowd.data.data.crowdLevel === 'HIGH', 'crowdLevel is HIGH');
    assert(validCrowd.data.data.headCount === 150, 'headCount is 150');
    assert(typeof validCrowd.data.data.recordedAt === 'string', 'recordedAt is raw datetime string');
    assert(!validCrowd.data.data.recordedAt.endsWith('Z'), 'recordedAt does not append Z');

    const [crowdCountAfter] = await pool.query('SELECT COUNT(*) AS cnt FROM CROWD_REPORT');
    assert(crowdCountAfter[0].cnt === crowdCountBefore[0].cnt + 1, 'CROWD_REPORT row count incremented by 1');

    // 3c. Cleanliness Reports (POST /api/staff/cleanliness-reports)
    const passClean = await request('POST', '/api/staff/cleanliness-reports', {
      issueType: 'TOILET_DIRTY',
      description: 'Dirty coach'
    }, tokenPassenger);
    assert(passClean.status === 403, 'Passenger POST /api/staff/cleanliness-reports refused with 403 Forbidden');

    const invalidIssue = await request('POST', '/api/staff/cleanliness-reports', {
      issueType: 'BAD_SMELL',
      description: 'Dirty coach'
    }, tokenStaff1);
    assert(invalidIssue.status === 400, 'Invalid issueType refused with 400 Bad Request');

    const missingDesc = await request('POST', '/api/staff/cleanliness-reports', {
      issueType: 'TOILET_DIRTY',
      description: ''
    }, tokenStaff1);
    assert(missingDesc.status === 400, 'Missing description refused with 400 Bad Request');

    const [cleanCountBefore] = await pool.query('SELECT COUNT(*) AS cnt FROM CLEANLINESS_REPORT');

    // Valid cleanliness report
    const validClean = await request('POST', '/api/staff/cleanliness-reports', {
      issueType: 'TOILET_DIRTY',
      description: 'Coach B1 toilet requires immediate sanitation',
      trainId: 101,
      coachId: 1
    }, tokenStaff1);

    assert(validClean.status === 201, 'Valid cleanliness report returned 201 Created');
    assert(validClean.data.data.cleanlinessReportId > 0, 'cleanlinessReportId is numeric and > 0');
    assert(validClean.data.data.issueType === 'TOILET_DIRTY', 'issueType is TOILET_DIRTY');
    assert(validClean.data.data.status === 'REPORTED', 'status starts REPORTED');
    assert(typeof validClean.data.data.recordedAt === 'string', 'recordedAt is raw datetime string');
    assert(!validClean.data.data.recordedAt.endsWith('Z'), 'recordedAt does not append Z');

    const [cleanCountAfter] = await pool.query('SELECT COUNT(*) AS cnt FROM CLEANLINESS_REPORT');
    assert(cleanCountAfter[0].cnt === cleanCountBefore[0].cnt + 1, 'CLEANLINESS_REPORT row count incremented by 1');

    // =========================================================================
    // SECTION 4: ADMIN READ ROUTES & RANK REPORTS (Contract 7.4)
    // =========================================================================
    console.log('\n--- TEST SECTION 4: Admin Read Routes & RANK Reports (Contract 7.4) ---');

    // 4a. Audit Logs (GET /api/admin/audit-logs)
    const passAudit = await request('GET', '/api/admin/audit-logs', null, tokenPassenger);
    assert(passAudit.status === 403, 'Passenger GET /api/admin/audit-logs refused with 403 Forbidden');

    const staffAudit = await request('GET', '/api/admin/audit-logs', null, tokenStaff1);
    assert(staffAudit.status === 403, 'Staff GET /api/admin/audit-logs refused with 403 Forbidden');

    const adminAudit = await request('GET', '/api/admin/audit-logs', null, tokenAdmin);
    assert(adminAudit.status === 200, 'Admin GET /api/admin/audit-logs returned 200 OK');
    assert(Array.isArray(adminAudit.data.data), 'Audit logs data is an array');
    assert(typeof adminAudit.data.pagination === 'object', 'Pagination object returned');
    assert(adminAudit.data.pagination.page === 1, 'Pagination page is 1');

    // Filter by tableName
    const filteredAudit = await request('GET', '/api/admin/audit-logs?tableName=SETTING', null, tokenAdmin);
    assert(filteredAudit.status === 200, 'Filtered audit log query returned 200 OK');
    if (filteredAudit.data.data.length > 0) {
      assert(filteredAudit.data.data.every(r => r.tableName === 'SETTING'), 'All returned audit logs match tableName=SETTING');
    }

    // 4b. RANK Reports (GET /api/admin/reports & GET /api/admin/reports/:reportKey)
    const passReports = await request('GET', '/api/admin/reports', null, tokenPassenger);
    assert(passReports.status === 403, 'Passenger GET /api/admin/reports refused with 403 Forbidden');

    const staffReports = await request('GET', '/api/admin/reports', null, tokenStaff1);
    assert(staffReports.status === 403, 'Staff GET /api/admin/reports refused with 403 Forbidden');

    const adminReports = await request('GET', '/api/admin/reports', null, tokenAdmin);
    assert(adminReports.status === 200, 'Admin GET /api/admin/reports returned 200 OK');
    assert(Array.isArray(adminReports.data.data), 'Reports registry data is an array');
    assert(adminReports.data.data.length === 5, 'Exactly 5 analytical reports in registry');

    const reportKeys = adminReports.data.data.map(r => r.reportKey);
    assert(reportKeys.includes('busiest-trains'), 'Reports include busiest-trains');
    assert(reportKeys.includes('top-routes'), 'Reports include top-routes');
    assert(reportKeys.includes('station-ranking'), 'Reports include station-ranking');
    assert(reportKeys.includes('class-revenue'), 'Reports include class-revenue');
    assert(reportKeys.includes('quota-utilization'), 'Reports include quota-utilization');

    // Unknown report key refused
    const unknownReport = await request('GET', '/api/admin/reports/unknown-report-xyz', null, tokenAdmin);
    assert(unknownReport.status === 400, 'Unknown reportKey refused with 400 Bad Request');

    // Run each of the 5 reports and assert row execution and REPORT table insertion
    for (const key of reportKeys) {
      const [reportRowsBefore] = await pool.query('SELECT COUNT(*) AS cnt FROM REPORT');

      const repRes = await request('GET', `/api/admin/reports/${key}`, null, tokenAdmin);
      assert(repRes.status === 200, `Admin GET /api/admin/reports/${key} returned 200 OK`);
      assert(repRes.data.data.reportKey === key, `Response reportKey matches ${key}`);
      assert(typeof repRes.data.data.reportId === 'number', 'Response contains generated reportId');
      assert(Array.isArray(repRes.data.data.rows), 'Response contains rows array');
      assert(repRes.data.data.rows.length > 0, `Report ${key} returned > 0 rows (found ${repRes.data.data.rows.length})`);
      assert(typeof repRes.data.data.generatedAt === 'string', 'generatedAt is returned as string');

      // Verify column names exist on row objects
      const firstRow = repRes.data.data.rows[0];
      assert(Object.keys(firstRow).length > 2, `Report ${key} rows contain multiple named columns`);

      // Verify row inserted into REPORT table
      const [reportRowsAfter] = await pool.query('SELECT COUNT(*) AS cnt FROM REPORT');
      assert(reportRowsAfter[0].cnt === reportRowsBefore[0].cnt + 1, `REPORT table count incremented after running ${key}`);
    }

    // =========================================================================
    // SECTION 5: ADMIN STAFF ACCOUNTS (BR-ST1)
    // =========================================================================
    console.log('\n--- TEST SECTION 5: Staff Account Management (BR-ST1) ---');

    // Role checks
    const passStaffList = await request('GET', '/api/admin/staff', null, tokenPassenger);
    assert(passStaffList.status === 403, 'Passenger GET /api/admin/staff refused with 403 Forbidden');

    const staffStaffList = await request('GET', '/api/admin/staff', null, tokenStaff1);
    assert(staffStaffList.status === 403, 'Staff GET /api/admin/staff refused with 403 Forbidden');

    const adminStaffList = await request('GET', '/api/admin/staff', null, tokenAdmin);
    assert(adminStaffList.status === 200, 'Admin GET /api/admin/staff returned 200 OK');
    assert(Array.isArray(adminStaffList.data.data), 'Staff list is an array');
    assert(adminStaffList.data.data.length >= 3, 'Staff list contains seed staff members');

    // Create staff validation
    const missingEmpNo = await request('POST', '/api/admin/staff', {
      name: 'Test Staff',
      email: 'test.staff@railways.gov.in',
      phone: '+91-9876543299',
      designation: 'TICKET_COLLECTOR',
      password: 'Password123!'
    }, tokenAdmin);
    assert(missingEmpNo.status === 400, 'POST /api/admin/staff without employeeNo refused with 400 Bad Request');

    const shortPwd = await request('POST', '/api/admin/staff', {
      employeeNo: 'EMP-TC-999',
      name: 'Test Staff',
      email: 'test.staff@railways.gov.in',
      phone: '+91-9876543299',
      designation: 'TICKET_COLLECTOR',
      password: '123'
    }, tokenAdmin);
    assert(shortPwd.status === 400, 'POST /api/admin/staff with short password refused with 400 Bad Request');

    // Duplicate employee number refused
    const dupEmpNo = await request('POST', '/api/admin/staff', {
      employeeNo: 'EMP-TC-101', // Existing seed staff
      name: 'Duplicate Staff',
      email: 'unique.email@railways.gov.in',
      phone: '+91-9876543298',
      designation: 'TICKET_COLLECTOR',
      password: 'Password123!'
    }, tokenAdmin);
    assert(dupEmpNo.status === 400, 'Duplicate employee number refused with 400 Bad Request');

    // Duplicate email refused
    const dupEmail = await request('POST', '/api/admin/staff', {
      employeeNo: 'EMP-TC-998',
      name: 'Duplicate Email Staff',
      email: 'admin@railways.gov.in', // Existing admin email
      phone: '+91-9876543297',
      designation: 'TICKET_COLLECTOR',
      password: 'Password123!'
    }, tokenAdmin);
    assert(dupEmail.status === 400, 'Duplicate email refused with 400 Bad Request');

    // Valid staff creation
    const newStaffPayload = {
      employeeNo: 'EMP-TC-999',
      name: 'Kavita Deshmukh',
      email: 'test.newstaff@railways.gov.in',
      phone: '+91-9876543999',
      designation: 'TRAIN_TICKET_EXAMINER',
      password: 'InitialPassword123!'
    };

    const [staffCountBefore] = await pool.query('SELECT COUNT(*) AS cnt FROM STAFF');
    const [auditCountBefore] = await pool.query('SELECT COUNT(*) AS cnt FROM AUDIT_LOG WHERE action = "CREATE_STAFF"');

    const createStaffRes = await request('POST', '/api/admin/staff', newStaffPayload, tokenAdmin);
    assert(createStaffRes.status === 201, 'Valid staff creation returned 201 Created');
    const createdStaff = createStaffRes.data.data;
    assert(createdStaff.employeeNo === 'EMP-TC-999', 'Created staff employeeNo is EMP-TC-999');
    assert(createdStaff.name === 'Kavita Deshmukh', 'Created staff name is Kavita Deshmukh');
    assert(createdStaff.status === 'ACTIVE', 'Created staff status is ACTIVE');
    assert(!createdStaff.password && !createdStaff.passwordHash, 'Password and hash are never returned');

    const newStaffId = createdStaff.staffId;
    assert(newStaffId > 0, `Generated numeric staffId is ${newStaffId}`);

    // Verify database row and AUDIT_LOG row
    const [staffCountAfter] = await pool.query('SELECT COUNT(*) AS cnt FROM STAFF');
    assert(staffCountAfter[0].cnt === staffCountBefore[0].cnt + 1, 'STAFF table count incremented by 1');

    const [auditCountAfter] = await pool.query('SELECT COUNT(*) AS cnt FROM AUDIT_LOG WHERE action = "CREATE_STAFF"');
    assert(auditCountAfter[0].cnt === auditCountBefore[0].cnt + 1, 'AUDIT_LOG recorded CREATE_STAFF entry');

    // Prove new staff member CAN log in with initial password
    const newStaffLogin = await request('POST', '/api/auth/staff/login', {
      employeeId: 'EMP-TC-999',
      password: 'InitialPassword123!'
    });
    assert(newStaffLogin.status === 200, 'New staff member logged in successfully with initial password');
    assert(newStaffLogin.data.data.role === 'STAFF', 'Role is STAFF');
    assert(newStaffLogin.data.data.staffId === newStaffId, 'Logged-in staffId matches created staffId');

    // Update staff status validations
    const invalidStatusVal = await request('PUT', `/api/admin/staff/${newStaffId}/status`, { status: 'DELETED' }, tokenAdmin);
    assert(invalidStatusVal.status === 400, 'Invalid status DELETED refused with 400 Bad Request');

    const nonExistentStaff = await request('PUT', '/api/admin/staff/999999/status', { status: 'SUSPENDED' }, tokenAdmin);
    assert(nonExistentStaff.status === 404, 'Non-existent staffId returns 404 Not Found');

    // Suspend staff member
    const [statusAuditBefore] = await pool.query('SELECT COUNT(*) AS cnt FROM AUDIT_LOG WHERE action = "UPDATE_STAFF_STATUS"');

    const suspendRes = await request('PUT', `/api/admin/staff/${newStaffId}/status`, { status: 'SUSPENDED' }, tokenAdmin);
    assert(suspendRes.status === 200, 'PUT status to SUSPENDED returned 200 OK');
    assert(suspendRes.data.data.status === 'SUSPENDED', 'Response status is SUSPENDED');

    // Verify AUDIT_LOG recorded status update
    const [statusAuditAfter] = await pool.query('SELECT COUNT(*) AS cnt FROM AUDIT_LOG WHERE action = "UPDATE_STAFF_STATUS"');
    assert(statusAuditAfter[0].cnt === statusAuditBefore[0].cnt + 1, 'AUDIT_LOG recorded UPDATE_STAFF_STATUS entry');

    // Prove suspended staff member can NO LONGER log in
    const suspendedLogin = await request('POST', '/api/auth/staff/login', {
      employeeId: 'EMP-TC-999',
      password: 'InitialPassword123!'
    });
    assert(suspendedLogin.status === 403, 'Suspended staff member login refused with 403 Forbidden');

    // Also test universal login portal
    const suspendedUniversalLogin = await request('POST', '/api/auth/login', {
      email: 'test.newstaff@railways.gov.in',
      password: 'InitialPassword123!'
    });
    assert(suspendedUniversalLogin.status === 403, 'Suspended staff member universal login refused with 403 Forbidden');

    // Clean up created test staff member
    await pool.query('DELETE FROM STAFF WHERE staff_id = ?', [newStaffId]);
    await pool.query('DELETE FROM USER_ACCOUNT WHERE user_id = ?', [createdStaff.userId]);
    await pool.query('DELETE FROM STAFF_ASSIGNMENT WHERE assign_id >= 9950');

    // =========================================================================
    // FINAL: Inventory Audit Check
    // =========================================================================
    console.log('\n--- FINAL INVENTORY AUDIT ---');
    const auditAfter = await runInventoryAudit();
    assert(auditAfter.mismatches === 0, `Final inventory audit strictly 0 mismatches of ${auditAfter.totalInventories}`);

    console.log('\n================================================================');
    console.log(` SUITE D3C-2 FINISHED: ${passedTests}/${totalTests} TESTS PASSED (100%)`);
    console.log('================================================================');

  } catch (err) {
    console.error('\nTEST SUITE FAILED WITH ERROR:');
    console.error(err);
    process.exitCode = 1;
  } finally {
    clearTimeout(safetyTimeout);
    try {
      await pool.query('DELETE FROM STAFF_ASSIGNMENT WHERE assign_id >= 9900');
      await pool.query('DELETE FROM FINE WHERE fine_id >= 9900');
      await pool.query('DELETE FROM INCIDENT WHERE incident_id >= 9900');
      await pool.query('DELETE FROM CROWD_REPORT WHERE crowd_report_id >= 9900');
      await pool.query('DELETE FROM CLEANLINESS_REPORT WHERE cleanliness_report_id >= 9900');
      await pool.query('DELETE FROM REPORT WHERE report_id >= 9900');
      await pool.query('DELETE FROM USER_ACCOUNT WHERE email = "test.newstaff@railways.gov.in"');
      await pool.query('DELETE FROM STAFF WHERE employee_no = "EMP-TC-999"');
    } catch (_) {}

    await stopServer();
    await pool.end().catch(() => {});
    await closeMongo().catch(() => {});
    process.exit(process.exitCode || 0);
  }
}

runTests().catch(async (err) => {
  console.error('\n[FATAL ERROR IN TEST SUITE]:', err);
  try {
    await stopServer();
    await pool.end().catch(() => {});
    await closeMongo().catch(() => {});
  } catch (_) {}
  process.exit(1);
});
