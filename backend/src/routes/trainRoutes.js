const express = require('express');
const {
  searchTrains,
  getTrainById,
  getTrainAvailability
} = require('../controllers/trainController');

const router = express.Router();

router.get('/search', searchTrains);
router.get('/:trainId', getTrainById);
router.get('/:trainId/availability', getTrainAvailability);

module.exports = router;
