/**
 * RailConnect – Passenger Portal Application
 * Main controller for all dashboard functionality.
 */

import * as Service from './services/mockService.js';

// ════════════════════════════════════════════════════════════════ STATE
const State = {
  user: null,
  stations: [],
  allBookings: [],
  savedPassengers: [],
  notifications: [],
  bookingFlow: {
    step: 1,
    searchParams: {},
    searchResults: [],
    selectedTrain: null,
    selectedClass: null,
    selectedPassengers: [],
    holdToken: null,
    holdExpiry: null,
    holdTimerInterval: null,
    bookingId: null,
    pnr: null,
    totalFare: 0,
    fareBreakdown: {}
  }
};

// ════════════════════════════════════════════════════════════════ INIT
window.addEventListener('DOMContentLoaded', async () => {
  setCurrentDate();
  setGreeting();
  await populateStationDropdowns();
  setDefaultDate();
  await loadPublicTrainTools();
  document.getElementById('auth-container')?.addEventListener('click', (event) => {
    if (event.target.id === 'auth-container') closeAuthModal();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeAuthModal();
  });

  // Check if already logged in (session persist)
  const savedUser = sessionStorage.getItem('railconnect_user');
  if (savedUser) {
    State.user = JSON.parse(savedUser);
    await enterDashboard();
  }

  // Handle initial hash or default to home without scrolling
  const hash = window.location.hash;
  if (hash === '#journey-search') {
    switchPublicView('book');
  } else if (hash === '#train-tools') {
    switchPublicView('trains');
  } else if (hash === '#public-alerts') {
    switchPublicView('alerts');
  } else if (hash === '#public-support') {
    switchPublicView('contact');
  } else {
    switchPublicView('home');
  }
});

// ════════════════════════════════════════════════════════════════ PUBLIC TAB NAVIGATION (NO SCROLL)
window.switchPublicView = (view, clickedEl) => {
  // Update nav active link
  const navLinks = document.querySelectorAll('#public-nav-links a');
  navLinks.forEach(link => link.classList.remove('current'));
  if (clickedEl) {
    clickedEl.classList.add('current');
  } else {
    // Match by view
    const indexMap = { home: 0, book: 1, trains: 3, alerts: 4, contact: 5 };
    if (navLinks[indexMap[view]]) navLinks[indexMap[view]].classList.add('current');
  }

  const hero = document.querySelector('.public-hero');
  const searchWrap = document.getElementById('journey-search');
  const travelInfo = document.getElementById('travel-info');
  const trainTools = document.getElementById('train-tools');
  const connectSearch = document.getElementById('connecting-search');
  const publicAlerts = document.getElementById('public-alerts');
  const publicSupport = document.getElementById('public-support');

  // Helper to show/hide using high-priority CSS class
  const setVisible = (el, show) => {
    if (!el) return;
    if (show) {
      el.classList.remove('public-view-hidden');
    } else {
      el.classList.add('public-view-hidden');
    }
  };

  switch (view) {
    case 'home':
      setVisible(hero, true);
      setVisible(searchWrap, true);
      setVisible(travelInfo, true);
      setVisible(trainTools, false);
      setVisible(connectSearch, false);
      setVisible(publicAlerts, false);
      setVisible(publicSupport, false);
      if (searchWrap) searchWrap.classList.remove('public-view-direct');
      break;

    case 'book':
      setVisible(hero, false);
      setVisible(searchWrap, true);
      setVisible(travelInfo, false);
      setVisible(trainTools, false);
      setVisible(connectSearch, false);
      setVisible(publicAlerts, false);
      setVisible(publicSupport, false);
      if (searchWrap) searchWrap.classList.add('public-view-direct');
      break;

    case 'trains':
      setVisible(hero, false);
      setVisible(searchWrap, false);
      setVisible(travelInfo, false);
      setVisible(trainTools, true);
      setVisible(connectSearch, true);
      setVisible(publicAlerts, false);
      setVisible(publicSupport, false);
      if (trainTools) trainTools.classList.add('public-view-direct');
      break;

    case 'alerts':
      setVisible(hero, false);
      setVisible(searchWrap, false);
      setVisible(travelInfo, false);
      setVisible(trainTools, false);
      setVisible(connectSearch, false);
      setVisible(publicAlerts, true);
      setVisible(publicSupport, false);
      if (publicAlerts) publicAlerts.classList.add('public-view-direct');
      break;

    case 'contact':
      setVisible(hero, false);
      setVisible(searchWrap, false);
      setVisible(travelInfo, false);
      setVisible(trainTools, false);
      setVisible(connectSearch, false);
      setVisible(publicAlerts, false);
      setVisible(publicSupport, true);
      if (publicSupport) publicSupport.classList.add('public-view-direct');
      break;
  }

  // Clear any URL hash so browser cannot scroll to id anchors
  if (window.location.hash) {
    history.replaceState(null, '', window.location.pathname);
  }

  // Ensure scroll is pinned at top without any movement
  document.documentElement.scrollTop = 0;
  document.body.scrollTop = 0;
  window.scrollTo(0, 0);

  const mobileNav = document.getElementById('public-nav-links');
  if (mobileNav && mobileNav.classList.contains('open')) {
    mobileNav.classList.remove('open');
  }
};

function setCurrentDate() {
  const now = new Date();
  const options = { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' };
  document.getElementById('current-date').textContent = now.toLocaleDateString('en-IN', options);
}

function setGreeting() {
  const h = new Date().getHours();
  const greeting = h < 12 ? 'morning' : h < 17 ? 'afternoon' : 'evening';
  const el = document.getElementById('time-greeting');
  if (el) el.textContent = greeting;
}

function setDefaultDate() {
  const today = new Date().toISOString().split('T')[0];
  ['qs-date', 'search-date', 'public-date', 'public-track-date', 'connect-date'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = today;
  });
}

// ════════════════════════════════════════════════════════════════ STATIONS
async function populateStationDropdowns() {
  try {
    State.stations = await Service.getStations();
    const stationOptions = State.stations.map(s =>
      `<option value="${s.stationId}">${s.stationCode} – ${s.stationName} (${s.city})</option>`
    ).join('');

    ['qs-from', 'qs-to', 'search-from', 'search-to', 'public-from', 'public-to', 'connect-from', 'connect-to'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.innerHTML = stationOptions;
    });

    // Set default selections
    const fromEl1 = document.getElementById('qs-from');
    const toEl1 = document.getElementById('qs-to');
    const fromEl2 = document.getElementById('search-from');
    const toEl2 = document.getElementById('search-to');
    const fromPublic = document.getElementById('public-from');
    const toPublic = document.getElementById('public-to');
    const fromConnect = document.getElementById('connect-from');
    const toConnect = document.getElementById('connect-to');

    if (fromEl1) fromEl1.value = '7'; // Mumbai Central
    if (toEl1) toEl1.value = '1';    // New Delhi
    if (fromEl2) fromEl2.value = '7';
    if (toEl2) toEl2.value = '1';
    if (fromPublic) fromPublic.value = '7';
    if (toPublic) toPublic.value = '1';
    if (fromConnect) fromConnect.value = '7';
    if (toConnect) toConnect.value = '1';
  } catch (e) {
    console.error('Could not load stations', e);
  }
}

// ════════════════════════════════════════════════════════════════ AUTH

window.switchAuthTab = (tab) => {
  document.getElementById('tab-login').classList.toggle('active', tab === 'login');
  document.getElementById('tab-register').classList.toggle('active', tab === 'register');
  document.getElementById('login-form').classList.toggle('hidden', tab !== 'login');
  document.getElementById('register-form').classList.toggle('hidden', tab !== 'register');
};

async function loadPublicTrainTools() {
  try {
    const trains = await Service.getAllTrains();
    const options = trains.filter(train => train.status === 'ACTIVE')
      .map(train => `<option value="${train.trainId}">${train.trainNumber} · ${train.trainName}</option>`).join('');
    ['public-schedule-train', 'public-track-train'].forEach(id => {
      const select = document.getElementById(id);
      if (select) select.innerHTML = options;
    });
    await renderPublicAlerts();
  } catch (error) {
    console.error('Could not load public train information', error);
  }
}

window.lookupPublicSchedule = async (event) => {
  event.preventDefault();
  const container = document.getElementById('public-schedule-result');
  container.innerHTML = '<p>Loading timetable…</p>';
  try {
    const train = await Service.getTrainSchedule(Number(document.getElementById('public-schedule-train').value));
    if (!train?.route?.length) { container.innerHTML = '<p>No route timetable is available for this train.</p>'; return; }
    container.innerHTML = `<div class="tool-result-head"><strong>${train.trainNumber} · ${train.trainName}</strong><span>${train.runningDays.join(' · ')}</span></div><div class="schedule-table-wrap"><table class="public-schedule-table"><thead><tr><th>Stop</th><th>Arrival</th><th>Departure</th><th>Platform</th><th>Distance</th></tr></thead><tbody>${train.route.map(stop => `<tr><td><strong>${stop.station?.stationName || 'Station'}</strong><small>${stop.station?.stationCode || ''}</small></td><td>${stop.arrivalTime}</td><td>${stop.departureTime}</td><td>${stop.platformNumber}</td><td>${stop.distanceFromOrigin} km</td></tr>`).join('')}</tbody></table></div>`;
  } catch (error) { container.innerHTML = '<p>Could not load the timetable. Please try again.</p>'; }
};

