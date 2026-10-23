const app = require('../src/app');
const pool = require('../src/config/mysql');
const { connectMongo, closeMongo } = require('../src/config/mongodb');

let server;
let baseUrl;

async function startServer() {
  await connectMongo();
  return new Promise((resolve) => {
    server = app.listen(0, () => {
      const port = server.address().port;
      baseUrl = `http://127.0.0.1:${port}`;
      console.log(`[Test Runner] Express test server listening on ${baseUrl}`);
      resolve();
    });
  });
}

async function stopServer() {
  return new Promise((resolve) => {
    if (server) {
      server.close(async () => {
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
    resMap[`${row.schedule_id}_${row.class_id}`] = {
      confirmed_boarded: parseInt(row.confirmed_boarded_count, 10),
      rac: parseInt(row.rac_count, 10),
      wl: parseInt(row.wl_count, 10)
    };
  }

  const [invRows] = await pool.query('SELECT * FROM SCHEDULE_CLASS_INVENTORY');
  let mismatches = 0;
  for (const inv of invRows) {
    const key = `${inv.schedule_id}_${inv.class_id}`;
    const real = resMap[key] || { confirmed_boarded: 0, rac: 0, wl: 0 };
    if (
      inv.available_seats !== (inv.total_seats - real.confirmed_boarded) ||
      inv.rac_count !== real.rac ||
      inv.wl_count !== real.wl
    ) {
      mismatches++;
    }
  }

  return { total: invRows.length, mismatches };
}

async function runTests() {
  console.log('================================================================');
  console.log(' RAILWAY RESERVATION SYSTEM - SUITE D3B-2 (STAFF OPERATIONS)');
  console.log('================================================================');

  // Baseline audit
  const baselineAudit = await runInventoryAudit();
  console.log(`\n--- BASELINE INVENTORY AUDIT: ${baselineAudit.mismatches} mismatches of ${baselineAudit.total} ---`);
  assert(baselineAudit.mismatches === 0, 'Baseline inventory audit has 0 mismatches of 1,015');

  await startServer();

  try {
    // -------------------------------------------------------------------------
    // SETUP: Authenticate Users
    // -------------------------------------------------------------------------
    console.log('\n--- SETUP: Authenticating Users ---');

    // 1. Staff Member: Ticket Collector (EMP-TC-101, staffId: 1)
    const staffLogin = await request('POST', '/api/auth/staff/login', {
      employeeId: 'EMP-TC-101',
      password: 'StaffPassword123!'
    });
    assert(staffLogin.status === 200, 'Staff (EMP-TC-101) logged in successfully');
    const tokenStaff = staffLogin.data.data.token;

    // 2. Admin
    const adminLogin = await request('POST', '/api/auth/admin/login', {
      email: 'admin@railways.gov.in',
      password: 'AdminPassword123!'
    });
    assert(adminLogin.status === 200, 'Admin (admin@railways.gov.in) logged in successfully');
    const tokenAdmin = adminLogin.data.data.token;

    // 3. Passenger
    const userLogin = await request('POST', '/api/auth/passenger/login', {
      email: 'user26009_5357@example.com',
      password: 'Password123!'
    });
    assert(userLogin.status === 200, 'Passenger logged in successfully');
    const tokenPassenger = userLogin.data.data.token;

    // -------------------------------------------------------------------------
    // TEST 1: Passenger and Admin Tokens Refused on Staff-Only Routes
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 1: Passenger and Admin Tokens Refused on Staff Routes ---');

    // 1a. Passenger calling POST /api/staff/verification
    const pVerify = await request('POST', '/api/staff/verification', { pnr: '2849100015', passengerNo: 1, idChecked: true, result: 'VALID' }, tokenPassenger);
    assert(pVerify.status === 403, 'Passenger calling POST /api/staff/verification gets 403 Forbidden');
    assert(pVerify.data.error && pVerify.data.error.code === 'FORBIDDEN', 'Error code is FORBIDDEN');

    // 1b. Admin calling POST /api/staff/verification
    const aVerify = await request('POST', '/api/staff/verification', { pnr: '2849100015', passengerNo: 1, idChecked: true, result: 'VALID' }, tokenAdmin);
    assert(aVerify.status === 403, 'Admin calling POST /api/staff/verification gets 403 Forbidden');
    assert(aVerify.data.error && aVerify.data.error.code === 'FORBIDDEN', 'Error code is FORBIDDEN');

    // 1c. Passenger calling POST /api/staff/boarding
    const pBoard = await request('POST', '/api/staff/boarding', { pnr: '2849100015', passengerNo: 1 }, tokenPassenger);
    assert(pBoard.status === 403, 'Passenger calling POST /api/staff/boarding gets 403 Forbidden');
    assert(pBoard.data.error && pBoard.data.error.code === 'FORBIDDEN', 'Error code is FORBIDDEN');

    // 1d. Admin calling POST /api/staff/boarding
    const aBoard = await request('POST', '/api/staff/boarding', { pnr: '2849100015', passengerNo: 1 }, tokenAdmin);
    assert(aBoard.status === 403, 'Admin calling POST /api/staff/boarding gets 403 Forbidden');
    assert(aBoard.data.error && aBoard.data.error.code === 'FORBIDDEN', 'Error code is FORBIDDEN');

    // 1e. Passenger calling POST /api/staff/no-show
    const pNoShow = await request('POST', '/api/staff/no-show', { pnr: '2849100015', passengerNo: 1 }, tokenPassenger);
    assert(pNoShow.status === 403, 'Passenger calling POST /api/staff/no-show gets 403 Forbidden');
    assert(pNoShow.data.error && pNoShow.data.error.code === 'FORBIDDEN', 'Error code is FORBIDDEN');

    // 1f. Admin calling POST /api/staff/no-show
    const aNoShow = await request('POST', '/api/staff/no-show', { pnr: '2849100015', passengerNo: 1 }, tokenAdmin);
    assert(aNoShow.status === 403, 'Admin calling POST /api/staff/no-show gets 403 Forbidden');
    assert(aNoShow.data.error && aNoShow.data.error.code === 'FORBIDDEN', 'Error code is FORBIDDEN');

    // 1g. GET /api/staff/pnr/:pnr - Passenger refused 403, Staff & Admin permitted
    const pPnr = await request('GET', '/api/staff/pnr/2849100015', null, tokenPassenger);
    assert(pPnr.status === 403, 'Passenger calling GET /api/staff/pnr/:pnr gets 403 Forbidden');

    const sPnr = await request('GET', '/api/staff/pnr/2849100015', null, tokenStaff);
    assert(sPnr.status === 200, 'Staff calling GET /api/staff/pnr/:pnr gets 200 OK');
    assert(sPnr.data.data.pnr === '2849100015', 'Staff received booking details');

    const aPnr = await request('GET', '/api/staff/pnr/2849100015', null, tokenAdmin);
    assert(aPnr.status === 200, 'Admin calling GET /api/staff/pnr/:pnr gets 200 OK');
    assert(aPnr.data.data.pnr === '2849100015', 'Admin received booking details');

    // -------------------------------------------------------------------------
    // TEST 2: Staff Not Assigned to the Run is Refused (HTTP 403)
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 2: Staff Not Assigned to Run is Refused ---');
    // Staff 1 is assigned only to schedule 1001. PNR 2849100015 is on schedule 1064.
    const unassignedBoard = await request('POST', '/api/staff/boarding', { pnr: '2849100015', passengerNo: 1 }, tokenStaff);
    assert(unassignedBoard.status === 403, 'Staff not assigned to run calling boarding gets 403 Forbidden');
    assert(unassignedBoard.data.error && unassignedBoard.data.error.code === 'FORBIDDEN', 'Error code is FORBIDDEN');

    const unassignedVerify = await request('POST', '/api/staff/verification', { pnr: '2849100015', passengerNo: 1, idChecked: true, result: 'VALID' }, tokenStaff);
    assert(unassignedVerify.status === 403, 'Staff not assigned to run calling verification gets 403 Forbidden');

    const unassignedNoShow = await request('POST', '/api/staff/no-show', { pnr: '2849100015', passengerNo: 1 }, tokenStaff);
    assert(unassignedNoShow.status === 403, 'Staff not assigned to run calling no-show gets 403 Forbidden');

    // -------------------------------------------------------------------------
    // SETUP: Assign Staff 1 on TRAIN_DUTY for Schedule 1064
    // -------------------------------------------------------------------------
    console.log('\n--- SETUP: Assigning Staff 1 to Schedule 1064 ---');
    await pool.query(`
      INSERT INTO STAFF_ASSIGNMENT (assign_id, staff_id, schedule_id, station_id, duty_type, shift_start, shift_end)
      VALUES (8888, 1, 1064, 10, 'TRAIN_DUTY', '2026-10-18 00:00:00', '2026-10-18 23:59:59')
      ON DUPLICATE KEY UPDATE duty_type = 'TRAIN_DUTY'
    `);

    // -------------------------------------------------------------------------
    // TEST 3: Verification Writes One Row
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 3: Verification Writes One Row ---');
    const [vCountBefore] = await pool.query('SELECT COUNT(*) AS cnt FROM TICKET_VERIFICATION');

    const verifyRes = await request('POST', '/api/staff/verification', {
      pnr: '2849100015',
      passengerNo: 1,
      idChecked: true,
      concessionChecked: false,
      result: 'VALID',
      remarks: 'Test verification check'
    }, tokenStaff);

    assert(verifyRes.status === 200, 'POST /api/staff/verification returns HTTP 200');
    assert(verifyRes.data.success === true, 'Response success is true');
    assert(typeof verifyRes.data.data.verifyId === 'number', 'verifyId returned as number');
    assert(verifyRes.data.data.result === 'VALID', 'result is VALID');

    const [vCountAfter] = await pool.query('SELECT COUNT(*) AS cnt FROM TICKET_VERIFICATION');
    assert(vCountAfter[0].cnt === vCountBefore[0].cnt + 1, 'TICKET_VERIFICATION table row count increased by exactly 1');

    const [vRow] = await pool.query('SELECT * FROM TICKET_VERIFICATION WHERE verify_id = ?', [verifyRes.data.data.verifyId]);
    assert(vRow.length === 1, 'Verification record found in database');
    assert(vRow[0].pnr === '2849100015' && vRow[0].passenger_no === 1, 'Verification matches PNR and passengerNo');
    assert(vRow[0].staff_id === 1, 'Verification stamped with staffId 1');
    assert(vRow[0].result === 'VALID', 'Verification result matches VALID');
    assert(vRow[0].concession_match === 'NOT_APPLICABLE', 'concession_match is NOT_APPLICABLE');

    // -------------------------------------------------------------------------
    // TEST 4: Boarding Works
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 4: Boarding Works ---');
    const boardRes = await request('POST', '/api/staff/boarding', {
      pnr: '2849100015',
      passengerNo: 1
    }, tokenStaff);

    assert(boardRes.status === 200, 'POST /api/staff/boarding returns HTTP 200');
    assert(boardRes.data.success === true, 'Response success is true');
    assert(boardRes.data.data.status === 'BOARDED', 'Response status is BOARDED');

    const [boardRow] = await pool.query('SELECT status FROM RESERVATION WHERE pnr = ? AND passenger_no = ?', ['2849100015', 1]);
    assert(boardRow[0].status === 'BOARDED', 'Reservation status in database updated to BOARDED');

    // -------------------------------------------------------------------------
    // TEST 5: Boarding with a Delay TDR is Refused (HTTP 400 Bad Request)
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 5: Boarding with Delay TDR is Refused ---');
    // Directly insert an open delay TDR for passenger 2 of PNR 2849100015
    await pool.query(`
      INSERT INTO TDR_FILING (tdr_ref_no, pnr, passenger_no, reason, filed_at, status, remarks)
      VALUES ('TDR-D3B2-TEST', '2849100015', 2, 'TRAIN_DELAYED_OVER_3_HOURS', NOW(), 'FILED', 'Test open delay TDR')
      ON DUPLICATE KEY UPDATE status = 'FILED'
    `);

    const boardTdrRes = await request('POST', '/api/staff/boarding', {
      pnr: '2849100015',
      passengerNo: 2
    }, tokenStaff);

    assert(boardTdrRes.status === 400, 'Boarding passenger with open delay TDR returns HTTP 400 Bad Request');
    assert(boardTdrRes.data.success === false, 'Response success is false');
    assert(boardTdrRes.data.error && boardTdrRes.data.error.code === 'BAD_REQUEST', 'Error code is BAD_REQUEST');

    // Clean up test TDR record
    await pool.query("DELETE FROM TDR_FILING WHERE tdr_ref_no = 'TDR-D3B2-TEST'");

    // -------------------------------------------------------------------------
    // TEST 6: No-Show on CANCELLED is Refused (HTTP 400 Bad Request)
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 6: No-Show on CANCELLED is Refused ---');
    // Temporarily set a passenger reservation status to CANCELLED
    await pool.query("UPDATE RESERVATION SET status = 'CANCELLED' WHERE pnr = '2849100015' AND passenger_no = 2");

    const noShowCancRes = await request('POST', '/api/staff/no-show', {
      pnr: '2849100015',
      passengerNo: 2
    }, tokenStaff);

    assert(noShowCancRes.status === 400, 'No-show on CANCELLED reservation returns HTTP 400 Bad Request');
    assert(noShowCancRes.data.success === false, 'Response success is false');
    assert(noShowCancRes.data.error && noShowCancRes.data.error.code === 'BAD_REQUEST', 'Error code is BAD_REQUEST');

    // Restore passenger 2 to CONFIRMED
    await pool.query("UPDATE RESERVATION SET status = 'CONFIRMED' WHERE pnr = '2849100015' AND passenger_no = 2");

    // -------------------------------------------------------------------------
    // TEST 7: No-Show on CONFIRMED Works and Promotes
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 7: No-Show on CONFIRMED Works and Promotes ---');
    // Target: PNR 2849100016, passenger 1 (CONFIRMED, class 2, schedule 1064, seat 9387)
    // Next RAC passenger in line: PNR 2849100103, passenger 1 ('RAC/1')
    // Next WL passenger in line: PNR 2849100122, passenger 1 ('WL/1')
    const [beforeConf] = await pool.query("SELECT seat_id, status FROM RESERVATION WHERE pnr = '2849100016' AND passenger_no = 1");
    const [beforeRac] = await pool.query("SELECT status, queue_position FROM RESERVATION WHERE pnr = '2849100103' AND passenger_no = 1");
    const [beforeWl] = await pool.query("SELECT status, queue_position FROM RESERVATION WHERE pnr = '2849100122' AND passenger_no = 1");

    assert(beforeConf[0].status === 'CONFIRMED', 'Target passenger is CONFIRMED');
    assert(beforeRac[0].status === 'RAC', 'First in queue is RAC');
    assert(beforeWl[0].status === 'WAITING_LIST', 'First in queue is WAITING_LIST');

    const noShowConfRes = await request('POST', '/api/staff/no-show', {
      pnr: '2849100016',
      passengerNo: 1
    }, tokenStaff);

    assert(noShowConfRes.status === 200, 'POST /api/staff/no-show returns HTTP 200');
    assert(noShowConfRes.data.success === true, 'Response success is true');
    assert(noShowConfRes.data.data.status === 'NO_SHOW', 'Response status is NO_SHOW');

    const [afterTarget] = await pool.query("SELECT seat_id, status FROM RESERVATION WHERE pnr = '2849100016' AND passenger_no = 1");
    assert(afterTarget[0].status === 'NO_SHOW', 'Target passenger reservation status updated to NO_SHOW');
    assert(afterTarget[0].seat_id === null, 'Target passenger physical seat vacated (seat_id is null)');

    const [afterRac] = await pool.query("SELECT seat_id, status, queue_position FROM RESERVATION WHERE pnr = '2849100103' AND passenger_no = 1");
    assert(afterRac[0].status === 'CONFIRMED', 'RAC passenger promoted to CONFIRMED');
    assert(afterRac[0].seat_id === beforeConf[0].seat_id, 'Promoted passenger allocated the freed physical seat');
    assert(afterRac[0].queue_position === null, 'Promoted passenger queuePosition cleared');

    const [afterWl] = await pool.query("SELECT status, queue_position FROM RESERVATION WHERE pnr = '2849100122' AND passenger_no = 1");
    assert(afterWl[0].status === 'RAC', 'Waiting list passenger promoted to RAC');

    // -------------------------------------------------------------------------
    // TEST 8: No-Show on RAC Frees the Slot and Keeps Audit at 0
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 8: No-Show on RAC Frees the Slot and Keeps Audit at 0 ---');
    // Target RAC passenger: PNR 2849100104, passenger 1 ('RAC/2')
    const [racTargetBefore] = await pool.query("SELECT status FROM RESERVATION WHERE pnr = '2849100104' AND passenger_no = 1");
    assert(racTargetBefore[0].status === 'RAC', 'Target passenger is RAC');

    const noShowRacRes = await request('POST', '/api/staff/no-show', {
      pnr: '2849100104',
      passengerNo: 1
    }, tokenStaff);

    assert(noShowRacRes.status === 200, 'POST /api/staff/no-show on RAC passenger returns HTTP 200');
    assert(noShowRacRes.data.data.status === 'NO_SHOW', 'Response status is NO_SHOW');

    const [racTargetAfter] = await pool.query("SELECT status FROM RESERVATION WHERE pnr = '2849100104' AND passenger_no = 1");
    assert(racTargetAfter[0].status === 'NO_SHOW', 'RAC passenger status updated to NO_SHOW');

    // Run full master inventory audit
    const auditAfterRacNoShow = await runInventoryAudit();
    console.log(`  Master inventory audit after RAC no-show: ${auditAfterRacNoShow.mismatches} mismatches of ${auditAfterRacNoShow.total}`);
    assert(auditAfterRacNoShow.mismatches === 0, 'Inventory audit MUST stay 0 mismatches of 1,015 after RAC no-show');

    // Clean up temporary staff assignment
    await pool.query('DELETE FROM STAFF_ASSIGNMENT WHERE assign_id = 8888');

    console.log('\n================================================================');
    console.log(` ALL ${passedTests}/${totalTests} TESTS PASSED SUCCESSFULLY!`);
    console.log('================================================================');

  } finally {
    await stopServer();
    await pool.end();
    await closeMongo();
  }
}

runTests().catch(async (err) => {
  console.error('\n[FATAL ERROR IN TEST SUITE]:', err);
  try {
    await stopServer();
    await pool.end();
    await closeMongo();
  } catch (_) {}
  process.exit(1);
});
