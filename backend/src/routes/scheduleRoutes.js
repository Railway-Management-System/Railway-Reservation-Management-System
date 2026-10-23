const express = require('express');
const { authenticate } = require('../middleware/auth');
const { getScheduleLiveStatus } = require('../services/liveStatusService');

const router = express.Router();

router.use(authenticate);

// GET /api/schedules/:scheduleId/live-status - Live train status for schedule (any logged-in user)
router.get('/:scheduleId/live-status', async (req, res, next) => {
  try {
    const { scheduleId } = req.params;
    const status = await getScheduleLiveStatus(scheduleId);
    return res.status(200).json({
      success: true,
      data: status
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
