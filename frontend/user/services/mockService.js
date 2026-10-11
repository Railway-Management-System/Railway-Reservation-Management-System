/**
 * Central Service Layer - Railway Reservation System
 * Toggle USE_MOCK to false when backend REST API is live.
 * All field names strictly follow docs/DATA_SCHEMA.md conventions.
 */

const USE_MOCK = true;
const MOCK_PATHS = [
  '../../mock-data',
  './mock-data',
  'mock-data',
  '/mock-data'
];

// Simulate network delay
const delay = (ms = 200) => new Promise(r => setTimeout(r, ms));

// Cache for loaded JSON files
const cache = {};
const STORE_PREFIX = 'railconnect_user_mock_';
const fallbackStore = {};

function readStored(key, fallback) {
  try {
    const value = localStorage.getItem(`${STORE_PREFIX}${key}`);
    return value ? JSON.parse(value) : fallback;
  } catch (_) { return Object.hasOwn(fallbackStore, key) ? fallbackStore[key] : fallback; }
}

function writeStored(key, value) {
  fallbackStore[key] = value;
  try { localStorage.setItem(`${STORE_PREFIX}${key}`, JSON.stringify(value)); } catch (_) { /* file:// browsers may limit storage */ }
}

async function hashPassword(password) {
  const bytes = new TextEncoder().encode(password);
  if (globalThis.crypto?.subtle) {
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
  }
  let hash = 2166136261;
  for (const byte of bytes) hash = Math.imul(hash ^ byte, 16777619);
  return `local-${(hash >>> 0).toString(16)}`;
}

async function saveJSON(filename, value) {
  cache[filename] = value;
  writeStored(filename, value);
}

async function loadJSON(filename) {
  if (cache[filename]) return cache[filename];
  const stored = readStored(filename, null);
  if (stored) {
    cache[filename] = stored;
    return stored;
  }
  for (const base of MOCK_PATHS) {
    try {
      const response = await fetch(`${base}/${filename}`);
      if (response.ok) {
        const data = await response.json();
        cache[filename] = data;
        return data;
      }
    } catch (_) {
      // try next path
    }
  }
  throw new Error(`Failed to load mock data file: ${filename}`);
}

// ─── Auth ────────────────────────────────────────────────────────────────────

export async function loginPassenger(email, password) {
  await delay();
  const users = await loadJSON('users.json');
  const user = users.find(u => u.email === email && u.role === 'PASSENGER');
  if (!user) throw new Error('INVALID_CREDENTIALS');
  if (user.accountStatus === 'SUSPENDED') throw new Error('ACCOUNT_SUSPENDED');
  const credentials = readStored('credentials', {});
  const expectedHash = credentials[email];
  const validPassword = expectedHash
    ? await hashPassword(password) === expectedHash
    : password === 'Password123!';
  if (!validPassword) throw new Error('INVALID_CREDENTIALS');
  return { ...user, token: `mock-token-passenger-${user.userId}` };
}

export async function registerPassenger({ name, email, phone, password }) {
  await delay(300);
  const users = await loadJSON('users.json');
  if (users.find(u => u.email.toLowerCase() === email.toLowerCase())) throw new Error('EMAIL_EXISTS');
  if (users.find(u => u.phone === phone)) throw new Error('PHONE_EXISTS');
  const credentials = readStored('credentials', {});
  credentials[email] = await hashPassword(password);
  writeStored('credentials', credentials);
  const newUser = {
    userId: Date.now(),
    name, email, phone,
    role: 'PASSENGER',
    accountStatus: 'ACTIVE',
    createdAt: new Date().toISOString(),
    token: `mock-token-passenger-new`
  };
  await saveJSON('users.json', [...users, newUser]);
  return newUser;
}

// ─── Profile ─────────────────────────────────────────────────────────────────

export async function getProfile(userId) {
  await delay();
  const users = await loadJSON('users.json');
  return users.find(u => u.userId === userId) || null;
}

export async function updateProfile(userId, updates) {
  const users = await loadJSON('users.json');
  const index = users.findIndex(user => user.userId === userId);
  if (index < 0) throw new Error('USER_NOT_FOUND');
  users[index] = { ...users[index], ...updates };
  await saveJSON('users.json', users);
  return users[index];
}

