const path = require('path');
const dotenv = require('dotenv');

// 1. Load root .env before importing any application modules
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const http = require('http');
const app = require('./app');
const { connectDB, disconnectDB } = require('./config/db');
const { initSocket } = require('./services/socketService');

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    // Connect to database before starting HTTP listener
    await connectDB();

    // Ensure development admin account if ADMIN_PASSWORD is configured locally
    if (process.env.ADMIN_PASSWORD) {
      const { seedAdmin } = require('./scripts/seedAdmin');
      await seedAdmin().catch(() => {});
    }

    const server = http.createServer(app);

    // Initialize Socket.IO real-time consultation engine
    initSocket(server);

    await new Promise((resolve) => {
      server.listen(PORT, () => {
        console.log(`====================================================`);
        console.log(`  VitaLink API Server running on port ${PORT}`);
        console.log(`  Environment: ${process.env.NODE_ENV || 'development'}`);
        console.log(`  Health Check: http://localhost:${PORT}/api/health`);
        console.log(`====================================================`);
        resolve();
      });
    });

    const handleShutdown = async (signal) => {
      console.log(`\n[VitaLink] ${signal} signal received. Closing HTTP server gracefully...`);
      server.close(async () => {
        console.log('[VitaLink] HTTP server closed.');
        await disconnectDB();
        process.exit(0);
      });
    };

    process.on('SIGTERM', () => handleShutdown('SIGTERM'));
    process.on('SIGINT', () => handleShutdown('SIGINT'));

    return { server, app };
  } catch (error) {
    console.error(`[VitaLink Fatal Error]: ${error.message}`);
    process.exit(1);
  }
};

if (require.main === module) {
  startServer();
}

module.exports = { startServer };
