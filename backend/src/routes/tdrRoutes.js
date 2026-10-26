const express = require('express');
const { authenticate } = require('../middleware/auth');
const { requireAdminRole, reviewTdr } = require('../controllers/adminController');
const {
  requirePassengerRole,
  fileTdr,
  getMyTdrs,
  getTdrByRefNo
} = require('../controllers/tdrController');

const router = express.Router();

// PUT /api/tdr/admin/:id - Admin TDR review (kept for compatibility)
router.put('/admin/:id', authenticate, requireAdminRole, reviewTdr);

// All TDR routes require PASSENGER authentication
router.use(authenticate, requirePassengerRole);

// POST /api/tdr - File a TDR
router.post('/', fileTdr);

// GET /api/tdr - List own TDRs
router.get('/', getMyTdrs);

// GET /api/tdr/:tdrRefNo - Get specific TDR (own only)
router.get('/:tdrRefNo', getTdrByRefNo);

module.exports = router;
