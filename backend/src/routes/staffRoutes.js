const express = require('express');
const { authenticate } = require('../middleware/auth');
const {
  requireStaffRole,
  requireStaffOrAdminRole,
  verifyTicket,
  boardPassenger,
  markNoShow,
  getBookingByPnr,
  getCurrentAssignment,
  getScheduleChart,
  issueFine,
  reportIncident,
  logDelay,
  reportCrowd,
  reportCleanliness,
  promotePassenger
} = require('../controllers/staffController');

const router = express.Router();

// All staff operations require authentication
router.use(authenticate);

// GET /api/staff/assignments/current (STAFF role only, Contract 5.1)
router.get('/assignments/current', requireStaffRole, getCurrentAssignment);

// GET /api/staff/schedules/:scheduleId/chart (STAFF assigned to run or ADMIN, Contract 5.1)
router.get('/schedules/:scheduleId/chart', requireStaffOrAdminRole, getScheduleChart);

// POST /api/staff/verification (STAFF role only)
router.post('/verification', requireStaffRole, verifyTicket);

// POST /api/staff/boarding (STAFF role only)
router.post('/boarding', requireStaffRole, boardPassenger);

// POST /api/staff/no-show (STAFF role only)
router.post('/no-show', requireStaffRole, markNoShow);

// GET /api/staff/pnr/:pnr (STAFF and ADMIN roles, reuses getBookingByPnr)
router.get('/pnr/:pnr', requireStaffOrAdminRole, getBookingByPnr);

// POST /api/staff/promote (STAFF and ADMIN roles, calls sp_promote_passenger)
router.post('/promote', requireStaffOrAdminRole, promotePassenger);

// POST /api/staff/fines (STAFF role only, Contract 5.3)
router.post('/fines', requireStaffRole, issueFine);

// POST /api/staff/incidents (STAFF role only, Contract 5.3)
router.post('/incidents', requireStaffRole, reportIncident);

// POST /api/staff/delays (STAFF role only, Contract 5.4)
router.post('/delays', requireStaffRole, logDelay);

// POST /api/staff/crowd-reports (STAFF role only, Contract 5.4)
router.post('/crowd-reports', requireStaffRole, reportCrowd);

// POST /api/staff/cleanliness-reports (STAFF role only, Contract 5.4)
router.post('/cleanliness-reports', requireStaffRole, reportCleanliness);

module.exports = router;
