/**
 * RailConnect – Passenger Portal Application
 * Main controller for all dashboard functionality.
 */

import * as Service from './services/apiService.js';

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
    try {
      const profile = await Service.getProfile();
      State.user = { ...JSON.parse(savedUser), ...profile };
      sessionStorage.setItem('railconnect_user', JSON.stringify(State.user));
      await enterDashboard();
    } catch (err) {
      if (err.status === 401 || err.code === 'UNAUTHORIZED') {
        sessionStorage.removeItem('railconnect_user');
        State.user = null;
        document.getElementById('public-home')?.classList.remove('hidden');
        document.getElementById('dashboard-container')?.classList.add('hidden');
      } else if (err.code === 'NETWORK_ERROR') {
        State.user = null;
        document.getElementById('public-home')?.classList.remove('hidden');
        document.getElementById('dashboard-container')?.classList.add('hidden');
        showToast(err.message, 'error');
      } else {
        sessionStorage.removeItem('railconnect_user');
        State.user = null;
        document.getElementById('public-home')?.classList.remove('hidden');
        document.getElementById('dashboard-container')?.classList.add('hidden');
      }
    }
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
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const today = `${y}-${m}-${d}`;

  const maxD = new Date(y, now.getMonth(), now.getDate() + 7);
  const maxY = maxD.getFullYear();
  const maxM = String(maxD.getMonth() + 1).padStart(2, '0');
  const maxDay = String(maxD.getDate()).padStart(2, '0');
  const maxDate = `${maxY}-${maxM}-${maxDay}`;

  ['qs-date', 'search-date', 'public-date', 'public-track-date', 'connect-date'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.value = today;
      el.min = today;
      el.max = maxDate;
    }
  });
}

// ════════════════════════════════════════════════════════════════ STATIONS
async function populateStationDropdowns() {
  try {
    State.stations = await Service.getStations();
    const stationOptions = State.stations.map(s =>
      `<option value="${s.stationId}">${s.stationCode} – ${s.stationName} (${s.city})</option>`
    ).join('');

    const fromDropdownIds = ['qs-from', 'search-from', 'public-from', 'connect-from'];
    const toDropdownIds = ['qs-to', 'search-to', 'public-to', 'connect-to'];

    [...fromDropdownIds, ...toDropdownIds].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.innerHTML = stationOptions;
    });

    // Set default selections by stationCode: 'BCT' (Mumbai Central) and 'NDLS' (New Delhi)
    const bct = State.stations.find(s => s.stationCode === 'BCT');
    const ndls = State.stations.find(s => s.stationCode === 'NDLS');

    if (bct) {
      fromDropdownIds.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = String(bct.stationId);
      });
    }
    if (ndls) {
      toDropdownIds.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = String(ndls.stationId);
      });
    }
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
    const options = trains
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
    if (!booking) { container.innerHTML = `<p>No booking was found for PNR ${pnr}.</p>`; return; }
    const trainDisplay = booking.trainName || (booking.trainNumber ? `Train ${booking.trainNumber}` : (booking.train?.trainName || 'N/A'));
    const passengersHtml = Array.isArray(booking.passengers)
      ? booking.passengers.map(p => {
          const seatInfo = p.coachNumber ? ` · ${p.coachNumber}/${p.seatNumber} (${p.berthType})` : '';
          const status = (p.status || p.passengerStatus || booking.bookingStatus || '').replace(/_/g, ' ');
          return `<span>${p.name || p.passengerInfo?.name || 'Passenger'} · ${status}${seatInfo}</span>`;
        }).join('')
      : '';

    container.innerHTML = `
      <div class="public-pnr-card">
        <div>
          <small>PNR ${booking.pnr}</small>
          <strong>${(booking.bookingStatus || '').replace(/_/g, ' ')}</strong>
        </div>
        <p>${booking.trainNumber ? `${booking.trainNumber} · ` : ''}${trainDisplay}</p>
        <p>${booking.boardingStation?.stationCode || '—'} → ${booking.destinationStation?.stationCode || '—'} · ${formatDate(booking.journeyDate)}</p>
        <div class="pnr-passenger-status">${passengersHtml}</div>
      </div>
    `;
  } catch (error) {
    if (error?.code === 'NOT_FOUND' || error?.status === 404) {
      container.innerHTML = `<p>No booking was found for PNR ${pnr}.</p>`;
    } else {
      container.innerHTML = `<p>${error?.message || 'PNR lookup failed. Please try again.'}</p>`;
    }
  }
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
    const msg =
      err?.code === 'UNAUTHORIZED' ? 'Invalid email or password. Please try again.' :
      err?.code === 'FORBIDDEN' ? 'Your account is suspended. Contact support.' :
      (err?.code === 'CONFLICT' || err?.code === 'VALIDATION_ERROR' || err?.code === 'NETWORK_ERROR') ? err.message :
      'Invalid email or password. Please try again.';
    showToast(msg, 'error');
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
    const msg =
      err?.code === 'UNAUTHORIZED' ? 'Invalid email or password. Please try again.' :
      err?.code === 'FORBIDDEN' ? 'Your account is suspended. Contact support.' :
      (err?.code === 'CONFLICT' || err?.code === 'VALIDATION_ERROR' || err?.code === 'NETWORK_ERROR') ? err.message :
      'Registration failed.';
    showToast(msg, 'error');
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
      Service.getUserBookings().catch(err => {
        console.error('Failed to load user bookings:', err);
        return [];
      }),
      Service.getSavedPassengers(user.userId).catch(() => []),
      Service.getUserNotifications(user.userId).catch(() => [])
    ]);

    State.allBookings = Array.isArray(bookings) ? bookings : [];
    State.savedPassengers = Array.isArray(savedPax) ? savedPax : [];
    State.notifications = Array.isArray(notifications) ? notifications : [];

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
  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const upcoming = State.allBookings.filter(b =>
    b.bookingStatus === 'CONFIRMED' && (b.journeyDate >= todayStr)
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

  container.innerHTML = recent.map(b => {
    const trainDisplayName = b.trainName || (b.trainNumber ? `Train ${b.trainNumber}` : (b.train?.trainName || 'N/A'));
    return `
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
      <div class="mini-train">${trainDisplayName}</div>
      <div class="mini-date">📅 ${formatDate(b.journeyDate)} | 🚃 ${b.classType}</div>
    </div>
  `;
  }).join('');
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

      const fareAmount = a.estimatedTotalFare != null ? a.estimatedTotalFare : (a.baseFare != null ? a.baseFare : 0);

      return `
        <div class="class-chip ${!available && !racOnly ? 'unavailable' : ''}"
             onclick="selectClassForTrain(${train.trainId}, '${a.classType}', this)">
          <div class="class-type">${a.classType}</div>
          <div class="class-avail ${availClass}">${availText}</div>
          <div class="class-fare">from ₹${fareAmount}</div>
        </div>
      `;
    }).join('');

    const dayBadges = days.map(d => `
      <div class="day-badge ${train.runningDays?.includes(d) ? 'active-day' : ''}">${d[0]}</div>
    `).join('');

    const departureDisplay = train.departureTime || '—';
    const arrivalDisplay = train.arrivalTime || '—';
    const durationDisplay = train.duration || '—';

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
            <div class="time-display">${departureDisplay}</div>
            <div class="station-code">${fromStation?.stationCode || '?'}</div>
          </div>
          <div class="duration-section">
            <div class="duration-line">
              <div class="h-line"></div>
            </div>
            <div class="duration-text">${durationDisplay}</div>
          </div>
          <div class="time-station">
            <div class="time-display">${arrivalDisplay}</div>
            <div class="station-code">${toStation?.stationCode || '?'}</div>
          </div>
        </div>

        <div class="classes-row">${classChips || '<span style="color:var(--clr-text-3);font-size:13px;">No availability data</span>'}</div>
        <div class="fallback-notice-msg" style="display:none; font-size:12px; color:var(--clr-accent-2); margin-top:8px; padding:6px 10px; background:rgba(255,184,0,0.1); border-radius:4px;"></div>

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

