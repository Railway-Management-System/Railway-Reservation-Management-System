const pool = require('../config/mysql');

/**
 * 1. List All Stations (Public)
 * GET /api/stations
 * No login needed.
 * Returns { stationId, stationCode, stationName, city, state } ordered by stationName.
 * stationName = display_name, falling back to station_name.
 */
async function listPublicStations(req, res, next) {
  try {
    const [rows] = await pool.query(
      `SELECT
        station_id AS stationId,
        station_code AS stationCode,
        COALESCE(NULLIF(display_name, ''), station_name) AS stationName,
        city,
        state
      FROM STATION
      ORDER BY stationName ASC`
    );

    return res.status(200).json({
      success: true,
      data: rows
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  listPublicStations
};
