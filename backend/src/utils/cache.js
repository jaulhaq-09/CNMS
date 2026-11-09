const Redis = require('ioredis');
const redisConfig = require('../config/redis');
const logger = require('./logger');

// Separate connection from the ones Bull manages internally — this one
// is purely for application-level caching (search results, analytics
// summaries), so its failure modes are independent of job scheduling.
//
// lazyConnect + the retryStrategy below mean: if Redis is down, this
// client fails quietly and every helper below just falls through to
// "cache miss" behavior instead of throwing. Caching is an optimization,
// not a dependency — the app must work identically (just slower)
// whether Redis is reachable or not.
const client = new Redis({
    ...redisConfig,
    maxRetriesPerRequest: 1, // fail fast per-command instead of hanging
    retryStrategy: (times) => {
        if (times > 3) return null; // stop retrying after 3 attempts, go quiet
        return Math.min(times * 200, 1000);
    },
    lazyConnect: true,
});

let connectionAttempted = false;
let isAvailable = false;

client.on('error', (err) => {
    // Only log the *first* error to avoid flooding logs the way the Bull
    // queues did before their retry limits were fixed — after that, cache
    // calls just silently miss.
    if (isAvailable) {
        logger.error(`[cache] Redis connection lost: ${err.message}`);
    }
    isAvailable = false;
});

client.on('ready', () => {
    isAvailable = true;
    logger.info('[cache] Redis cache connected');
});

async function ensureConnected() {
    if (connectionAttempted) return;
    connectionAttempted = true;
    try {
        await client.connect();
    } catch (err) {
        logger.warn(`[cache] Redis unavailable, caching disabled: ${err.message}`);
    }
}

const DEFAULT_TTL_SECONDS = 60; // short TTL — search/analytics data changes often

async function getCached(key) {
    await ensureConnected();
    if (!isAvailable) return null;
    try {
        const raw = await client.get(key);
        return raw ? JSON.parse(raw) : null;
    } catch (err) {
        logger.warn(`[cache] get failed for ${key}: ${err.message}`);
        return null;
    }
}

async function setCached(key, value, ttlSeconds = DEFAULT_TTL_SECONDS) {
    await ensureConnected();
    if (!isAvailable) return;
    try {
        await client.set(key, JSON.stringify(value), 'EX', ttlSeconds);
    } catch (err) {
        logger.warn(`[cache] set failed for ${key}: ${err.message}`);
    }
}

// Used to invalidate cached search/analytics results after a mutation
// (e.g. a new event gets approved). Best-effort — a failed invalidation
// just means a stale cache entry expires naturally via its TTL instead.
async function invalidatePattern(pattern) {
    await ensureConnected();
    if (!isAvailable) return;
    try {
        const keys = await client.keys(pattern);
        if (keys.length > 0) await client.del(...keys);
    } catch (err) {
        logger.warn(`[cache] invalidation failed for pattern ${pattern}: ${err.message}`);
    }
}

module.exports = { getCached, setCached, invalidatePattern, DEFAULT_TTL_SECONDS };