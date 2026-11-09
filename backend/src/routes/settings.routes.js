const express = require('express');
const router = express.Router();
const settingsController = require('../controllers/settingsController');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');

router.get('/', authenticate, settingsController.getSettings);
router.put('/', authenticate, authorize('SUPER_ADMIN'), settingsController.updateSettings);

module.exports = router;