// ─── Passengers Master List ───────────────────────────────────────────────────

export async function getSavedPassengers(userId) {
  await delay();
  const passengers = await loadJSON('passengers.json');
  return passengers.filter(p => p.userId === userId);
}

export async function savePassenger(passenger) {
  const passengers = await loadJSON('passengers.json');
  const saved = { ...passenger, passengerId: passenger.passengerId || Date.now() };
  await saveJSON('passengers.json', [...passengers, saved]);
  return saved;
}

export async function updatePassenger(passengerId, updates) {
  const passengers = await loadJSON('passengers.json');
  const index = passengers.findIndex(passenger => passenger.passengerId === passengerId);
  if (index < 0) throw new Error('PASSENGER_NOT_FOUND');
  passengers[index] = { ...passengers[index], ...updates };
  await saveJSON('passengers.json', passengers);
  return passengers[index];
}

export async function deletePassenger(passengerId) {
  const passengers = await loadJSON('passengers.json');
  await saveJSON('passengers.json', passengers.filter(passenger => passenger.passengerId !== passengerId));
  return { success: true };
}

// ─── Trains ──────────────────────────────────────────────────────────────────

export async function searchTrains({ sourceStationId, destinationStationId, journeyDate, classType, quota = 'GENERAL' }) {
  await delay(400);
  const trains = await loadJSON('trains.json');
  const availability = await loadJSON('availability.json');
  const schedules = await loadJSON('schedules.json');
  const routes = await loadJSON('routes.json');

  return trains
    .filter(t => t.status === 'ACTIVE')
    .map(train => {
      const route = routes.filter(stop => stop.trainId === train.trainId)
        .sort((a, b) => a.stopSequence - b.stopSequence);
      const avail = availability.filter(a =>
        a.trainId === train.trainId &&
        a.journeyDate === journeyDate &&
        a.quota === quota &&
        (!classType || a.classType === classType)
      );
      const schedule = schedules.find(s => s.trainId === train.trainId && s.journeyDate === journeyDate);
      return { ...train, availability: avail, schedule, route };
    })
    .filter(t => {
      const from = t.route.find(stop => stop.stationId === Number(sourceStationId));
      const to = t.route.find(stop => stop.stationId === Number(destinationStationId));
      return from && to && from.stopSequence < to.stopSequence && t.availability.length > 0 && t.schedule?.status !== 'CANCELLED';
    });
}

export async function getAllTrains() {
  await delay();
  return loadJSON('trains.json');
}

export async function getTrainById(trainId) {
  await delay();
  const trains = await loadJSON('trains.json');
  return trains.find(t => t.trainId === trainId);
}

export async function getTrainSchedule(trainId) {
  await delay();
  const [train, stations, routes] = await Promise.all([
    getTrainById(Number(trainId)), loadJSON('stations.json'), loadJSON('routes.json')
  ]);
  if (!train) return null;
  const route = routes.filter(stop => stop.trainId === train.trainId)
    .sort((a, b) => a.stopSequence - b.stopSequence)
    .map(stop => ({ ...stop, station: stations.find(station => station.stationId === stop.stationId) }));
  return { ...train, route };
}

export async function getTrainRunStatus(trainId, journeyDate) {
  await delay();
  const [train, schedules] = await Promise.all([getTrainSchedule(Number(trainId)), loadJSON('schedules.json')]);
  const schedule = schedules.find(item => item.trainId === Number(trainId) && item.journeyDate === journeyDate);
  if (!train || !schedule) return null;
  const localToday = new Date().toLocaleDateString('en-CA');
  let currentStop = null;
  if (journeyDate === localToday && schedule.status !== 'CANCELLED') {
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes() - schedule.delayMinutes;
    currentStop = [...train.route].reverse().find(stop => {
      const [hours, minutes] = (stop.departureTime || stop.arrivalTime).split(':').map(Number);
      return hours * 60 + minutes <= currentMinutes;
    }) || null;
  }
  return { ...train, schedule, currentStop, trackingIsSimulated: true };
}