window.trackPublicTrain = async (event) => {
  event.preventDefault();
  const container = document.getElementById('public-track-result');
  const trainId = Number(document.getElementById('public-track-train').value);
  const journeyDate = document.getElementById('public-track-date').value;
  container.innerHTML = '<p>Checking the scheduled run…</p>';
  try {
    const run = await Service.getTrainRunStatus(trainId, journeyDate);
    if (!run) { container.innerHTML = '<p>No dated schedule found for this train. Try a date with a sample schedule.</p>'; return; }
    const statusLabel = run.schedule.status.replaceAll('_', ' ');
    const lastKnown = run.currentStop?.station?.stationName || 'No current station in sample data';
    container.innerHTML = `<div class="track-status-card"><span class="status-badge ${run.schedule.status}">${statusLabel}</span><strong>${run.schedule.delayMinutes ? `${run.schedule.delayMinutes} min delay` : 'No scheduled delay'}</strong><p>${run.trainNumber} · ${run.trainName}</p><div class="track-last-stop">Last scheduled stop: <b>${lastKnown}</b></div><small>Tracking is simulated from the dated mock schedule; live GPS position is not provided by the current API contract.</small></div>`;
  } catch (error) { container.innerHTML = '<p>Could not load train status. Please try again.</p>'; }
};

window.lookupPublicPNR = async (event) => {
  event.preventDefault();
  const pnr = document.getElementById('public-pnr-input').value.trim();
  const container = document.getElementById('public-pnr-result');
  container.innerHTML = '<p>Looking up PNR…</p>';
  try {
    const booking = await Service.enquirePNR(pnr);
    if (!booking) { container.innerHTML = `<p>No sample booking was found for PNR ${pnr}.</p>`; return; }
    container.innerHTML = `<div class="public-pnr-card"><div><small>PNR ${booking.pnr}</small><strong>${booking.bookingStatus.replaceAll('_', ' ')}</strong></div><p>${booking.train?.trainNumber} · ${booking.train?.trainName}</p><p>${booking.boardingStation?.stationCode} → ${booking.destinationStation?.stationCode} · ${formatDate(booking.journeyDate)}</p><div class="pnr-passenger-status">${booking.passengers.map(passenger => `<span>${passenger.passengerInfo?.name || passenger.name || 'Passenger'} · ${passenger.passengerStatus.replaceAll('_', ' ')}</span>`).join('')}</div></div>`;
  } catch (error) { container.innerHTML = '<p>PNR lookup failed. Please try again.</p>'; }
};

window.searchPublicConnections = async (event) => {
  event.preventDefault();
  const resultsEl = document.getElementById('public-connection-results');
  resultsEl.innerHTML = '<p>Searching sample connections…</p>';
  try {
    const journeys = await Service.searchConnectingJourneys({
      sourceStationId: Number(document.getElementById('connect-from').value),
      destinationStationId: Number(document.getElementById('connect-to').value),
      journeyDate: document.getElementById('connect-date').value
    });
    if (!journeys.length) { resultsEl.innerHTML = '<p>No two-leg connections were found in the sample schedules for that date.</p>'; return; }
    resultsEl.innerHTML = journeys.map(journey => `<article class="connection-result"><div><small>LEG 1 · ${journey.firstTrain.trainNumber}</small><strong>${journey.firstTrain.trainName}</strong><span>${journey.firstTrain.fromStop.departureTime} → ${journey.firstTrain.transferStop.arrivalTime}</span></div><b class="connection-transfer">${journey.transferStation?.stationCode || 'Transfer'}<small>${Math.floor(journey.transferMinutes / 60)}h ${journey.transferMinutes % 60}m transfer</small></b><div><small>LEG 2 · ${journey.secondTrain.trainNumber}</small><strong>${journey.secondTrain.trainName}</strong><span>${journey.secondTrain.transferStop.departureTime} → ${journey.secondTrain.toStop.arrivalTime}</span></div></article>`).join('');
  } catch (error) { resultsEl.innerHTML = '<p>Connection search failed. Please try again.</p>'; }
};

async function renderPublicAlerts() {
  const container = document.getElementById('public-alert-list');
  if (!container) return;
  const alerts = await Service.getPublicAlerts();
  if (!alerts.length) { container.innerHTML = '<p class="public-no-alerts">No operational notices are present in the sample schedules.</p>'; return; }
  container.innerHTML = alerts.map(alert => `<article class="public-alert-card ${alert.status.toLowerCase()}"><span>${alert.status === 'CANCELLED' ? '!' : '◷'}</span><div><strong>${alert.train.trainNumber} · ${alert.train.trainName}</strong><p>${alert.status === 'DELAYED' ? `Delayed by ${alert.delayMinutes} minutes` : `Service ${alert.status.toLowerCase()}`} · ${formatDate(alert.journeyDate)}</p></div><b>${alert.status.replaceAll('_', ' ')}</b></article>`).join('');
}

window.openAuthModal = (tab = 'login') => {
  document.getElementById('auth-container').classList.remove('hidden');
  document.body.classList.add('auth-open');
  switchAuthTab(tab);
  requestAnimationFrame(() => document.getElementById(tab === 'register' ? 'reg-name' : 'login-email')?.focus());
};

window.closeAuthModal = () => {
  document.getElementById('auth-container')?.classList.add('hidden');
  document.body.classList.remove('auth-open');
};

window.swapPublicStations = () => {
  const from = document.getElementById('public-from');
  const to = document.getElementById('public-to');
  [from.value, to.value] = [to.value, from.value];
};

window.handlePublicSearch = async (event) => {
  event.preventDefault();
  const sourceStationId = Number(document.getElementById('public-from').value);
  const destinationStationId = Number(document.getElementById('public-to').value);
  const journeyDate = document.getElementById('public-date').value;
  const classType = document.getElementById('public-class').value;
  const quota = document.getElementById('public-quota').value;
  const resultsEl = document.getElementById('public-results');

  if (sourceStationId === destinationStationId) {
    showToast('Choose two different stations.', 'error');
    return;
  }

  const button = event.submitter;
  button.disabled = true;
  button.classList.add('is-loading');
  button.querySelector('b').textContent = '…';
  resultsEl.innerHTML = '<div class="public-result-message">Finding available journeys…</div>';
  try {
    const trains = await Service.searchTrains({ sourceStationId, destinationStationId, journeyDate, classType, quota });
    const source = State.stations.find(station => station.stationId === sourceStationId);
    const destination = State.stations.find(station => station.stationId === destinationStationId);
    if (!trains.length) {
      resultsEl.innerHTML = '<div class="public-result-message">No scheduled trains were found for this route and date. Try another date or station pair.</div>';
      return;
    }
    resultsEl.innerHTML = `<div class="public-result-heading"><div><span class="search-eyebrow">${trains.length} JOURNEY${trains.length === 1 ? '' : 'S'} FOUND</span><h2>${source?.stationCode} <span>→</span> ${destination?.stationCode}</h2></div><span>${formatDate(journeyDate)}</span></div>` + trains.map(train => {
      const availability = train.availability.find(item => (!classType || item.classType === classType) && item.quota === quota);
      const openSeats = availability?.availableSeats || 0;
      return `<article class="public-train-result"><div class="public-train-symbol" aria-hidden="true">🚆</div><div class="public-train-details"><span>TRAIN ${train.trainNumber} · ${train.trainType.replaceAll('_', ' ')}</span><h3>${train.trainName}</h3></div><div class="public-availability"><strong>${openSeats > 0 ? `${openSeats} available` : 'Check availability'}</strong><small>${availability?.classType || 'Multiple classes'} · ${quota.replaceAll('_', ' ')}</small></div><button type="button" class="public-book-cta" onclick="openAuthModal('login')">Sign in to book <b>→</b></button></article>`;
    }).join('');
  } catch (error) {
    console.error('Public train search failed:', error);
    resultsEl.innerHTML = '<div class="public-result-message">Train search is unavailable right now. Please try again.</div>';
  } finally {
    button.disabled = false;
    button.classList.remove('is-loading');
    button.querySelector('b').textContent = '→';
  }
};

window.handleLogin = async (e) => {
  e.preventDefault();
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;

  const btn = document.getElementById('login-btn');
  btn.querySelector('.btn-text').classList.add('hidden');
  btn.querySelector('.btn-spinner').classList.remove('hidden');

  try {
    const user = await Service.loginPassenger(email, password);
    State.user = user;
    sessionStorage.setItem('railconnect_user', JSON.stringify(user));
    await enterDashboard();
    showToast('Welcome back, ' + user.name.split(' ')[0] + '! 🎉', 'success');
  } catch (err) {
    showToast(
      err.message === 'ACCOUNT_SUSPENDED' ? 'Your account is suspended. Contact support.' :
      'Invalid email or password. Please try again.', 'error'
    );
  } finally {
    btn.querySelector('.btn-text').classList.remove('hidden');
    btn.querySelector('.btn-spinner').classList.add('hidden');
  }
};

window.handleRegister = async (e) => {
  e.preventDefault();
  const btn = document.getElementById('register-btn');
  btn.querySelector('.btn-text').classList.add('hidden');
  btn.querySelector('.btn-spinner').classList.remove('hidden');

  try {
    const user = await Service.registerPassenger({
      name: document.getElementById('reg-name').value.trim(),
      email: document.getElementById('reg-email').value.trim(),
      phone: document.getElementById('reg-phone').value.trim(),
      password: document.getElementById('reg-password').value
    });
    State.user = user;
    sessionStorage.setItem('railconnect_user', JSON.stringify(user));
    await enterDashboard();
    showToast('Account created successfully! Welcome 🚆', 'success');
  } catch (err) {
    showToast(err.message === 'EMAIL_EXISTS' ? 'Email already registered.' :
      err.message === 'PHONE_EXISTS' ? 'Phone number already registered.' : 'Registration failed.', 'error');
  } finally {
    btn.querySelector('.btn-text').classList.remove('hidden');
    btn.querySelector('.btn-spinner').classList.add('hidden');
  }
};

