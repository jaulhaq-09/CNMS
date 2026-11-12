const mongoose = require('mongoose');
const Notification = require('../models/Notification');
const User = require('../models/User');
const logger = require('../utils/logger');

class NotificationService {
  static async createNotification(notificationData, io = null) {
    try {
      const notification = new Notification(notificationData);
      await notification.save();
      await notification.populate('sender', 'firstName lastName email profilePhoto');
      await notification.populate('recipient', 'email');

      logger.info(`Notification created: ${notification._id}`);

      if (io) {
        io.to(`user_${notificationData.recipient}`).emit('notification:new', {
          id: notification._id,
          type: notification.type,
          title: notification.title,
          message: notification.message,
          createdAt: notification.createdAt,
        });
      }

      return notification;
    } catch (error) {
      logger.error('Create notification error:', error);
      throw error;
    }
  }

  static async getNotifications(userId, page = 1, limit = 20, filters = {}) {
    try {
      const skip = (page - 1) * limit;

      const query = { recipient: userId };

      if (filters.read === 'true') {
        query['channels.inApp.read'] = true;
      } else if (filters.read === 'false') {
        query['channels.inApp.read'] = false;
      }

      if (filters.type) {
        query.type = filters.type;
      }

      if (filters.priority) {
        query.priority = filters.priority;
      }

      const notifications = await Notification.find(query)
        .skip(skip)
        .limit(limit)
        .sort({ createdAt: -1 })
        .populate('sender', 'firstName lastName email profilePhoto');

      const total = await Notification.countDocuments(query);

      return {
        notifications,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(total / limit),
          totalCount: total,
          unreadCount: await Notification.countDocuments({
            recipient: userId,
            'channels.inApp.read': false,
          }),
        },
      };
    } catch (error) {
      logger.error('Get notifications error:', error);
      throw error;
    }
  }

  static async getNotificationById(id) {
    try {
      const notification = await Notification.findById(id)
        .populate('sender', 'firstName lastName email profilePhoto')
        .populate('recipient', 'email');

      if (!notification) {
        throw new Error('Notification not found');
      }

      return notification;
    } catch (error) {
      logger.error('Get notification error:', error);
      throw error;
    }
  }

  static async markAsRead(notificationId, userId) {
    try {
      const notification = await Notification.findById(notificationId);

      if (!notification) {
        throw new Error('Notification not found');
      }

      if (notification.recipient.toString() !== userId.toString()) {
        throw new Error('Unauthorized');
      }

      notification.channels.inApp.read = true;
      notification.channels.inApp.readAt = new Date();
      notification.status = 'DELIVERED';

      await notification.save();

      logger.info(`Notification marked as read: ${notificationId}`);

      return notification;
    } catch (error) {
      logger.error('Mark as read error:', error);
      throw error;
    }
  }

  static async markAllAsRead(userId) {
    try {
      const result = await Notification.updateMany(
        {
          recipient: userId,
          'channels.inApp.read': false,
        },
        {
          $set: {
            'channels.inApp.read': true,
            'channels.inApp.readAt': new Date(),
          },
        }
      );

      logger.info(`Marked ${result.modifiedCount} notifications as read for user ${userId}`);

      return result;
    } catch (error) {
      logger.error('Mark all as read error:', error);
      throw error;
    }
  }

  static async deleteNotification(notificationId, userId) {
    try {
      const notification = await Notification.findById(notificationId);

      if (!notification) {
        throw new Error('Notification not found');
      }

      if (notification.recipient.toString() !== userId.toString()) {
        throw new Error('Unauthorized');
      }

      await Notification.findByIdAndDelete(notificationId);

      logger.info(`Notification deleted: ${notificationId}`);

      return { message: 'Notification deleted successfully' };
    } catch (error) {
      logger.error('Delete notification error:', error);
      throw error;
    }
  }

  static async deleteAllNotifications(userId) {
    try {
      const result = await Notification.deleteMany({ recipient: userId });

      logger.info(`Deleted ${result.deletedCount} notifications for user ${userId}`);

      return { message: 'All notifications deleted', count: result.deletedCount };
    } catch (error) {
      logger.error('Delete all notifications error:', error);
      throw error;
    }
  }

  static async sendNotificationToRole(role, notificationData, io = null) {
    try {
      const users = await User.find({
        $or: [{ role }, { roles: role }],
      });

      const notifications = [];
      for (const user of users) {
        const notification = await this.createNotification(
          { ...notificationData, recipient: user._id },
          io
        );
        notifications.push(notification);
      }

      logger.info(`Sent ${notifications.length} notifications to role ${role}`);

      return notifications;
    } catch (error) {
      logger.error('Send to role error:', error);
      throw error;
    }
  }

  static async sendNotificationToDepartment(departmentId, notificationData, io = null) {
    try {
      const users = await User.find({ department: departmentId });

      const notifications = [];
      for (const user of users) {
        const notification = await this.createNotification(
          { ...notificationData, recipient: user._id },
          io
        );
        notifications.push(notification);
      }

      logger.info(`Sent ${notifications.length} notifications to department ${departmentId}`);

      return notifications;
    } catch (error) {
      logger.error('Send to department error:', error);
      throw error;
    }
  }

  // Notify everyone assigned to a specific cluster. `clusters` is now an
  // array field on User (a person can belong to several) — querying
  // { clusters: clusterName } matches any document whose array CONTAINS
  // that value, which is exactly what we want here.
  static async sendNotificationToCluster(clusterName, notificationData, io = null) {
    try {
      const users = await User.find({ clusters: clusterName });

      const notifications = [];
      for (const user of users) {
        const notification = await this.createNotification(
          { ...notificationData, recipient: user._id },
          io
        );
        notifications.push(notification);
      }

      logger.info(`Sent ${notifications.length} notifications to cluster ${clusterName}`);

      return notifications;
    } catch (error) {
      logger.error('Send to cluster error:', error);
      throw error;
    }
  }

  // Finds the ONE active Coordinator responsible for this item's department +
  // cluster, and notifies only them. Returns null if there is none.
  static async sendNotificationToCoordinator(item, notificationData, io = null) {
    try {
      if (!item.department || !item.cluster) return null;

      const coordinator = await User.findOne({
        $or: [{ role: 'COORDINATOR' }, { roles: 'COORDINATOR' }],
        isActive: true,
        department: item.department._id || item.department,
        clusters: item.cluster,
      });

      if (!coordinator) {
        logger.warn(`No active coordinator for cluster "${item.cluster}" - nobody notified`);
        return null;
      }

      return await this.createNotification(
        { ...notificationData, recipient: coordinator._id },
        io
      );
    } catch (error) {
      logger.error('Send to coordinator error:', error);
      throw error;
    }
  }

  static async getUnreadCount(userId) {
    try {
      const count = await Notification.countDocuments({
        recipient: userId,
        'channels.inApp.read': false,
      });

      return count;
    } catch (error) {
      logger.error('Get unread count error:', error);
      throw error;
    }
  }

  static async getNotificationStats(userId) {
    try {
      const total = await Notification.countDocuments({ recipient: userId });
      const unread = await Notification.countDocuments({
        recipient: userId,
        'channels.inApp.read': false,
      });
      const byType = await Notification.aggregate([
        { $match: { recipient: new mongoose.Types.ObjectId(userId) } },
        { $group: { _id: '$type', count: { $sum: 1 } } },
      ]);

      return {
        total,
        unread,
        read: total - unread,
        byType,
      };
    } catch (error) {
      logger.error('Get stats error:', error);
      throw error;
    }
  }
}

module.exports = NotificationService;