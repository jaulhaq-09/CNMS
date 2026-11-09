const rateLimit = require('express-rate-limit');

// Limits are counted per account (email / phone typed in), not per IP, because
// everyone on the college network shares one IP address. The global /api
// limiter in app.js still guards each IP.
const byField = (...fields) => (req) => {
  for (const f of fields) {
    const v = req.body && req.body[f];
    if (v) return `${f}:${String(v).trim().toLowerCase().slice(0, 120)}`;
  }
  return 'anonymous';
};

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 8,
  keyGenerator: byField('email'),
  message: {
    success: false,
    message: 'Too many login attempts. Please try again in 15 minutes.',
  },
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
});

const forgotPasswordLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,
  keyGenerator: byField('identifier', 'email'),
  message: {
    success: false,
    message: 'Too many reset requests. Please try again in an hour.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const forgotUsernameLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  keyGenerator: byField('identifier'),
  message: {
    success: false,
    message: 'Too many requests. Please try again in an hour.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const verifyEmailLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: {
    success: false,
    message: 'Too many verification requests. Please try again later.',
  },
});

const twoFactorLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: {
    success: false,
    message: 'Too many 2FA attempts. Please try again in 15 minutes.',
  },
});

module.exports = {
  loginLimiter,
  forgotPasswordLimiter,
  forgotUsernameLimiter,
  verifyEmailLimiter,
  twoFactorLimiter,
};