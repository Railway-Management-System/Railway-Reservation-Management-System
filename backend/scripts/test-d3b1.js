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

async function getTableCounts() {
  const [bRows] = await pool.query('SELECT COUNT(*) AS cnt FROM BOOKING');
  const [rRows] = await pool.query('SELECT COUNT(*) AS cnt FROM RESERVATION');
  const [refRows] = await pool.query('SELECT COUNT(*) AS cnt FROM REFUND');
  const [cRows] = await pool.query('SELECT COUNT(*) AS cnt FROM CANCELLATION');

  return {
    bookingCount: bRows[0].cnt,
    reservationCount: rRows[0].cnt,
    refundCount: refRows[0].cnt,
    cancellationCount: cRows[0].cnt
  };
}

async function runTests() {
  const safetyTimeout = setTimeout(() => {
    console.error('\n[FATAL ERROR]: Safety timeout of 120 seconds reached. Test suite test-d3b1 timed out!');
    process.exit(1);
  }, 120000);
  safetyTimeout.unref();

  console.log('================================================================');
  console.log(' RAILWAY RESERVATION SYSTEM - SUITE D3B-1 (READ-ONLY BOOKINGS)');
  console.log('================================================================');

  // Step 1: Capture initial database table counts to prove read-only behavior
  const countsBefore = await getTableCounts();
  console.log('\n--- INITIAL DATABASE COUNTS ---');
  console.log(`  BOOKING:      ${countsBefore.bookingCount}`);
  console.log(`  RESERVATION:  ${countsBefore.reservationCount}`);
  console.log(`  REFUND:       ${countsBefore.refundCount}`);
  console.log(`  CANCELLATION: ${countsBefore.cancellationCount}`);

  await startServer();

  try {
    // -------------------------------------------------------------------------
    // SETUP: Authenticate Test Users from Seed Data
    // -------------------------------------------------------------------------
    console.log('\n--- SETUP: Authenticating Test Users ---');

    // 1. Passenger A: user 26009 (has 6 seeded bookings)
    const userALogin = await request('POST', '/api/auth/passenger/login', {
      email: 'user26009_5357@example.com',
      password: 'Password123!'
    });
    assert(userALogin.status === 200, 'User A (user 26009) logged in successfully');
    const tokenUserA = userALogin.data.data.token;

    // 2. Passenger B: user 46048 (has 6 different seeded bookings)
    const userBLogin = await request('POST', '/api/auth/passenger/login', {
      email: 'user46048_1965@example.com',
      password: 'Password123!'
    });
    assert(userBLogin.status === 200, 'User B (user 46048) logged in successfully');
    const tokenUserB = userBLogin.data.data.token;

    // 3. Passenger C: user 50001 (Rahul Sharma - has 1 booking 2849116375)
    const userCLogin = await request('POST', '/api/auth/passenger/login', {
      email: 'rahul.sharma@example.com',
      password: 'Password123!'
    });
    assert(userCLogin.status === 200, 'User C (user 50001) logged in successfully');
    const tokenUserC = userCLogin.data.data.token;

    // 4. Staff Member: Ticket Collector (EMP-TC-101)
    const staffLogin = await request('POST', '/api/auth/staff/login', {
      employeeId: 'EMP-TC-101',
      password: 'StaffPassword123!'
    });
    assert(staffLogin.status === 200, 'Staff (EMP-TC-101) logged in successfully');
    const tokenStaff = staffLogin.data.data.token;

    // 5. Admin: Super Admin
    const adminLogin = await request('POST', '/api/auth/admin/login', {
      email: 'admin@railways.gov.in',
      password: 'AdminPassword123!'
    });
    assert(adminLogin.status === 200, 'Admin (admin@railways.gov.in) logged in successfully');
    const tokenAdmin = adminLogin.data.data.token;

    // -------------------------------------------------------------------------
    // TEST 1: GET /api/bookings - Own List Works
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 1: GET /api/bookings (Own List Works) ---');
    const listResA = await request('GET', '/api/bookings', null, tokenUserA);
    assert(listResA.status === 200, 'User A retrieves their bookings with HTTP 200');
    assert(listResA.data.success === true, 'Response success is true');
    assert(Array.isArray(listResA.data.data), 'data is an array');
    assert(listResA.data.data.length === 6, 'User A receives all 6 seeded bookings');

    const firstBooking = listResA.data.data[0];
    assert(typeof firstBooking.pnr === 'string' && firstBooking.pnr.length === 10, 'Booking has 10-digit pnr string');
    assert(typeof firstBooking.bookingStatus === 'string', 'Booking has bookingStatus string');
    assert(typeof firstBooking.trainNumber === 'string', 'Booking has trainNumber string');
    assert(typeof firstBooking.trainName === 'string', 'Booking has trainName string');
    assert(typeof firstBooking.journeyDate === 'string', 'Booking has journeyDate string');
    assert(typeof firstBooking.classType === 'string', 'Booking has classType string');
    assert(typeof firstBooking.quota === 'string', 'Booking has quota string');
    assert(typeof firstBooking.totalFare === 'number', 'Booking has totalFare number');
    assert(typeof firstBooking.passengerCount === 'number', 'Booking has passengerCount number');
    assert(typeof firstBooking.createdAt === 'string', 'Booking has createdAt string');
    assert(firstBooking.boardingStation && typeof firstBooking.boardingStation.stationCode === 'string', 'Booking has boardingStation.stationCode');
    assert(firstBooking.boardingStation && typeof firstBooking.boardingStation.stationName === 'string', 'Booking has boardingStation.stationName');
    assert(firstBooking.destinationStation && typeof firstBooking.destinationStation.stationCode === 'string', 'Booking has destinationStation.stationCode');
    assert(firstBooking.destinationStation && typeof firstBooking.destinationStation.stationName === 'string', 'Booking has destinationStation.stationName');

    // Verify sorting: created_at DESC, then pnr DESC
    const allCreatedAtEqual = listResA.data.data.every(b => b.createdAt === listResA.data.data[0].createdAt);
    if (allCreatedAtEqual) {
      console.log(`  All created_at values are equal (${listResA.data.data[0].createdAt}), checking pnr descending`);
      for (let i = 0; i < listResA.data.data.length - 1; i++) {
        const pnr1 = listResA.data.data[i].pnr;
        const pnr2 = listResA.data.data[i + 1].pnr;
        assert(pnr1 > pnr2, `Bookings sorted by PNR descending (${pnr1} > ${pnr2})`);
      }
    } else {
      for (let i = 0; i < listResA.data.data.length - 1; i++) {
        const d1 = new Date(listResA.data.data[i].createdAt).getTime();
        const d2 = new Date(listResA.data.data[i + 1].createdAt).getTime();
        if (d1 === d2) {
          const pnr1 = listResA.data.data[i].pnr;
          const pnr2 = listResA.data.data[i + 1].pnr;
          assert(pnr1 > pnr2, `Equal created_at: bookings sorted by PNR descending (${pnr1} > ${pnr2})`);
        } else {
          assert(d1 > d2, `Bookings sorted newest first (${listResA.data.data[i].createdAt} > ${listResA.data.data[i + 1].createdAt})`);
        }
      }
    }

    // Optional status filter
    const confirmedFilterRes = await request('GET', '/api/bookings?status=CONFIRMED', null, tokenUserA);
    assert(confirmedFilterRes.status === 200, 'Status filter ?status=CONFIRMED returns HTTP 200');
    assert(confirmedFilterRes.data.data.every(b => b.bookingStatus === 'CONFIRMED'), 'All returned bookings have status CONFIRMED');

    // Limit cap check (capped at 200)
    const limitRes = await request('GET', '/api/bookings?limit=2', null, tokenUserA);
    assert(limitRes.status === 200, 'Limit query ?limit=2 returns HTTP 200');
    assert(limitRes.data.data.length === 2, 'Limit query ?limit=2 returns exactly 2 bookings');

    // -------------------------------------------------------------------------
    // TEST 1b: STAFF and ADMIN calling GET /api/bookings get 403 FORBIDDEN
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 1b: STAFF and ADMIN calling GET /api/bookings get 403 ---');
    const staffListRes = await request('GET', '/api/bookings', null, tokenStaff);
    assert(staffListRes.status === 403, 'STAFF calling GET /api/bookings receives HTTP 403 Forbidden');
    assert(staffListRes.data.success === false, 'STAFF response success is false');
    assert(staffListRes.data.error && staffListRes.data.error.code === 'FORBIDDEN', 'STAFF error code is FORBIDDEN');

    const adminListRes = await request('GET', '/api/bookings', null, tokenAdmin);
    assert(adminListRes.status === 403, 'ADMIN calling GET /api/bookings receives HTTP 403 Forbidden');
    assert(adminListRes.data.success === false, 'ADMIN response success is false');
    assert(adminListRes.data.error && adminListRes.data.error.code === 'FORBIDDEN', 'ADMIN error code is FORBIDDEN');

    // -------------------------------------------------------------------------
    // TEST 2: Another User's List Never Leaks
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 2: Another User\'s List Never Leaks ---');
    const listResB = await request('GET', '/api/bookings', null, tokenUserB);
    assert(listResB.status === 200, 'User B retrieves their bookings with HTTP 200');
    assert(listResB.data.data.length === 6, 'User B receives exactly 6 bookings');

    const pnrsA = new Set(listResA.data.data.map(b => b.pnr));
    const pnrsB = new Set(listResB.data.data.map(b => b.pnr));
    const overlap = [...pnrsA].filter(pnr => pnrsB.has(pnr));
    assert(overlap.length === 0, 'Zero PNR overlap between User A and User B lists (no data leak)');

    const listResC = await request('GET', '/api/bookings', null, tokenUserC);
    assert(listResC.status === 200, 'User C retrieves their bookings with HTTP 200');
    assert(listResC.data.data.length === 1, 'User C sees only their 1 booking');
    assert(listResC.data.data[0].pnr === '2849116375', 'User C sees their own PNR 2849116375');

    // -------------------------------------------------------------------------
    // TEST 3: Own PNR Works
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 3: Own PNR Works ---');
    const ownPnr = '2849100161'; // Owned by User A (26009)
    const pnrResA = await request('GET', `/api/bookings/${ownPnr}`, null, tokenUserA);
    assert(pnrResA.status === 200, `User A retrieves own PNR ${ownPnr} with HTTP 200`);
    assert(pnrResA.data.data.pnr === ownPnr, 'Response PNR matches requested PNR');
    assert(Array.isArray(pnrResA.data.data.passengers), 'passengers is an array');
    assert(pnrResA.data.data.passengers.length === pnrResA.data.data.passengerCount, 'passengers array length matches passengerCount');

    const pax1 = pnrResA.data.data.passengers[0];
    assert(typeof pax1.passengerNo === 'number', 'passengerNo is number');
    assert(typeof pax1.name === 'string', 'passenger name is string');
    assert(typeof pax1.age === 'number', 'passenger age is number');
    assert(typeof pax1.gender === 'string', 'passenger gender is string');
    assert(typeof pax1.status === 'string', 'passenger status is string');
    assert(pax1.queuePosition === null || typeof pax1.queuePosition === 'string', 'queuePosition is string or null');
    assert(pax1.coachNumber === null || typeof pax1.coachNumber === 'string', 'coachNumber is string or null');
    assert(pax1.seatNumber === null || typeof pax1.seatNumber === 'number', 'seatNumber is number or null');
    assert(pax1.berthType === null || typeof pax1.berthType === 'string', 'berthType is string or null');

    // -------------------------------------------------------------------------
    // TEST 3b: Seeded PNR with Fixed Station Names Shows Full Display Names
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 3b: Seeded PNR with Fixed Station Names Shows Full Display Names ---');
    const pnrFixedStations = '2849101771'; // User A (26009): from 109 (TVC), to 83 (NZM)
    const pnrFixedRes = await request('GET', `/api/bookings/${pnrFixedStations}`, null, tokenUserA);
    assert(pnrFixedRes.status === 200, `User A retrieves PNR ${pnrFixedStations} with HTTP 200`);
    assert(pnrFixedRes.data.data.boardingStation && pnrFixedRes.data.data.boardingStation.stationName === 'Trivandrum Central', `Boarding station name is full display name "Trivandrum Central" (got "${pnrFixedRes.data.data.boardingStation?.stationName}")`);
    assert(pnrFixedRes.data.data.destinationStation && pnrFixedRes.data.data.destinationStation.stationName === 'Hazrat Nizamuddin', `Destination station name is full display name "Hazrat Nizamuddin" (got "${pnrFixedRes.data.data.destinationStation?.stationName}")`);

    // -------------------------------------------------------------------------
    // TEST 4: Someone Else's PNR is Refused (HTTP 403)
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 4: Someone Else\'s PNR is Refused (HTTP 403) ---');
    const pnrOther = '2849116375'; // Owned by User C (50001)
    const refuseRes = await request('GET', `/api/bookings/${pnrOther}`, null, tokenUserA);
    assert(refuseRes.status === 403, 'Attempting to read another user\'s PNR returns HTTP 403 Forbidden');
    assert(refuseRes.data.success === false, 'success is false');
    assert(refuseRes.data.error.code === 'FORBIDDEN', 'error code is FORBIDDEN');

    // -------------------------------------------------------------------------
    // TEST 5: Staff and Admin Can Read Any PNR
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 5: Staff and Admin Can Read Any PNR ---');
    const staffReadA = await request('GET', `/api/bookings/${ownPnr}`, null, tokenStaff);
    assert(staffReadA.status === 200, `Staff reads User A's PNR ${ownPnr} with HTTP 200`);
    assert(staffReadA.data.data.pnr === ownPnr, 'Staff received correct booking data');

    const staffReadC = await request('GET', `/api/bookings/${pnrOther}`, null, tokenStaff);
    assert(staffReadC.status === 200, `Staff reads User C's PNR ${pnrOther} with HTTP 200`);
    assert(staffReadC.data.data.pnr === pnrOther, 'Staff received correct booking data');

    const adminRead = await request('GET', `/api/bookings/${ownPnr}`, null, tokenAdmin);
    assert(adminRead.status === 200, `Admin reads PNR ${ownPnr} with HTTP 200`);
    assert(adminRead.data.data.pnr === ownPnr, 'Admin received correct booking data');

    // -------------------------------------------------------------------------
    // TEST 6: Unknown PNR Returns HTTP 404
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 6: Unknown PNR Returns HTTP 404 ---');
    const unknownPnr = '9999999999';
    const unknownRes = await request('GET', `/api/bookings/${unknownPnr}`, null, tokenStaff);
    assert(unknownRes.status === 404, 'Unknown PNR returns HTTP 404 Not Found');
    assert(unknownRes.data.success === false, 'success is false');
    assert(unknownRes.data.error.code === 'NOT_FOUND', 'error code is NOT_FOUND');

    // -------------------------------------------------------------------------
    // TEST 7: RAC and Waiting-List Passenger Shows queuePosition
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 7: RAC and Waiting-List Passenger Shows queuePosition ---');

    // 7a. Seeded RAC PNR: 2849100103
    const racPnr = '2849100103';
    const racRes = await request('GET', `/api/bookings/${racPnr}`, null, tokenStaff);
    assert(racRes.status === 200, `Staff reads RAC booking ${racPnr} with HTTP 200`);
    const racPax = racRes.data.data.passengers[0];
    assert(racPax.status === 'RAC', 'RAC passenger has status RAC');
    assert(racPax.queuePosition && racPax.queuePosition.startsWith('RAC/'), `RAC passenger queuePosition is '${racPax.queuePosition}'`);
    assert(racPax.coachNumber === null, 'RAC passenger has null coachNumber');
    assert(racPax.seatNumber === null, 'RAC passenger has null seatNumber');
    assert(racPax.berthType === null, 'RAC passenger has null berthType');

    // 7b. Seeded Waiting List PNR: 2849100012
    const wlPnr = '2849100012';
    const wlRes = await request('GET', `/api/bookings/${wlPnr}`, null, tokenStaff);
    assert(wlRes.status === 200, `Staff reads WAITING_LIST booking ${wlPnr} with HTTP 200`);
    const wlPax = wlRes.data.data.passengers[0];
    assert(wlPax.status === 'WAITING_LIST', 'Waiting list passenger has status WAITING_LIST');
    assert(wlPax.queuePosition && wlPax.queuePosition.startsWith('WL/'), `Waiting list passenger queuePosition is '${wlPax.queuePosition}'`);
    assert(wlPax.coachNumber === null, 'Waiting list passenger has null coachNumber');
    assert(wlPax.seatNumber === null, 'Waiting list passenger has null seatNumber');
    assert(wlPax.berthType === null, 'Waiting list passenger has null berthType');

    // -------------------------------------------------------------------------
    // TEST 8: Cancelled Booking Audit on Seeded Data
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 8: Cancelled Booking Audit on Seeded Data ---');
    const cancelledPnr = '2849100000'; // Seeded booking with status CANCELLED
    const cancelRes = await request('GET', `/api/bookings/${cancelledPnr}`, null, tokenStaff);
    assert(cancelRes.status === 200, `Staff reads seeded cancelled booking ${cancelledPnr} with HTTP 200`);
    assert(cancelRes.data.data.bookingStatus === 'CANCELLED', 'Booking status is CANCELLED');
    assert(Array.isArray(cancelRes.data.data.passengers) && cancelRes.data.data.passengers.length === 2, 'Passengers returned');

    for (const pax of cancelRes.data.data.passengers) {
      assert(pax.status === 'CANCELLED', `Passenger ${pax.passengerNo} status is CANCELLED`);
      assert(pax.seatNumber === null, `Passenger ${pax.passengerNo} seatNumber is null`);
      assert(pax.coachNumber === null, `Passenger ${pax.passengerNo} coachNumber is null`);
      assert(pax.berthType === null, `Passenger ${pax.passengerNo} berthType is null`);
    }
    console.log(`  NOTE: Seeded cancelled PNR 2849100000 verified: all passengers CANCELLED with null seat/coach/berth.`);

    // -------------------------------------------------------------------------
    // TEST 9: Proving Endpoints Write Nothing (Counts Before === Counts After)
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 9: Proving Both Endpoints Write Nothing ---');
    const countsAfter = await getTableCounts();

    console.log(`  BOOKING:      Before = ${countsBefore.bookingCount}, After = ${countsAfter.bookingCount}`);
    console.log(`  RESERVATION:  Before = ${countsBefore.reservationCount}, After = ${countsAfter.reservationCount}`);
    console.log(`  REFUND:       Before = ${countsBefore.refundCount}, After = ${countsAfter.refundCount}`);
    console.log(`  CANCELLATION: Before = ${countsBefore.cancellationCount}, After = ${countsAfter.cancellationCount}`);

    assert(countsBefore.bookingCount === countsAfter.bookingCount, 'BOOKING table count unchanged');
    assert(countsBefore.reservationCount === countsAfter.reservationCount, 'RESERVATION table count unchanged');
    assert(countsBefore.refundCount === countsAfter.refundCount, 'REFUND table count unchanged');
    assert(countsBefore.cancellationCount === countsAfter.cancellationCount, 'CANCELLATION table count unchanged');

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
  console.error('\n[FATAL ERROR IN TEST SUITE]:', err);
  try {
    await stopServer();
    await pool.end().catch(() => {});
    await closeMongo().catch(() => {});
  } catch (_) {}
  process.exit(1);
});
