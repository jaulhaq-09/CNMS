const { startNewsletterScheduler } = require('./newsletterScheduler');
const { startReportScheduler } = require('./reportScheduler');
const logger = require('../utils/logger');

function initJobs() {
  try {
    startNewsletterScheduler();
    startReportScheduler();
    logger.info('✅ Background job schedulers initialized');
  } catch (error) {
    // Don't crash the whole server just because Redis isn't reachable —
    // log it clearly so it's obvious scheduling won't work until Redis
    // is running, but let the rest of the app keep serving requests.
    logger.error('Failed to initialize job schedulers (is Redis running?):', error.message);
  }
}

module.exports = { initJobs };