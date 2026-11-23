require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const prisma = require('./prisma');

const authRoutes = require('./routes/authRoutes');
const adminRoutes = require('./routes/adminRoutes');
const doctorRoutes = require('./routes/doctorRoutes');
const appointmentRoutes = require('./routes/appointmentRoutes');
const leaveRoutes = require('./routes/leaveRoutes');
const reminderRoutes = require('./routes/reminderRoutes');

const errorHandler = require('./middleware/errorHandler');
const { startScheduler } = require('./services/schedulerService');

const app = express();
const PORT = process.env.PORT || 5000;

// Trust proxy for reverse proxies (Render, Vercel, Nginx, AWS ALB)
app.set('trust proxy', 1);

// Security Headers
app.use(helmet({ crossOriginResourcePolicy: false }));

// CORS Configuration - Supports local dev and production frontend URLs
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:5173',
  process.env.FRONTEND_URL,
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps, curl, server-to-server) or matching allowed origins
    if (!origin || allowedOrigins.includes(origin) || process.env.NODE_ENV !== 'production') {
      return callback(null, true);
    }
    return callback(null, false);
  },
  credentials: true,
}));

// Rate Limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

// Body Parser
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request Timestamp Logger
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    if (process.env.NODE_ENV !== 'production' || res.statusCode >= 400) {
      console.log(`[HTTP] ${req.method} ${req.originalUrl} ${res.statusCode} - ${duration}ms`);
    }
  });
  next();
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/doctor', doctorRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/leave', leaveRoutes);
app.use('/api/reminders', reminderRoutes);

// Production-ready Health Check route with Database ping
app.get('/api/health', async (req, res) => {
  try {
    // Ping database
    await prisma.$queryRaw`SELECT 1`;
    res.json({
      status: 'healthy',
      database: 'connected',
      timestamp: new Date().toISOString(),
      service: 'CareSync Healthcare API Server',
      uptime: process.uptime(),
    });
  } catch (err) {
    console.error('[Health Check] Database connection failed', err.code || err.name);
    res.status(503).json({
      status: 'degraded',
      database: 'disconnected',
      timestamp: new Date().toISOString(),
    });
  }
});

// Centralized Error Handler
app.use(errorHandler);

// Start Server and Cron Scheduler
const server = app.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(` CareSync Healthcare Platform API Server Running`);
  console.log(` URL: http://localhost:${PORT}`);
  console.log(` Health Check: http://localhost:${PORT}/api/health`);
  console.log(` Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`=======================================================`);

  // Start background jobs
  startScheduler();
});

// Graceful Shutdown
const gracefulShutdown = async (signal) => {
  console.log(`\n[Server] Received ${signal}. Starting graceful shutdown...`);
  server.close(async () => {
    console.log('[Server] HTTP connections closed.');
    try {
      await prisma.$disconnect();
      console.log('[Database] Prisma client disconnected.');
      process.exit(0);
    } catch (e) {
      console.error('[Database] Error during disconnect:', e);
      process.exit(1);
    }
  });
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
