const express = require('express');
const {
  searchTrains,
  getTrainById,
  getTrainAvailability
} = require('../controllers/trainController');

const { authenticate } = require('../middleware/auth');
const { getTrainLiveStatus } = require('../services/liveStatusService');

const router = express.Router();

router.get('/search', searchTrains);
router.get('/:trainId/live-status', authenticate, async (req, res, next) => {
  try {
    const { trainId } = req.params;
    const status = await getTrainLiveStatus(trainId);
    return res.status(200).json({
      success: true,
      data: status
    });
  } catch (error) {
    next(error);
  }
});
router.get('/:trainId', getTrainById);
router.get('/:trainId/availability', getTrainAvailability);

module.exports = router;
