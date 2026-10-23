const express = require('express');
const { authenticate } = require('../middleware/auth');
const {
  requireAdminRole,
  getAdminTdrs,
  reviewTdr,
  prepareChart,
  getSettings,
  updateSetting,
  getAuditLogs,
  listReports,
  getReportByKey,
  getStaffList,
  createStaffMember,
  updateStaffStatus
} = require('../controllers/adminController');

const router = express.Router();

// All admin routes require ADMIN authentication
router.use(authenticate, requireAdminRole);

// POST /api/admin/schedules/:scheduleId/chart-preparation - Chart preparation execution (BR-B12a, Contract 7.2)
router.post('/schedules/:scheduleId/chart-preparation', prepareChart);

// GET /api/admin/settings - List system settings (Contract 7.1)
router.get('/settings', getSettings);

// PUT /api/admin/settings/:key - Update system setting (Contract 7.1)
router.put('/settings/:key', updateSetting);

// GET /api/admin/tdr - List pending/filtered TDRs
router.get('/tdr', getAdminTdrs);

// PUT /api/admin/tdr/:tdrRefNo - Review TDR claim
router.put('/tdr/:tdrRefNo', reviewTdr);

// GET /api/admin/audit-logs - Paged audit trail with filters (Contract 7.4)
router.get('/audit-logs', getAuditLogs);

// GET /api/admin/reports - List available analytical RANK reports (06_reports.sql)
router.get('/reports', listReports);

// GET /api/admin/reports/:reportKey - Run specific report and record in REPORT table
router.get('/reports/:reportKey', getReportByKey);

// GET /api/admin/staff - List staff accounts (BR-ST1)
router.get('/staff', getStaffList);

// POST /api/admin/staff - Create staff account with bcrypt password (BR-ST1)
router.post('/staff', createStaffMember);

// PUT /api/admin/staff/:staffId/status - Update staff status (ACTIVE, ON_LEAVE, SUSPENDED)
router.put('/staff/:staffId/status', updateStaffStatus);

module.exports = router;
