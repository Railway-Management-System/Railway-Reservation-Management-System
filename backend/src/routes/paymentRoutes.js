const express = require('express');
const { createOrder, verifyPayment } = require('../controllers/paymentController');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// Razorpay payment endpoints
router.post('/razorpay/order', authenticate, createOrder);
router.post('/razorpay/verify', authenticate, verifyPayment);

module.exports = router;
