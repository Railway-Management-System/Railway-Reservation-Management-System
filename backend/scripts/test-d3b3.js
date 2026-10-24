/**
 * Railway Reservation System - Master Test Suite D3b-3
 * TDR Filing, Verification & Adjudication Pipeline
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

async function pollNotifications(token, predicate, timeoutMs = 3000, intervalMs = 200) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const res = await request('GET', '/api/notifications', null, token);
    if (res.status === 200 && Array.isArray(res.data.data)) {
      const match = res.data.data.find(predicate);
      if (match) return match;
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  const finalRes = await request('GET', '/api/notifications', null, token);
  return finalRes.status === 200 && Array.isArray(finalRes.data.data)
    ? finalRes.data.data.find(predicate)
    : null;
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
  const safetyTimeout = setTimeout(() => {
    console.error('\n[FATAL ERROR]: Safety timeout of 120 seconds reached. Test suite test-d3b3 timed out!');
    process.exit(1);
  }, 120000);
  safetyTimeout.unref();

  console.log('================================================================');
  console.log(' RAILWAY RESERVATION SYSTEM - SUITE D3B-3 (TDR PIPELINE)');
  console.log('================================================================');

  const baselineAudit = await runInventoryAudit();
  console.log(`\n--- BASELINE INVENTORY AUDIT: ${baselineAudit.mismatches} mismatches of ${baselineAudit.total} ---`);
  assert(baselineAudit.mismatches === 0, `Baseline inventory audit has 0 mismatches of ${baselineAudit.total}`);

  await startServer();

  try {
    // -------------------------------------------------------------------------
    // SETUP: Authenticate Test Users
    // -------------------------------------------------------------------------
    console.log('\n--- SETUP: Authenticating Users ---');

    // Admin login
    const adminLogin = await request('POST', '/api/auth/admin/login', {
      email: 'admin@railways.gov.in',
      password: 'AdminPassword123!'
    });
    assert(adminLogin.status === 200, 'Admin (admin@railways.gov.in) logged in successfully');
    const tokenAdmin = adminLogin.data.data.token;

    // Staff login
    const staffLogin = await request('POST', '/api/auth/staff/login', {
      employeeId: 'EMP-TC-101',
      password: 'StaffPassword123!'
    });
    assert(staffLogin.status === 200, 'Staff (EMP-TC-101) logged in successfully');
    const tokenStaff = staffLogin.data.data.token;

    // Passenger Owner: user 25117 (Riya Gole, owner of booking 2849115626 on schedule 1063)
    const ownerLogin = await request('POST', '/api/auth/passenger/login', {
      email: 'user25117_9153@example.com',
      password: 'Password123!'
    });
    assert(ownerLogin.status === 200, 'Passenger Owner (user 25117) logged in successfully');
    const tokenOwner = ownerLogin.data.data.token;

    // Another Passenger: user 50001 (Rahul Sharma, non-owner)
    const otherLogin = await request('POST', '/api/auth/passenger/login', {
      email: 'rahul.sharma@example.com',
      password: 'Password123!'
    });
    assert(otherLogin.status === 200, 'Passenger Other (user 50001) logged in successfully');
    const tokenOther = otherLogin.data.data.token;

    // Advance schedule 1063 to future date: seed run date (2026-10-24) has passed;
    // ensure schedule has not departed so delay TDR deadline checks pass.
    // The database is reloaded when the suite ends.
    await pool.query('UPDATE TRAIN_SCHEDULE SET journey_date = DATE_ADD(CURDATE(), INTERVAL 1 DAY) WHERE schedule_id = 1063');

    // -------------------------------------------------------------------------
    // REQUIREMENT 1: Board an RAC passenger via POST /api/staff/boarding and audit
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 1: Board RAC Passenger and Audit Inventory ---');
    // Find an RAC passenger
    const [racTarget] = await pool.query(`
      SELECT r.pnr, r.passenger_no, b.schedule_id, r.status
      FROM RESERVATION r
      JOIN BOOKING b ON r.pnr = b.pnr
      WHERE r.status = 'RAC'
      ORDER BY r.res_id ASC
      LIMIT 1
    `);
    assert(racTarget.length > 0 && racTarget[0].status === 'RAC', 'Target passenger is in RAC status');
    const racPnr = racTarget[0].pnr;
    const racPassNo = racTarget[0].passenger_no;
    const racSchedId = racTarget[0].schedule_id;

    // Assign staff 1 on TRAIN_DUTY for schedule
    await pool.query(`
      INSERT INTO STAFF_ASSIGNMENT (assign_id, staff_id, schedule_id, station_id, duty_type, shift_start, shift_end)
      VALUES (9997, 1, ?, 10, 'TRAIN_DUTY', DATE_SUB(NOW(), INTERVAL 7 DAY), DATE_ADD(NOW(), INTERVAL 30 DAY))
      ON DUPLICATE KEY UPDATE duty_type = 'TRAIN_DUTY', shift_end = DATE_ADD(NOW(), INTERVAL 30 DAY)
    `, [racSchedId]);

    const boardRacRes = await request('POST', '/api/staff/boarding', {
      pnr: racPnr,
      passengerNo: racPassNo
    }, tokenStaff);

    assert(boardRacRes.status === 200, 'POST /api/staff/boarding on RAC returns HTTP 200');
    assert(boardRacRes.data.success === true, 'Response success is true');
    assert(boardRacRes.data.data.status === 'BOARDED', 'Response status is BOARDED');

    const [boardRacDb] = await pool.query('SELECT status FROM RESERVATION WHERE pnr = ? AND passenger_no = ?', [racPnr, racPassNo]);
    assert(boardRacDb[0].status === 'BOARDED', 'RAC passenger status updated to BOARDED in DB');

    const racBoardAudit = await runInventoryAudit();
    console.log(`  Master inventory audit after RAC boarding: ${racBoardAudit.mismatches} mismatches of ${racBoardAudit.total}`);
    assert(racBoardAudit.mismatches === 0, `Inventory audit MUST stay 0 mismatches of ${racBoardAudit.total} after RAC boarding`);

    // -------------------------------------------------------------------------
    // REQUIREMENT 5a: Delay TDR refused when delay_minutes is under 180
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 2: Delay TDR Refused When Delay < 180 Minutes ---');
    // Set delay_minutes = 120 on schedule 1063 (future journey_date, has not departed yet)
    await pool.query('UPDATE TRAIN_SCHEDULE SET delay_minutes = 120 WHERE schedule_id = 1063');

    const delayUnder180Res = await request('POST', '/api/tdr', {
      pnr: '2849115626',
      passengerNos: [1],
      reason: 'TRAIN_DELAYED_OVER_3_HOURS'
    }, tokenOwner);

    assert(delayUnder180Res.status === 400, 'Delay TDR with delay < 180 min returns HTTP 400');
    assert(delayUnder180Res.data.success === false, 'Response success is false');
    assert(delayUnder180Res.data.error.code === 'BAD_REQUEST', 'Error code is BAD_REQUEST');

    // -------------------------------------------------------------------------
    // REQUIREMENT 5b: Non-Admin refused on admin routes
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 3: Non-Admin Refused on Admin Routes ---');
    const passGetAdminRes = await request('GET', '/api/admin/tdr', null, tokenOwner);
    assert(passGetAdminRes.status === 403, 'Passenger calling GET /api/admin/tdr returns HTTP 403');
    assert(passGetAdminRes.data.error.code === 'FORBIDDEN', 'Error code is FORBIDDEN');

    const staffGetAdminRes = await request('GET', '/api/admin/tdr', null, tokenStaff);
    assert(staffGetAdminRes.status === 403, 'Staff calling GET /api/admin/tdr returns HTTP 403');
    assert(staffGetAdminRes.data.error.code === 'FORBIDDEN', 'Error code is FORBIDDEN');

    const passPutAdminRes = await request('PUT', '/api/admin/tdr/TDR-NONEXISTENT', { status: 'REJECTED' }, tokenOwner);
    assert(passPutAdminRes.status === 403, 'Passenger calling PUT /api/admin/tdr/:ref returns HTTP 403');
    assert(passPutAdminRes.data.error.code === 'FORBIDDEN', 'Error code is FORBIDDEN');

    const staffPutAdminRes = await request('PUT', '/api/admin/tdr/TDR-NONEXISTENT', { status: 'REJECTED' }, tokenStaff);
    assert(staffPutAdminRes.status === 403, 'Staff calling PUT /api/admin/tdr/:ref returns HTTP 403');
    assert(staffPutAdminRes.data.error.code === 'FORBIDDEN', 'Error code is FORBIDDEN');

    // -------------------------------------------------------------------------
    // REQUIREMENT 5c: Wrong owner refused
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 4: Wrong Owner Refused on POST /api/tdr ---');
    const wrongOwnerRes = await request('POST', '/api/tdr', {
      pnr: '2849115626',
      passengerNos: [1],
      reason: 'TRAIN_DELAYED_OVER_3_HOURS'
    }, tokenOther);

    assert(wrongOwnerRes.status === 403, 'Non-owner filing TDR returns HTTP 403 Forbidden');
    assert(wrongOwnerRes.data.error.code === 'FORBIDDEN', 'Error code is FORBIDDEN');

    // -------------------------------------------------------------------------
    // REQUIREMENT 5d: TC-certificate reason without evidence refused
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 5: TC-Certificate Reason Without Evidence Refused ---');
    const noEvidenceRes = await request('POST', '/api/tdr', {
      pnr: '2849115626',
      passengerNos: [1],
      reason: 'CLASS_DOWNGRADED'
    }, tokenOwner);

    assert(noEvidenceRes.status === 400, 'CLASS_DOWNGRADED without evidence returns HTTP 400');
    assert(noEvidenceRes.data.error.code === 'BAD_REQUEST', 'Error code is BAD_REQUEST');

    // -------------------------------------------------------------------------
    // REQUIREMENT 5e: BOARDED passenger refused for delay reason
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 6: BOARDED Passenger Refused for Delay Reason ---');
    // Set delay_minutes = 200 on schedule 1063
    await pool.query('UPDATE TRAIN_SCHEDULE SET delay_minutes = 200 WHERE schedule_id = 1063');

    // Mark passenger 1 on PNR 2849115627 as BOARDED by direct SQL
    await pool.query('UPDATE RESERVATION SET status = "BOARDED" WHERE pnr = "2849115627" AND passenger_no = 1');

    // Authenticate owner of 2849115627 (user 31132)
    const [u31132Rows] = await pool.query('SELECT email FROM USER_ACCOUNT WHERE user_id = 31132');
    const user31132Login = await request('POST', '/api/auth/passenger/login', {
      email: u31132Rows[0].email,
      password: 'Password123!'
    });
    assert(user31132Login.status === 200, 'Owner of 2849115627 logged in successfully');
    const tokenOwner31132 = user31132Login.data.data.token;

    const boardedDelayRes = await request('POST', '/api/tdr', {
      pnr: '2849115627',
      passengerNos: [1],
      reason: 'TRAIN_DELAYED_OVER_3_HOURS'
    }, tokenOwner31132);

    assert(boardedDelayRes.status === 400, 'BOARDED passenger filing delay TDR returns HTTP 400');
    assert(boardedDelayRes.data.error.code === 'BAD_REQUEST', 'Error code is BAD_REQUEST');

    // -------------------------------------------------------------------------
    // REQUIREMENT 5f: Delay TDR Filed and Approved, Waiting Promoted, Audit 0
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 7: Delay TDR Filed, Approved, Promotes Waiting, Audit 0 ---');
    // Ensure idempotency across repeated test runs
    await pool.query('DELETE FROM REFUND WHERE tdr_ref_no LIKE "TDR-284911562%"');
    await pool.query('DELETE FROM AUDIT_LOG WHERE table_name = "TDR_FILING" AND record_id LIKE "TDR-284911562%"');
    await pool.query('DELETE FROM TDR_FILING WHERE pnr IN ("2849115626", "2849115627", "2849115628", "2849115629")');
    await pool.query('DELETE FROM CANCELLATION WHERE pnr = "2849115629"');
    await pool.query('UPDATE RESERVATION SET status = "CONFIRMED", seat_id = 8449, queue_position = NULL WHERE pnr = "2849115626" AND passenger_no = 1');
    await pool.query('UPDATE BOOKING SET status = "CONFIRMED" WHERE pnr = "2849115626"');
    await pool.query('UPDATE RESERVATION SET status = "CONFIRMED", seat_id = 8454, queue_position = NULL WHERE pnr = "2849115629" AND passenger_no = 1');
    await pool.query('UPDATE RESERVATION SET status = "CONFIRMED", seat_id = 8455, queue_position = NULL WHERE pnr = "2849115629" AND passenger_no = 2');
    await pool.query('UPDATE RESERVATION SET status = "CONFIRMED", seat_id = 8456, queue_position = NULL WHERE pnr = "2849115629" AND passenger_no = 3');
    await pool.query('UPDATE BOOKING SET status = "CONFIRMED" WHERE pnr = "2849115629"');

    // Set up queue on schedule 1063 class 2 so a waiting passenger can be promoted:
    // Target passenger: PNR 2849115626 passenger 1 (CONFIRMED, seat 8449)
    // RAC passenger: PNR 2849115627 passenger 2 set to RAC (queue RAC/1, seat NULL)
    // WL passenger: PNR 2849115627 passenger 3 set to WAITING_LIST (queue WL/1, seat NULL)
    await pool.query('UPDATE RESERVATION SET status = "RAC", queue_position = "RAC/1", seat_id = NULL WHERE pnr = "2849115627" AND passenger_no = 2');
    await pool.query('UPDATE RESERVATION SET status = "WAITING_LIST", queue_position = "WL/1", seat_id = NULL WHERE pnr = "2849115627" AND passenger_no = 3');
    await pool.query(`
      UPDATE SCHEDULE_CLASS_INVENTORY sci
      JOIN (
        SELECT 
          r.schedule_id,
          b.class_id,
          SUM(CASE WHEN r.status IN ('CONFIRMED', 'BOARDED') THEN 1 ELSE 0 END) as conf_count,
          SUM(CASE WHEN r.status = 'RAC' THEN 1 ELSE 0 END) as rac_count,
          SUM(CASE WHEN r.status = 'WAITING_LIST' THEN 1 ELSE 0 END) as wl_count
        FROM RESERVATION r
        JOIN BOOKING b ON r.pnr = b.pnr
        WHERE r.schedule_id = 1063 AND b.class_id = 2
        GROUP BY r.schedule_id, b.class_id
      ) res ON sci.schedule_id = res.schedule_id AND sci.class_id = res.class_id
      SET sci.available_seats = sci.total_seats - res.conf_count,
          sci.rac_count = res.rac_count,
          sci.wl_count = res.wl_count
      WHERE sci.schedule_id = 1063 AND sci.class_id = 2
    `);

    const prepAudit = await runInventoryAudit();
    assert(prepAudit.mismatches === 0, `Pre-TDR inventory audit has 0 mismatches of ${prepAudit.total}`);

    // Owner files delay TDR
    const fileTdrRes = await request('POST', '/api/tdr', {
      pnr: '2849115626',
      passengerNos: [1],
      reason: 'TRAIN_DELAYED_OVER_3_HOURS',
      evidenceReference: 'DELAY_OVER_3H_TELEMETRY'
    }, tokenOwner);

    assert(fileTdrRes.status === 201, 'POST /api/tdr returns HTTP 201 Created');
    assert(fileTdrRes.data.success === true, 'Response success is true');
    assert(typeof fileTdrRes.data.data.tdrRefNo === 'string', 'tdrRefNo is returned as string');
    assert(fileTdrRes.data.data.status === 'FILED', 'TDR status is FILED');
    assert(Array.isArray(fileTdrRes.data.data.tdrRefNos), 'tdrRefNos is an array');
    assert(Array.isArray(fileTdrRes.data.data.tdrs), 'tdrs is an array');

    const createdTdrRefNo = fileTdrRes.data.data.tdrRefNo;
    console.log(`  Created TDR Ref No: ${createdTdrRefNo}`);

    // Verify GET /api/tdr (own list)
    const myTdrsRes = await request('GET', '/api/tdr', null, tokenOwner);
    assert(myTdrsRes.status === 200, 'GET /api/tdr returns HTTP 200');
    assert(Array.isArray(myTdrsRes.data.data), 'GET /api/tdr data is array');
    const myTdrEntry = myTdrsRes.data.data.find(t => t.tdrRefNo === createdTdrRefNo);
    assert(Boolean(myTdrEntry), 'Newly filed TDR is present in my TDR list');
    assert(myTdrEntry.pnr === '2849115626', 'PNR matches in list');

    // Verify GET /api/tdr/:tdrRefNo
    const singleTdrRes = await request('GET', `/api/tdr/${createdTdrRefNo}`, null, tokenOwner);
    assert(singleTdrRes.status === 200, 'GET /api/tdr/:ref returns HTTP 200');
    assert(singleTdrRes.data.data.tdrRefNo === createdTdrRefNo, 'tdrRefNo matches');

    // -------------------------------------------------------------------------
    // REQUIREMENT 5g: Duplicate open TDR refused
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 8: Duplicate Open TDR Refused ---');
    const dupTdrRes = await request('POST', '/api/tdr', {
      pnr: '2849115626',
      passengerNos: [1],
      reason: 'TRAIN_DELAYED_OVER_3_HOURS'
    }, tokenOwner);

    assert(dupTdrRes.status === 400, 'Duplicate open TDR filing returns HTTP 400');
    assert(dupTdrRes.data.error.code === 'BAD_REQUEST', 'Error code is BAD_REQUEST');

    // -------------------------------------------------------------------------
    // REQUIREMENT 5h: Admin approve with amount above fare line refused
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 9: Admin Approve With Excess Amount Refused ---');
    // Fare line for 2849115626 passenger 1: total_fare 4512.56 - insurance 0.45 = 4512.11
    const excessRefundRes = await request('PUT', `/api/admin/tdr/${createdTdrRefNo}`, {
      status: 'APPROVED',
      refundAmount: 5000.00,
      remarks: 'Attempting to refund more than paid fare'
    }, tokenAdmin);

    assert(excessRefundRes.status === 400, 'Refund amount above fare line returns HTTP 400');
    assert(excessRefundRes.data.error.code === 'BAD_REQUEST', 'Error code is BAD_REQUEST');

    // -------------------------------------------------------------------------
    // Admin Approves Valid Delay TDR (Promotion & Inventory Check)
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 10: Admin Approves Valid TDR & Executes Promotion ---');
    const approveRes = await request('PUT', `/api/admin/tdr/${createdTdrRefNo}`, {
      status: 'APPROVED',
      refundAmount: 4512.11,
      remarks: 'Delay over 180 min confirmed'
    }, tokenAdmin);

    assert(approveRes.status === 200, 'Admin approval returns HTTP 200');
    assert(approveRes.data.success === true, 'Approval success is true');
    assert(approveRes.data.data.status === 'APPROVED', 'Response status is APPROVED');
    assert(approveRes.data.data.refundAmount === 4512.11, 'Response refundAmount matches');
    assert(typeof approveRes.data.data.refund.refundId === 'number', 'Refund record created with ID');
    assert(approveRes.data.data.gatewayRefund !== undefined, 'gatewayRefund field present');

    // Verify database state:
    // 1. Target passenger reservation is CANCELLED and seat vacated
    const [targetDb] = await pool.query('SELECT status, seat_id FROM RESERVATION WHERE pnr = "2849115626" AND passenger_no = 1');
    assert(targetDb[0].status === 'CANCELLED', 'Target reservation status updated to CANCELLED');
    assert(targetDb[0].seat_id === null, 'Target physical seat vacated (seat_id is null)');

    // 2. RAC passenger promoted to CONFIRMED with freed seat 8449
    const [promotedRac] = await pool.query('SELECT status, seat_id, queue_position FROM RESERVATION WHERE pnr = "2849115627" AND passenger_no = 2');
    assert(promotedRac[0].status === 'CONFIRMED', 'RAC passenger promoted to CONFIRMED');
    assert(promotedRac[0].seat_id === 8449, 'Promoted passenger allocated target physical seat 8449');
    assert(promotedRac[0].queue_position === null, 'Promoted passenger queue_position cleared');

    // 3. Waiting list passenger promoted to RAC
    const [promotedWl] = await pool.query('SELECT status, queue_position FROM RESERVATION WHERE pnr = "2849115627" AND passenger_no = 3');
    assert(promotedWl[0].status === 'RAC', 'Waiting list passenger promoted to RAC');

    // 4. REFUND row exists and matches
    const [refundRows] = await pool.query('SELECT * FROM REFUND WHERE tdr_ref_no = ?', [createdTdrRefNo]);
    assert(refundRows.length === 1, 'Exactly 1 REFUND row written for approved TDR');
    assert(refundRows[0].reason === 'TDR_APPROVED', 'Refund reason is TDR_APPROVED');
    assert(parseFloat(refundRows[0].amount) === 4512.11, 'Refund amount matches 4512.11');

    // 5. AUDIT_LOG entry created
    const [auditRows] = await pool.query('SELECT * FROM AUDIT_LOG WHERE table_name = "TDR_FILING" AND record_id = ?', [createdTdrRefNo]);
    assert(auditRows.length >= 1, 'Audit log entry created for TDR review');
    assert(auditRows[0].action === 'TDR_REVIEW', 'Audit action is TDR_REVIEW');

    // Check a: After a TDR is APPROVED through the admin review route, the owner has a notification with type STATUS_UPDATE, title containing "TDR Claim APPROVED", and referenceId equal to tdrRefNo
    const approvedNtf = await pollNotifications(
      tokenOwner,
      (n) => n.type === 'STATUS_UPDATE' && typeof n.title === 'string' && n.title.includes('TDR Claim APPROVED') && n.referenceId === createdTdrRefNo,
      3000
    );
    assert(approvedNtf !== null && approvedNtf !== undefined, 'Owner received notification with type STATUS_UPDATE and title containing "TDR Claim APPROVED"');
    assert(approvedNtf.referenceId === createdTdrRefNo, 'Approved TDR notification referenceId equals tdrRefNo');

    // 6. Master inventory audit MUST stay 0 mismatches of 1,015
    const postPromotionAudit = await runInventoryAudit();
    console.log(`  Master inventory audit after TDR approval & promotion: ${postPromotionAudit.mismatches} mismatches of ${postPromotionAudit.total}`);
    assert(postPromotionAudit.mismatches === 0, `Inventory audit MUST stay 0 mismatches of ${postPromotionAudit.total}`);

    // -------------------------------------------------------------------------
    // REQUIREMENT 5i: Reject writes no refund
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 11: Rejection Writes No Refund ---');
    const [u12470Rows] = await pool.query('SELECT email FROM USER_ACCOUNT WHERE user_id = 12470');
    const user12470Login = await request('POST', '/api/auth/passenger/login', {
      email: u12470Rows[0].email,
      password: 'Password123!'
    });
    const token12470 = user12470Login.data.data.token;

    const file2Res = await request('POST', '/api/tdr', {
      pnr: '2849115628',
      passengerNos: [1],
      reason: 'CLASS_DOWNGRADED',
      evidenceReference: 'CERT_TC_OFFICIAL_102'
    }, token12470);

    assert(file2Res.status === 201, 'Second TDR filed successfully');
    const tdr2RefNo = file2Res.data.data.tdrRefNo;

    // Reject TDR
    const rejectRes = await request('PUT', `/api/admin/tdr/${tdr2RefNo}`, {
      status: 'REJECTED',
      remarks: 'Disallowed after review'
    }, tokenAdmin);

    assert(rejectRes.status === 200, 'Admin rejection returns HTTP 200');
    assert(rejectRes.data.data.status === 'REJECTED', 'Status is REJECTED');
    assert(rejectRes.data.data.refund === null, 'Response refund is null on rejection');

    // Assert zero REFUND rows were inserted for tdr2RefNo
    const [refundRows2] = await pool.query('SELECT * FROM REFUND WHERE tdr_ref_no = ?', [tdr2RefNo]);
    assert(refundRows2.length === 0, 'Zero REFUND rows written on rejection');

    // Assert audit log has status REJECTED
    const [auditRows2] = await pool.query('SELECT * FROM AUDIT_LOG WHERE table_name = "TDR_FILING" AND record_id = ?', [tdr2RefNo]);
    assert(auditRows2.length >= 1, 'Audit log entry created for rejection');

    // Check b: After a TDR is REJECTED, the owner has a notification with type STATUS_UPDATE, title containing "TDR Claim REJECTED", and referenceId equal to tdrRefNo
    const rejectedNtf = await pollNotifications(
      token12470,
      (n) => n.type === 'STATUS_UPDATE' && typeof n.title === 'string' && n.title.includes('TDR Claim REJECTED') && n.referenceId === tdr2RefNo,
      3000
    );
    assert(rejectedNtf !== null && rejectedNtf !== undefined, 'Owner received notification with type STATUS_UPDATE and title containing "TDR Claim REJECTED"');
    assert(rejectedNtf.referenceId === tdr2RefNo, 'Rejected TDR notification referenceId equals tdrRefNo');

    // -------------------------------------------------------------------------
    // REQUIREMENT: Cancelled passenger after filing delay TDR refused on approval
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 12: Cancelled Passenger After TDR Filing Refused on Approval ---');
    // Login as user 24062 (owner of 2849115629)
    const [u24062Rows] = await pool.query('SELECT email FROM USER_ACCOUNT WHERE user_id = 24062');
    const user24062Login = await request('POST', '/api/auth/passenger/login', {
      email: u24062Rows[0].email,
      password: 'Password123!'
    });
    assert(user24062Login.status === 200, 'Owner of 2849115629 logged in successfully');
    const tokenOwner24062 = user24062Login.data.data.token;

    // 1. File delay TDR for passenger 1
    const fileCancelTdrRes = await request('POST', '/api/tdr', {
      pnr: '2849115629',
      passengerNos: [1],
      reason: 'TRAIN_DELAYED_OVER_3_HOURS'
    }, tokenOwner24062);
    assert(fileCancelTdrRes.status === 201, 'Delay TDR filed for passenger 1');
    const tdrCancelRefNo = fileCancelTdrRes.data.data.tdrRefNo;

    // 2. Cancel passenger 1 through POST /api/bookings/:pnr/cancel
    const cancelPassRes = await request('POST', '/api/bookings/2849115629/cancel', {
      passengerNos: [1]
    }, tokenOwner24062);
    assert(cancelPassRes.status === 200, 'Passenger 1 cancelled successfully via /api/bookings/:pnr/cancel');

    // Verify passenger 1 reservation status is CANCELLED
    const [p1Res] = await pool.query('SELECT status FROM RESERVATION WHERE pnr = "2849115629" AND passenger_no = 1');
    assert(p1Res[0].status === 'CANCELLED', 'Passenger 1 reservation is CANCELLED');

    // 3. Count REFUND rows before approval attempt
    const [[{ refundCountBeforeCancel }]] = await pool.query('SELECT COUNT(*) AS refundCountBeforeCancel FROM REFUND');

    // 4. Admin attempts to approve the TDR
    const approveCancelledTdrRes = await request('PUT', `/api/admin/tdr/${tdrCancelRefNo}`, {
      status: 'APPROVED',
      refundAmount: 500.00,
      remarks: 'Attempting to approve TDR for cancelled passenger'
    }, tokenAdmin);

    assert(approveCancelledTdrRes.status === 400, 'Approving TDR for cancelled passenger returns HTTP 400');
    assert(approveCancelledTdrRes.data.error.code === 'BAD_REQUEST', 'Error code is BAD_REQUEST');

    // 5. Assert REFUND row count did not grow
    const [[{ refundCountAfterCancel }]] = await pool.query('SELECT COUNT(*) AS refundCountAfterCancel FROM REFUND');
    assert(refundCountAfterCancel === refundCountBeforeCancel, 'REFUND row count must not grow after refused approval');

    // 6. Assert TDR status remains unchanged (FILED)
    const [tdrCancelDb] = await pool.query('SELECT status FROM TDR_FILING WHERE tdr_ref_no = ?', [tdrCancelRefNo]);
    assert(tdrCancelDb[0].status === 'FILED', 'TDR filing status remains FILED (no refund processed)');

    // -------------------------------------------------------------------------
    // REQUIREMENT: NO_SHOW passenger after filing delay TDR refused on approval
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 13: NO_SHOW Passenger After TDR Filing Refused on Approval ---');
    // 1. File delay TDR for passenger 2
    const fileNoShowTdrRes = await request('POST', '/api/tdr', {
      pnr: '2849115629',
      passengerNos: [2],
      reason: 'TRAIN_DELAYED_OVER_3_HOURS'
    }, tokenOwner24062);
    assert(fileNoShowTdrRes.status === 201, 'Delay TDR filed for passenger 2');
    const tdrNoShowRefNo = fileNoShowTdrRes.data.data.tdrRefNo;

    // 2. Staff marks passenger 2 as NO_SHOW via POST /api/staff/noshow
    await pool.query(`
      INSERT INTO STAFF_ASSIGNMENT (assign_id, staff_id, schedule_id, station_id, duty_type, shift_start, shift_end)
      VALUES (9995, 1, 1063, 10, 'TRAIN_DUTY', DATE_SUB(NOW(), INTERVAL 7 DAY), DATE_ADD(NOW(), INTERVAL 30 DAY))
      ON DUPLICATE KEY UPDATE duty_type = 'TRAIN_DUTY', shift_end = DATE_ADD(NOW(), INTERVAL 30 DAY)
    `);

    const noShowRes = await request('POST', '/api/staff/no-show', {
      pnr: '2849115629',
      passengerNo: 2
    }, tokenStaff);
    assert(noShowRes.status === 200, 'Passenger 2 marked NO_SHOW via /api/staff/no-show');

    // Verify passenger 2 reservation status is NO_SHOW
    const [p2Res] = await pool.query('SELECT status FROM RESERVATION WHERE pnr = "2849115629" AND passenger_no = 2');
    assert(p2Res[0].status === 'NO_SHOW', 'Passenger 2 reservation is NO_SHOW');

    // 3. Count REFUND rows before approval attempt
    const [[{ refundCountBeforeNoShow }]] = await pool.query('SELECT COUNT(*) AS refundCountBeforeNoShow FROM REFUND');

    // 4. Admin attempts to approve the TDR
    const approveNoShowTdrRes = await request('PUT', `/api/admin/tdr/${tdrNoShowRefNo}`, {
      status: 'APPROVED',
      refundAmount: 500.00,
      remarks: 'Attempting to approve TDR for NO_SHOW passenger'
    }, tokenAdmin);

    assert(approveNoShowTdrRes.status === 400, 'Approving TDR for NO_SHOW passenger returns HTTP 400');
    assert(approveNoShowTdrRes.data.error.code === 'BAD_REQUEST', 'Error code is BAD_REQUEST');

    // 5. Assert REFUND row count did not grow
    const [[{ refundCountAfterNoShow }]] = await pool.query('SELECT COUNT(*) AS refundCountAfterNoShow FROM REFUND');
    assert(refundCountAfterNoShow === refundCountBeforeNoShow, 'REFUND row count must not grow after refused approval');

    // 6. Assert TDR status remains unchanged (FILED)
    const [tdrNoShowDb] = await pool.query('SELECT status FROM TDR_FILING WHERE tdr_ref_no = ?', [tdrNoShowRefNo]);
    assert(tdrNoShowDb[0].status === 'FILED', 'TDR filing status remains FILED (no refund processed)');

    // 7. Master Inventory Audit MUST stay 0 of 1,015
    const finalAudit = await runInventoryAudit();
    console.log(`  Master inventory audit after all tests: ${finalAudit.mismatches} mismatches of ${finalAudit.total}`);
    assert(finalAudit.mismatches === 0, `Inventory audit MUST stay 0 mismatches of ${finalAudit.total}`);

    console.log('\n================================================================');
    console.log(` ALL ${passedTests}/${totalTests} TESTS PASSED SUCCESSFULLY!`);
    console.log('================================================================');
  } catch (err) {
    console.error('\nTEST SUITE FAILED WITH ERROR:', err);
    process.exitCode = 1;
  } finally {
    clearTimeout(safetyTimeout);
    await stopServer();
    await pool.end().catch(() => {});
    await closeMongo().catch(() => {});
    if (require.main === module) {
      process.exit(process.exitCode || 0);
    }
  }
}

runTests().catch(async (err) => {
  console.error('\n[FATAL ERROR]: Test suite execution failed:');
  console.error(err);
  try {
    await stopServer();
    await pool.end().catch(() => {});
    await closeMongo().catch(() => {});
  } catch (_) {}
  process.exit(1);
});
