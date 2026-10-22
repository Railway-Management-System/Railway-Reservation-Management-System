const pool = require('../config/mysql');
const { getMongoDb, connectMongo } = require('../config/mongodb');

async function getHealth(req, res, next) {
  const health = {
    status: 'UP',
    timestamp: new Date().toISOString(),
    services: {
      mysql: { status: 'UNKNOWN' },
      mongodb: { status: 'UNKNOWN' }
    }
  };

  let allHealthy = true;

  // 1. MySQL Health Check
  try {
    const [result] = await pool.query('SELECT 1 as ping');
    if (result && result.length > 0 && result[0].ping === 1) {
      health.services.mysql = {
        status: 'UP',
        database: 'connected'
      };
    } else {
      health.services.mysql = { status: 'DOWN', error: 'Unexpected ping response' };
      allHealthy = false;
    }
  } catch (err) {
    health.services.mysql = { status: 'DOWN', error: err.message };
    allHealthy = false;
  }

  // 2. MongoDB Health Check
  try {
    let db = getMongoDb();
    if (!db) {
      db = await connectMongo();
    }
    const mongoPing = await db.command({ ping: 1 });
    if (mongoPing && mongoPing.ok === 1) {
      health.services.mongodb = {
        status: 'UP',
        database: 'connected'
      };
    } else {
      health.services.mongodb = { status: 'DOWN', error: 'Unexpected ping response' };
      allHealthy = false;
    }
  } catch (err) {
    health.services.mongodb = { status: 'DOWN', error: err.message };
    allHealthy = false;
  }

  health.status = allHealthy ? 'UP' : 'DEGRADED';
  const httpStatus = allHealthy ? 200 : 503;

  return res.status(httpStatus).json({
    success: allHealthy,
    data: health,
    message: allHealthy ? 'All services operating normally' : 'One or more services degraded'
  });
}

module.exports = {
  getHealth
};
