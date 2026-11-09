const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const logger = require('./utils/logger');
const socketIo = require('socket.io');
const path = require('path');

const app = express();

// Security middleware
app.use(
  helmet({
    // Default CORP (same-origin) blocks the frontend (port 5173) from
    // loading images served from here (port 5000) even though CORS is
    // already configured correctly for API calls — CORP is a separate,
    // stricter check that applies to embedded resources like <img> tags.
    // This affects both event photos and profile photos, since both are
    // served the same way via the /uploads static route below.
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);

// CORS — restricted to the actual frontend origin instead of wide open.
// Falls back to the local dev URL if CLIENT_URL isn't set, so this never
// silently allows every origin even if the env var is missing.
app.use(
  cors({
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    credentials: true,
  })
);

// Body parser middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  message: 'Too many requests from this IP, please try again later.',
});
app.use('/api/', limiter);

// Request logging middleware
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`);
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Socket.io setup will be done in server.js
// We'll pass io instance to routes via middleware
app.use((req, res, next) => {
  req.io = req.app.get('io');
  next();
});

// Import routes
const passport = require('passport');
require('./config/passport');
app.use(passport.initialize());

const authRoutes = require('./routes/auth.routes');
const eventRoutes = require('./routes/event.routes');
const newsletterRoutes = require('./routes/newsletter.routes');
const userRoutes = require('./routes/user.routes');
const userImportRoutes = require('./routes/userImport.routes');
const templateRoutes = require('./routes/template.routes');
const notificationRoutes = require('./routes/notification.routes');
const searchRoutes = require('./routes/search.routes');
const exportRoutes = require('./routes/export.routes');
const reportRoutes = require('./routes/report.routes');
const aiRoutes = require('./routes/ai.routes');
const departmentRoutes = require('./routes/department.routes');
const analyticsRoutes = require('./routes/analytics.routes');
const auditRoutes = require('./routes/audit.routes');
const settingsRoutes = require('./routes/settings.routes');
const nptelRoutes = require('./routes/nptel.routes');
const publicationRoutes = require('./routes/publication.routes');
const facultyAchievementRoutes = require('./routes/facultyAchievement.routes');
const patentRoutes = require('./routes/patent.routes');
const clusterRoutes = require('./routes/cluster.routes');
const sectionRoutes = require('./routes/section.routes');
// Register routes
app.use('/api/auth', authRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/newsletters', newsletterRoutes);
app.use('/api/publications', publicationRoutes);
app.use('/api/users', userRoutes);
app.use('/api/user-import', userImportRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/templates', templateRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/export', exportRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/departments', departmentRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/audit-logs', auditRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/nptel-courses', nptelRoutes);
app.use('/api/faculty-achievements', facultyAchievementRoutes);
app.use('/api/patents', patentRoutes);
app.use('/api/clusters', clusterRoutes);
app.use('/api/sections', sectionRoutes);

app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
    path: req.path,
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error('Error:', err);

  const status = err.statusCode || err.status || 500;
  const message = err.message || 'Internal Server Error';

  res.status(status).json({
    success: false,
    message,
    ...(process.env.NODE_ENV === 'development' && { error: err }),
  });
});

module.exports = app;