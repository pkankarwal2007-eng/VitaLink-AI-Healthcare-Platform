const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const mongoose = require('mongoose');

const authRoutes = require('./routes/authRoutes');
const doctorRoutes = require('./routes/doctorRoutes');
const adminRoutes = require('./routes/adminRoutes');
const aiRoutes = require('./routes/aiRoutes');
const appointmentRoutes = require('./routes/appointmentRoutes');
const consultationRoutes = require('./routes/consultationRoutes');
const medicalRoutes = require('./routes/medicalRoutes');
const orderRoutes = require('./routes/orderRoutes');
const shippingRoutes = require('./routes/shippingRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const reviewRoutes = require('./routes/reviewRoutes');
const analyticsRoutes = require('./routes/analyticsRoutes');
const contactRoutes = require('./routes/contactRoutes');
const errorHandler = require('./middleware/errorHandler');
const { generalLimiter } = require('./middleware/rateLimiter');

const app = express();

// Security Headers
app.disable('x-powered-by');
app.use(helmet({
  crossOriginResourcePolicy: false,
}));

// CORS Configuration
const allowedOrigin = process.env.CLIENT_URL || 'http://localhost:5173';
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps, curl, postman)
    if (!origin) return callback(null, true);
    if (origin === allowedOrigin || origin.startsWith('http://localhost:')) {
      return callback(null, true);
    }
    return callback(new Error('CORS not allowed for this origin: ' + origin));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Body Parsers
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// NoSQL Operator Injection Sanitizer
const { sanitizeMongoOperators } = require('./utils/security');
app.use((req, res, next) => {
  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeMongoOperators(req.body);
  }
  if (req.query && typeof req.query === 'object') {
    req.query = sanitizeMongoOperators(req.query);
  }
  if (req.params && typeof req.params === 'object') {
    req.params = sanitizeMongoOperators(req.params);
  }
  next();
});

// Request Logging in non-test mode
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

// Static folder for avatars & public uploads
app.use('/uploads/avatars', express.static(path.join(__dirname, 'uploads', 'avatars')));

// General Rate Limiter
app.use('/api/', generalLimiter);

// Health Check Endpoint
app.get('/api/health', (req, res) => {
  const dbState = mongoose.connection.readyState;
  const dbStatusMap = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting'
  };

  res.status(200).json({
    success: true,
    message: 'VitaLink API is operational',
    data: {
      status: 'UP',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      database: dbStatusMap[dbState] || 'unknown',
      environment: process.env.NODE_ENV || 'development'
    }
  });
});

// Mount Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/doctors', doctorRoutes);
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/ai', aiRoutes);
app.use('/api/v1/appointments', appointmentRoutes);
app.use('/api/v1/consultations', consultationRoutes);
app.use('/api/v1/medical', medicalRoutes);
app.use('/api/v1/orders', orderRoutes);
app.use('/api/v1/shipping', shippingRoutes);
app.use('/api/v1/notifications', notificationRoutes);
app.use('/api/v1/reviews', reviewRoutes);
app.use('/api/v1/analytics', analyticsRoutes);
app.use('/api/v1/contact', contactRoutes);

// Catch-all 404 for API routes
app.use('/api/*', (req, res) => {
  res.status(404).json({
    success: false,
    message: `Cannot ${req.method} ${req.originalUrl}`,
    code: 'ENDPOINT_NOT_FOUND',
    errors: []
  });
});

// Centralized Error Handling Middleware
app.use(errorHandler);

module.exports = app;
