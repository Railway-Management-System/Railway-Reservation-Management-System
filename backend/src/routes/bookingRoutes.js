const express = require('express');
const { createBooking, getBookingHold, cancelBooking, getRefundEstimate } = require('../controllers/bookingController');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// POST /api/bookings - Online booking creation (login required)
router.post('/', authenticate, createBooking);

// GET /api/bookings/:pnr/hold - Hold time remaining and expiry (owner only)
router.get('/:pnr/hold', authenticate, getBookingHold);

// GET /api/bookings/:pnr/refund-estimate - Read-only refund estimation preview (Section 8)
router.get('/:pnr/refund-estimate', authenticate, getRefundEstimate);

// POST /api/bookings/:pnr/cancel - Ticket Cancellation & Refund (Section 8)
router.post('/:pnr/cancel', authenticate, cancelBooking);

module.exports = router;


