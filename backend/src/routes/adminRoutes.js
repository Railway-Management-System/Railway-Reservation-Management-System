const express = require('express');
const { authenticate } = require('../middleware/auth');
const {
  requireAdminRole,
  getAdminTdrs,
  reviewTdr,
  prepareChart,
  getAdminSchedules,
  getSettings,
  updateSetting,
  getAuditLogs,
  listReports,
  getReportByKey,
  getStaffList,
  createStaffMember,
  updateStaffStatus,
  getAdminBookings,
  getRankReports,
  getAdminUsers,
  getAdminPlatforms,
  getAdminFines,
  getAdminIncidents
} = require('../controllers/adminController');

const {
  adminListComplaints,
  adminUpdateComplaint
} = require('../controllers/complaintController');

const { getActivityLogs } = require('../services/activityLogService');

const {
  listStations,
  getStation,
  createStation,
  updateStation,
  deleteStation,
  listTrains,
  getTrain,
  createTrain,
  updateTrain,
  deleteTrain,
  listRoutes,
  getRouteStop,
  createRouteStop,
  updateRouteStop,
  deleteRouteStop,
  listCoaches,
  getCoach,
  createCoach,
  updateCoach,
  deleteCoach,
  listSeats,
  getSeat,
  createSeat,
  updateSeat,
  deleteSeat,
  listFares,
  getFare,
  createFare,
  updateFare,
  deleteFare,
  listConcessionRules,
  getConcessionRule,
  createConcessionRule,
  updateConcessionRule,
  deleteConcessionRule,
  listRefundRules,
  getRefundRule,
  createRefundRule,
  updateRefundRule,
  deleteRefundRule
} = require('../controllers/adminMasterDataController');

const router = express.Router();

// All admin routes require ADMIN authentication
router.use(authenticate, requireAdminRole);

// GET /api/admin/schedules - List dated train schedules (Contract 7.2.1)
router.get('/schedules', getAdminSchedules);

// POST /api/admin/schedules/:scheduleId/chart-preparation - Chart preparation execution (BR-B12a, Contract 7.2)
router.post('/schedules/:scheduleId/chart-preparation', prepareChart);

// GET /api/admin/settings - List system settings (Contract 7.1)
router.get('/settings', getSettings);

// PUT /api/admin/settings/:key - Update system setting (Contract 7.1)
router.put('/settings/:key', updateSetting);

// GET /api/admin/bookings - List bookings with optional filters (pnr, status, from_date, to_date, limit)
router.get('/bookings', getAdminBookings);

// GET /api/admin/users - List users from real USER_ACCOUNT table
router.get('/users', getAdminUsers);

// GET /api/admin/platforms - List platforms from real PLATFORM table
router.get('/platforms', getAdminPlatforms);

// GET /api/admin/fines - List fines from real FINE table
router.get('/fines', getAdminFines);

// GET /api/admin/incidents - List incidents from real INCIDENT table
router.get('/incidents', getAdminIncidents);

// GET /api/admin/tdr - List pending/filtered TDRs
router.get('/tdr', getAdminTdrs);

// PUT /api/admin/tdr/:tdrRefNo and PUT /api/admin/tdr/:id - Review TDR claim
router.put('/tdr/:tdrRefNo', reviewTdr);
router.put('/tdr/:id', reviewTdr);

// GET /api/admin/audit-logs - Paged forensic audit trail in MySQL (Contract 7.4)
router.get('/audit-logs', getAuditLogs);

// GET /api/admin/activity-logs - Paged user & staff session/event audit trail in MongoDB (Contract 7.4 / Prompt Part A)
router.get('/activity-logs', async (req, res, next) => {
  try {
    const { page, limit, userId, action } = req.query;
    const result = await getActivityLogs({ page, limit, userId, action });
    return res.status(200).json({
      success: true,
      data: result.data,
      pagination: result.pagination
    });
  } catch (err) {
    next(err);
  }
});

