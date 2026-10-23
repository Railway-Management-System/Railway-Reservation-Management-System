const express = require('express');
const { authenticate } = require('../middleware/auth');
const { submitComplaint, getMyComplaints } = require('../controllers/complaintController');

const router = express.Router();

router.use(authenticate);

// POST /api/complaints - Passenger file grievance
router.post('/', submitComplaint);

// GET /api/complaints - Passenger view own grievances
router.get('/', getMyComplaints);

module.exports = router;
