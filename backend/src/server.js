require('dotenv').config();

const app = require('./app');
const http = require('http');
const socketIo = require('socket.io');
const connectDB = require('./config/database');
const logger = require('./utils/logger');
const { initJobs } = require('./jobs');

const PORT = process.env.PORT || 5000;

// Connect to MongoDB
connectDB();

// Create HTTP server
const server = http.createServer(app);

// Setup Socket.io
const io = socketIo(server, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    methods: ['GET', 'POST'],
    credentials: true,
  },
  transports: ['websocket', 'polling'],
});

// Store io instance in app
app.set('io', io);

// Socket.io connection handling
io.on('connection', (socket) => {
  logger.info(`User connected: ${socket.id}`);

  // Join user to their personal room
  socket.on('user:join', (userId) => {
    socket.join(`user_${userId}`);
    logger.info(`User ${userId} joined their room`);
  });

  // Handle notifications
  socket.on('notification:subscribe', (userId) => {
    socket.join(`notifications_${userId}`);
    logger.info(`User ${userId} subscribed to notifications`);
  });

  // Handle real-time updates
  socket.on('event:updated', (data) => {
    io.emit('event:changed', data);
    logger.info('Event updated:', data.eventId);
  });

  socket.on('newsletter:published', (data) => {
    io.emit('newsletter:live', data);
    logger.info('Newsletter published:', data.newsletterId);
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    logger.info(`User disconnected: ${socket.id}`);
  });

  // Error handling
  socket.on('error', (error) => {
    logger.error('Socket error:', error);
  });
});

// Start server
const serverInstance = server.listen(PORT, () => {
  logger.info(`✅ Server running on http://localhost:${PORT}`);
  logger.info(`📊 Environment: ${process.env.NODE_ENV}`);
  logger.info(`🔌 WebSocket ready for real-time updates`);
  initJobs();
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received. Shutting down gracefully...');
  serverInstance.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('SIGINT received. Shutting down gracefully...');
  serverInstance.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});

process.on('unhandledRejection', (err) => {
  logger.error('Unhandled Rejection:', err);
  serverInstance.close(() => {
    process.exit(1);
  });
});