const winston = require('winston');
const fs = require('fs');
const path = require('path');

const logsDir = path.join(__dirname, '../../logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

const rawLogger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.json()
  ),
  defaultMeta: { service: 'cnms-backend' },
  transports: [
    new winston.transports.File({ filename: path.join(logsDir, 'error.log'), level: 'error' }),
    new winston.transports.File({ filename: path.join(logsDir, 'combined.log') }),
  ],
});

if (process.env.NODE_ENV !== 'production') {
  rawLogger.add(
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(({ level, message, timestamp }) => `${timestamp} [${level}]: ${message}`)
      ),
    })
  );
}

// Every call site in this codebase does logger.error('label:', someValue) —
// two arguments. Winston's splat/interpolation only merges extra args into
// the message when the first string contains %s/%d placeholders, which none
// of ours do, so the second argument was being silently swallowed on every
// single error log in the app. This wrapper joins every argument into one
// string before it ever reaches winston, so nothing gets dropped regardless
// of format string content. Error objects print their full stack, not just
// their message, so you can actually see where something threw.
function formatArg(arg) {
  if (arg instanceof Error) return arg.stack || arg.message;
  if (typeof arg === 'object' && arg !== null) return JSON.stringify(arg);
  return String(arg);
}

function joinArgs(args) {
  return args.map(formatArg).join(' ');
}

const logger = {
  info: (...args) => rawLogger.info(joinArgs(args)),
  warn: (...args) => rawLogger.warn(joinArgs(args)),
  error: (...args) => rawLogger.error(joinArgs(args)),
  debug: (...args) => rawLogger.debug(joinArgs(args)),
};

module.exports = logger;