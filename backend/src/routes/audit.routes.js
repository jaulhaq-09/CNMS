const express = require('express');
const router = express.Router();
const auditController = require('../controllers/auditController');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');

router.get('/actors', authenticate, authorize('SUPER_ADMIN'), auditController.getAuditActors);
router.get('/', authenticate, authorize('SUPER_ADMIN'), auditController.getAuditLogs);

module.exports = router;