window.handleLogout = () => {
  sessionStorage.removeItem('railconnect_user');
  State.user = null;
  document.getElementById('public-home').classList.remove('hidden');
  closeAuthModal();
  document.getElementById('dashboard-container').classList.add('hidden');
  showToast('Signed out successfully', 'success');
};

window.togglePassword = (id) => {
  const input = document.getElementById(id);
  input.type = input.type === 'password' ? 'text' : 'password';
};

// ════════════════════════════════════════════════════════════════ ENTER DASHBOARD

async function enterDashboard() {
  document.getElementById('public-home').classList.add('hidden');
  document.getElementById('auth-container').classList.add('hidden');
  document.getElementById('auth-container').classList.remove('active');
  closeAuthModal();
  document.getElementById('dashboard-container').classList.remove('hidden');

  const { user } = State;
  const initials = user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  // Update UI with user info
  document.getElementById('sidebar-avatar').textContent = initials;
  document.getElementById('sidebar-name').textContent = user.name;
  document.getElementById('topbar-avatar').textContent = initials;
  document.getElementById('topbar-username').textContent = user.name.split(' ')[0];
  document.getElementById('profile-avatar').textContent = initials;
  document.getElementById('welcome-name').textContent = user.name.split(' ')[0];

  // Load data in parallel
  showLoading('Loading your dashboard...');
  try {
    const [bookings, savedPax, notifications] = await Promise.all([
      Service.getUserBookings(user.userId),
      Service.getSavedPassengers(user.userId),
      Service.getUserNotifications(user.userId)
    ]);

    State.allBookings = bookings;
    State.savedPassengers = savedPax;
    State.notifications = notifications;

    renderHomeStats();
    renderRecentBookings();
    renderHomeAlerts();
    loadProfileData();
    updateNotifBadge();
    updateBookingBadge();
    setGreeting();
  } catch (err) {
    console.error('Dashboard load error:', err);
  } finally {
    hideLoading();
  }

  navigateTo('home');
}

// ════════════════════════════════════════════════════════════════ NAVIGATION

window.navigateTo = (page) => {
  // Update pages
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const target = document.getElementById(`page-${page}`);
  if (target) target.classList.add('active');

  // Update nav items
  document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
  const navItem = document.getElementById(`nav-${page}`);
  if (navItem) navItem.classList.add('active');

  // Update breadcrumb
  const labels = {
    home: 'Home', search: 'Book Tickets', bookings: 'My Bookings',
    pnr: 'PNR Enquiry', profile: 'My Profile', passengers: 'Saved Passengers',
    tdr: 'TDR / Refunds', grievances: 'Grievances', alerts: 'Alerts'
  };
  document.getElementById('page-breadcrumb').textContent = labels[page] || page;

  // Lazy load page content
  switch (page) {
    case 'bookings': renderBookingsPage(); break;
    case 'passengers': renderPassengersPage(); break;
    case 'tdr': renderTDRPage(); break;
    case 'grievances': renderGrievancesPage(); break;
    case 'alerts': renderAlertsPage(); break;
    case 'search': resetBookingFlow(); break;
  }

  // Close sidebar on mobile
  if (window.innerWidth <= 768) {
    closeSidebar();
  }
};

window.toggleSidebar = () => {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebar-overlay');
  sidebar.classList.toggle('open');
  overlay.classList.toggle('hidden');
};

function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebar-overlay').classList.add('hidden');
}

// ════════════════════════════════════════════════════════════════ HOME PAGE

function renderHomeStats() {
  const confirmed = State.allBookings.filter(b => b.bookingStatus === 'CONFIRMED').length;
  const upcoming = State.allBookings.filter(b =>
    b.bookingStatus === 'CONFIRMED' && new Date(b.journeyDate) >= new Date()
  ).length;
  const unread = State.notifications.filter(n => !n.isRead).length;
  const totalSpent = State.allBookings
    .filter(b => b.bookingStatus === 'CONFIRMED')
    .reduce((sum, b) => sum + b.totalFare, 0);

  const stats = [
    { icon: 'ticket', label: 'Total Bookings', value: State.allBookings.length, colorClass: 'blue',
      svg: '<path fill-rule="evenodd" d="M4 4a2 2 0 00-2 2v1h16V6a2 2 0 00-2-2H4z"/><path fill-rule="evenodd" d="M18 9H2v5a2 2 0 002 2h12a2 2 0 002-2V9zM4 13a1 1 0 011-1h1a1 1 0 110 2H5a1 1 0 01-1-1zm5-1a1 1 0 100 2h1a1 1 0 100-2H9z" clip-rule="evenodd"/>' },
    { icon: 'upcoming', label: 'Upcoming Trips', value: upcoming, colorClass: 'green',
      svg: '<path fill-rule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clip-rule="evenodd"/>' },
    { icon: 'passengers', label: 'Saved Passengers', value: State.savedPassengers.length, colorClass: 'purple',
      svg: '<path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z"/>' },
    { icon: 'alerts', label: 'Unread Alerts', value: unread, colorClass: 'amber',
      svg: '<path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z"/>' }
  ];

  document.getElementById('home-stats').innerHTML = stats.map(s => `
    <div class="stat-card">
      <div class="stat-icon ${s.colorClass}">
        <svg viewBox="0 0 20 20" fill="currentColor">${s.svg}</svg>
      </div>
      <div class="stat-body">
        <div class="stat-value">${s.value}</div>
        <div class="stat-label-text">${s.label}</div>
      </div>
    </div>
  `).join('');
}

function renderRecentBookings() {
  const recent = State.allBookings.slice(0, 3);
  const container = document.getElementById('recent-bookings-list');

  if (!recent.length) {
    container.innerHTML = `<div class="empty-state"><div class="empty-icon">🎫</div><div class="empty-title">No bookings yet</div><div class="empty-sub">Book your first train ticket!</div></div>`;
    return;
  }

  container.innerHTML = recent.map(b => `
    <div class="booking-mini-card" onclick="navigateTo('bookings')">
      <div class="mini-card-header">
        <div class="mini-pnr">PNR: ${b.pnr}</div>
        <span class="status-badge ${b.bookingStatus}">${b.bookingStatus.replace('_', ' ')}</span>
      </div>
      <div class="mini-route">
        <div class="mini-station">${b.boardingStation?.stationCode || '—'}</div>
        <div class="mini-arrow">→</div>
        <div class="mini-station">${b.destinationStation?.stationCode || '—'}</div>
      </div>
      <div class="mini-train">${b.train?.trainName || 'N/A'}</div>
      <div class="mini-date">📅 ${formatDate(b.journeyDate)} | 🚃 ${b.classType}</div>
    </div>
  `).join('');
}

function renderHomeAlerts() {
  const userNotifs = State.notifications.slice(0, 3);
  const container = document.getElementById('home-alerts');

  if (!userNotifs.length) {
    container.innerHTML = `<div class="empty-state" style="padding:24px"><div class="empty-icon">🔔</div><p class="empty-sub">No alerts at the moment</p></div>`;
    return;
  }

  container.innerHTML = userNotifs.map(n => `
    <div class="alert-item ${n.type} ${n.isRead ? '' : 'unread'}">
      <div class="alert-icon">${getAlertIcon(n.type)}</div>
      <div class="alert-content">
        <div class="alert-title">${n.title}</div>
        <div class="alert-msg">${n.message}</div>
        <div class="alert-time">${timeAgo(n.createdAt)}</div>
      </div>
      ${!n.isRead ? '<div class="unread-dot"></div>' : ''}
    </div>
  `).join('');
}

function updateNotifBadge() {
  const unread = State.notifications.filter(n => !n.isRead).length;
  const dot = document.getElementById('notif-dot');
  const badge = document.getElementById('alerts-badge');
  if (dot) dot.style.display = unread ? 'block' : 'none';
  if (badge) {
    badge.textContent = unread;
    badge.classList.toggle('unread', unread > 0);
    badge.style.display = unread ? 'inline-flex' : 'none';
  }
}

function updateBookingBadge() {
  const active = State.allBookings.filter(b =>
    ['CONFIRMED', 'RAC', 'WAITING_LIST'].includes(b.bookingStatus)
  ).length;
  const badge = document.getElementById('booking-count-badge');
  if (badge) badge.textContent = active;
}

// ════════════════════════════════════════════════════════════════ QUICK SEARCH

window.swapQuickSearch = () => {
  const from = document.getElementById('qs-from');
  const to = document.getElementById('qs-to');
  [from.value, to.value] = [to.value, from.value];
};

window.goToSearch = () => {
  // Copy quick search values to search page
  document.getElementById('search-from').value = document.getElementById('qs-from').value;
  document.getElementById('search-to').value = document.getElementById('qs-to').value;
  document.getElementById('search-date').value = document.getElementById('qs-date').value;
  document.getElementById('search-class').value = document.getElementById('qs-class').value;
  navigateTo('search');
  // Auto-search
  setTimeout(() => handleSearchTrains(new Event('submit', {cancelable: true})), 100);
};

// ════════════════════════════════════════════════════════════════ BOOKING FLOW

function resetBookingFlow() {
  State.bookingFlow = {
    step: 1, searchParams: {}, searchResults: [], selectedTrain: null,
    selectedClass: null, selectedPassengers: [], holdToken: null, holdExpiry: null,
    holdTimerInterval: null, bookingId: null, pnr: null, totalFare: 0, fareBreakdown: {}
  };
  goToStep(1);
}

