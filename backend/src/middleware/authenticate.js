const AuthService = require('../services/authService');
const logger = require('../utils/logger');

const authenticate = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'No authentication token provided',
      });
    }

    const decoded = AuthService.verifyToken(token);

    // Block 2FA challenge tokens from being used as real session tokens
    if (decoded.role === 'PENDING_2FA') {
      return res.status(401).json({
        success: false,
        message: '2FA verification required to complete login',
        code: 'TWO_FACTOR_REQUIRED',
      });
    }

    const user = await AuthService.getUserById(decoded.userId);

    if (!user || !user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'User not found or inactive',
      });
    }

    const userRoles =
      Array.isArray(user.roles) && user.roles.length > 0
        ? user.roles
        : [user.role || 'FACULTY'];
    if (!userRoles.includes(decoded.role)) {
      return res.status(401).json({
        success: false,
        message: 'This session role is no longer assigned to your account. Please log in again.',
      });
    }

    // The JWT records the role chosen at login. Keep that role for this
    // request rather than replacing it with the user's primary stored role.
    user.role = decoded.role;

    // Temporary-password accounts may only use the auth endpoints
    // (change password, who am I, logout) until they set their own password.
    if (user.mustChangePassword && !req.originalUrl.startsWith('/api/auth')) {
      return res.status(403).json({
        success: false,
        message: 'Please set your own password before continuing.',
        code: 'PASSWORD_CHANGE_REQUIRED',
      });
    }

    // GUEST = signed in but no role assigned yet. Allow only what the
    // "waiting for access" screen needs; everything else is refused.
    if (user.role === 'GUEST') {
      const url = req.originalUrl.split('?')[0];
      const guestAllowed =
        url.startsWith('/api/auth') ||
        url.startsWith('/api/notifications') ||
        url.startsWith('/api/users/profile') ||
        (req.method === 'GET' && url.startsWith('/api/settings'));

      if (!guestAllowed) {
        return res.status(403).json({
          success: false,
          message: 'Your account is waiting for the administrator to assign a role.',
          code: 'GUEST_RESTRICTED',
        });
      }
    }

    req.user = user;
    req.token = token;

    next();
  } catch (error) {
    logger.error('Authentication error:', error);

    // FIXED: previously this also matched on
    // `error.message === 'Invalid or expired token'`, which is the
    // generic message verifyToken() ALWAYS throws for every failure
    // type (expired, malformed, wrong secret, tampered — all of them).
    // That meant every single auth failure got relabeled TOKEN_EXPIRED
    // and told the frontend to silently attempt a token refresh, even
    // when the real problem was something the refresh could never fix.
    // Now it only fires on an actual TokenExpiredError.
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token expired',
        code: 'TOKEN_EXPIRED',
      });
    }

    return res.status(401).json({
      success: false,
      message: error.message || 'Invalid or expired token',
    });
  }
};

module.exports = authenticate;