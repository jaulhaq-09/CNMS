const AuditLog = require('../models/AuditLog');
const logger = require('../utils/logger');

class AuditService {
  // Deliberately swallows its own errors — an audit log failing to write
  // should never be the reason a real action (approving an event,
  // publishing a newsletter) fails for the user. Same fallback philosophy
  // already used for the in-app notification calls elsewhere in the app.
  static async log(action, actorId, targetType, targetId, metadata = {}, targetLabel = '') {
    try {
      await AuditLog.create({
        action,
        actor: actorId,
        targetType,
        targetId,
        targetLabel: targetLabel || undefined,
        metadata,
      });
    } catch (error) {
      logger.error(`Audit log write failed for ${action}:`, error.message);
    }
  }

  static async getLogsForTarget(targetType, targetId, limit = 50) {
    try {
      return await AuditLog.find({ targetType, targetId })
        .sort({ createdAt: -1 })
        .limit(limit)
        .populate('actor', 'firstName lastName email');
    } catch (error) {
      logger.error('Get audit logs error:', error.message);
      throw error;
    }
  }

  static async getPaginatedLogs(page = 1, limit = 20, filters = {}) {
    try {
      const skip = (page - 1) * limit;
      const query = {};
      if (filters.action) query.action = filters.action;
      if (filters.targetType) query.targetType = filters.targetType;
      if (filters.actor) query.actor = filters.actor;

      // The page sends full ISO times, already adjusted to the user's own
      // start and end of day, so they are used exactly as given.
      const from = filters.from ? new Date(filters.from) : null;
      const to = filters.to ? new Date(filters.to) : null;
      if ((from && !Number.isNaN(from.getTime())) || (to && !Number.isNaN(to.getTime()))) {
        query.createdAt = {};
        if (from && !Number.isNaN(from.getTime())) query.createdAt.$gte = from;
        if (to && !Number.isNaN(to.getTime())) query.createdAt.$lte = to;
      }

      const [logs, total] = await Promise.all([
        AuditLog.find(query)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .populate('actor', 'firstName lastName email'),
        AuditLog.countDocuments(query),
      ]);

      return {
        logs,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      logger.error('Get paginated audit logs error:', error.message);
      throw error;
    }
  }

  // People who appear in the log, for the "Performed by" filter.
  static async getActors() {
    try {
      const ids = await AuditLog.distinct('actor');
      const User = require('../models/User');
      return await User.find({ _id: { $in: ids } })
        .select('firstName lastName role')
        .sort({ firstName: 1 });
    } catch (error) {
      logger.error('Get audit actors error:', error.message);
      throw error;
    }
  }

  static async getRecentLogs(limit = 100) {
    try {
      return await AuditLog.find()
        .sort({ createdAt: -1 })
        .limit(limit)
        .populate('actor', 'firstName lastName email');
    } catch (error) {
      logger.error('Get recent audit logs error:', error.message);
      throw error;
    }
  }
}

module.exports = AuditService;