window.goToStep = (stepNum) => {
  // Hide all steps
  document.querySelectorAll('.booking-step').forEach(s => s.classList.remove('active'));
  const stepEl = document.getElementById(`booking-step-${stepNum}`);
  if (stepEl) stepEl.classList.add('active');

  // Update step indicators
  for (let i = 1; i <= 6; i++) {
    const indicator = document.getElementById(`step-${i}`);
    if (!indicator) continue;
    indicator.classList.remove('active', 'done');
    if (i < stepNum) indicator.classList.add('done');
    else if (i === stepNum) indicator.classList.add('active');
  }

  // Update connecting lines
  document.querySelectorAll('.step-line').forEach((line, idx) => {
    line.classList.toggle('done', idx < stepNum - 1);
  });

  State.bookingFlow.step = stepNum;

  if (stepNum === 3) { initPassengerStep(); }
  if (stepNum === 4) { initSummaryStep(); }
};

window.swapSearchStations = () => {
  const from = document.getElementById('search-from');
  const to = document.getElementById('search-to');
  [from.value, to.value] = [to.value, from.value];
};

window.handleSearchTrains = async (e) => {
  if (e && e.preventDefault) e.preventDefault();

  const fromId = parseInt(document.getElementById('search-from').value);
  const toId = parseInt(document.getElementById('search-to').value);
  const date = document.getElementById('search-date').value;
  const classType = document.getElementById('search-class').value;
  const quota = document.getElementById('search-quota').value;

  if (fromId === toId) {
    showToast('Source and destination cannot be the same', 'error');
    return;
  }

  if (!date) {
    showToast('Please select a journey date', 'error');
    return;
  }

  State.bookingFlow.searchParams = { fromId, toId, date, classType, quota };

  const btn = document.getElementById('search-trains-btn');
  btn.textContent = 'Searching...';
  btn.disabled = true;

  showLoading('Searching for available trains...');

  try {
    const results = await Service.searchTrains({
      sourceStationId: fromId,
      destinationStationId: toId,
      journeyDate: date,
      classType, quota
    });

    State.bookingFlow.searchResults = results;
    renderSearchResults(results);
    goToStep(2);
  } catch (err) {
    showToast('Failed to search trains. Please try again.', 'error');
  } finally {
    hideLoading();
    btn.textContent = 'Search Trains';
    btn.disabled = false;
  }
};

