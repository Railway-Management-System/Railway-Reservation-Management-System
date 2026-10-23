const express = require('express');
const {
  createBooking,
  getBookingHold,
  cancelBooking,
  getRefundEstimate,
  getMyBookings,
  getBookingByPnr
} = require('../controllers/bookingController');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// GET /api/bookings - My bookings list (login required, PASSENGER sees own, optional ?status= filter)
router.get('/', authenticate, getMyBookings);

// POST /api/bookings - Online booking creation (login required)
router.post('/', authenticate, createBooking);

// GET /api/bookings/:pnr/hold - Hold time remaining and expiry (owner only)
router.get('/:pnr/hold', authenticate, getBookingHold);

// GET /api/bookings/:pnr/refund-estimate - Read-only refund estimation preview (Section 8)
router.get('/:pnr/refund-estimate', authenticate, getRefundEstimate);

// POST /api/bookings/:pnr/cancel - Ticket Cancellation & Refund (Section 8)
router.post('/:pnr/cancel', authenticate, cancelBooking);

// GET /api/bookings/:pnr - PNR status lookup (owner PASSENGER, or STAFF/ADMIN)
router.get('/:pnr', authenticate, getBookingByPnr);

module.exports = router;



