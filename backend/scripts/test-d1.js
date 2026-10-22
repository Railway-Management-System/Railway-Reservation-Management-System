const http = require('http');
const app = require('../src/app');
const config = require('../src/config/env');
const { connectMongo, closeMongo } = require('../src/config/mongodb');
const pool = require('../src/config/mysql');

let server;
let baseUrl;

async function startTestServer() {
  await connectMongo();
  return new Promise((resolve) => {
    // Listen on port 0 to choose an available ephemeral port
    server = app.listen(0, () => {
      const port = server.address().port;
      baseUrl = `http://127.0.0.1:${port}`;
      console.log(`[Test Runner] Test server listening on ${baseUrl}`);
      resolve();
    });
  });
}

async function stopTestServer() {
  return new Promise((resolve) => {
    if (server) {
      server.close(async () => {
        await pool.end();
        await closeMongo();
        console.log('[Test Runner] Test server and DB connections stopped.');
        resolve();
      });
    } else {
      resolve();
    }
  });
}

async function request(path, options = {}) {
  const url = `${baseUrl}${path}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });
  const data = await response.json();
  return { status: response.status, data };
}

let passedTests = 0;
let totalTests = 0;

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
  console.log('====================================================');
  console.log('   RAILWAY RESERVATION BACKEND - D1 TEST SUITE');
  console.log('====================================================\n');

  const createdUserIds = [];

  try {
    await startTestServer();

    // -------------------------------------------------------------------------
    // TEST 1: HEALTH CHECK
    // -------------------------------------------------------------------------
    console.log('\n--- 1. Testing GET /api/health ---');
    const healthRes = await request('/api/health');
    assert(healthRes.status === 200, 'Health endpoint returns HTTP 200');
    assert(healthRes.data.success === true, 'Health response indicates success: true');
    assert(healthRes.data.data.status === 'UP', 'Overall health status is UP');
    assert(healthRes.data.data.services.mysql.status === 'UP', 'MySQL database service is UP');
    assert(healthRes.data.data.services.mongodb.status === 'UP', 'MongoDB database service is UP');

    // -------------------------------------------------------------------------
    // TEST 2: ERROR MAPPER & CANONICAL ERROR FORMAT
    // -------------------------------------------------------------------------
    console.log('\n--- 2. Testing Error Mapper & Canonical Error Codes ---');
    // 404 Not Found error
    const notFoundRes = await request('/api/non-existent-route');
    assert(notFoundRes.status === 404, 'Unknown route returns HTTP 404');
    assert(notFoundRes.data.success === false, 'Error response has success: false');
    assert(notFoundRes.data.error && notFoundRes.data.error.code === 'NOT_FOUND', 'Error contains canonical code: NOT_FOUND');

    // Validation error
    const badLoginRes = await request('/api/auth/passenger/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'invalid@example.com' })
    });
    assert(badLoginRes.status === 400, 'Missing password returns HTTP 400');
    assert(badLoginRes.data.error.code === 'VALIDATION_ERROR', 'Error contains canonical code: VALIDATION_ERROR');

    // Unauthorized credentials error
    const invalidCredsRes = await request('/api/auth/passenger/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'rahul.sharma@example.com', password: 'WrongPassword999!' })
    });
    assert(invalidCredsRes.status === 401, 'Invalid credentials returns HTTP 401');
    assert(invalidCredsRes.data.error.code === 'UNAUTHORIZED', 'Error code is UNAUTHORIZED');

    // -------------------------------------------------------------------------
    // TEST 3: AUTHENTICATION
    // -------------------------------------------------------------------------
    console.log('\n--- 3. Testing Authentication (Register, Login, GET /me) ---');

    // 3a. Register a brand new passenger (bcrypt hash test)
    const uniqueNum = Math.floor(10000000 + Math.random() * 90000000);
    const newPassenger = {
      name: 'Pooja Verma',
      email: `pooja.verma.${uniqueNum}@testmail.com`,
      phone: `+91-98${uniqueNum}`,
      password: 'StrongPassword123!'
    };

    const registerRes = await request('/api/auth/passenger/register', {
      method: 'POST',
      body: JSON.stringify(newPassenger)
    });
    if (registerRes.data && registerRes.data.data && registerRes.data.data.userId) {
      createdUserIds.push(registerRes.data.data.userId);
    }
    assert(registerRes.status === 201, 'Passenger registration returns HTTP 201 Created');
    assert(registerRes.data.success === true, 'Registration success is true');
    assert(registerRes.data.data.userId > 0, 'New userId assigned correctly');
    assert(registerRes.data.data.role === 'PASSENGER', 'Role assigned as PASSENGER');
    assert(registerRes.data.data.accountStatus === 'ACTIVE', 'Account status is ACTIVE');
    assert(registerRes.data.data.aadhaarVerified === false, 'aadhaarVerified defaults to false');
    assert(typeof registerRes.data.data.token === 'string', 'JWT token issued');

    // 3b. Duplicate registration rejected with 409 Conflict
    const dupRes = await request('/api/auth/passenger/register', {
      method: 'POST',
      body: JSON.stringify(newPassenger)
    });
    assert(dupRes.status === 409, 'Duplicate registration returns HTTP 409 Conflict');
    assert(dupRes.data.error.code === 'CONFLICT', 'Error code is CONFLICT');

    // 3c. Login with newly registered user (Bcrypt verification)
    const newLoginRes = await request('/api/auth/passenger/login', {
      method: 'POST',
      body: JSON.stringify({
        email: newPassenger.email,
        password: newPassenger.password
      })
    });
    assert(newLoginRes.status === 200, 'Newly registered user login succeeds with HTTP 200');
    assert(newLoginRes.data.data.userId === registerRes.data.data.userId, 'User ID matches registered ID');
    assert(typeof newLoginRes.data.data.token === 'string', 'JWT token generated for new user');

    // 3d. Login with seeded user rahul.sharma@example.com (Seed Scrypt verification)
    const seedLoginRes = await request('/api/auth/passenger/login', {
      method: 'POST',
      body: JSON.stringify({
        email: 'rahul.sharma@example.com',
        password: 'Password123!'
      })
    });
    assert(seedLoginRes.status === 200, 'Seed user (Rahul Sharma) login succeeds with HTTP 200');
    assert(seedLoginRes.data.data.userId === 50001, 'User ID is 50001');
    assert(seedLoginRes.data.data.name === 'Rahul Sharma', 'Name matches Rahul Sharma');
    assert(seedLoginRes.data.data.aadhaarVerified === true, 'Rahul Sharma is Aadhaar verified');
    assert(seedLoginRes.data.data.monthlyBookingsAllowed === 24, 'Monthly bookings allowed is 24 for Aadhaar verified user');
    const seedToken = seedLoginRes.data.data.token;

    // 3e. Staff Login (EMP-TC-101 / StaffPassword123!)
    const staffLoginRes = await request('/api/auth/staff/login', {
      method: 'POST',
      body: JSON.stringify({
        employeeId: 'EMP-TC-101',
        password: 'StaffPassword123!'
      })
    });
    assert(staffLoginRes.status === 200, 'Staff login succeeds with HTTP 200');
    assert(staffLoginRes.data.data.role === 'STAFF', 'Role is STAFF');
    assert(staffLoginRes.data.data.designation === 'Ticket Collector (TC)', 'Designation is Ticket Collector');

    // 3f. Admin Login (admin@railways.gov.in / AdminPassword123!)
    const adminLoginRes = await request('/api/auth/admin/login', {
      method: 'POST',
      body: JSON.stringify({
        email: 'admin@railways.gov.in',
        password: 'AdminPassword123!'
      })
    });
    assert(adminLoginRes.status === 200, 'Admin login succeeds with HTTP 200');
    assert(adminLoginRes.data.data.role === 'ADMIN', 'Role is ADMIN');
    assert(adminLoginRes.data.data.accessLevel === 'SUPER_ADMIN', 'Access level is SUPER_ADMIN');

    // 3g. GET /me (and GET /api/auth/me) with token
    const meRes = await request('/me', {
      method: 'GET',
      headers: { Authorization: `Bearer ${seedToken}` }
    });
    assert(meRes.status === 200, 'GET /me returns HTTP 200');
    assert(meRes.data.data.userId === 50001, 'GET /me returns user_id 50001');
    assert(meRes.data.data.email === 'rahul.sharma@example.com', 'GET /me returns email');
    assert(meRes.data.data.phone === '+91-9876543210', 'GET /me returns phone');
    assert(meRes.data.data.role === 'PASSENGER', 'GET /me returns role');
    assert(meRes.data.data.accountStatus === 'ACTIVE', 'GET /me returns account_status ACTIVE');
    assert(meRes.data.data.aadhaarVerified === true, 'GET /me returns aadhaar_verified');

    // -------------------------------------------------------------------------
    // TEST 4: TRAIN SEARCH & AVAILABILITY
    // -------------------------------------------------------------------------
    console.log('\n--- 4. Testing Train Search & Availability ---');

    // 4a. Search trains from BCT (Mumbai Central, stationId 21) to NDLS (New Delhi, stationId 10) on 2026-10-20
    const searchRes = await request('/api/trains/search?sourceStationId=21&destinationStationId=10&journeyDate=2026-10-20');
    assert(searchRes.status === 200, 'Train search returns HTTP 200');
    assert(Array.isArray(searchRes.data.data), 'Search results is an array');
    assert(searchRes.data.data.length > 0, `Search found ${searchRes.data.data.length} connecting train(s)`);

    const trainResult = searchRes.data.data.find(t => t.trainNumber === '12951');
    assert(Boolean(trainResult), 'Train 12951 (Mumbai Rajdhani) is in the search results');
    assert(trainResult.boardingStation.stationCode === 'BCT', 'Boarding station code is BCT');
    assert(trainResult.destinationStation.stationCode === 'NDLS', 'Destination station code is NDLS');
    assert(trainResult.originDate === '2026-10-20', 'Origin date matches boarding date for origin stop');
    assert(Array.isArray(trainResult.availableClasses), 'availableClasses is an array');
    assert(trainResult.availableClasses.length > 0, 'Classes are available with seat and fare info');

    const class3A = trainResult.availableClasses.find(c => c.classType === '3A');
    assert(Boolean(class3A), 'Class 3A is present with seat inventory and calculated fare');
    assert(typeof class3A.availableSeats === 'number', '3A availableSeats is a number');
    assert(class3A.baseFare > 0, `3A baseFare calculated: Rs ${class3A.baseFare}`);
    assert(class3A.estimatedTotalFare > 0, `3A estimatedTotalFare: Rs ${class3A.estimatedTotalFare}`);

    // 4b. Running day check (BR-B1a):
    // Search Mumbai (BCT, 21) to Delhi (NDLS, 10) on a date it DOES run vs DOES NOT run
    console.log('  Testing running-day checks per BR-B1a...');
    
    // Date it DOES run: 2026-10-20 (Tuesday)
    const runDate = '2026-10-20';
    const bctNdlsRunningRes = await request(`/api/trains/search?sourceStationId=21&destinationStationId=10&journeyDate=${runDate}`);
    assert(bctNdlsRunningRes.status === 200, `Train search for BCT->NDLS on running date ${runDate} returns HTTP 200`);
    const foundOnRunDate = bctNdlsRunningRes.data.data.some(t => t.trainNumber === '12951');
    assert(foundOnRunDate === true, `Train 12951 is found in search results on running date ${runDate}`);

    // Date it does NOT run: 2026-10-25 (Outside active schedule window)
    const nonRunDate = '2026-10-25';
    const bctNdlsNonRunningRes = await request(`/api/trains/search?sourceStationId=21&destinationStationId=10&journeyDate=${nonRunDate}`);
    assert(bctNdlsNonRunningRes.status === 200, `Train search for BCT->NDLS on non-running date ${nonRunDate} returns HTTP 200`);
    const foundOnNonRunDate = bctNdlsNonRunningRes.data.data.some(t => t.trainNumber === '12951');
    assert(foundOnNonRunDate === false, `Train 12951 is omitted from search results on non-running date ${nonRunDate}`);

    // Complementary test on NDLS (10) -> BCT (21) for Train 130 (12952)
    // Train 130 running_days in TRAIN table: ['TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'] (omits MON)
    const monDate = '2026-10-19'; // Monday
    const ndlsBctMonRes = await request(`/api/trains/search?sourceStationId=10&destinationStationId=21&journeyDate=${monDate}`);
    const found130Mon = ndlsBctMonRes.data.data.some(t => t.trainNumber === '12952');
    assert(found130Mon === false, `Train 130 (12952) is omitted on Monday ${monDate} because MON is not in running_days`);

    const tueDate = '2026-10-20'; // Tuesday
    const ndlsBctTueRes = await request(`/api/trains/search?sourceStationId=10&destinationStationId=21&journeyDate=${tueDate}`);
    const found130Tue = ndlsBctTueRes.data.data.some(t => t.trainNumber === '12952');
    assert(found130Tue === true, `Train 130 (12952) is returned on Tuesday ${tueDate} because TUE is in running_days`);

    // 4c. Route & Timetable: GET /api/trains/:trainId
    const routeRes = await request(`/api/trains/${trainResult.trainId}`);
    assert(routeRes.status === 200, 'GET /api/trains/:trainId returns HTTP 200');
    assert(routeRes.data.data.trainNumber === '12951', 'Train number is 12951');
    assert(Array.isArray(routeRes.data.data.route), 'Route timetable is an array');
    assert(routeRes.data.data.route.length >= 4, `Train has ${routeRes.data.data.route.length} stops`);
    const firstStop = routeRes.data.data.route[0];
    assert(firstStop.stationCode === 'BCT', 'First stop is BCT');
    assert(firstStop.stopSequence === 1, 'First stop sequence is 1');
    assert(firstStop.dayOffset === 0, 'First stop dayOffset is 0');

    // 4d. Direct Quota Availability: GET /api/trains/:trainId/availability
    const availRes = await request(`/api/trains/${trainResult.trainId}/availability?journeyDate=2026-10-20&classType=3A&quota=GENERAL`);
    assert(availRes.status === 200, 'Direct availability check returns HTTP 200');
    assert(availRes.data.data.trainId === trainResult.trainId, 'Train ID matches');
    assert(availRes.data.data.journeyDate === '2026-10-20', 'Journey date matches');
    assert(availRes.data.data.classType === '3A', 'Class type is 3A');
    assert(availRes.data.data.quota === 'GENERAL', 'Quota is GENERAL');
    assert(typeof availRes.data.data.availableSeats === 'number', 'availableSeats is returned');
    assert(availRes.data.data.fallbackOffered === false, 'Direct availability fallbackOffered is false');

    // 4e. Fallback Advisory per BR-Q13: LADIES quota request exceeding capacity
    const fallbackRes = await request(`/api/trains/${trainResult.trainId}/availability?journeyDate=2026-10-20&classType=3A&quota=LADIES&passengerCount=999`);
    assert(fallbackRes.status === 200, 'Fallback query returns HTTP 200');
    assert(fallbackRes.data.data.fallbackOffered === true, 'fallbackOffered is true per BR-Q13');
    assert(fallbackRes.data.data.requestedQuota === 'LADIES', 'requestedQuota is LADIES');
    assert(typeof fallbackRes.data.data.fallbackNotice === 'string', 'fallbackNotice contains required notice text');
    assert(fallbackRes.data.data.fallbackNotice.includes('No seats are left in the LADIES quota'), 'fallbackNotice text matches BR-Q13 canonical text');
    assert(Boolean(fallbackRes.data.data.generalQuotaStatus), 'generalQuotaStatus contains projected status in GENERAL quota');

    console.log('\n====================================================');
    console.log(`   ALL TESTS PASSED: ${passedTests}/${totalTests}`);
    console.log('====================================================\n');
  } catch (error) {
    console.error('\n[Test Runner] TEST SUITE FAILED:', error.message);
    process.exitCode = 1;
  } finally {
    if (createdUserIds.length > 0) {
      console.log(`\n[Test Cleanup] Deleting ${createdUserIds.length} test user(s)...`);
      for (const uid of createdUserIds) {
        try {
          await pool.query('DELETE FROM USER_ACCOUNT WHERE user_id = ?', [uid]);
        } catch (delErr) {
          console.error(`Failed to delete user ${uid}:`, delErr.message);
        }
      }
      console.log('[Test Cleanup] Deletion of test users complete.');
    }
    const [cntRow] = await pool.query('SELECT COUNT(*) as count FROM USER_ACCOUNT');
    console.log(`[Test Cleanup] Verified USER_ACCOUNT count: ${cntRow[0].count}`);
    await stopTestServer();
  }
}

if (require.main === module) {
  runTests();
}

module.exports = { runTests };
