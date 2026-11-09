const logger = require('../utils/logger');

const authorize = (...allowedRoles) => {
  return (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'User not authenticated',
        });
      }

      if (!allowedRoles.includes(req.user.role)) {
        logger.warn(`Unauthorized access attempt by ${req.user.email} to ${req.path}`);
        return res.status(403).json({
          success: false,
          message: 'You do not have permission to access this resource',
          requiredRole: allowedRoles,
          userRole: req.user.role,
        });
      }

      next();
    } catch (error) {
      logger.error('Authorization error:', error.message);
      return res.status(500).json({
        success: false,
        message: 'Authorization check failed',
      });
    }
  };
};

module.exports = authorize;