window.selectClassForTrain = async (trainId, classType, el) => {
  // Deselect all in this card
  const card = document.getElementById(`train-card-${trainId}`);
  if (card) {
    card.querySelectorAll('.class-chip').forEach(c => c.classList.remove('selected'));
  }
  el.classList.add('selected');

  State.bookingFlow.selectedTrain = State.bookingFlow.searchResults.find(t => t.trainId === trainId);
  State.bookingFlow.selectedClass = classType;

  // Step 9: Call real getAvailability
  const journeyDate = State.bookingFlow.searchParams?.date;
  const quota = State.bookingFlow.searchParams?.quota || 'GENERAL';

  try {
    const availReply = await Service.getAvailability(trainId, journeyDate, classType, quota, 1);
    if (availReply) {
      const seats = availReply.availableSeats ?? 0;
      const rac = availReply.racCount ?? 0;
      const wl = availReply.waitingListCount ?? 0;

      const availEl = el.querySelector('.class-avail');
      if (availEl) {
        let availClass = 'green', availText = `${seats} AVL`;
        if (seats === 0 && rac > 0) { availClass = 'amber'; availText = `RAC ${rac}`; }
        else if (seats === 0 && rac === 0) { availClass = 'red'; availText = `WL ${wl}`; }
        availEl.className = `class-avail ${availClass}`;
        availEl.textContent = availText;
      }

      if (availReply.fallbackOffered && availReply.fallbackNotice) {
        showToast(availReply.fallbackNotice, 'info');
        const noticeEl = card?.querySelector('.fallback-notice-msg');
        if (noticeEl) {
          noticeEl.textContent = availReply.fallbackNotice;
          noticeEl.style.display = 'block';
        }
      } else {
        const noticeEl = card?.querySelector('.fallback-notice-msg');
        if (noticeEl) {
          noticeEl.textContent = '';
          noticeEl.style.display = 'none';
        }
      }
    }
  } catch (err) {
    showToast(err?.message || 'Failed to check class availability.', 'error');
  }
};

window.proceedWithTrain = async (trainId) => {
  const train = State.bookingFlow.searchResults.find(t => t.trainId === trainId);
  if (!train) return;

  State.bookingFlow.selectedTrain = train;
  if (!State.bookingFlow.selectedClass && train.availability?.length) {
    State.bookingFlow.selectedClass = train.availability[0].classType;
  }

  // Clear any existing hold token or timer from previous attempts
  if (State.bookingFlow.holdTimerInterval) {
    clearInterval(State.bookingFlow.holdTimerInterval);
    State.bookingFlow.holdTimerInterval = null;
  }
  State.bookingFlow.holdToken = null;
  State.bookingFlow.holdExpiry = null;
  State.bookingFlow.secondsRemaining = 0;
  State.bookingFlow.pnr = null;

  goToStep(3);
};

// Step 3 - Passenger Details
function initPassengerStep() {
  const container = document.getElementById('saved-pax-list');
  if (container) {
    if (!State.savedPassengers || State.savedPassengers.length === 0) {
      container.innerHTML = '<div style="color:var(--clr-text-3);font-size:13px;padding:8px 0;">No saved passengers found. Use the "+ Add New" button above to add passengers for this trip.</div>';
    } else {
      container.innerHTML = State.savedPassengers.map(p => {
        const isChecked = State.bookingFlow.selectedPassengers.some(sp => sp.passengerId === p.passengerId || (sp.name === p.name && sp.age === p.age));
        return `
          <label class="saved-pax-item">
            <input type="checkbox" class="pax-checkbox" value="${p.passengerId}" ${isChecked ? 'checked' : ''} onchange="togglePassengerSelection(${p.passengerId}, this.checked)" />
            <div class="pax-avatar-sm">${getInitials(p.name)}</div>
            <div class="pax-name-info">
              <div class="pax-name-sm">${p.name}</div>
              <div class="pax-details-sm">${p.age} yrs | ${p.gender} | ${p.berthPreference || 'NO_BERTH'} | ${p.concessionType !== 'NONE' ? p.concessionType : 'No concession'}</div>
            </div>
          </label>
        `;
      }).join('');
    }
  }

  // Toggle ladies fallback consent visibility if LADIES quota selected
  const fallbackContainer = document.getElementById('fallback-consent-container');
  if (fallbackContainer) {
    const isLadies = (State.bookingFlow.searchParams?.quota === 'LADIES');
    fallbackContainer.style.display = isLadies ? 'flex' : 'none';
  }

  renderSelectedJourneyInfo();
}

