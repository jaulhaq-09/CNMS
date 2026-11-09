const express = require('express');
const router = express.Router();
const analyticsController = require('../controllers/analyticsController');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');

// Matches PERMISSIONS.ANALYTICS_VIEW on the frontend, which is granted
// to SUPER_ADMIN, and COORDINATOR (not FACULTY/GUEST).
router.get(
  '/dashboard',
  authenticate,
  authorize('SUPER_ADMIN', 'COORDINATOR'),
  analyticsController.getDashboard
);

router.get(
  '/events',
  authenticate,
  authorize('SUPER_ADMIN', 'COORDINATOR'),
  analyticsController.getEventAnalytics
);

router.get(
  '/newsletters',
  authenticate,
  authorize('SUPER_ADMIN', 'COORDINATOR'),
  analyticsController.getNewsletterAnalytics
);

router.get(
  '/users',
  authenticate,
  authorize('SUPER_ADMIN', 'COORDINATOR'),
  analyticsController.getUserAnalytics
);

module.exports = router;