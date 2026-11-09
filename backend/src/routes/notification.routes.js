const express = require('express');
const router = express.Router();
const NotificationService = require('../services/notificationService');
const authenticate = require('../middleware/authenticate');
const logger = require('../utils/logger');

// Get all notifications
router.get('/', authenticate, async (req, res) => {
  try {
    const { page = 1, limit = 20, read, type, priority } = req.query;

    const filters = {};
    if (read) filters.read = read;
    if (type) filters.type = type;
    if (priority) filters.priority = priority;

    const result = await NotificationService.getNotifications(
      req.user._id,
      parseInt(page),
      parseInt(limit),
      filters
    );

    res.json({
      success: true,
      data: result.notifications,
      pagination: result.pagination,
    });
  } catch (error) {
    logger.error('Get notifications error:', error.message);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// Get single notification
router.get('/:id', authenticate, async (req, res) => {
  try {
    const notification = await NotificationService.getNotificationById(req.params.id);

    if (notification.recipient._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized',
      });
    }

    res.json({
      success: true,
      data: notification,
    });
  } catch (error) {
    logger.error('Get notification error:', error.message);
    res.status(404).json({
      success: false,
      message: error.message,
    });
  }
});

// Mark as read
router.put('/:id/read', authenticate, async (req, res) => {
  try {
    const notification = await NotificationService.markAsRead(req.params.id, req.user._id);

    res.json({
      success: true,
      message: 'Notification marked as read',
      data: notification,
    });
  } catch (error) {
    logger.error('Mark as read error:', error.message);
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
});

// Mark all as read
router.put('/read/all', authenticate, async (req, res) => {
  try {
    const result = await NotificationService.markAllAsRead(req.user._id);

    res.json({
      success: true,
      message: 'All notifications marked as read',
      modifiedCount: result.modifiedCount,
    });
  } catch (error) {
    logger.error('Mark all as read error:', error.message);
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
});

// Delete notification
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const result = await NotificationService.deleteNotification(req.params.id, req.user._id);

    res.json({
      success: true,
      message: result.message,
    });
  } catch (error) {
    logger.error('Delete notification error:', error.message);
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
});

// Delete all notifications
router.delete('/', authenticate, async (req, res) => {
  try {
    const result = await NotificationService.deleteAllNotifications(req.user._id);

    res.json({
      success: true,
      message: result.message,
      count: result.count,
    });
  } catch (error) {
    logger.error('Delete all notifications error:', error.message);
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
});

// Get unread count
router.get('/count/unread', authenticate, async (req, res) => {
  try {
    const count = await NotificationService.getUnreadCount(req.user._id);

    res.json({
      success: true,
      data: { unreadCount: count },
    });
  } catch (error) {
    logger.error('Get unread count error:', error.message);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// Get notification stats
router.get('/stats/overview', authenticate, async (req, res) => {
  try {
    const stats = await NotificationService.getNotificationStats(req.user._id);

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    logger.error('Get stats error:', error.message);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

module.exports = router;