window.togglePassengerSelection = (passengerId, checked) => {
  if (checked) {
    const maxPax = State.bookingFlow.searchParams?.quota === 'TATKAL' ? 4 : 6;
    if (State.bookingFlow.selectedPassengers.length >= maxPax) {
      showToast(`Maximum ${maxPax} passengers allowed per booking`, 'warning');
      const chk = document.querySelector(`input.pax-checkbox[value="${passengerId}"]`);
      if (chk) chk.checked = false;
      return;
    }
    const pax = State.savedPassengers.find(p => p.passengerId === passengerId);
    if (pax && !State.bookingFlow.selectedPassengers.find(p => p.passengerId === passengerId)) {
      State.bookingFlow.selectedPassengers.push({
        passengerId: pax.passengerId,
        name: pax.name,
        age: Number(pax.age),
        gender: pax.gender,
        berthPreference: pax.berthPreference || 'NO_BERTH',
        idProofType: pax.idProofType || 'AADHAAR',
        idProofReference: pax.idProofReference || 'XXXX-XXXX-0000',
        concessionType: pax.concessionType || 'NONE',
        disabilityType: pax.disabilityType || 'NONE'
      });
      // Invalidate existing hold on passenger change so fresh hold is acquired for summary
      State.bookingFlow.pnr = null;
    }
  } else {
    State.bookingFlow.selectedPassengers = State.bookingFlow.selectedPassengers.filter(p => p.passengerId !== passengerId);
    State.bookingFlow.pnr = null;
  }
};

window.addPassengerRow = () => {
  const maxPax = State.bookingFlow.searchParams?.quota === 'TATKAL' ? 4 : 6;
  if (State.bookingFlow.selectedPassengers.length >= maxPax) {
    showToast(`Maximum ${maxPax} passengers allowed per booking (${State.bookingFlow.searchParams?.quota || 'GENERAL'} quota)`, 'warning');
    return;
  }

  const container = document.getElementById('new-pax-forms');
  const formId = `new-pax-${Date.now()}`;
  container.insertAdjacentHTML('beforeend', `
    <div class="saved-pax-item" id="${formId}" style="flex-direction:column;align-items:stretch;gap:12px;cursor:default;margin-bottom:12px;">
      <div class="form-grid" style="margin:0;gap:12px;">
        <div class="form-group">
          <label class="form-label">Full Name *</label>
          <input type="text" class="form-input" id="${formId}-name" placeholder="As shown on ID proof" />
        </div>
        <div class="form-group">
          <label class="form-label">Age *</label>
          <input type="number" class="form-input" id="${formId}-age" min="1" max="120" placeholder="Years" />
        </div>
        <div class="form-group">
          <label class="form-label">Gender *</label>
          <select class="form-select" id="${formId}-gender">
            <option value="MALE">Male</option>
            <option value="FEMALE">Female</option>
            <option value="OTHER">Other</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Berth Preference</label>
          <select class="form-select" id="${formId}-berth">
            <option value="NO_BERTH">No Preference</option>
            <option value="LOWER">Lower</option>
            <option value="MIDDLE">Middle</option>
            <option value="UPPER">Upper</option>
            <option value="SIDE_LOWER">Side Lower</option>
            <option value="SIDE_UPPER">Side Upper</option>
            <option value="WINDOW">Window</option>
            <option value="AISLE">Aisle</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">ID Proof Type *</label>
          <select class="form-select" id="${formId}-id-type">
            <option value="AADHAAR">Aadhaar Card</option>
            <option value="PAN">PAN Card</option>
            <option value="PASSPORT">Passport</option>
            <option value="DRIVING_LICENSE">Driving License</option>
            <option value="VOTER_ID">Voter ID</option>
            <option value="GOVT_ID">Government ID</option>
            <option value="SYNTHETIC_TEST_ID">Synthetic Test ID</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">ID Reference / Number *</label>
          <input type="text" class="form-input" id="${formId}-id-ref" placeholder="ID document number" />
        </div>
        <div class="form-group">
          <label class="form-label">Concession Category</label>
          <select class="form-select" id="${formId}-concession">
            <option value="NONE">None</option>
            <option value="SENIOR_CITIZEN">Senior Citizen</option>
            <option value="STUDENT">Student</option>
            <option value="DIVYAANG">Divyaang</option>
            <option value="DEFENCE">Defence</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Disability Type (if Divyaang)</label>
          <select class="form-select" id="${formId}-disability">
            <option value="NONE">None</option>
            <option value="ORTHOPEDIC">Orthopedic</option>
            <option value="VISUAL">Visual</option>
            <option value="HEARING">Hearing</option>
          </select>
        </div>
      </div>
      <div style="display:flex;gap:8px;justify-content:flex-end;">
        <button type="button" class="btn-danger" onclick="document.getElementById('${formId}').remove()" style="padding:6px 12px;font-size:12px;">Remove</button>
        <button type="button" class="btn-primary" onclick="addNewPaxToSelection('${formId}')" style="padding:6px 14px;font-size:12px;">Add Passenger →</button>
      </div>
    </div>
  `);
};

window.addNewPaxToSelection = (formId) => {
  const name = document.getElementById(`${formId}-name`)?.value?.trim();
  const age = parseInt(document.getElementById(`${formId}-age`)?.value, 10);
  const idRef = document.getElementById(`${formId}-id-ref`)?.value?.trim();

  if (!name || name.length < 2) {
    showToast('Please enter a valid passenger name (at least 2 characters)', 'warning');
    return;
  }
  if (!age || isNaN(age) || age < 1 || age > 120) {
    showToast('Please enter a valid passenger age between 1 and 120', 'warning');
    return;
  }
  if (!idRef) {
    showToast('Please enter an ID proof reference number', 'warning');
    return;
  }

  const gender = document.getElementById(`${formId}-gender`)?.value || 'MALE';
  const berthPreference = document.getElementById(`${formId}-berth`)?.value || 'NO_BERTH';
  const idProofType = document.getElementById(`${formId}-id-type`)?.value || 'AADHAAR';
  const concessionType = document.getElementById(`${formId}-concession`)?.value || 'NONE';
  const disabilityType = document.getElementById(`${formId}-disability`)?.value || 'NONE';

  if (concessionType === 'DIVYAANG' && disabilityType === 'NONE') {
    showToast('Please select a specific disability type for Divyaang concession', 'warning');
    return;
  }

  const maxPax = State.bookingFlow.searchParams?.quota === 'TATKAL' ? 4 : 6;
  if (State.bookingFlow.selectedPassengers.length >= maxPax) {
    showToast(`Maximum ${maxPax} passengers allowed per booking`, 'warning');
    return;
  }

  State.bookingFlow.selectedPassengers.push({
    passengerId: null,
    name,
    age,
    gender,
    berthPreference,
    idProofType,
    idProofReference: idRef,
    concessionType,
    disabilityType
  });

  // Invalidate existing hold on passenger changes so fresh hold is acquired for summary
  State.bookingFlow.pnr = null;

  document.getElementById(formId)?.remove();
  showToast(`${name} added to booking list (${State.bookingFlow.selectedPassengers.length}/${maxPax})`, 'success');
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
}

