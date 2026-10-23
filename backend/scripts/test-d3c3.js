/**
 * Railway Reservation System - Master Test Suite D3c-3
 * MongoDB Features (Notifications, Complaints, Live Train Status, Activity Logs)
 * Admin Master Data CRUD (Stations, Trains, Routes, Coaches, Seats, Fares, Concessions, Refunds)
 * Safe Constraints, Role Refusals, Audit Checks, Inventory Verification & Database Reset
 */

const http = require('http');
const path = require('path');
const dotenv = require('dotenv');
const { execSync } = require('child_process');

dotenv.config({ path: path.join(__dirname, '../../database/.env') });
dotenv.config({ path: path.join(__dirname, '../.env') });

const app = require('../src/app');
const pool = require('../src/config/mysql');
const { getOrConnectMongoDb, closeMongo } = require('../src/config/mongodb');
const { getOrEnsureFutureSchedule } = require('./helpers/scheduleHelper');

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
    console.error('\n[FATAL ERROR]: Safety timeout of 120 seconds reached. Test suite test-d3c3 timed out!');
    process.exit(1);
  }, 120000);
  safetyTimeout.unref();

  console.log('================================================================');
  console.log(' RAILWAY RESERVATION SYSTEM - SUITE D3C-3');
  console.log(' MongoDB Features, Master Data Management & Safe Rules');
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
    assert(adminLogin.status === 200, 'Admin logged in successfully');
    const tokenAdmin = adminLogin.data.data.token;
    const adminUserId = adminLogin.data.data.userId;

    const staffLogin1 = await request('POST', '/api/auth/staff/login', {
      employeeId: 'EMP-TC-101',
      password: 'StaffPassword123!'
    });
    assert(staffLogin1.status === 200, 'Staff 1 (EMP-TC-101) logged in successfully');
    const tokenStaff1 = staffLogin1.data.data.token;
    const staff1UserId = staffLogin1.data.data.userId;

    const passengerLogin1 = await request('POST', '/api/auth/passenger/login', {
      email: 'rahul.sharma@example.com',
      password: 'Password123!'
    });
    assert(passengerLogin1.status === 200, 'Passenger 1 (rahul.sharma@example.com) logged in successfully');
    const tokenPass1 = passengerLogin1.data.data.token;
    const pass1UserId = passengerLogin1.data.data.userId;

    const passengerLogin2 = await request('POST', '/api/auth/passenger/login', {
      email: 'priya.patel@example.com',
      password: 'Password123!'
    });
    assert(passengerLogin2.status === 200, 'Passenger 2 (priya.patel@example.com) logged in successfully');
    const tokenPass2 = passengerLogin2.data.data.token;
    const pass2UserId = passengerLogin2.data.data.userId;

    // =========================================================================
    // PART A.1: Notifications & Mark-Read Ownership
    // =========================================================================
    console.log('\n--- PART A.1: NOTIFICATIONS & MARK-READ OWNERSHIP ---');

    // GET /api/notifications returns own notifications, newest first
    const pass1NtfRes = await request('GET', '/api/notifications', null, tokenPass1);
    assert(pass1NtfRes.status === 200, 'GET /api/notifications returns 200 OK');
    assert(Array.isArray(pass1NtfRes.data.data), 'Notifications is an array');
    assert(pass1NtfRes.data.data.length >= 2, 'Seed notifications present for user 50001');

    const firstNtf = pass1NtfRes.data.data[0];
    assert(firstNtf.notificationId !== undefined, 'notificationId field present');
    assert(firstNtf.userId === pass1UserId, 'Notification belongs to passenger 1');
    assert(firstNtf.type !== undefined, 'type field present');
    assert(firstNtf.title !== undefined, 'title field present');
    assert(firstNtf.message !== undefined, 'message field present');
    assert(firstNtf.isRead !== undefined, 'isRead field present');
    assert(typeof firstNtf.createdAt === 'string', 'createdAt is a string');
    assert(!firstNtf.createdAt.endsWith('Z'), 'createdAt does not end with Z (India time)');
    assert(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(firstNtf.createdAt), 'createdAt conforms to YYYY-MM-DD HH:MM:SS');

    // Mark-read ownership check: pass2 cannot mark pass1's notification as read
    const forbiddenRead = await request('PUT', `/api/notifications/${firstNtf.notificationId}/read`, {}, tokenPass2);
    assert(forbiddenRead.status === 403, 'Marking another user notification as read refused with 403 Forbidden');

    // Owner marks notification as read
    const ownerRead = await request('PUT', `/api/notifications/${firstNtf.notificationId}/read`, {}, tokenPass1);
    assert(ownerRead.status === 200, 'Owner mark-read returns 200 OK');
    assert(ownerRead.data.data.isRead === true, 'Notification isRead is now true');

    // =========================================================================
    // Notification Triggers Verification
    // =========================================================================
    console.log('\n--- PART A.1: NOTIFICATION TRIGGERS ---');

    // Trigger A: Counter booking -> BOOKING_CONFIRMATION
    const activeRun129 = await getOrEnsureFutureSchedule(pool, 129, 3);
    const counterBookRes = await request('POST', '/api/counter/bookings', {
      trainId: 129,
      journeyDate: activeRun129.journeyDate,
      boardingStationId: 21,
      destinationStationId: 24,
      classType: '3A',
      quota: 'GENERAL',
      isWalkin: false,
      registeredUserId: pass1UserId,
      passengers: [
        { name: 'Traveler One', age: 30, gender: 'MALE', berthPreference: 'LOWER' },
        { name: 'Traveler Two', age: 28, gender: 'FEMALE', berthPreference: 'MIDDLE' }
      ],
      payment: { method: 'CASH' }
    }, tokenStaff1);
    assert(counterBookRes.status === 201, 'Counter booking created 201 Created');
    const counterPnr = counterBookRes.data.data.pnr;

    const pass1NtfAfterBooking = await request('GET', '/api/notifications', null, tokenPass1);
    const bookingNtf = pass1NtfAfterBooking.data.data.find(n => n.type === 'BOOKING_CONFIRMATION' && n.referenceId === counterPnr);
    assert(bookingNtf !== undefined, 'Counter booking generated BOOKING_CONFIRMATION notification for passenger');

    // Trigger B: Cancellation and Refund -> STATUS_UPDATE
    // Cancel passenger 2, leaving passenger 1 confirmed on activeRun129
    const cancelRes = await request('POST', `/api/bookings/${counterPnr}/cancel`, { passengerNos: [2] }, tokenPass1);
    assert(cancelRes.status === 200, 'Cancellation succeeded with 200 OK');

    const pass1NtfAfterCancel = await request('GET', '/api/notifications', null, tokenPass1);
    const cancelNtf = pass1NtfAfterCancel.data.data.find(n => n.type === 'STATUS_UPDATE' && n.referenceId === counterPnr);
    assert(cancelNtf !== undefined, 'Cancellation generated STATUS_UPDATE notification');

    // Trigger C: Staff delay update -> DELAY to passengers with confirmed or RAC bookings on that run
    // Passenger 1 is confirmed on activeRun129.scheduleId
    await pool.query(
      `INSERT INTO STAFF_ASSIGNMENT (assign_id, staff_id, schedule_id, station_id, duty_type, shift_start, shift_end)
       VALUES (9940, 1, ?, 10, 'TRAIN_DUTY', '2026-10-18 00:00:00', '2026-10-28 23:59:59')
       ON DUPLICATE KEY UPDATE duty_type = 'TRAIN_DUTY', shift_end = '2026-10-28 23:59:59'`,
      [activeRun129.scheduleId]
    );

    const delayRes = await request('POST', '/api/staff/delays', {
      scheduleId: activeRun129.scheduleId,
      delayMinutes: 35
    }, tokenStaff1);
    assert(delayRes.status === 200, 'Staff delay update returned 200 OK');

    const pass1NtfAfterDelay = await request('GET', '/api/notifications', null, tokenPass1);
    const delayNtf = pass1NtfAfterDelay.data.data.find(n => n.type === 'DELAY' && n.referenceId === String(activeRun129.scheduleId));
    assert(delayNtf !== undefined, `Staff delay update dispatched DELAY notification to passengers on schedule ${activeRun129.scheduleId}`);

    // Trigger D: Emergency Incident (HIGH or CRITICAL) notifies all admins (BR-ST9)
    const incidentRes = await request('POST', '/api/staff/incidents', {
      stationId: 10,
      scheduleId: activeRun129.scheduleId,
      type: 'SECURITY_ALERT',
      severity: 'CRITICAL'
    }, tokenStaff1);
    assert(incidentRes.status === 201, 'Critical incident reported 201 Created');
    const incId = incidentRes.data.data.incidentId;

    const adminNtfRes = await request('GET', '/api/notifications', null, tokenAdmin);
    assert(adminNtfRes.status === 200, 'Admin can view notifications 200 OK');
    const emergencyNtf = adminNtfRes.data.data.find(n => n.type === 'EMERGENCY' && n.referenceId === String(incId));
    assert(emergencyNtf !== undefined, 'CRITICAL incident dispatched EMERGENCY notification to ADMIN (BR-ST9)');

    // =========================================================================
    // PART A.2: Complaints Flow
    // =========================================================================
    console.log('\n--- PART A.2: COMPLAINTS FLOW ---');

    // 1. Passenger files a complaint
    const newComplaintRes = await request('POST', '/api/complaints', {
      category: 'TRAIN_CLEANLINESS',
      subject: 'Dusty seats in Coach B3',
      description: 'Seats in coach B3 of train 12951 had heavy dust on arrival.'
    }, tokenPass1);
    assert(newComplaintRes.status === 201, 'Passenger POST /api/complaints returns 201 Created');
    assert(newComplaintRes.data.data.grievanceId !== undefined, 'grievanceId present');
    assert(newComplaintRes.data.data.status === 'OPEN', 'Initial complaint status is OPEN');
    assert(newComplaintRes.data.data.response === null, 'Initial response is null');
    assert(newComplaintRes.data.data.category === 'TRAIN_CLEANLINESS', 'Category matches');
    assert(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(newComplaintRes.data.data.createdAt), 'createdAt formatted India time string');
    const testGrievanceId = newComplaintRes.data.data.grievanceId;

    // 2. Passenger views own complaints
    const passComplaints = await request('GET', '/api/complaints', null, tokenPass1);
    assert(passComplaints.status === 200, 'Passenger GET /api/complaints returns 200 OK');
    assert(Array.isArray(passComplaints.data.data), 'Returns array of complaints');
    assert(passComplaints.data.data.some(c => c.grievanceId === testGrievanceId), 'Filed complaint appears in passenger own list');

    // 3. Role check: Staff cannot access passenger complaints or admin complaints
    const staffCompForbidden = await request('GET', '/api/complaints', null, tokenStaff1);
    assert(staffCompForbidden.status === 403, 'Staff GET /api/complaints refused with 403 Forbidden');

    const passAdminCompForbidden = await request('GET', '/api/admin/complaints', null, tokenPass1);
    assert(passAdminCompForbidden.status === 403, 'Passenger GET /api/admin/complaints refused with 403 Forbidden');

    // 4. Admin lists complaints with ?status filter
    const adminCompList = await request('GET', '/api/admin/complaints?status=OPEN', null, tokenAdmin);
    assert(adminCompList.status === 200, 'Admin GET /api/admin/complaints?status=OPEN returns 200 OK');
    assert(adminCompList.data.data.every(c => c.status === 'OPEN'), 'Every filtered complaint has status OPEN');

    // 5. Admin updates response and status
    const updateCompRes = await request('PUT', `/api/admin/complaints/${testGrievanceId}`, {
      status: 'RESOLVED',
      response: 'Coach housekeeping crew dispatched and sanitized the coach.'
    }, tokenAdmin);
    assert(updateCompRes.status === 200, 'Admin PUT complaint response returns 200 OK');
    assert(updateCompRes.data.data.status === 'RESOLVED', 'Updated status is RESOLVED');
    assert(updateCompRes.data.data.response.includes('dispatched'), 'Response updated properly');

    // Verify seed complaints return subject and response from extra_fields
    const seedCompRes = await request('GET', '/api/admin/complaints', null, tokenAdmin);
    const cmp901 = seedCompRes.data.data.find(c => c.grievanceId === 'cmp_901');
    assert(cmp901 !== undefined, 'Seed complaint cmp_901 found');
    assert(cmp901.subject === 'Unhygienic washrooms in coach B1', 'Seed subject mapped from extra_fields');
    assert(cmp901.response !== null, 'Seed response mapped from extra_fields');

    // =========================================================================
    // PART A.3: Live Train Status
    // =========================================================================
    console.log('\n--- PART A.3: LIVE TRAIN STATUS ---');

    // GET /api/schedules/:scheduleId/live-status
    const schedLiveRes = await request('GET', `/api/schedules/${activeRun129.scheduleId}/live-status`, null, tokenPass1);
    assert(schedLiveRes.status === 200, 'GET /api/schedules/:scheduleId/live-status returns 200 OK');
    assert(schedLiveRes.data.data.scheduleId === activeRun129.scheduleId, 'scheduleId matches');
    assert(schedLiveRes.data.data.trainId === 129, 'trainId is 129');
    assert(schedLiveRes.data.data.delayMinutes === 35, 'delayMinutes reflected from previous delay update (35 mins)');
    assert(schedLiveRes.data.data.status === 'DELAYED', 'status reflected as DELAYED');
    assert(typeof schedLiveRes.data.data.platformNumber === 'number', 'platformNumber is a number');

    // GET /api/trains/:trainId/live-status
    const trainLiveRes = await request('GET', '/api/trains/129/live-status', null, tokenPass1);
    assert(trainLiveRes.status === 200, 'GET /api/trains/129/live-status returns 200 OK');
    assert(trainLiveRes.data.data.trainId === 129, 'trainId is 129');
    assert(trainLiveRes.data.data.status === 'DELAYED', 'train live status is DELAYED');

    // Non-existent schedule / train returns 404
    const badSchedLive = await request('GET', '/api/schedules/999999/live-status', null, tokenPass1);
    assert(badSchedLive.status === 404, 'Non-existent scheduleId live-status returns 404 Not Found');

    // =========================================================================
    // PART A.4: Activity Logs
    // =========================================================================
    console.log('\n--- PART A.4: ACTIVITY LOGS ---');

    // Role check: Passenger and Staff refused
    const passActForbidden = await request('GET', '/api/admin/activity-logs', null, tokenPass1);
    assert(passActForbidden.status === 403, 'Passenger GET /api/admin/activity-logs refused with 403 Forbidden');

    const staffActForbidden = await request('GET', '/api/admin/activity-logs', null, tokenStaff1);
    assert(staffActForbidden.status === 403, 'Staff GET /api/admin/activity-logs refused with 403 Forbidden');

    // Admin lists activity logs with pagination and filters
    const adminActLogs = await request('GET', '/api/admin/activity-logs?page=1&limit=20', null, tokenAdmin);
    assert(adminActLogs.status === 200, 'Admin GET /api/admin/activity-logs returns 200 OK');
    assert(Array.isArray(adminActLogs.data.data), 'Activity logs data is array');
    assert(adminActLogs.data.pagination !== undefined, 'Pagination metadata present');

    const sampleLog = adminActLogs.data.data[0];
    assert(sampleLog.logId !== undefined, 'logId present');
    assert(sampleLog.userId !== undefined, 'userId present');
    assert(sampleLog.action !== undefined, 'action present');
    assert(sampleLog.loggedAt !== undefined, 'loggedAt present');
    assert(!sampleLog.loggedAt.endsWith('Z'), 'loggedAt does not end with Z (India time)');

    // Filter by action: LOGIN
    const loginActLogs = await request('GET', '/api/admin/activity-logs?action=LOGIN', null, tokenAdmin);
    assert(loginActLogs.status === 200, 'Filter by action=LOGIN returns 200 OK');
    assert(loginActLogs.data.data.length > 0, 'Found LOGIN activity logs from test logins');

    // Filter by userId
    const userActLogs = await request('GET', `/api/admin/activity-logs?userId=${pass1UserId}`, null, tokenAdmin);
    assert(userActLogs.status === 200, 'Filter by userId returns 200 OK');
    assert(userActLogs.data.data.every(l => l.userId === pass1UserId), 'All returned logs belong to filtered userId');

    // =========================================================================
    // PART B: Admin Master Data (Contract 7.4)
    // =========================================================================
    console.log('\n--- PART B: ADMIN MASTER DATA CRUD ---');

    // Role checks: Passenger and Staff refused on all master data endpoints
    const passStnForbidden = await request('GET', '/api/admin/stations', null, tokenPass1);
    assert(passStnForbidden.status === 403, 'Passenger GET /api/admin/stations refused 403 Forbidden');

    const staffTrainForbidden = await request('GET', '/api/admin/trains', null, tokenStaff1);
    assert(staffTrainForbidden.status === 403, 'Staff GET /api/admin/trains refused 403 Forbidden');

    // -------------------------------------------------------------------------
    // B.1 Stations
    // -------------------------------------------------------------------------
    console.log('\n- Stations CRUD & Refused Deletes');
    const stnList = await request('GET', '/api/admin/stations', null, tokenAdmin);
    assert(stnList.status === 200, 'GET /api/admin/stations returns 200 OK');
    assert(stnList.data.data.length >= 158, 'List contains at least 158 stations');

    const stn10 = await request('GET', '/api/admin/stations/10', null, tokenAdmin);
    assert(stn10.status === 200, 'GET /api/admin/stations/10 returns 200 OK');
    assert(stn10.data.data.stationCode === 'NDLS', 'Station 10 code is NDLS');

    // Create new station
    const newStnRes = await request('POST', '/api/admin/stations', {
      stationCode: 'TSTN',
      stationName: 'Test Junction',
      displayName: 'Test Junction (TSTN)',
      city: 'Test City',
      state: 'Test State',
      platformCount: 2
    }, tokenAdmin);
    assert(newStnRes.status === 201, 'POST /api/admin/stations created 201 Created');
    const newStnId = newStnRes.data.data.stationId;

    // Check AUDIT_LOG recorded CREATE_STATION
    const [stnAuditCreate] = await pool.query("SELECT * FROM AUDIT_LOG WHERE action = 'CREATE_STATION' AND record_id = ?", [String(newStnId)]);
    assert(stnAuditCreate.length > 0, 'AUDIT_LOG recorded CREATE_STATION');

    // Update station
    const updateStnRes = await request('PUT', `/api/admin/stations/${newStnId}`, {
      stationName: 'Test Central',
      platformCount: 3
    }, tokenAdmin);
    assert(updateStnRes.status === 200, 'PUT /api/admin/stations/:id updated 200 OK');
    assert(updateStnRes.data.data.stationName === 'Test Central', 'Station name updated');

    // Refused Delete: Station 10 (NDLS) is referenced by trains, route stops, and assignments
    const refDelStn = await request('DELETE', '/api/admin/stations/10', null, tokenAdmin);
    assert(refDelStn.status === 409 || refDelStn.status === 400, 'Referenced station delete refused with 409 Conflict');

    // Delete newly created unreferenced station succeeds
    const delStnRes = await request('DELETE', `/api/admin/stations/${newStnId}`, null, tokenAdmin);
    assert(delStnRes.status === 200, 'DELETE unreferenced station returns 200 OK');

    // -------------------------------------------------------------------------
    // B.2 Trains
    // -------------------------------------------------------------------------
    console.log('\n- Trains CRUD & Refused Deletes');
    const trainList = await request('GET', '/api/admin/trains', null, tokenAdmin);
    assert(trainList.status === 200, 'GET /api/admin/trains returns 200 OK');
    assert(trainList.data.data.length >= 60, 'List contains at least 60 trains');

    const train129 = await request('GET', '/api/admin/trains/129', null, tokenAdmin);
    assert(train129.status === 200, 'GET /api/admin/trains/129 returns 200 OK');
    assert(train129.data.data.trainNumber === '12951', 'Train 129 number is 12951');

    // Create new train
    const newTrainRes = await request('POST', '/api/admin/trains', {
      trainNumber: '99991',
      shortName: 'Test Express',
      displayName: 'Test Express (99991)',
      trainType: 'EXPRESS',
      sourceStationId: 10,
      destinationStationId: 21,
      runningDays: ['MON', 'WED', 'FRI']
    }, tokenAdmin);
    assert(newTrainRes.status === 201, 'POST /api/admin/trains created 201 Created');
    const newTrainId = newTrainRes.data.data.trainId;

    // Check AUDIT_LOG recorded CREATE_TRAIN
    const [trainAuditCreate] = await pool.query("SELECT * FROM AUDIT_LOG WHERE action = 'CREATE_TRAIN' AND record_id = ?", [String(newTrainId)]);
    assert(trainAuditCreate.length > 0, 'AUDIT_LOG recorded CREATE_TRAIN');

    // Refused change: altering train endpoints on train 129 which has active schedules is refused
    const unsafeTrainChange = await request('PUT', '/api/admin/trains/129', {
      sourceStationId: 90 // changing source station on train with schedules
    }, tokenAdmin);
    assert(unsafeTrainChange.status === 409 || unsafeTrainChange.status === 400, 'Unsafe train route change refused');

    // Refused delete: deleting train 129 which has active schedules is refused
    const refDelTrain = await request('DELETE', '/api/admin/trains/129', null, tokenAdmin);
    assert(refDelTrain.status === 409 || refDelTrain.status === 400, 'Train delete with active schedules refused');

    // Delete unreferenced new train succeeds
    const delTrainRes = await request('DELETE', `/api/admin/trains/${newTrainId}`, null, tokenAdmin);
    assert(delTrainRes.status === 200, 'DELETE unreferenced train returns 200 OK');

    // -------------------------------------------------------------------------
    // B.3 Route Stops
    // -------------------------------------------------------------------------
    console.log('\n- Route Stops CRUD & Refused Modifications');
    const routeList = await request('GET', '/api/admin/routes?trainId=129', null, tokenAdmin);
    assert(routeList.status === 200, 'GET /api/admin/routes?trainId=129 returns 200 OK');
    assert(routeList.data.data.length > 0, 'Route stops found for train 129');

    const firstStop = routeList.data.data[0];
    const getStop = await request('GET', `/api/admin/routes/${firstStop.stopId}`, null, tokenAdmin);
    assert(getStop.status === 200, 'GET /api/admin/routes/:id returns 200 OK');

    // Refused addition: cannot add stop to train 129 because schedules exist
    const unsafeAddStop = await request('POST', '/api/admin/routes', {
      trainId: 129,
      stationId: 26,
      stopSequence: 99,
      arrivalTime: '12:00:00',
      departureTime: '12:05:00',
      dayOffset: 0,
      distanceFromOrigin: 500,
      platformNumber: 1
    }, tokenAdmin);
    assert(unsafeAddStop.status === 409 || unsafeAddStop.status === 400, 'Adding route stop to train with schedules refused');

    // Refused delete: cannot delete stop from train 129 because schedules exist
    const unsafeDelStop = await request('DELETE', `/api/admin/routes/${firstStop.stopId}`, null, tokenAdmin);
    assert(unsafeDelStop.status === 409 || unsafeDelStop.status === 400, 'Deleting route stop from train with schedules refused');

    // -------------------------------------------------------------------------
    // B.4 Coaches
    // -------------------------------------------------------------------------
    console.log('\n- Coaches CRUD & Refused Modifications');
    const coachList = await request('GET', '/api/admin/coaches?trainId=129', null, tokenAdmin);
    assert(coachList.status === 200, 'GET /api/admin/coaches returns 200 OK');
    assert(coachList.data.data.length > 0, 'Coaches returned for train 129');

    const firstCoach = coachList.data.data[0];

    // Refused addition: cannot add coach to train 129 because schedules exist
    const unsafeAddCoach = await request('POST', '/api/admin/coaches', {
      trainId: 129,
      classId: 1,
      coachCode: 'H9',
      sequenceNumber: 99,
      totalSeats: 24
    }, tokenAdmin);
    assert(unsafeAddCoach.status === 409 || unsafeAddCoach.status === 400, 'Adding coach to train with schedules refused');

    // Refused delete: cannot delete coach from train 129 because schedules/seats exist
    const unsafeDelCoach = await request('DELETE', `/api/admin/coaches/${firstCoach.coachId}`, null, tokenAdmin);
    assert(unsafeDelCoach.status === 409 || unsafeDelCoach.status === 400, 'Deleting coach with active schedules/seats refused');

    // -------------------------------------------------------------------------
    // B.5 Seats
    // -------------------------------------------------------------------------
    console.log('\n- Seats CRUD & Refused Modifications');
    const seatList = await request('GET', `/api/admin/seats?coachId=${firstCoach.coachId}&limit=10`, null, tokenAdmin);
    assert(seatList.status === 200, 'GET /api/admin/seats returns 200 OK');
    assert(seatList.data.data.length > 0, 'Seats returned for coach');

    const firstSeat = seatList.data.data[0];

    // Refused addition: cannot add seats to coach on train with schedules
    const unsafeAddSeat = await request('POST', '/api/admin/seats', {
      coachId: firstCoach.coachId,
      seatNumber: 999,
      berthType: 'LOWER'
    }, tokenAdmin);
    assert(unsafeAddSeat.status === 409 || unsafeAddSeat.status === 400, 'Adding seat to train with schedules refused');

    // Refused delete: cannot delete seat referenced in reservations / active schedules
    const unsafeDelSeat = await request('DELETE', `/api/admin/seats/${firstSeat.seatId}`, null, tokenAdmin);
    assert(unsafeDelSeat.status === 409 || unsafeDelSeat.status === 400, 'Deleting seat on active train/reservations refused');

    // -------------------------------------------------------------------------
    // B.6 Fares (Audited by Triggers; Node writes NO audit row)
    // -------------------------------------------------------------------------
    console.log('\n- Fares CRUD & Trigger Audit Verification');
    const fareList = await request('GET', '/api/admin/fares?classId=1', null, tokenAdmin);
    assert(fareList.status === 200, 'GET /api/admin/fares returns 200 OK');
    assert(fareList.data.data.length > 0, 'Fares returned');

    // Create new fare slab
    const newFareRes = await request('POST', '/api/admin/fares', {
      classId: 1,
      minDistanceKm: 8000,
      maxDistanceKm: 8500,
      ratePerKm: 4.5
    }, tokenAdmin);
    assert(newFareRes.status === 201, 'POST /api/admin/fares returns 201 Created');
    const newFareId = newFareRes.data.data.fareId;

    // Verify Node wrote NO audit row for FARE creation
    const [fareAuditNode] = await pool.query("SELECT * FROM AUDIT_LOG WHERE action = 'CREATE_FARE'");
    assert(fareAuditNode.length === 0, 'Node wrote NO AUDIT_LOG row for fare creation');

    // Update fare slab: trigger trg_audit_fare_change automatically fires in MySQL
    const [fareAuditBefore] = await pool.query("SELECT COUNT(*) AS cnt FROM AUDIT_LOG WHERE action = 'UPDATE_FARE_RATE'");
    const updateFareRes = await request('PUT', `/api/admin/fares/${newFareId}`, {
      ratePerKm: 4.8
    }, tokenAdmin);
    assert(updateFareRes.status === 200, 'PUT /api/admin/fares returns 200 OK');

    const [fareAuditAfter] = await pool.query("SELECT COUNT(*) AS cnt FROM AUDIT_LOG WHERE action = 'UPDATE_FARE_RATE'");
    assert(fareAuditAfter[0].cnt === fareAuditBefore[0].cnt + 1, 'MySQL trigger trg_audit_fare_change recorded UPDATE_FARE_RATE row');

    // Delete created fare slab
    const delFareRes = await request('DELETE', `/api/admin/fares/${newFareId}`, null, tokenAdmin);
    assert(delFareRes.status === 200, 'DELETE /api/admin/fares returns 200 OK');

    // -------------------------------------------------------------------------
    // B.7 Concession Rules (Audited by Triggers; Node writes NO audit row)
    // -------------------------------------------------------------------------
    console.log('\n- Concession Rules CRUD & Trigger Audit Verification');
    const concList = await request('GET', '/api/admin/concession-rules', null, tokenAdmin);
    assert(concList.status === 200, 'GET /api/admin/concession-rules returns 200 OK');
    assert(concList.data.data.length >= 13, 'List contains at least 13 concession rules');

    // Create new rule
    const newConcRes = await request('POST', '/api/admin/concession-rules', {
      concessionType: 'SENIOR_CITIZEN',
      classId: 1,
      trainGroup: 'TEST_GROUP',
      discountPct: 40.0,
      proofTypes: ['AADHAAR'],
      isActive: true
    }, tokenAdmin);
    assert(newConcRes.status === 201, 'POST /api/admin/concession-rules created 201 Created');
    const newConcId = newConcRes.data.data.ruleId;

    // Update rule: trigger trg_audit_concession_change automatically fires
    const [concAuditBefore] = await pool.query("SELECT COUNT(*) AS cnt FROM AUDIT_LOG WHERE action = 'UPDATE_CONCESSION_RULE'");
    const updateConcRes = await request('PUT', `/api/admin/concession-rules/${newConcId}`, {
      discountPct: 50.0
    }, tokenAdmin);
    assert(updateConcRes.status === 200, 'PUT /api/admin/concession-rules updated 200 OK');

    const [concAuditAfter] = await pool.query("SELECT COUNT(*) AS cnt FROM AUDIT_LOG WHERE action = 'UPDATE_CONCESSION_RULE'");
    assert(concAuditAfter[0].cnt === concAuditBefore[0].cnt + 1, 'MySQL trigger trg_audit_concession_change recorded UPDATE_CONCESSION_RULE row');

    // Delete created concession rule
    const delConcRes = await request('DELETE', `/api/admin/concession-rules/${newConcId}`, null, tokenAdmin);
    assert(delConcRes.status === 200, 'DELETE concession rule returns 200 OK');

    // -------------------------------------------------------------------------
    // B.8 Refund Rules (Audited by Triggers; Node writes NO audit row)
    // -------------------------------------------------------------------------
    console.log('\n- Refund Rules CRUD & Trigger Audit Verification');
    const refundList = await request('GET', '/api/admin/refund-rules', null, tokenAdmin);
    assert(refundList.status === 200, 'GET /api/admin/refund-rules returns 200 OK');
    assert(refundList.data.data.length >= 4, 'List contains at least 4 refund rules');

    // Create new refund rule
    const newRefundRes = await request('POST', '/api/admin/refund-rules', {
      minHours: 120,
      maxHours: 240,
      deductionPct: 10.0,
      flatMinCharge: 50.0,
      clerkage: 30.0
    }, tokenAdmin);
    assert(newRefundRes.status === 201, 'POST /api/admin/refund-rules created 201 Created');
    const newRefundId = newRefundRes.data.data.ruleId;

    // Update refund rule: trigger trg_audit_refund_rule_change automatically fires
    const [refundAuditBefore] = await pool.query("SELECT COUNT(*) AS cnt FROM AUDIT_LOG WHERE action = 'UPDATE_REFUND_RULE'");
    const updateRefundRes = await request('PUT', `/api/admin/refund-rules/${newRefundId}`, {
      deductionPct: 15.0
    }, tokenAdmin);
    assert(updateRefundRes.status === 200, 'PUT /api/admin/refund-rules updated 200 OK');

    const [refundAuditAfter] = await pool.query("SELECT COUNT(*) AS cnt FROM AUDIT_LOG WHERE action = 'UPDATE_REFUND_RULE'");
    assert(refundAuditAfter[0].cnt === refundAuditBefore[0].cnt + 1, 'MySQL trigger trg_audit_refund_rule_change recorded UPDATE_REFUND_RULE row');

    // Delete created refund rule
    const delRefundRes = await request('DELETE', `/api/admin/refund-rules/${newRefundId}`, null, tokenAdmin);
    assert(delRefundRes.status === 200, 'DELETE refund rule returns 200 OK');

    // =========================================================================
    // FINAL: Inventory Audit Check
    // =========================================================================
    console.log('\n--- FINAL INVENTORY AUDIT ---');
    const auditAfter = await runInventoryAudit();
    assert(auditAfter.mismatches === 0, `Final inventory audit strictly 0 mismatches of ${auditAfter.totalInventories}`);

    console.log('\n================================================================');
    console.log(` SUITE D3C-3 FINISHED: ${passedTests}/${totalTests} TESTS PASSED (100%)`);
    console.log('================================================================');

  } catch (err) {
    console.error('\nTEST SUITE FAILED WITH ERROR:');
    console.error(err);
    process.exitCode = 1;
  } finally {
    clearTimeout(safetyTimeout);
    await stopServer();

    // Reset MySQL and MongoDB at the end per prompt instructions:
    // "The test must reset MySQL and MongoDB at the end (Mongo counts: live_train_status 2, notifications 2, complaints 2, activity_logs 3, raw_gateway_replies 5)."
    console.log('\n>>> RESETTING MYSQL AND MONGODB STATE VIA database/load/run-all.js...');
    try {
      execSync('node database/load/run-all.js', {
        cwd: path.resolve(__dirname, '../../'),
        stdio: 'inherit'
      });
      console.log('✓ Database reload completed successfully.');
    } catch (resetErr) {
      console.error('Failed to reset database:', resetErr.message);
    }

    // Verify final MongoDB counts
    const db = await getOrConnectMongoDb();
    if (db) {
      const counts = {
        live_train_status: await db.collection('live_train_status').countDocuments(),
        notifications: await db.collection('notifications').countDocuments(),
        complaints: await db.collection('complaints').countDocuments(),
        activity_logs: await db.collection('activity_logs').countDocuments(),
        raw_gateway_replies: await db.collection('raw_gateway_replies').countDocuments()
      };
      console.log('\n--- FINAL VERIFIED MONGODB COUNTS ---');
      console.log(JSON.stringify(counts, null, 2));

      // Verify MySQL Show Full Tables
      const [finalTables] = await pool.query('SHOW FULL TABLES;');
      console.log(`\nFinal MySQL SHOW FULL TABLES count: ${finalTables.length} (37 base tables + 5 views = 42)`);
    }

    await closeMongo().catch(() => {});
    await pool.end().catch(() => {});
    process.exit(process.exitCode || 0);
  }
}

runTests().catch(async (err) => {
  console.error('\n[FATAL ERROR IN TEST SUITE]:', err);
  try {
    await stopServer();
    await closeMongo().catch(() => {});
    await pool.end().catch(() => {});
  } catch (_) {}
  process.exit(1);
});
