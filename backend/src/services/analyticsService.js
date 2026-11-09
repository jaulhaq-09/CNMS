const Event = require('../models/Event');
const Newsletter = require('../models/Newsletter');
const NewsletterTemplate = require('../models/NewsletterTemplate');
const User = require('../models/User');
const logger = require('../utils/logger');
const { getCached, setCached } = require('../utils/cache');
class AnalyticsService {
  static getDateRangeStart(days) {
    const start = new Date();
    start.setDate(start.getDate() - parseInt(days, 10));
    start.setHours(0, 0, 0, 0);
    return start;
  }

  static async getEventStats(days = 30, scope = {}) {
    try {
      const since = this.getDateRangeStart(days);
      const base = { createdAt: { $gte: since }, ...scope };

      const [total, approved, pending, rejected, byTypeAgg] = await Promise.all([
        Event.countDocuments(base),
        Event.countDocuments({ ...base, status: { $in: ['APPROVED', 'PUBLISHED'] } }),
        Event.countDocuments({ ...base, status: { $in: ['SUBMITTED', 'UNDER_REVIEW'] } }),
        Event.countDocuments({ ...base, status: 'REJECTED' }),
        Event.aggregate([
          { $match: base },
          { $group: { _id: '$eventType', count: { $sum: 1 } } },
        ]),
      ]);

      const byType = {};
      byTypeAgg.forEach((row) => {
        byType[row._id] = row.count;
      });

      return { total, approved, pending, rejected, byType };
    } catch (error) {
      logger.error('Analytics getEventStats error:', error.message);
      throw error;
    }
  }

  static async getNewsletterStats(days = 30, scope = {}) {
    try {
      const since = this.getDateRangeStart(days);

      const [total, published, scheduled, publishedNewsletters] = await Promise.all([
        Newsletter.countDocuments({ createdAt: { $gte: since }, ...scope }),
        Newsletter.countDocuments({ createdAt: { $gte: since }, status: 'PUBLISHED', ...scope }),
        Newsletter.countDocuments({ createdAt: { $gte: since }, status: 'SCHEDULED', ...scope }),
        Newsletter.find({ createdAt: { $gte: since }, status: 'PUBLISHED', ...scope }),
      ]);

      let totalRecipients = 0;
      let totalSent = 0;
      let totalOpened = 0;
      let totalClicked = 0;

      publishedNewsletters.forEach((n) => {
        totalRecipients += n.deliveryStats?.totalSent || 0;
        totalSent += n.deliveryStats?.totalSent || 0;
        totalOpened += n.deliveryStats?.opened || 0;
        totalClicked += n.deliveryStats?.clicked || 0;
      });

      const avgOpenRate = totalSent > 0 ? Math.round((totalOpened / totalSent) * 100) : 0;
      const avgClickRate = totalSent > 0 ? Math.round((totalClicked / totalSent) * 100) : 0;

      const byMonthAgg = await Newsletter.aggregate([
        { $match: { status: 'PUBLISHED', publishedAt: { $gte: since }, ...scope } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m', date: '$publishedAt' } },
            sent: { $sum: '$deliveryStats.totalSent' },
            opened: { $sum: '$deliveryStats.opened' },
            clicked: { $sum: '$deliveryStats.clicked' },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]);

      const MONTH_LABELS = [
        'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
        'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
      ];

      const byMonth = byMonthAgg.map((row) => {
        const [, monthNum] = row._id.split('-');
        return {
          month: MONTH_LABELS[parseInt(monthNum, 10) - 1],
          sent: row.sent,
          opened: row.opened,
          clicked: row.clicked,
        };
      });

      return {
        total,
        published,
        scheduled,
        totalRecipients,
        avgOpenRate,
        avgClickRate,
        byMonth,
      };
    } catch (error) {
      logger.error('Analytics getNewsletterStats error:', error.message);
      throw error;
    }
  }

  // NOTE: there is no per-day activity log in this schema (no login
  // history beyond a single `lastLogin` timestamp, no template creation
  // audit trail beyond `createdAt`). "users" here is an approximation —
  // distinct users whose most recent login fell on that day — not a
  // true daily-active-users count. Good enough for a trend line, not
  // for anything that needs to be exact.
  static async getActivityStats(days = 30, scope = {}) {
    try {
      const since = this.getDateRangeStart(days);

      const [eventsAgg, newslettersAgg, templatesAgg, usersAgg] = await Promise.all([
        Event.aggregate([
          { $match: { createdAt: { $gte: since }, ...scope } },
          { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, count: { $sum: 1 } } },
        ]),
        Newsletter.aggregate([
          { $match: { createdAt: { $gte: since }, ...scope } },
          { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, count: { $sum: 1 } } },
        ]),
        NewsletterTemplate.aggregate([
          { $match: { createdAt: { $gte: since } } },
          { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, count: { $sum: 1 } } },
        ]),
        User.aggregate([
          { $match: { lastLogin: { $gte: since }, ...scope } },
          { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$lastLogin' } }, count: { $sum: 1 } } },
        ]),
      ]);

      const eventsByDay = Object.fromEntries(eventsAgg.map((r) => [r._id, r.count]));
      const newslettersByDay = Object.fromEntries(newslettersAgg.map((r) => [r._id, r.count]));
      const templatesByDay = Object.fromEntries(templatesAgg.map((r) => [r._id, r.count]));
      const usersByDay = Object.fromEntries(usersAgg.map((r) => [r._id, r.count]));

      const activity = [];
      const cursor = new Date(since);
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      while (cursor <= today) {
        const key = cursor.toISOString().slice(0, 10); // YYYY-MM-DD
        const label = cursor.toLocaleDateString('en-US', { weekday: 'short' });

        activity.push({
          date: label,
          fullDate: key,
          events: eventsByDay[key] || 0,
          newsletters: newslettersByDay[key] || 0,
          templates: templatesByDay[key] || 0,
          users: usersByDay[key] || 0,
        });

        cursor.setDate(cursor.getDate() + 1);
      }

      return activity;
    } catch (error) {
      logger.error('Analytics getActivityStats error:', error.message);
      throw error;
    }
  }

  static async getDashboardSummary(days = 30, scope = {}, scopeKey = 'all') {
    const cacheKey = `analytics:dashboard:${days}:${scopeKey}`;

    try {
      const cached = await getCached(cacheKey);
      if (cached) return cached;

      const [events, newsletters, activity] = await Promise.all([
        this.getEventStats(days, scope),
        this.getNewsletterStats(days, scope),
        this.getActivityStats(days, scope),
      ]);

      const summary = { events, newsletters, activity };

      // Short TTL — this data shifts whenever an event/newsletter is
      // approved or published, and there's no cache-invalidation hook
      // wired into those flows yet, so a short expiry is what keeps
      // this from serving stale numbers for too long.
      await setCached(cacheKey, summary, 60);

      return summary;
    } catch (error) {
      logger.error('Analytics getDashboardSummary error:', error.message);
      throw error;
    }
  }
}
module.exports = AnalyticsService;