function renderSearchResults(results) {
  const { fromId, toId, date, quota } = State.bookingFlow.searchParams;
  const fromStation = State.stations.find(s => s.stationId === fromId);
  const toStation = State.stations.find(s => s.stationId === toId);

  document.getElementById('results-summary').innerHTML =
    `🔍 ${results.length} train(s) found: ${fromStation?.stationCode || '?'} → ${toStation?.stationCode || '?'} on ${formatDate(date)}`;

  const container = document.getElementById('train-results');

  if (!results.length) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🚂</div>
        <div class="empty-title">No trains found</div>
        <div class="empty-sub">Try different dates or stations</div>
      </div>`;
    return;
  }

  container.innerHTML = results.map(train => {
    const avail = train.availability || [];
    const days = ['MON','TUE','WED','THU','FRI','SAT','SUN'];

    const classChips = avail.map(a => {
      const available = a.availableSeats > 0;
      const racOnly = a.availableSeats === 0 && a.racCount > 0;
      const waitlist = a.availableSeats === 0 && a.racCount === 0;
      let availClass = 'green', availText = `${a.availableSeats} AVL`;
      if (racOnly) { availClass = 'amber'; availText = `RAC ${a.racCount}`; }
      if (waitlist) { availClass = 'red'; availText = `WL ${a.waitingListCount}`; }

      return `
        <div class="class-chip ${!available && !racOnly ? 'unavailable' : ''}"
             onclick="selectClassForTrain(${train.trainId}, '${a.classType}', this)">
          <div class="class-type">${a.classType}</div>
          <div class="class-avail ${availClass}">${availText}</div>
          <div class="class-fare">from ₹${getFareForClass(a.classType)}</div>
        </div>
      `;
    }).join('');

    const dayBadges = days.map(d => `
      <div class="day-badge ${train.runningDays?.includes(d) ? 'active-day' : ''}">${d[0]}</div>
    `).join('');

    return `
      <div class="train-result-card" id="train-card-${train.trainId}">
        <div class="train-card-header">
          <div class="train-name-section">
            <div class="train-number">Train No. ${train.trainNumber}</div>
            <div class="train-full-name">${train.trainName}</div>
          </div>
          <span class="train-type-badge ${train.trainType}">${train.trainType.replace('_', ' ')}</span>
        </div>

        <div class="train-timing">
          <div class="time-station">
            <div class="time-display">${getScheduleTime(train, 'departure')}</div>
            <div class="station-code">${fromStation?.stationCode || '?'}</div>
          </div>
          <div class="duration-section">
            <div class="duration-line">
              <div class="h-line"></div>
            </div>
            <div class="duration-text">${getDuration(train)}</div>
          </div>
          <div class="time-station">
            <div class="time-display">${getScheduleTime(train, 'arrival')}</div>
            <div class="station-code">${toStation?.stationCode || '?'}</div>
          </div>
        </div>

        <div class="classes-row">${classChips || '<span style="color:var(--clr-text-3);font-size:13px;">No availability data</span>'}</div>

        <div class="train-card-footer">
          <div class="running-days">${dayBadges}</div>
          <button class="btn-primary" onclick="proceedWithTrain(${train.trainId})">
            Book Now →
          </button>
        </div>
      </div>
    `;
  }).join('');
}

window.selectClassForTrain = (trainId, classType, el) => {
  // Deselect all in this card
  const card = document.getElementById(`train-card-${trainId}`);
  card.querySelectorAll('.class-chip').forEach(c => c.classList.remove('selected'));
  el.classList.add('selected');

  State.bookingFlow.selectedTrain = State.bookingFlow.searchResults.find(t => t.trainId === trainId);
  State.bookingFlow.selectedClass = classType;
};

window.proceedWithTrain = async (trainId) => {
  const train = State.bookingFlow.searchResults.find(t => t.trainId === trainId);
  if (!train) return;

  State.bookingFlow.selectedTrain = train;
  if (!State.bookingFlow.selectedClass && train.availability?.length) {
    State.bookingFlow.selectedClass = train.availability[0].classType;
  }

  // Initiate seat hold
  try {
    showLoading('Holding seats...');
    const hold = await Service.holdSeats({
      trainId,
      journeyDate: State.bookingFlow.searchParams.date,
      boardingStationId: State.bookingFlow.searchParams.fromId,
      destinationStationId: State.bookingFlow.searchParams.toId,
      classType: State.bookingFlow.selectedClass,
      quota: State.bookingFlow.searchParams.quota,
      passengerCount: 1
    });
    State.bookingFlow.holdToken = hold.holdToken;
    State.bookingFlow.holdExpiry = new Date(hold.expiresAt);
    hideLoading();
    goToStep(3);
  } catch (err) {
    hideLoading();
    showToast('Failed to hold seats. Please try again.', 'error');
  }
};

// Step 3 - Passenger Details
function initPassengerStep() {
  const container = document.getElementById('saved-pax-list');
  container.innerHTML = State.savedPassengers.map(p => `
    <label class="saved-pax-item">
      <input type="checkbox" class="pax-checkbox" value="${p.passengerId}" onchange="togglePassengerSelection(${p.passengerId}, this.checked)" />
      <div class="pax-avatar-sm">${getInitials(p.name)}</div>
      <div class="pax-name-info">
        <div class="pax-name-sm">${p.name}</div>
        <div class="pax-details-sm">${p.age} yrs | ${p.gender} | ${p.berthPreference} | ${p.concessionType !== 'NONE' ? p.concessionType : 'No concession'}</div>
      </div>
    </label>
  `).join('');

  renderSelectedJourneyInfo();
  startHoldTimer();
}

window.togglePassengerSelection = (passengerId, checked) => {
  if (checked) {
    const pax = State.savedPassengers.find(p => p.passengerId === passengerId);
    if (pax && !State.bookingFlow.selectedPassengers.find(p => p.passengerId === passengerId)) {
      State.bookingFlow.selectedPassengers.push(pax);
    }
  } else {
    State.bookingFlow.selectedPassengers = State.bookingFlow.selectedPassengers.filter(p => p.passengerId !== passengerId);
  }
};

window.addPassengerRow = () => {
  const container = document.getElementById('new-pax-forms');
  const formId = `new-pax-${Date.now()}`;
  container.insertAdjacentHTML('beforeend', `
    <div class="saved-pax-item" id="${formId}" style="flex-direction:column;align-items:stretch;gap:12px;cursor:default;">
      <div class="form-grid" style="margin:0;gap:12px;">
        <div class="form-group">
          <label class="form-label">Name *</label>
          <input type="text" class="form-input" id="${formId}-name" placeholder="Full Name" />
        </div>
        <div class="form-group">
          <label class="form-label">Age *</label>
          <input type="number" class="form-input" id="${formId}-age" min="1" max="120" />
        </div>
        <div class="form-group">
          <label class="form-label">Gender</label>
          <select class="form-select" id="${formId}-gender">
            <option value="MALE">Male</option>
            <option value="FEMALE">Female</option>
            <option value="OTHER">Other</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Berth Preference</label>
          <select class="form-select" id="${formId}-berth">
            <option value="LOWER">Lower</option>
            <option value="MIDDLE">Middle</option>
            <option value="UPPER">Upper</option>
            <option value="SIDE_LOWER">Side Lower</option>
          </select>
        </div>
      </div>
      <div style="display:flex;gap:8px;justify-content:flex-end;">
        <button type="button" class="btn-danger" onclick="document.getElementById('${formId}').remove()" style="padding:6px 12px;font-size:12px;">Remove</button>
        <button type="button" class="btn-primary" onclick="addNewPaxToSelection('${formId}')" style="padding:6px 14px;font-size:12px;">Add →</button>
      </div>
    </div>
  `);
};

window.addNewPaxToSelection = (formId) => {
  const name = document.getElementById(`${formId}-name`)?.value?.trim();
  const age = parseInt(document.getElementById(`${formId}-age`)?.value);
  if (!name || !age) { showToast('Please fill name and age', 'warning'); return; }

  State.bookingFlow.selectedPassengers.push({
    passengerId: null, name, age,
    gender: document.getElementById(`${formId}-gender`)?.value || 'MALE',
    berthPreference: document.getElementById(`${formId}-berth`)?.value || 'LOWER',
    idProofType: 'AADHAAR', idProofReference: 'XXXX-XXXX-0000',
    concessionType: 'NONE', disabilityType: 'NONE'
  });

  document.getElementById(formId).remove();
  showToast(`${name} added to booking`, 'success');
};

function renderSelectedJourneyInfo() {
  const { selectedTrain, selectedClass, searchParams } = State.bookingFlow;
  const fromStation = State.stations.find(s => s.stationId === searchParams.fromId);
  const toStation = State.stations.find(s => s.stationId === searchParams.toId);

  document.getElementById('selected-journey-info').innerHTML = `
    <div class="journey-info-grid">
      <div class="info-row">
        <div class="info-label">Train</div>
        <div class="info-value">${selectedTrain?.trainName || 'N/A'}</div>
      </div>
      <div class="info-row">
        <div class="info-label">Class</div>
        <div class="info-value">${selectedClass || 'N/A'}</div>
      </div>
      <div class="info-row">
        <div class="info-label">From</div>
        <div class="info-value">${fromStation?.stationCode || '?'}</div>
      </div>
      <div class="info-row">
        <div class="info-label">To</div>
        <div class="info-value">${toStation?.stationCode || '?'}</div>
      </div>
      <div class="info-row">
        <div class="info-label">Date</div>
        <div class="info-value">${formatDate(searchParams.date)}</div>
      </div>
      <div class="info-row">
        <div class="info-label">Quota</div>
        <div class="info-value">${searchParams.quota}</div>
      </div>
    </div>
  `;

  const timerEl = document.getElementById('hold-timer');
  if (timerEl) timerEl.classList.remove('hidden');
}

function startHoldTimer() {
  if (State.bookingFlow.holdTimerInterval) clearInterval(State.bookingFlow.holdTimerInterval);
  if (!State.bookingFlow.holdExpiry) return;

  const updateTimer = () => {
    const now = new Date();
    const diff = Math.max(0, State.bookingFlow.holdExpiry - now);
    const mins = Math.floor(diff / 60000);
    const secs = Math.floor((diff % 60000) / 1000);
    const text = `${mins.toString().padStart(2,'0')}:${secs.toString().padStart(2,'0')}`;
    ['hold-countdown', 'hold-countdown-4'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.textContent = text;
    });
    if (diff === 0) {
      clearInterval(State.bookingFlow.holdTimerInterval);
      showToast('Seat hold expired. Please start over.', 'error');
      goToStep(1);
    }
  };

  updateTimer();
  State.bookingFlow.holdTimerInterval = setInterval(updateTimer, 1000);
}

// Step 4 - Summary
function initSummaryStep() {
  const { selectedTrain, selectedClass, selectedPassengers, searchParams } = State.bookingFlow;
  if (!selectedTrain) return;

  const fromStation = State.stations.find(s => s.stationId === searchParams.fromId);
  const toStation = State.stations.find(s => s.stationId === searchParams.toId);

  // Journey summary card
  document.getElementById('summary-journey-card').innerHTML = `
    <div class="card-header"><h3>Journey Details</h3></div>
    <div class="train-timing" style="margin-bottom:0;">
      <div class="time-station">
        <div class="time-display">${getScheduleTime(selectedTrain, 'departure')}</div>
        <div class="station-code">${fromStation?.stationCode || '?'}</div>
        <div style="font-size:12px;color:var(--clr-text-2)">${fromStation?.stationName || ''}</div>
      </div>
      <div class="duration-section" style="flex:1;text-align:center;">
        <div class="duration-text">${getDuration(selectedTrain)}</div>
        <div class="h-line" style="margin:6px 0;"></div>
        <div style="font-size:12px;color:var(--clr-text-3)">${selectedTrain.trainName} | ${selectedClass}</div>
      </div>
      <div class="time-station">
        <div class="time-display">${getScheduleTime(selectedTrain, 'arrival')}</div>
        <div class="station-code">${toStation?.stationCode || '?'}</div>
        <div style="font-size:12px;color:var(--clr-text-2)">${toStation?.stationName || ''}</div>
      </div>
    </div>
  `;

  // Passengers card
  const paxRows = selectedPassengers.length
    ? selectedPassengers.map(p => `
        <tr style="border-bottom:1px solid var(--clr-border);">
          <td style="padding:10px 0;font-weight:600;">${p.name}</td>
          <td style="padding:10px;color:var(--clr-text-2);">${p.age} / ${p.gender}</td>
          <td style="padding:10px;color:var(--clr-text-2);">${p.berthPreference}</td>
          <td style="padding:10px;color:var(--clr-accent);">${p.concessionType !== 'NONE' ? p.concessionType : '—'}</td>
        </tr>
      `).join('')
    : `<tr><td colspan="4" style="padding:16px;color:var(--clr-text-3);text-align:center;">No passengers added. Please go back.</td></tr>`;

  document.getElementById('summary-passengers-card').innerHTML = `
    <div class="card-header"><h3>Passengers (${selectedPassengers.length})</h3></div>
    <table style="width:100%;border-collapse:collapse;">
      <thead>
        <tr style="border-bottom:2px solid var(--clr-border);">
          <th style="padding:8px 0;text-align:left;font-size:12px;color:var(--clr-text-3);">NAME</th>
          <th style="padding:8px;text-align:left;font-size:12px;color:var(--clr-text-3);">AGE / GENDER</th>
          <th style="padding:8px;text-align:left;font-size:12px;color:var(--clr-text-3);">BERTH</th>
          <th style="padding:8px;text-align:left;font-size:12px;color:var(--clr-text-3);">CONCESSION</th>
        </tr>
      </thead>
      <tbody>${paxRows}</tbody>
    </table>
  `;

  // Fare breakdown
  const route = selectedTrain.route || [];
  const fromStop = route.find(stop => stop.stationId === searchParams.fromId);
  const toStop = route.find(stop => stop.stationId === searchParams.toId);
  const journeyDistance = fromStop && toStop ? Math.max(0, toStop.distanceFromOrigin - fromStop.distanceFromOrigin) : 0;
  const classRatePerKm = { '1A': 3.04, '2A': 2.0, '3A': 1.34, SL: 0.48, CC: 1.58, EC: 2.77, '2S': 0.37 };
  const baseFare = Math.round(journeyDistance * (classRatePerKm[selectedClass] || 1) * Math.max(1, selectedPassengers.length) * 100) / 100;
  const reservationCharge = 80 * Math.max(1, selectedPassengers.length);
  const tatkalCharge = searchParams.quota === 'TATKAL' ? 400 * Math.max(1, selectedPassengers.length) : 0;
  const insurance = document.getElementById('pref-insurance')?.checked ? 1.5 * Math.max(1, selectedPassengers.length) : 0;
  const gst = ['1A', '2A', '3A', 'CC', 'EC'].includes(selectedClass)
    ? Math.round((baseFare + reservationCharge + tatkalCharge) * 0.05 * 100) / 100 : 0;
  const concessionDiscount = selectedPassengers.reduce((acc, p) => {
    if (p.concessionType === 'SENIOR_CITIZEN') return acc + baseFare * 0.40 / Math.max(1, selectedPassengers.length);
    if (p.concessionType === 'STUDENT') return acc + baseFare * 0.25 / Math.max(1, selectedPassengers.length);
    return acc;
  }, 0);
  const total = baseFare + reservationCharge + tatkalCharge + insurance + gst - concessionDiscount;

  State.bookingFlow.totalFare = total;
  State.bookingFlow.fareBreakdown = { baseFare, reservationCharge, tatkalCharge, insurance, gst, concessionDiscount };

  document.getElementById('fare-breakdown').innerHTML = `
    <div class="fare-row"><span class="fare-label">Base Fare</span><span class="fare-amount">₹${baseFare.toFixed(2)}</span></div>
    <div class="fare-row"><span class="fare-label">Reservation Charge</span><span class="fare-amount">₹${reservationCharge.toFixed(2)}</span></div>
    ${tatkalCharge ? `<div class="fare-row"><span class="fare-label">Tatkal Surcharge</span><span class="fare-amount">₹${tatkalCharge.toFixed(2)}</span></div>` : ''}
    ${insurance ? `<div class="fare-row"><span class="fare-label">Travel Insurance</span><span class="fare-amount">₹${insurance.toFixed(2)}</span></div>` : ''}
    <div class="fare-row"><span class="fare-label">GST (5%)</span><span class="fare-amount">₹${gst.toFixed(2)}</span></div>
    ${concessionDiscount ? `<div class="fare-row"><span class="fare-label">Concession Discount</span><span class="fare-amount fare-discount">-₹${concessionDiscount.toFixed(2)}</span></div>` : ''}
    <div class="fare-total">
      <span>Total Payable</span>
      <span class="fare-total-amount">₹${total.toFixed(2)}</span>
    </div>
  `;

  document.getElementById('payment-total-amount').textContent = `₹${total.toFixed(2)}`;
}

// Step 5 - Payment
window.processPaymentFlow = async () => {
  if (State.bookingFlow.selectedPassengers.length === 0) {
    showToast('Please add at least one passenger', 'error');
    goToStep(3);
    return;
  }

  const payMode = document.querySelector('input[name="paymentMode"]:checked')?.value || 'UPI';
  const btn = document.getElementById('pay-now-btn');
  btn.textContent = '⏳ Processing...';
  btn.disabled = true;

  showLoading('Processing your payment securely...');

  try {
    // Create booking first
    const booking = await Service.createBooking({
      holdToken: State.bookingFlow.holdToken,
      trainId: State.bookingFlow.selectedTrain?.trainId,
      userId: State.user.userId,
      journeyDate: State.bookingFlow.searchParams.date,
      boardingStationId: State.bookingFlow.searchParams.fromId,
      destinationStationId: State.bookingFlow.searchParams.toId,
      classType: State.bookingFlow.selectedClass,
      quota: State.bookingFlow.searchParams.quota,
      passengers: State.bookingFlow.selectedPassengers,
      preferences: {
        autoUpgrade: document.getElementById('pref-auto-upgrade')?.checked || false,
        bookOnlyIfConfirmed: document.getElementById('pref-confirmed-only')?.checked || false,
        preferredCoach: document.getElementById('pref-coach')?.value || null,
        travelInsurance: document.getElementById('pref-insurance')?.checked || false
      },
      totalFare: State.bookingFlow.totalFare,
      fareBreakdown: State.bookingFlow.fareBreakdown
    });

    // Process payment
    const payment = await Service.processPayment({
      bookingId: booking.bookingId,
      paymentMode: payMode,
      amount: State.bookingFlow.totalFare
    });

    State.bookingFlow.pnr = payment.booking.pnr;
    State.bookingFlow.bookingId = booking.bookingId;

    hideLoading();
    renderConfirmationPage(payment);
    goToStep(6);
    clearInterval(State.bookingFlow.holdTimerInterval);
    showToast('Booking confirmed successfully! 🎉', 'success');

    // Reload bookings
    Service.getUserBookings(State.user.userId).then(b => {
      State.allBookings = b;
      updateBookingBadge();
    });

  } catch (err) {
    hideLoading();
    Service.getUserBookings(State.user.userId).then(bookings => { State.allBookings = bookings; });
    showToast('Payment failed. Please try again.', 'error');
  } finally {
    btn.innerHTML = '<svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clip-rule="evenodd"/></svg> Pay Securely Now';
    btn.disabled = false;
  }
};

function renderConfirmationPage(payment) {
  const { selectedTrain, selectedClass, selectedPassengers, searchParams } = State.bookingFlow;
  const fromStation = State.stations.find(s => s.stationId === searchParams.fromId);
  const toStation = State.stations.find(s => s.stationId === searchParams.toId);
  const pnr = payment.booking.pnr;

  document.getElementById('e-ticket-card').innerHTML = `
    <div class="ticket-header">
      <h3>🚆 E-Ticket | PNR</h3>
      <div class="ticket-pnr">${pnr}</div>
    </div>
    <div class="ticket-body">
      <div class="ticket-route">
        <div class="ticket-station">
          <div class="tk-time">${getScheduleTime(selectedTrain, 'departure')}</div>
          <div class="tk-code">${fromStation?.stationCode || '?'}</div>
          <div class="tk-name">${fromStation?.stationName || ''}</div>
        </div>
        <div class="ticket-arrow">
          ──────── ${getDuration(selectedTrain)} ────────→
        </div>
        <div class="ticket-station">
          <div class="tk-time">${getScheduleTime(selectedTrain, 'arrival')}</div>
          <div class="tk-code">${toStation?.stationCode || '?'}</div>
          <div class="tk-name">${toStation?.stationName || ''}</div>
        </div>
      </div>
      <div class="ticket-meta">
        <div class="ticket-meta-item">
          <div class="tmeta-label">Train</div>
          <div class="tmeta-value">${selectedTrain?.trainNumber}</div>
        </div>
        <div class="ticket-meta-item">
          <div class="tmeta-label">Date</div>
          <div class="tmeta-value">${formatDate(searchParams.date)}</div>
        </div>
        <div class="ticket-meta-item">
          <div class="tmeta-label">Class</div>
          <div class="tmeta-value">${selectedClass}</div>
        </div>
        <div class="ticket-meta-item">
          <div class="tmeta-label">Status</div>
          <div class="tmeta-value" style="color:var(--clr-accent)">${payment.booking.bookingStatus.replace(/_/g, ' ')}</div>
        </div>
        <div class="ticket-meta-item">
          <div class="tmeta-label">Quota</div>
          <div class="tmeta-value">${searchParams.quota}</div>
        </div>
        <div class="ticket-meta-item">
          <div class="tmeta-label">Fare Paid</div>
          <div class="tmeta-value" style="color:var(--clr-primary)">₹${State.bookingFlow.totalFare.toFixed(2)}</div>
        </div>
      </div>
    </div>
    <div class="ticket-footer">
      <div class="ticket-passengers">
        ${(payment.booking.passengers || selectedPassengers).map((p, i) => `
          <div class="ticket-pax-row">
            <span class="ticket-pax-name">${p.name || selectedPassengers[i]?.name || '—'}</span>
            <span class="ticket-pax-berth">
              ${p.passengerStatus ? p.passengerStatus.replace(/_/g, ' ') : ''}${p.coachNumber ? ` · Coach ${p.coachNumber}` : ''} ${p.seatNumber ? `· Seat ${p.seatNumber}` : ''} ${p.berthType ? `· ${p.berthType}` : ''}
            </span>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

window.printTicket = () => window.print();

window.bookAnotherTicket = () => {
  resetBookingFlow();
  navigateTo('search');
};

// ════════════════════════════════════════════════════════════════ MY BOOKINGS

function renderBookingsPage() {
  renderFilteredBookings(State.allBookings);
}

window.filterBookings = (status, btn) => {
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');

  const filtered = status === 'all' ? State.allBookings
    : State.allBookings.filter(b => b.bookingStatus === status);
  renderFilteredBookings(filtered);
};

function renderFilteredBookings(bookings) {
  const container = document.getElementById('bookings-list');

  if (!bookings.length) {
    container.innerHTML = `<div class="empty-state"><div class="empty-icon">🎫</div><div class="empty-title">No bookings found</div><div class="empty-sub">Try a different filter</div></div>`;
    return;
  }

  container.innerHTML = bookings.map(b => {
    const canCancel = ['CONFIRMED', 'RAC', 'WAITING_LIST'].includes(b.bookingStatus);
    const canTDR = b.bookingStatus === 'CONFIRMED';

    return `
      <div class="booking-full-card">
        <div class="bfc-header">
          <div>
            <div class="bfc-pnr">PNR: ${b.pnr}</div>
            <div style="font-size:12px;color:var(--clr-text-3);margin-top:2px;">Booking ID: #${b.bookingId}</div>
          </div>
          <span class="status-badge ${b.bookingStatus}">${b.bookingStatus.replace(/_/g, ' ')}</span>
        </div>
        <div class="bfc-body">
          <div class="bfc-route">
            <div class="bfc-station">
              <div class="bfc-time">${b.boardingStation?.stationCode || '?'}</div>
              <div class="bfc-station-name">${b.boardingStation?.stationName || ''}</div>
            </div>
            <div style="padding:0 16px;color:var(--clr-text-3);font-size:20px;">→</div>
            <div class="bfc-station">
              <div class="bfc-time">${b.destinationStation?.stationCode || '?'}</div>
              <div class="bfc-station-name">${b.destinationStation?.stationName || ''}</div>
            </div>
          </div>
          <div class="bfc-mid" style="text-align:center;">
            <div class="bfc-train-name">🚂 ${b.train?.trainName || 'N/A'}</div>
            <div class="bfc-date">📅 ${formatDate(b.journeyDate)}</div>
            <div class="bfc-class">Class: ${b.classType} | ${b.quota}</div>
          </div>
          <div style="text-align:right;">
            <div class="bfc-fare-label">Total Fare</div>
            <div class="bfc-fare">₹${b.totalFare?.toFixed(2)}</div>
          </div>
        </div>
        <div class="bfc-footer">
          <button class="btn-secondary-sm" onclick="viewPNRDetails('${b.pnr}')">View Details</button>
          ${canCancel ? `<button class="btn-secondary-sm" style="color:var(--clr-danger);" onclick="openCancelModal('${b.pnr}', '${b.bookingId}')">Cancel</button>` : ''}
          ${canTDR ? `<button class="btn-secondary-sm" onclick="openTDRPrefill('${b.pnr}')">File TDR</button>` : ''}
        </div>
      </div>
    `;
  }).join('');
}

window.viewPNRDetails = (pnr) => {
  document.getElementById('pnr-input').value = pnr;
  navigateTo('pnr');
  setTimeout(() => searchPNR(), 100);
};

// ════════════════════════════════════════════════════════════════ PNR ENQUIRY

window.searchPNR = async () => {
  const pnr = document.getElementById('pnr-input').value.trim();
  if (!pnr || pnr.length < 10) {
    showToast('Please enter a valid 10-digit PNR', 'error');
    return;
  }

  showLoading('Fetching PNR details...');
  try {
    const result = await Service.enquirePNR(pnr);
    hideLoading();

    const container = document.getElementById('pnr-result');
    container.classList.remove('hidden');

    if (!result) {
      container.innerHTML = `
        <div class="card" style="text-align:center;padding:40px;">
          <div style="font-size:48px;margin-bottom:16px;">🔍</div>
          <h3 style="margin-bottom:8px;">PNR Not Found</h3>
          <p style="color:var(--clr-text-2);">No booking found for PNR: ${pnr}</p>
        </div>`;
      return;
    }

    const paxRows = result.passengers?.map(p => `
      <div style="display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid var(--clr-border);">
        <div>
          <div style="font-weight:600;">${p.passengerInfo?.name || p.name || 'Passenger'}</div>
          <div style="font-size:12px;color:var(--clr-text-2);">${p.passengerInfo?.age || p.age || '—'} yrs | ${p.passengerInfo?.gender || p.gender || '—'}</div>
        </div>
        <div style="text-align:right;">
          <span class="status-badge ${p.passengerStatus}">${p.passengerStatus.replace('_', ' ')}</span>
          <div style="font-size:12px;color:var(--clr-text-2);margin-top:4px;">
            ${p.coachNumber ? `${p.coachNumber} / ${p.seatNumber} / ${p.berthType}` : 'Seat not yet assigned'}
          </div>
        </div>
      </div>
    `).join('') || '';

    container.innerHTML = `
      <div class="booking-full-card">
        <div class="bfc-header">
          <div>
            <div class="bfc-pnr">PNR: ${result.pnr}</div>
            <div style="font-size:12px;color:var(--clr-text-3);">Booked on ${formatDate(result.createdAt?.split('T')[0])}</div>
          </div>
          <span class="status-badge ${result.bookingStatus}">${result.bookingStatus.replace(/_/g, ' ')}</span>
        </div>
        <div class="bfc-body">
          <div class="bfc-route">
            <div class="bfc-station">
              <div class="bfc-time">${result.boardingStation?.stationCode || '?'}</div>
              <div class="bfc-station-name">${result.boardingStation?.stationName || ''}</div>
            </div>
            <div style="padding:0 16px;font-size:20px;color:var(--clr-text-3);">→</div>
            <div class="bfc-station">
              <div class="bfc-time">${result.destinationStation?.stationCode || '?'}</div>
              <div class="bfc-station-name">${result.destinationStation?.stationName || ''}</div>
            </div>
          </div>
          <div class="bfc-mid">
            <div class="bfc-train-name">🚂 ${result.train?.trainName || 'N/A'}</div>
            <div class="bfc-date">📅 ${formatDate(result.journeyDate)} | ${result.classType} | ${result.quota}</div>
          </div>
          <div style="text-align:right;">
            <div class="bfc-fare-label">Total Fare</div>
            <div class="bfc-fare">₹${result.totalFare?.toFixed(2) || '—'}</div>
          </div>
        </div>
        <div style="padding:16px 20px;border-top:1px solid var(--clr-border);">
          <h4 style="font-size:14px;font-weight:600;margin-bottom:12px;">Passengers</h4>
          ${paxRows}
        </div>
      </div>
    `;
  } catch (err) {
    hideLoading();
    showToast('Failed to fetch PNR details', 'error');
  }
};

// ════════════════════════════════════════════════════════════════ PROFILE

function loadProfileData() {
  if (!State.user) return;
  document.getElementById('profile-name').value = State.user.name;
  document.getElementById('profile-email').value = State.user.email;
  document.getElementById('profile-phone').value = State.user.phone;
  document.getElementById('profile-since').value = formatDate(State.user.createdAt?.split('T')[0]);
  document.getElementById('profile-name-display').textContent = State.user.name;
}

window.updateProfile = async (e) => {
  e.preventDefault();
  showLoading('Saving changes...');
  try {
    State.user = await Service.updateProfile(State.user.userId, {
      name: document.getElementById('profile-name').value.trim(),
      phone: document.getElementById('profile-phone').value.trim()
    });
    sessionStorage.setItem('railconnect_user', JSON.stringify(State.user));
  } catch (error) {
    hideLoading();
    showToast('Could not save profile changes.', 'error');
    return;
  }
  hideLoading();
  document.getElementById('profile-name-display').textContent = State.user.name;
  document.getElementById('sidebar-name').textContent = State.user.name;
  document.getElementById('welcome-name').textContent = State.user.name.split(' ')[0];
  showToast('Profile updated successfully!', 'success');
};

// ════════════════════════════════════════════════════════════════ SAVED PASSENGERS

function renderPassengersPage() {
  const container = document.getElementById('passengers-grid');

  if (!State.savedPassengers.length) {
    container.innerHTML = `<div class="empty-state"><div class="empty-icon">👥</div><div class="empty-title">No saved passengers</div><div class="empty-sub">Add frequently travelling passengers for quick booking</div></div>`;
    return;
  }

  container.innerHTML = State.savedPassengers.map(p => `
    <div class="passenger-card">
      <div class="pax-card-header">
        <div class="pax-avatar">${getInitials(p.name)}</div>
        <div>
          <div class="pax-card-name">${p.name}</div>
          <div class="pax-card-sub">${p.age} yrs | ${p.gender}</div>
        </div>
      </div>
      <div class="pax-details">
        <div class="pax-detail-row">
          <span class="pax-detail-label">ID Proof</span>
          <span class="pax-detail-value">${p.idProofType}: ${p.idProofReference}</span>
        </div>
        <div class="pax-detail-row">
          <span class="pax-detail-label">Berth Pref.</span>
          <span class="pax-detail-value">${p.berthPreference}</span>
        </div>
        <div class="pax-detail-row">
          <span class="pax-detail-label">Concession</span>
          <span class="pax-detail-value">${p.concessionType !== 'NONE' ? p.concessionType : 'None'}</span>
        </div>
        ${p.disabilityType !== 'NONE' ? `
          <div class="pax-detail-row">
            <span class="pax-detail-label">Disability</span>
            <span class="pax-detail-value">${p.disabilityType}</span>
          </div>` : ''}
      </div>
      <div class="pax-card-footer">
        <button class="btn-secondary-sm" onclick="editPassenger(${p.passengerId})">Edit</button>
        <button class="btn-secondary-sm" style="color:var(--clr-danger);" onclick="deletePassenger(${p.passengerId})">Remove</button>
      </div>
    </div>
  `).join('');
}

let editingPassengerId = null;

window.openAddPassengerModal = () => {
  editingPassengerId = null;
  document.getElementById('passenger-modal-title').textContent = 'Add Passenger';
  document.getElementById('passenger-modal-submit').textContent = 'Save Passenger';
  document.querySelector('#modal-add-passenger form').reset();
  openModal('modal-add-passenger');
};

window.editPassenger = (id) => {
  const passenger = State.savedPassengers.find(item => item.passengerId === id);
  if (!passenger) return;
  editingPassengerId = id;
  document.getElementById('passenger-modal-title').textContent = 'Edit Passenger';
  document.getElementById('passenger-modal-submit').textContent = 'Save Changes';
  document.getElementById('modal-pax-name').value = passenger.name;
  document.getElementById('modal-pax-age').value = passenger.age;
  document.getElementById('modal-pax-gender').value = passenger.gender;
  document.getElementById('modal-pax-id-type').value = passenger.idProofType;
  document.getElementById('modal-pax-id-ref').value = passenger.idProofReference;
  document.getElementById('modal-pax-berth').value = passenger.berthPreference;
  document.getElementById('modal-pax-concession').value = passenger.concessionType;
  document.getElementById('modal-pax-disability').value = passenger.disabilityType;
  openModal('modal-add-passenger');
};

window.savePassenger = async (e) => {
  e.preventDefault();
  const newPax = {
    passengerId: editingPassengerId || Date.now(),
    userId: State.user.userId,
    name: document.getElementById('modal-pax-name').value.trim(),
    age: parseInt(document.getElementById('modal-pax-age').value),
    gender: document.getElementById('modal-pax-gender').value,
    idProofType: document.getElementById('modal-pax-id-type').value,
    idProofReference: document.getElementById('modal-pax-id-ref').value.trim(),
    disabilityType: document.getElementById('modal-pax-disability').value,
    concessionType: document.getElementById('modal-pax-concession').value,
    berthPreference: document.getElementById('modal-pax-berth').value
  };

  try {
    if (editingPassengerId) {
      const updated = await Service.updatePassenger(editingPassengerId, newPax);
      State.savedPassengers = State.savedPassengers.map(item => item.passengerId === editingPassengerId ? updated : item);
      showToast(`${updated.name} updated`, 'success');
    } else {
      const saved = await Service.savePassenger(newPax);
      State.savedPassengers.push(saved);
      showToast(`${saved.name} added to saved passengers`, 'success');
    }
    editingPassengerId = null;
    renderPassengersPage();
    closeModal('modal-add-passenger');
    e.target.reset();
  } catch (error) { showToast('Could not save passenger details.', 'error'); }
};

window.deletePassenger = async (id) => {
  await Service.deletePassenger(id);
  State.savedPassengers = State.savedPassengers.filter(p => p.passengerId !== id);
  renderPassengersPage();
  showToast('Passenger removed', 'success');
};

// ════════════════════════════════════════════════════════════════ TDR

async function renderTDRPage() {
  const container = document.getElementById('tdr-list');
  try {
    const tdrs = await Service.getUserTDRs(State.user.userId);

    if (!tdrs.length) {
      container.innerHTML = `<div class="empty-state"><div class="empty-icon">📋</div><div class="empty-title">No TDR requests</div><div class="empty-sub">File a TDR if you couldn't travel due to delays or cancellations</div></div>`;
      return;
    }

    container.innerHTML = tdrs.map(t => `
      <div class="tdr-card">
        <div>
          <div class="tdr-pnr">PNR: ${t.pnr}</div>
          <div class="tdr-reason">${t.reason.replace(/_/g, ' ')}</div>
          <div class="tdr-date">Filed: ${formatDate(t.submittedAt?.split('T')[0])}</div>
        </div>
        <div style="text-align:right;">
          <span class="status-badge ${t.status}">${t.status.replace('_', ' ')}</span>
          ${t.refundAmount ? `
            <div class="tdr-refund" style="margin-top:8px;">₹${t.refundAmount.toFixed(2)}</div>
            <div class="tdr-refund-label">Refund Amount</div>
          ` : '<div style="font-size:12px;color:var(--clr-text-3);margin-top:8px;">Under Review</div>'}
        </div>
      </div>
    `).join('');
  } catch (err) {
    container.innerHTML = `<div class="empty-state"><div class="empty-icon">⚠️</div><div class="empty-title">Failed to load TDR data</div></div>`;
  }
}

