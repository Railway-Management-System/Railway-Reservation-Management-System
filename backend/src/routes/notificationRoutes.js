const express = require('express');
const { authenticate } = require('../middleware/auth');
const { getMyNotifications, markAsRead } = require('../controllers/notificationController');

const router = express.Router();

router.use(authenticate);

// GET /api/notifications - Own notifications, newest first
router.get('/', getMyNotifications);

// PUT /api/notifications/:id/read - Mark notification as read (own only)
router.put('/:id/read', markAsRead);

module.exports = router;