function startHoldTimer(initialSeconds) {
  if (State.bookingFlow.holdTimerInterval) {
    clearInterval(State.bookingFlow.holdTimerInterval);
    State.bookingFlow.holdTimerInterval = null;
  }

  let remaining = typeof initialSeconds === 'number' ? initialSeconds : (State.bookingFlow.secondsRemaining || 0);
  if (remaining <= 0) return;

  const renderTimerText = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    const text = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    ['hold-countdown', 'hold-countdown-4'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.textContent = text;
    });
    const timerBox = document.getElementById('hold-timer');
    if (timerBox) timerBox.classList.remove('hidden');
    const timerBox4 = document.getElementById('hold-timer-4');
    if (timerBox4) timerBox4.classList.remove('hidden');
  };

  renderTimerText(remaining);

  State.bookingFlow.holdTimerInterval = setInterval(() => {
    remaining -= 1;
    State.bookingFlow.secondsRemaining = remaining;
    if (remaining <= 0) {
      clearInterval(State.bookingFlow.holdTimerInterval);
      State.bookingFlow.holdTimerInterval = null;
      renderTimerText(0);
      showToast('Seat hold expired. Please reselect your journey and passengers.', 'error');
      const payBtn = document.getElementById('pay-now-btn');
      if (payBtn) payBtn.disabled = true;
    } else {
      renderTimerText(remaining);
    }
  }, 1000);
}

// Step 4 - Summary
async function initSummaryStep() {
  const { selectedTrain, selectedClass, selectedPassengers, searchParams } = State.bookingFlow;
  if (!selectedTrain) return;

  const fromStation = State.stations.find(s => s.stationId === searchParams.fromId);
  const toStation = State.stations.find(s => s.stationId === searchParams.toId);

  // Validate passenger requirements
  if (!selectedPassengers || selectedPassengers.length === 0) {
    showToast('Please select or add at least one passenger before proceeding', 'error');
    goToStep(3);
    return;
  }

  const maxPax = searchParams.quota === 'TATKAL' ? 4 : 6;
  if (selectedPassengers.length > maxPax) {
    showToast(`Maximum ${maxPax} passengers allowed per booking (${searchParams.quota || 'GENERAL'} quota)`, 'error');
    goToStep(3);
    return;
  }

  const hasAdult = selectedPassengers.some(p => Number(p.age) >= 18);
  if (!hasAdult) {
    showToast('At least one adult passenger (18 years or older) is required per booking', 'error');
    goToStep(3);
    return;
  }

  // Render static details first
  document.getElementById('summary-journey-card').innerHTML = `
    <div class="card-header"><h3>Journey Details</h3></div>
    <div class="train-timing" style="margin-bottom:0;">
      <div class="time-station">
        <div class="time-display">${selectedTrain.departureTime || '—'}</div>
        <div class="station-code">${fromStation?.stationCode || '?'}</div>
        <div style="font-size:12px;color:var(--clr-text-2)">${fromStation?.stationName || ''}</div>
      </div>
      <div class="duration-section" style="flex:1;text-align:center;">
        <div class="duration-text">${selectedTrain.duration || '—'}</div>
        <div class="h-line" style="margin:6px 0;"></div>
        <div style="font-size:12px;color:var(--clr-text-3)">${selectedTrain.trainName} | ${selectedClass}</div>
      </div>
      <div class="time-station">
        <div class="time-display">${selectedTrain.arrivalTime || '—'}</div>
        <div class="station-code">${toStation?.stationCode || '?'}</div>
        <div style="font-size:12px;color:var(--clr-text-2)">${toStation?.stationName || ''}</div>
      </div>
    </div>
  `;

  const paxRows = selectedPassengers.map(p => `
    <tr style="border-bottom:1px solid var(--clr-border);">
      <td style="padding:10px 0;font-weight:600;">${p.name}</td>
      <td style="padding:10px;color:var(--clr-text-2);">${p.age} / ${p.gender}</td>
      <td style="padding:10px;color:var(--clr-text-2);">${p.berthPreference || 'NO_BERTH'}</td>
      <td style="padding:10px;color:var(--clr-accent);">${p.concessionType !== 'NONE' ? p.concessionType : '—'}</td>
    </tr>
  `).join('');

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

  // If a booking hold has not yet been initiated for this passenger set, call real createBooking to hold seats
  if (!State.bookingFlow.pnr) {
    showLoading('Reserving seats & calculating authoritative fare...');
    try {
      const fallbackConsent = document.getElementById('pref-fallback-consent')?.checked || false;
      const berthCondition = document.getElementById('pref-berth-condition')?.checked || false;
      const autoUpgrade = document.getElementById('pref-auto-upgrade')?.checked || false;
      const bookOnlyIfConfirmed = document.getElementById('pref-confirmed-only')?.checked || false;
      const preferredCoach = document.getElementById('pref-coach')?.value?.trim() || null;
      const travelInsurance = document.getElementById('pref-insurance')?.checked || false;

      const bookingPayload = {
        trainId: selectedTrain.trainId,
        journeyDate: searchParams.date,
        boardingStationId: searchParams.fromId,
        destinationStationId: searchParams.toId,
        classType: selectedClass,
        quota: searchParams.quota || 'GENERAL',
        requestedQuota: searchParams.quota || 'GENERAL',
        continueWithGeneralQuota: fallbackConsent,
        passengers: selectedPassengers.map(p => ({
          name: p.name,
          age: Number(p.age),
          gender: p.gender,
          berthPreference: p.berthPreference || 'NO_BERTH',
          idProofType: p.idProofType || 'AADHAAR',
          idProofReference: p.idProofReference || 'XXXX-XXXX-0000',
          concessionType: p.concessionType || 'NONE',
          disabilityType: p.disabilityType || 'NONE'
        })),
        preferences: {
          autoUpgrade,
          bookOnlyIfConfirmed,
          berthCondition,
          preferredCoach,
          travelInsurance
        }
      };

      const bookingRes = await Service.createBooking(bookingPayload);
      State.bookingFlow.pnr = bookingRes.pnr;
      State.bookingFlow.bookingStatus = bookingRes.bookingStatus;
      State.bookingFlow.projectedStatus = bookingRes.projectedStatus;
      State.bookingFlow.totalFare = Number(bookingRes.totalFare);
      State.bookingFlow.fareBreakdown = bookingRes.fareBreakdown || [];
      State.bookingFlow.secondsRemaining = Number(bookingRes.secondsRemaining) || 600;

      startHoldTimer(State.bookingFlow.secondsRemaining);
      showToast(`Seats reserved on hold! PNR: ${bookingRes.pnr}`, 'info');
    } catch (err) {
      hideLoading();
      showToast(err?.message || 'Failed to reserve seats. Please retry.', 'error');
      goToStep(3);
      return;
    } finally {
      hideLoading();
    }
  }

  // Render server-authoritative fare breakdown
  renderServerFareBreakdown();
}