window.openFileTDRModal = () => openModal('modal-file-tdr');
window.openTDRPrefill = (pnr) => {
  document.getElementById('tdr-pnr').value = pnr;
  openModal('modal-file-tdr');
};

window.submitTDR = async (e) => {
  e.preventDefault();
  const pnr = document.getElementById('tdr-pnr').value.trim();
  const reason = document.getElementById('tdr-reason').value;

  if (!pnr || !reason) { showToast('Please fill all fields', 'error'); return; }

  showLoading('Filing TDR...');
  try {
    const booking = State.allBookings.find(item => item.pnr === pnr);
    if (!booking) throw new Error('BOOKING_NOT_FOUND');
    const result = await Service.fileTDR({ bookingId: booking.bookingId, pnr, reason });
    hideLoading();
    closeModal('modal-file-tdr');
    showToast(`TDR filed successfully! ID: ${result.tdrId}`, 'success');
    renderTDRPage();
    e.target.reset();
  } catch (err) {
    hideLoading();
    showToast('Failed to file TDR', 'error');
  }
};

// ════════════════════════════════════════════════════════════════ GRIEVANCES

async function renderGrievancesPage() {
  const container = document.getElementById('grievances-list');
  try {
    const grievances = await Service.getUserGrievances(State.user.userId);

    if (!grievances.length) {
      container.innerHTML = `<div class="empty-state"><div class="empty-icon">📝</div><div class="empty-title">No grievances filed</div><div class="empty-sub">Report issues for quick resolution</div></div>`;
      return;
    }

    container.innerHTML = grievances.map(g => `
      <div class="grievance-card">
        <div class="grievance-header">
          <span class="grievance-category">${g.category.replace(/_/g, ' ')}</span>
          <div style="display:flex;align-items:center;gap:10px;">
            <span class="status-badge ${g.status}">${g.status.replace('_', ' ')}</span>
            <span style="font-size:12px;color:var(--clr-text-3);">${timeAgo(g.createdAt)}</span>
          </div>
        </div>
        <div class="grievance-subject">${g.subject}</div>
        <div class="grievance-desc">${g.description}</div>
        ${g.response ? `
          <div class="grievance-response">
            <strong>Official Response:</strong>
            ${g.response}
          </div>` : ''}
      </div>
    `).join('');
  } catch (err) {
    container.innerHTML = `<div class="empty-state"><div class="empty-icon">⚠️</div><div class="empty-title">Failed to load grievances</div></div>`;
  }
}

