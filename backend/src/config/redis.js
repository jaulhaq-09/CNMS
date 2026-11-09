// Bull manages its own internal Redis client (via ioredis under the hood)
// — we just need to hand it connection options, not a live client.
// This is separate from the `redis` package already in package.json,
// which (if used elsewhere) is a different client library entirely.

const redisConfig = {
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
  password: process.env.REDIS_PASSWORD || undefined,
  // Bull's own docs recommend this: without it, ioredis gives up after
  // 20 failed retries and throws MaxRetriesPerRequestError as an
  // unhandled rejection from deep inside Bull's internal job-polling
  // logic — a path the queue.on('error', ...) handlers in the
  // scheduler files don't catch, since that only covers the queue's
  // own connection-level errors, not individual command rejections.
  // Setting this to null makes ioredis retry indefinitely and quietly
  // instead of ever throwing.
  maxRetriesPerRequest: null,
};

module.exports = redisConfig;