export async function getPublicAlerts() {
  await delay();
  const [schedules, trains] = await Promise.all([loadJSON('schedules.json'), loadJSON('trains.json')]);
  return schedules
    .filter(schedule => ['DELAYED', 'CANCELLED', 'RESCHEDULED'].includes(schedule.status))
    .map(schedule => ({ ...schedule, train: trains.find(train => train.trainId === schedule.trainId) }))
    .filter(alert => alert.train)
    .sort((a, b) => a.journeyDate.localeCompare(b.journeyDate));
}

function timeInMinutes(value) {
  const [hours, minutes] = value.split(':').map(Number);
  return hours * 60 + minutes;
}

export async function searchConnectingJourneys({ sourceStationId, destinationStationId, journeyDate }) {
  await delay(350);
  const [trains, routes, schedules, stations, availability] = await Promise.all([
    loadJSON('trains.json'), loadJSON('routes.json'), loadJSON('schedules.json'),
    loadJSON('stations.json'), loadJSON('availability.json')
  ]);
  const routeByTrain = new Map(trains.map(train => [train.trainId,
    routes.filter(stop => stop.trainId === train.trainId).sort((a, b) => a.stopSequence - b.stopSequence)]));
  const eligible = trains.filter(train => train.status === 'ACTIVE' &&
    schedules.some(run => run.trainId === train.trainId && run.journeyDate === journeyDate && run.status !== 'CANCELLED') &&
    availability.some(item => item.trainId === train.trainId && item.journeyDate === journeyDate));
  const results = [];
  for (const first of eligible) {
    const firstRoute = routeByTrain.get(first.trainId) || [];
    const origin = firstRoute.find(stop => stop.stationId === Number(sourceStationId));
    if (!origin) continue;
    for (const second of eligible) {
      if (first.trainId === second.trainId) continue;
      const secondRoute = routeByTrain.get(second.trainId) || [];
      const destination = secondRoute.find(stop => stop.stationId === Number(destinationStationId));
      if (!destination) continue;
      for (const firstJunction of firstRoute.filter(stop => stop.stopSequence > origin.stopSequence)) {
        const secondJunction = secondRoute.find(stop => stop.stationId === firstJunction.stationId && stop.stopSequence < destination.stopSequence);
        if (!secondJunction) continue;
        const arrival = timeInMinutes(firstJunction.arrivalTime);
        let departure = timeInMinutes(secondJunction.departureTime);
        if (departure < arrival) departure += 1440;
        const transferMinutes = departure - arrival;
        if (transferMinutes < 30 || transferMinutes > 360) continue;
        results.push({
          firstTrain: { ...first, fromStop: origin, transferStop: firstJunction },
          secondTrain: { ...second, transferStop: secondJunction, toStop: destination },
          transferStation: stations.find(station => station.stationId === firstJunction.stationId),
          transferMinutes
        });
      }
    }
  }
  return results.sort((a, b) => a.transferMinutes - b.transferMinutes).slice(0, 8);
}

export async function getAvailability(trainId, journeyDate, classType, quota = 'GENERAL') {
  await delay();
  const availability = await loadJSON('availability.json');
  return availability.filter(a =>
    a.trainId === trainId && a.journeyDate === journeyDate &&
    (!classType || a.classType === classType) && a.quota === quota
  );
}

// ─── Stations ─────────────────────────────────────────────────────────────────

export async function getStations() {
  await delay();
  return loadJSON('stations.json');
}

// ─── Bookings ─────────────────────────────────────────────────────────────────

export async function getUserBookings(userId) {
  await delay(300);
  const bookings = await loadJSON('bookings.json');
  const trains = await loadJSON('trains.json');
  const stations = await loadJSON('stations.json');
  const bookingPassengers = await loadJSON('booking-passengers.json');

  return bookings
    .filter(b => b.userId === userId)
    .map(booking => {
      const train = trains.find(t => t.trainId === booking.trainId);
      const boardingStation = stations.find(s => s.stationId === booking.boardingStationId);
      const destinationStation = stations.find(s => s.stationId === booking.destinationStationId);
      const passengers = bookingPassengers.filter(bp => bp.bookingId === booking.bookingId);
      return { ...booking, train, boardingStation, destinationStation, passengers };
    });
}

