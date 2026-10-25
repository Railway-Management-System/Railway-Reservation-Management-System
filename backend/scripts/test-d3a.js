const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');
const app = require('../src/app');
const config = require('../src/config/env');
const { connectMongo, getMongoDb, closeMongo } = require('../src/config/mongodb');
const pool = require('../src/config/mysql');
const { getOrEnsureFutureSchedule } = require('./helpers/scheduleHelper');

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

async function runTests() {
  const safetyTimeout = setTimeout(() => {
    console.error('\n[FATAL ERROR]: Safety timeout of 120 seconds reached. Test suite test-d3a timed out!');
    process.exit(1);
  }, 120000);
  safetyTimeout.unref();

  console.log('================================================================');
  console.log(' RAILWAY RESERVATION SYSTEM - SUITE D3A (CANCELLATION & REFUND)');
  console.log('================================================================');

  await startServer();

  try {
    // -------------------------------------------------------------------------
    // SETUP: Authenticate Test Users
    // -------------------------------------------------------------------------
    console.log('\n--- SETUP: Authenticating Test Users ---');

    // Login Passenger 1 (Rahul Sharma - 50001)
    const p1Login = await request('POST', '/api/auth/passenger/login', {
      email: 'rahul.sharma@example.com',
      password: 'Password123!'
    });
    assert(p1Login.status === 200, 'Passenger 1 (Rahul Sharma) logged in successfully');
    const token1 = p1Login.data.data.token;

    // Login Passenger 2 (Priya Patel - 50002)
    const p2Login = await request('POST', '/api/auth/passenger/login', {
      email: 'priya.patel@example.com',
      password: 'Password123!'
    });
    assert(p2Login.status === 200, 'Passenger 2 (Priya Patel) logged in successfully');
    const token2 = p2Login.data.data.token;

    // Login Staff (Vikram Singh - EMP-TC-101)
    const staffLogin = await request('POST', '/api/auth/staff/login', {
      employeeId: 'EMP-TC-101',
      password: 'StaffPassword123!'
    });
    assert(staffLogin.status === 200, 'Staff (EMP-TC-101) logged in successfully');
    const staffToken = staffLogin.data.data.token;

    // Obtain or ensure an active future schedule for Train 129 so tests are 100% date-proof
    const activeRun129 = await getOrEnsureFutureSchedule(pool, 129, 3);
    const testJourneyDate = activeRun129.journeyDate;

    // Helper to create and pay for a booking
    async function createAndPayBooking(passengersList, userToken = token1, customPaymentId = null) {
      const payload = {
        trainId: 129,
        journeyDate: testJourneyDate,
        boardingStationId: 21,    // BCT
        destinationStationId: 10, // NDLS
        classType: '3A',
        quota: 'GENERAL',
        passengers: passengersList,
        preferences: { autoUpgrade: true, berthCondition: false }
      };

      const bookRes = await request('POST', '/api/bookings', payload, userToken);
      if (bookRes.status !== 201) {
        throw new Error(`Booking failed: ${JSON.stringify(bookRes.data)}`);
      }
      const pnr = bookRes.data.data.pnr;

      const orderRes = await request('POST', '/api/payments/razorpay/order', { pnr }, userToken);
      const orderId = orderRes.data.data.orderId;

      const simPaymentId = customPaymentId || `pay_sim_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
      const validSignature = crypto
        .createHmac('sha256', config.RAZORPAY_KEY_SECRET)
        .update(`${orderId}|${simPaymentId}`)
        .digest('hex');

      const verifyRes = await request('POST', '/api/payments/razorpay/verify', {
        pnr,
        razorpayOrderId: orderId,
        razorpayPaymentId: simPaymentId,
        razorpaySignature: validSignature
      }, userToken);

      if (verifyRes.status !== 200 || !verifyRes.data.success) {
        throw new Error(`Payment verification failed: ${JSON.stringify(verifyRes.data)}`);
      }

      return { pnr, simPaymentId, totalFare: bookRes.data.data.totalFare };
    }

    // -------------------------------------------------------------------------
    // TEST 1: WRONG OWNER FORBIDDEN
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 1: Wrong Owner Cancellation Rejection ---');
    const b1 = await createAndPayBooking([
      { name: 'Passenger One', age: 30, gender: 'MALE', idProofType: 'AADHAAR', idProofReference: 'XXXX-XXXX-1111' }
    ], token1);

    const stealCancelRes = await request('POST', `/api/bookings/${b1.pnr}/cancel`, {}, token2);
    assert(stealCancelRes.status === 403, 'Unauthorized user cancelling someone else\'s booking rejected with HTTP 403 Forbidden');
    assert(stealCancelRes.data.success === false, 'Wrong owner cancel returns success false');
    assert(stealCancelRes.data.error.code === 'FORBIDDEN', 'Error code is FORBIDDEN');

    // -------------------------------------------------------------------------
    // TEST 2: UNPAID BOOKING REJECTION (PAYMENT_PENDING)
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 2: Unpaid Booking Cancellation Rejection ---');
    const unpaidPayload = {
      trainId: 129,
      journeyDate: testJourneyDate,
      boardingStationId: 21,
      destinationStationId: 10,
      classType: '3A',
      quota: 'GENERAL',
      passengers: [
        { name: 'Unpaid Passenger', age: 35, gender: 'FEMALE', idProofType: 'AADHAAR', idProofReference: 'XXXX-XXXX-2222' }
      ]
    };
    const unpaidBookRes = await request('POST', '/api/bookings', unpaidPayload, token1);
    const unpaidPnr = unpaidBookRes.data.data.pnr;

    const unpaidCancelRes = await request('POST', `/api/bookings/${unpaidPnr}/cancel`, {}, token1);
    assert(unpaidCancelRes.status === 400, 'Unpaid booking cancel rejected with HTTP 400 Bad Request');
    assert(unpaidCancelRes.data.success === false, 'Unpaid cancel returns success false');
    assert(unpaidCancelRes.data.error.code === 'BAD_REQUEST', 'Error code is BAD_REQUEST');

    // -------------------------------------------------------------------------
    // TEST 3: CANCEL ONE PASSENGER (Selective)
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 3: Cancel One Passenger on Multi-Passenger Booking ---');
    const b3 = await createAndPayBooking([
      { name: 'Alice Sharma', age: 28, gender: 'FEMALE', idProofType: 'AADHAAR', idProofReference: 'XXXX-XXXX-3331' },
      { name: 'Bob Sharma', age: 32, gender: 'MALE', idProofType: 'AADHAAR', idProofReference: 'XXXX-XXXX-3332' }
    ], token1);

    const cancel1Res = await request('POST', `/api/bookings/${b3.pnr}/cancel`, { passengerNos: [1] }, token1);
    assert(cancel1Res.status === 200, 'Single passenger cancel returns HTTP 200 OK');
    assert(cancel1Res.data.success === true, 'Cancellation response success is true');
    assert(Array.isArray(cancel1Res.data.data.cancelledPassengers) && cancel1Res.data.data.cancelledPassengers.length === 1, 'cancelledPassengers array contains 1 passenger');
    assert(cancel1Res.data.data.cancelledPassengers[0] === 1, 'cancelledPassenger is 1');
    assert(typeof cancel1Res.data.data.cancellationCharge === 'number' && cancel1Res.data.data.cancellationCharge > 0, 'cancellationCharge is positive number');
    assert(typeof cancel1Res.data.data.refundAmount === 'number' && cancel1Res.data.data.refundAmount > 0, 'refundAmount is positive number');
    assert(typeof cancel1Res.data.data.hoursBeforeOriginDeparture === 'number', 'hoursBeforeOriginDeparture is returned as number');
    assert(typeof cancel1Res.data.data.deductionPercentage === 'number', 'deductionPercentage is returned as number');
    assert(Array.isArray(cancel1Res.data.data.cancelIds) && cancel1Res.data.data.cancelIds.length === 1, 'cancelIds array returned with 1 ID');
    assert(Array.isArray(cancel1Res.data.data.refundIds) && cancel1Res.data.data.refundIds.length === 1, 'refundIds array returned with 1 ID');
    assert(typeof cancel1Res.data.data.promotionTriggered === 'boolean', 'promotionTriggered is boolean');
    assert(cancel1Res.data.data.gatewayRefund === 'SKIPPED', 'Test 3 gatewayRefund is SKIPPED');

    // Database verification: passenger 1 is CANCELLED, passenger 2 is CONFIRMED, booking remains CONFIRMED
    const [dbRes3] = await pool.query('SELECT passenger_no, status, seat_id FROM RESERVATION WHERE pnr = ? ORDER BY passenger_no', [b3.pnr]);
    assert(dbRes3[0].status === 'CANCELLED' && dbRes3[0].seat_id === null, 'Passenger 1 status updated to CANCELLED and seat_id cleared');
    assert(dbRes3[1].status === 'CONFIRMED' && dbRes3[1].seat_id !== null, 'Passenger 2 remains CONFIRMED with assigned seat');

    const [dbBook3] = await pool.query('SELECT status FROM BOOKING WHERE pnr = ?', [b3.pnr]);
    assert(dbBook3[0].status === 'CONFIRMED', 'Partially cancelled booking status remains CONFIRMED');

    // -------------------------------------------------------------------------
    // TEST 4: CANCEL SEVERAL PASSENGERS
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 4: Cancel Several Passengers (Selective Multi) ---');
    const b4 = await createAndPayBooking([
      { name: 'Charlie', age: 22, gender: 'MALE', idProofType: 'AADHAAR', idProofReference: 'XXXX-XXXX-4441' },
      { name: 'David', age: 24, gender: 'MALE', idProofType: 'AADHAAR', idProofReference: 'XXXX-XXXX-4442' },
      { name: 'Eve', age: 26, gender: 'FEMALE', idProofType: 'AADHAAR', idProofReference: 'XXXX-XXXX-4443' }
    ], token1);

    const cancel2Res = await request('POST', `/api/bookings/${b4.pnr}/cancel`, { passengerNos: [1, 2] }, token1);
    assert(cancel2Res.status === 200, 'Multi-passenger cancel returns HTTP 200 OK');
    assert(cancel2Res.data.data.cancelledPassengers.length === 2, 'cancelledPassengers length is 2');
    assert(cancel2Res.data.data.cancelIds.length === 2, 'cancelIds length is 2');
    assert(cancel2Res.data.data.refundIds.length === 2, 'refundIds length is 2');
    assert(cancel2Res.data.data.gatewayRefund === 'SKIPPED', 'Test 4 gatewayRefund is SKIPPED');

    // Database verification: passengers 1 & 2 CANCELLED, passenger 3 CONFIRMED
    const [dbRes4] = await pool.query('SELECT passenger_no, status FROM RESERVATION WHERE pnr = ? ORDER BY passenger_no', [b4.pnr]);
    assert(dbRes4[0].status === 'CANCELLED' && dbRes4[1].status === 'CANCELLED', 'Passengers 1 and 2 are CANCELLED');
    assert(dbRes4[2].status === 'CONFIRMED', 'Passenger 3 remains CONFIRMED');

    // -------------------------------------------------------------------------
    // TEST 5: CANCEL WHOLE PNR (Empty or Omitted passengerNos)
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 5: Cancel Entire PNR ---');
    const b5 = await createAndPayBooking([
      { name: 'Frank', age: 40, gender: 'MALE', idProofType: 'AADHAAR', idProofReference: 'XXXX-XXXX-5551' },
      { name: 'Grace', age: 38, gender: 'FEMALE', idProofType: 'AADHAAR', idProofReference: 'XXXX-XXXX-5552' }
    ], token1);

    const cancelWholeRes = await request('POST', `/api/bookings/${b5.pnr}/cancel`, {}, token1);
    assert(cancelWholeRes.status === 200, 'Whole PNR cancel returns HTTP 200 OK');
    assert(cancelWholeRes.data.data.cancelledPassengers.length === 2, 'Both passengers cancelled');
    assert(cancelWholeRes.data.data.cancelIds.length === 2, 'Two cancellation IDs generated');
    assert(cancelWholeRes.data.data.gatewayRefund === 'SKIPPED', 'Test 5 gatewayRefund is SKIPPED');

    // Database verification: BOOKING.status is now CANCELLED
    const [dbBook5] = await pool.query('SELECT status FROM BOOKING WHERE pnr = ?', [b5.pnr]);
    assert(dbBook5[0].status === 'CANCELLED', 'Whole PNR cancellation transitions BOOKING.status to CANCELLED');

    // -------------------------------------------------------------------------
    // TEST 6: ALREADY CANCELLED REJECTION
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 6: Already Cancelled Rejection ---');
    // Attempt to cancel whole PNR B5 again
    const repeatWholeRes = await request('POST', `/api/bookings/${b5.pnr}/cancel`, {}, token1);
    assert(repeatWholeRes.status === 400, 'Cancelling already cancelled booking rejected with HTTP 400 Bad Request');
    assert(repeatWholeRes.data.error.code === 'BAD_REQUEST', 'Error code is BAD_REQUEST');

    // Attempt to cancel already cancelled passenger 1 on B3 again
    const repeatPassRes = await request('POST', `/api/bookings/${b3.pnr}/cancel`, { passengerNos: [1] }, token1);
    assert(repeatPassRes.status === 400, 'Cancelling already cancelled passenger rejected with HTTP 400 Bad Request');
    assert(repeatPassRes.data.error.code === 'BAD_REQUEST', 'Error code is BAD_REQUEST');

    // -------------------------------------------------------------------------
    // TEST 7: CHART CLOSED REJECTION (< 8 Hours to Departure)
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 7: Chart Closed Rejection (< 8h Before Origin Departure) ---');
    const b7 = await createAndPayBooking([
      { name: 'Helen', age: 50, gender: 'FEMALE', idProofType: 'AADHAAR', idProofReference: 'XXXX-XXXX-7771' }
    ], token1);

    // Temporarily point booking to schedule 1164 (departs today at 17:00, < 7h away)
    console.log('  [TEST ONLY: Pointing booking to schedule 1164 (departs today in < 7h) to simulate chart closed]');
    await pool.query('UPDATE BOOKING SET schedule_id = 1164 WHERE pnr = ?', [b7.pnr]);

    const chartClosedRes = await request('POST', `/api/bookings/${b7.pnr}/cancel`, {}, token1);
    assert(chartClosedRes.status === 400, 'Cancellation within 8h rejected with HTTP 400');
    assert(chartClosedRes.data.error.code === 'CHART_PREPARED', 'Error code is CHART_PREPARED');

    // -------------------------------------------------------------------------
    // TEST 8: COUNTER BOOKING CANCELLATION (Cash Payment, Gateway SKIPPED)
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 8: Station Counter Booking Cancellation (STAFF Role) ---');
    const counterPayload = {
      trainId: 129,
      journeyDate: testJourneyDate,
      boardingStationId: 21,
      destinationStationId: 10,
      classType: '3A',
      quota: 'GENERAL',
      isWalkin: true,
      registeredUserId: null,
      passengers: [
        { name: 'Counter Passenger', age: 55, gender: 'MALE', idProofType: 'AADHAAR', idProofReference: 'XXXX-XXXX-8881', berthPreference: 'LOWER' }
      ],
      payment: { method: 'CASH', amountCollected: 2021.51 }
    };

    const counterRes = await request('POST', '/api/counter/bookings', counterPayload, staffToken);
    const counterPnr = counterRes.data.data.pnr;
    console.log(`  [INFO] Created Counter Booking: ${counterPnr}`);

    // Staff cancels the counter booking
    const cancelCounterRes = await request('POST', `/api/bookings/${counterPnr}/cancel`, {}, staffToken);
    assert(cancelCounterRes.status === 200, 'Staff counter cancellation returns HTTP 200 OK');
    assert(cancelCounterRes.data.data.gatewayRefund === 'SKIPPED', 'CASH payment gatewayRefund is SKIPPED');
    assert(cancelCounterRes.data.data.cancelIds.length === 1, 'Counter cancelId created');
    assert(cancelCounterRes.data.data.refundIds.length === 1, 'Counter refundId created');

    // -------------------------------------------------------------------------
    // TEST 9: SEEDED BOOKING SKIPPED (pay_test_... Gateway ID)
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 9: Seeded Booking Cancellation (pay_test_... Gateway SKIPPED) ---');

    // Dynamically pick one seeded run with confirmed pay_test_ booking and advance its journey_date
    // to a future date (> 8h away) so cancellation deadline check passes without hard-coded ID.
    const [candRuns] = await pool.query(
      `SELECT ts.schedule_id, ts.train_id
       FROM TRAIN_SCHEDULE ts
       JOIN BOOKING b ON ts.schedule_id = b.schedule_id
       JOIN PAYMENT p ON b.pnr = p.pnr
       WHERE b.status = 'CONFIRMED'
         AND p.gateway_payment_id LIKE 'pay_test_%'
         AND ts.chart_prepared_at IS NULL
         AND ts.train_id != 129
       ORDER BY ts.schedule_id ASC
       LIMIT 10`
    );

    let shiftedSchedId = null;
    for (const cand of candRuns) {
      for (let offset = 5; offset <= 14; offset++) {
        const [existing] = await pool.query(
          'SELECT schedule_id FROM TRAIN_SCHEDULE WHERE train_id = ? AND journey_date = DATE_ADD(CURDATE(), INTERVAL ? DAY)',
          [cand.train_id, offset]
        );
        if (existing.length === 0) {
          await pool.query(
            'UPDATE TRAIN_SCHEDULE SET journey_date = DATE_ADD(CURDATE(), INTERVAL ? DAY) WHERE schedule_id = ?',
            [offset, cand.schedule_id]
          );
          shiftedSchedId = cand.schedule_id;
          break;
        }
      }
      if (shiftedSchedId) break;
    }

    // Find an active confirmed seeded booking (> 8h away)
    const [seededRows] = await pool.query(
      `SELECT b.pnr, p.gateway_payment_id
       FROM BOOKING b
       JOIN PAYMENT p ON b.pnr = p.pnr
       JOIN TRAIN_SCHEDULE ts ON b.schedule_id = ts.schedule_id
       WHERE b.status = 'CONFIRMED'
         AND p.gateway_payment_id LIKE 'pay_test_%'
         AND TIMESTAMP(ts.journey_date, ts.departure_time) > NOW() + INTERVAL 8 HOUR
       LIMIT 1`
    );
    assert(seededRows.length === 1, 'Seeded confirmed booking identified');
    const seededPnr = seededRows[0].pnr;
    console.log(`  [INFO] Cancelling seeded PNR: ${seededPnr} with payment ID: ${seededRows[0].gateway_payment_id}`);

    // Staff cancels seeded booking
    const seededCancelRes = await request('POST', `/api/bookings/${seededPnr}/cancel`, {}, staffToken);
    assert(seededCancelRes.status === 200, 'Staff cancel on seeded booking returns HTTP 200 OK');
    assert(seededCancelRes.data.data.gatewayRefund === 'SKIPPED', 'Seeded fake ID gatewayRefund is SKIPPED');
    assert(seededCancelRes.data.data.cancelIds.length >= 1, 'Cancel IDs generated in MySQL');
    assert(seededCancelRes.data.data.refundIds.length >= 1, 'Refund IDs generated in MySQL');

    // -------------------------------------------------------------------------
    // TEST 10: REFUND ESTIMATE PREVIEW (GET /api/bookings/:pnr/refund-estimate)
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 10: Read-Only Refund Estimate Preview (fn_calculate_cancellation_refund) ---');
    const bEst = await createAndPayBooking([
      { name: 'Estimate User 1', age: 34, gender: 'MALE', idProofType: 'AADHAAR', idProofReference: 'XXXX-XXXX-8811' },
      { name: 'Estimate User 2', age: 36, gender: 'FEMALE', idProofType: 'AADHAAR', idProofReference: 'XXXX-XXXX-8812' }
    ], token1);

    // Snapshot database row counts before calling estimate
    const [cBefore] = await pool.query('SELECT COUNT(*) as cnt FROM CANCELLATION');
    const [rBefore] = await pool.query('SELECT COUNT(*) as cnt FROM REFUND');
    const [bBefore] = await pool.query('SELECT COUNT(*) as cnt FROM BOOKING');
    const [resBefore] = await pool.query('SELECT COUNT(*) as cnt FROM RESERVATION');

    // 1. Estimate single passenger via ?passengerNos=1
    const est1Res = await request('GET', `/api/bookings/${bEst.pnr}/refund-estimate?passengerNos=1`, null, token1);
    assert(est1Res.status === 200, 'Single passenger refund estimate returns HTTP 200 OK');
    assert(est1Res.data.success === true, 'Refund estimate success is true');
    assert(est1Res.data.data.pnr === bEst.pnr, 'Estimate returns correct PNR');
    assert(typeof est1Res.data.data.hoursBeforeOriginDeparture === 'number', 'Estimate returns hoursBeforeOriginDeparture');
    assert(Array.isArray(est1Res.data.data.passengers) && est1Res.data.data.passengers.length === 1, 'Estimate returns exactly 1 passenger');
    assert(est1Res.data.data.passengers[0].passengerNo === 1, 'Passenger 1 estimated');
    assert(typeof est1Res.data.data.passengers[0].charge === 'number' && est1Res.data.data.passengers[0].charge > 0, 'Passenger charge is positive number');
    assert(typeof est1Res.data.data.passengers[0].refundAmount === 'number' && est1Res.data.data.passengers[0].refundAmount > 0, 'Passenger refundAmount is positive number');
    assert(est1Res.data.data.totalCancellationCharge === est1Res.data.data.passengers[0].charge, 'Total charge matches passenger charge');
    assert(est1Res.data.data.totalRefundAmount === est1Res.data.data.passengers[0].refundAmount, 'Total refund matches passenger refund');

    // 2. Estimate all passengers (omitted passengerNos)
    const estAllRes = await request('GET', `/api/bookings/${bEst.pnr}/refund-estimate`, null, token1);
    assert(estAllRes.status === 200, 'Whole booking refund estimate returns HTTP 200 OK');
    assert(estAllRes.data.data.passengers.length === 2, 'All 2 passengers estimated');
    assert(estAllRes.data.data.totalCancellationCharge > est1Res.data.data.totalCancellationCharge, 'Total charge scales with passenger count');
    assert(estAllRes.data.data.totalRefundAmount > est1Res.data.data.totalRefundAmount, 'Total refund scales with passenger count');

    // 3. Unauthorized access check (Passenger 2 tries to preview Passenger 1's booking)
    const estForbidden = await request('GET', `/api/bookings/${bEst.pnr}/refund-estimate`, null, token2);
    assert(estForbidden.status === 403, 'Unauthorized access to refund estimate rejected with HTTP 403 Forbidden');
    assert(estForbidden.data.error.code === 'FORBIDDEN', 'Error code is FORBIDDEN');

    // 4. Verify ZERO database writes occurred during estimate calls
    const [cAfter] = await pool.query('SELECT COUNT(*) as cnt FROM CANCELLATION');
    const [rAfter] = await pool.query('SELECT COUNT(*) as cnt FROM REFUND');
    const [bAfter] = await pool.query('SELECT COUNT(*) as cnt FROM BOOKING');
    const [resAfter] = await pool.query('SELECT COUNT(*) as cnt FROM RESERVATION');
    assert(cBefore[0].cnt === cAfter[0].cnt, 'Refund estimate wrote 0 rows to CANCELLATION');
    assert(rBefore[0].cnt === rAfter[0].cnt, 'Refund estimate wrote 0 rows to REFUND');
    assert(bBefore[0].cnt === bAfter[0].cnt, 'Refund estimate wrote 0 rows to BOOKING');
    assert(resBefore[0].cnt === resAfter[0].cnt, 'Refund estimate wrote 0 rows to RESERVATION');

    // -------------------------------------------------------------------------
    // TEST 11: SIMULATED RAZORPAY STUB IDEMPOTENCY TEST
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 11: SIMULATED Razorpay Stub Multi-Passenger Partial Cancel & Idempotency ---');
    const { setRazorpayClientOverride, toPaise, processGatewayRefund } = require('../src/services/gatewayRefundService');

    const stubRefundCalls = [];
    const mockRazorpayClient = {
      payments: {
        refund: async (paymentId, options) => {
          stubRefundCalls.push({ paymentId, options });
          return {
            id: `rfnd_sim_${Date.now()}_${stubRefundCalls.length}`,
            entity: 'refund',
            amount: options.amount,
            currency: 'INR',
            payment_id: paymentId,
            status: 'processed'
          };
        }
      }
    };

    setRazorpayClientOverride(mockRazorpayClient);

    try {
      // Real Razorpay shape payment ID (pay_ + 14 alphanumeric chars) to trigger mock client in Test 11
      const stubPaymentId = 'pay_' + crypto.randomBytes(7).toString('hex');
      const bStub = await createAndPayBooking([
        { name: 'Stub User 1', age: 29, gender: 'MALE', idProofType: 'AADHAAR', idProofReference: 'XXXX-XXXX-9901' },
        { name: 'Stub User 2', age: 31, gender: 'FEMALE', idProofType: 'AADHAAR', idProofReference: 'XXXX-XXXX-9902' }
      ], token1, stubPaymentId);

      // Step 1: Cancel passenger 1
      const cancelP1Res = await request('POST', `/api/bookings/${bStub.pnr}/cancel`, { passengerNos: [1] }, token1);
      assert(cancelP1Res.status === 200, 'Cancel passenger 1 returns HTTP 200 OK');
      assert(cancelP1Res.data.data.gatewayRefund === 'SUCCESS', 'Passenger 1 gatewayRefund is SUCCESS');
      assert(stubRefundCalls.length === 1, 'Exactly ONE refund call made to simulated Razorpay stub');
      assert(stubRefundCalls[0].options.amount === toPaise(cancelP1Res.data.data.refundAmount), 'First refund call has exact paise amount');
      const p1RefundId = cancelP1Res.data.data.refundIds[0];

      // Step 2: Cancel passenger 2 on the SAME payment
      const cancelP2Res = await request('POST', `/api/bookings/${bStub.pnr}/cancel`, { passengerNos: [2] }, token1);
      assert(cancelP2Res.status === 200, 'Cancel passenger 2 returns HTTP 200 OK');
      assert(cancelP2Res.data.data.gatewayRefund === 'SUCCESS', 'Passenger 2 gatewayRefund is SUCCESS');
      assert(stubRefundCalls.length === 2, 'Exactly TWO refund calls made for separate passenger cancellations on the same payment');
      assert(stubRefundCalls[1].options.amount === toPaise(cancelP2Res.data.data.refundAmount), 'Second refund call has exact paise amount for passenger 2');
      const p2RefundId = cancelP2Res.data.data.refundIds[0];

      // Step 3: Repeat the exact same refund request for passenger 2 (simulating gateway retry)
      const repeatRefundRes = await processGatewayRefund({
        pnr: bStub.pnr,
        paymentMethod: 'UPI',
        gatewayPaymentId: bStub.simPaymentId,
        amountInRupees: cancelP2Res.data.data.refundAmount,
        refundIds: [p2RefundId],
        reason: 'CANCELLATION'
      });

      assert(repeatRefundRes.status === 'SUCCESS', 'Repeated refund call returns SUCCESS status');
      assert(repeatRefundRes.isIdempotent === true, 'Repeated refund call is detected as idempotent from MongoDB');
      assert(stubRefundCalls.length === 2, 'No third call dispatched to simulated Razorpay stub (idempotent duplicate avoided)');
    } finally {
      setRazorpayClientOverride(null);
    }

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

    // -------------------------------------------------------------------------
    // RESET DATABASE VIA database/load/run-all.js PER INSTRUCTIONS
    // -------------------------------------------------------------------------
    console.log('\n================================================================');
    console.log(' RESETTING DATABASE VIA database/load/run-all.js');
    console.log('================================================================');
    try {
      const rootDir = path.resolve(__dirname, '../../');
      execSync('node database/load/run-all.js', { stdio: 'inherit', cwd: rootDir });
      console.log('\n✓ Test suite test-d3a.js finished and database restored.');
    } catch (resetErr) {
      console.error('Failed to reset database:', resetErr.message);
    }

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
