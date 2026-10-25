/**
 * Central API Service Layer - Railway Reservation System (Passenger Portal)
 * Real REST API client implementing docs/API_CONTRACT.md for E1 features.
 * E2 features are re-exported unchanged from mockService.js until E2 implementation.
 */

// ─── HTTP Client Helper ───────────────────────────────────────────────────────

async function request(method, path, body = null, needsAuth = false) {
  const baseUrl = (window.RAILCONNECT_CONFIG && window.RAILCONNECT_CONFIG.API_BASE_URL) || 'http://localhost:5000';
  const url = `${baseUrl}${path}`;

  let token = null;
  try {
    const stored = sessionStorage.getItem('railconnect_user');
    if (stored) {
      token = JSON.parse(stored)?.token || null;
    }
  } catch (_) {
    token = null;
  }

  const headers = {};
  if (body !== null && (method === 'POST' || method === 'PUT')) {
    headers['Content-Type'] = 'application/json';
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const options = {
    method,
    headers
  };

  if (body !== null && (method === 'POST' || method === 'PUT')) {
    options.body = JSON.stringify(body);
  }

  let response;
  try {
    response = await fetch(url, options);
  } catch (netErr) {
    const error = new Error('Cannot reach the server. Please check that the backend is running.');
    error.code = 'NETWORK_ERROR';
    error.status = 0;
    throw error;
  }

  let payload;
  try {
    payload = await response.json();
  } catch (_) {
    payload = null;
  }

  if (response.status === 401 && token) {
    sessionStorage.removeItem('railconnect_user');
    const err = new Error(payload?.error?.message || 'Unauthorized');
    err.code = payload?.error?.code || 'UNAUTHORIZED';
    err.status = 401;
    throw err;
  }

  if (!response.ok || !payload?.success) {
    const msg = payload?.error?.message || `Request failed with status ${response.status}`;
    const err = new Error(msg);
    err.code = payload?.error?.code || 'REQUEST_FAILED';
    err.status = response.status;
    throw err;
  }

  return payload.data;
}

// ─── Real E1 Service Implementations ──────────────────────────────────────────

/**
 * 1. Station list: GET /api/stations
 * Keys: stationId, stationCode, stationName, city, state
 */
export async function getStations() {
  return request('GET', '/api/stations');
}

/**
 * 2. Public trains list: GET /api/trains
 * Adds trainName = displayName to every item (keeps other keys)
 */
export async function getAllTrains() {
  const trains = await request('GET', '/api/trains');
  return trains.map(t => ({
    ...t,
    trainName: t.displayName
  }));
}

/**
 * 3. Train schedule: GET /api/trains/:trainId
 * Maps response to { trainId, trainNumber, trainName (= displayName), trainType, runningDays, route: [ { station: { stationName, stationCode }, arrivalTime, departureTime, platformNumber (= platformNo), distanceFromOrigin (= distanceFromOriginKm), dayOffset } ] }
 */
export async function getTrainSchedule(trainId) {
  const data = await request('GET', `/api/trains/${encodeURIComponent(trainId)}`);
  if (!data) return null;

  return {
    trainId: data.trainId,
    trainNumber: data.trainNumber,
    trainName: data.displayName,
    trainType: data.trainType,
    runningDays: data.runningDays,
    route: (data.route || []).map(stop => ({
      station: {
        stationName: stop.stationName,
        stationCode: stop.stationCode
      },
      arrivalTime: stop.arrivalTime,
      departureTime: stop.departureTime,
      platformNumber: stop.platformNo,
      distanceFromOrigin: stop.distanceFromOriginKm,
      dayOffset: stop.dayOffset
    }))
  };
}

/**
 * 4. Train Search: GET /api/trains/search
 * Omits classType when empty.
 * Returns empty array if no trains (or error NOT_FOUND or TRAIN_NOT_RUNNING).
 */
export async function searchTrains({ sourceStationId, destinationStationId, journeyDate, classType, quota = 'GENERAL' }) {
  const params = new URLSearchParams();
  params.set('sourceStationId', String(sourceStationId));
  params.set('destinationStationId', String(destinationStationId));
  params.set('journeyDate', journeyDate);
  if (classType) {
    params.set('classType', classType);
  }
  if (quota) {
    params.set('quota', quota);
  }

  let trainList;
  try {
    trainList = await request('GET', `/api/trains/search?${params.toString()}`);
  } catch (err) {
    if (err.code === 'NOT_FOUND' || err.code === 'TRAIN_NOT_RUNNING') {
      return [];
    }
    throw err;
  }

  if (!Array.isArray(trainList) || trainList.length === 0) {
    return [];
  }

  return trainList.map(train => {
    const availClasses = (train.availableClasses || []).map(ac => ({
      classType: ac.classType,
      availableSeats: ac.availableSeats,
      racCount: ac.racCount,
      waitingListCount: ac.waitingListCount,
      baseFare: ac.baseFare,
      estimatedTotalFare: ac.estimatedTotalFare,
      quota: quota
    }));

    return {
      ...train,
      trainName: train.displayName,
      departureTime: train.boardingStation?.departureTime || '—:—',
      arrivalTime: train.destinationStation?.arrivalTime || '—:—',
      boardingDate: train.boardingStation?.boardingDate || train.originDate,
      arrivalDate: train.destinationStation?.arrivalDate || train.originDate,
      duration: train.duration,
      distanceKm: train.distanceKm,
      availability: availClasses
    };
  });
}

/**
 * 5. Quota Availability: GET /api/trains/:trainId/availability
 */
export async function getAvailability(trainId, journeyDate, classType, quota = 'GENERAL', passengerCount = 1) {
  const params = new URLSearchParams();
  params.set('journeyDate', journeyDate);
  if (classType) params.set('classType', classType);
  if (quota) params.set('quota', quota);
  if (passengerCount) params.set('passengerCount', String(passengerCount));

  return request('GET', `/api/trains/${encodeURIComponent(trainId)}/availability?${params.toString()}`);
}

/**
 * 6. Passenger Login: POST /api/auth/passenger/login
 * Calls login, then fetches GET /api/auth/me to merge profile fields (e.g. email, phone).
 */
export async function loginPassenger(email, password) {
  const loginData = await request('POST', '/api/auth/passenger/login', { email, password });

  // Use the new token to fetch /api/auth/me
  try {
    const meRes = await fetch(`${(window.RAILCONNECT_CONFIG && window.RAILCONNECT_CONFIG.API_BASE_URL) || 'http://localhost:5000'}/api/auth/me`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${loginData.token}`
      }
    });
    if (meRes.ok) {
      const mePayload = await meRes.json();
      if (mePayload?.success && mePayload?.data) {
        return {
          userId: loginData.userId,
          name: loginData.name,
          role: loginData.role,
          aadhaarVerified: loginData.aadhaarVerified,
          monthlyBookingsUsed: loginData.monthlyBookingsUsed,
          monthlyBookingsAllowed: loginData.monthlyBookingsAllowed,
          token: loginData.token,
          email: mePayload.data.email,
          phone: mePayload.data.phone,
          accountStatus: mePayload.data.accountStatus,
          createdAt: mePayload.data.createdAt
        };
      }
    }
  } catch (_) {
    // If /me fetch fails, fallback to loginData
  }

  return loginData;
}

/**
 * 7. Passenger Register: POST /api/auth/passenger/register
 */
export async function registerPassenger({ name, email, phone, password }) {
  return request('POST', '/api/auth/passenger/register', { name, email, phone, password });
}

/**
 * 8. Profile: GET /api/auth/me
 */
export async function getProfile() {
  return request('GET', '/api/auth/me', null, true);
}

/**
 * 9. My Bookings: GET /api/bookings
 * Query parameters optional: status, limit
 */
export async function getUserBookings(status = null, limit = 50) {
  const params = new URLSearchParams();
  if (status && status !== 'all') params.set('status', status);
  if (limit) params.set('limit', String(limit));
  const qs = params.toString();
  return request('GET', `/api/bookings${qs ? '?' + qs : ''}`, null, true);
}

/**
 * 10. PNR Status Lookup: GET /api/bookings/:pnr
 */
export async function enquirePNR(pnr) {
  if (!pnr) return null;
  return request('GET', `/api/bookings/${encodeURIComponent(pnr.trim())}`, null, true);
}

/**
 * 11. Create Booking: POST /api/bookings
 * Initiates booking with p_hold_for_payment = 1 and returns PNR, projectedStatus, fareBreakdown, and hold secondsRemaining.
 */
export async function createBooking(payload) {
  return request('POST', '/api/bookings', payload, true);
}

/**
 * 12. Hold Status: GET /api/bookings/:pnr/hold
 * Returns hold expiry as string and secondsRemaining computed by MySQL.
 */
export async function getBookingHold(pnr) {
  if (!pnr) return null;
  return request('GET', `/api/bookings/${encodeURIComponent(String(pnr).trim())}/hold`, null, true);
}

/**
 * 13. Razorpay Gateway Order: POST /api/payments/razorpay/order
 */
export async function createRazorpayOrder(pnr) {
  return request('POST', '/api/payments/razorpay/order', { pnr: String(pnr).trim() }, true);
}

/**
 * 14. Razorpay Gateway Signature Verification & Ticket Issuance: POST /api/payments/razorpay/verify
 */
export async function verifyRazorpayPayment({ pnr, razorpayOrderId, razorpayPaymentId, razorpaySignature }) {
  return request('POST', '/api/payments/razorpay/verify', {
    pnr: String(pnr).trim(),
    razorpayOrderId,
    razorpayPaymentId,
    razorpaySignature
  }, true);
}

/**
 * 15. Cancellation Refund Estimate: GET /api/bookings/:pnr/refund-estimate
 */
export async function getRefundEstimate(pnr, passengerNos = []) {
  const params = new URLSearchParams();
  if (Array.isArray(passengerNos) && passengerNos.length > 0) {
    params.set('passengerNos', passengerNos.join(','));
  }
  const qs = params.toString();
  return request('GET', `/api/bookings/${encodeURIComponent(String(pnr).trim())}/refund-estimate${qs ? '?' + qs : ''}`, null, true);
}

/**
 * 16. Cancel Booking / Passenger: POST /api/bookings/:pnr/cancel
 */
export async function cancelBooking(pnr, passengerNos = null) {
  const body = {};
  if (Array.isArray(passengerNos) && passengerNos.length > 0) {
    body.passengerNos = passengerNos;
  }
  return request('POST', `/api/bookings/${encodeURIComponent(String(pnr).trim())}/cancel`, body, true);
}

/**
 * 17. TDR Filing: POST /api/tdr
 */
export async function fileTDR({ pnr, passengerNos, reason, remarks, evidenceReference }) {
  const body = {
    pnr: String(pnr).trim(),
    reason,
    passengerNos: Array.isArray(passengerNos) ? passengerNos : [1]
  };
  if (remarks) body.remarks = remarks;
  if (evidenceReference) body.evidenceReference = evidenceReference;
  return request('POST', '/api/tdr', body, true);
}

/**
 * 18. List User TDRs: GET /api/tdr
 */
export async function getUserTDRs() {
  return request('GET', '/api/tdr', null, true);
}

// ─── Unimplemented Backend Endpoints (Graceful Stubs) ─────────────────────────

export async function getSavedPassengers() {
  return [];
}

export async function savePassenger() {
  const error = new Error('This feature is not available yet.');
  error.code = 'NOT_AVAILABLE';
  throw error;
}

export async function updatePassenger() {
  const error = new Error('This feature is not available yet.');
  error.code = 'NOT_AVAILABLE';
  throw error;
}

export async function deletePassenger() {
  const error = new Error('This feature is not available yet.');
  error.code = 'NOT_AVAILABLE';
  throw error;
}

export async function updateProfile() {
  const error = new Error('This feature is not available yet.');
  error.code = 'NOT_AVAILABLE';
  throw error;
}

// ─── Other Functions (Re-exported from mockService.js) ─────────────────────────

export {
  getTrainById,
  getTrainRunStatus,
  getPublicAlerts,
  searchConnectingJourneys,
  getBookingByPNR,
  getUserNotifications,
  markNotificationRead,
  getUserGrievances,
  fileGrievance,
  getSchedules,
  getRoutes
} from './mockService.js';