export async function getBookingByPNR(pnr) {
  await delay(200);
  const bookings = await loadJSON('bookings.json');
  const trains = await loadJSON('trains.json');
  const stations = await loadJSON('stations.json');
  const bookingPassengers = await loadJSON('booking-passengers.json');
  const passengers = await loadJSON('passengers.json');

  const booking = bookings.find(b => b.pnr === pnr);
  if (!booking) return null;

  const train = trains.find(t => t.trainId === booking.trainId);
  const boardingStation = stations.find(s => s.stationId === booking.boardingStationId);
  const destinationStation = stations.find(s => s.stationId === booking.destinationStationId);
  const bpassengers = bookingPassengers
    .filter(bp => bp.bookingId === booking.bookingId)
    .map(bp => {
      const pax = passengers.find(p => p.passengerId === bp.passengerId);
      return { ...bp, passengerInfo: pax };
    });

  return { ...booking, train, boardingStation, destinationStation, passengers: bpassengers };
}

export async function cancelBooking(pnr, passengerIds = []) {
  await delay(500);
  const bookings = await loadJSON('bookings.json');
  const booking = bookings.find(item => item.pnr === pnr);
  if (!booking) throw new Error('BOOKING_NOT_FOUND');
  if (booking.bookingStatus === 'CANCELLED') throw new Error('BOOKING_ALREADY_CANCELLED');
  const cancellationCharge = Math.min(120, booking.totalFare);
  const refundAmount = Math.max(0, booking.totalFare - cancellationCharge);
  booking.bookingStatus = 'CANCELLED';
  const bookingPassengers = await loadJSON('booking-passengers.json');
  const travellers = bookingPassengers.filter(item => item.bookingId === booking.bookingId &&
    (!passengerIds.length || passengerIds.includes(item.passengerId)));
  const [availability, seats] = await Promise.all([loadJSON('availability.json'), loadJSON('seats.json')]);
  const inventory = availability.find(item => item.trainId === booking.trainId &&
    item.journeyDate === booking.journeyDate && item.classType === booking.classType && item.quota === booking.quota);
  let releasedSeats = 0;
  let releasedRac = 0;
  let releasedWaitlist = 0;
  for (const passenger of travellers) {
    if (passenger.passengerStatus === 'CONFIRMED' && passenger.coachNumber && passenger.seatNumber) {
      const coach = (await loadJSON('coaches.json')).find(item => item.trainId === booking.trainId && item.coachNumber === passenger.coachNumber);
      const seat = seats.find(item => item.coachId === coach?.coachId && item.seatNumber === passenger.seatNumber && item.seatStatus === 'BOOKED');
      if (seat) { seat.seatStatus = 'AVAILABLE'; releasedSeats++; }
    } else if (passenger.passengerStatus === 'RAC') releasedRac++;
    else if (passenger.passengerStatus === 'WAITING_LIST') releasedWaitlist++;
    passenger.passengerStatus = 'CANCELLED';
  }
  if (inventory) {
    inventory.availableSeats = (inventory.availableSeats || 0) + releasedSeats;
    inventory.racCount = (inventory.racCount || 0) + releasedRac;
    inventory.waitingListCount = Math.max(0, (inventory.waitingListCount || 0) - releasedWaitlist);
  }
  await saveJSON('booking-passengers.json', bookingPassengers);
  await saveJSON('seats.json', seats);
  await saveJSON('availability.json', availability);
  await saveJSON('bookings.json', bookings);
  const cancellations = await loadJSON('cancellations.json');
  const result = {
    cancellationId: Date.now(), bookingId: booking.bookingId, pnr,
    passengerId: passengerIds[0] || null, cancellationCharge, refundAmount,
    cancellationDate: new Date().toISOString(), status: 'PROCESSED'
  };
  await saveJSON('cancellations.json', [...cancellations, result]);
  return result;
}

// ─── Booking Flow ─────────────────────────────────────────────────────────────