function renderServerFareBreakdown() {
  const breakdownList = Array.isArray(State.bookingFlow.fareBreakdown) ? State.bookingFlow.fareBreakdown : [];
  const total = State.bookingFlow.totalFare || 0;

  let sumBase = 0, sumReservation = 0, sumSuperfast = 0, sumTatkal = 0, sumDynamic = 0, sumGst = 0, sumInsurance = 0, sumDiscount = 0;
  breakdownList.forEach(item => {
    sumBase += Number(item.baseFare) || 0;
    sumReservation += Number(item.reservationCharge) || 0;
    sumSuperfast += Number(item.superfastCharge) || 0;
    sumTatkal += Number(item.tatkalCharge) || 0;
    sumDynamic += Number(item.dynamicSurcharge) || 0;
    sumGst += Number(item.gst) || 0;
    sumInsurance += Number(item.insurance) || 0;
    sumDiscount += Number(item.concessionDiscount) || 0;
  });

  document.getElementById('fare-breakdown').innerHTML = `
    <div class="fare-row"><span class="fare-label">Base Fare</span><span class="fare-amount">₹${sumBase.toFixed(2)}</span></div>
    <div class="fare-row"><span class="fare-label">Reservation Charge</span><span class="fare-amount">₹${sumReservation.toFixed(2)}</span></div>
    ${sumSuperfast > 0 ? `<div class="fare-row"><span class="fare-label">Superfast Surcharge</span><span class="fare-amount">₹${sumSuperfast.toFixed(2)}</span></div>` : ''}
    ${sumTatkal > 0 ? `<div class="fare-row"><span class="fare-label">Tatkal Charge</span><span class="fare-amount">₹${sumTatkal.toFixed(2)}</span></div>` : ''}
    ${sumDynamic > 0 ? `<div class="fare-row"><span class="fare-label">Dynamic Surcharge</span><span class="fare-amount">₹${sumDynamic.toFixed(2)}</span></div>` : ''}
    ${sumGst > 0 ? `<div class="fare-row"><span class="fare-label">GST</span><span class="fare-amount">₹${sumGst.toFixed(2)}</span></div>` : ''}
    ${sumInsurance > 0 ? `<div class="fare-row"><span class="fare-label">Travel Insurance</span><span class="fare-amount">₹${sumInsurance.toFixed(2)}</span></div>` : ''}
    ${sumDiscount > 0 ? `<div class="fare-row"><span class="fare-label">Concession Discount</span><span class="fare-amount fare-discount">-₹${sumDiscount.toFixed(2)}</span></div>` : ''}
    <div class="fare-total">
      <span>Total Payable (Server Authoritative)</span>
      <span class="fare-total-amount">₹${total.toFixed(2)}</span>
    </div>
  `;

  document.getElementById('payment-total-amount').textContent = `₹${total.toFixed(2)}`;
}

// Step 5 - Razorpay TEST Payment Gateway
window.processPaymentFlow = async () => {
  const pnr = State.bookingFlow.pnr;
  if (!pnr) {
    showToast('No active seat hold found. Please return to summary to reserve your seats.', 'error');
    goToStep(4);
    return;
  }

  if (State.bookingFlow.secondsRemaining <= 0) {
    showToast('Your seat hold timer has expired. Please restart the booking.', 'error');
    goToStep(1);
    return;
  }

  const btn = document.getElementById('pay-now-btn');
  btn.textContent = '⏳ Launching Gateway...';
  btn.disabled = true;

  showLoading('Connecting to Razorpay gateway...');

  try {
    // 1. Create real order on backend
    const orderData = await Service.createRazorpayOrder(pnr);
    hideLoading();

    if (!orderData || !orderData.orderId || !orderData.keyId) {
      throw new Error('Invalid gateway order response from server');
    }

    if (typeof window.Razorpay === 'undefined') {
      throw new Error('Razorpay Checkout SDK is not loaded. Please verify internet connection.');
    }

    // 2. Open official Razorpay modal
    const options = {
      key: orderData.keyId,
      amount: orderData.amount,
      currency: orderData.currency || 'INR',
      name: 'RailConnect Reservation',
      description: `Payment for PNR ${pnr}`,
      order_id: orderData.orderId,
      prefill: {
        name: State.user?.name || '',
        email: State.user?.email || '',
        contact: State.user?.phone || ''
      },
      theme: {
        color: '#1a56db'
      },
      modal: {
        ondismiss: function () {
          btn.innerHTML = '<svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clip-rule="evenodd"/></svg> Pay Securely Now';
          btn.disabled = false;
          showToast('Payment window closed. Your hold remains active until the timer expires.', 'warning');
        }
      },
      handler: async function (response) {
        showLoading('Verifying payment signature with server...');
        try {
          // 3. Server verification POST /api/payments/razorpay/verify
          const verifyPayload = {
            pnr,
            razorpayOrderId: response.razorpay_order_id,
            razorpayPaymentId: response.razorpay_payment_id,
            razorpaySignature: response.razorpay_signature
          };

          const verifyRes = await Service.verifyRazorpayPayment(verifyPayload);
          hideLoading();

          // Check if server verified success or reported late hold expiry
          if (verifyRes.success === false || verifyRes.error?.code === 'HOLD_EXPIRED') {
            const refundMsg = verifyRes.error?.message || 'Payment arrived after seat hold expired. Full auto-refund issued.';
            showToast(refundMsg, 'error');
            if (State.bookingFlow.holdTimerInterval) clearInterval(State.bookingFlow.holdTimerInterval);
            renderExpiredRefundNotice(verifyRes.data?.refund);
            return;
          }

          // Successful payment confirmation
          if (State.bookingFlow.holdTimerInterval) {
            clearInterval(State.bookingFlow.holdTimerInterval);
            State.bookingFlow.holdTimerInterval = null;
          }

          renderConfirmationPage(verifyRes.data);
          goToStep(6);
          showToast(`Payment verified! Booking confirmed with PNR ${pnr} 🎉`, 'success');

          // Refresh My Bookings
          Service.getUserBookings().then(b => {
            State.allBookings = Array.isArray(b) ? b : [];
            updateBookingBadge();
          }).catch(() => {});

        } catch (vErr) {
          hideLoading();
          showToast(vErr?.message || 'Payment verification failed on server.', 'error');
          btn.innerHTML = '<svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clip-rule="evenodd"/></svg> Pay Securely Now';
          btn.disabled = false;
        }
      }
    };

    const rzp = new window.Razorpay(options);
    rzp.on('payment.failed', function (resp) {
      hideLoading();
      btn.innerHTML = '<svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clip-rule="evenodd"/></svg> Pay Securely Now';
      btn.disabled = false;
      showToast(`Gateway error: ${resp.error?.description || 'Transaction declined'}`, 'error');
    });

    rzp.open();

  } catch (err) {
    hideLoading();
    btn.innerHTML = '<svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clip-rule="evenodd"/></svg> Pay Securely Now';
    btn.disabled = false;
    showToast(err?.message || 'Failed to initiate payment. Please try again.', 'error');
  }
};

