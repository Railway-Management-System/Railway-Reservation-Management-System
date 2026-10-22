const express = require('express');
const {
  registerPassenger,
  loginPassenger,
  loginStaff,
  loginAdmin,
  loginUniversal,
  getMe
} = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// Specific role logins per docs/API_CONTRACT.md
router.post('/passenger/register', registerPassenger);
router.post('/passenger/login', loginPassenger);
router.post('/staff/login', loginStaff);
router.post('/admin/login', loginAdmin);

// General login
router.post('/login', loginUniversal);

// Profile
router.get('/me', authenticate, getMe);

module.exports = router;
