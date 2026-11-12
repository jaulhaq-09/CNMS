const Queue = require('bull');
const redisConfig = require('../config/redis');
const Newsletter = require('../models/Newsletter');
const User = require('../models/User');
const NewsletterService = require('../services/newsletterService');
const NotificationService = require('../services/notificationService');
const AuditService = require('../services/auditService');
const { sendMonthlyDigest } = require('../services/monthlyDigestService');
const logger = require('../utils/logger');

const newsletterQueue = new Queue('newsletter-scheduler', { redis: redisConfig });

// An unhandled 'error' event on a Bull queue crashes the whole server,
// so a Redis hiccup is logged instead.
newsletterQueue.on('error', (err) => {
  logger.error(`[newsletterScheduler] Redis connection error: ${err.message}`);
});

const TIMEZONE = 'Asia/Kolkata';
// On the last day of the month, the college-wide draft is created at or
// after this hour (IST). The 5-minute tick below makes it self-healing:
// if the server was down at 18:00 it still happens when it comes back up.
const MONTHLY_DRAFT_HOUR = 18;

const pad = (n) => String(n).padStart(2, '0');

// Today's date and hour as seen in India, regardless of server timezone.
function istNow(now = new Date()) {
  const date = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now); // YYYY-MM-DD
  const hour = Number(
    new Intl.DateTimeFormat('en-GB', { timeZone: TIMEZONE, hour: '2-digit', hourCycle: 'h23' }).format(now)
  );
  const [year, month, day] = date.split('-').map(Number);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return {
    today: date,
    hour,
    isLastDay: day === lastDay,
    monthStart: `${year}-${pad(month)}-01`,
    monthKey: `${year}-${pad(month)}`,
  };
}

// ---- 1. Publish newsletters whose scheduled time has arrived -----------

async function publishDueNewsletters(now) {
  const due = await Newsletter.find({ status: 'SCHEDULED', scheduledFor: { $lte: now } });
  let published = 0;

  for (const newsletter of due) {
    try {
      await NewsletterService.publishNewsletter(newsletter._id, undefined);
      published += 1;
      logger.info(`[newsletterScheduler] Published scheduled newsletter ${newsletter._id}`);
    } catch (error) {
      logger.error(
        `[newsletterScheduler] Failed to publish newsletter ${newsletter._id}: ${error.message}`
      );
    }
  }
  return published;
}

// ---- 2. Month-end: create the college-wide draft and tell the Admin ----

// Remembers which month was already handled in this process, so a month
// with nothing to publish does not re-notify the Admin every 5 minutes.
let handledMonth = null;

async function notifyAdmins(admins, { title, message, newsletterId }) {
  for (const admin of admins) {
    try {
      await NotificationService.createNotification(
        {
          recipient: admin._id,
          type: 'APPROVAL_COMPLETED',
          title,
          message,
          data: { newsletterId, relatedUrl: '/newsletters' },
        },
        null
      );
    } catch (error) {
      logger.error(`[newsletterScheduler] Notification failed for ${admin.email}: ${error.message}`);
    }
  }
}

async function createMonthlyDraft(now) {
  const t = istNow(now);
  const forced = process.env.FORCE_MONTH_END === 'true';
  if (!forced && (!t.isLastDay || t.hour < MONTHLY_DRAFT_HOUR)) return null;
  if (handledMonth === t.monthKey) return null;

  // Already have a college-wide issue for this exact period? Then we're done.
  const existing = await Newsletter.findOne({
    department: null,
    periodStartDate: new Date(t.monthStart),
    periodEndDate: new Date(t.today),
  });
  if (existing) {
    handledMonth = t.monthKey;
    return null;
  }

  const admins = await User.find({
    $or: [{ role: 'SUPER_ADMIN' }, { roles: 'SUPER_ADMIN' }],
    isActive: { $ne: false },
  })
    .select('firstName lastName email')
    .sort({ createdAt: 1 });
  if (admins.length === 0) {
    logger.warn('[newsletterScheduler] No active Super Admin; monthly draft skipped');
    return null;
  }

  handledMonth = t.monthKey;
  const monthLabel = new Date(`${t.monthStart}T00:00:00Z`).toLocaleDateString('en-IN', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });

  try {
    const newsletter = await NewsletterService.generateNewsletter(
      t.monthStart,
      t.today,
      undefined,
      admins[0]._id,
      null // college-wide
    );

    try {
      await AuditService.log(
        'NEWSLETTER_GENERATED',
        admins[0]._id,
        'Newsletter',
        newsletter._id,
        { startDate: t.monthStart, endDate: t.today, department: 'college-wide', automatic: true },
        newsletter.name
      );
    } catch (error) {
      logger.error(`[newsletterScheduler] Audit failed: ${error.message}`);
    }

    await notifyAdmins(admins, {
      title: `${monthLabel} newsletter draft is ready`,
      message: 'The monthly college newsletter has been drafted. Review it, then publish or schedule it.',
      newsletterId: newsletter._id,
    });

    logger.info(`[newsletterScheduler] Monthly draft created for ${monthLabel}: ${newsletter._id}`);
    await sendMonthlyDigest({ admins, start: t.monthStart, end: t.today, monthLabel, newsletter });
    return newsletter;
  } catch (error) {
    logger.error(`[newsletterScheduler] Monthly draft failed: ${error.message}`);
    await notifyAdmins(admins, {
      title: `${monthLabel} newsletter could not be drafted`,
      message: `${error.message}. You can still create one manually from the Newsletters page.`,
    });
    await sendMonthlyDigest({ admins, start: t.monthStart, end: t.today, monthLabel, newsletter: null });
    return null;
  }
}

newsletterQueue.process(async () => {
  const now = new Date();
  const published = await publishDueNewsletters(now);
  const draft = await createMonthlyDraft(now);
  return { published, drafted: draft ? 1 : 0 };
});

newsletterQueue.on('failed', (job, err) => {
  logger.error(`[newsletterScheduler] Job failed: ${err.message}`);
});

function startNewsletterScheduler() {
  newsletterQueue.add(
    {},
    {
      repeat: { every: 5 * 60 * 1000 }, // every 5 minutes
      removeOnComplete: true,
      removeOnFail: true,
    }
  );
  logger.info('[newsletterScheduler] Repeating job registered (every 5 min)');
}

module.exports = { newsletterQueue, startNewsletterScheduler };