export async function holdSeats({ trainId, journeyDate, boardingStationId, destinationStationId, classType, quota, passengerCount }) {
  await delay(300);
  return {
    holdToken: `HOLD-${Math.random().toString(36).substr(2,6).toUpperCase()}-${Date.now()}`,
    expiresAt: new Date(Date.now() + 600000).toISOString(),
    holdDurationSeconds: 600
  };
}

export async function createBooking(bookingData) {
  await delay(500);
  const bookings = await loadJSON('bookings.json');
  let pnr;
  do { pnr = String(Math.floor(Math.random() * 9000000000 + 1000000000)); }
  while (bookings.some(item => item.pnr === pnr));
  const bookingId = Date.now();
  const booking = {
    bookingId, pnr, userId: bookingData.userId, trainId: bookingData.trainId,
    journeyDate: bookingData.journeyDate, boardingStationId: bookingData.boardingStationId,
    destinationStationId: bookingData.destinationStationId, classType: bookingData.classType,
    quota: bookingData.quota, bookingStatus: 'PAYMENT_PENDING',
    totalFare: bookingData.totalFare, createdAt: new Date().toISOString()
  };
  const bookingPassengers = await loadJSON('booking-passengers.json');
  const newBookingPassengers = bookingData.passengers.map((passenger, index) => ({
    bookingPassengerId: bookingId + index,
    bookingId,
    passengerId: passenger.passengerId || null,
    name: passenger.name,
    age: passenger.age,
    gender: passenger.gender,
    berthPreference: passenger.berthPreference,
    idProofType: passenger.idProofType,
    idProofReference: passenger.idProofReference,
    concessionType: passenger.concessionType,
    disabilityType: passenger.disabilityType,
    passengerStatus: 'CONFIRMED',
    coachNumber: null, seatNumber: null, berthType: null
  }));
  await saveJSON('bookings.json', [...bookings, booking]);
  await saveJSON('booking-passengers.json', [...bookingPassengers, ...newBookingPassengers]);
  return {
    ...booking,
    fareBreakdown: bookingData.fareBreakdown,
    passengers: newBookingPassengers
  };
}

export async function processPayment({ bookingId, paymentMode, amount }) {
  await delay(800);
  // Simulate 90% success rate
  const success = Math.random() > 0.1;
  const bookings = await loadJSON('bookings.json');
  const booking = bookings.find(item => item.bookingId === bookingId);
  if (!booking) throw new Error('BOOKING_NOT_FOUND');
  const payments = await loadJSON('payments.json');
  const payment = {
    paymentId: Date.now(), bookingId, amount, paymentMode,
    paymentStatus: success ? 'SUCCESS' : 'FAILED',
    gatewayTransactionId: `TXN_MOCK_${Date.now()}`,
    paidAt: success ? new Date().toISOString() : null
  };
  const bookingPassengers = await loadJSON('booking-passengers.json');
  const passengers = bookingPassengers.filter(item => item.bookingId === bookingId);
  if (success) {
    const [coaches, seats] = await Promise.all([loadJSON('coaches.json'), loadJSON('seats.json')]);
    const classCoaches = coaches.filter(coach => coach.trainId === booking.trainId && coach.classType === booking.classType);
    const availability = await loadJSON('availability.json');
    const inventory = availability.find(item => item.trainId === booking.trainId && item.journeyDate === booking.journeyDate && item.classType === booking.classType && item.quota === booking.quota);
    let seatsRemaining = inventory?.availableSeats || 0;
    let racRemaining = inventory?.racCount || 0;
    let waitingListAdded = 0;
    for (const passenger of passengers) {
      const seat = seatsRemaining > 0
        ? seats.find(item => classCoaches.some(coach => coach.coachId === item.coachId) && item.seatStatus === 'AVAILABLE')
        : null;
      if (seat) {
        const coach = classCoaches.find(item => item.coachId === seat.coachId);
        passenger.coachNumber = coach.coachNumber;
        passenger.seatNumber = seat.seatNumber;
        passenger.berthType = seat.berthType;
        passenger.passengerStatus = 'CONFIRMED';
        seat.seatStatus = 'BOOKED';
        seatsRemaining--;
      } else if (racRemaining > 0) {
        passenger.passengerStatus = 'RAC';
        racRemaining--;
      } else {
        passenger.passengerStatus = 'WAITING_LIST';
        waitingListAdded++;
      }
    }
    booking.bookingStatus = passengers.every(item => item.passengerStatus === 'CONFIRMED') ? 'CONFIRMED'
      : passengers.some(item => item.passengerStatus === 'CONFIRMED' || item.passengerStatus === 'RAC') ? 'RAC' : 'WAITING_LIST';
    await saveJSON('seats.json', seats);
    await saveJSON('booking-passengers.json', bookingPassengers);
    if (inventory) {
      inventory.availableSeats = seatsRemaining;
      inventory.racCount = racRemaining;
      inventory.waitingListCount = (inventory.waitingListCount || 0) + waitingListAdded;
      await saveJSON('availability.json', availability);
    }
  } else {
    booking.bookingStatus = 'FAILED';
  }
  await saveJSON('bookings.json', bookings);
  await saveJSON('payments.json', [...payments, payment]);
  if (!success) throw new Error('PAYMENT_FAILED');
  return {
    ...payment,
    booking: {
      pnr: booking.pnr,
      bookingStatus: booking.bookingStatus,
      passengers: passengers.map(passenger => ({
        ...passenger,
        name: passenger.name || (passenger.passengerId ? null : 'Passenger')
      }))
    }
  };
}

