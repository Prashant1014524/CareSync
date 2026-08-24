require('dotenv').config();
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

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

// Enable CORS
app.use(cors());

// Rate Limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  message: 'Too many requests from this IP, please try again later.',
});
app.use(limiter);

// Body Parser
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/doctor', doctorRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/leave', leaveRoutes);
app.use('/api/reminders', reminderRoutes);

// Health check route
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'Healthcare Appointment & Follow-up Manager API',
  });
});

// Centralized Error Handler
app.use(errorHandler);

// Start Server and Cron Scheduler
app.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(` Healthcare Appointment Manager API Server Running`);
  console.log(` URL: http://localhost:${PORT}`);
  console.log(` Health Check: http://localhost:${PORT}/api/health`);
  console.log(`=======================================================`);

  // Start background jobs
  startScheduler();
});
