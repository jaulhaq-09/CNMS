const Queue = require('bull');
const redisConfig = require('../config/redis');
const Report = require('../models/Report');
const ReportService = require('../services/reportService');
const EmailService = require('../services/emailService');

const FORMAT_META = {
  PDF: { ext: 'pdf', mime: 'application/pdf' },
  EXCEL: { ext: 'xlsx', mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
  CSV: { ext: 'csv', mime: 'text/csv' },
};
const logger = require('../utils/logger');

const reportQueue = new Queue('report-scheduler', { redis: redisConfig });

// Same reasoning as newsletterScheduler.js — an unhandled 'error' event
// here crashes the whole server, not just this queue.
reportQueue.on('error', (err) => {
  logger.error(`[reportScheduler] Redis connection error: ${err.message}`);
});

// Report has no nextRun/lastRun tracker field — only scheduling config
// (frequency/dayOfWeek/dayOfMonth/time) plus lastGenerated.date and
// generationHistory. So "is this due" has to be computed fresh each
// tick, and we use lastGenerated.date to make sure we don't fire twice
// inside the same period if the server restarts mid-window.
function isReportDue(report, now) {
  const { frequency, dayOfWeek, dayOfMonth, time } = report.scheduling;
  if (!frequency || !time) return false;

  const [targetHour, targetMinute] = time.split(':').map(Number);
  if (Number.isNaN(targetHour) || Number.isNaN(targetMinute)) return false;

  // Only fire within the same 5-minute tick window as the target time,
  // since this job runs every 5 minutes (see startReportScheduler).
  const withinTimeWindow =
    now.getHours() === targetHour && Math.abs(now.getMinutes() - targetMinute) < 5;

  if (!withinTimeWindow) return false;

  const lastRun = report.lastGenerated?.date ? new Date(report.lastGenerated.date) : null;

  switch (frequency) {
    case 'DAILY':
      if (lastRun && isSameCalendarDay(lastRun, now)) return false;
      return true;

    case 'WEEKLY':
      if (dayOfWeek === undefined || dayOfWeek === null) return false;
      if (now.getDay() !== dayOfWeek) return false;
      if (lastRun && isSameCalendarDay(lastRun, now)) return false;
      return true;

    case 'MONTHLY':
      if (!dayOfMonth) return false;
      if (now.getDate() !== dayOfMonth) return false;
      if (lastRun && isSameCalendarDay(lastRun, now)) return false;
      return true;

    case 'QUARTERLY':
      if (!dayOfMonth) return false;
      if (now.getDate() !== dayOfMonth) return false;
      if (![0, 3, 6, 9].includes(now.getMonth())) return false;
      if (lastRun && isSameCalendarDay(lastRun, now)) return false;
      return true;

    case 'YEARLY':
      if (!dayOfMonth) return false;
      if (now.getDate() !== dayOfMonth || now.getMonth() !== 0) return false;
      if (lastRun && isSameCalendarDay(lastRun, now)) return false;
      return true;

    default:
      return false;
  }
}

function isSameCalendarDay(a, b) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

reportQueue.process(async () => {
  const now = new Date();

  const candidates = await Report.find({ 'scheduling.enabled': true });
  const due = candidates.filter((report) => isReportDue(report, now));

  if (due.length === 0) {
    return { generated: 0 };
  }

  let generated = 0;

  for (const report of due) {
    try {
      const data = await ReportService.generateReportData(report);

      const recipients = report.scheduling?.recipients || [];
      if (recipients.length > 0) {
        const meta = FORMAT_META[report.format] || FORMAT_META.PDF;
        const result = await EmailService.sendReportEmail(recipients, report, {
          data,
          filename: report.lastGenerated?.fileName || `${report.name}.${meta.ext}`,
          mime: meta.mime,
        });
        logger.info(
          `[reportScheduler] Report ${report._id} emailed: ${result.delivered} sent, ${result.failed} failed`
        );
      }

      generated += 1;
      logger.info(`[reportScheduler] Auto-generated report ${report._id}`);
    } catch (error) {
      logger.error(
        `[reportScheduler] Failed to generate report ${report._id}: ${error.message}`
      );
    }
  }

  return { generated };
});

reportQueue.on('failed', (job, err) => {
  logger.error(`[reportScheduler] Job failed: ${err.message}`);
});

function startReportScheduler() {
  reportQueue.add(
    {},
    {
      repeat: { every: 5 * 60 * 1000 }, // every 5 minutes
      removeOnComplete: true,
      removeOnFail: true,
    }
  );
  logger.info('[reportScheduler] Repeating job registered (every 5 min)');
}

module.exports = { reportQueue, startReportScheduler };