// ─── TDR ─────────────────────────────────────────────────────────────────────

export async function getUserTDRs(userId) {
  await delay();
  const tdrs = await loadJSON('tdr.json');
  const bookings = await loadJSON('bookings.json');
  return tdrs.filter(t => {
    const booking = bookings.find(b => b.bookingId === t.bookingId);
    return booking && booking.userId === userId;
  });
}

export async function fileTDR({ bookingId, pnr, reason }) {
  await delay(400);
  const [tdrs, bookings] = await Promise.all([loadJSON('tdr.json'), loadJSON('bookings.json')]);
  const booking = bookings.find(item => item.pnr === pnr && (!bookingId || item.bookingId === bookingId));
  if (!booking) throw new Error('BOOKING_NOT_FOUND');
  const tdr = {
    tdrId: Date.now(), bookingId: booking.bookingId, pnr,
    reason, submittedAt: new Date().toISOString(), status: 'FILED', refundAmount: null
  };
  await saveJSON('tdr.json', [...tdrs, tdr]);
  return tdr;
}

// ─── Notifications ────────────────────────────────────────────────────────────

export async function getUserNotifications(userId) {
  await delay();
  const notifications = await loadJSON('notifications.json');
  return notifications.filter(n => n.userId === userId);
}

export async function markNotificationRead(notificationId) {
  await delay(100);
  const notifications = await loadJSON('notifications.json');
  const notification = notifications.find(item => item.notificationId === notificationId);
  if (notification) notification.isRead = true;
  await saveJSON('notifications.json', notifications);
  return { success: true };
}

// ─── Grievances ───────────────────────────────────────────────────────────────

export async function getUserGrievances(userId) {
  await delay();
  const grievances = await loadJSON('grievances.json');
  return grievances.filter(g => g.userId === userId);
}

export async function fileGrievance({ userId, category, subject, description }) {
  await delay(400);
  const grievances = await loadJSON('grievances.json');
  const grievance = {
    grievanceId: Date.now(), userId, category, subject, description,
    status: 'SUBMITTED', response: null, createdAt: new Date().toISOString()
  };
  await saveJSON('grievances.json', [...grievances, grievance]);
  return grievance;
}

// ─── PNR Enquiry ─────────────────────────────────────────────────────────────

export async function enquirePNR(pnr) {
  await delay(300);
  return getBookingByPNR(pnr);
}

// ─── Schedules ────────────────────────────────────────────────────────────────

export async function getSchedules() {
  await delay();
  return loadJSON('schedules.json');
}

export async function getRoutes() {
  await delay();
  return loadJSON('routes.json');
}
