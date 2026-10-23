const express = require('express');
const healthRoutes = require('./healthRoutes');
const authRoutes = require('./authRoutes');
const trainRoutes = require('./trainRoutes');
const bookingRoutes = require('./bookingRoutes');
const paymentRoutes = require('./paymentRoutes');
const counterRoutes = require('./counterRoutes');
const staffRoutes = require('./staffRoutes');
const tdrRoutes = require('./tdrRoutes');
const adminRoutes = require('./adminRoutes');
const maintenanceRoutes = require('./maintenanceRoutes');
const { authenticate } = require('../middleware/auth');
const { getMe } = require('../controllers/authController');

const router = express.Router();

// Mount sub-routers
router.use('/', healthRoutes);
router.use('/auth', authRoutes);
router.use('/trains', trainRoutes);
router.use('/bookings', bookingRoutes);
router.use('/payments', paymentRoutes);
router.use('/counter', counterRoutes);
router.use('/staff', staffRoutes);
router.use('/tdr', tdrRoutes);
router.use('/admin', adminRoutes);
router.use('/maintenance', maintenanceRoutes);

// Direct /me convenience endpoint
router.get('/me', authenticate, getMe);

module.exports = router;

