const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');
const app = require('../src/app');
const config = require('../src/config/env');
const { connectMongo, getMongoDb, closeMongo } = require('../src/config/mongodb');
const pool = require('../src/config/mysql');
const { releaseExpiredHolds } = require('../src/services/holdCleanupService');

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
    console.error('\n[FATAL ERROR]: Safety timeout of 120 seconds reached. Test suite test-d2 timed out!');
    process.exit(1);
  }, 120000);
  safetyTimeout.unref();

  console.log('================================================================');
  console.log(' RAILWAY RESERVATION SYSTEM - SUITE D2 VERIFICATION TESTS');
  console.log('================================================================');

  await startServer();

  try {
    // -------------------------------------------------------------------------
    // SETUP: Authenticate Users
    // -------------------------------------------------------------------------
    console.log('\n--- SETUP: Authenticating Test Users ---');

    // Login Passenger 1 (Rahul Sharma - 50001)
    const p1Login = await request('POST', '/api/auth/passenger/login', {
      email: 'rahul.sharma@example.com',
      password: 'Password123!'
    });
    assert(p1Login.status === 200, 'Passenger 1 (Rahul Sharma) logged in successfully');
    const token1 = p1Login.data.data.token;
    const user1Id = p1Login.data.data.userId;

    // Login Passenger 2 (Priya Patel - 50002)
    const p2Login = await request('POST', '/api/auth/passenger/login', {
      email: 'priya.patel@example.com',
      password: 'Password123!'
    });
    assert(p2Login.status === 200, 'Passenger 2 (Priya Patel) logged in successfully');
    const token2 = p2Login.data.data.token;
    const user2Id = p2Login.data.data.userId;

    // Login Staff (Vikram Singh - EMP-TC-101)
    const staffLogin = await request('POST', '/api/auth/staff/login', {
      employeeId: 'EMP-TC-101',
      password: 'StaffPassword123!'
    });
    assert(staffLogin.status === 200, 'Staff (EMP-TC-101) logged in successfully');
    const staffToken = staffLogin.data.data.token;

    // -------------------------------------------------------------------------
    // TEST 1: BOOKING (POST /api/bookings)
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 1: Booking Creation (p_hold_for_payment = 1) ---');
    const bookingPayload1 = {
      trainId: 129,
      journeyDate: '2026-10-20',
      boardingStationId: 21,    // BCT
      destinationStationId: 10, // NDLS
      classType: '3A',
      quota: 'GENERAL',
      passengers: [
        {
          name: 'Sunita Sharma',
          age: 48,
          gender: 'FEMALE',
          idProofType: 'AADHAAR',
          idProofReference: 'XXXX-XXXX-3829',
          berthPreference: 'LOWER'
        }
      ],
      preferences: {
        autoUpgrade: true,
        berthCondition: false
      }
    };

    const bookRes1 = await request('POST', '/api/bookings', bookingPayload1, token1);
    assert(bookRes1.status === 201, 'POST /api/bookings returns HTTP 201 Created');
    assert(bookRes1.data.success === true, 'Booking response success is true');
    assert(typeof bookRes1.data.data.pnr === 'string' && bookRes1.data.data.pnr.length === 10, 'PNR is a valid 10-digit string');
    assert(bookRes1.data.data.bookingStatus === 'PAYMENT_PENDING', 'Booking status is PAYMENT_PENDING in database');
    assert(bookRes1.data.data.projectedStatus === 'CONFIRMED', 'Projected status is CONFIRMED');
    assert(typeof bookRes1.data.data.totalFare === 'number' && bookRes1.data.data.totalFare > 0, 'Total fare is positive number');
    assert(typeof bookRes1.data.data.expiresAt === 'string', 'Hold expiresAt timestamp returned');
    assert(typeof bookRes1.data.data.secondsRemaining === 'number', 'Hold secondsRemaining returned in booking response');
    assert(bookRes1.data.data.secondsRemaining >= 590 && bookRes1.data.data.secondsRemaining <= 600, 'Hold secondsRemaining between 590 and 600');
    assert(Array.isArray(bookRes1.data.data.fareBreakdown) && bookRes1.data.data.fareBreakdown.length === 1, 'Fare breakdown array present');

    const pnr1 = bookRes1.data.data.pnr;
    const fare1 = bookRes1.data.data.totalFare;
    console.log(`  [INFO] Created PNR: ${pnr1}, Fare: ${fare1}, Projected: ${bookRes1.data.data.projectedStatus}`);

    // Verify in database: BOOKING.status is PAYMENT_PENDING
    const [dbBooking1] = await pool.query('SELECT status, total_fare FROM BOOKING WHERE pnr = ?', [pnr1]);
    assert(dbBooking1[0].status === 'PAYMENT_PENDING', 'Database confirms BOOKING.status is PAYMENT_PENDING');

    // -------------------------------------------------------------------------
    // TEST 2: CREATE ORDER (POST /api/payments/razorpay/order)
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 2: Create Gateway Order (Real Razorpay TEST Mode) ---');
    const orderRes1 = await request('POST', '/api/payments/razorpay/order', { pnr: pnr1 }, token1);
    assert(orderRes1.status === 200, 'POST /api/payments/razorpay/order returns HTTP 200 OK');
    assert(orderRes1.data.success === true, 'Order creation success is true');
    assert(typeof orderRes1.data.data.orderId === 'string' && orderRes1.data.data.orderId.startsWith('order_'), 'Razorpay orderId returned (starts with order_)');
    assert(orderRes1.data.data.currency === 'INR', 'Currency is INR');
    assert(orderRes1.data.data.pnr === pnr1, 'Order response matches PNR');
    assert(orderRes1.data.data.keyId === config.RAZORPAY_KEY_ID, 'Returned keyId matches RAZORPAY_KEY_ID');

    // Integer math verification for paise
    const expectedPaise = Math.round(fare1 * 100);
    assert(orderRes1.data.data.amount === expectedPaise, `Amount in paise (${orderRes1.data.data.amount}) matches exact integer conversion (${expectedPaise})`);

    // Verify raw Razorpay reply saved in MongoDB raw_gateway_replies
    const db = getMongoDb();
    const orderMongoDoc = await db.collection('raw_gateway_replies').findOne({ pnr: pnr1, type: 'order_create' });
    assert(orderMongoDoc !== null, 'Order raw reply stored in MongoDB collection raw_gateway_replies');
    assert(orderMongoDoc.orderId === orderRes1.data.data.orderId, 'MongoDB stored orderId matches returned orderId');

    // Verify PAYMENT table NOT inserted yet
    const [dbPayBefore] = await pool.query('SELECT COUNT(*) AS cnt FROM PAYMENT WHERE pnr = ?', [pnr1]);
    assert(dbPayBefore[0].cnt === 0, 'No payment record inserted yet into PAYMENT table');

    const orderId1 = orderRes1.data.data.orderId;
    console.log(`  [INFO] Real Razorpay Order created: ${orderId1}, Amount: ${expectedPaise} paise`);

    // -------------------------------------------------------------------------
    // TEST 3: VALID SIGNATURE [SIMULATED] (POST /api/payments/razorpay/verify)
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 3: Verify Payment with Valid Signature [SIMULATED] ---');
    console.log('  [SIMULATED] Computing HMAC-SHA256 signature with RAZORPAY_KEY_SECRET to simulate gateway payment');
    const simPaymentId1 = `pay_sim_${Date.now()}_01`;
    const validSignature1 = crypto
      .createHmac('sha256', config.RAZORPAY_KEY_SECRET)
      .update(`${orderId1}|${simPaymentId1}`)
      .digest('hex');

    const verifyRes1 = await request('POST', '/api/payments/razorpay/verify', {
      pnr: pnr1,
      razorpayOrderId: orderId1,
      razorpayPaymentId: simPaymentId1,
      razorpaySignature: validSignature1
    }, token1);

    assert(verifyRes1.status === 200, 'POST /api/payments/razorpay/verify returns HTTP 200 OK');
    assert(verifyRes1.data.success === true, 'Verification success is true');
    assert(verifyRes1.data.data.paymentStatus === 'SUCCESS', 'Payment status is SUCCESS');
    assert(verifyRes1.data.data.bookingStatus === 'CONFIRMED', 'Booking status transitioned to CONFIRMED');
    assert(verifyRes1.data.data.gatewayPaymentId === simPaymentId1, 'Gateway payment ID matches simulated payment ID');
    assert(
      typeof verifyRes1.data.data.paidAt === 'string' &&
      /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(verifyRes1.data.data.paidAt),
      'paidAt is returned as real raw MySQL string YYYY-MM-DD HH:MM:SS'
    );
    assert(Array.isArray(verifyRes1.data.data.passengers) && verifyRes1.data.data.passengers.length === 1, 'Passengers list returned');
    assert(verifyRes1.data.data.passengers[0].status === 'CONFIRMED', 'Passenger allotment status is CONFIRMED');
    assert(verifyRes1.data.data.passengers[0].coachNumber !== null, 'Passenger has assigned coach');
    assert(verifyRes1.data.data.passengers[0].seatNumber !== null, 'Passenger has assigned seat number');

    // Verify in database: BOOKING is now CONFIRMED, PAYMENT row inserted
    const [dbBookingAfter1] = await pool.query('SELECT status FROM BOOKING WHERE pnr = ?', [pnr1]);
    assert(dbBookingAfter1[0].status === 'CONFIRMED', 'Database BOOKING status updated to CONFIRMED');

    const [dbPayAfter1] = await pool.query('SELECT payment_id, status FROM PAYMENT WHERE gateway_payment_id = ?', [simPaymentId1]);
    assert(dbPayAfter1.length === 1 && dbPayAfter1[0].status === 'SUCCESS', 'PAYMENT row successfully inserted in MySQL');

    // Verify verification logged in MongoDB
    const verifyDoc1 = await db.collection('raw_gateway_replies').findOne({ pnr: pnr1, type: 'verify_success' });
    assert(verifyDoc1 !== null, 'Verification reply stored in MongoDB collection raw_gateway_replies');

    // -------------------------------------------------------------------------
    // TEST 4: WRONG SIGNATURE REJECTED (POST /api/payments/razorpay/verify)
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 4: Wrong Signature Rejection ---');
    // Create new booking B2
    const bookRes2 = await request('POST', '/api/bookings', bookingPayload1, token1);
    const pnr2 = bookRes2.data.data.pnr;
    const orderRes2 = await request('POST', '/api/payments/razorpay/order', { pnr: pnr2 }, token1);
    const orderId2 = orderRes2.data.data.orderId;

    const fakePaymentId = `pay_sim_${Date.now()}_bad`;
    const forgedSignature = '0000000000000000000000000000000000000000000000000000000000000000';

    const verifyBadRes = await request('POST', '/api/payments/razorpay/verify', {
      pnr: pnr2,
      razorpayOrderId: orderId2,
      razorpayPaymentId: fakePaymentId,
      razorpaySignature: forgedSignature
    }, token1);

    assert(verifyBadRes.status === 400, 'Forged signature rejected with HTTP 400 Bad Request');
    assert(verifyBadRes.data.success === false, 'Bad signature returns success false');
    assert(verifyBadRes.data.error.code === 'BAD_REQUEST', 'Error code is BAD_REQUEST');

    // Booking B2 remains PAYMENT_PENDING
    const [dbBooking2] = await pool.query('SELECT status FROM BOOKING WHERE pnr = ?', [pnr2]);
    assert(dbBooking2[0].status === 'PAYMENT_PENDING', 'Booking status remained PAYMENT_PENDING after bad signature');

    // -------------------------------------------------------------------------
    // TEST 5: SOMEONE ELSE\'S PNR REJECTED (Unauthorized Access)
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 5: Someone Else\'s PNR Rejection (Forbidden) ---');
    // Passenger 2 attempts to create order on Passenger 1's PNR (pnr2)
    const stealOrderRes = await request('POST', '/api/payments/razorpay/order', { pnr: pnr2 }, token2);
    assert(stealOrderRes.status === 403, 'Unauthorized user creating order rejected with HTTP 403 Forbidden');
    assert(stealOrderRes.data.error.code === 'FORBIDDEN', 'Error code is FORBIDDEN');

    // Passenger 2 attempts to verify payment on Passenger 1's PNR
    const stealVerifyRes = await request('POST', '/api/payments/razorpay/verify', {
      pnr: pnr2,
      razorpayOrderId: orderId2,
      razorpayPaymentId: fakePaymentId,
      razorpaySignature: forgedSignature
    }, token2);
    assert(stealVerifyRes.status === 403, 'Unauthorized user verifying payment rejected with HTTP 403 Forbidden');
    assert(stealVerifyRes.data.error.code === 'FORBIDDEN', 'Error code is FORBIDDEN');

    // -------------------------------------------------------------------------
    // TEST 6: SAME PAYMENT ID TWICE (Idempotency)
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 6: Idempotent Repeated Verification with Same Payment ID ---');
    // Verify again with the exact same credentials from Test 3
    const repeatVerifyRes = await request('POST', '/api/payments/razorpay/verify', {
      pnr: pnr1,
      razorpayOrderId: orderId1,
      razorpayPaymentId: simPaymentId1,
      razorpaySignature: validSignature1
    }, token1);

    assert(repeatVerifyRes.status === 200, 'Repeated verification returns HTTP 200 OK');
    assert(repeatVerifyRes.data.success === true, 'Repeated verification success is true');
    assert(repeatVerifyRes.data.data.paymentId === verifyRes1.data.data.paymentId, 'Returned paymentId is identical to first call');
    assert(repeatVerifyRes.data.data.bookingStatus === 'CONFIRMED', 'Returned booking status is still CONFIRMED');

    // Check MySQL: PAYMENT table still has exactly 1 row for this gateway_payment_id
    const [dbRepeatPay] = await pool.query('SELECT COUNT(*) AS cnt FROM PAYMENT WHERE gateway_payment_id = ?', [simPaymentId1]);
    assert(dbRepeatPay[0].cnt === 1, 'PAYMENT table row count for this payment ID remains exactly 1 (no duplicate payment)');

    // -------------------------------------------------------------------------
    // TEST 7: LATE PAYMENT WITH REFUND [SIMULATED]
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 7: Late Payment After Hold Expiry with Auto-Refund [SIMULATED] ---');
    // Create Booking B3 and Order O3
    const bookRes3 = await request('POST', '/api/bookings', bookingPayload1, token1);
    const pnr3 = bookRes3.data.data.pnr;
    const orderRes3 = await request('POST', '/api/payments/razorpay/order', { pnr: pnr3 }, token1);
    const orderId3 = orderRes3.data.data.orderId;

    console.log('  [TEST ONLY: Setting BOOKING.created_at back by 15 minutes with direct SQL to simulate expired hold]');
    await pool.query('UPDATE BOOKING SET created_at = DATE_SUB(NOW(), INTERVAL 15 MINUTE) WHERE pnr = ?', [pnr3]);

    console.log('  [SIMULATED] Simulating late payment via verify API');
    const { setRazorpayClientOverride } = require('../src/services/gatewayRefundService');
    const mockLateRazorpayClient = {
      payments: {
        refund: async (paymentId, options) => {
          return {
            id: `rfnd_sim_${Date.now()}`,
            entity: 'refund',
            amount: options.amount,
            currency: 'INR',
            payment_id: paymentId,
            status: 'processed'
          };
        }
      }
    };
    setRazorpayClientOverride(mockLateRazorpayClient);

    const simPaymentId3 = `pay_sim_${Date.now()}_late`;
    const validSignature3 = crypto
      .createHmac('sha256', config.RAZORPAY_KEY_SECRET)
      .update(`${orderId3}|${simPaymentId3}`)
      .digest('hex');

    let lateVerifyRes;
    try {
      lateVerifyRes = await request('POST', '/api/payments/razorpay/verify', {
        pnr: pnr3,
        razorpayOrderId: orderId3,
        razorpayPaymentId: simPaymentId3,
        razorpaySignature: validSignature3
      }, token1);
    } finally {
      setRazorpayClientOverride(null);
    }

    assert(lateVerifyRes.status === 200, 'Late payment returns HTTP 200 per Contract 4.3.2');
    assert(lateVerifyRes.data.success === false, 'Late payment response success is false');
    assert(lateVerifyRes.data.error.code === 'HOLD_EXPIRED', 'Contract error code is HOLD_EXPIRED');
    assert(lateVerifyRes.data.data.bookingStatus === 'FAILED', 'Returned booking status is FAILED');
    assert(lateVerifyRes.data.data.refund !== undefined, 'Refund details present in response');
    assert(lateVerifyRes.data.data.refund.reason === 'PAYMENT_AFTER_EXPIRY', 'Refund reason is PAYMENT_AFTER_EXPIRY');
    assert(lateVerifyRes.data.data.refund.gatewayPaymentId === simPaymentId3, 'Refund references gateway payment ID');

    // Verify in database: BOOKING is FAILED, REFUND row created
    const [dbBooking3] = await pool.query('SELECT status FROM BOOKING WHERE pnr = ?', [pnr3]);
    assert(dbBooking3[0].status === 'FAILED', 'Database confirms BOOKING.status is FAILED');

    const [dbRefund3] = await pool.query(
      `SELECT r.refund_id, r.reason, r.status, r.amount
       FROM REFUND r
       JOIN PAYMENT p ON r.payment_id = p.payment_id
       WHERE p.gateway_payment_id = ?`,
      [simPaymentId3]
    );
    assert(dbRefund3.length === 1, 'REFUND row created in MySQL');
    assert(dbRefund3[0].reason === 'PAYMENT_AFTER_EXPIRY', 'MySQL REFUND.reason is PAYMENT_AFTER_EXPIRY');
    assert(dbRefund3[0].status === 'PROCESSED', 'MySQL REFUND.status is PROCESSED');

    // Check MongoDB for refund reply or recorded failure
    const refundDoc = await db.collection('raw_gateway_replies').findOne({
      paymentId: simPaymentId3,
      type: { $in: ['refund_success', 'refund_failure'] }
    });
    assert(refundDoc !== null, 'Refund reply stored in MongoDB collection raw_gateway_replies');
    if (refundDoc.type === 'refund_failure') {
      console.log('  [INFO] Captured exact Razorpay refund API reply for simulated payment:', JSON.stringify(refundDoc.reply));
    }

    // -------------------------------------------------------------------------
    // TEST 8: EXPIRED HOLD RELEASED BY TIMER PROCEDURE
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 8: Expired Hold Released by Timer Procedure (sp_release_expired_holds) ---');
    // Create Booking B4
    const bookRes4 = await request('POST', '/api/bookings', bookingPayload1, token1);
    const pnr4 = bookRes4.data.data.pnr;
    console.log(`  [INFO] Created Booking B4 (PNR: ${pnr4})`);

    console.log('  [TEST ONLY: Setting BOOKING.created_at back by 15 minutes with direct SQL]');
    await pool.query('UPDATE BOOKING SET created_at = DATE_SUB(NOW(), INTERVAL 15 MINUTE) WHERE pnr = ?', [pnr4]);

    // Invoke releaseExpiredHolds
    const releasedCount = await releaseExpiredHolds();
    assert(releasedCount >= 1, `releaseExpiredHolds() returned released count >= 1 (got: ${releasedCount})`);

    // Verify Booking B4 status in MySQL transitioned to FAILED
    const [dbBooking4] = await pool.query('SELECT status FROM BOOKING WHERE pnr = ?', [pnr4]);
    assert(dbBooking4[0].status === 'FAILED', 'Expired booking B4 status transitioned to FAILED');

    // -------------------------------------------------------------------------
    // TEST 9: COUNTER BOOKING (POST /api/counter/bookings)
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 9: Station Counter Booking (STAFF Role Only) ---');
    const counterPayload = {
      trainId: 129,
      journeyDate: '2026-10-20',
      boardingStationId: 21,    // BCT
      destinationStationId: 10, // NDLS
      classType: '3A',
      quota: 'GENERAL',
      isWalkin: true,
      registeredUserId: null,
      passengers: [
        {
          name: 'Kishore Kumar',
          age: 62,
          gender: 'MALE',
          idProofType: 'AADHAAR',
          idProofReference: 'XXXX-XXXX-4811',
          berthPreference: 'LOWER'
        }
      ],
      payment: {
        method: 'CASH',
        amountCollected: 2039.80
      }
    };

    // Attempt with passenger token (must be rejected)
    const counterFailRes = await request('POST', '/api/counter/bookings', counterPayload, token1);
    assert(counterFailRes.status === 403, 'Non-staff user booking at counter rejected with HTTP 403 Forbidden');

    // Attempt with staff token
    const counterRes = await request('POST', '/api/counter/bookings', counterPayload, staffToken);
    assert(counterRes.status === 201, 'POST /api/counter/bookings with STAFF token returns HTTP 201 Created');
    assert(counterRes.data.success === true, 'Counter booking success is true');
    assert(counterRes.data.data.channel === 'COUNTER', 'Channel is COUNTER');
    assert(counterRes.data.data.userAccount === 'COUNTER_WALKIN', 'userAccount is COUNTER_WALKIN (50008)');
    assert(typeof counterRes.data.data.bookedByStaffId === 'number', 'bookedByStaffId is present');
    assert(counterRes.data.data.bookingStatus === 'CONFIRMED', 'Booking status is CONFIRMED');
    assert(counterRes.data.data.payment.method === 'CASH', 'Payment method is CASH');
    assert(counterRes.data.data.payment.status === 'SUCCESS', 'Payment status is SUCCESS');
    assert(typeof counterRes.data.data.printableTicketText === 'string', 'Printable ticket text generated');

    const counterPnr = counterRes.data.data.pnr;
    console.log(`  [INFO] Counter PNR: ${counterPnr}, Ticket: ${counterRes.data.data.printableTicketText}`);

    // Verify in MySQL
    const [dbCounter] = await pool.query('SELECT channel, user_id, status FROM BOOKING WHERE pnr = ?', [counterPnr]);
    assert(dbCounter[0].channel === 'COUNTER', 'MySQL BOOKING.channel is COUNTER');
    assert(dbCounter[0].user_id === 50008, 'MySQL BOOKING.user_id is 50008 (COUNTER_WALKIN)');

    // -------------------------------------------------------------------------
    // TEST 10: BOOKING THAT GETS RAC OR WL
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 10: Booking that Gets RAC or WL Status ---');
    // Train 131 on 2026-10-18: Class 3A, BCT (21) -> NZM (83), Quota GENERAL
    const racPayload = {
      trainId: 131,
      journeyDate: '2026-10-18',
      boardingStationId: 21,
      destinationStationId: 83,
      classType: '3A',
      quota: 'GENERAL',
      passengers: [
        {
          name: 'RAC Test Passenger',
          age: 30,
          gender: 'MALE',
          idProofType: 'AADHAAR',
          idProofReference: 'XXXX-XXXX-1122',
          berthPreference: 'NO_BERTH'
        }
      ]
    };

    const racBookRes = await request('POST', '/api/bookings', racPayload, token1);
    assert(racBookRes.status === 201, 'RAC booking returns HTTP 201 Created');
    assert(
      racBookRes.data.data.projectedStatus === 'RAC' || racBookRes.data.data.projectedStatus === 'WAITING_LIST',
      `Booking projected status is RAC or WAITING_LIST (actual: ${racBookRes.data.data.projectedStatus})`
    );
    console.log(`  [INFO] RAC/WL Test PNR: ${racBookRes.data.data.pnr}, Projected Status: ${racBookRes.data.data.projectedStatus}`);

    // -------------------------------------------------------------------------
    // TEST 11: SEAT-HOLD SECONDS REMAINING & GET /api/bookings/:pnr/hold
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 11: Seat-Hold Countdown & GET /api/bookings/:pnr/hold ---');
    const holdBookingRes = await request('POST', '/api/bookings', bookingPayload1, token1);
    assert(holdBookingRes.status === 201, 'Hold test booking created with HTTP 201');
    assert(typeof holdBookingRes.data.data.secondsRemaining === 'number', 'secondsRemaining is returned in booking response');
    assert(
      holdBookingRes.data.data.secondsRemaining >= 590 && holdBookingRes.data.data.secondsRemaining <= 600,
      `Initial booking secondsRemaining between 590 and 600 (actual: ${holdBookingRes.data.data.secondsRemaining})`
    );
    assert(
      typeof holdBookingRes.data.data.expiresAt === 'string',
      `Booking creation returns expiresAt as string (actual: ${holdBookingRes.data.data.expiresAt})`
    );
    const holdPnr = holdBookingRes.data.data.pnr;
    console.log(`  [INFO] Created hold test PNR: ${holdPnr}, secondsRemaining: ${holdBookingRes.data.data.secondsRemaining}`);

    // Check GET /api/bookings/:pnr/hold endpoint (owner only)
    const holdEndpointRes = await request('GET', `/api/bookings/${holdPnr}/hold`, null, token1);
    assert(holdEndpointRes.status === 200, 'GET /api/bookings/:pnr/hold returns HTTP 200 OK');
    assert(holdEndpointRes.data.success === true, 'Hold endpoint success is true');
    assert(holdEndpointRes.data.data.pnr === holdPnr, 'Hold endpoint returns correct PNR');
    assert(typeof holdEndpointRes.data.data.expiresAt === 'string', 'Hold endpoint returns expiresAt as string');
    assert(
      typeof holdEndpointRes.data.data.secondsRemaining === 'number' &&
      holdEndpointRes.data.data.secondsRemaining >= 590 &&
      holdEndpointRes.data.data.secondsRemaining <= 600,
      `GET /api/bookings/:pnr/hold initial secondsRemaining between 590 and 600 (actual: ${holdEndpointRes.data.data.secondsRemaining})`
    );

    // Verify non-owner cannot view hold endpoint
    const nonOwnerHoldRes = await request('GET', `/api/bookings/${holdPnr}/hold`, null, token2);
    assert(nonOwnerHoldRes.status === 403, 'GET /api/bookings/:pnr/hold returns HTTP 403 Forbidden for non-owner');

    // Set created_at back 9 minutes with direct SQL (label it test only)
    console.log('  [TEST ONLY: Setting BOOKING.created_at back by 9 minutes with direct SQL]');
    await pool.query('UPDATE BOOKING SET created_at = DATE_SUB(NOW(), INTERVAL 9 MINUTE) WHERE pnr = ?', [holdPnr]);
    const holdRes9Min = await request('GET', `/api/bookings/${holdPnr}/hold`, null, token1);
    assert(holdRes9Min.status === 200, 'GET /api/bookings/:pnr/hold after 9 min setback returns HTTP 200');
    assert(
      typeof holdRes9Min.data.data.secondsRemaining === 'number' &&
      holdRes9Min.data.data.secondsRemaining >= 50 &&
      holdRes9Min.data.data.secondsRemaining <= 60,
      `After setting created_at back 9 minutes, secondsRemaining between 50 and 60 (actual: ${holdRes9Min.data.data.secondsRemaining})`
    );

    // Set created_at back 11 minutes with direct SQL (label it test only)
    console.log('  [TEST ONLY: Setting BOOKING.created_at back by 11 minutes with direct SQL]');
    await pool.query('UPDATE BOOKING SET created_at = DATE_SUB(NOW(), INTERVAL 11 MINUTE) WHERE pnr = ?', [holdPnr]);
    const holdRes11Min = await request('GET', `/api/bookings/${holdPnr}/hold`, null, token1);
    assert(holdRes11Min.status === 200, 'GET /api/bookings/:pnr/hold after 11 min setback returns HTTP 200');
    assert(
      holdRes11Min.data.data.secondsRemaining === 0,
      `After setting created_at back 11 minutes, secondsRemaining is 0 (actual: ${holdRes11Min.data.data.secondsRemaining})`
    );

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
    console.log('\n✓ Test suite test-d2.js finished.');
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