function renderExpiredRefundNotice(refund) {
  const container = document.getElementById('payment-details-upi');
  if (container) {
    container.innerHTML = `
      <div class="warning-box" style="margin-top:12px;background:rgba(239,68,68,0.1);border:1px solid var(--clr-danger);color:var(--clr-text-1);">
        <strong>⚠️ Seat Hold Expired (HOLD_EXPIRED)</strong>
        <p style="margin:6px 0 0 0;font-size:13px;">Your payment was captured after the seat hold duration lapsed. The railway booking could not be completed, and an automatic 100% gateway refund has been registered.</p>
        ${refund ? `<div style="font-size:12px;margin-top:6px;color:var(--clr-text-2);">Refund ID: ${refund.refundId || 'Auto'} | Status: ${refund.status || 'PROCESSED'} | Amount: ₹${refund.amount || '—'}</div>` : ''}
      </div>
    `;
  }
}

function renderConfirmationPage(confirmation) {
  const { selectedTrain, selectedClass, selectedPassengers, searchParams } = State.bookingFlow;
  const fromStation = State.stations.find(s => s.stationId === searchParams.fromId);
  const toStation = State.stations.find(s => s.stationId === searchParams.toId);
  const pnr = confirmation?.pnr || State.bookingFlow.pnr;
  const bookingStatus = confirmation?.bookingStatus || 'CONFIRMED';
  const passengers = confirmation?.passengers || selectedPassengers;

  document.getElementById('e-ticket-card').innerHTML = `
    <div class="ticket-header">
      <h3>🚆 Official E-Ticket</h3>
      <div class="ticket-pnr">PNR: ${pnr}</div>
    </div>
    <div class="ticket-body">
      <div class="ticket-route">
        <div class="ticket-station">
          <div class="tk-time">${selectedTrain?.departureTime || '—'}</div>
          <div class="tk-code">${fromStation?.stationCode || '?'}</div>
          <div class="tk-name">${fromStation?.stationName || ''}</div>
        </div>
        <div class="ticket-arrow">
          ──────── ${selectedTrain?.duration || '—'} ────────→
        </div>
        <div class="ticket-station">
          <div class="tk-time">${selectedTrain?.arrivalTime || '—'}</div>
          <div class="tk-code">${toStation?.stationCode || '?'}</div>
          <div class="tk-name">${toStation?.stationName || ''}</div>
        </div>
      </div>
      <div class="ticket-meta">
        <div class="ticket-meta-item">
          <div class="tmeta-label">Train</div>
          <div class="tmeta-value">${selectedTrain?.trainNumber} - ${selectedTrain?.trainName}</div>
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
          <div class="tmeta-label">Booking Status</div>
          <div class="tmeta-value" style="color:var(--clr-accent)">${bookingStatus.replace(/_/g, ' ')}</div>
        </div>
        <div class="ticket-meta-item">
          <div class="tmeta-label">Quota</div>
          <div class="tmeta-value">${searchParams.quota}</div>
        </div>
        <div class="ticket-meta-item">
          <div class="tmeta-label">Total Fare Paid</div>
          <div class="tmeta-value" style="color:var(--clr-primary)">₹${Number(State.bookingFlow.totalFare).toFixed(2)}</div>
        </div>
      </div>
    </div>
    <div class="ticket-footer">
      <div class="ticket-passengers">
        ${passengers.map((p, i) => `
          <div class="ticket-pax-row">
            <span class="ticket-pax-name">${p.name || selectedPassengers[i]?.name || 'Passenger ' + (i + 1)}</span>
            <span class="ticket-pax-berth">
              ${p.status ? p.status.replace(/_/g, ' ') : ''} ${p.coachNumber ? `· Coach ${p.coachNumber}` : ''} ${p.seatNumber ? `· Seat ${p.seatNumber}` : ''} ${p.berthType ? `· ${p.berthType}` : ''} ${p.queuePosition ? `· Position #${p.queuePosition}` : ''}
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
    const trainDisplayName = b.trainName || (b.trainNumber ? `Train ${b.trainNumber}` : (b.train?.trainName || 'Train'));
    const paxCountText = b.passengerCount ? ` · ${b.passengerCount} passenger${b.passengerCount > 1 ? 's' : ''}` : '';
    const fareDisplay = b.totalFare != null ? `₹${Number(b.totalFare).toFixed(2)}` : '—';

    return `
      <div class="booking-full-card">
        <div class="bfc-header">
          <div>
            <div class="bfc-pnr">PNR: ${b.pnr}</div>
            <div style="font-size:12px;color:var(--clr-text-3);margin-top:2px;">Booked on ${formatDate(b.createdAt?.split('T')[0])}${paxCountText}</div>
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
            <div class="bfc-train-name">🚂 ${trainDisplayName}</div>
            <div class="bfc-date">📅 ${formatDate(b.journeyDate)}</div>
            <div class="bfc-class">Class: ${b.classType} | ${b.quota}</div>
          </div>
          <div style="text-align:right;">
            <div class="bfc-fare-label">Total Fare</div>
            <div class="bfc-fare">${fareDisplay}</div>
          </div>
        </div>
        <div class="bfc-footer">
          <button class="btn-secondary-sm" onclick="viewPNRDetails('${b.pnr}')">View Details</button>
          ${canCancel ? `<button class="btn-secondary-sm" style="color:var(--clr-danger);" onclick="openCancelModal('${b.pnr}')">Cancel</button>` : ''}
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

    const trainDisplayName = result.trainName || (result.trainNumber ? `Train ${result.trainNumber}` : (result.train?.trainName || 'Train'));
    const paxRows = result.passengers?.map(p => {
      const pStatus = p.status || p.passengerStatus || 'UNKNOWN';
      const seatInfo = (p.coachNumber && p.seatNumber)
        ? `${p.coachNumber} / Seat ${p.seatNumber}${p.berthType ? ` (${p.berthType})` : ''}`
        : (p.queuePosition ? `Position #${p.queuePosition}` : 'Seat not yet assigned');

      return `
        <div style="display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid var(--clr-border);">
          <div>
            <div style="font-weight:600;">${p.name || p.passengerInfo?.name || 'Passenger'}</div>
            <div style="font-size:12px;color:var(--clr-text-2);">${p.age != null ? p.age : (p.passengerInfo?.age || '—')} yrs | ${p.gender || p.passengerInfo?.gender || '—'}</div>
          </div>
          <div style="text-align:right;">
            <span class="status-badge ${pStatus}">${pStatus.replace(/_/g, ' ')}</span>
            <div style="font-size:12px;color:var(--clr-text-2);margin-top:4px;">
              ${seatInfo}
            </div>
          </div>
        </div>
      `;
    }).join('') || '<div style="color:var(--clr-text-3);padding:10px 0;">No passenger details available.</div>';

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
            <div class="bfc-train-name">🚂 ${trainDisplayName}</div>
            <div class="bfc-date">📅 ${formatDate(result.journeyDate)} | ${result.classType} | ${result.quota}</div>
          </div>
          <div style="text-align:right;">
            <div class="bfc-fare-label">Total Fare</div>
            <div class="bfc-fare">${result.totalFare != null ? `₹${Number(result.totalFare).toFixed(2)}` : '—'}</div>
          </div>
        </div>
        <div style="padding:16px 20px;border-top:1px solid var(--clr-border);">
          <h4 style="font-size:14px;font-weight:600;margin-bottom:12px;">Passengers (${result.passengerCount || result.passengers?.length || 0})</h4>
          ${paxRows}
        </div>
      </div>
    `;
  } catch (err) {
    hideLoading();
    const container = document.getElementById('pnr-result');
    if (container) {
      container.classList.remove('hidden');
      const errorMsg = (err?.status === 404 || err?.code === 'NOT_FOUND')
        ? `No booking found for PNR: ${pnr}`
        : (err?.message || 'Failed to fetch PNR details');
      container.innerHTML = `
        <div class="card" style="text-align:center;padding:40px;">
          <div style="font-size:48px;margin-bottom:16px;">🔍</div>
          <h3 style="margin-bottom:8px;">PNR Enquiry</h3>
          <p style="color:var(--clr-text-2);">${errorMsg}</p>
        </div>`;
    }
    showToast(err?.message || 'Failed to fetch PNR details', 'error');
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
    if (error?.code === 'NOT_AVAILABLE') {
      showToast(error.message, 'error');
    } else {
      showToast('Could not save profile changes.', 'error');
    }
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
  } catch (error) {
    if (error?.code === 'NOT_AVAILABLE') {
      showToast(error.message, 'error');
    } else {
      showToast('Could not save passenger details.', 'error');
    }
  }
};

window.deletePassenger = async (id) => {
  try {
    await Service.deletePassenger(id);
    State.savedPassengers = State.savedPassengers.filter(p => p.passengerId !== id);
    renderPassengersPage();
    showToast('Passenger removed', 'success');
  } catch (error) {
    if (error?.code === 'NOT_AVAILABLE') {
      showToast(error.message, 'error');
    } else {
      showToast('Could not remove passenger.', 'error');
    }
  }
};

// ════════════════════════════════════════════════════════════════ TDR

// ════════════════════════════════════════════════════════════════ TDR

async function renderTDRPage() {
  const container = document.getElementById('tdr-list');
  try {
    const tdrs = await Service.getUserTDRs();

    if (!Array.isArray(tdrs) || !tdrs.length) {
      container.innerHTML = `<div class="empty-state"><div class="empty-icon">📋</div><div class="empty-title">No TDR requests</div><div class="empty-sub">File a Ticket Deposit Receipt if you couldn't travel due to railway delays, diversions, or short terminations</div></div>`;
      return;
    }

    container.innerHTML = tdrs.map(t => `
      <div class="tdr-card">
        <div>
          <div class="tdr-pnr">PNR: ${t.pnr} ${t.passengerNo ? `· Pax #${t.passengerNo}` : ''}</div>
          <div class="tdr-reason">${(t.reason || '').replace(/_/g, ' ')}</div>
          <div class="tdr-date">Filed: ${formatDate(t.filedAt ? t.filedAt.split('T')[0] : '')}</div>
          ${t.remarks ? `<div style="font-size:12px;color:var(--clr-text-3);margin-top:4px;">${t.remarks}</div>` : ''}
        </div>
        <div style="text-align:right;">
          <span class="status-badge ${t.status}">${(t.status || 'FILED').replace(/_/g, ' ')}</span>
          ${t.refundAmount ? `
            <div class="tdr-refund" style="margin-top:8px;">₹${Number(t.refundAmount).toFixed(2)}</div>
            <div class="tdr-refund-label">Refund Amount</div>
          ` : '<div style="font-size:12px;color:var(--clr-text-3);margin-top:8px;">Under Review</div>'}
        </div>
      </div>
    `).join('');
  } catch (err) {
    container.innerHTML = `<div class="empty-state"><div class="empty-icon">⚠️</div><div class="empty-title">Failed to load TDR data</div><div class="empty-sub">${err?.message || 'Please refresh'}</div></div>`;
  }
}

window.openFileTDRModal = () => openModal('modal-file-tdr');
window.openTDRPrefill = (pnr) => {
  const pnrInput = document.getElementById('tdr-pnr');
  if (pnrInput) pnrInput.value = pnr;
  openModal('modal-file-tdr');
};

window.submitTDR = async (e) => {
  e.preventDefault();
  const pnr = document.getElementById('tdr-pnr')?.value?.trim();
  const reason = document.getElementById('tdr-reason')?.value;
  const paxInput = document.getElementById('tdr-passengers')?.value?.trim() || '1';
  const evidenceReference = document.getElementById('tdr-evidence')?.value?.trim() || null;

  if (!pnr || !reason) {
    showToast('PNR and reason are required', 'error');
    return;
  }

  // Parse comma-separated passenger numbers
  const passengerNos = paxInput.split(',').map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n) && n > 0);
  if (passengerNos.length === 0) passengerNos.push(1);

  showLoading('Submitting TDR request...');
  try {
    const payload = {
      pnr,
      reason,
      passengerNos,
      evidenceReference
    };

    const result = await Service.fileTDR(payload);
    hideLoading();
    closeModal('modal-file-tdr');
    const refDisplay = result.tdrRefNo || (result.tdrRefNos ? result.tdrRefNos.join(', ') : 'Filed');
    showToast(`TDR filed successfully! Reference: ${refDisplay}`, 'success');
    renderTDRPage();
    e.target.reset();
  } catch (err) {
    hideLoading();
    showToast(err?.message || 'Failed to file TDR', 'error');
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
let currentRefundEstimate = null;

window.openCancelModal = async (pnr) => {
  pendingCancelPNR = pnr;
  const booking = State.allBookings.find(b => b.pnr === pnr);

  const trainDisplayName = booking?.trainName || (booking?.trainNumber ? `Train ${booking.trainNumber}` : (booking?.train?.trainName || 'Train'));
  const journeyDateStr = booking?.journeyDate ? formatDate(booking.journeyDate) : '—';

  document.getElementById('cancel-booking-info').innerHTML = `
    <div style="padding:12px;background:var(--clr-surface-2);border-radius:var(--radius-md);margin-bottom:12px;">
      <div style="font-weight:700;margin-bottom:4px;">PNR: ${pnr}</div>
      <div style="font-size:13px;color:var(--clr-text-2);">${trainDisplayName} | ${journeyDateStr}</div>
    </div>
  `;

  document.getElementById('cancel-charge').textContent = 'Calculating...';
  document.getElementById('cancel-refund').textContent = 'Calculating...';
  const paxContainer = document.getElementById('cancel-passengers-container');
  if (paxContainer) {
    paxContainer.innerHTML = '<div style="font-size:12px;color:var(--clr-text-3);">Fetching authoritative refund estimate from server...</div>';
  }

  const confirmBtn = document.getElementById('btn-confirm-cancel');
  if (confirmBtn) confirmBtn.disabled = true;

  openModal('modal-cancel-booking');

  try {
    // 1. Fetch real server refund estimate
    const estimate = await Service.getRefundEstimate(pnr);
    currentRefundEstimate = estimate;

    document.getElementById('cancel-charge').textContent = `₹${Number(estimate.totalCancellationCharge).toFixed(2)}`;
    document.getElementById('cancel-refund').textContent = `₹${Number(estimate.totalRefundAmount).toFixed(2)}`;

    // Render individual passenger selection
    if (paxContainer && Array.isArray(estimate.passengers) && estimate.passengers.length > 0) {
      paxContainer.innerHTML = `
        <div style="margin-top:8px;">
          <div style="font-size:12px;font-weight:600;margin-bottom:6px;color:var(--clr-text-2);">Select Passengers to Cancel:</div>
          ${estimate.passengers.map(p => `
            <label style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid var(--clr-border);font-size:13px;cursor:pointer;">
              <div style="display:flex;align-items:center;gap:8px;">
                <input type="checkbox" class="cancel-pax-chk" value="${p.passengerNo}" checked onchange="recalculateSelectedCancellationRefund()" />
                <span><strong>#${p.passengerNo}</strong> ${p.name}</span>
              </div>
              <span style="color:var(--clr-text-3);">Refund: ₹${Number(p.refundAmount).toFixed(2)}</span>
            </label>
          `).join('')}
        </div>
      `;
    } else if (paxContainer) {
      paxContainer.innerHTML = '';
    }

    if (confirmBtn) confirmBtn.disabled = false;
  } catch (err) {
    document.getElementById('cancel-charge').textContent = '—';
    document.getElementById('cancel-refund').textContent = '—';
    if (paxContainer) {
      paxContainer.innerHTML = `<div style="font-size:12px;color:var(--clr-danger);">${err?.message || 'Failed to estimate refund'}</div>`;
    }
    showToast(err?.message || 'Could not fetch refund estimate', 'error');
  }
};

window.recalculateSelectedCancellationRefund = async () => {
  if (!pendingCancelPNR || !currentRefundEstimate) return;
  const checkboxes = Array.from(document.querySelectorAll('.cancel-pax-chk:checked'));
  const selectedNos = checkboxes.map(cb => parseInt(cb.value, 10));

  if (selectedNos.length === 0) {
    document.getElementById('cancel-charge').textContent = '₹0.00';
    document.getElementById('cancel-refund').textContent = '₹0.00';
    const confirmBtn = document.getElementById('btn-confirm-cancel');
    if (confirmBtn) confirmBtn.disabled = true;
    return;
  }

  try {
    const freshEstimate = await Service.getRefundEstimate(pendingCancelPNR, selectedNos);
    document.getElementById('cancel-charge').textContent = `₹${Number(freshEstimate.totalCancellationCharge).toFixed(2)}`;
    document.getElementById('cancel-refund').textContent = `₹${Number(freshEstimate.totalRefundAmount).toFixed(2)}`;
    const confirmBtn = document.getElementById('btn-confirm-cancel');
    if (confirmBtn) confirmBtn.disabled = false;
  } catch (err) {
    showToast('Failed to update refund estimate for selection', 'warning');
  }
};

window.confirmCancellation = async () => {
  if (!pendingCancelPNR) return;

  const checkboxes = Array.from(document.querySelectorAll('.cancel-pax-chk:checked'));
  const selectedNos = checkboxes.length > 0 ? checkboxes.map(cb => parseInt(cb.value, 10)) : null;

  const confirmBtn = document.getElementById('btn-confirm-cancel');
  if (confirmBtn) confirmBtn.disabled = true;

  showLoading('Processing cancellation with railway server...');
  try {
    const result = await Service.cancelBooking(pendingCancelPNR, selectedNos);
    hideLoading();
    closeModal('modal-cancel-booking');
    showToast(`Cancellation successful! Refund of ₹${Number(result.refundAmount).toFixed(2)} processed.`, 'success');

    // Reload bookings to reflect updated statuses
    const updatedBookings = await Service.getUserBookings();
    State.allBookings = Array.isArray(updatedBookings) ? updatedBookings : [];
    pendingCancelPNR = null;
    currentRefundEstimate = null;

    renderBookingsPage();
    updateBookingBadge();
  } catch (err) {
    hideLoading();
    if (confirmBtn) confirmBtn.disabled = false;
    showToast(err?.message || 'Cancellation failed. Please try again.', 'error');
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
