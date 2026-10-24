const app = require('./app');
const config = require('./config/env');
const { connectMongo, closeMongo } = require('./config/mongodb');
const pool = require('./config/mysql');
const { startCleanupTimer, stopCleanupTimer } = require('./services/holdCleanupService');

async function startServer() {
  try {
    // Initialize MongoDB connection
    await connectMongo();

    // Start background hold cleanup timer (calls sp_release_expired_holds every 60s)
    startCleanupTimer(60000);

    const server = app.listen(config.PORT, () => {
      console.log(`Server started on port ${config.PORT}`);
    });

    // Graceful shutdown
    const shutdown = async () => {
      console.log('Shutting down server gracefully...');
      stopCleanupTimer();
      server.close(async () => {
        try {
          await pool.end();
          await closeMongo();
          console.log('Database connections closed.');
          process.exit(0);
        } catch (err) {
          console.error('Error during shutdown:', err.message);
          process.exit(1);
        }
      });
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
  } catch (error) {
    console.error('Failed to start server:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  startServer();
}

module.exports = { startServer };
