require('./src/config/env');

const validateEnv = require('./src/config/validateEnv');
validateEnv(); // Verify all required keys are populated before proceeding

const app = require('./app');
const prisma = require('./src/config/db');
const { initScheduler } = require('./src/services/scheduler.service');

const PORT = process.env.PORT || 5000;

async function startServer() {
  try {
    await prisma.$connect();
    console.log('[DB] PostgreSQL connected');

    // Bind successfully before starting background writes; handle port conflicts.
    await new Promise((resolve, reject) => {
      const listener = app.listen(PORT, resolve);
      listener.once('error', reject);
    });
    initScheduler();
    console.log('[Server] Running on http://localhost:' + PORT);
  } catch (error) {
    console.error(error.code === 'EADDRINUSE'
      ? '[Server] Port is already in use. Stop the existing backend or choose another PORT.'
      : '[Server] Startup failed. Check database access and server configuration.');
    await prisma.$disconnect();
    process.exit(1);
  }
}

startServer();