window.openFileGrievanceModal = () => openModal('modal-file-grievance');

window.submitGrievance = async (e) => {
  e.preventDefault();
  showLoading('Filing complaint...');
  try {
    await Service.fileGrievance({
      userId: State.user.userId,
      category: document.getElementById('griev-category').value,
      subject: document.getElementById('griev-subject').value.trim(),
      description: document.getElementById('griev-desc').value.trim()
    });
    hideLoading();
    closeModal('modal-file-grievance');
    showToast('Complaint filed successfully!', 'success');
    renderGrievancesPage();
    e.target.reset();
  } catch (err) {
    hideLoading();
    showToast('Failed to file complaint', 'error');
  }
};

// ════════════════════════════════════════════════════════════════ ALERTS

function renderAlertsPage() {
  const container = document.getElementById('alerts-list');

  if (!State.notifications.length) {
    container.innerHTML = `<div class="empty-state"><div class="empty-icon">🔔</div><div class="empty-title">No notifications</div><div class="empty-sub">You're all caught up!</div></div>`;
    return;
  }

  container.innerHTML = State.notifications.map(n => `
    <div class="alert-item ${n.type} ${n.isRead ? '' : 'unread'}" id="alert-${n.notificationId}">
      <div class="alert-icon">${getAlertIcon(n.type)}</div>
      <div class="alert-content">
        <div class="alert-title">${n.title}</div>
        <div class="alert-msg">${n.message}</div>
        <div class="alert-time">${timeAgo(n.createdAt)}</div>
      </div>
      ${!n.isRead ? `
        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:8px;">
          <div class="unread-dot"></div>
          <button class="btn-secondary-sm" onclick="markRead(${n.notificationId})">Mark Read</button>
        </div>` : ''}
    </div>
  `).join('');
}

