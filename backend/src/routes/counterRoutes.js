const express = require('express');
const { createCounterBooking } = require('../controllers/counterController');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// POST /api/counter/bookings - Counter booking for walk-in / registered passengers (STAFF only)
router.post('/bookings', authenticate, createCounterBooking);

module.exports = router;
