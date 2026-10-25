const express = require('express');
const { listPublicStations } = require('../controllers/stationController');

const router = express.Router();

// GET /api/stations - Public stations list
router.get('/', listPublicStations);

module.exports = router;