window.markRead = async (id) => {
  await Service.markNotificationRead(id);
  const notif = State.notifications.find(n => n.notificationId === id);
  if (notif) notif.isRead = true;
  renderAlertsPage();
  renderHomeAlerts();
  updateNotifBadge();
};

window.markAllRead = async () => {
  await Promise.all(State.notifications.filter(notification => !notification.isRead)
    .map(notification => Service.markNotificationRead(notification.notificationId)));
  State.notifications.forEach(n => n.isRead = true);
  renderAlertsPage();
  renderHomeAlerts();
  updateNotifBadge();
  showToast('All notifications marked as read', 'success');
};

// ════════════════════════════════════════════════════════════════ CANCEL BOOKING

let pendingCancelPNR = null;

window.openCancelModal = (pnr, bookingId) => {
  pendingCancelPNR = pnr;
  const booking = State.allBookings.find(b => b.pnr === pnr);
  if (!booking) return;

  document.getElementById('cancel-booking-info').innerHTML = `
    <div style="padding:12px;background:var(--clr-surface-2);border-radius:var(--radius-md);margin-bottom:12px;">
      <div style="font-weight:700;margin-bottom:4px;">PNR: ${pnr}</div>
      <div style="font-size:13px;color:var(--clr-text-2);">${booking.train?.trainName || 'N/A'} | ${formatDate(booking.journeyDate)}</div>
    </div>
  `;

  const charge = Math.min(120, Number(booking.totalFare) || 0);
  document.getElementById('cancel-charge').textContent = `₹${charge.toFixed(2)}`;
  document.getElementById('cancel-refund').textContent = `₹${Math.max(0, (Number(booking.totalFare) || 0) - charge).toFixed(2)}`;

  openModal('modal-cancel-booking');
};

window.confirmCancellation = async () => {
  if (!pendingCancelPNR) return;
  showLoading('Processing cancellation...');
  try {
    const result = await Service.cancelBooking(pendingCancelPNR);
    hideLoading();
    closeModal('modal-cancel-booking');
    showToast(`Cancellation processed! Refund: ₹${result.refundAmount}`, 'success');

    // Update local state
    const cancelledPNR = pendingCancelPNR;
    const booking = State.allBookings.find(b => b.pnr === cancelledPNR);
    if (booking) booking.bookingStatus = 'CANCELLED';
    pendingCancelPNR = null;
    renderBookingsPage();
    updateBookingBadge();
  } catch (err) {
    hideLoading();
    showToast('Cancellation failed. Please try again.', 'error');
  }
};

// ════════════════════════════════════════════════════════════════ MODAL HELPERS

window.openModal = (id) => {
  document.getElementById(id)?.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
};

window.closeModal = (id) => {
  document.getElementById(id)?.classList.add('hidden');
  document.body.style.overflow = '';
};

// Close on overlay click
document.querySelectorAll('.modal-overlay').forEach(overlay => {
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      overlay.classList.add('hidden');
      document.body.style.overflow = '';
    }
  });
});

// ════════════════════════════════════════════════════════════════ TOAST

window.showToast = (msg, type = 'success') => {
  const toast = document.getElementById('toast');
  const icon = document.getElementById('toast-icon');
  const message = document.getElementById('toast-message');

  const icons = { success: '✓', error: '✕', warning: '⚠' };
  icon.textContent = icons[type] || '✓';
  message.textContent = msg;

  toast.className = `toast ${type}`;
  toast.classList.remove('hidden');

  setTimeout(() => toast.classList.add('hidden'), 4000);
};

function showLoading(text = 'Loading...') {
  document.getElementById('loading-text').textContent = text;
  document.getElementById('loading-overlay').classList.remove('hidden');
}

function hideLoading() {
  document.getElementById('loading-overlay').classList.add('hidden');
}

// ════════════════════════════════════════════════════════════════ UTILITIES

function formatDate(dateStr) {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleDateString('en-IN', {
      weekday: 'short', day: 'numeric', month: 'short', year: 'numeric'
    });
  } catch { return dateStr; }
}

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const d = Math.floor(diff / 86400000);
  const h = Math.floor(diff / 3600000);
  const m = Math.floor(diff / 60000);
  if (d > 0) return `${d}d ago`;
  if (h > 0) return `${h}h ago`;
  if (m > 0) return `${m}m ago`;
  return 'Just now';
}

function getInitials(name) {
  return (name || '??').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

function getAlertIcon(type) {
  const icons = {
    BOOKING_CONFIRMATION: '🎫', DELAY: '⏱️', STATUS_UPDATE: '📊',
    EMERGENCY: '🚨', CANCELLATION: '❌'
  };
  return icons[type] || '🔔';
}

function getFareForClass(classType) {
  const fares = { '1A': 4200, '2A': 2750, '3A': 1850, 'SL': 650, 'CC': 1200, 'EC': 2100, '2S': 280 };
  return fares[classType] || 1000;
}

function getScheduleTime(train, type) {
  // Mock times based on train type
  const times = {
    RAJDHANI: { departure: '17:00', arrival: '08:32' },
    SHATABDI: { departure: '06:00', arrival: '13:30' },
    VANDE_BHARAT: { departure: '06:00', arrival: '14:00' },
    EXPRESS: { departure: '20:00', arrival: '09:45' }
  };
  return times[train?.trainType]?.[type] || '—:—';
}

function getDuration(train) {
  const durations = {
    RAJDHANI: '15h 32m', SHATABDI: '7h 30m',
    VANDE_BHARAT: '8h 00m', EXPRESS: '13h 45m'
  };
  return durations[train?.trainType] || 'N/A';
}
