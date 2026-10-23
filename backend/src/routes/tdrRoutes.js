const express = require('express');
const { authenticate } = require('../middleware/auth');
const {
  requirePassengerRole,
  fileTdr,
  getMyTdrs,
  getTdrByRefNo
} = require('../controllers/tdrController');

const router = express.Router();

// All TDR routes require PASSENGER authentication
router.use(authenticate, requirePassengerRole);

// POST /api/tdr - File a TDR
router.post('/', fileTdr);

// GET /api/tdr - List own TDRs
router.get('/', getMyTdrs);

// GET /api/tdr/:tdrRefNo - Get specific TDR (own only)
router.get('/:tdrRefNo', getTdrByRefNo);

module.exports = router;