// GET & PUT /api/admin/complaints - Passenger complaints review
router.get('/complaints', adminListComplaints);
router.put('/complaints/:grievanceId', adminUpdateComplaint);

// GET /api/admin/reports - List available analytical RANK reports (06_reports.sql)
router.get('/reports', listReports);

// GET /api/admin/reports/rank - 5 RANK reports from 06_reports.sql for admin dashboard
router.get('/reports/rank', getRankReports);

// GET /api/admin/reports/:reportKey - Run specific report and record in REPORT table
router.get('/reports/:reportKey', getReportByKey);

// GET /api/admin/staff - List staff accounts (BR-ST1)
router.get('/staff', getStaffList);

// POST /api/admin/staff - Create staff account with bcrypt password (BR-ST1)
router.post('/staff', createStaffMember);

// PUT /api/admin/staff/:staffId/status - Update staff status (ACTIVE, ON_LEAVE, SUSPENDED)
router.put('/staff/:staffId/status', updateStaffStatus);

// =============================================================================
// MASTER DATA MANAGEMENT (Contract 7.4 / Part B)
// =============================================================================

// 1. Stations
router.get('/stations', listStations);
router.get('/stations/:id', getStation);
router.post('/stations', createStation);
router.put('/stations/:id', updateStation);
router.delete('/stations/:id', deleteStation);

// 2. Trains
router.get('/trains', listTrains);
router.get('/trains/:id', getTrain);
router.post('/trains', createTrain);
router.put('/trains/:id', updateTrain);
router.delete('/trains/:id', deleteTrain);

// 3. Routes (Route Stops)
router.get('/routes', listRoutes);
router.get('/routes/:id', getRouteStop);
router.post('/routes', createRouteStop);
router.put('/routes/:id', updateRouteStop);
router.delete('/routes/:id', deleteRouteStop);

router.get('/route-stops', listRoutes);
router.get('/route-stops/:id', getRouteStop);
router.post('/route-stops', createRouteStop);
router.put('/route-stops/:id', updateRouteStop);
router.delete('/route-stops/:id', deleteRouteStop);

// 4. Coaches
router.get('/coaches', listCoaches);
router.get('/coaches/:id', getCoach);
router.post('/coaches', createCoach);
router.put('/coaches/:id', updateCoach);
router.delete('/coaches/:id', deleteCoach);

// 5. Seats
router.get('/seats', listSeats);
router.get('/seats/:id', getSeat);
router.post('/seats', createSeat);
router.put('/seats/:id', updateSeat);
router.delete('/seats/:id', deleteSeat);

// 6. Fares
router.get('/fares', listFares);
router.get('/fares/:id', getFare);
router.post('/fares', createFare);
router.put('/fares/:id', updateFare);
router.delete('/fares/:id', deleteFare);

// 7. Concession Rules
router.get('/concession-rules', listConcessionRules);
router.get('/concession-rules/:id', getConcessionRule);
router.post('/concession-rules', createConcessionRule);
router.put('/concession-rules/:id', updateConcessionRule);
router.delete('/concession-rules/:id', deleteConcessionRule);

router.get('/concessions', listConcessionRules);
router.get('/concessions/:id', getConcessionRule);
router.post('/concessions', createConcessionRule);
router.put('/concessions/:id', updateConcessionRule);
router.delete('/concessions/:id', deleteConcessionRule);

// 8. Refund Rules
router.get('/refund-rules', listRefundRules);
router.get('/refund-rules/:id', getRefundRule);
router.post('/refund-rules', createRefundRule);
router.put('/refund-rules/:id', updateRefundRule);
router.delete('/refund-rules/:id', deleteRefundRule);

router.get('/refunds', listRefundRules);
router.get('/refunds/:id', getRefundRule);
router.post('/refunds', createRefundRule);
router.put('/refunds/:id', updateRefundRule);
router.delete('/refunds/:id', deleteRefundRule);

module.exports = router;
